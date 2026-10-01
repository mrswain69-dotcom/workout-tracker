import React from "react";

export const LEGAL_UPDATED = "1 October 2026";
export const LEGAL_OPERATOR = "Swain Digital Ltd";
export const LEGAL_CONTACT = "support@workouttrackerapp.io";

function Section({ title, children }) {
  return (
    <section className="legalSection">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

export function PrivacyNotice() {
  return (
    <div className="legalCopy">
      <h2>Privacy Notice</h2>
      <p className="legalLead">
        Workout Tracker is designed to help people record training, understand progress and build disciplined habits.
        This notice explains what information is used, why it is used and the choices available to you.
      </p>
      <p className="legalMeta">Last updated {LEGAL_UPDATED}</p>

      <Section title="Who is responsible for your information?">
        <p>
          Workout Tracker is operated by {LEGAL_OPERATOR}. For privacy questions or requests, contact{" "}
          <a href={"mailto:" + LEGAL_CONTACT}>{LEGAL_CONTACT}</a>.
        </p>
      </Section>

      <Section title="Information we use">
        <p>
          Creating an account requires an email address and authentication information. Using Workout Tracker can also create
          profile names, optional age-group and body-weight information, weekly plans, workout and activity logs, performance
          history, XP, badges, streaks, Assessment results, recovery settings and estimated readiness information.
        </p>
        <p>
          If you join a Group, Workout Tracker also stores the Group membership and the safe Group identity you choose to share.
          If you connect a supported activity service such as Strava, Workout Tracker receives the activity information needed
          for the connection and verification features you enable. Connected-source data is not required to use the core app.
        </p>
      </Section>

      <Section title="Why we use it">
        <p>
          We use account and training information to provide the service you ask for: saving plans and logs, calculating progress,
          showing history, running rewards and Group features, protecting accounts, supporting connected activity verification
          and responding to support requests. We do not sell personal information or use workout data for advertising.
        </p>
      </Section>

      <Section title="Children and family accounts">
        <p>
          Workout Tracker is likely to be used by children and teenagers as well as adults. A child under 13 should not create an
          account independently; a parent or guardian should create and manage the account or profile for them. Family accounts
          can contain several athlete profiles. Group views deliberately limit what another member can see and do not expose
          private workout, body, recovery or Assessment history.
        </p>
      </Section>

      <Section title="Lawful bases">
        <p>
          In the UK, information needed to create and run the account is generally used because it is necessary to provide the
          service requested. Security and service-integrity processing is generally carried out for legitimate interests.
          Optional connections and any processing that requires consent are only enabled when the user chooses them. Where a
          different lawful basis is required for a specific feature, Workout Tracker will explain that at the point of use.
        </p>
      </Section>

      <Section title="Who receives information">
        <p>
          Service providers may process information on our behalf where needed to run Workout Tracker. Current infrastructure
          includes Supabase for authentication/database services, Vercel for application hosting and Resend for transactional
          account email. A connected activity provider such as Strava is involved only when you choose to connect it.
        </p>
      </Section>

      <Section title="How long information is kept">
        <p>
          Active account information is retained while the account is in use so the long-term progress record can work. When you
          delete the account through Workout Tracker, the application is designed to delete the account and associated Workout
          Tracker data, subject only to information that must be retained for a legal or security reason. Third-party services
          you connected may keep their own independent records under their own policies.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Depending on the circumstances, UK data-protection law can give you rights to access, correct, erase or restrict your
          information, object to some uses and receive portable information. You can also complain to the UK Information
          Commissioner’s Office. To exercise a right, contact {LEGAL_CONTACT}. Account deletion is also available directly in
          Workout Tracker settings.
        </p>
      </Section>

      <Section title="Readiness and performance information">
        <p>
          Readiness scores and training suggestions are estimates derived from the information available to Workout Tracker.
          They are performance-support features, not medical measurements, diagnoses or emergency advice.
        </p>
      </Section>
    </div>
  );
}

export function CookiesNotice() {
  return (
    <div className="legalCopy">
      <h2>Cookies & Local Storage</h2>
      <p className="legalLead">
        Workout Tracker currently uses only technologies needed to run, secure and remember the application. It does not load
        advertising or non-essential analytics cookies.
      </p>
      <p className="legalMeta">Last updated {LEGAL_UPDATED}</p>

      <Section title="What the app uses">
        <p>
          Authentication/session storage is used so a signed-in user can stay signed in securely. Local and session storage are
          also used for functional preferences such as the currently selected athlete, temporary Group join state, update
          handling and other app-only continuity features.
        </p>
      </Section>

      <Section title="Why there is no consent banner today">
        <p>
          The current public build does not intentionally load advertising, behavioural tracking or optional analytics
          technologies. Because only essential/functional storage is used, Workout Tracker does not ask you to accept optional
          cookies that are not present.
        </p>
      </Section>

      <Section title="If analytics or marketing tools are added later">
        <p>
          Non-essential technologies will not be enabled before the appropriate choice is offered. This notice and the consent
          controls will be updated before such tools are introduced.
        </p>
      </Section>
    </div>
  );
}

export function TermsOfUse() {
  return (
    <div className="legalCopy">
      <h2>Terms of Use</h2>
      <p className="legalLead">
        These terms apply when you create an account or use Workout Tracker.
      </p>
      <p className="legalMeta">Last updated {LEGAL_UPDATED}</p>

      <Section title="The service">
        <p>
          Workout Tracker is a performance-tracking and training-intelligence service. It helps users record plans and activity,
          review progress, use rewards and, where enabled, participate in private Groups and connected-activity features.
        </p>
      </Section>

      <Section title="Age and family use">
        <p>
          Users under 13 must not create an account independently. A parent or guardian should create and manage their access.
          If you create or manage a profile for another person, you must have authority to do so and should only enter information
          appropriate for the service.
        </p>
      </Section>

      <Section title="Training and health">
        <p>
          Workout Tracker does not provide medical diagnosis, emergency services or a substitute for professional medical or
          coaching advice. Training-readiness and recovery outputs are estimates. Stop activity and seek appropriate help if
          there is pain, injury, illness or another health concern that needs professional assessment.
        </p>
      </Section>

      <Section title="Your account and information">
        <p>
          Keep account credentials secure and use accurate information when accuracy matters to your progress. Do not use
          Workout Tracker to access another person’s private information, manipulate competition results, abuse Group features
          or interfere with the service.
        </p>
      </Section>

      <Section title="Rewards and competition">
        <p>
          XP, badges, avatars and leaderboards are motivational features. They have no cash value and may be adjusted where
          needed to fix errors, prevent abuse or protect fair competition. Workout Tracker is designed so competition supports
          improvement rather than defining a person’s worth.
        </p>
      </Section>

      <Section title="Availability and changes">
        <p>
          We aim to keep Workout Tracker reliable but cannot promise uninterrupted availability. Features may evolve as the
          product develops. Material changes to these terms will be communicated in an appropriate way.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>
          Optional connected services are also governed by their own terms and privacy notices. Disconnecting a provider from
          Workout Tracker does not delete the account you hold with that provider.
        </p>
      </Section>

      <Section title="Closing your account">
        <p>
          You can permanently delete your Workout Tracker account from Settings. Account deletion is intended to remove the
          account and associated Workout Tracker application data. This action cannot be undone.
        </p>
      </Section>

      <Section title="Contact and governing law">
        <p>
          Contact <a href={"mailto:" + LEGAL_CONTACT}>{LEGAL_CONTACT}</a> with questions. These terms are governed by the laws of
          England and Wales, subject to any mandatory consumer rights that apply where you live.
        </p>
      </Section>
    </div>
  );
}
