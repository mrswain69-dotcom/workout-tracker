import fs from "node:fs";

const path = "src/App.jsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  source = source.replace(oldText, newText);
}

replaceOnce(
  'import ProgressDashboard from "./components/progress/ProgressDashboard.jsx";\n',
  'import ProgressDashboard from "./components/progress/ProgressDashboard.jsx";\nconst GroupHub = React.lazy(() => import("./groups/GroupHub.jsx"));\n',
  "GroupHub lazy import"
);

replaceOnce(
  '  const [authed, setAuthed] = useState(false);\n\n  const [family, setFamily] = useState(null);',
  '  const [authed, setAuthed] = useState(false);\n  const [showGroups, setShowGroups] = useState(false);\n\n  const [family, setFamily] = useState(null);',
  "Group modal state"
);

replaceOnce(
  '    <span>{activeProfile?.name || "Profile"}</span>\n  </span>\n</h1>',
  `    <span>{activeProfile?.name || "Profile"}</span>\n    <button\n      type="button"\n      className="groupHeaderButton"\n      onClick={() => setShowGroups(true)}\n      disabled={!activeProfileId}\n      aria-label="Open Groups"\n      title="Groups & Teams"\n    >\n      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">\n        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />\n        <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" opacity="0.75" />\n        <path d="M3.5 18c.6-3.3 2.6-5 5.5-5s4.9 1.7 5.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />\n        <path d="M14 14c2.8-.5 5.2.8 6.1 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />\n      </svg>\n    </button>\n  </span>\n</h1>`,
  "Group header entry"
);

replaceOnce(
  '</header>\n\n\n\n        <Card className="pad motivator">',
  `</header>\n\n{showGroups && (\n  <React.Suspense fallback={<div className="groupHubBackdrop"><div className="groupHubShell"><div className="groupHubEmpty">Loading Groups…</div></div></div>}>\n    <GroupHub\n      profiles={profiles}\n      activeProfileId={activeProfileId}\n      onClose={() => setShowGroups(false)}\n    />\n  </React.Suspense>\n)}\n\n        <Card className="pad motivator">`,
  "GroupHub mount"
);

fs.writeFileSync(path, source);
console.log("Group Stage 2 App integration applied.");
