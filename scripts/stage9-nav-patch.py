from pathlib import Path

app_path = Path("src/App.jsx")
app = app_path.read_text()

settings_old = '<button type="button" className="iconBtn" onClick={() => setTab("settings")} aria-label="Settings">'
settings_new = '<button type="button" className="iconBtn" onClick={() => setTab("settings")} aria-label="Manage Workout Tracker" title="Manage">'
assert app.count(settings_old) == 1, "Settings button contract changed"
app = app.replace(settings_old, settings_new, 1)

nav_old = '''      <div className="tabsRow">
        <div className="tabs">
          {["log", "stats", "plan", "assessments", "rewards"].map((t) => (
            <SecondaryButton key={t} onClick={() => setTab(t)}>
              {t === "assessments"
                ? "Assess"
                : t === "stats"
                ? "Progress"
                : t[0].toUpperCase() + t.slice(1)}
            </SecondaryButton>
          ))}
        </div>
      </div>'''
nav_new = '''      <div className="tabsRow">
        <div className="tabs primaryNavTabs" aria-label="Primary navigation">
          {["log", "stats", "rewards"].map((t) => (
            <SecondaryButton key={t} onClick={() => setTab(t)}>
              {t === "stats" ? "Progress" : t[0].toUpperCase() + t.slice(1)}
            </SecondaryButton>
          ))}
          <div className="setupTabsDesktop" role="group" aria-label="Management shortcuts">
            {["plan", "assessments"].map((t) => (
              <SecondaryButton key={t} onClick={() => setTab(t)}>
                {t === "assessments" ? "Assess" : "Plan"}
              </SecondaryButton>
            ))}
          </div>
        </div>
      </div>'''
assert app.count(nav_old) == 1, "Primary navigation contract changed"
app = app.replace(nav_old, nav_new, 1)

modal_old = '''{showGroups && (
  <React.Suspense fallback={<div className="groupHubBackdrop"><div className="groupHubShell"><div className="groupHubEmpty">Loading Groups…</div></div></div>}>
    <GroupHub
      profiles={profiles}
      activeProfileId={activeProfileId}
      onClose={() => setShowGroups(false)}
    />
  </React.Suspense>
)}

        <Card className="pad motivator">'''
modal_new = '''{showGroups && (
  <React.Suspense fallback={<div className="groupHubBackdrop"><div className="groupHubShell"><div className="groupHubEmpty">Loading Groups…</div></div></div>}>
    <GroupHub
      profiles={profiles}
      activeProfileId={activeProfileId}
      onClose={() => setShowGroups(false)}
    />
  </React.Suspense>
)}

{["settings", "plan", "assessments"].includes(tab) && (
  <div className="manageTabsRow">
    <nav className="manageTabs" aria-label="Manage Workout Tracker">
      {[
        ["settings", "General"],
        ["plan", "Plan"],
        ["assessments", "Assessments"],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`manageTab ${tab === key ? "active" : ""}`}
          aria-current={tab === key ? "page" : undefined}
          onClick={() => setTab(key)}
        >
          {label}
        </button>
      ))}
    </nav>
  </div>
)}

        <Card className="pad motivator">'''
assert app.count(modal_old) == 1, "Group shell insertion point changed"
app = app.replace(modal_old, modal_new, 1)
app_path.write_text(app)

styles_path = Path("src/styles.css")
styles = styles_path.read_text()
marker = "/* === Stage 9 navigation integration === */"
assert marker not in styles, "Stage 9 styles already present"
styles += '''

/* === Stage 9 navigation integration === */
.setupTabsDesktop{display:contents}
.manageTabsRow{display:flex;justify-content:center;margin:10px 0 14px;width:100%}
.manageTabs{display:flex;gap:8px;width:min(560px,100%);padding:6px;border:1px solid rgba(15,23,42,.10);border-radius:16px;background:rgba(255,255,255,.78);box-shadow:0 8px 24px rgba(15,23,42,.05)}
.manageTab{flex:1 1 0;min-height:44px;border:1px solid transparent;border-radius:11px;background:transparent;color:#475569;font-weight:800;cursor:pointer;padding:8px 10px}
.manageTab:hover{border-color:rgba(255,122,24,.24);background:rgba(255,122,24,.06);color:#0f172a}
.manageTab.active{border-color:rgba(255,122,24,.38);background:rgba(255,122,24,.11);color:#0f172a}
@media(max-width:760px){
  .setupTabsDesktop{display:none}
  .primaryNavTabs .btn{min-height:44px}
  .manageTabsRow{margin:8px 0 12px}
  .manageTabs{width:100%;gap:5px;padding:5px;border-radius:14px}
  .manageTab{min-height:44px;padding:7px 6px;font-size:13px}
}
'''
styles_path.write_text(styles)

Path(".github/workflows/stage9-navigation-patch.yml").unlink(missing_ok=True)
Path("scripts/stage9-nav-patch.py").unlink(missing_ok=True)
