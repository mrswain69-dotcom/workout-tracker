import React from 'react';
import { GROUP_BLOCK_COUNT_COLUMNS } from '../engine/groupBlockCounts.js';
export function GroupBlockCountHeaders() {
  return GROUP_BLOCK_COUNT_COLUMNS.map(column => <span key={column.key} role="columnheader" title={`Completed ${column.label.toLowerCase()} in this period`}>{column.label}</span>);
}
export function GroupBlockCountCells({ row }) {
  return GROUP_BLOCK_COUNT_COLUMNS.map(column => <span key={column.key} role="cell" className="groupBlockCount">{row.completedBlocks ? row.completedBlocks[column.key] ?? 0 : '—'}</span>);
}
