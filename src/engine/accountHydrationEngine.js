export const ACCOUNT_LOAD_RETRY_DELAY_MS = 250;

function wait(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAccountLoadWithRetry(
  load,
  { retries = 1, delayMs = ACCOUNT_LOAD_RETRY_DELAY_MS } = {}
) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await load(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await wait(delayMs);
    }
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
    !logsReady
  ) {
    return "loading";
  }
  return "ready";
}
