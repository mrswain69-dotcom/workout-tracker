import React, { useEffect, useRef, useState } from 'react';
import { getUsageAccess, getUsageDashboard } from '../../adminUsage.js';
import './AdminUsagePanel.css';
const count = value => Number(value || 0).toLocaleString('en-GB');
const date = value => value ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}) : '—';
function stage(a) {
  if (!a.email_confirmed_at) return 'Awaiting confirmation';
  if (!a.profiles) return 'No athlete profile';
  if (!a.activity_logs) return a.planned ? 'Plan ready · no activity yet' : 'No activity recorded';
  return a.logged7 ? 'Recorded activity · last 7 days' : a.logged30 ? 'Recorded activity · last 30 days' : 'No activity in 30 days';
}
export default function AdminUsagePanel() {
  const [allowed,setAllowed] = useState(false), [open,setOpen] = useState(false);
  const [includeAdmin,setIncludeAdmin] = useState(false), [report,setReport] = useState(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [revision,setRevision] = useState(0);
  const request = useRef(0);
  useEffect(() => { let current=true; getUsageAccess().then(value=>{if(current)setAllowed(value);}).catch(()=>{}); return ()=>{current=false;}; },[]);
  useEffect(() => {
    if (!allowed || !open) return;
    const id=++request.current; let current=true;
    setBusy(true); setError(''); setReport(null);
    getUsageDashboard(includeAdmin).then(data=>{if(current && id===request.current)setReport(data);})
      .catch(()=>{if(current)setError('Usage figures could not be loaded. Please try again.');})
      .finally(()=>{if(current)setBusy(false);});
    return ()=>{current=false;};
  },[allowed,open,includeAdmin,revision]);
  if (!allowed) return null;
  const s=report?.summary || {};
  const metrics=[['Accounts',s.accounts],['Athlete profiles',s.profiles],['New accounts · 7 days',s.new7],['New accounts · 30 days',s.new30],['Opened app · 7 days',s.opened7],['Opened app · 30 days',s.opened30],['Recorded activity · 7 days',s.logged7],['Recorded activity · 30 days',s.logged30]];
  return <section className="panel mt16 adminUsage" aria-label="Admin usage">
    <button type="button" className="adminUsage__toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="admin-usage-content"><span>Admin · Users & activity</span><span aria-hidden="true">{open?'−':'+'}</span></button>
    {open && <div id="admin-usage-content">
      <p className="muted">Private account and engagement overview. Only authorised app administrators can access these figures.</p>
      <div className="adminUsage__toolbar"><label><input type="checkbox" checked={includeAdmin} onChange={e=>setIncludeAdmin(e.target.checked)}/> Include admin account</label><button type="button" onClick={()=>setRevision(v=>v+1)} disabled={busy}>Refresh figures</button></div>
      {busy && <p role="status">Loading usage figures…</p>}
      {error && <p role="alert">{error}</p>}
      {report && <>
        <p className="mini muted">Updated {new Date(report.generated_at).toLocaleString('en-GB')} · {includeAdmin?'Includes':'Excludes'} admin accounts</p>
        <div className="adminUsage__metrics">{metrics.map(([label,value])=><div key={label}><span>{label}</span><strong>{count(value)}</strong></div>)}</div>
        <h3>From signup to first activity</h3>
        <dl className="adminUsage__funnel">
          {[['Registered',s.accounts],['Email confirmed',s.verified],['Has a weekly plan',s.planned],['Recorded first activity',s.activated]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{count(value)}</dd></div>)}
        </dl>
        <div className="adminUsage__metrics adminUsage__metrics--small">
          {[['Awaiting email confirmation',s.awaiting_confirmation],['Never signed in / observed',s.never_signed_in],['Confirmed · no athlete profile',s.no_profile],['Never recorded activity',s.no_activity],['Confirmed · no activity',s.verified_no_activity],['Previously recorded · inactive 30 days',s.inactive30]].map(([label,value])=><div key={label}><span>{label}</span><strong>{count(value)}</strong></div>)}
        </div>
        <h3>New accounts · last 14 days</h3>
        <div className="adminUsage__chart" role="img" aria-label={report.daily_signups.map(d=>`${d.date}: ${d.count} new accounts`).join('; ')}>{report.daily_signups.map(d=><div key={d.date} title={`${date(d.date)}: ${count(d.count)} new accounts`}><b>{count(d.count)}</b><i style={{height:`${Math.max(3,70*d.count/Math.max(1,...report.daily_signups.map(x=>x.count)))}px`}}/><span>{d.date.slice(8)}/{d.date.slice(5,7)}</span></div>)}</div>
        <details className="adminUsage__accounts"><summary>Account activity · most recent 200 signups</summary><div className="adminUsage__table"><table><thead><tr>{['Account email','Joined','Last observed app use','Athletes','Plan','Recorded days','Latest activity date','Stage'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{report.accounts.map(a=><tr key={a.email}><td>{a.email}</td><td>{date(a.created_at)}</td><td>{date(a.last_seen_at)}</td><td>{count(a.profiles)}</td><td>{a.planned?'Yes':'Not yet'}</td><td>{count(a.activity_days)}</td><td>{date(a.last_activity)}</td><td>{stage(a)}</td></tr>)}</tbody></table></div></details>
        <details className="adminUsage__definitions"><summary>What these figures mean</summary>
          <p>Accounts are sign-in accounts; athlete profiles are the people managed inside them. One family account may contain several athletes. Deleted accounts are excluded.</p>
          <p>Opened app counts distinct accounts with a foreground visit or sign-in in the period. Foreground tracking started {date(report.tracking_since)}; older figures only know the last sign-in, so historical app use may be undercounted. This is not a live online-user count.</p>
          <p>Recorded activity counts accounts with actual set results, cardio/duration results, performed Session movements or completed recovery in dated logs. Empty plans, cancelled blocks, task checkboxes and future dates do not count. Activity dates are workout dates, not the day an old log was edited.</p>
          <p>Periods include today and use Europe/London calendar dates. “Never recorded” means no qualifying activity is currently saved; deleted logs cannot be reconstructed. Funnel stages describe current data, not a required order. Counts can overlap.</p>
        </details>
      </>}
    </div>}
  </section>;
}
