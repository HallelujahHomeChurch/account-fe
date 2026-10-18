# Account profile 計劃調查與獨立審查

日期：2026-10-17（Asia/Taipei）。最初兩輪為只讀調查與文件產出，未實作、跑產品測試、開PR或部署；其後使用者追加的頁尾問題，主代理做了獨立synthetic browser probe，見文末補充。

## 席次與狀態

使用者先指定兩輪各兩位 agent，再明確追加兩輪各一位 Gemini；因此每輪三席，共六席。第二輪使用新的獨立上下文／Gemini conversation，不沿用第一輪答案作為結論。

| 輪次 | 席次 | Provider／任務 | 狀態 |
| --- | --- | --- | --- |
| 調查 | 1 | Codex `investigate_shell`：header/search/nav/footer/scroll | 完成 |
| 調查 | 2 | Codex `investigate_features`：設定整併／小家／API邊界 | 完成 |
| 調查 | 3 | Gemini：依需求與必要公開source摘錄獨立分析 | SUCCESS，exit 0 |
| 審查 | 1 | Codex `review_plan_ux`：需求涵蓋／UX／狀態契約 | 完成，無P1/P2 |
| 審查 | 2 | Codex `review_plan_boundaries`：安全／契約／交付 | 完成，兩項P2已修正並定向複核 |
| 審查 | 3 | Gemini：完整規格／計劃與必要source摘錄 | SUCCESS，exit0；條件式發現已查證／納入計劃 |

Gemini 使用已啟用的官方 `agy` CLI、`--mode plan --sandbox --output-format json --print-timeout 240s`；每席獨立task目錄，不掛專案/home為workspace、不提取credential、不改帳號/quota/API付費設定。只送必要公開source與本次文件，禁止工具／寫檔／委派。requested model為`gemini-4-argon-medium`；CLI JSON未回報實際model欄位，不能另行確認returned model。

第一輪Gemini conversation：`9780dd9f-6a93-4878-895f-52696ae1ba7e`；SUCCESS、exit0、duration57.05秒、num_turns1。第二輪：`afea77ed-61c5-4b22-ac56-7315a02c40e5`；SUCCESS、exit0、duration158.52秒、num_turns1。兩席均在五分鐘內回覆，stderr為空；CLI成功不代表其每個推論正確。

## 第一輪查證與整合決定

1. **重用即可，不抽新導航框架。** Account鎖定ui@1.0.55的controls已有closeLabel/onExpandedChange/IME保護。以`frontend-platform` tags直接比對source，不以本機過期node_modules推斷package能力。兩站仍各自管理router/權限。
2. **功能搜尋用提交後Dialog。** SearchField內部blur會collapse，且無children/ref/combobox API；外掛live dropdown可能點擊前卸載。單一Layout state與直接props即可，query不入URL或storage。
3. **手機scroll是實際整合風險。** Account `src/index.css:1626–1634` 是固定100dvh/內部overflow；官網hook預設window。手機改document scroll，desktop保留既有50rows低高度表格內捲。
4. **只刪UI不符合admin-only。** Operations `internal/httpapi/management_handlers.go:95–119` 仍有managed mutation；`management_repository.go:51,58` 的includeArchived只過濾children。Gateway `conf.d/api/account/75-unit-management.conf:45–55` 仍放行。需同步tombstone/active-only/固定deny，Admin通用lifecycle與共享authorization保留。
5. **保留wire相容，但誠實同步契約。** required archive/restore先恆false；managed bool參數deprecated/ignored，不改Admin共享IncludeArchived。OpenAPI canonical/copy/generated同步，但不因此強迫UI package升級；registry發布另記gate。
6. **設定頁搬移不是刪行為。** 裝置確認/目前裝置限制、newsletter四狀態與retry、法律接受/reauth等仍需保留；StatementStrip是Account唯一hhc-web-client使用點，preferences則仍有用途。

Gemini同意需要處理API封存、搜尋scope、舊連結、4/5項導覽與scroll/footer。其建議的`?q=`或Context、`mobileBehavior="header-overlay"`未採用：前者會擴大state/留下敏感查詢歷史，後者使用舊960px規則，與官網767px不一致。其Admin路由共用性疑問已由Codex查證獨立`/api/admin/operations/...`；不以顧問多數票代替source。

## 第二輪發現與處置

### Codex UX reviewer

結論：無可確證P1/P2。確認Tasks1–3/7已涵蓋desktop/mobile search、unit/owner scope、IME/Dialog、其他selected與expanded分離、hash焦點、4/5項、低高度/長表格、newsletter/devices/legal。這是計劃審查，未宣稱實機或測試已通過。

### Codex boundary reviewer

| 發現 | 證據 | 修正與複核 |
| --- | --- | --- |
| P2：首次Gateway deny失敗可能auto rollback到allow版，原計劃的「保持deny」不成立 | Gateway `.github/workflows/release.yml:301–318`、`scripts/rollback-gateway-release.sh:12–24` | Task8.3明訂首次失敗=退役未成立、停止後續發布；成功後Task8.7以deny revision作回退最低基準。原reviewer定向複核：addressed。 |
| P2：Operations即使無新migration仍停服drain，原計劃未列維護窗/不可回退gate | Operations `.github/workflows/release.yml:181–229,276–286` | Task8.6加入維護窗/impact/owner/runbook、三階段、migration started/unknown只forward-fix。原reviewer定向複核：addressed。 |

另補Task4的disposable PostgreSQL17與`HHW_TEST_DATABASE_URL`，要求確認integration真的執行而非skip；來源`internal/postgres/membership_repository_integration_test.go:1044–1046`。reviewer確認現有Account boolean validator接受required false，Admin共享IncludeArchived要保留。

### 主代理自查

- 現有Menu/AccountMenu不提供onOpenChange，Task3改明確沿用官網`:has([aria-expanded="true"])`／focus CSS鎖定chrome，不憑空要求shared callback。
- availability callback必須捕捉owner/scope，不能只比unitId，避免不同帳號管理同unit時舊回報覆蓋。
- 補header76px/68px與767px邊界；其他menu完全無項時保留disabled slot及可存取說明。
- 文件task數8，所有實作步驟均未勾選；無程式修改。最終文件與連結檢查在交付前執行。

### Gemini reviewer

結論為「有條件通過」，原列兩項P1、三項P2。主代理按來源區分可確證缺口與推測，處理如下：

| 發現 | 查證／採納 |
| --- | --- |
| 原P1：會員搜尋收合隱藏有效query；Dialog焦點衝突 | shared Search確實無條件collapse，補spec及Task2的header有效query摘要＋clear，保留filter，不在blur清空；背景query refresh不禁用field。Dialog最終焦點衝突未經runtime證實，降為需驗證風險；Task1/2補結果選取與普通dismiss分流、portal關閉後聚焦，禁止假設不存在的restore API。 |
| 原P1：Menu/AccountMenu沒有onOpenChange，Portal使focusWithin不足 | 介面缺少callback是事實；本次Gemini讀取原始草稿，主代理先前已補Task3的`:has([aria-expanded=true])`＋focus CSS方案，不需新增MutationObserver或改shared UI。搜尋仍用onExpandedChange。 |
| P2：其餘設定row的hash未明列、同頁同hash重選失效 | 採納。spec列九個明確id，Task1/2用location.key/render-ready＋結果清query，加入同頁重選／最終focus測試。 |
| P2：共用ManagedActions不只folder有，archived member子路徑可能仍可讀 | 查證`operations-api/internal/membership/service.go:157,210,470–493`確為共同建構；Task4明列所有managed子路徑active gate與共同managedActions=false，不只覆寫folder，保留Admin共享分支。測試涵蓋folder/member/加入會員回應。 |
| P2：Menu raw href可能全頁重載，空menu方式不確定 | Task3明定onAction→固定path map→React Router navigate，且完全空時是disabled trigger、無Menu。後者在Gemini執行期間已由主代理自查釘住。 |

未再啟動Gemini全文覆核；以上修正由主代理對照授權source查證與文件自查。不得寫成「三席一致無問題」或「實作已通過」。

## 剩餘驗證與權限

- 原始碼證據不代表生產狀態；前述六席未查live readiness/revision，也未執行CI/browser/API或實機驗收。追加synthetic probe不構成產品／生產驗收。
- iPhone/PWA safe area、軟鍵盤、焦點與桌面低高度表格需依Task7驗收；發布runbook/forward-fix artifact需在實作交付時實際驗證。
- 未建立實作worktree或分支；僅在account-fe新增本次規格、計劃與報告，未commit。其他repo既有dirty文件/worktree維持原狀。
- 實作、維護窗、merge、package tag、release、生產smoke與任何資料mutation均不由本文件授權。

交付文件：[規格](../../superpowers/specs/2026-10-17-account-profile-layout-design.md)、[實作計劃](../../superpowers/plans/2026-10-17-account-profile-layout.md)。

## 追加：頁尾留白與手機可捲範圍

使用者提供已滑到底的截圖後，主代理以相同source CSS＋假資料DOM在Chromium量測：1440×820及390×780兩種layout均重現computed padding-bottom=72px、card實際到底距離0px；只改main對齊條件就得到實際72px，確認grid overflow會讓外留白失效。另以受控min-height模型證明viewport下限較大時可出現inner已到底但底緣超出可視範圍，尚未在使用者手機重現。

已補spec與Tasks3/7的intrinsic sizing、height/min-height完整清理、內容/footer/nav間隔分工、visual viewport/overlay/鍵盤及最後控制項可見可點驗收。[完整補充分析](2026-10-17-scroll-bottom-analysis.md)。此增補沒有再經六席覆核；不把它寫成原顧問已通過的結論。
