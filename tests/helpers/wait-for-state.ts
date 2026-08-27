/**
 * Poll a predicate until it holds or the attempt budget is exhausted.
 *
 * For legs that must observe an asynchronous system under test reach a
 * specific state (a worker pool saturating, a queued file being picked up)
 * BEFORE acting on it — the "window is proven in-test, not hoped for"
 * discipline. Throwing (rather than returning false) keeps a mistimed leg a
 * loud failure instead of a vacuous pass.
 *
 * Budget note: the defaults poll 500 times at 10ms — 5s of wall clock,
 * matching the waitForJob timeout the batch tests already use.
 */
export async function waitForState(
  predicate: () => boolean,
  what: string,
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<void> {
  const { attempts = 500, intervalMs = 10 } = options;
  for (let i = 0; i < attempts && !predicate(); i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (!predicate()) {
    throw new Error(`timed out waiting for ${what}`);
  }
}
