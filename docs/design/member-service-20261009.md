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
