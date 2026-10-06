export const ACCOUNT_LOAD_RETRY_DELAY_MS = 250;

function wait(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAccountLoadWithRetry(
  load,
  { retries = 1, delayMs = ACCOUNT_LOAD_RETRY_DELAY_MS, timeoutMs = 0 } = {}
) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let timer;
    try {
      const pending = Promise.resolve().then(() => load(attempt));
      if (!timeoutMs) return await pending;
      return await Promise.race([
        pending,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Training data request timed out")), timeoutMs);
        }),
      ]);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    } finally {
      clearTimeout(timer);
    }
    await wait(delayMs);
  }

  throw lastError || new Error("Account data could not be loaded");
}

export function getAccountHydrationPhase({
  authed,
  accountLoadState,
  familyId,
  activeProfileId,
  planReady,
  logsReady,
  snapshotsReady,
  accountLoadError,
  planLoadError,
  logsLoadError,
} = {}) {
  if (!authed) return "signed_out";
  if (accountLoadError || planLoadError || logsLoadError || accountLoadState === "error") {
    return "error";
  }
  if (
    accountLoadState !== "ready" ||
    !familyId ||
    !activeProfileId ||
    !planReady ||
    !logsReady ||
    !snapshotsReady
  ) {
    return "loading";
  }
  return "ready";
}
