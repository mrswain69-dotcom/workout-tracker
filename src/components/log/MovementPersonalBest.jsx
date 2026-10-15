import React from 'react';
import { XP_PROGRESSION_RULES } from '../../engine/xpRuleVersions.js';
import './MovementPersonalBest.css';
const number = value => Number(value).toLocaleString('en-GB', {maximumFractionDigits:2});
const dateLabel = value => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
function resultText(record) {
  if (record.kind === 'cardio') return `${number(record.distanceKm)} km in ${Math.floor(record.value / 60)}m ${number(record.value % 60)}s`;
  if (record.kind === 'weighted') return `${number(record.weight)} ${record.unit} × ${number(record.reps)} reps`;
  if (record.kind === 'reps') return `${number(record.value)} reps${record.weight ? ` at ${number(record.weight)} ${record.unit}` : ''}`;
  const minutes = Math.floor(record.value / 60), seconds = record.value % 60;
  return minutes ? `${minutes}m ${number(seconds)}s` : `${number(seconds)}s`;
}
export default function MovementPersonalBest({ summary, alreadyAwarded = false }) {
  const { records, priorDates, disabled } = summary;
  const { personalBestDaily:xp, personalBestPriorDates:required } = XP_PROGRESSION_RULES;
  return <section className="movementPb" aria-label="Current personal best">
    <div className="movementPb__heading"><strong>Current PB</strong><span>All-time · independent of chart range</span></div>
    {disabled ? <p>Record-only or warmup activity: PB tracking and PB rewards are off.</p> : <>
      {records.length ? <ul className="movementPb__records">{records.map(record=><li key={record.label}>
        <span>{record.label}</span><strong>{resultText(record)}</strong><time dateTime={record.date}>{dateLabel(record.date)}</time>
      </li>)}</ul> : <p>{summary.comparison === 'cardio' ? 'No comparable PB recorded yet. Record a supported Cardio sport with distance and time to start your PB history.' : 'No comparable PB recorded yet. Record a set to start your PB history.'}</p>}
      <details className="movementPb__explanation">
      <summary>How PB rewards work</summary>
      <p className="movementPb__reward">{alreadyAwarded ? `Today’s +${xp} PB XP has already been earned. Further records still update your PB.` :
        priorDates < required ? `PB baseline: ${priorDates}/${required} earlier comparable dates. Beat an established PB to earn +${xp} XP once per day.` :
          `Beat an established, like-for-like PB to earn +${xp} XP — once per day across all movements and Cardio.`}</p>
      <p className="movementPb__note">{records.some(record=>record.kind==='weighted') ? 'Weight and reps above come from the same actual set. Weighted rewards also require three prior dates supporting the comparable load/reps benchmark. ' : ''}
        {'Dates show when each record was first achieved; matching it keeps the original date. '}
        {summary.comparison !== 'cardio' ? 'Most reps includes sets with and without added weight, with the recorded load shown where available. ' : ''}
        {summary.comparison === 'cardio' ? 'Cardio PBs compare the same sport and exact recorded distance, across matching protocols.' : 'Records use matching movement, protocol and units. Older results matched only by name can appear in the chart without qualifying for PB rewards.'}</p>
      </details>
    </>}
  </section>;
}
