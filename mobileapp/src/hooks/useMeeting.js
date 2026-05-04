import { useEffect, useRef, useState, useCallback } from 'react';
import useSocket from './useSocket';
import { useAuth } from '../store/AuthContext';

// react-native-webrtc is unavailable in Expo Go. We require it lazily so the
// rest of the app keeps working there; meeting room shows a friendly notice.
let RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, MediaStream, mediaDevices;
let webrtcAvailable = false;
try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  MediaStream = webrtc.MediaStream;
  mediaDevices = webrtc.mediaDevices;
  webrtcAvailable = true;
} catch (e) {
  // expected in Expo Go
}

export const isWebrtcAvailable = () => webrtcAvailable;

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:a.relay.metered.ca:80', username: 'e8dd65b92a0abe29be4e6ed4', credential: '5sIJGwERkrG2tLLu' },
    { urls: 'turn:a.relay.metered.ca:443', username: 'e8dd65b92a0abe29be4e6ed4', credential: '5sIJGwERkrG2tLLu' },
    { urls: 'turns:a.relay.metered.ca:443?transport=tcp', username: 'e8dd65b92a0abe29be4e6ed4', credential: '5sIJGwERkrG2tLLu' },
  ],
};

/**
 * Multi-participant meeting hook (mesh WebRTC).
 * Mirrors the web `useMeeting` signaling contract:
 *   meeting:join, meeting:leave, meeting:signal,
 *   meeting:user-joined, meeting:user-left,
 *   meeting:chat, meeting:chat-message,
 *   meeting:reaction, meeting:media-state, meeting:pin,
 *   meeting:host:mute-all, meeting:host:remove,
 *   meeting:force-mute, meeting:removed, meeting:ended.
 */
export default function useMeeting() {
  const { emit, on, socket } = useSocket();
  const { user } = useAuth();

  const [status, setStatus] = useState('idle');         // idle | joining | active
  const [meetingRoomId, setMeetingRoomId] = useState(null);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [participants, setParticipants] = useState([]); // [{ socketId, userId, userName, stream, audio, video, screenShare, handRaised }]
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [pinnedSocketId, setPinnedSocketId] = useState(null);
  const [duration, setDuration] = useState(0);

  const peersRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const meetingRoomIdRef = useRef(null);
  const statusRef = useRef('idle');
  const myUserNameRef = useRef('');
  const negotiatingRef = useRef(new Set());
  const timerRef = useRef(null);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { meetingRoomIdRef.current = meetingRoomId; }, [meetingRoomId]);

  // ─── Duration timer ───────────────────────────────────────────────
  useEffect(() => {
    if (status === 'active') {
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // ─── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => () => { cleanupAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanupAll = useCallback(() => {
    for (const pc of peersRef.current.values()) {
      try { pc.close(); } catch {}
    }
    peersRef.current.clear();
    remoteStreamsRef.current.clear();
    negotiatingRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setParticipants([]);
    setChatMessages([]);
    setIsMuted(true);
    setIsVideoOff(true);
    setHandRaised(false);
    setDuration(0);
    setPinnedSocketId(null);
  }, []);

  // ─── Create peer connection (idempotent) ──────────────────────────
  const createPeer = useCallback((targetSocketId, targetUserId, targetUserName, initiator) => {
    if (!webrtcAvailable) return null;
    if (peersRef.current.has(targetSocketId)) return peersRef.current.get(targetSocketId);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(targetSocketId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try { pc.addTrack(track, localStreamRef.current); } catch {}
      });
    }

    const remoteStream = new MediaStream();
    remoteStreamsRef.current.set(targetSocketId, remoteStream);

    pc.ontrack = (event) => {
      const track = event.track;
      if (!track) return;
      // Replace any existing track of the same kind
      remoteStream.getTracks().forEach((t) => {
        if (t.kind === track.kind && t.id !== track.id) {
          try { remoteStream.removeTrack(t); } catch {}
        }
      });
      if (!remoteStream.getTracks().find((t) => t.id === track.id)) {
        try { remoteStream.addTrack(track); } catch {}
      }
      setParticipants((prev) => {
        const exists = prev.find((p) => p.socketId === targetSocketId);
        if (exists) return prev.map((p) => p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p);
        return [...prev, {
          socketId: targetSocketId, userId: targetUserId, userName: targetUserName,
          stream: remoteStream, audio: true, video: true, screenShare: false, handRaised: false,
        }];
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emit('meeting:signal', {
          meetingRoomId: meetingRoomIdRef.current,
          targetSocketId,
          signalData: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      if (negotiatingRef.current.has(targetSocketId)) return;
      if (pc.signalingState !== 'stable') return;
      negotiatingRef.current.add(targetSocketId);
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        emit('meeting:signal', {
          meetingRoomId: meetingRoomIdRef.current,
          targetSocketId,
          signalData: { type: 'offer', sdp: pc.localDescription },
        });
      } catch (err) {
        console.warn('[useMeeting] renegotiation failed:', err.message);
      } finally {
        negotiatingRef.current.delete(targetSocketId);
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'failed' || s === 'closed') {
        peersRef.current.delete(targetSocketId);
        remoteStreamsRef.current.delete(targetSocketId);
        negotiatingRef.current.delete(targetSocketId);
        setParticipants((prev) => prev.filter((p) => p.socketId !== targetSocketId));
      }
    };

    if (initiator) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          emit('meeting:signal', {
            meetingRoomId: meetingRoomIdRef.current,
            targetSocketId,
            signalData: { type: 'offer', sdp: pc.localDescription },
          });
        } catch (err) {
          console.warn('[useMeeting] initial offer failed:', err.message);
        }
      })();
    }

    return pc;
  }, [emit]);

  // ─── Join meeting (no media until user toggles) ───────────────────
  const joinMeeting = useCallback(async ({ meetingRoomId: roomId, meetingData, userName }) => {
    if (!webrtcAvailable) return { error: 'webrtc_unavailable' };
    if (statusRef.current !== 'idle') return { error: 'busy' };
    setStatus('joining');
    setMeetingRoomId(roomId);
    setMeetingInfo(meetingData || null);
    myUserNameRef.current = userName || 'User';
    setIsMuted(true);
    setIsVideoOff(true);

    return new Promise((resolve) => {
      try {
        socket?.emit('meeting:join', { meetingRoomId: roomId, userName }, (res) => {
          if (res?.error) {
            cleanupAll();
            setStatus('idle');
            return resolve({ error: res.error });
          }
          setStatus('active');
          const existing = res?.participants || [];
          for (const p of existing) {
            if (p.socketId !== socket?.id) {
              createPeer(p.socketId, p.userId, p.userName, true);
              setParticipants((prev) => {
                if (prev.find((x) => x.socketId === p.socketId)) return prev;
                return [...prev, {
                  socketId: p.socketId, userId: p.userId, userName: p.userName,
                  stream: null, audio: true, video: true, screenShare: false, handRaised: false,
                }];
              });
            }
          }
          resolve({ ok: true });
        });
      } catch (err) {
        cleanupAll();
        setStatus('idle');
        resolve({ error: err.message });
      }
    });
  }, [socket, cleanupAll, createPeer]);

  const leaveMeeting = useCallback(() => {
    if (statusRef.current === 'idle') return;
    emit('meeting:leave', { meetingRoomId: meetingRoomIdRef.current });
    cleanupAll();
    setMeetingRoomId(null);
    setMeetingInfo(null);
    setStatus('idle');
  }, [emit, cleanupAll]);

  const addTrackToPeers = useCallback((track, stream) => {
    for (const pc of peersRef.current.values()) {
      const has = pc.getSenders().find((s) => s.track?.id === track.id);
      if (!has) {
        try { pc.addTrack(track, stream); } catch {}
      }
    }
  }, []);

  // ─── Toggle mic (lazy mic access) ─────────────────────────────────
  const toggleMute = useCallback(async () => {
    if (!webrtcAvailable) return;
    if (isMuted) {
      if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) {
        try {
          const stream = await mediaDevices.getUserMedia({ audio: true });
          const audioTrack = stream.getAudioTracks()[0];
          if (localStreamRef.current) {
            try { localStreamRef.current.addTrack(audioTrack); } catch {}
          } else {
            localStreamRef.current = stream;
          }
          setLocalStream(localStreamRef.current);
          addTrackToPeers(audioTrack, localStreamRef.current);
        } catch (err) {
          console.warn('[useMeeting] mic access failed:', err.message);
          return;
        }
      } else {
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
      }
      setIsMuted(false);
      emit('meeting:media-state', { meetingRoomId: meetingRoomIdRef.current, audio: true });
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
      }
      setIsMuted(true);
      emit('meeting:media-state', { meetingRoomId: meetingRoomIdRef.current, audio: false });
    }
  }, [isMuted, emit, addTrackToPeers]);

  // ─── Toggle camera ────────────────────────────────────────────────
  const toggleVideo = useCallback(async () => {
    if (!webrtcAvailable) return;
    if (isVideoOff) {
      try {
        const stream = await mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });
        const videoTrack = stream.getVideoTracks()[0];
        if (localStreamRef.current) {
          try { localStreamRef.current.addTrack(videoTrack); } catch {}
        } else {
          localStreamRef.current = stream;
        }
        setLocalStream(localStreamRef.current);
        addTrackToPeers(videoTrack, localStreamRef.current);
        setIsVideoOff(false);
        emit('meeting:media-state', { meetingRoomId: meetingRoomIdRef.current, video: true });
      } catch (err) {
        console.warn('[useMeeting] camera access failed:', err.message);
      }
    } else {
      // Stop the video track entirely so the OS camera indicator clears.
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach((track) => {
          try { track.stop(); } catch {}
          try { localStreamRef.current.removeTrack(track); } catch {}
          // Remove sender from each peer
          for (const pc of peersRef.current.values()) {
            const sender = pc.getSenders().find((s) => s.track?.id === track.id);
            if (sender) { try { pc.removeTrack(sender); } catch {} }
          }
        });
        if (localStreamRef.current.getTracks().length === 0) {
          localStreamRef.current = null;
        }
        setLocalStream(localStreamRef.current);
      }
      setIsVideoOff(true);
      emit('meeting:media-state', { meetingRoomId: meetingRoomIdRef.current, video: false });
    }
  }, [isVideoOff, emit, addTrackToPeers]);

  // ─── Camera flip ─────────────────────────────────────────────────
  const switchCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      if (typeof track._switchCamera === 'function') {
        try { track._switchCamera(); } catch {}
      }
    });
  }, []);

  // ─── Chat ─────────────────────────────────────────────────────────
  const sendChatMessage = useCallback((text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    emit('meeting:chat', {
      meetingRoomId: meetingRoomIdRef.current,
      message: trimmed,
      userName: myUserNameRef.current,
    });
  }, [emit]);

  // ─── Reactions / hand-raise ───────────────────────────────────────
  const sendReaction = useCallback((reaction) => {
    emit('meeting:reaction', {
      meetingRoomId: meetingRoomIdRef.current,
      reaction,
      userName: myUserNameRef.current,
    });
  }, [emit]);

  const toggleHandRaise = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    sendReaction(next ? 'hand-raise' : 'hand-lower');
  }, [handRaised, sendReaction]);

  const pinParticipant = useCallback((targetSocketId) => {
    setPinnedSocketId((prev) => prev === targetSocketId ? null : targetSocketId);
  }, []);

  const muteAll = useCallback(() => {
    emit('meeting:host:mute-all', { meetingRoomId: meetingRoomIdRef.current });
  }, [emit]);

  const removeParticipant = useCallback((targetSocketId, targetUserId) => {
    emit('meeting:host:remove', {
      meetingRoomId: meetingRoomIdRef.current,
      targetSocketId,
      targetUserId,
    });
  }, [emit]);

  // ─── Socket listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onUserJoined = ({ socketId, userId: uid, userName }) => {
      if (statusRef.current === 'idle') return;
      createPeer(socketId, uid, userName, false);
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, {
          socketId, userId: uid, userName, stream: null,
          audio: true, video: true, screenShare: false, handRaised: false,
        }];
      });
    };

    const onUserLeft = ({ socketId }) => {
      const pc = peersRef.current.get(socketId);
      if (pc) { try { pc.close(); } catch {} }
      peersRef.current.delete(socketId);
      remoteStreamsRef.current.delete(socketId);
      negotiatingRef.current.delete(socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    const onSignal = async ({ fromSocketId, fromUserId, signalData }) => {
      if (statusRef.current === 'idle') return;
      let pc = peersRef.current.get(fromSocketId);
      try {
        if (signalData.type === 'offer') {
          if (!pc) pc = createPeer(fromSocketId, fromUserId, '', false);
          if (pc.signalingState !== 'stable') {
            try { await pc.setLocalDescription({ type: 'rollback' }); } catch {}
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emit('meeting:signal', {
            meetingRoomId: meetingRoomIdRef.current,
            targetSocketId: fromSocketId,
            signalData: { type: 'answer', sdp: pc.localDescription },
          });
          negotiatingRef.current.delete(fromSocketId);
        } else if (signalData.type === 'answer') {
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
            negotiatingRef.current.delete(fromSocketId);
          }
        } else if (signalData.type === 'candidate') {
          if (pc && pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate)); } catch (e) {
              console.warn('[useMeeting] ICE add failed:', e.message);
            }
          }
        }
      } catch (err) {
        console.warn('[useMeeting] signal handler error:', err.message);
      }
    };

    const onChatMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    const onReaction = ({ userId: uid, socketId, reaction, userName }) => {
      const id = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      setReactions((prev) => [...prev, { id, userId: uid, socketId, reaction, userName }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3000);
      if (reaction === 'hand-raise' || reaction === 'hand-lower') {
        setParticipants((prev) =>
          prev.map((p) => p.socketId === socketId ? { ...p, handRaised: reaction === 'hand-raise' } : p)
        );
      }
    };

    const onMediaState = ({ socketId, audio, video, screenShare }) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.socketId !== socketId) return p;
          const next = { ...p };
          if (audio !== undefined) next.audio = audio;
          if (video !== undefined) next.video = video;
          if (screenShare !== undefined) next.screenShare = screenShare;
          return next;
        })
      );
    };

    const onPin = ({ targetSocketId, pinned }) => {
      if (pinned) setPinnedSocketId(targetSocketId);
      else setPinnedSocketId((prev) => prev === targetSocketId ? null : prev);
    };

    const onForceMute = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
      }
      setIsMuted(true);
      emit('meeting:media-state', { meetingRoomId: meetingRoomIdRef.current, audio: false });
    };

    const onRemoved = () => {
      if (statusRef.current !== 'idle') {
        cleanupAll();
        setMeetingRoomId(null);
        setMeetingInfo(null);
        setStatus('idle');
      }
    };

    const onMeetingEnded = () => {
      if (statusRef.current !== 'idle') {
        cleanupAll();
        setMeetingRoomId(null);
        setMeetingInfo(null);
        setStatus('idle');
      }
    };

    const subs = [
      on('meeting:user-joined', onUserJoined),
      on('meeting:user-left', onUserLeft),
      on('meeting:signal', onSignal),
      on('meeting:chat-message', onChatMessage),
      on('meeting:reaction', onReaction),
      on('meeting:media-state', onMediaState),
      on('meeting:pin', onPin),
      on('meeting:ended', onMeetingEnded),
      on('meeting:force-mute', onForceMute),
      on('meeting:removed', onRemoved),
    ];

    return () => { subs.forEach((u) => { try { u && u(); } catch {} }); };
  }, [socket, on, emit, createPeer, cleanupAll]);

  return {
    status, meetingRoomId, meetingInfo, participants, localStream,
    isMuted, isVideoOff, chatMessages, handRaised, reactions,
    pinnedSocketId, duration,
    webrtcAvailable,
    joinMeeting, leaveMeeting, toggleMute, toggleVideo, switchCamera,
    sendChatMessage, sendReaction, toggleHandRaise, pinParticipant,
    muteAll, removeParticipant,
  };
}
