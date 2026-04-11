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
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null); // remote screen share
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const iceCandidatesQueue = useRef([]);
  const durationTimer = useRef(null);
  const callStateRef = useRef('idle');

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
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidatesQueue.current = [];
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
  const startCall = useCallback(async (targetUser, type = 'audio') => {
    if (!webrtcAvailable) { console.warn('[call] WebRTC not available — cannot start call'); return; }
    if (callStateRef.current !== 'idle') return;
    try {
      setCallState('outgoing');
      setCallType(type);
      setRemoteUser(targetUser);
      setIsSpeaker(type === 'video');

      const stream = await getMedia(type === 'video');
      setLocalStream(stream);

      const pc = createPeerConnection(targetUser.id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Auto-end if not answered in 30s
      setTimeout(() => {
        if (callStateRef.current === 'outgoing') {
          endCall();
        }
      }, 30000);

      emit('call:request', {
        targetUserId: targetUser.id,
        callType: type,
        signalData: { type: 'offer', sdp: offer.sdp },
      });
    } catch (err) {
      console.log('[call] startCall error:', err.message);
      cleanup();
    }
  }, [getMedia, createPeerConnection, emit, cleanup]);

  // ─── Accept incoming call ─────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!webrtcAvailable) { console.warn('[call] WebRTC not available — cannot accept call'); return; }
    if (callStateRef.current !== 'incoming' || !remoteUser) return;
    try {
      const type = callType;
      setIsSpeaker(type === 'video');

      const stream = await getMedia(type === 'video');
      setLocalStream(stream);

      const pc = createPeerConnection(remoteUser.id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // Set remote offer FIRST (saved from incoming_request)
      const savedOffer = iceCandidatesQueue.current._offer;
      if (savedOffer && pc.remoteDescription === null) {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: savedOffer.sdp || savedOffer,
        }));
      }

      // Process queued ICE candidates AFTER setting remote description
      const queuedCandidates = [...iceCandidatesQueue.current].filter(c => c && typeof c === 'object' && !c._offer);
      for (const candidate of queuedCandidates) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
      iceCandidatesQueue.current = [];

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      emit('call:accept', {
        targetUserId: remoteUser.id,
        signalData: { type: 'answer', sdp: answer.sdp },
      });

      setCallState('active');
    } catch (err) {
      console.log('[call] acceptCall error:', err.message);
      cleanup();
    }
  }, [callType, remoteUser, getMedia, createPeerConnection, emit, cleanup]);

  // ─── Reject / end call ────────────────────────────────
  const rejectCall = useCallback(() => {
    if (remoteUser) {
      emit('call:reject', { targetUserId: remoteUser.id, reason: 'declined' });
    }
    cleanup();
  }, [remoteUser, emit, cleanup]);

  const endCall = useCallback(() => {
    if (remoteUser) {
      emit('call:stop', { targetUserId: remoteUser.id });
    }
    cleanup();
  }, [remoteUser, emit, cleanup]);

  // ─── Toggle controls ──────────────────────────────────
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleVideo = useCallback(async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  }, [localStream]);

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
      iceCandidatesQueue.current._offer = data.signalData;
      // Auto-reject after 30s if not answered
      setTimeout(() => {
        if (callStateRef.current === 'incoming') {
          emit('call:reject', { targetUserId: data.fromUserId, reason: 'no_answer' });
          cleanup();
        }
      }, 30000);
    });

    // Call accepted by remote
    const offAccepted = on('call:accepted', async (data) => {
      try {
        const pc = pcRef.current;
        if (!pc) return;
        if (data.signalData?.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.signalData.sdp }));
        }
        setCallState('active');
      } catch (err) {
        console.log('[call] accepted error:', err.message);
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
        const pc = pcRef.current;
        if (!pc) {
          // Queue candidate if PC not ready
          if (data.signalData?.type === 'candidate') {
            iceCandidatesQueue.current.push(data.signalData.candidate);
          }
          return;
        }
        if (data.signalData?.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(data.signalData.candidate));
        } else if (data.signalData?.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.signalData.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emit('call:signal', { targetUserId: data.fromUserId, signalData: { type: 'answer', sdp: answer.sdp } });
        } else if (data.signalData?.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.signalData.sdp }));
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
