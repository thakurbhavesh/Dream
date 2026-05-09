import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "../contexts/SocketContext.jsx";

/**
 * Multi-participant meeting hook using WebRTC mesh network.
 * State machine: idle → joining → active → idle
 * - Joins WITHOUT requesting camera/mic (on-demand only)
 * - Properly releases hardware on leave/disconnect
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

const useMeeting = () => {
  const socket = useSocket();

  const [status, setStatus] = useState("idle");
  const [meetingRoomId, setMeetingRoomId] = useState(null);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [pinnedSocketId, setPinnedSocketId] = useState(null);
  const [duration, setDuration] = useState(0);
  const [viewMode, setViewMode] = useState("gallery");
  // Set when the host (or anyone with permission) emits meeting:ended.
  // The room screen reads this to show "Meeting has ended" instead of
  // auto-dismissing silently. Cleared on the next joinMeeting call.
  const [endedByHost, setEndedByHost] = useState(false);
  // Host can lock the room so further joins are rejected.
  const [isLocked, setIsLocked] = useState(false);
  // Host can pin a participant for everyone (independent of personal pin).
  const [spotlightSocketId, setSpotlightSocketId] = useState(null);

  const peersRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const meetingRoomIdRef = useRef(null);
  const statusRef = useRef("idle");
  const timerRef = useRef(null);
  const myUserNameRef = useRef("");
  const negotiatingRef = useRef(new Set()); // track which peers are mid-negotiation

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { meetingRoomIdRef.current = meetingRoomId; }, [meetingRoomId]);

  // Duration timer
  useEffect(() => {
    if (status === "active") {
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  useEffect(() => {
    return () => { cleanupAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────
  const cleanupAll = useCallback(() => {
    for (const pc of peersRef.current.values()) {
      try { pc.close(); } catch (_) {}
    }
    peersRef.current.clear();
    remoteStreamsRef.current.clear();
    negotiatingRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    setScreenStream(null);
    setParticipants([]);
    setChatMessages([]);
    setIsMuted(true);
    setIsVideoOff(true);
    setIsScreenSharing(false);
    setHandRaised(false);
    setDuration(0);
    setPinnedSocketId(null);
    setIsLocked(false);
    setSpotlightSocketId(null);
  }, []);

  // ─── Create peer connection ───────────────────────────────────────
  const createPeer = useCallback((targetSocketId, targetUserId, targetUserName, initiator) => {
    if (peersRef.current.has(targetSocketId)) return peersRef.current.get(targetSocketId);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(targetSocketId, pc);

    // Add local audio tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }
    // Add video: screen share track or camera track
    const videoSource = screenStreamRef.current || localStreamRef.current;
    if (videoSource) {
      videoSource.getVideoTracks().forEach((track) => {
        pc.addTrack(track, videoSource);
      });
    }

    // Remote stream
    const remoteStream = new MediaStream();
    remoteStreamsRef.current.set(targetSocketId, remoteStream);

    pc.ontrack = (event) => {
      const track = event.track;
      if (!track) return;
      // Replace old track of same kind
      remoteStream.getTracks().forEach((t) => {
        if (t.kind === track.kind && t.id !== track.id) remoteStream.removeTrack(t);
      });
      if (!remoteStream.getTracks().find((t) => t.id === track.id)) {
        remoteStream.addTrack(track);
      }
      setParticipants((prev) => {
        const existing = prev.find((p) => p.socketId === targetSocketId);
        if (existing) {
          return prev.map((p) => p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p);
        }
        return [...prev, { socketId: targetSocketId, userId: targetUserId, userName: targetUserName, stream: remoteStream, audio: true, video: true, screenShare: false }];
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit("meeting:signal", {
          meetingRoomId: meetingRoomIdRef.current,
          targetSocketId,
          signalData: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    // Renegotiation (when tracks added/removed mid-call)
    pc.onnegotiationneeded = async () => {
      // Prevent parallel negotiations
      if (negotiatingRef.current.has(targetSocketId)) return;
      if (pc.signalingState !== "stable") return;
      negotiatingRef.current.add(targetSocketId);
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== "stable") return; // changed during createOffer
        await pc.setLocalDescription(offer);
        socket?.emit("meeting:signal", {
          meetingRoomId: meetingRoomIdRef.current,
          targetSocketId,
          signalData: { type: "offer", sdp: pc.localDescription },
        });
      } catch (err) {
        console.warn("[useMeeting] renegotiation failed:", err);
      } finally {
        negotiatingRef.current.delete(targetSocketId);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        peersRef.current.delete(targetSocketId);
        remoteStreamsRef.current.delete(targetSocketId);
        negotiatingRef.current.delete(targetSocketId);
        setParticipants((prev) => prev.filter((p) => p.socketId !== targetSocketId));
      }
    };

    // Initiator creates offer
    if (initiator) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit("meeting:signal", {
            meetingRoomId: meetingRoomIdRef.current,
            targetSocketId,
            signalData: { type: "offer", sdp: pc.localDescription },
          });
        } catch (err) {
          console.error("[useMeeting] initial offer failed:", err);
        }
      })();
    }

    return pc;
  }, [socket]);

  // ─── Join meeting (no media) ──────────────────────────────────────
  const joinMeeting = useCallback(async ({ meetingRoomId: roomId, meetingData, userName }) => {
    if (statusRef.current !== "idle") return;
    setEndedByHost(false);
    setStatus("joining");
    setMeetingRoomId(roomId);
    setMeetingInfo(meetingData || null);
    myUserNameRef.current = userName || "User";
    setIsMuted(true);
    setIsVideoOff(true);

    socket.emit("meeting:join", { meetingRoomId: roomId, userName }, (res) => {
      if (res?.error) {
        console.error("[useMeeting] join error:", res.error);
        cleanupAll();
        setStatus("idle");
        return;
      }

      setStatus("active");
      // Replay current room state from the server ack — keeps late joiners
      // in sync with the host's lock / spotlight choices.
      setIsLocked(Boolean(res.locked));
      setSpotlightSocketId(res.spotlight || null);

      const existingParticipants = res.participants || [];
      for (const p of existingParticipants) {
        if (p.socketId !== socket.id) {
          createPeer(p.socketId, p.userId, p.userName, true);
          setParticipants((prev) => {
            if (prev.find((x) => x.socketId === p.socketId)) return prev;
            return [...prev, { socketId: p.socketId, userId: p.userId, userName: p.userName, stream: null, audio: true, video: true, screenShare: false }];
          });
        }
      }
    });
  }, [socket, cleanupAll, createPeer]);

  // ─── Leave meeting ────────────────────────────────────────────────
  const leaveMeeting = useCallback(() => {
    if (statusRef.current === "idle") return;
    // Stop screen share tracks so OS-level sharing banner closes immediately
    if (screenStreamRef.current) {
      try { screenStreamRef.current.getTracks().forEach((t) => t.stop()); } catch (_) {}
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    socket?.emit("meeting:leave", { meetingRoomId: meetingRoomIdRef.current });
    cleanupAll();
    setMeetingRoomId(null);
    setMeetingInfo(null);
    setStatus("idle");
  }, [socket, cleanupAll]);

  // ─── Add track to all peers ───────────────────────────────────────
  const addTrackToPeers = useCallback((track, stream) => {
    for (const pc of peersRef.current.values()) {
      const hasSameTrack = pc.getSenders().find((s) => s.track?.id === track.id);
      if (!hasSameTrack) {
        pc.addTrack(track, stream);
      }
    }
  }, []);

  // ─── Toggle audio (on-demand mic access) ──────────────────────────
  const toggleMute = useCallback(async () => {
    if (isMuted) {
      // UNMUTE
      if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTrack = stream.getAudioTracks()[0];
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(audioTrack);
          } else {
            localStreamRef.current = stream;
          }
          setLocalStream(localStreamRef.current);
          addTrackToPeers(audioTrack, localStreamRef.current);
        } catch (err) {
          console.error("[useMeeting] mic access failed:", err);
          return;
        }
      } else {
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
      }
      setIsMuted(false);
      socket?.emit("meeting:media-state", { meetingRoomId: meetingRoomIdRef.current, audio: true });
    } else {
      // MUTE
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
      }
      setIsMuted(true);
      socket?.emit("meeting:media-state", { meetingRoomId: meetingRoomIdRef.current, audio: false });
    }
  }, [isMuted, socket, addTrackToPeers]);

  // ─── Toggle video (on-demand camera access) ──────────────────────
  const toggleVideo = useCallback(async () => {
    if (isVideoOff) {
      // TURN ON
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const videoTrack = stream.getVideoTracks()[0];
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = stream;
        }
        setLocalStream(localStreamRef.current);
        addTrackToPeers(videoTrack, localStreamRef.current);
        setIsVideoOff(false);
        socket?.emit("meeting:media-state", { meetingRoomId: meetingRoomIdRef.current, video: true });
      } catch (err) {
        console.error("[useMeeting] camera access failed:", err);
      }
    } else {
      // TURN OFF — stop & release camera hardware
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach((t) => {
          t.stop();
          localStreamRef.current.removeTrack(t);
        });
        for (const pc of peersRef.current.values()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video" || (s.track === null && !s._isAudio));
          if (sender) {
            try { pc.removeTrack(sender); } catch (_) {}
          }
        }
      }
      setIsVideoOff(true);
      setLocalStream(localStreamRef.current);
      socket?.emit("meeting:media-state", { meetingRoomId: meetingRoomIdRef.current, video: false });
    }
  }, [isVideoOff, socket, addTrackToPeers]);

  // ─── Screen share ─────────────────────────────────────────────────
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setScreenStream(null);
      setIsScreenSharing(false);

      for (const pc of peersRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
          try { await sender.replaceTrack(cameraTrack); } catch (_) {}
        }
      }
      socket?.emit("meeting:media-state", { meetingRoomId: meetingRoomIdRef.current, screenShare: false });
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: true,
        });
        screenStreamRef.current = screen;
        setScreenStream(screen);
        setIsScreenSharing(true);

        const screenVideoTrack = screen.getVideoTracks()[0];

        for (const [socketId, pc] of peersRef.current.entries()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(screenVideoTrack);
          } else {
            pc.addTrack(screenVideoTrack, screen);
            // onnegotiationneeded will fire automatically
          }
        }

        screenVideoTrack.onended = () => { toggleScreenShare(); };
        socket?.emit("meeting:media-state", { meetingRoomId: meetingRoomIdRef.current, screenShare: true });
      } catch (err) {
        console.error("[useMeeting] screen share error:", err);
      }
    }
  }, [isScreenSharing, socket]);

  // ─── Host controls ────────────────────────────────────────────────
  const muteAll = useCallback(() => {
    socket?.emit("meeting:host:mute-all", { meetingRoomId: meetingRoomIdRef.current });
  }, [socket]);

  const removeParticipant = useCallback((targetSocketId) => {
    if (!targetSocketId) return;
    socket?.emit("meeting:host:remove", {
      meetingRoomId: meetingRoomIdRef.current,
      targetSocketId,
    });
  }, [socket]);

  const setLocked = useCallback((locked) => {
    socket?.emit("meeting:host:lock", {
      meetingRoomId: meetingRoomIdRef.current,
      locked: Boolean(locked),
    });
  }, [socket]);

  const spotlight = useCallback((targetSocketId) => {
    socket?.emit("meeting:host:spotlight", {
      meetingRoomId: meetingRoomIdRef.current,
      targetSocketId: targetSocketId || null,
    });
  }, [socket]);

  // ─── Chat ─────────────────────────────────────────────────────────
  const sendChatMessage = useCallback((message) => {
    if (!message?.trim()) return;
    socket?.emit("meeting:chat", {
      meetingRoomId: meetingRoomIdRef.current,
      message: message.trim(),
      userName: myUserNameRef.current,
    });
  }, [socket]);

  // ─── Reactions ────────────────────────────────────────────────────
  const sendReaction = useCallback((reaction) => {
    socket?.emit("meeting:reaction", {
      meetingRoomId: meetingRoomIdRef.current,
      reaction,
      userName: myUserNameRef.current,
    });
  }, [socket]);

  const toggleHandRaise = useCallback(() => {
    const newRaised = !handRaised;
    setHandRaised(newRaised);
    sendReaction(newRaised ? "hand-raise" : "hand-lower");
  }, [handRaised, sendReaction]);

  const pinParticipant = useCallback((targetSocketId) => {
    setPinnedSocketId((prev) => prev === targetSocketId ? null : targetSocketId);
  }, []);

  // ─── Socket listeners ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onUserJoined = ({ socketId, userId: uid, userName }) => {
      // Accept signals in both "joining" and "active" states
      if (statusRef.current === "idle") return;
      createPeer(socketId, uid, userName, false);
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, userId: uid, userName, stream: null, audio: true, video: true, screenShare: false }];
      });
    };

    const onUserLeft = ({ socketId }) => {
      const pc = peersRef.current.get(socketId);
      if (pc) { try { pc.close(); } catch (_) {} }
      peersRef.current.delete(socketId);
      remoteStreamsRef.current.delete(socketId);
      negotiatingRef.current.delete(socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    const onSignal = async ({ fromSocketId, fromUserId, signalData }) => {
      // Accept signals in "joining" AND "active" — fixes race condition
      if (statusRef.current === "idle") return;

      let pc = peersRef.current.get(fromSocketId);

      if (signalData.type === "offer") {
        if (!pc) {
          pc = createPeer(fromSocketId, fromUserId, "", false);
        }
        // Handle glare (both sides send offer): use polite/impolite peer pattern
        if (pc.signalingState !== "stable") {
          // We received an offer while we have a pending offer — rollback ours
          await pc.setLocalDescription({ type: "rollback" });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("meeting:signal", {
          meetingRoomId: meetingRoomIdRef.current,
          targetSocketId: fromSocketId,
          signalData: { type: "answer", sdp: pc.localDescription },
        });
        negotiatingRef.current.delete(fromSocketId);
      } else if (signalData.type === "answer") {
        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          negotiatingRef.current.delete(fromSocketId);
        }
      } else if (signalData.type === "candidate") {
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          } catch (e) {
            console.warn("[useMeeting] ICE candidate error", e);
          }
        }
      }
    };

    const onChatMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    const onReaction = ({ userId: uid, socketId, reaction, userName }) => {
      const id = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      setReactions((prev) => [...prev, { id, userId: uid, socketId, reaction, userName }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3000);

      if (reaction === "hand-raise" || reaction === "hand-lower") {
        setParticipants((prev) =>
          prev.map((p) => p.socketId === socketId ? { ...p, handRaised: reaction === "hand-raise" } : p)
        );
      }
    };

    const onMediaState = ({ socketId, audio, video, screenShare }) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.socketId !== socketId) return p;
          const update = { ...p };
          if (audio !== undefined) update.audio = audio;
          if (video !== undefined) update.video = video;
          if (screenShare !== undefined) update.screenShare = screenShare;
          return update;
        })
      );
    };

    const onPin = ({ targetSocketId, pinned }) => {
      if (pinned) setPinnedSocketId(targetSocketId);
      else setPinnedSocketId((prev) => prev === targetSocketId ? null : prev);
    };

    const onForceMute = () => {
      // Host muted everyone — disable local audio tracks immediately
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
      }
      setIsMuted(true);
      socket?.emit("meeting:media-state", { meetingRoomId: meetingRoomIdRef.current, audio: false });
    };

    const onRemoved = () => {
      // Host removed this user — force-leave
      if (screenStreamRef.current) {
        try { screenStreamRef.current.getTracks().forEach((t) => t.stop()); } catch (_) {}
        screenStreamRef.current = null;
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      if (statusRef.current !== "idle") {
        cleanupAll();
        setMeetingRoomId(null);
        setMeetingInfo(null);
        setStatus("idle");
      }
    };

    const onMeetingEnded = () => {
      // Host ended the meeting — force-stop screen share + leave room on every client
      if (screenStreamRef.current) {
        try { screenStreamRef.current.getTracks().forEach((t) => t.stop()); } catch (_) {}
        screenStreamRef.current = null;
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      if (statusRef.current !== "idle") {
        setEndedByHost(true);
        cleanupAll();
        setStatus("idle");
        // Keep meetingRoomId / meetingInfo so the room screen can show
        // a friendly "Meeting has ended" notice before the user dismisses it.
      }
    };

    const onLocked = ({ locked }) => setIsLocked(Boolean(locked));
    const onSpotlight = ({ targetSocketId }) => setSpotlightSocketId(targetSocketId || null);

    socket.on("meeting:user-joined", onUserJoined);
    socket.on("meeting:user-left", onUserLeft);
    socket.on("meeting:signal", onSignal);
    socket.on("meeting:chat-message", onChatMessage);
    socket.on("meeting:reaction", onReaction);
    socket.on("meeting:media-state", onMediaState);
    socket.on("meeting:pin", onPin);
    socket.on("meeting:ended", onMeetingEnded);
    socket.on("meeting:force-mute", onForceMute);
    socket.on("meeting:removed", onRemoved);
    socket.on("meeting:locked", onLocked);
    socket.on("meeting:spotlight", onSpotlight);

    return () => {
      socket.off("meeting:user-joined", onUserJoined);
      socket.off("meeting:user-left", onUserLeft);
      socket.off("meeting:signal", onSignal);
      socket.off("meeting:chat-message", onChatMessage);
      socket.off("meeting:reaction", onReaction);
      socket.off("meeting:media-state", onMediaState);
      socket.off("meeting:pin", onPin);
      socket.off("meeting:ended", onMeetingEnded);
      socket.off("meeting:force-mute", onForceMute);
      socket.off("meeting:removed", onRemoved);
      socket.off("meeting:locked", onLocked);
      socket.off("meeting:spotlight", onSpotlight);
    };
  }, [socket, createPeer]);

  const dismissEndedNotice = useCallback(() => {
    setEndedByHost(false);
    setMeetingRoomId(null);
    setMeetingInfo(null);
  }, []);

  return {
    status, meetingRoomId, meetingInfo, participants, localStream, screenStream,
    isMuted, isVideoOff, isScreenSharing, chatMessages, handRaised, reactions,
    pinnedSocketId, duration, viewMode, endedByHost,
    isLocked, spotlightSocketId,
    joinMeeting, leaveMeeting, toggleMute, toggleVideo, toggleScreenShare,
    sendChatMessage, sendReaction, toggleHandRaise, pinParticipant, setViewMode,
    muteAll, removeParticipant, dismissEndedNotice,
    setLocked, spotlight,
  };
};

export default useMeeting;
