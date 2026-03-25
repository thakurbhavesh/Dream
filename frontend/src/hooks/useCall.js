import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "../contexts/SocketContext.jsx";

/**
 * Audio/Video call hook using WebRTC.
 * State machine: idle → calling → incoming → connecting → active
 * Reuses same signaling pattern as useScreenShare.js
 */

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const useCall = () => {
  const socket = useSocket();

  const [status, setStatus] = useState("idle");
  const [callType, setCallType] = useState(null); // 'audio' | 'video'
  const [peerUserId, setPeerUserId] = useState(null);
  const [peerUserName, setPeerUserName] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const statusRef = useRef("idle");
  const peerUserIdRef = useRef(null);
  const callTypeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { peerUserIdRef.current = peerUserId; }, [peerUserId]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);

  // Call duration timer
  useEffect(() => {
    if (status === "active") {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // ─── Cleanup ──────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setStatus("idle");
    setCallType(null);
    setPeerUserId(null);
    setPeerUserName(null);
    setError(null);
    setIsMuted(false);
    setIsVideoOff(false);
  }, []);

  // ─── Get user media ───────────────────────────────────────────────
  const getMedia = useCallback(async (type) => {
    let stream;
    if (type === "video") {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        });
      } catch (err) {
        // Camera busy or unavailable — fallback to audio only
        console.warn("[call] Camera unavailable, falling back to audio:", err.message);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  // ─── Create RTCPeerConnection ─────────────────────────────────────
  const createPeerConnection = useCallback(
    (stream) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate && peerUserIdRef.current && socket) {
          socket.emit("call:signal", {
            targetUserId: peerUserIdRef.current,
            signalData: { type: "candidate", candidate: event.candidate },
          });
        }
      };

      const checkConnected = () => {
        const cs = pc.connectionState;
        const ice = pc.iceConnectionState;
        console.log("[call] connection:", cs, "ice:", ice);
        if (cs === "connected" || ice === "connected" || ice === "completed") {
          if (statusRef.current !== "active") setStatus("active");
        } else if (cs === "failed" || ice === "failed") {
          if (peerUserIdRef.current && socket) {
            socket.emit("call:stop", { targetUserId: peerUserIdRef.current, reason: "connection_lost" });
          }
          cleanup();
        } else if (cs === "disconnected" || ice === "disconnected") {
          // Give a brief moment for reconnection before cleanup
          setTimeout(() => {
            if (pc.connectionState === "disconnected" || pc.iceConnectionState === "disconnected") {
              if (peerUserIdRef.current && socket) {
                socket.emit("call:stop", { targetUserId: peerUserIdRef.current, reason: "connection_lost" });
              }
              cleanup();
            }
          }, 3000);
        }
      };

      pc.onconnectionstatechange = checkConnected;
      pc.oniceconnectionstatechange = checkConnected;

      pc.ontrack = (event) => {
        if (event.streams?.[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Add local tracks
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      pcRef.current = pc;
      return pc;
    },
    [socket, cleanup]
  );

  // ─── Start caller flow (after callee accepts) ─────────────────────
  const startCallerFlow = useCallback(
    async (acceptedByUserId, acceptedByUserName) => {
      try {
        setStatus("connecting");
        setPeerUserId(acceptedByUserId);
        setPeerUserName(acceptedByUserName);

        const stream = await getMedia(callTypeRef.current || "audio");
        const pc = createPeerConnection(stream);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call:signal", {
          targetUserId: acceptedByUserId,
          signalData: { type: "offer", sdp: offer },
        });
      } catch (err) {
        if (err.name === "NotAllowedError") {
          setError("Microphone/camera permission denied");
        } else {
          setError(err.message);
        }
        socket?.emit("call:stop", { targetUserId: peerUserIdRef.current, reason: "error" });
        cleanup();
      }
    },
    [socket, getMedia, createPeerConnection, cleanup]
  );

  // ─── Handle signaling ─────────────────────────────────────────────
  const handleSignal = useCallback(
    async (fromUserId, signalData) => {
      try {
        if (signalData.type === "offer") {
          const stream = await getMedia(callTypeRef.current || "audio");
          const pc = createPeerConnection(stream);

          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidatesRef.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("call:signal", {
            targetUserId: fromUserId,
            signalData: { type: "answer", sdp: answer },
          });
          setStatus("connecting");
        } else if (signalData.type === "answer") {
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
            for (const c of pendingCandidatesRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidatesRef.current = [];
          }
        } else if (signalData.type === "candidate") {
          if (pcRef.current && pcRef.current.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          } else {
            pendingCandidatesRef.current.push(signalData.candidate);
          }
        }
      } catch (err) {
        console.error("[call] signal error:", err);
        setError(err.message);
        if (peerUserIdRef.current && socket) {
          socket.emit("call:stop", { targetUserId: peerUserIdRef.current, reason: "error" });
        }
        cleanup();
      }
    },
    [socket, getMedia, createPeerConnection, cleanup]
  );

  // ─── Public API ───────────────────────────────────────────────────
  const startCall = useCallback(
    (targetUserId, type = "audio", peerName = null) => {
      if (!socket || statusRef.current !== "idle") return;
      setStatus("calling");
      setCallType(type);
      setPeerUserId(String(targetUserId));
      if (peerName) setPeerUserName(peerName);

      socket.emit("call:request", { targetUserId: String(targetUserId), callType: type }, (res) => {
        if (res?.error) {
          setError(res.error);
          cleanup();
        }
      });
    },
    [socket, cleanup]
  );

  const acceptCall = useCallback(() => {
    if (!socket || statusRef.current !== "incoming") return;
    const targetId = peerUserIdRef.current;
    setStatus("accepted");
    socket.emit("call:accept", { targetUserId: targetId });
  }, [socket]);

  const rejectCall = useCallback(() => {
    if (!socket) return;
    const targetId = peerUserIdRef.current;
    if (targetId) {
      socket.emit("call:reject", { targetUserId: targetId, reason: "declined" });
    }
    cleanup();
  }, [socket, cleanup]);

  const endCall = useCallback(() => {
    if (!socket) return;
    const targetId = peerUserIdRef.current;
    if (targetId) {
      socket.emit("call:stop", { targetUserId: targetId, reason: "ended" });
    }
    cleanup();
  }, [socket, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

  // Keep refs to latest callbacks so socket listeners don't need to re-attach
  const startCallerFlowRef = useRef(startCallerFlow);
  const handleSignalRef = useRef(handleSignal);
  const cleanupRef = useRef(cleanup);
  useEffect(() => { startCallerFlowRef.current = startCallerFlow; }, [startCallerFlow]);
  useEffect(() => { handleSignalRef.current = handleSignal; }, [handleSignal]);
  useEffect(() => { cleanupRef.current = cleanup; }, [cleanup]);

  // ─── Socket listeners (only re-attach when socket changes) ──────
  useEffect(() => {
    if (!socket) {
      console.log("[call] no socket, skipping listeners");
      return;
    }
    console.log("[call] attaching socket listeners, socket.id=", socket.id);

    const onIncoming = (data) => {
      console.log("[call] incoming_request received:", data, "current status:", statusRef.current);
      if (statusRef.current !== "idle") {
        console.log("[call] ignoring incoming — not idle");
        return;
      }
      setStatus("incoming");
      setCallType(data.callType || "audio");
      setPeerUserId(String(data.fromUserId));
      setPeerUserName(data.fromUserName || "Unknown");
    };

    const onAccepted = (data) => {
      console.log("[call] accepted received:", data, "current status:", statusRef.current);
      if (statusRef.current !== "calling") return;
      startCallerFlowRef.current(String(data.fromUserId), data.fromUserName || "Unknown");
    };

    const onRejected = () => {
      console.log("[call] rejected received");
      if (statusRef.current === "calling") {
        setError("Call declined");
        cleanupRef.current();
      }
    };

    const onSignal = (data) => {
      handleSignalRef.current(String(data.fromUserId), data.signalData);
    };

    const onStopped = () => {
      console.log("[call] stopped received");
      cleanupRef.current();
    };

    socket.on("call:incoming_request", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:signal", onSignal);
    socket.on("call:stopped", onStopped);

    return () => {
      console.log("[call] detaching socket listeners");
      socket.off("call:incoming_request", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:signal", onSignal);
      socket.off("call:stopped", onStopped);
    };
  }, [socket]); // Only re-attach when socket itself changes

  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    callType,
    peerUserId,
    peerUserName,
    localStream,
    remoteStream,
    error,
    isMuted,
    isVideoOff,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
};

export default useCall;
