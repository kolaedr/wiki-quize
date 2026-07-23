/**
 * Haptic feedback via the Vibration API.
 * Works on Android (Chrome/Firefox); iOS Safari has no Vibration API and
 * silently ignores it — so this is a progressive enhancement, never a
 * requirement. Short tick for a correct throw, a double buzz for a miss.
 */
export function hapticAnswer(correct: boolean) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(correct ? 18 : [45, 55, 45]);
  } catch {
    // some browsers throw without a user gesture — feedback is optional
  }
}
