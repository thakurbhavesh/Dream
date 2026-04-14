import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "../contexts/SocketContext.jsx";
import { showSystemNotification, ensureNotificationPermission } from "../utils/notificationBridge";

/**
 * Screen share lifecycle state machine:
 *   idle → requesting → (waiting for accept/reject)
 *   idle → incoming → (user decides accept/reject)
 *   accepted → connecting → active
 *   any → idle (on stop/reject/error)
 */

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    { urls: "turn:a.relay.metered.ca:80", username: "e8dd65b92a0abe29be4e6ed4", credential: "5sIJGwERkrG2tLLu" },
    { urls: "turn:a.relay.metered.ca:80?transport=tcp", username: "e8dd65b92a0abe29be4e6ed4", credential: "5sIJGwERkrG2tLLu" },
    { urls: "turn:a.relay.metered.ca:443", username: "e8dd65b92a0abe29be4e6ed4", credential: "5sIJGwERkrG2tLLu" },
    { urls: "turns:a.relay.metered.ca:443?transport=tcp", username: "e8dd65b92a0abe29be4e6ed4", credential: "5sIJGwERkrG2tLLu" },
  ],
};

const useScreenShare = () => {
  const socket = useSocket();

  // Core state
  const [status, setStatus] = useState("idle");
  // idle | requesting | incoming | accepted | connecting | active
  const [role, setRole] = useState(null); // 'sender' | 'viewer' | null
  const [peerUserId, setPeerUserId] = useState(null);
  const [peerUserName, setPeerUserName] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState(null);

  // Annotation / remote control state
  const [annotationMode, setAnnotationMode] = useState(false);
  const [controlStatus, setControlStatus] = useState("none");
  // 'none' | 'requesting' | 'granted'

  // Refs for WebRTC objects (not reactive, avoid re-renders)
  const pcRef = useRef(null); // RTCPeerConnection
  const localStreamRef = useRef(null); // getDisplayMedia stream (sender)
  const dataChannelRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const statusRef = useRef("idle");
  const peerUserIdRef = useRef(null);
  const roleRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { ensureNotificationPermission().catch(() => {}); }, []);
  useEffect(() => { peerUserIdRef.current = peerUserId; }, [peerUserId]);
  useEffect(() => { roleRef.current = role; }, [role]);

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    // Stop local display media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    // Close data channel
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch {}
      dataChannelRef.current = null;
    }
    // Close peer connection
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];
    setRemoteStream(null);
    setStatus("idle");
    setRole(null);
    setPeerUserId(null);
    setPeerUserName(null);
    setError(null);
    setAnnotationMode(false);
    setControlStatus("none");
  }, []);

  // ─── Create RTCPeerConnection ───────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (currentRole) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate && peerUserIdRef.current && socket) {
          socket.emit("screenshare:signal", {
            targetUserId: peerUserIdRef.current,
            signalData: { type: "candidate", candidate: event.candidate },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setStatus("active");
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          setError("Connection lost");
          if (peerUserIdRef.current && socket) {
            socket.emit("screenshare:stop", {
              targetUserId: peerUserIdRef.current,
              reason: "connection_lost",
            });
          }
          cleanup();
        }
      };

      // Viewer: receive remote stream
      if (currentRole === "viewer") {
        pc.ontrack = (event) => {
          if (event.streams?.[0]) {
            setRemoteStream(event.streams[0]);
          }
        };
      }

      // Data channel for annotations + remote control
      if (currentRole === "sender") {
        const dc = pc.createDataChannel("screenshare-data", { ordered: true });
        dc.onopen = () => { dataChannelRef.current = dc; };
        dc.onclose = () => { dataChannelRef.current = null; };
        dc.onmessage = (event) => handleDataChannelMessage(event);
      } else {
        pc.ondatachannel = (event) => {
          const dc = event.channel;
          dataChannelRef.current = dc;
          dc.onmessage = (event) => handleDataChannelMessage(event);
          dc.onclose = () => { dataChannelRef.current = null; };
        };
      }

      pcRef.current = pc;
      return pc;
    },
    [socket, cleanup]
  );

  // ─── DataChannel message handler ───────────────────────────────────────────
  const dataChannelListenerRef = useRef(null);

  const handleDataChannelMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data);
      if (dataChannelListenerRef.current) {
        dataChannelListenerRef.current(msg);
      }
    } catch {}
  }, []);

  const setDataChannelListener = useCallback((listener) => {
    dataChannelListenerRef.current = listener;
  }, []);

  // ─── Send via DataChannel ──────────────────────────────────────────────────
  const sendDataChannelMessage = useCallback((msg) => {
    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  // ─── Sender: Start sharing flow ────────────────────────────────────────────
  const startSenderFlow = useCallback(
    async (acceptedByUserId, acceptedByUserName) => {
      try {
        setStatus("connecting");
        setPeerUserId(acceptedByUserId);
        setPeerUserName(acceptedByUserName);

        // Prompt user to select screen/window/tab
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: true,
        });
        localStreamRef.current = stream;

        // Auto-cleanup when user clicks browser's "Stop sharing"
        stream.getVideoTracks()[0].onended = () => {
          if (peerUserIdRef.current && socket) {
            socket.emit("screenshare:stop", {
              targetUserId: peerUserIdRef.current,
              reason: "sender_stopped",
            });
          }
          cleanup();
        };

        const pc = createPeerConnection("sender");
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("screenshare:signal", {
          targetUserId: acceptedByUserId,
          signalData: { type: "offer", sdp: offer },
        });
      } catch (err) {
        // User cancelled getDisplayMedia or error
        if (err.name === "NotAllowedError" || err.name === "AbortError") {
          socket?.emit("screenshare:stop", {
            targetUserId: peerUserIdRef.current,
            reason: "cancelled",
          });
        }
        setError(err.message);
        cleanup();
      }
    },
    [socket, createPeerConnection, cleanup]
  );

  // ─── Public API: Request screen share ──────────────────────────────────────
  const requestScreenShare = useCallback(
    (targetUserId) => {
      if (!socket) return;
      if (statusRef.current !== "idle") return;

      setStatus("requesting");
      setRole("sender");
      setPeerUserId(String(targetUserId));

      socket.emit(
        "screenshare:request",
        { targetUserId: String(targetUserId) },
        (response) => {
          if (response?.error) {
            setError(response.error);
            cleanup();
          }
        }
      );
    },
    [socket, cleanup]
  );

  // ─── Public API: Accept incoming request ───────────────────────────────────
  const acceptScreenShare = useCallback(() => {
    if (!socket || statusRef.current !== "incoming") return;
    const targetId = peerUserIdRef.current;
    setStatus("accepted");
    socket.emit("screenshare:accept", { targetUserId: targetId });
  }, [socket]);

  // ─── Public API: Reject incoming request ───────────────────────────────────
  const rejectScreenShare = useCallback(() => {
    if (!socket) return;
    const targetId = peerUserIdRef.current;
    if (targetId) {
      socket.emit("screenshare:reject", {
        targetUserId: targetId,
        reason: "declined",
      });
    }
    cleanup();
  }, [socket, cleanup]);

  // ─── Public API: Stop screen share ─────────────────────────────────────────
  const stopScreenShare = useCallback(() => {
    if (!socket) return;
    const targetId = peerUserIdRef.current;
    if (targetId) {
      socket.emit("screenshare:stop", {
        targetUserId: targetId,
        reason: roleRef.current === "sender" ? "sender_stopped" : "viewer_stopped",
      });
    }
    cleanup();
  }, [socket, cleanup]);

  // ─── Public API: Remote control ────────────────────────────────────────────
  const requestControl = useCallback(() => {
    if (!socket || roleRef.current !== "viewer" || !peerUserIdRef.current) return;
    setControlStatus("requesting");
    socket.emit("screenshare:control-request", {
      targetUserId: peerUserIdRef.current,
    });
  }, [socket]);

  const grantControl = useCallback(() => {
    if (!socket || roleRef.current !== "sender" || !peerUserIdRef.current) return;
    setControlStatus("granted");
    socket.emit("screenshare:control-grant", {
      targetUserId: peerUserIdRef.current,
    });
  }, [socket]);

  const revokeControl = useCallback(() => {
    if (!socket || !peerUserIdRef.current) return;
    setControlStatus("none");
    socket.emit("screenshare:control-revoke", {
      targetUserId: peerUserIdRef.current,
    });
  }, [socket]);

  // ─── Handle WebRTC signaling data ──────────────────────────────────────────
  const handleSignal = useCallback(
    async (fromUserId, signalData) => {
      try {
        if (signalData.type === "offer") {
          // Viewer receives offer from sender
          const pc = createPeerConnection("viewer");
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));

          // Apply any pending ICE candidates
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidatesRef.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("screenshare:signal", {
            targetUserId: fromUserId,
            signalData: { type: "answer", sdp: answer },
          });
          setStatus("connecting");
        } else if (signalData.type === "answer") {
          // Sender receives answer from viewer
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription(signalData.sdp)
            );
            // Apply any pending ICE candidates
            for (const c of pendingCandidatesRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidatesRef.current = [];
          }
        } else if (signalData.type === "candidate") {
          if (pcRef.current && pcRef.current.remoteDescription) {
            await pcRef.current.addIceCandidate(
              new RTCIceCandidate(signalData.candidate)
            );
          } else {
            pendingCandidatesRef.current.push(signalData.candidate);
          }
        }
      } catch (err) {
        console.error("[screenshare] signal handling error:", err);
        setError(err.message);
      }
    },
    [socket, createPeerConnection]
  );

  // Keep refs to latest callbacks so socket listeners don't need to re-attach
  const startSenderFlowRef = useRef(startSenderFlow);
  const handleSignalRef = useRef(handleSignal);
  const cleanupRef = useRef(cleanup);
  useEffect(() => { startSenderFlowRef.current = startSenderFlow; }, [startSenderFlow]);
  useEffect(() => { handleSignalRef.current = handleSignal; }, [handleSignal]);
  useEffect(() => { cleanupRef.current = cleanup; }, [cleanup]);

  // ─── Socket event listeners (only re-attach when socket changes) ──────────
  useEffect(() => {
    if (!socket) {
      console.log("[screenshare] no socket, skipping listeners");
      return;
    }
    console.log("[screenshare] attaching socket listeners, socket.id=", socket.id);

    const onIncomingRequest = (data) => {
      console.log("[screenshare] incoming_request received:", data, "current status:", statusRef.current);
      if (statusRef.current !== "idle") {
        console.log("[screenshare] ignoring incoming — not idle");
        return;
      }
      setStatus("incoming");
      setRole("viewer");
      setPeerUserId(String(data.fromUserId));
      setPeerUserName(data.fromUserName || "Unknown");
      try {
        showSystemNotification({
          title: "Screen share request",
          body: `${data.fromUserName || "Someone"} wants to share their screen`,
          tag: "screenshare-request",
          requireInteraction: true,
        });
      } catch {}
    };

    const onAccepted = (data) => {
      if (statusRef.current !== "requesting") return;
      startSenderFlowRef.current(String(data.fromUserId), data.fromUserName || "Unknown");
    };

    const onRejected = () => {
      if (statusRef.current === "requesting") {
        setError("Screen share request declined");
        cleanupRef.current();
      }
    };

    const onSignal = (data) => {
      handleSignalRef.current(String(data.fromUserId), data.signalData);
    };

    const onStopped = () => {
      cleanupRef.current();
    };

    const onControlRequest = (data) => {
      if (roleRef.current === "sender" && statusRef.current === "active") {
        setControlStatus("requesting");
        setPeerUserName(data.fromUserName || peerUserIdRef.current);
      }
    };

    const onControlGranted = () => {
      if (roleRef.current === "viewer") {
        setControlStatus("granted");
      }
    };

    const onControlRevoked = () => {
      setControlStatus("none");
    };

    socket.on("screenshare:incoming_request", onIncomingRequest);
    socket.on("screenshare:accepted", onAccepted);
    socket.on("screenshare:rejected", onRejected);
    socket.on("screenshare:signal", onSignal);
    socket.on("screenshare:stopped", onStopped);
    socket.on("screenshare:control-request", onControlRequest);
    socket.on("screenshare:control-granted", onControlGranted);
    socket.on("screenshare:control-revoked", onControlRevoked);

    return () => {
      socket.off("screenshare:incoming_request", onIncomingRequest);
      socket.off("screenshare:accepted", onAccepted);
      socket.off("screenshare:rejected", onRejected);
      socket.off("screenshare:signal", onSignal);
      socket.off("screenshare:stopped", onStopped);
      socket.off("screenshare:control-request", onControlRequest);
      socket.off("screenshare:control-granted", onControlGranted);
      socket.off("screenshare:control-revoked", onControlRevoked);
    };
  }, [socket]); // Only re-attach when socket itself changes

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return {
    // State
    status,
    role,
    peerUserId,
    peerUserName,
    remoteStream,
    error,
    annotationMode,
    controlStatus,
    // Actions
    requestScreenShare,
    acceptScreenShare,
    rejectScreenShare,
    stopScreenShare,
    setAnnotationMode,
    // Remote control
    requestControl,
    grantControl,
    revokeControl,
    // DataChannel
    sendDataChannelMessage,
    setDataChannelListener,
  };
};

export default useScreenShare;
