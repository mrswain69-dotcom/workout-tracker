import React, { useState } from "react";
import "./PublicSite.css";
import { CookiesNotice, PrivacyNotice, TermsOfUse } from "../legal/LegalContent.jsx";

function ProductScreen({ variant = "log" }) {
  if (variant === "dashboard") {
    return (
      <div className="marketingScreen marketingScreen--dashboard" aria-label="Workout Tracker dashboard preview">
        <div className="screenTop">
          <div className="screenBrand"><span>⚡</span><b>Workout Tracker</b></div>
          <span className="screenAvatar">A</span>
        </div>
        <div className="screenAthlete">Athlete</div>
        <div className="screenNav"><b>Dashboard</b><span>Log</span><span>Progress</span><span>Rewards</span></div>
        <div className="screenCard screenCard--hero">
          <div><small>THIS WEEK</small><strong>340 XP</strong></div>
          <div className="screenProgress"><i style={{ width: "66%" }} /></div>
          <span>Level progress · consistent effort</span>
        </div>
        <div className="screenCard">
          <div className="screenCardTitle"><b>Today’s plan</b><em>3 blocks</em></div>
          <div className="screenTask isDone"><span>✓</span><div><b>Speed mechanics</b><small>Completed</small></div></div>
          <div className="screenTask"><span>2</span><div><b>Strength</b><small>Target ready</small></div></div>
          <div className="screenTask"><span>3</span><div><b>Mobility</b><small>10 min planned</small></div></div>
        </div>
        <div className="screenReadiness">
          <div><b>Body Readiness</b><em>Moderate</em></div>
          <strong>68</strong>
          <div className="readinessBar"><i style={{ left: "58%" }} /></div>
          <span>Train well, but prioritise quality.</span>
        </div>
      </div>
    );
  }

  if (variant === "progress") {
    return (
      <div className="marketingScreen marketingScreen--progress" aria-label="Workout Tracker progress preview">
        <div className="screenTop">
          <div className="screenBrand"><span>⚡</span><b>Workout Tracker</b></div>
          <span className="screenAvatar">A</span>
        </div>
        <div className="screenAthlete">Progress</div>
        <div className="screenNav"><span>Dashboard</span><span>Log</span><b>Progress</b><span>Rewards</span></div>
        <div className="progressHero">
          <small>PERFORMANCE AUTOBIOGRAPHY</small>
          <strong>Your work is becoming a record of growth.</strong>
          <span>Training · Assessments · Development</span>
        </div>
        <div className="screenMetricGrid">
          <div><small>Consistency</small><b>92%</b><span>↑ 5%</span></div>
          <div><small>Training time</small><b>6h 24m</b><span>4 weeks</span></div>
        </div>
        <div className="screenChart">
          <div className="chartHead"><b>Training trend</b><em>12 weeks</em></div>
          <svg viewBox="0 0 280 120" aria-hidden="true">
            <polyline points="0,96 25,88 50,91 75,71 100,76 125,54 150,63 175,42 200,48 225,29 250,35 280,18" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="marketingScreen marketingScreen--log" aria-label="Workout Tracker workout log preview">
      <div className="screenTop">
        <div className="screenBrand"><span>⚡</span><b>Workout Tracker</b></div>
        <span className="screenAvatar">A</span>
      </div>
      <div className="screenAthlete">Athlete</div>
      <div className="screenNav"><span>Dashboard</span><b>Log</b><span>Progress</span><span>Rewards</span></div>
      <div className="logDate"><span>01/10/2026</span><i /></div>
      <div className="screenCard">
        <small className="blockKicker">STRENGTH</small>
        <div className="screenCardTitle"><b>Lower body power</b><em>●</em></div>
        <div className="movement isOpen">
          <div className="movementTitle"><b>Split squat</b><span>3 × 8 · target 18 kg</span></div>
          <div className="movementStats"><span>Last <b>3×8 @ 16kg</b></span><span>PB <b>18kg</b></span></div>
          <div className="setLine"><span>Set 1</span><b>8 reps</b><b>18 kg</b></div>
          <div className="setLine"><span>Set 2</span><b>—</b><b>—</b></div>
        </div>
        <div className="movement"><div className="movementTitle"><b>Nordic curl</b><span>3 × 5 · not started</span></div></div>
        <div className="movement isDone"><div className="movementTitle"><b>Calf raises</b><span>✓ complete</span></div></div>
      </div>
    </div>
  );
}

function Feature({ eyebrow, title, children }) {
  return (
    <article className="marketingFeature">
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

function LegalDialog({ type, onClose }) {
  if (!type) return null;
  return (
    <div className="legalBackdrop" role="presentation" onMouseDown={onClose}>
      <div className="legalDialog" role="dialog" aria-modal="true" aria-label={type} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="legalClose" onClick={onClose} aria-label="Close legal information">×</button>
        {type === "privacy" ? <PrivacyNotice /> : type === "cookies" ? <CookiesNotice /> : <TermsOfUse />}
      </div>
    </div>
  );
}

export default function PublicSite({ children }) {
  const [legal, setLegal] = useState("");

  React.useEffect(() => {
    const openLegal = (event) => {
      const type = event?.detail;
      if (type === "privacy" || type === "cookies" || type === "terms") setLegal(type);
    };
    window.addEventListener("wt-open-legal", openLegal);
    return () => window.removeEventListener("wt-open-legal", openLegal);
  }, []);

  const openAuth = (mode) => {
    const node = document.getElementById("account");
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.dispatchEvent(new CustomEvent("wt-public-auth-mode", { detail: mode }));
  };

  return (
    <div className="publicSite">
      <header className="publicHeader">
        <a className="publicBrand" href="#top" aria-label="Workout Tracker home">
          <img src="/icons/icon-192.png" alt="" />
          <span><b>Workout Tracker</b><small>Build Strength. Build Habits.</small></span>
        </a>
        <nav aria-label="Public site navigation">
          <a href="#why">Why it works</a>
          <a href="#screens">Product</a>
          <a href="#principles">Principles</a>
          <button type="button" onClick={() => openAuth("signin")}>Sign in</button>
        </nav>
      </header>

      <main id="top">
        <section className="publicHero">
          <div className="heroCopy">
            <span className="heroEyebrow">PERFORMANCE-FIRST TRACKING & INTELLIGENCE</span>
            <h1>Train hard. Train smart. Track progress. Build discipline.</h1>
            <p>
              Workout Tracker brings plans, in-the-moment performance history, progress, rewards and body intelligence into one
              focused system for athletes, families and small teams.
            </p>
            <div className="heroActions">
              <button type="button" className="publicPrimary" onClick={() => openAuth("signup")}>Create an account</button>
              <button type="button" className="publicSecondary" onClick={() => openAuth("signin")}>Sign in</button>
            </div>
            <div className="heroProof">
              <span><b>Performance leads</b> — see the information that matters while you train.</span>
              <span><b>Progress stays personal</b> — improvement, consistency and intelligent effort matter.</span>
            </div>
          </div>

          <div className="heroScreens" aria-label="Workout Tracker product preview">
            <div className="heroPhone heroPhone--rear"><ProductScreen variant="dashboard" /></div>
            <div className="heroPhone heroPhone--front"><ProductScreen variant="log" /></div>
          </div>
        </section>

        <section className="publicStatement" id="why">
          <span>THE DIFFERENCE IS IN THE MOMENT</span>
          <h2>Know what you did last time — before you do it again.</h2>
          <p>
            A training log is most useful before the next set, run or session. Workout Tracker is built to put history, targets
            and progress beside the action instead of burying them in reports you might never open.
          </p>
        </section>

        <section className="featureGrid">
          <Feature eyebrow="PERFORMANCE" title="The next action stays clear">
            Plans can mix strength, cardio, duration, tasks, recovery and structured sessions. The Log keeps the work in focus
            while still making history and targets available when they can change behaviour.
          </Feature>
          <Feature eyebrow="PROGRESSION" title="Reward showing up and improving">
            XP, badges, avatars, streaks and competition reinforce effort, improvement and consistency without turning volume
            into the only way to win.
          </Feature>
          <Feature eyebrow="INTELLIGENCE" title="Understand the body behind the performance">
            Recovery and body-intelligence features connect training with the reasons adaptation, energy and smart recovery matter.
          </Feature>
          <Feature eyebrow="FAMILY & TEAM" title="Competition that stays close">
            Private Groups create a useful competitive layer for families, friends and small squads while keeping personal
            workout and body information private.
          </Feature>
        </section>

        <section className="screensSection" id="screens">
          <div className="sectionHeading">
            <span>BUILT AROUND THE ATHLETE</span>
            <h2>From today’s session to a long-term record of growth.</h2>
          </div>
          <div className="screenShowcase">
            <div className="showcaseCard showcaseCard--real">
              <div className="showcaseActual">
                <div className="actualAppLabel">ACTUAL APP VIEW · DETAILS ANONYMISED</div>
                <img
                  src="/screenshots/workout-log-mobile.webp"
                  alt="Workout Tracker mobile training log showing planned cardio and session blocks"
                  loading="lazy"
                />
              </div>
              <div><span>LOG</span><h3>Focus on what to do next.</h3><p>Real product view: planned work, logging controls and performance context stay together. Athlete-specific names have been anonymised for the public site.</p></div>
            </div>
            <div className="showcaseCard showcaseCard--real">
              <div className="showcaseActual showcaseActual--readiness">
                <div className="actualAppLabel">ACTUAL BODY INTELLIGENCE VIEW</div>
                <img
                  src="/screenshots/body-readiness-mobile.webp"
                  alt="Workout Tracker Body Readiness Status card with score, readiness scale and recommendation"
                  loading="lazy"
                />
              </div>
              <div><span>BODY INTELLIGENCE</span><h3>Put readiness in context.</h3><p>Readiness gives the athlete a compact training-quality signal and recommendation rather than replacing judgement or coaching.</p></div>
            </div>
            <div className="showcaseCard">
              <div className="showcasePhone"><ProductScreen variant="progress" /></div>
              <div><span>PROGRESS</span><h3>Build a performance autobiography.</h3><p>Over time, sessions, trends and Assessments become a record of how the athlete developed.</p></div>
            </div>
          </div>
        </section>

        <section className="principlesSection" id="principles">
          <div className="sectionHeading">
            <span>THE CULTURE</span>
            <h2>Serious enough for performance. Human enough for families.</h2>
          </div>
          <div className="principlesGrid">
            <div><b>Improvement &gt; volume</b><span>More logging is not automatically better training.</span></div>
            <div><b>Discipline &gt; dominance</b><span>Consistency matters without locking the same person at the top forever.</span></div>
            <div><b>Intelligence &gt; brute effort</b><span>Understanding training and recovery should sharpen performance.</span></div>
            <div><b>Competition supports growth</b><span>Leaderboards are a tool for effort, not a measure of personal worth.</span></div>
          </div>
        </section>

        <section className="privacyStrip">
          <div>
            <span>PRIVACY BY DESIGN</span>
            <h2>Training data should serve the athlete — not an advertising profile.</h2>
            <p>
              Workout Tracker does not sell personal information or use workout data for advertising. Group views are deliberately
              restricted, and connected activity services are optional.
            </p>
          </div>
          <button type="button" className="publicSecondary" onClick={() => setLegal("privacy")}>Read the privacy notice</button>
        </section>

        <section className="accountSection" id="account">
          <div className="accountPitch">
            <span>START WITH THE CORE</span>
            <h2>Build the plan. Log the work. Learn from the result.</h2>
            <p>
              New accounts begin with a blank weekly plan so the system reflects real life rather than forcing a generic programme.
            </p>
          </div>
          <div className="accountPanel">{children}</div>
        </section>
      </main>

      <footer className="publicFooter">
        <div className="publicBrand publicBrand--footer">
          <img src="/icons/icon-192.png" alt="" />
          <span><b>Workout Tracker</b><small>Performance-first. Intelligence-embedded. Discipline-driven.</small></span>
        </div>
        <div className="footerLinks">
          <button type="button" onClick={() => setLegal("privacy")}>Privacy</button>
          <button type="button" onClick={() => setLegal("cookies")}>Cookies</button>
          <button type="button" onClick={() => setLegal("terms")}>Terms</button>
          <a href="mailto:support@workouttrackerapp.io">Support</a>
        </div>
      </footer>

      <LegalDialog type={legal} onClose={() => setLegal("")} />
    </div>
  );
}
