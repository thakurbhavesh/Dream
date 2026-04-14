import { useEffect, useRef, useState, useCallback } from 'react';
import useSocket from './useSocket';
import { useAuth } from '../store/AuthContext';

let RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices;
let webrtcAvailable = false;
try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
  webrtcAvailable = true;
} catch (e) {
  console.warn('[useCall] WebRTC not available (Expo Go?) — calling disabled');
}

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:a.relay.metered.ca:80', username: 'e8dd65b92a0abe29be4e6ed4', credential: '5sIJGwERkrG2tLLu' },
    { urls: 'turn:a.relay.metered.ca:443', username: 'e8dd65b92a0abe29be4e6ed4', credential: '5sIJGwERkrG2tLLu' },
    { urls: 'turns:a.relay.metered.ca:443?transport=tcp', username: 'e8dd65b92a0abe29be4e6ed4', credential: '5sIJGwERkrG2tLLu' },
  ],
};

// Call states: idle | outgoing | incoming | active
export default function useCall() {
  const { emit, on, connected } = useSocket();
  const { user } = useAuth();

  const [callState, setCallState] = useState('idle');       // idle | outgoing | incoming | active
  const [callType, setCallType] = useState(null);           // 'audio' | 'video'
  const [remoteUser, setRemoteUser] = useState(null);       // { id, name, avatar }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [peerMuted, setPeerMuted] = useState(false);
  const [peerVideoOff, setPeerVideoOff] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null); // remote screen share
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const iceCandidatesQueue = useRef([]);
  const durationTimer = useRef(null);
  const callStateRef = useRef('idle');
  const callTypeRef = useRef(null);
  const remoteUserRef = useRef(null);
  const ringTimeoutRef = useRef(null);

  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { remoteUserRef.current = remoteUser; }, [remoteUser]);

  // Keep ref in sync
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // Duration timer
  useEffect(() => {
    if (callState === 'active') {
      setCallDuration(0);
      durationTimer.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (durationTimer.current) clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
    return () => { if (durationTimer.current) clearInterval(durationTimer.current); };
  }, [callState]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    iceCandidatesQueue.current = [];
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setScreenStream(null);
    setCallState('idle');
    setCallType(null);
    setRemoteUser(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setPeerMuted(false);
    setPeerVideoOff(false);
    setCallDuration(0);
  }, [localStream]);

  const getMedia = useCallback(async (video) => {
    const constraints = { audio: true, video: video ? { facingMode: 'user', width: 640, height: 480 } : false };
    const stream = await mediaDevices.getUserMedia(constraints);
    return stream;
  }, []);

  const createPeerConnection = useCallback((targetUserId) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        emit('call:signal', { targetUserId, signalData: { type: 'candidate', candidate: e.candidate } });
      }
    };

    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        const track = e.track;
        const stream = e.streams[0];
        // Detect screen share — video track with 'screen' label or second video stream
        if (track.kind === 'video' && (track.label?.includes('screen') || track.label?.includes('display') || stream.id !== remoteStream?.id)) {
          // If we already have a remote video stream, this is screen share
          if (remoteStream) {
            setScreenStream(stream);
          } else {
            setRemoteStream(stream);
          }
        } else {
          setRemoteStream(stream);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      // Only end on 'failed' — 'disconnected' is temporary (network switch)
      if (state === 'failed') {
        endCall();
      } else if (state === 'disconnected') {
        // Wait 5s — if still disconnected then end
        setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') endCall();
        }, 5000);
      }
    };

    pcRef.current = pc;
    return pc;
  }, [emit]);

  // ─── Start a call (caller side) ───────────────────────
  // Flow matches web: send call:request without offer, wait for accept, THEN send offer.
  const startCall = useCallback(async (targetUser, type = 'audio') => {
    if (!webrtcAvailable) { console.warn('[call] WebRTC not available — cannot start call'); return; }
    if (callStateRef.current !== 'idle') return;
    try {
      setCallState('outgoing');
      setCallType(type);
      setRemoteUser(targetUser);
      setIsSpeaker(type === 'video');

      emit('call:request', {
        targetUserId: targetUser.id,
        callType: type,
      });

      // Auto-cancel if not answered in 45s (matches web)
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'outgoing') {
          if (remoteUserRef.current) {
            emit('call:stop', {
              targetUserId: remoteUserRef.current.id,
              reason: 'no_answer',
              callType: callTypeRef.current || 'audio',
            });
          }
          cleanup();
        }
      }, 45000);
    } catch (err) {
      console.log('[call] startCall error:', err.message);
      cleanup();
    }
  }, [emit, cleanup]);

  // Caller-side: after callee accepts, create offer + send via call:signal
  const startCallerFlow = useCallback(async () => {
    try {
      if (!remoteUserRef.current) return;
      const type = callTypeRef.current || 'audio';
      const stream = await getMedia(type === 'video');
      setLocalStream(stream);

      const pc = createPeerConnection(remoteUserRef.current.id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      emit('call:signal', {
        targetUserId: remoteUserRef.current.id,
        signalData: { type: 'offer', sdp: offer.sdp },
      });
    } catch (err) {
      console.log('[call] startCallerFlow error:', err.message);
      cleanup();
    }
  }, [getMedia, createPeerConnection, emit, cleanup]);

  // ─── Accept incoming call ─────────────────────────────
  // Callee just sends call:accept. The caller will then send the offer via call:signal,
  // which we handle in the signal listener below (match web flow).
  const acceptCall = useCallback(() => {
    if (!webrtcAvailable) { console.warn('[call] WebRTC not available — cannot accept call'); return; }
    if (callStateRef.current !== 'incoming' || !remoteUser) return;
    try {
      setIsSpeaker(callType === 'video');
      setCallState('accepted');
      emit('call:accept', { targetUserId: remoteUser.id });
    } catch (err) {
      console.log('[call] acceptCall error:', err.message);
      cleanup();
    }
  }, [callType, remoteUser, emit, cleanup]);

  // ─── Reject / end call ────────────────────────────────
  const rejectCall = useCallback(() => {
    if (remoteUser) {
      emit('call:reject', {
        targetUserId: remoteUser.id,
        reason: 'declined',
        callType: callTypeRef.current || 'audio',
      });
    }
    cleanup();
  }, [remoteUser, emit, cleanup]);

  const endCall = useCallback(() => {
    if (remoteUser) {
      emit('call:stop', {
        targetUserId: remoteUser.id,
        reason: 'ended',
        callType: callTypeRef.current || 'audio',
      });
    }
    cleanup();
  }, [remoteUser, emit, cleanup]);

  // ─── Toggle controls ──────────────────────────────────
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const muted = !audioTrack.enabled;
        setIsMuted(muted);
        if (remoteUserRef.current) {
          emit('call:signal', {
            targetUserId: remoteUserRef.current.id,
            signalData: { type: 'media-state', muted },
          });
        }
      }
    }
  }, [localStream, emit]);

  const toggleVideo = useCallback(async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const videoOff = !videoTrack.enabled;
      setIsVideoOff(videoOff);
      if (remoteUserRef.current) {
        emit('call:signal', {
          targetUserId: remoteUserRef.current.id,
          signalData: { type: 'media-state', videoOff },
        });
      }
    }
  }, [localStream, emit]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeaker(s => !s);
    // Note: actual speaker routing handled by InCallManager or native
  }, []);

  const flipCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) videoTrack._switchCamera();
    }
  }, [localStream]);

  // Keep refs to latest callbacks so socket listeners don't re-attach on every render
  const startCallerFlowRef = useRef(startCallerFlow);
  const getMediaRef = useRef(getMedia);
  const createPcRef = useRef(createPeerConnection);
  useEffect(() => { startCallerFlowRef.current = startCallerFlow; }, [startCallerFlow]);
  useEffect(() => { getMediaRef.current = getMedia; }, [getMedia]);
  useEffect(() => { createPcRef.current = createPeerConnection; }, [createPeerConnection]);

  // ─── Socket event listeners ────────────────────────────
  useEffect(() => {
    if (!connected) return;

    // Incoming call
    const offIncoming = on('call:incoming_request', (data) => {
      if (callStateRef.current !== 'idle') {
        // Already in a call, auto-reject
        emit('call:reject', { targetUserId: data.fromUserId, reason: 'busy' });
        return;
      }
      setCallState('incoming');
      setCallType(data.callType || 'audio');
      setRemoteUser({ id: data.fromUserId, name: data.fromUserName || 'Unknown', avatar: data.fromUserAvatar });
      // Auto-reject after 45s if not answered
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'incoming') {
          emit('call:reject', { targetUserId: data.fromUserId, reason: 'no_answer', callType: data.callType || 'audio' });
          cleanup();
        }
      }, 45000);
    });

    // Call accepted by remote → caller builds the offer and sends it
    const offAccepted = on('call:accepted', async () => {
      if (callStateRef.current !== 'outgoing') return;
      if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
      try {
        await startCallerFlowRef.current();
      } catch (err) {
        console.log('[call] accepted error:', err.message);
        cleanup();
      }
    });

    // Call rejected
    const offRejected = on('call:rejected', () => {
      cleanup();
    });

    // Call stopped
    const offStopped = on('call:stopped', () => {
      cleanup();
    });

    // WebRTC signal relay
    const offSignal = on('call:signal', async (data) => {
      try {
        const sd = data.signalData;
        if (!sd) return;

        // Callee receives the first offer — build PC + getUserMedia now
        if (sd.type === 'offer' && !pcRef.current) {
          const type = callTypeRef.current || 'audio';
          const stream = await getMediaRef.current(type === 'video');
          setLocalStream(stream);
          const pc = createPcRef.current(data.fromUserId);
          stream.getTracks().forEach(t => pc.addTrack(t, stream));

          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sd.sdp }));

          // Flush any queued candidates that arrived before PC existed
          const queued = iceCandidatesQueue.current.filter(Boolean);
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          iceCandidatesQueue.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emit('call:signal', { targetUserId: data.fromUserId, signalData: { type: 'answer', sdp: answer.sdp } });
          setCallState('active');
          return;
        }

        const pc = pcRef.current;
        if (!pc) {
          // Queue candidate if PC not ready yet
          if (sd.type === 'candidate') {
            iceCandidatesQueue.current.push(sd.candidate);
          }
          return;
        }

        if (sd.type === 'candidate') {
          if (pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(sd.candidate)); } catch {}
          } else {
            iceCandidatesQueue.current.push(sd.candidate);
          }
        } else if (sd.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sd.sdp }));
          if (callStateRef.current !== 'active') setCallState('active');
          // Flush queued candidates
          const queued = iceCandidatesQueue.current.filter(Boolean);
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          iceCandidatesQueue.current = [];
        } else if (sd.type === 'media-state') {
          if (typeof sd.muted === 'boolean') setPeerMuted(sd.muted);
          if (typeof sd.videoOff === 'boolean') setPeerVideoOff(sd.videoOff);
        }
      } catch (err) {
        console.log('[call] signal error:', err.message);
      }
    });

    return () => {
      offIncoming();
      offAccepted();
      offRejected();
      offStopped();
      offSignal();
    };
  }, [connected, on, emit, cleanup]);

  return {
    callState,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    screenStream,
    isMuted,
    isVideoOff,
    peerMuted,
    peerVideoOff,
    isSpeaker,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    flipCamera,
  };
}
