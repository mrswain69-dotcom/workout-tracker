import React from 'react';

function ShareIcon() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <path d="M10 12H6v17h20V12h-4M16 21V3m-6 6 6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function HomeIcon() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <rect x="5" y="5" width="22" height="22" rx="5" stroke="currentColor" strokeWidth="2" />
    <path d="M10 16h12m-6-6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

export default function IosInstallGuide() {
  return <div className="pwaIosGuide">
    <h4>iPhone or iPad</h4>
    <p className="pwaIosGuide__start"><strong>Start in Safari:</strong> open <strong>workouttrackerapp.io</strong>, then follow these steps using Safari’s own buttons.</p>
    <ol className="pwaIosGuide__steps" aria-label="iPhone installation steps">
      <li className="pwaIosGuide__step">
        <div className="pwaIosGuide__stepTitle"><span aria-hidden="true">1</span><h5>Tap Share</h5></div>
        <div className="pwaIosGuide__picture pwaIosGuide__toolbar" aria-hidden="true">
          <span className="pwaIosGuide__address">workouttrackerapp.io</span>
          <span className="pwaIosGuide__share"><ShareIcon /></span>
        </div>
        <p>Look for the <strong>square with an arrow pointing up</strong> in Safari’s toolbar.</p>
        <p className="mini muted">If it’s hidden, open Safari’s page menu <span className="pwaIosGuide__more" aria-label="three dots">•••</span> and choose <strong>Share</strong>. The toolbar can be at the top or bottom.</p>
      </li>
      <li className="pwaIosGuide__step">
        <div className="pwaIosGuide__stepTitle"><span aria-hidden="true">2</span><h5>Add to Home Screen</h5></div>
        <div className="pwaIosGuide__picture" aria-hidden="true">
          <span className="pwaIosGuide__scroll">Scroll down the Share menu ↓</span>
          <div className="pwaIosGuide__action"><HomeIcon /><span>Add to Home Screen</span></div>
        </div>
        <p>Scroll down the Share menu and tap <strong>Add to Home Screen</strong>.</p>
        <p className="mini muted">Missing? Scroll to the bottom, tap <strong>Edit Actions</strong> and add it to the list.</p>
      </li>
      <li className="pwaIosGuide__step">
        <div className="pwaIosGuide__stepTitle"><span aria-hidden="true">3</span><h5>Confirm Add</h5></div>
        <div className="pwaIosGuide__picture pwaIosGuide__confirm" aria-hidden="true">
          <div className="pwaIosGuide__confirmTop"><span>Add to Home Screen</span><strong>Add</strong></div>
          <div className="pwaIosGuide__app"><img src="/icons/icon-192.png" alt="" /><span>Workout Tracker</span></div>
          <div className="pwaIosGuide__toggleRow"><span>Open as Web App</span><span className="pwaIosGuide__toggle" /></div>
        </div>
        <p>If shown, leave <strong>Open as Web App</strong> switched on. Tap <strong>Add</strong> at the top right.</p>
        <p className="mini muted">All done — open Workout Tracker using its new icon on your Home Screen.</p>
      </li>
    </ol>
  </div>;
}
