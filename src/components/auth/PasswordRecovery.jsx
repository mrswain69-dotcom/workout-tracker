import React, { useState } from 'react';
import { updatePassword } from '../../db.js';

export default function PasswordRecovery({ onComplete, onCancel }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8) { setMessage('Use at least 8 characters for your new password.'); return; }
    if (password !== confirm) { setMessage('The passwords do not match.'); return; }
    setBusy(true); setMessage('');
    try {
      const { error } = await updatePassword(password);
      if (error) { setMessage(error.message || 'Your password could not be updated. Request a new reset link and try again.'); return; }
      onComplete();
    } catch { setMessage('Your password could not be updated. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  return <main className="page"><div className="wrap"><section className="panel pad" style={{maxWidth:480,margin:'2rem auto'}}>
    <h1>Set a new password</h1><p>Choose a password for your Workout Tracker account.</p>
    <form onSubmit={submit} className="stack">
      <label>New password<input className="input" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}/></label>
      <label>Confirm new password<input className="input" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={8}/></label>
      <button className="btn btn-primary" disabled={busy}>{busy?'Updating…':'Save new password'}</button>
      <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel and sign out</button>
      {message && <p role="alert">{message}</p>}
    </form>
  </section></div></main>;
}
