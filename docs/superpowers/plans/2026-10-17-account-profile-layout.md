# Account Profile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after explicit implementation authorization. Steps use checkbox (`- [ ]`) syntax for tracking. Implementation authorized by the user on 2026-10-17; merge, tag and release remain unauthorized.

**Goal:** 整併 Account 設定頁、對齊官網桌面／手機搜尋與手機導覽，收斂小家工具列，並讓封存能力僅由 Admin 路徑提供。

**Architecture:** 沿用 shared Search/Menu/AccountMenu，Account 的 shell 保留本地路由與權限。會員搜尋 state 由 Layout 直接傳 unit 頁，不新增 registry/context；功能搜尋 submit 後用既有 Dialog 顯示結果。Operations 與 Gateway 共同退役 managed lifecycle，保留 Admin 及相容 wire fields；只有契約生成物需要同步 frontend-platform。

**Tech Stack:** React 19、TypeScript、React Router、既有 HHC UI、Vite；官網 Next.js；Go/PostgreSQL Operations；Nginx Gateway。

**Spec:** [2026-10-17-account-profile-layout-design.md](../specs/2026-10-17-account-profile-layout-design.md)

## Global Constraints

- 使用者於2026-10-17明確授權依更新後計劃實作。只在task worktrees修改／commit；不merge/tag/部署、不修改生產資料或設定。
- 未來實作每個 repo 用從最新 `origin/main` 建立的隔離 worktree／分支；保留現有使用者與 Codex worktree；各 repo 獨立 PR／required CI。
- 不新增依賴、全域搜尋框架或 UI package 升級；Account `ui@1.0.55` 已具所需搜尋介面。
- 手機 `<768px`，桌面 `>=768px`；五項底部導覽，無小家管理權限為四項；所有 action 仍遵守原能力／授權 gate。
- Copyright 固定為 `© 2026 哈利路亞家教會. All rights reserved.`；五語名稱與操作說明同步。
- 保留法律同意、analytics consent、資源 legal gate、Email correction reauth、會員自我排除及 Admin lifecycle。
- 搜尋 query 不放 URL、儲存空間、analytics、Sentry 或其他紀錄；不增加跨小家搜尋。
- source 調查 ref 及狀態見規格；以下相對檔案路徑均以標示 repo 為根。

## Review Focus

1. 換帳號／換 unit 的遲到搜尋、newsletter 或裝置回應不可覆蓋新 owner（Tasks 1、2）。
2. 舊前端與 replay receipt 不能繞過 retired managed lifecycle；Admin archived 查詢／授權仍有效（Tasks 4、5）。
3. 767/768px、長麵包屑、320px 五項導覽、手機鍵盤與低高度桌面不能互相遮擋（Tasks 2、3、7）。
4. Menu 展開與路由 selected 必須分離；舊 hash 連結真的定位／聚焦；搜尋 Dialog 不因 field collapse 消失（Tasks 1–3）。
5. OpenAPI deprecated bool/false 欄位與舊 SDK validator 相容；Admin 的 IncludeArchived 不被污染（Tasks 4、6）。

## Task 1: 功能頁整併與聲明清理（account-fe）

**Files:** 修改 `src/App.tsx`、`src/pages/ProfilePage.tsx`、`src/pages/SecurityPage.tsx`、`src/index.css`、`src/features/email-correction/messages.ts`、`src/i18n/messages.ts`、`README.md`、`package.json`、`pnpm-lock.yaml`；將 `src/pages/DevicesPage.tsx`／`NotificationsPage.tsx` 移成 `src/components/DevicesCard.tsx`／`NewsletterPreferenceRow.tsx`；刪 `StatementStrip.tsx`／`StatementDialog.tsx` 與專用測試；清理 `preview/email-correction/vite.config.ts`／`boundaries.tsx`。

**Interfaces:** `DevicesCard(): JSX.Element` 自有裝置讀寫／錯誤狀態，產生 `id="devices"` 區段；`NewsletterPreferenceRow(): JSX.Element` 產生 `id="email-notifications"` row。仍使用原 auth.api，不改後端合約。元件以已驗證 profile.id 為 key，非每次 route render 隨機重建。

- [ ] 先調整既有 page/component/App 測試，加入 `redirects legacy settings links and focuses the destination`、`never fetches church statements on account routes`、`preserves required legal flows`；所有相關 Account route 對 statements active/dismissal 零呼叫。
- [ ] 裝置測試覆蓋 loading/empty/error、目前裝置優先、signed-out 無按鈕、確認取消零 mutation、成功後顯示 signed-out、失敗不改狀態、pending 防重送、切 owner 時清除舊 rows/response。
- [ ] newsletter 測試覆蓋四狀態（pending on+待確認、取消呼叫 false、不自動寫 subscribed）、載入失敗只有 retry、saving 禁操作、失敗保留原值、unmount/owner change 舊回應無效。
- [ ] 執行 `corepack pnpm exec vitest run src/App.test.tsx src/pages/ProfilePage.test.tsx src/pages/SecurityPage.test.tsx src/pages/DevicesPage.test.tsx src/pages/NotificationsPage.test.tsx`，先確認新 assertions 對舊實作失敗；實作後更新路徑重跑。
- [ ] 將裝置合成單 card，放 MFA 後；Email row 放個人化現有 card 的外觀之後。新元件保留確認／錯誤／重試；owner key 與 request cleanup 防 stale。
- [ ] 舊路由做replace redirect；依spec「功能搜尋目的地」新增九個固定row/card id白名單（avatar/nickname/language/appearance/email-notifications/password/linked-accounts/mfa/devices），目標有可存取名稱與tabIndex=-1或適合的原生控制項。hash scroll/focus在目標ready與Dialog關閉後生效，依location.key而不只pathname/hash觸發；同頁同hash再次選取也需定位，尊重reduced motion，不用未校驗selector。
- [ ] 五語 title/intro 與導航可見名稱全版更名；不改 `/data-requests`、OAuth return path、API names、reauth controller 或 capability。
- [ ] 刪本地聲明與唯一 hhc-web-client dependency；保留 preferences、LegalReview/LegalAcceptance、AnalyticsBoundary。預覽 stub、README 與負向測試同步。
- [ ] 重跑受影響測試、lint/build、`git diff --check`；做 focused commit（未來實作分支）。

## Task 2: Desktop/mobile header 搜尋與小家工具列（account-fe）

**Files:** 修改 `src/App.tsx`、`src/pages/organizations/OrganizationUnitPage.tsx`、`src/pages/organizations/OrganizationMemberPage.tsx`（local API signature 收斂）、`src/lib/operations-api.ts`、對應 tests、`src/index.css`、`src/i18n/messages.ts`、`scripts/review-organizations.tsx`；新增 `src/components/AccountHeaderSearch.tsx` 及測試、`src/lib/account-feature-search.ts` 及測試。

**Interfaces:** `AccountFeatureSearchItem = {id: string; label: string; category: string; keywords: string[]; to: string}`；`findAccountFeatures(items: readonly AccountFeatureSearchItem[], query: string): AccountFeatureSearchItem[]` 僅 trim/大小寫正規化與 substring，比對當前 locale label/category/明列 alias；不引 fuzzy-search 套件。`AccountHeaderSearch({mode, value, onChange, items, isDisabled})` 用 shared field；features submit 顯示結果 Dialog。`OrganizationUnitPage({searchQuery, onSearchAvailabilityChange})` 由 App 直接傳 state；availability payload 含 unitId + status (`loading | ready | unavailable`)；父層只接受目前 owner/scope 回報。

- [ ] 先測exact folder路由與roots/member-detail分流、desktop/mobile同搜尋值、function結果權限/capability過濾、空結果、大小寫/五語、IME Enter不提交、Escape/focus、Dialog不被field collapse關閉；另測會員非空query在Enter/Escape/blur後仍可見且可清除、背景refresh可繼續輸入、同頁同hash重選與Dialog關閉後最終activeElement是目標；新測試對舊版應失敗。
- [ ] App 用 `matchPath({path:'/organizations/:unitId', end:true})` 選 mode。query 保存 `{scopeKey,value}`，key 含 owner、pathname、locale；不同 key 當下即讀空值，避免 effect reset 前送出舊 query。
- [ ] 功能清單使用已驗證能力：暱稱/頭像、語言、外觀、Email通知、密碼、第三方登入、MFA、裝置、資料請求、可用小家/資源/會員資料，目的地沿用Task1白名單。不索引personal data、不使用cached navigation作可操作授權。Dialog結果是真實Router Link，空結果有說明，不自動導向第一筆；選取時記錄navigation intent、關閉Dialog、清query，即使pathname未變。普通dismiss恢復trigger；選取結果的scroll/focus須在portal關閉／focus restore之後生效，測最終activeElement，不假設shared Dialog有未提供的disableRestoreFocus/onExitComplete prop。
- [ ] header會員query直接傳UnitFolder，保留原trim/250ms、page=1、limit=50、AbortController。availability回報由捕捉當次owner/scope的callback隔離，不能只比unitId（不同帳號可能管理同一unit）；unmount不能改下一頁。ready後的會員query refresh不把field禁用；只有initial unit/授權尚未ready或unavailable才禁用。收合不清query：`AccountHeaderSearch`在members模式非空且collapsed時，於header搜尋slot顯示可截斷的有效字詞+清除按鈕，重開可編輯；不新增頁內搜尋框。清空/換unit/換owner/重試/慢response與權限各有測試。IME request時機維持現有debounce，不能宣稱保證只在compositionend查詢。
- [ ] 刪頁內 roster search/filter/restore/archive dialog 與 action；local client 不再暴露 setManagedUnitStatus，getManagedUnit 本地簽名收斂為 `(unitId: string, signal?: AbortSignal)`，wire 不送 includeArchived。同步 unit/member page、tests、fixture calls。保留 wire validator 對 required archive/restore bool 的相容性。
- [ ] header 對齊官網 min-height desktop76px/mobile68px、shared brand色彩/字級與控制項間距；desktop搜尋在brand/avatar之間展開，mobile滿header覆蓋；不使用shared field的960px舊overlay規則。小家desktop header為可縮breadcrumb+edit／不縮的三業務按鈕；mobile兩row。長breadcrumb局部捲動且可鍵盤到達；維持actions gate、完整Email加入與負責人dialog搜尋的獨立state。
- [ ] 測試 member query/page/abort、dialog search 不受 header 污染、各 unit kind/actions 的按鈕顯示、本人排除／自己的責任列唯讀、archived/unavailable unit 不可啟動搜尋。更新 review fixture 移除封存能力。
- [ ] 執行 `corepack pnpm exec vitest run src/components/AccountHeaderSearch.test.tsx src/lib/account-feature-search.test.ts src/pages/organizations/OrganizationUnitPage.test.tsx src/pages/organizations/OrganizationMemberPage.test.tsx src/lib/operations-api.test.ts`，先 red 後 green；lint/build + focused commit。

## Task 3: Account 手機導覽與 footer（account-fe）

**Files:** `src/App.tsx`、`src/App.test.tsx`、`src/index.css`、`src/index.html`、`src/i18n/messages.ts`；必要時新增小型 `src/components/AccountMobileNavigation.tsx`／`useScrollChrome.ts` 與對應 tests，避免 App 持續膨脹，不新增 router adapter 或 shared framework。

**Interfaces:** 導航 items 由 App 現有 verified capabilities/navigation 產生；只有 Link destination 和既有 Menu/AccountMenu。scroll hook 僅接 `blocked: boolean`、`resetKey: string` 並回 `{visible: boolean}`，不含路由、權限或搜尋業務。

- [ ] 先新增 `renders five destinations or four without organization access`、`opens More without changing current destination`、`selects More on nested resource routes`、`never restores private rows after logout`、`keeps chrome visible while a menu/search has focus` 等測試；保留 login/recovery 無 protected nav 的測試。
- [ ] 刪 Drawer/hamburger；desktop 保留 sidebar+avatar；mobile header 僅 brand/search，avatar menu 搬最後項。「其他」第一可用項資料請求、後接 eligible 資源；capability 尚未確定/disabled 不顯示可操作資料請求。兩者皆無時保留disabled其他slot，附可存取說明「目前沒有其他可用功能」，不開空menu、不捏造功能。
- [ ] 選取完全由pathname判斷；Menu用展開狀態，開啟不冒充頁面selected。其他的menu items不設raw href；以固定id→本地path map在onAction呼叫navigate，避免整頁重載／重複導航。disabled空slot直接用既有Button、不掛空Menu。沒有滑動indicator、optimistic selection或延遲click。avatar原官網／投影／後台／登出能力保留，登出錯誤仍可見。
- [ ] mobile breakpoint 統一 767px；取消 mobile fixed-height/nested page scrolling，header sticky 並以 document scroll 管理顯隱。下/上捲16px門檻、距頂16px顯示；搜尋由onExpandedChange傳blocked。現有Menu/AccountMenu沒有onOpenChange，menu/focus固定沿用官網CSS `:has([aria-expanded="true"])`／`:focus-within`覆蓋transform，作用範圍限定本header/tab bar；不假設可用不存在的callback。補viewport-fit=cover；底部預留一般62px、iPhone standalone84px加safe-area（沿用官網數值）。
- [ ] footer在桌面共用grid底列：左法律連結、右main寬度內左對齊copyright；主內容與table保持可縮，pagination/footer不放table scroll body。mobile合為單footer，無重複法律links，被底nav隱藏時空間不跳動。一般設定頁main必須按intrinsic內容高度排版，最後card後的留白計入真正scroll range；不要全域套用probe的align-self:start破壞小家flex/table。新內容→footer可見間距desktop至少32px/mobile24px，nav/safe-area另計，不能重複疊加。mobile要同步解除body/app/layout/content/main的height/min-height/grid/overflow舊約束，避免100vh下限仍勝過100dvh。
- [ ] 測試 scroll方向、focus、menu、route reset、reduced-motion；browser 尺寸與長表格驗收見 Task 7。跑相關 tests、lint/build + focused commit。

## Task 4: Managed 封存退役與 active-only 查詢（operations-api）

**Files:** `internal/httpapi/management_handlers.go`／測試、`internal/membership/service.go`／相關 interfaces/tests、`internal/postgres/management_repository.go`／`membership_repository_integration_test.go`、`openapi.yaml`、README；只移除 managed callers 專用實作。

**Interfaces:** 原 POST managed `.../{unitId}/archive|restore` 變 404 tombstone、零 lifecycle service 呼叫；`GetManagedFolder(..., includeArchived bool)` 暫保留內部／wire 相容簽名但無論 true/false只取active。`ManagedActions.archive/restore` required bool 始終 false。Admin `SetOrgUnitStatus` 與其 auth/audit/receipt 流程完全保留。

- [ ] 先新增 HTTP denial tests：valid ancestor、同單位、ordinary、staff、舊 receipt replay 均無法由 managed 路徑封存或還原；觀察 DB status/version、receipt、audit 無新變更。不要只改原成功測試的 expected code。
- [ ] 對active parent+archived child、direct archived ID、true/false/omitted includeArchived做查詢測試；folder active-only且直達404。另列managed roots/member list/detail/candidates/responsibilities/mutation於archived unit均排除或拒絕（沿原403/404語義），不能只測folder。folder、member view及加入會員等共用actions回應都必須archive/restore=false。保留Admin archived list/detail、授權後archive/restore成功、無權限拒絕正／負回歸。
- [ ] 用現有 HTTP error 格式處理 tombstone；刪 HTTP/service/repository interfaces 的 managed archive/restore 方法及無其他 callers 的專用交易/常數/SQL分支。grep 每個 caller，不能全面刪 shared hasManagementScope archived read 分支（Admin也使用）。
- [ ] managed-only查詢／授權邊界收斂active，檢查所有上述子路徑，不全面修改Admin使用的shared archived-read。從共同`managedActions`移除Archive/Restore授權檢查（`internal/membership/service.go:470–493`），保留零值false欄位，使folder/member/加入會員等所有callers一致；不要只在folder response覆寫。不刪歷史資料、不產生migration、不改其他membership/resource行為。
- [ ] OpenAPI 保留 tombstone paths，deprecated=true、移除200成功承諾並描述404；managed GET 使用獨立deprecated bool參數（描述ignored），不修改Admin共享IncludeArchived；actions兩欄deprecated+enum:[false]。Task 6 同步生成物。
- [ ] 執行 targeted HTTP/integration tests red→green，再執行 `go test -race ./... -count=1 -p=1`、`go vet ./...`、`npx --yes @redocly/cli@2.47.0 lint openapi.yaml`、migration/release policy與Docker/scan required CI。integration須設定指向disposable PostgreSQL17的`HHW_TEST_DATABASE_URL`，確認本次DB測試實際執行而非skip；不印連線值、不用實際會員資料。
- [ ] focused commit/PR；部署順序見 Task 8，不把現有 UI 功能突然失效當兼容成功。

## Task 5: Account Gateway 封存端點拒絕（api-gateway）

**Files:** `conf.d/api/account/75-unit-management.conf`、`docs/openapi.yaml`、`README.md`、現有 routing tests／新增 `scripts/test-managed-lifecycle-retirement.sh`、`.github/workflows/ci.yml`（將新runtime test納入）。Admin `conf.d/api/admin/60-operations.conf` 僅驗證。

**Interfaces:** Account host 的 managed archive/restore 固定404、不得 proxy 至 Operations；Admin lifecycle 路徑仍按既有method/JWT/scope轉送。明確拒絕規則不能落到SPA fallback或其他泛用location。

- [ ] 先以local synthetic JWT/fixture驗證 Account POST archive/restore拒絕且upstream計數為零；包含錯method、大小寫UUID、query及不同public host，不能改path/host繞過；不使用生產token。
- [ ] 將原 allow 規則改為固定拒絕；核對Nginx regex優先序、未知/api/* fallback。保留Admin原allowlist及登入/讀寫限制，不新增跨站CORS。
- [ ] runtime正向證明Admin路由仍proxy（fixture）；真正Admin權限與資料狀態由Task4測試證明，不能把routing fixture當業務驗收。
- [ ] 更新Gateway OpenAPI與catalog契約一致，再跑新script、`./scripts/test-auth-routing.sh`、`./scripts/test-auth-method-matrix.sh`、release/rollback policy及該repo完整required CI（含Docker/runtime與scans），不以靜態文字匹配代替runtime denial。
- [ ] focused commit/PR，release後依Task8非破壞smoke。

## Task 6: Operations SDK 契約同步（frontend-platform）

**Files:** `packages/operations-client/openapi/operations-api.yaml`、`src/generated.ts`、`src/client.test.ts` 及對應contract tests；不改 `packages/ui`。

**Interfaces:** 從Task4 canonical spec拷貝；deprecated bool接受舊型別且行為active-only，archive/restore欄位為false，tombstone不宣稱200。既有Admin includeArchived=true依舊可用。

- [ ] 先新增contract assertions：managed舊bool仍可序列化、文件標deprecated/ignored、required false fields存在、Admin IncludeArchived未改、tombstone不再有成功回傳。舊true不能擴權由Task4真實HTTP/DB測試證明，不能以SDK mock當證據。對照Account runtime validator accepts=false，舊package不因缺欄位失敗。
- [ ] 同步canonical spec副本，執行 `corepack pnpm --filter @hallelujahhomechurch/operations-client generate` 並commit生成物；不可手改generated.ts。
- [ ] 執行 `corepack pnpm --filter @hallelujahhomechurch/operations-client check:generated`、repo `build`、`test`、`lint`、`check:packages`、`pack:packages`、`test:consumers` 與完整required CI。
- [ ] 本次Account不需要新SDK介面，維持精確pin即可完成runtime退役；SDK source/CI完成須明列。官方package發佈是另行授權的既有tag workflow gate；未tag/publish不可宣稱registry版本已更新。若選擇本次發布SDK，再更新所需consumer精確pin及lockfile，不整批升UI/無關packages。

## Task 7: 官網移除 tab 移動效果與跨站驗收（hhc-web + account-fe）

**Files:** 官網 `src/components/layout/SiteHeader.tsx`、`SiteHeader.test.tsx`、`src/app/globals.css`；Account對應App/CSS/tests；新增本次browser review證據至 `account-fe/docs/reviews/account-profile-layout/`（實作時才建立）。

- [ ] 將官網 `starts moving the shared mobile indicator and replays only the latest rapid navigation` 測試改為 `navigates once without animation replay and selects from pathname`；驗證一次click即觸發既有Link導航、無RAF重播、modifier-click/native link不被阻止，route變更selected同步。
- [ ] 刪mobileSelection/mobileIndicatorIndex/delayedMobileHref/mobileNavigationFrame/navigateMobile、indicator DOM及專用CSS；原Link不再掛延遲onClick。直接data-active來自pathname，選取項以自己的背景/圖示/文字呈現，不做transform移動。保留chrome scroll、search overlay、AccountMenu/PWA/statement與桌面nav樣式。
- [ ] 本地target tests red→green；官網跑 `corepack pnpm test:run`、lint、build、`perf:static`、release-policy、Docker build及required掃描；修改前閱讀該worktree installed Next docs。
- [ ] 一輪batched browser驗收320/390/767/768/960/1440px、light/dark與五語，最多再一輪確認修正。測search展開、IME/Enter/Escape/clear、Dialog焦點、menu/selected分離、上下捲動、手機鍵盤開關、safe area/PWA、長content與hash目標、無文件橫向溢出。追加[頁尾問題分析](../../reviews/account-profile-layout/2026-10-17-scroll-bottom-analysis.md)回歸：長profile/安全性頁先以舊CSS重現card到底0px（即使computed padding-bottom=72px），新版assert實際card→footer間距，不只assert宣告值。
- [ ] 手機首要重現使用者明確回報的`/profile`一般滑動：直接進頁、不先開dialog/menu/鍵盤，驗最後會員資料row與card底緣可達；不要以小家table案例或overlay案例代替。再分別驗URL列展開/收合、橫直向、軟鍵盤關閉、暱稱/頭像/語言/avatar overlay關閉後滑動。量測visualViewport與scroll容器幾何，確認最後控制項、footer法律links四角可見且可點；inner scrollTop達最大但bottom仍在可視區外不算通過。檢查overlay正常釋放scroll lock，不手動覆寫library的全域body狀態掩蓋問題；iOS真機與Chromium模擬的結果分開記錄。
- [ ] 桌面1440×620＋50 roots/50 members：表格內容內捲，breadcrumb/buttons/pagination/footer可達且不被擠出。手機長breadcrumb分兩row，表格可局部橫捲；footer法律links不被nav或鍵盤永久遮住。iPhone safe area/PWA須記錄實機或模擬，未做實機不得聲稱完成。
- [ ] Account完整 `test:run`、lint、build、release-policy、Bicep build；將權限/載入失敗/舊路徑/無聲明請求驗收記錄進review文件。其他repo required CI均不可省略。

## Task 8: 將來交付順序與回復邊界（本輪不執行）

1. 確認scope/計劃審查完成，再另行取得實作授權；實作期間每repo獨立worktree/PR，不能在primary main提交。
2. 可並行準備所有PR；先部署Account新UI（已停止所有封存呼叫，仍兼容舊actions）並驗證，再退役producer能力。官網animation PR可獨立發布。
3. 發布Gateway Account拒絕規則，先完成非破壞route smoke並記錄deny revision。第一次deny release若readiness/smoke失敗，現有workflow可能自動rollback至仍允許舊功能的版本；此時安全退役尚未成立，停止後續發布並報告失敗，不能宣稱已阻斷。不為掩蓋失敗繞過既有rollback。其後發布Operations tombstone/active-only；兩者都成功前不能稱admin-only已交付。
4. canonical OpenAPI與SDK副本按同一審查版本同步；Task6 source/CI完成與registry tag/publish分開記錄，無需新介面的consumer不因等package發布而解除backend封鎖。
5. Admin archive/restore正向mutation只在隔離測試／已授權測試資料驗證；production smoke只讀健康、current revision、拒絕路由、Admin讀取及登入後設定入口，不對真實組織封存還原、不改訂閱、不登出他人裝置。
6. Operations既有release即使沒有新migration，也會先deactivate/drain所有revision，再啟動migration job；是必須事先審閱維護窗與影響的停機gate，不可當零停機UI發布。實作前產出release recovery runbook與值班owner：區分drain前、drain後但migration未開始、migration已開始/結果未知三階段；後者workflow禁止舊binary rollback，只能相容forward-fix。每個mutation gate需另行明確授權；本輪不批准維護窗或資料庫操作。
7. Gateway deny成功後，以該revision作為後續rollback最低基準；Operations失敗時Gateway deny保持不變。回復舊UI也不得把Gateway一併回到舊allow版；若後續Gateway rollback候選缺deny，先依runbook準備帶deny的已審查相容artifact/forward-fix與測試，不執行該回退。撤回安全退役本身須獨立審查與明確授權。
8. 每repo成功merge/release/smoke後，只清理本任務建立且已乾淨、commit已在origin/main的temporary worktree/local branch；有失敗或未完成工作時保留。primary main只有乾淨時才 `git pull --ff-only`。

## 計劃審查紀錄

審查報告：[2026-10-17-plan-review.md](../../reviews/account-profile-layout/2026-10-17-plan-review.md)。兩輪各兩位Codex＋一位Gemini均已完成；修正詳見報告。Codex boundary兩項P2已由原reviewer定向複核；Gemini條件式發現由主代理查證並補入本文，未再做一輪Gemini全文覆核。使用者已於2026-10-17授權實作；實作與驗證紀錄見 [implementation review](../../reviews/account-profile-layout/2026-10-17-implementation-review.md)，不代表生產發布已完成。
