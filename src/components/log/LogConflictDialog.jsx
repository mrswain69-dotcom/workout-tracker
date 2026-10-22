import React, { useEffect, useRef } from 'react';
function summary(log) {
  const rows = (log?.blocks || []).map(block => {
    const values=[];
    for (const sets of Object.values(block.sets || {})) {
      for (const set of sets || []) {
        const fields = [set.reps && `${set.reps} reps`, set.weight && `${set.weight} kg`, set.timeSec && `${set.timeSec}s`].filter(Boolean);
        if (fields.length) values.push(fields.join(' · '));
      }
    }
    if (block.cardio?.distanceKm) values.push(`${block.cardio.distanceKm} km`);
    if (block.cardio?.durationMin) values.push(`${block.cardio.durationMin} min`);
    if (block.duration?.minutes) values.push(`${block.duration.minutes} min`);
    if (block.cancelled) values.push('Cancelled');
    if (block.recoveryDone) values.push('Recovery completed');
    const done = Object.values(block.tasksDone || {}).filter(Boolean).length;
    if (done) values.push(`${done} tasks completed`);
    if (block.session) values.push(block.session.completed ? 'Session completed' : 'Session in progress');
    return { name: block.label || block.name || block.typeId || 'Activity', values: values.join('; ') || 'No result entered' };
  });
  return rows.length ? rows : [{name:'This day',values:'No activity saved'}];
}
export default function LogConflictDialog({ localLog, remoteLog, onUseLocal, onUseRemote, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const buttons = [...dialog.querySelectorAll('button:not([disabled])')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener('keydown',keydown);
    return () => { dialog?.removeEventListener('keydown',keydown); previous?.focus?.(); };
  }, []);
  return <div className="legalBackdrop" onMouseDown={onClose} role="presentation">
    <section ref={dialogRef} className="legalDialog" role="dialog" aria-modal="true" aria-label="Review workout changes" onMouseDown={e=>e.stopPropagation()}>
      <button className="legalClose" aria-label="Close changes review" type="button" onClick={onClose}>×</button>
      <h2>Review this day’s changes</h2>
      <p>This day changed in your account while you were editing. Your entries are still on this device. Choose which version to keep for this day.</p>
      <div className="logConflictVersions">
        {[['This device',localLog],['Saved in your account',remoteLog]].map(([name,log])=><section key={name}><h3>{name}</h3>
          <ul>{summary(log).map((row,i)=><li key={i}><strong>{row.name}</strong><br/>{row.values}</li>)}</ul>
        </section>)}
      </div>
      <p>Keeping your entries replaces the account version shown here. Other days are unaffected.</p>
      <div className="row"><button className="btn btn-primary" type="button" onClick={onUseLocal}>Keep my entries</button>
      <button className="btn btn-secondary" type="button" onClick={onUseRemote}>Use account version</button></div>
    </section>
  </div>;
}
