import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_STATE = "idle";

const formatTime = (seconds = 0) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const useMediaRecorder = ({ notify } = {}) => {
  const [recordingType, setRecordingType] = useState(null);
  const [recordingState, setRecordingState] = useState(DEFAULT_STATE);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingRecording, setPendingRecording] = useState(null);

  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const shouldPersistRecordingRef = useRef(false);
  const timerRef = useRef(null);
  const durationRef = useRef(0);
  const formatRecordingTime = useCallback(
    (seconds) => formatTime(typeof seconds === "number" ? seconds : 0),
    []
  );

  const showMessage = useCallback(
    (message, severity = "info") => {
      if (typeof notify === "function") {
        notify(message, severity);
      }
    },
    [notify]
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopActiveStream = useCallback(() => {
    if (recordingStreamRef.current) {
      recordingStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
  }, []);

  const setPendingRecordingSafely = useCallback((payload, options = {}) => {
    setPendingRecording((prev) => {
      if (
        prev?.url &&
        prev !== payload &&
        !options.preservePreviousUrl
      ) {
        URL.revokeObjectURL(prev.url);
      }
      return payload || null;
    });
  }, []);

  const discardPendingRecording = useCallback(() => {
    setPendingRecordingSafely(null);
  }, [setPendingRecordingSafely]);

  const resetRecordingSession = useCallback(() => {
    clearTimer();
    stopActiveStream();
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    shouldPersistRecordingRef.current = false;
    durationRef.current = 0;
    setRecordingType(null);
    setRecordingState(DEFAULT_STATE);
    setRecordingDuration(0);
  }, [clearTimer, stopActiveStream]);

  const preparePendingRecording = useCallback(
    ({ blob, file, type }) => {
      const url = URL.createObjectURL(blob);
      setPendingRecordingSafely({
        type,
        blob,
        file,
        url,
        duration: durationRef.current,
        mimeType: blob?.type,
      });
      showMessage(
        `${type === "audio" ? "Audio" : "Video"} recording ready to send`,
        "info"
      );
    },
    [setPendingRecordingSafely, showMessage]
  );

  const handleRecorderStop = useCallback(
    (type, recorder) => {
      clearTimer();
      stopActiveStream();
      const chunks = recordingChunksRef.current;
      if (chunks.length && shouldPersistRecordingRef.current) {
        const mimeType =
          recorder?.mimeType ||
          (type === "audio" ? "audio/webm" : "video/webm");
        const blob = new Blob(chunks, { type: mimeType });
        let filePayload = null;
        try {
          filePayload = new File(
            [blob],
            `${type}-recording-${Date.now()}.${
              type === "audio" ? "webm" : "webm"
            }`,
            { type: mimeType }
          );
        } catch (error) {
          filePayload = blob;
        }
        preparePendingRecording({ blob, file: filePayload, type });
      }
      recordingChunksRef.current = [];
      shouldPersistRecordingRef.current = false;
      setRecordingType(null);
      setRecordingState(DEFAULT_STATE);
      setRecordingDuration(0);
      durationRef.current = 0;
    },
    [clearTimer, preparePendingRecording, stopActiveStream]
  );

  const startMediaRecorder = useCallback(
    (stream, type) => {
      if (
        typeof window === "undefined" ||
        typeof window.MediaRecorder === "undefined"
      ) {
        showMessage("MediaRecorder is not supported in this browser.", "error");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      shouldPersistRecordingRef.current = false;
      discardPendingRecording();

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => handleRecorderStop(type, recorder);

      recorder.start();
      setRecordingType(type);
      setRecordingState("recording");
      setRecordingDuration(0);
      durationRef.current = 0;
      clearTimer();
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
      }, 1000);
    },
    [clearTimer, discardPendingRecording, handleRecorderStop, showMessage]
  );

  const requestRecording = useCallback(
    async (type) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        showMessage("Recording is not supported on this device.", "error");
        return;
      }
      try {
        // showMessage(
        //   type === "audio"
        //     ? "Requesting microphone permission..."
        //     : "Requesting camera & microphone permission...",
        //   "info"
        // );
        const constraints =
          type === "audio"
            ? { audio: true }
            : { audio: true, video: { facingMode: "user" } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        showMessage(
          type === "audio"
            ? "Microphone ready"
            : "Camera & microphone ready",
          "success"
        );
        startMediaRecorder(stream, type);
      } catch (error) {
        console.error("Media permission error", error);
        showMessage(
          type === "audio"
            ? "Microphone permission denied"
            : "Camera permission denied",
          "error"
        );
      }
    },
    [showMessage, startMediaRecorder]
  );

  const handleAudioTrigger = useCallback(() => {
    if (recordingType && recordingType !== "audio") {
      showMessage("Finish the current video recording first.", "warning");
      return;
    }
    if (recordingType === "audio") {
      showMessage("Audio recording already active.", "info");
      return;
    }
    requestRecording("audio");
  }, [recordingType, requestRecording, showMessage]);

  const handleVideoTrigger = useCallback(() => {
    if (recordingType && recordingType !== "video") {
      showMessage("Finish the current audio recording first.", "warning");
      return;
    }
    if (recordingType === "video") {
      showMessage("Video recording already active.", "info");
      return;
    }
    requestRecording("video");
  }, [recordingType, requestRecording, showMessage]);

  const handlePauseResumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordingState === "recording" && recorder.state === "recording") {
      recorder.pause();
      setRecordingState("paused");
      clearTimer();
    } else if (
      recordingState === "paused" &&
      recorder.state === "paused"
    ) {
      recorder.resume();
      setRecordingState("recording");
      clearTimer();
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
      }, 1000);
    }
  }, [clearTimer, recordingState]);

  const handleStopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    shouldPersistRecordingRef.current = true;
    mediaRecorderRef.current.stop();
  }, []);

  const handleCancelRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    shouldPersistRecordingRef.current = false;
    mediaRecorderRef.current.stop();
    showMessage("Recording discarded", "info");
  }, [showMessage]);

  const consumePendingRecording = useCallback(() => {
    let payload = null;
    setPendingRecording((prev) => {
      payload = prev;
      if (prev?.url) {
        URL.revokeObjectURL(prev.url);
      }
      return null;
    });
    return payload;
  }, []);

  const setPendingRecordingExternal = useCallback(
    (payload, options) => {
      setPendingRecordingSafely(payload, options);
    },
    [setPendingRecordingSafely]
  );

  useEffect(() => () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    resetRecordingSession();
    discardPendingRecording();
  }, [discardPendingRecording, resetRecordingSession]);

  return {
    recordingType,
    recordingState,
    recordingDuration,
    pendingRecording,
    formatRecordingTime,
    handleAudioTrigger,
    handleVideoTrigger,
    handlePauseResumeRecording,
    handleStopRecording,
    handleCancelRecording,
    discardPendingRecording,
    consumePendingRecording,
    setPendingRecordingExternal,
  };
};

export default useMediaRecorder;
