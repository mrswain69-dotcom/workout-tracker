import React, { useEffect, useState } from "react";
import {
  getAccountDeletionSummary,
  permanentlyDeleteAccount,
} from "../../accountLifecycleDb.js";
import { CookiesNotice, PrivacyNotice, TermsOfUse } from "../legal/LegalContent.jsx";

function LegalModal({ type, onClose }) {
  if (!type) return null;
  return (
    <div className="accountLegalBackdrop" role="presentation" onMouseDown={onClose}>
      <div className="accountLegalDialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="accountLegalClose" onClick={onClose} aria-label="Close">×</button>
        {type === "privacy" ? <PrivacyNotice /> : type === "cookies" ? <CookiesNotice /> : <TermsOfUse />}
      </div>
    </div>
  );
}

export default function AccountPrivacyPanel({ ensureUnlocked, onDeleted }) {
  const [legal, setLegal] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!deleteOpen) return;
    let cancelled = false;
    setSummaryBusy(true);
    getAccountDeletionSummary()
      .then(({ data }) => {
        if (!cancelled) setSummary(data || null);
      })
      .finally(() => {
        if (!cancelled) setSummaryBusy(false);
      });
    return () => { cancelled = true; };
  }, [deleteOpen]);

  async function deleteAccount() {
    if (deleteBusy) return;
    setDeleteError("");

    if (confirmation.trim() !== "DELETE") {
      setDeleteError("Type DELETE exactly to confirm.");
      return;
    }
    if (!password) {
      setDeleteError("Enter your account password.");
      return;
    }
    if (ensureUnlocked && !(await ensureUnlocked("permanently delete this Workout Tracker account"))) return;

    const finalConfirm = window.confirm(
      "Permanently delete this Workout Tracker account and its associated data? This cannot be undone."
    );
    if (!finalConfirm) return;

    setDeleteBusy(true);
    try {
      const { data, error } = await permanentlyDeleteAccount({ password, confirmation });
      if (error || !data?.deleted) {
        setDeleteError(error?.message || data?.error || "Account deletion could not be completed.");
        return;
      }
      setPassword("");
      setConfirmation("");
      onDeleted?.();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="panel mt16 accountPrivacyPanel">
        <div className="h3">Privacy, cookies & terms</div>
        <div className="muted mt8">
          Read how Workout Tracker uses account and training information, what local storage is used for, and the terms that apply.
        </div>
        <div className="accountLegalLinks mt12">
          <button type="button" className="accountLegalLink" onClick={() => setLegal("privacy")}>Privacy notice</button>
          <button type="button" className="accountLegalLink" onClick={() => setLegal("cookies")}>Cookies & local storage</button>
          <button type="button" className="accountLegalLink" onClick={() => setLegal("terms")}>Terms of use</button>
        </div>
        <div className="mini muted mt12">
          Workout Tracker currently uses essential/functional storage only and does not intentionally load advertising or non-essential analytics cookies.
        </div>
      </div>

      <div className="panel mt16 accountDeletePanel">
        <div className="h3">Delete Workout Tracker account</div>
        <div className="muted mt8">
          Permanently delete the signed-in account and the Workout Tracker data associated with it.
        </div>

        {!deleteOpen ? (
          <div className="mt12">
            <button type="button" className="btn accountDeleteStart" onClick={() => setDeleteOpen(true)}>
              Delete account…
            </button>
          </div>
        ) : (
          <div className="accountDeleteFlow mt12">
            <div className="accountDeleteWarning">
              <b>This cannot be undone.</b>
              <span>
                Profiles, plans, workout logs, Assessments, XP/rewards history, recovery information, Group memberships,
                connected-source records and other account-owned Workout Tracker data will be removed.
              </span>
              {summaryBusy ? <span>Checking account impact…</span> : null}
              {summary ? (
                <span>
                  This account currently has <b>{summary.profileCount || 0}</b> athlete profile{summary.profileCount === 1 ? "" : "s"},
                  {" "}<b>{summary.connectedSourceCount || 0}</b> active connected source{summary.connectedSourceCount === 1 ? "" : "s"}
                  {summary.createdGroupCount > 0 ? (
                    <> and created <b>{summary.createdGroupCount}</b> Group{summary.createdGroupCount === 1 ? "" : "s"}. Groups created by this account will also be removed for their members.</>
                  ) : "."}
                </span>
              ) : null}
            </div>

            <label className="accountDeleteField">
              <span>Account password</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="accountDeleteField">
              <span>Type DELETE to confirm</span>
              <input
                className="input"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {deleteError ? <div className="accountDeleteError">{deleteError}</div> : null}
            <div className="row mt12">
              <button
                type="button"
                className="btn accountDeleteConfirm"
                disabled={deleteBusy || confirmation.trim() !== "DELETE" || !password}
                onClick={deleteAccount}
              >
                {deleteBusy ? "Deleting…" : "Permanently delete account"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteOpen(false);
                  setPassword("");
                  setConfirmation("");
                  setDeleteError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <LegalModal type={legal} onClose={() => setLegal("")} />
    </>
  );
}
