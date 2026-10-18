# Account profile、搜尋與小家管理調整規格

日期：2026-10-17（Asia/Taipei）。狀態：調查與計劃；未授權實作、merge 或 release。

## 目標與已確認需求

Account 以個人化、安全性、小家管理為主要入口；減少獨立設定頁，桌面與手機的 header 搜尋對齊官網，手機採官網底部導覽。官網與 Account 同時移除導覽選取底色的橫向移動效果，直接依目前路由呈現 selected。

1. Account 移除教會聲明列、彈窗、dismissal 呼叫與專用 layout；官網聲明完整保留。
2. 裝置整合成安全性最下方一張「裝置與登入狀態」card；目前裝置與其他裝置是卡內分節。
3. 移除通知獨立頁，在個人化既有 card 的語言／外觀之後新增 Email 通知 row，實際控制範圍仍為教會電子報。
4. 「個人資料請求」全版改名「資料請求」，五語同步，URL `/data-requests` 不變。
5. 搜尋同時涵蓋桌面與手機，置於 header，沿用官網使用的 shared `ExpandableSearchField`。
6. 小家原頁內會員搜尋框移除；封存單位篩選、封存／還原及專用邏輯從 Account 移除，這項能力只留 Admin console。
7. 小家桌面：麵包屑與會員／單位／通知三個業務按鈕同一 row；編輯入口保留於麵包屑側。手機：麵包屑／編輯一 row，業務按鈕第二 row。按鈕仍由原 server actions 決定，不強制所有人看到三顆。
8. 手機移除 sidebar Drawer 與漢堡按鈕，header 只留 logo 與搜尋；底部依序為個人化、安全性、小家管理、其他、avatar menu。無小家管理權限時隱藏該項，改為四等寬項。
9. 「其他」開啟 menu，資料請求為第一個可用項；資源申請依既有資格顯示。資料請求本身仍遵守功能開關。
10. 桌面保留 sidebar；footer 右欄在 main 下方，copyright 靠左並與左側法律連結同高。手機 copyright 與隱私權／條款合併至 footer。
11. Copyright 使用 `© 2026 哈利路亞家教會. All rights reserved.`。

## 搜尋與導覽的具體決策

- 僅 exact `/organizations/:unitId` 是會員清單搜尋；`/organizations` 與會員詳細頁屬一般功能搜尋。不新增跨小家搜尋 API。
- 會員搜尋沿用 unit scope、trim、250ms debounce、query 變更重設 page=1、limit=50、AbortController 與舊回應隔離；清空恢復完整清單。加入會員完整 Email 與負責人搜尋留在各自 dialog。
- 有效會員query在Enter/Escape/blur收合後保留，header搜尋區仍顯示可截斷字詞與「清除搜尋」按鈕；不能顯示已過濾清單卻把條件藏起來。背景清單refresh不禁用搜尋輸入，只有initial authorization/unit unavailable才禁用。
- 功能搜尋僅索引目前帳號可用的功能名稱／同義詞／分類，不索引會員資料或表單內容。提交後由既有 Dialog 顯示連結／空結果；不自造 live combobox。
- 功能結果點選後關閉Dialog並清query；正常關閉返回搜尋trigger，選取結果則以目的row為最終焦點。定位依location.key與render-ready條件觸發，同頁相同hash再次選取也須生效。
- 搜尋字詞只留記憶體；不寫 URL、local/session storage、analytics 或錯誤紀錄。切帳號、路由、語系清空；未完成有效授權／目前 unit 尚未可用時不得送會員查詢。
- 桌面搜尋展開避開 brand 與 avatar；手機展開取代 header 內容。沿用官網 767px 邊界，desktop >=768px；不直接採 shared field 舊的 960px overlay CSS。
- 真正頁面 Link 用 `aria-current="page"`。其他／avatar 是 Menu button，用 `aria-expanded` 表示展開；開 menu 不改目前頁面。`/data-requests`、`/resources/*` 對應其他區段 selected。
- 其他menu內部目的地用onAction對照固定map呼叫React Router navigate，不傳raw href造成重載。完全無可用項目時保留disabled其他trigger，附「目前沒有其他可用功能」的可存取說明，不開空menu。
- 移除兩站滑動 indicator、optimistic tab selection 與 double-RAF 延遲導航。保留 header/tab bar 上下捲動顯隱、search/menu/focus 時固定及 safe area/PWA 樣式。
- 手機 Account 改為 document scrolling 以匹配官網；桌面保留 viewport shell 與表格內捲。避免 topbar transform 後留下靜態佔位或雙重捲軸。
- 頁尾留白必須在最後card之後且計入可捲範圍；新版內容到footer建議desktop至少32px/mobile24px，與nav/safe-area預留分開計算。既有main雖有72px padding，受限grid內容溢出時已在synthetic probe重現實際0px留白，不能僅新增padding宣告當作修復。
- 手機取消fixed shell時同步檢查body/app/layout/content/main的height、min-height、grid與overflow；特別避免殘留100vh最小高度壓過100dvh。開關鍵盤／overlay、URL列與方向改變後仍需完整到達最後控制項及footer。

## 安全與相容性

- 「教會聲明」不同於法律同意：`/legal`、`/policy/acceptance`、註冊法律接受、資源法律 gate、analytics consent 全保留。
- `/devices` replace 至 `/security#devices`；`/notifications` replace 至 `/profile#email-notifications`。目的區段需真的捲入視野並能取得適當焦點，不能只加 hash。
- 裝置仍禁止從清單登出目前裝置；其他已登出裝置不顯示登出；操作有確認、單次 pending、失敗回饋，不樂觀宣稱已撤銷。
- 電子報四狀態：`subscribed`=on；`pending`=on 且明示「待確認」、可取消；`not_subscribed/unsubscribed`=off。不得把 pending 自動寫成 subscribed。loading/error 不顯示可操作的假 off；saving 禁重送、失敗保留已確認值。
- 小家授權仍由 Operations 實施；保留本人排除、分頁前排除、加入會員完整 Email 精確查詢、負責人自己的責任列唯讀與缺少 member ID 時 fail closed。
- 僅刪 UI 無法達成 admin-only。Operations managed archive/restore HTTP 退役為 404 tombstone；Gateway Account 路徑固定拒絕，Admin lifecycle 正向保留。不得藉由舊 idempotency receipt replay 執行。
- managed folder 僅回 active unit/children；直達 archived ID 回 404；舊 `includeArchived` bool 接受但 deprecated/ignored，不能改動 Admin 使用的共享參數。
- managed roots、member list/detail、candidates、responsibilities與mutation也不得藉已封存unit回傳資料／執行操作；以managed-only gate檢查，保留Admin的shared archived-read。所有共用managedActions建構處（folder/member view/加入會員等）archive/restore恆false。
- 保留 `ManagedActions.archive/restore` required wire fields，值恆為 false；OpenAPI 同步 deprecated + false 約束。刪除 managed 內部失去 callers 的封存業務實作，保留 Admin service、shared auth、歷史 audit/receipt 與資料。
- 不需 schema migration；不刪組織、會員、receipt、audit 或使用者偏好資料。

### 功能搜尋目的地

| 功能 | 固定目的地 |
| --- | --- |
| 頭像／暱稱 | `/profile#avatar`、`/profile#nickname` |
| 語言／外觀 | `/profile#language`、`/profile#appearance` |
| Email通知 | `/profile#email-notifications` |
| 密碼／第三方登入 | `/security#password`、`/security#linked-accounts` |
| MFA／裝置 | `/security#mfa`、`/security#devices` |

這九個row/card id形成明確白名單；目標可程式聚焦且有可存取名稱。會員資料、資料請求、小家與資源等獨立頁沿用實際頁面URL，不造不存在的hash。

## 最小架構與範圍

- 不新增通用導覽框架、搜尋 registry/context、依賴或微服務。現有 `ui@1.0.55` 的搜尋元件已有所需介面；不為搜尋升級整套 UI。
- `account-fe`：頁面重組、header 搜尋、手機導覽、footer、小家工具列與移除本地 managed lifecycle wrapper。
- `hhc-web`：只移除手機 tab indicator／延遲導航，保留官網其餘行為。
- `operations-api`：managed lifecycle 退役、active-only folder、兼容契約與 Admin 正向回歸。
- `api-gateway`：Account retired endpoints 拒絕與路由契約／測試。
- `frontend-platform`：只同步 Operations canonical OpenAPI copy、generated types 與相關契約測試；不抽 UI/navigation 新 export。
- `admin-fe`、`account-api` 僅作既有能力／行為驗證，不預設修改。SDK source 同步須完成；consumer 不使用新介面時，不為此強迫所有套件／consumer 升級。

## 查證基準

均為程式碼證據，不代表生產已部署或驗收。

| Repository | 檢查 ref |
| --- | --- |
| account-fe | `b66d6bcd401380ce3e141ed74c26c5815fbad111` |
| hhc-web | `b292c56eb8b5a2894fd1cab5e54a5d6b789fbc42` |
| frontend-platform | `9b34763d67eb301ba436b7bb4f506c14f4a48f2b` |
| operations-api | `c72bbba3a112e69a2cd285ad7906a361e087a359` |
| api-gateway | `a7393398c45b5c74bd217c1673c1998718cce67e` |
| admin-fe | `6b646ce9a4f5f3e4ee0db77d4518987a28482a60` |
| account-api | `c3dbb0c5ee7a1ae1b0ec2d2ee59e5e08fd7ff537` |

重新實作前須重新 fetch/rebase 最新 origin/main 並核對變動；dirty primary checkout 不可 pull 或重置。

## 完成判準

計劃階段：兩位 Codex agent 與一位 Gemini 獨立調查；寫下規格／計劃後，由另兩位 Codex agent 與另一位 Gemini session 審查；記錄發現、採納／不採納與剩餘風險。不自動進入實作。

實作階段：需求對應測試、repo required CI、受控 mock/測試環境 browser/API 驗收全部有證據；release 仍需另行授權，經 PR/merge/CI/CD 及 live smoke，不以本規格或 CI 綠燈代替生產驗收。
