// Preserve the mixed Plan order while retaining each logger's snapshot data.
// Snapshot-only blocks and one-day extras follow in their existing source order.
export function orderLogBlocks(plannedBlocks, groups) {
  const available = new Map();
  for (const [kind, blocks] of Object.entries(groups)) {
    for (const block of blocks || []) {
      if (block?.id && !available.has(block.id)) available.set(block.id, { block, kind });
    }
  }
  const ordered = [];
  for (const block of plannedBlocks || []) {
    const entry = available.get(block?.id);
    if (entry) {
      ordered.push(entry);
      available.delete(block.id);
    }
  }
  return [...ordered, ...available.values()];
}
