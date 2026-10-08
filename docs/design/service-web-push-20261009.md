# 服事表 Web Push 設計

狀態：使用者已審閱後指示「繼續到完成」，依此設計持續實作與驗證。
本文件是設計，不代表程式或正式派送已完成。

## 目的與範圍

手機上架前，已登入會員可以在 Account 的服事提醒設定開啟本瀏覽器通知，
接收排定提醒與服事異動；點擊後進入服事詳情，必要時先登入。
網頁排班管理仍僅位於 Admin Console。沿用共用 UI、Operations 服事事件、
Notification 持久化佇列、重試和既有 Web Push provider。

不新增通知微服務，不訂閱週報，不擴大官網匿名訂閱路由的存取權限。
Account 與官網是不同 origin，不能直接共用 PushSubscription 或 Service Worker。

## 使用者體驗

- 服事提醒設定新增「此瀏覽器通知」，與跨裝置的提醒時間設定分開。
- 僅由使用者點擊開啟時要求系統通知權限；進頁不跳授權視窗。
- 啟用成功必須同時完成瀏覽器訂閱與後端登記；部分失敗提供重試，不顯示成功。
- 已拒絕顯示前往瀏覽器設定的短提示，不反覆要求權限。
- 不支援時顯示不可用原因。iOS/iPadOS 尚未加入主畫面時提供簡短安裝指引。
- 關閉此瀏覽器通知會撤銷本 installation；不修改其他裝置與週報訂閱。
- 使用既有 light/dark 與共用 Button/Switch，無額外 onboarding 或全頁說明。
- 通知鎖定畫面只顯示通用服事訊息，無姓名、團契、班次時間或其他會員資料。

## Operations 契約與儲存

擴充現有 ServiceInstallation，沿用 id、持有者 secret、加密儲存、版本與撤銷機制。
新增 platform=web 與結構化 subscription(endpoint、keys.p256dh、keys.auth)；
保留原有 iOS/Android token 契約，禁止同時提交 native token 與 web subscription。
以 additive migration 放寬 platform CHECK，不改寫既有 migration。

入口嚴格限制長度、HTTPS、標準 P-256/auth key 編碼與允許的推播 provider 主機；
禁止 userinfo、自訂 port、fragment、任意 host 與重新導向，避免 SSRF。
訂閱 canonical JSON 加密保存；hash 必須對同一 canonical representation 計算，
使 Notification 正規化後仍能通過 eligibility，避免內容順序導致全部抑制。
endpoint 的唯一性與 ownership 判定不得因 key 更新而產生多個有效 owner。

沿用目前 recipient、installation version、assignment version、preference version
的派送列及 idempotency key。web 派送改用 operations.web-push template；
手機繼續用 operations.native-push。派送前再次檢查會員資格、目前收件者、
是否發布、是否取消、代班狀態、提醒設定與過期時間。

新增受保護的服事 push config 讀取，僅提供 enabled 與 VAPID public key；
配置必須對應 Notification worker 的既有 VAPID key pair。不得將 private key
或推播 endpoint 暴露於回應、log 或 analytics。
OpenAPI、contract tests、frontend-platform SDK 同一批更新。

## Notification 派送

新增僅允許 operations-api 的 operations.web-push template，payload 只接收
assignmentId、deliveryId。服務端生成通用文字與 Account 的受控詳情連結，
不接受任意 URL 或排班文字。

沿用既有 Web Push provider 與持久化通知佇列；在此 template 的派送路徑上
重用 Operations eligibility 檢查。舊 engagement.web-push 行為保持一致。
Web Push TTL 限制於本次 delivery 剩餘有效秒數；不能沿用固定 24 小時，
以免收到已失效的服事提醒。

供應商成功或 404/410 後，先持久化派送結果，再向 Operations 回報。
回報失敗只能重試回報，不能再呼叫 provider。404/410 撤銷對應 installation
版本；429/5xx 沿用通知重試，每次送出前重新檢查 eligibility。
provider 接受不代表使用者已看到通知；UI 與驗收紀錄分開呈現。
不承諾 exactly-once：provider 已接受但本地結果尚未持久化時仍有重送窗口。

## Account 與工作階段

Account 增加最小 manifest、既有品牌 icon 與 push-only Service Worker；
不快取 API、OAuth 回應、個人服事表或 Account HTML，不加入離線帳號功能。
notificationclick 僅接受同 origin 的服事詳情路徑，否則回到 /service。
沿用登入後返回目的頁的流程，未登入不讀取服事資料。

本機 installation secret 僅用於訂閱持有證明，不作為會員授權替代品。
開啟時必須以目前登入帳號完成後端綁定；不因換帳號自動把舊訂閱綁給新帳號。
登出先撤銷本瀏覽器訂閱並嘗試同步後端，失敗不得阻止帳號安全登出；
保留最小待撤銷狀態供後續重試，不保留 access/refresh token。
多分頁登入/登出與 subscribe/revoke 必須協調，避免舊請求覆寫新帳號狀態。
取消通知時先後端撤銷再 unsubscribe；任一步失敗保留可重試狀態。

## 修改範圍

| Repo | 必要修改 |
| --- | --- |
| account-fe | 設定控制、installation lifecycle、登出接線、SW/manifest、五語文案、測試 |
| operations-api | web installation 驗證/加密、migration、dispatch/config、OpenAPI、整合測試 |
| notification-api | template、資格確認、TTL、durable result callback、provider/queue 回歸測試 |
| frontend-platform | canonical OpenAPI 與 SDK；正式套件出版後替換 preview pin |
| api-gateway | 新 config route 的精確 host/method/auth policy 與 OpenAPI |
| azure-infra / release config | 預設關閉的 service runtime flags、公鑰來源與既有加密 key reference |

所有修改留在隔離 worktree 與任務分支。production secret value 不讀出、不寫入 repo。
Web/native 啟用開關獨立，網頁推播不能要求先啟用尚未上架的手機推播。

## 驗收與交付界線

1. 契約：native 相容；web key/host/大小驗證；匿名、跨會員與錯誤持有者拒絕。
2. 真實 PostgreSQL：登記重試、撤銷、換帳號、版本變更、取消、換人、停用提醒、
   到期抑制；canonical hash 一致性；不產生重複 delivery。
3. 通知 worker：成功、410、429/5xx、callback 故障恢復、TTL、派送前資格失效；
   原 Email/官網 Web Push/native 測試維持通過。
4. Account：權限拒絕、不支援、訂閱部分失敗、取消重試、登出、帳號切換、
   多分頁競態、通知安全連結与登入返回；三種寬度與 light/dark。
5. 各 repo 必要 test/lint/build/contract/CI；infra fmt/validate 與可審閱 plan。
6. 明確分開本機模擬 provider、真實 HTTP/DB、CI、正式 release、真機實際接收。
   外部真實推播只發到經指定授權的測試帳號/裝置，不對全體會員送測試通知。

此階段不 merge、不 apply、不啟用正式通知。正式啟用前需確認套件版本、
producer-before-consumer release 順序、VAPID 公私鑰一致、HTTPS/SW MIME/cache headers
與已發布 revision；cloud mutation 先提供 reviewed preview。

## 平台依據

- Apple/WebKit：iOS/iPadOS Web Push 需 Home Screen web app，授權來自直接互動：
  https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- PushManager.subscribe 必須由使用者操作觸發：
  https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
