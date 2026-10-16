import React, { useEffect, useSyncExternalStore } from 'react';
import { pwaInstall } from '../../pwaInstall';
import IosInstallGuide from './IosInstallGuide';
import './PwaInstall.css';

function useInstall(controller) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  useEffect(() => { controller.start(); }, [controller]);
  return state;
}

function PhoneInstructions({ platform }) {
  return <div className="pwaInstall__instructions">
    {platform !== 'android' && <IosInstallGuide />}
    {platform !== 'ios' && <div>
      <h4>Android</h4>
      <p className="mini muted">If you’re using Incognito, reopen the site in a normal Chrome tab before installing.</p>
      <ol>
        <li>Open <strong>workouttrackerapp.io</strong> in Chrome.</li>
        <li>Tap the browser menu <strong>⋮</strong>, then <strong>Install app</strong> or <strong>Add to home screen</strong>.</li>
        <li>Follow the confirmation steps, then open Workout Tracker from its home screen icon.</li>
      </ol>
    </div>}
    <p className="mini muted">If you opened a link inside WhatsApp, Facebook or another app, open it in your phone’s main browser first. Already installed? Open Workout Tracker from your home screen.</p>
  </div>;
}

export function PwaInstallSettings({ controller = pwaInstall }) {
  const state = useInstall(controller);
  const phone = state.isPhone || state.platform === 'ios' || state.platform === 'android';
  return <section className="pwaInstall panel" aria-labelledby="pwa-install-title">
    <div className="pwaInstall__heading">
      <div>
        <div className="pwaInstall__eyebrow">ON YOUR DEVICE</div>
        <h3 id="pwa-install-title">Install Workout Tracker</h3>
        <p className="muted">Add Workout Tracker to your home screen and open it like an app.</p>
      </div>
      {state.canInstall && <button type="button" className="btn btn-primary" onClick={() => controller.install()}>
        {state.isPhone ? 'Install on your phone' : 'Install on this device'}
      </button>}
    </div>
    {state.installed ? <p className="pwaInstall__status" role="status">
      {state.standalone ? 'You’re already using the installed app on this device.' : 'Workout Tracker is installed on this device. Open it from your home screen or app launcher.'}
    </p> : <>
      {state.prompting && <p role="status">Opening your browser’s installer…</p>}
      {state.outcome === 'accepted' && <p role="status">Installation requested. Follow your browser’s steps, then open Workout Tracker from its new icon.</p>}
      {state.outcome === 'dismissed' && <p role="status">No problem — you can keep using the website. Installation help is always here.</p>}
      {state.outcome === 'error' && <p role="status">The installer couldn’t open. You can use your browser’s menu instead; the steps are below.</p>}
      {!phone && <p className="muted">Want it on your phone? Open <strong>workouttrackerapp.io</strong> in your phone’s browser, then follow the steps below.</p>}
      <details className="pwaInstall__help" open={phone && !state.canInstall}>
        <summary>{phone ? 'How to add it to your home screen' : 'How to install on your phone'}</summary>
        <PhoneInstructions platform={phone ? state.platform : 'other'} />
      </details>
      {!phone && !state.canInstall && <p className="mini muted">To install on this computer, look for an install icon or “Install app” in your browser’s menu, if available.</p>}
    </>}
  </section>;
}

export function PwaInstallReminder({ visible = true, controller = pwaInstall }) {
  const state = useInstall(controller);
  if (!visible || !state.showReminder) return null;
  return <aside className="pwaInstallReminder" aria-label="Install Workout Tracker on your phone">
    <div><strong>Keep Workout Tracker on your home screen</strong>
      <p>Open it like an app, ready for your next session.</p>
    </div>
    <div className="pwaInstallReminder__actions">
      <button type="button" className="btn btn-primary" onClick={() => controller.install()}>Install app</button>
      <button type="button" className="btn btn-secondary" onClick={() => controller.dismiss()}>Dismiss</button>
    </div>
  </aside>;
}
