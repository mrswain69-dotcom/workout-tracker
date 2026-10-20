# Guided first workout

New registrations collect a display name and carry it through email confirmation
in Auth metadata. Bootstrap continues to use the existing atomic RPC. Only the
single untouched default profile of a not-started account is renamed from that
metadata. Names never control ownership or permissions.

Accounts with incomplete onboarding, a blank plan and no recorded training open
the guided builder in Plan. Completed accounts retain normal navigation. The
builder is also available explicitly from Plan. Setup can be dismissed, resumed,
or routed to logging, the starter library, or the full editor. Its state uses the
existing account onboarding JSON; no database schema change is required.

Saving appends one planned activity to the chosen days of the selected programme
week. It preserves existing activities and writes no workout results. The next
actual occurrence is resolved from the programme schedule before linking to Log.
The full editor remains available for sessions, tasks, phases and other changes.
Starter programmes can be searched by activity or focus.

The dashboard now starts with today's workout and shows relevant last results and
planned targets. Strength, cardio and duration Log blocks show the comparison by
their inputs. Suggested progression remains optional and distinct from the plan.

Repeating a previous workout is offered on empty log days. Only planning fields
are copied. Results, completion, timestamps and provider evidence are not copied;
Session definitions are freshly hydrated. Repeated strength work retains the
planned set count. Blank repeated activity earns no XP and does not complete a
day. Existing dated plans and logs are never overwritten by repeating a workout.

Verification covers signup metadata, onboarding routing, one-activity setup to
saved log, failure retention, continued input focus, comparison matching, and safe
workout repetition. Two pre-existing tests on main fail independently of this
change: recommended-recovery navigation and a log-snapshot source-string check.
