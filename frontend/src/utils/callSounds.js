/**
 * Call notification sounds using Web Audio API.
 * No external audio files needed — generates tones programmatically.
 * All functions are wrapped in try-catch to never crash calling components.
 */

let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

// ─── Incoming call ringtone (looping double-beep pattern) ─────────────────
let ringtoneInterval = null;

const playRingtoneBeep = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const playTone = (startTime, freq, duration) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    gain.gain.setValueAtTime(0.3, now);
    playTone(now, 440, 0.15);
    playTone(now + 0.2, 554, 0.15);
    gain.gain.setValueAtTime(0.3, now + 0.35);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
  } catch {}
};

export const startIncomingRingtone = () => {
  try {
    stopIncomingRingtone();
    playRingtoneBeep();
    ringtoneInterval = setInterval(playRingtoneBeep, 2000);
  } catch {}
};

export const stopIncomingRingtone = () => {
  try {
    if (ringtoneInterval) {
      clearInterval(ringtoneInterval);
      ringtoneInterval = null;
    }
  } catch {}
};

// ─── Outgoing call ring (single tone repeating) ──────────────────────────
let outgoingInterval = null;

const playOutgoingBeep = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, now);
    osc.start(now);
    gain.gain.setValueAtTime(0.2, now + 0.8);
    gain.gain.linearRampToValueAtTime(0, now + 1);
    osc.stop(now + 1);
  } catch {}
};

export const startOutgoingRing = () => {
  try {
    stopOutgoingRing();
    playOutgoingBeep();
    outgoingInterval = setInterval(playOutgoingBeep, 3000);
  } catch {}
};

export const stopOutgoingRing = () => {
  try {
    if (outgoingInterval) {
      clearInterval(outgoingInterval);
      outgoingInterval = null;
    }
  } catch {}
};

// ─── Call connected sound (pleasant chime) ────────────────────────────────
export const playConnectedSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25, now);
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.15);
    });
    gain.gain.setValueAtTime(0.25, now + 0.5);
    gain.gain.linearRampToValueAtTime(0, now + 0.7);
  } catch {}
};

// ─── Call ended sound (descending tone) ───────────────────────────────────
export const playEndedSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, now);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.linearRampToValueAtTime(300, now + 0.3);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.3);
    gain.gain.setValueAtTime(0.2, now + 0.25);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);
  } catch {}
};

// ─── Screen share notification (alert chime) ─────────────────────────────
export const playScreenShareAlert = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25, now);
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.12);
    });
    gain.gain.setValueAtTime(0.25, now + 0.4);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
  } catch {}
};

// ─── Cleanup ──────────────────────────────────────────────────────────────
export const stopAllCallSounds = () => {
  stopIncomingRingtone();
  stopOutgoingRing();
};
