# Account member service roster

Approved scope: add a signed-in Account navigation page, aligned with the shipped
source of the mobile demo (`hhc-apps`, Android demo branch, eb92744). Web scheduling
management stays exclusively in Admin. No mobile store submission in this task.

## Experience

Use Account's shell, shared controls, typography and theme tokens. Carry over the
mobile segmented My service / Fellowship roster switch, monthly navigation,
date-grouped assignments and focused assignment detail. No large hero or explanatory
intro. Date and task name lead; fellowship, assignee and actionable status follow.
On narrow screens retain the same reading order. Deep links must survive login.

Detail supports the existing mobile workflow: invite a named peer, request openly,
switch method, withdraw, accept, decline a named invitation, ask the responsible
leader for help. Hide commands for past/cancelled assignments and never expose
admin commands, even to a leader using this member view. Show overlap warnings.
Published-only reads must also exclude drafts defensively for manager accounts.

## Integration and reliability

Reuse authenticated Operations transport, generated canonical schemas, abortable
reads and current session refresh. Load every cursor page and every eligible team
for My service, filtering month boundaries in the display timezone. Detail and
candidate loads must not overwrite a newer selection or account. Use server
assignment version and stable idempotency key for uncertain retries. A stale
version requires refreshed detail and explicit reconsideration, never blind replay.
Keep a successful mutation distinct from a failed subsequent refresh.

Include service inbox/deep links and reminder preferences using existing service
contracts to match the member flow; browser delivery is not native Expo push.
Preserve existing legal and analytics exclusions. Never emit names or schedule
content into analytics, or cache private rosters persistently.

## Acceptance and delivery

Test command eligibility and month/DST boundaries; typed API paths, pagination,
idempotency and error handling; page loading/empty/error states, stale response
races, detail flows, translated copy, protected navigation and default-off gate.
Run repository full tests, lint and build, review diff, then ego-lite desktop,
tablet and narrow light/dark interaction checks. Record synthetic vs real API
checks separately. Publish reviewed client package before replacing preview pins;
coordinate backend/gateway feature activation only through reviewed release flows.
No main writes, merges or production changes in this implementation phase.

## Implementation checkpoint

- Added shared authenticated member transport and published-only pagination; no
  scheduling methods in the member adapter. Baseline 558 tests passed.
- Added monthly personal/fellowship roster, responsive date-grouped list, focused
  assignment drawer, substitution selection/confirmation, reminder settings and
  paged service inbox. Account routes remain behind default-off build flag.
- Command retry keeps its key after uncertain failure; stale versions disable
  further commands until an explicit detail reload. Account identity keys isolate
  page state; reads are abortable and late month responses are ignored.
- Focused UI checks cover filtering, load recovery, late response, acceptance,
  uncertain retry, stale version and preference conflict.
- Still pending before readiness: full shell/browser acceptance, inbox unmount and
  error-path tests, protected/deep-link route tests, reminder dirty-navigation
  protection, Japanese/Korean copy (currently English fallback), independent code
  review, real API integration, registry package and release coordination.

## Review corrections

- Independent read-only review found candidate pagination truncation and off-month
  notification overlap omissions. Fetch all candidate pages with cursor-cycle
  rejection. Fetch each actionable detail's 24-hour lookback interval across all
  fellowships (the backend caps meeting duration at 1440 minutes). Acceptance is
  disabled until the overlap check succeeds; owners retain overlap warnings.
- Read acknowledgement no longer blocks inbox navigation. Prior inbox pages stay
  visible after pagination errors. Extracted the existing Member Details router
  guard for reminder settings; browser-close protection clears after saving.
- Focused regression suite: 37 tests in 6 files passed, including existing Member
  Details behavior. Typecheck and lint passed. Formatting uses already-installed
  Prettier, with no new runtime dependencies.
- Browser acceptance, route/auth integration tests, complete translations, real
  API verification and coordinated release prerequisites remain open.
