import { useEffect, useRef, useState } from "react";
import { createProgramDraft, programDraftKey, readProgramDraft, undatedProgramContent } from "./programDrafts.js";

function readLocalDraft(key) {
  try { return readProgramDraft(window.localStorage, key); } catch { return null; }
}

export default function useProgramDraft(familyId, profileId) {
  const key = programDraftKey(familyId, profileId);
  const [state, setState] = useState(() => ({ key, draft: readLocalDraft(key), editing: false }));
  const [storageError, setStorageError] = useState("");
  const currentKey = useRef(key);
  currentKey.current = key;
  const latest = useRef(state);
  const saving = useRef(new Set());
  const [savingKeys, setSavingKeys] = useState([]);
  useEffect(() => {
    if (latest.current.key === key) return;
    const next = { key, draft: readLocalDraft(key), editing: false };
    latest.current = next;
    setState(next);
    setStorageError("");
  }, [key]);

  function commit(next, expectedKey = key) {
    if (!expectedKey || currentKey.current !== expectedKey) return false;
    try {
      if (next.draft) window.localStorage.setItem(expectedKey, JSON.stringify(next.draft));
      else window.localStorage.removeItem(expectedKey);
      setStorageError("");
    } catch {
      setStorageError("This browser could not retain your draft. Save it to My Programs before leaving.");
    }
    latest.current = next;
    setState(next);
    return true;
  }

  const visible = state.key === key ? state : { key, draft: null, editing: false };
  return {
    draft: visible.draft,
    editing: visible.editing && !!visible.draft,
    storageError,
    busy: savingKeys.includes(key),
    start(content, program = null) {
      if (saving.current.has(key)) return false;
      return commit({ key, draft: createProgramDraft(content, program), editing: true });
    },
    update(content) {
      if (latest.current.key !== key || !latest.current.draft || saving.current.has(key)) return;
      commit({ ...latest.current, draft: { ...latest.current.draft, content: undatedProgramContent(content), dirty: true } });
    },
    resume() { if (latest.current.key === key && latest.current.draft) commit({ ...latest.current, editing: true }); },
    close() { if (latest.current.key === key) commit({ ...latest.current, editing: false }); },
    discard() { if (!saving.current.has(key)) commit({ key, draft: null, editing: false }); },
    async save(saveFn) {
      if (saving.current.has(key) || latest.current.key !== key || !latest.current.draft) return null;
      const snapshot = latest.current.draft;
      saving.current.add(key);
      setSavingKeys([...saving.current]);
      try {
        const program = await saveFn(snapshot);
        if (!program) return null;
        // A save finishing after a profile switch must never update that profile's draft.
        const saved = { ...snapshot, sourceProgram: program, dirty: false };
        if (currentKey.current === key) commit({ key, draft: saved, editing: latest.current.editing });
        else { try { window.localStorage.setItem(key, JSON.stringify(saved)); } catch { /* The programme is already saved in My Programs. */ } }
        return program;
      } finally { saving.current.delete(key); setSavingKeys([...saving.current]); }
    },
  };
}
