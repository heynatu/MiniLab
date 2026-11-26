// Tiny synthesized sound effects (no audio files, no network).
let ctx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem('minilab.mute') === '1'; } catch { /* default on */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem('minilab.mute', muted ? '1' : '0'); } catch { /* ignore */ }
}

function tone({ type = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.4, delay = 0, curve = 'exp' }) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  else o.frequency.linearRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.3, vol = 0.3, f0 = 800, f1 = 3000, q = 1, delay = 0, type = 'bandpass' }) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const SOUNDS = {
  pop() { tone({ f0: 380, f1: 900, dur: 0.12, vol: 0.5 }); },
  boing() { tone({ type: 'triangle', f0: 180, f1: 520, dur: 0.35, vol: 0.45 }); tone({ type: 'sine', f0: 520, f1: 260, dur: 0.3, vol: 0.25, delay: 0.18 }); },
  whoosh() { noise({ dur: 0.45, vol: 0.35, f0: 400, f1: 2400, q: 0.8 }); },
  magic() { [0, 4, 7, 12, 16].forEach((s, i) => tone({ type: 'sine', f0: 660 * 2 ** (s / 12), dur: 0.35, vol: 0.22, delay: i * 0.07 })); },
  splash() { noise({ dur: 0.6, vol: 0.4, f0: 3000, f1: 600, q: 0.6 }); tone({ f0: 900, f1: 1500, dur: 0.12, vol: 0.2, delay: 0.05 }); },
  roar() { tone({ type: 'sawtooth', f0: 140, f1: 90, dur: 0.7, vol: 0.3 }); tone({ type: 'square', f0: 220, f1: 130, dur: 0.6, vol: 0.12 }); noise({ dur: 0.6, vol: 0.18, f0: 500, f1: 200, q: 0.7, type: 'lowpass' }); },
  bloop() { tone({ f0: 300, f1: 120, dur: 0.25, vol: 0.45 }); tone({ f0: 200, f1: 90, dur: 0.25, vol: 0.3, delay: 0.15 }); },
  launch() { noise({ dur: 1.6, vol: 0.35, f0: 200, f1: 1800, q: 0.5, type: 'lowpass' }); tone({ type: 'sawtooth', f0: 80, f1: 400, dur: 1.4, vol: 0.12 }); },
  meow() { tone({ type: 'triangle', f0: 600, f1: 900, dur: 0.18, vol: 0.35, curve: 'lin' }); tone({ type: 'triangle', f0: 900, f1: 500, dur: 0.35, vol: 0.35, delay: 0.16, curve: 'lin' }); },
  chirp() { [0, 0.12, 0.24].forEach((d) => tone({ f0: 2200, f1: 3200, dur: 0.08, vol: 0.25, delay: d })); },
  shutter() { noise({ dur: 0.08, vol: 0.4, f0: 3000, f1: 5000, q: 0.5, type: 'highpass' }); tone({ f0: 1200, f1: 800, dur: 0.06, vol: 0.2, delay: 0.06 }); },
};

export function play(name) {
  if (muted) return;
  try { SOUNDS[name]?.(); } catch { /* audio is optional */ }
}

export function unlockAudio() {
  if (!muted) ac();
}
