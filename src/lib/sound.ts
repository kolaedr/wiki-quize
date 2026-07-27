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
 *
 * Wrong: two descending square-wave notes (A4 → E4) plus a sine an octave
 * below for body. The first attempt was a soft low sine and it was inaudible
 * on a phone: small speakers roll off hard under ~300 Hz, and a pure sine has
 * no harmonics to survive that. A square wave keeps energy in the midrange
 * where phone speakers actually work, and two steps read as "wrong" instead of
 * a click. Still not a harsh buzzer — the tester is a child.
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
      // step down, each note held long enough to register
      tone(c, { freq: 440, start: t0, duration: 0.17, type: "square", volume: 0.13 });
      tone(c, { freq: 329.6, start: t0 + 0.15, duration: 0.34, type: "square", volume: 0.13 });
      // sub-octave sine fills it out on speakers that can reproduce it
      tone(c, { freq: 164.8, to: 110, start: t0 + 0.15, duration: 0.36, type: "sine", volume: 0.1 });
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
