import React from 'react';
import { CookiesNotice, PrivacyNotice, TermsOfUse, LEGAL_CONTACT } from './LegalContent.jsx';
import './PublicLegalPage.css';

const pages = {
  '/privacy': { title: 'Privacy', Content: PrivacyNotice },
  '/terms': { title: 'Terms', Content: TermsOfUse },
  '/cookies': { title: 'Cookies and local storage', Content: CookiesNotice },
  '/delete-account': { title: 'Delete your Workout Tracker account', Content: AccountDeletion },
  '/support': { title: 'Workout Tracker support', Content: Support },
};

export function publicLegalPage(pathname) {
  return pages[pathname.replace(/\/+$/, '')] || null;
}

function AccountDeletion() {
  const email = `mailto:${LEGAL_CONTACT}?subject=${encodeURIComponent('Workout Tracker account deletion request')}`;
  return <div className="legalCopy">
    <p>You can permanently delete your Workout Tracker account and its associated data.</p>
    <h2>Delete in the app</h2>
    <ol>
      <li>Sign in to Workout Tracker and open Settings.</li>
      <li>Find “Delete Workout Tracker account”.</li>
      <li>Review the account impact, enter your password and type DELETE, then confirm permanent deletion.</li>
    </ol>
    <h2>Request deletion without the app</h2>
    <p><a href={email}>Email an account deletion request</a> to <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a> from your account email address. You do not need to install the app to request deletion. We may need to verify account ownership before processing your request. Never send your password.</p>
    <h2>What deletion covers</h2>
    <p>Deletion removes the account and associated athlete profiles, plans, workout logs, assessments, recovery information, XP and rewards history, owned programmes, group memberships and connected-source records. Groups created by the account are also removed for their members. This cannot be undone.</p>
    <p>Uninstalling the app does not delete your account. Deletion does not delete accounts you hold with connected providers such as Strava. Those providers manage their own records.</p>
    <p>Any information that must be retained for a legal or security reason is handled as described in the <a href="/privacy">privacy notice</a>.</p>
  </div>;
}

function Support() {
  return <div className="legalCopy">
    <p>For help with Workout Tracker, email <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.</p>
    <p>For an app problem, include your device, operating system, app version, what you were doing and what you expected to happen. Do not include your password or private training records.</p>
    <p><a href="/delete-account">Request account and data deletion</a></p>
  </div>;
}

export default function PublicLegalPage({ page }) {
  const { Content, title } = page;
  return <div className="publicLegalPage">
    <header><a href="/">⚡ Workout Tracker</a></header>
    <main>
      <h1>{title}</h1>
      <Content />
    </main>
    <footer aria-label="Workout Tracker information">
      <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/delete-account">Delete account</a><a href="/support">Support</a><a href="/">Return to Workout Tracker</a>
    </footer>
  </div>;
}
