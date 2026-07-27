/**
 * Answer sounds, synthesised with the Web Audio API.
 *
 * No audio files on purpose: two short blips would still cost a network
 * request each, need decoding, and would ship in the PWA cache. Oscillators
 * are a few hundred bytes of code and start instantly, which matters — a cue
 * that arrives late feels wrong.
 *
 * The context is created lazily on the FIRST answer, i.e. inside a tap or
 * swipe. Browsers (iOS Safari especially) refuse to start audio outside a user
 * gesture, and answering is always a gesture, so this never trips the policy.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    // Safari suspends the context when the tab loses focus
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One shaped tone. Gain ramps avoid the click a raw start/stop produces. */
function tone(
  c: AudioContext,
  {
    freq,
    to,
    start,
    duration,
    type = "sine",
    volume = 0.18,
  }: {
    freq: number;
    /** glide target — omit for a steady pitch */
    to?: number;
    start: number;
    duration: number;
    type?: OscillatorType;
    volume?: number;
  },
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to != null) osc.frequency.exponentialRampToValueAtTime(to, start + duration);

  // quick attack, exponential decay — a pluck, not a beep
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/**
 * Correct: a bright rising third (E6 → B6), like a coin pickup.
 * Wrong: one short low tone sliding down — deliberately soft rather than a
 * harsh buzzer, since the main tester is a child and a game should not feel
 * punishing when you miss.
 */
export function playAnswer(correct: boolean) {
  const c = audio();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    if (correct) {
      tone(c, { freq: 1318.5, start: t0, duration: 0.09, type: "triangle" });
      tone(c, { freq: 1975.5, start: t0 + 0.075, duration: 0.16, type: "triangle" });
    } else {
      tone(c, { freq: 220, to: 130, start: t0, duration: 0.24, type: "sine", volume: 0.14 });
    }
  } catch {
    // audio is a nicety — never let it break answering
  }
}

/** Short fanfare for clearing a level (three rising notes). */
export function playLevelCleared() {
  const c = audio();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    [1046.5, 1318.5, 1568].forEach((f, i) =>
      tone(c, { freq: f, start: t0 + i * 0.11, duration: 0.22, type: "triangle" }),
    );
  } catch {
    /* optional */
  }
}
