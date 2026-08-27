/**
 * Poll a predicate until it holds or the attempt budget is exhausted.
 *
 * For legs that must observe an asynchronous system under test reach a
 * specific state (a worker pool saturating, a queued file being picked up)
 * BEFORE acting on it — the "window is proven in-test, not hoped for"
 * discipline. Throwing (rather than returning false) keeps a mistimed leg a
 * loud failure instead of a vacuous pass.
 *
 * Budget note: polls 500 times at 10ms — 5s of wall clock, matching the
 * waitForJob timeout the batch tests already use. No options parameter on
 * purpose: no consumer needs a different budget yet, so the signature stays
 * minimal (add one when a second budget actually appears).
 */
const ATTEMPTS = 500;
const INTERVAL_MS = 10;

export async function waitForState(
  predicate: () => boolean,
  what: string,
): Promise<void> {
  for (let i = 0; i < ATTEMPTS && !predicate(); i++) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
  if (!predicate()) {
    throw new Error(`timed out waiting for ${what}`);
  }
}
