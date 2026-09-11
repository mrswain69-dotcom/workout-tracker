export const GROUP_VISIBILITY_RETRY_DELAYS_MS = [0, 100, 200, 400, 800, 1200];

function wait(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function includesGroup(result, groupId) {
  return (result?.data || []).some((group) => group?.id === groupId);
}

export async function loadUntilGroupVisible(
  loadGroups,
  preferredGroupId,
  delays = GROUP_VISIBILITY_RETRY_DELAYS_MS
) {
  if (typeof loadGroups !== "function") {
    throw new TypeError("loadGroups must be a function");
  }

  const groupId = String(preferredGroupId || "");
  const attempts = Array.isArray(delays) && delays.length ? delays : [0];
  let lastResult = { data: [], error: null };

  for (let index = 0; index < attempts.length; index += 1) {
    await wait(Number(attempts[index]) || 0);
    lastResult = await loadGroups();

    if (lastResult?.error || !groupId || includesGroup(lastResult, groupId)) {
      return lastResult;
    }
  }

  return lastResult;
}
