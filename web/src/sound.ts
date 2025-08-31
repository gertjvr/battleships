let ctx: AudioContext | null = null;
let unlocked = false;

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return ctx;
}

function tone(freq: number, durationMs = 150, type: OscillatorType = 'sine', gain = 0.05) {
  const c = ensureCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(c.destination);
  const now = c.currentTime;
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export function playHit() {
  // small upwards blip
  tone(440, 120, 'square', 0.06);
  setTimeout(() => tone(660, 120, 'square', 0.05), 100);
}

export function playMiss() {
  // soft short noise-ish down blip
  tone(240, 120, 'sine', 0.04);
}

export function playSunk() {
  // three-note celebration
  tone(523, 150, 'triangle', 0.06);
  setTimeout(() => tone(659, 150, 'triangle', 0.06), 170);
  setTimeout(() => tone(784, 200, 'triangle', 0.06), 340);
}

export async function enableAudio(): Promise<boolean> {
  const c = ensureCtx();
  try {
    if (c.state === 'suspended') {
      await c.resume();
    }
    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function isAudioEnabled(): boolean {
  return unlocked || (ctx?.state === 'running');
}
