/**
 * Call notification sounds using Web Audio API.
 * Per-oscillator ADSR envelopes prevent clicks/pops.
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

/**
 * Play a single smooth tone with attack/release envelope.
 * @param {number} startOffset - seconds from "now"
 * @param {number} freq        - Hz
 * @param {number} duration    - total tone length in seconds
 * @param {number} peakGain    - peak volume (0..1)
 * @param {string} type        - oscillator type (sine/triangle)
 */
const playTone = (startOffset, freq, duration, peakGain = 0.18, type = "sine") => {
  const ctx = getAudioContext();
  const start = ctx.currentTime + Math.max(0, startOffset);
  const end = start + duration;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  // ADSR — quick attack, brief sustain, smooth release (prevents clicks)
  const attack = Math.min(0.02, duration * 0.15);
  const release = Math.min(0.08, duration * 0.35);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + attack);
  gain.gain.setValueAtTime(peakGain, end - release);
  gain.gain.linearRampToValueAtTime(0, end);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
};

// ─── Incoming ringtone — classic double-ring pattern ──────────────────────
let ringtoneInterval = null;

const playIncomingPattern = () => {
  try {
    // Two short "ring" pulses — warm dual-tone per ring
    // First ring
    playTone(0, 440, 0.35, 0.22);
    playTone(0, 554, 0.35, 0.14, "triangle");
    // Short gap, second ring
    playTone(0.55, 440, 0.35, 0.22);
    playTone(0.55, 554, 0.35, 0.14, "triangle");
  } catch {}
};

export const startIncomingRingtone = () => {
  try {
    stopIncomingRingtone();
    playIncomingPattern();
    // Pattern is ~1s, repeat every 2.2s for natural "ring ... ring" cadence
    ringtoneInterval = setInterval(playIncomingPattern, 2200);
  } catch {}
};

export const stopIncomingRingtone = () => {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
};

// ─── Outgoing ring — telephone-style "ring ring" pulse ────────────────────
let outgoingInterval = null;

const playOutgoingPattern = () => {
  try {
    playTone(0, 420, 0.45, 0.18);
    playTone(0.6, 420, 0.45, 0.18);
  } catch {}
};

export const startOutgoingRing = () => {
  try {
    stopOutgoingRing();
    playOutgoingPattern();
    outgoingInterval = setInterval(playOutgoingPattern, 3000);
  } catch {}
};

export const stopOutgoingRing = () => {
  if (outgoingInterval) {
    clearInterval(outgoingInterval);
    outgoingInterval = null;
  }
};

// ─── Connected chime — soft ascending C-E-G ───────────────────────────────
export const playConnectedSound = () => {
  try {
    playTone(0, 523.25, 0.18, 0.16); // C5
    playTone(0.12, 659.25, 0.18, 0.16); // E5
    playTone(0.24, 783.99, 0.28, 0.18); // G5
  } catch {}
};

// ─── Ended tone — soft descending ─────────────────────────────────────────
export const playEndedSound = () => {
  try {
    const ctx = getAudioContext();
    const start = ctx.currentTime;
    const duration = 0.4;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, start);
    osc.frequency.exponentialRampToValueAtTime(280, start + duration);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.03);
    gain.gain.setValueAtTime(0.2, start + duration - 0.12);
    gain.gain.linearRampToValueAtTime(0, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch {}
};

// ─── Screen share alert — two-note chime ──────────────────────────────────
export const playScreenShareAlert = () => {
  try {
    playTone(0, 660, 0.15, 0.18);
    playTone(0.17, 880, 0.2, 0.18);
  } catch {}
};

// ─── Cleanup ──────────────────────────────────────────────────────────────
export const stopAllCallSounds = () => {
  stopIncomingRingtone();
  stopOutgoingRing();
};
