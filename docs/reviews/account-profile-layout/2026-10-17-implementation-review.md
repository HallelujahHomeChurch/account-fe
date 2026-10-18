# Account Profile implementation review — 2026-10-17

Implemented in isolated task branches across Account, WWW, Operations, Gateway and frontend-platform. No merge, tag, registry publication or production mutation.

## Behavior and layout

- Account statement code and Website client dependency removed; legal acceptance/review and WWW statements retained.
- Devices merged below MFA in Security; email newsletter preference merged into Profile with pending confirmation and failure handling. Legacy links redirect and focus their destinations. Data requests renamed in all five locales.
- Desktop/mobile header uses the existing shared search. Authorized unit folders use debounced, abortable roster filtering; all other pages search only available Account features locally. Search state resets by verified owner, route and locale. Raw query is absent from URL, storage, telemetry metadata and DOM title attributes.
- Mobile header contains logo/search; permission-based bottom tabs contain Personalization, Security, optional Organizations, More and Avatar. Direct pathname selection replaces moving indicators on both sites. More preserves capability gates.
- Desktop legal links/copyright share the footer baseline; mobile footer combines them. Ordinary settings retain intrinsic height; desktop unit lists retain internal table scrolling; mobile uses document scrolling.
- Mobile unit editing and type filter share the breadcrumb row; business actions use the second row. Narrow desktop buttons retain accessible names and distinct icons. At 320px the business-actions row can scroll horizontally without document overflow.

## Verification evidence

- Account: 614 tests in 68 files passed after review fixes; lint and production build passed. Release-policy and Bicep build passed. Existing bundle-size warning remains.
- WWW: 1,222 tests in 148 files, lint and production build passed; existing unrelated LegalRequiredNavigation lint warning remains.
- Operations: full race suite with disposable PostgreSQL17, vet, OpenAPI lint, migration policy and Docker build passed. Retired lifecycle attempts cover ordinary/same-unit/ancestor/staff/old-receipt cases with unchanged state/version/receipts/audits. Admin permitted/denied lifecycle and archived reads are covered.
- Gateway: Go tests/vet, auth-routing/method matrix, static policy, release/rollback checks, OpenAPI lint, Bicep build and Docker build passed. Synthetic-JWT runtime fixture confirms 404 on all public hosts/methods with zero managed lifecycle upstream calls and successful Admin forwarding.
- SDK: regenerated from canonical OpenAPI; build, tests, lint, package contracts, packing, packed consumers and generated drift check passed. Consumer pins are unchanged; registry publication is not part of this task.
- Profile browser geometry: 320/390/767/768/960/1440px; five locales at 320/768px; dark mode across all six widths. Every sample has zero document horizontal overflow. Actual card-to-footer gap is 24px mobile and at least32px desktop. 1440×620 desktop document is exactly620px, eliminating the previous second scrollbar. Mobile660px viewport can reach the footer with62px navigation clearance.
- Search result navigation to Security devices was exercised in the browser and focuses the devices card. Collapsed roster query remains visible/clearable and filtering does not alter the URL.

## Independent code review

One fresh-context reviewer inspected all five repository changes. All four findings were verified and fixed, with failing-then-passing regressions: remove raw member-query title metadata; remount roster scope on locale change to abort immediately; close failed device confirmation so the page error is visible and the signed-in row remains retryable; move mobile unit edit beside breadcrumbs. A separate geometry check caught narrow-desktop toolbar overflow and now verifies its right edge stays inside main.

## Release boundary and limitations

Draft PRs require all repository CI checks before merge. Future release order: Account UI → Gateway deny → Operations active-only/tombstones; WWW may release independently. Keep the verified Gateway deny revision as the minimum rollback baseline. SDK publication requires its existing separately authorized tag workflow.

Physical iPhone/Safari, real software keyboard, installed-PWA safe-area calibration, production login/member data and live release smoke were not performed. Chromium viewport emulation is evidence for document layout, not a substitute for those device checks. No real subscriber preference or other user's device was changed.

Mock-data visual evidence: [mobile profile bottom](profile-mobile-bottom.png), [desktop unit table](organizations-desktop-scroll.png). No user's supplied profile screenshot or real account data is committed.
