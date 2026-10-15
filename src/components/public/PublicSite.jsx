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
          <div><small>YOUR WEEKLY PLAN</small><strong>Training, your way</strong></div>
          <div className="screenProgress"><i style={{ width: "66%" }} /></div>
          <span>Strength · Cardio · Mobility</span>
        </div>
        <div className="screenCard">
          <div className="screenCardTitle"><b>Today’s plan</b><em>3 blocks</em></div>
          <div className="screenTask isDone"><span>✓</span><div><b>Speed mechanics</b><small>Completed</small></div></div>
          <div className="screenTask"><span>2</span><div><b>Strength</b><small>Target ready</small></div></div>
          <div className="screenTask"><span>3</span><div><b>Mobility</b><small>10 min planned</small></div></div>
        </div>
        <div className="screenCard">
          <div className="screenCardTitle"><b>Make the plan yours</b></div>
          <div className="screenTask"><span>+</span><div><b>Add an extra activity</b><small>Keep a record when plans change</small></div></div>
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
          <span><b>Workout Tracker</b><small>Your training. Your way.</small></span>
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
            <span className="heroEyebrow">CUSTOM PLANS · DETAILED LOGS · VISIBLE PROGRESS</span>
            <h1>Your training. Your way.</h1>
            <p>
              Build your own plan. Log the details. See your progress while you train.
              Keep previous results, personal bests and targets close to every set and session.
            </p>
            <div className="heroActions">
              <button type="button" className="publicPrimary" onClick={() => openAuth("signup")}>Create an account</button>
              <button type="button" className="publicSecondary" onClick={() => openAuth("signin")}>Sign in</button>
            </div>
            <div className="heroProof">
              <span><b>Your plan, your choice</b> — strength, running, sport, mobility and more.</span>
              <span><b>Useful at the next set</b> — last time, your best and today’s target.</span>
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
            and progress beside the action so you can see what to aim for while you log.
          </p>
        </section>

        <section className="featureGrid">
          <Feature eyebrow="YOUR PLAN" title="Choose the training. Make it yours.">
            Start with a blank weekly schedule and build around your own routine or your coach’s programme.
            Mix strength, cardio, sport and mobility, change your plan, and add extra activity when life calls for it.
          </Feature>
          <Feature eyebrow="YOUR TRAINING LOG" title="Record the detail that matters.">
            Log sets, reps, resistance, time and distance. See previous results, personal bests, trends and targets
            from the workout itself, with a useful reference for your next set or session.
          </Feature>
          <Feature eyebrow="YOUR PROGRESS" title="See what is actually improving.">
            Follow movement history, personal bests and activity trends over time. Keep strength, cardio and duration
            in their own meaningful measures, and make room for planned recovery as well as training.
          </Feature>
          <Feature eyebrow="YOUR MOTIVATION" title="Build habits that keep you coming back.">
            Streaks, XP, badges and collectible avatars make consistency rewarding. Optional private groups add
            friendly competition with family, friends or a small team — while your own progress stays the priority.
          </Feature>
        </section>

        <section className="screensSection" id="screens">
          <div className="sectionHeading">
            <span>YOUR WORK. YOUR RECORD.</span>
            <h2>The detail of today. The progress over time.</h2>
          </div>
          <div className="screenShowcase">
            <div className="showcaseCard showcaseCard--real">
              <div className="showcaseActual">
                <div className="actualAppLabel">ACTUAL APP VIEW · TRAINING LOG</div>
                <img src="/screenshots/training-detail-mobile.jpg" width="600" height="1536"
                  alt="Completed strength workout with squats, bench press, incline press and flys, followed by stretching and mobility"
                  loading="lazy" />
              </div>
              <div><span>LOG THE WORK</span><h3>Your routine, recorded properly.</h3><p>Keep movements, sets, reps, weights and duration together. A strength workout and post-workout mobility can sit side by side in the same day.</p></div>
            </div>
            <div className="showcaseCard showcaseCard--real">
              <div className="showcaseActual">
                <div className="actualAppLabel">ACTUAL APP VIEW · MOVEMENT HISTORY</div>
                <img src="/screenshots/personal-best-mobile.jpg" width="600" height="1536"
                  alt="Weighted squat history popup showing an all-time personal best of 25 kg for 20 reps, its first-achieved date and a movement chart"
                  loading="lazy" />
              </div>
              <div><span>SEE YOUR BENCHMARK</span><h3>Know your best while you train.</h3><p>Open movement history from your log to see previous results, your all-time PB and recent bests. Keep the evidence close when you are ready for the next set.</p></div>
            </div>
            <div className="showcaseCard showcaseCard--real">
              <div className="showcaseActual">
                <div className="actualAppLabel">ACTUAL APP VIEW · ACTIVITY TRENDS</div>
                <img src="/screenshots/activity-trends-mobile.jpg" width="600" height="1536"
                  alt="Activity trends showing weekly strength sets and cardio minutes in separate charts with their own units"
                  loading="lazy" />
              </div>
              <div><span>FOLLOW YOUR PROGRESS</span><h3>See the pattern behind the effort.</h3><p>Look back at what you have actually done. Separate activity trends make changes in your training visible without combining unrelated measures into one performance score.</p></div>
            </div>
          </div>
        </section>

        <section className="principlesSection" id="principles">
          <div className="sectionHeading">
            <span>THE CULTURE</span>
            <h2>Your goals lead. Motivation supports them.</h2>
          </div>
          <div className="principlesGrid">
            <div><b>Freedom to train</b><span>Use your own routine or a plan from your coach. You choose what goes into it.</span></div>
            <div><b>Detail with purpose</b><span>Keep last time, your best and your targets close to the work.</span></div>
            <div><b>Consistency with flexibility</b><span>Change the plan when you need to, include recovery and keep your history.</span></div>
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
            <span>START WITH YOUR PLAN</span>
            <h2>Build your own plan. Make your progress visible.</h2>
            <p>
              Start with a blank weekly plan and make it yours. Bring your own routine or your coach’s programme.
              Workout Tracker brings your plan, detailed training log and progress together — so you can see what you did,
              what improved and what to aim for next.
            </p>
          </div>
          <div className="accountPanel">{children}</div>
        </section>
      </main>

      <footer className="publicFooter">
        <div className="publicBrand publicBrand--footer">
          <img src="/icons/icon-192.png" alt="" />
          <span><b>Workout Tracker</b><small>Your training. Your way. A product of Swain Digital Ltd.</small></span>
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
