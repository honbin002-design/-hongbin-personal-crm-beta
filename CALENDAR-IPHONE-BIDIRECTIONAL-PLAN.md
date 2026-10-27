# 鴻繽科技 CRM × iPhone 原生行事曆｜雙向同步施工計畫（2026-10-27）

## 現況與不能省略的限制

- 正式 CRM 是 GitHub Pages 靜態網頁，待辦存在**該 iPhone Safari/PWA 的 localStorage**，不是 Firebase 共用任務資料。不得因啟用同步而覆寫、清空、改寫既有報價、客戶、任務、記事、供應商進價。
- iOS Safari/PWA 沒有直接讀寫 Apple「行事曆」本機 EventKit 資料庫的權限。不能以 JavaScript 直接雙向操作 iCloud 行事曆。
- **零新增費用的可行路線**：專屬 Google Calendar（例如「鴻繽 CRM 待辦」）作中介。iPhone「設定 → App → 行事曆 → 行事曆帳號 → 加入帳號 → Google」，開啟行事曆同步。iPhone 原生行事曆必須將 CRM 待辦存到**該 Google 日曆**；若事件存在「iCloud／我的 iPhone」行事曆，不能自動當成 Google 日曆事件。
- Google Calendar API 需要 Google Cloud Console 開啟 Calendar API、OAuth 同意畫面、建立 Web OAuth Client ID、設定正式 GitHub Pages 來源。這需要帳號擁有者明確授權；**Client ID 可公開、Client Secret／refresh token／登入憑證不得寫入 GitHub Pages 或 localStorage**。
- 若使用者堅持只用 iCloud 行事曆、不新增 Google 日曆，需另行評估 iOS 捷徑配合人工觸發，不能假裝靜態網頁能直接雙向同步 iCloud。

## 同步資料與保護

- 對應欄位：CRM 待辦 `id/text/date/time/notes/customerName/done`，Google Calendar `eventId/summary/start/end/description/extendedProperties.private`。預設台南時區 `Asia/Taipei`。
- 只同步專用 Google 日曆，不讀取個人其他日曆；Google 授權僅於使用者明確按「連線／同步」時請求；短期 access token 只保留在記憶體。
- 一筆 CRM 待辦 ↔ 一筆 Google event；建立後保存對應 ID、雙方版本指紋。事件 `extendedProperties.private.honbinCrmTodoId` 用於偵測已存在連結，避免重複建立。
- 初次同步採「預覽差異 → 明確確認」；新 Google 事件可匯入 CRM，舊 CRM 待辦可建立 Google 事件。既有待辦不得直接變更 ID。
- 只有一方修改才可建議單向更新；雙方修改、對方刪除、對應遺失、時區不支援均標記衝突**不得自動覆寫**。
- **不自動刪除**任一端紀錄；Google event 的刪除不等於 CRM 待辦刪除；CRM 待辦不存在不代表要刪 Google event。
- Google 日曆不能原生承載 CRM 的完成狀態／客戶關聯等所有欄位；必須設計 private extendedProperties 或 metadata，同步前先確認。
- 不建立付費後端、不啟用計費，不影響既有 iPhone 系統推播；API 配額或授權失敗時應顯示錯誤，不可誤報已同步。

## 已施工（安全第一階段）

- `calendar-sync-core.mjs`：純函式、唯讀產生操作建議，無 Google API、Firebase、localStorage 或任何外部寫入。
- `tests/calendar-sync-core.mjs`：合成資料測試雙向修改、首次建立/匯入、重複事件映射、同時修改衝突、刪除保護、跨年日期、未填日期。
- `.github/workflows/r73-activate.yml`：納入 CI 驗證。此階段不要求使用者提供 Google 帳號密碼或存取憑證。
- 尚**未**連接真實 Google Calendar API、未建立 OAuth Client、未改動正式 CRM 待辦資料，也未宣稱已完成雙向同步。

## 2026-10-27 本輪實作交接（正式 CRM，無任何正式資料改寫）

1. `calendar-ics-export.mjs`、`calendar-ics-ui.mjs` 已加入待辦頁：單筆／當日／全部 `.ics`，穩定 UID、繁體中文 UTF-8 75-octet 折行、Asia/Taipei 時區、跨日／跨年、定時事件提前 15 分鐘提醒；只有本人點擊才分享/下載，無伺服器上傳、無改寫待辦。**這是單次匯入，不是兩邊自動同步**。
2. `calendar-google-sync-ui.mjs` 已接上可選的**手動按鈕型雙向比對／同步**：使用原有 Firebase Google 登入再驗證、只在記憶體保留短期 Google OAuth access token，必須指定名稱完全相同且可寫入的 `鴻繽 CRM 待辦` 專用 Google Calendar（非主要日曆／家族）；逐頁列舉事件，透過既有 `calendar-sync-core.mjs` 預覽 `CREATE_GOOGLE / IMPORT_TO_CRM / UPDATE_GOOGLE / UPDATE_CRM`，二方同時修改即衝突並停止、不提供 delete；明確確認後才逐筆寫入、保存對應 ID 及 fingerprint，Google 更新使用 If-Match。
3. `tests/calendar-ics-export.mjs` 覆蓋 UTC/Taipei 轉換、跨年、重複 UID、長中文字行折行與無效舊資料；`tests/calendar-google-sync-ui.mjs` 執行 OAuth 同身分、固定專用日曆、版本衝突、沒有 DELETE 與不持久化 token 的靜態安全 Gate。R73 WebKit 仍需最終 PASS。GitHub Pages 服務工作者 Cache 改 `hongbin-crm-r73-iphone-calendar-20261027`，避免 iPhone PWA 沿用舊檔。
4. 對正式 Google Calendar API **尚未進行本人 OAuth 同意／真實連線及寫入驗收**。ChatGPT Calendar connector 在目前登入帳號只見主要日曆與「家族」日曆，沒有此專用日曆；故正式 CRM UI 會 fail-safe 顯示「請先建立鴻繽 CRM 待辦」，不會把家族/個人事件匯入 CRM。帳號本人必須先在 Google Calendar 新增該日曆，並在 Firebase 對應 Google Cloud 專案啟用 Calendar API、確保 OAuth consent 已授予需要的 scope。Firebase Google reauthenticateWithPopup 的權限是否獲 Google 核准只能由本人在 iPhone 真正按連線驗收。
5. Apple iOS 原生「行事曆」本機 EventKit/iCloud 原生日曆並**不能**由 GitHub Pages PWA 直接讀寫；真正雙向路線是 iPhone 原生日曆連接 Google 帳號並讓事件儲存在此專用 Google 日曆，之後在 CRM 按「預覽／確認同步」。**無持續背景雙向同步，不能宣稱自動或實機 PASS**。
6. 為保護資料，在完成帳號授權與真機檢查前，原正式 CRM 之本機 `hongbin_personal_crm_v3`、報價、產品、進價、雲端記事任務與 Firebase Rules 均保持不變。沒啟用任何付費 API 或 Blaze，沒有上傳私人日曆事件到公開 GitHub。

## 後續施工 Gate

1. 確認 iPhone 原生行事曆可接受「Google 日曆」為 CRM 專用日曆（而非只同步 iCloud）；使用者仍可在原生行事曆檢視與編輯。
2. 由最高權限使用者在既有／新的 Google Cloud 專案啟用 Google Calendar API 並建立 OAuth Client ID，限定正式 GitHub Pages origin。不得公開 client secret。
3. 在正式 CRM 加入 opt-in「連接 Google 日曆／選擇專用日曆／預覽同步差異／確認同步」UI，只有登入並授權後執行；不影響現有備份還原。
4. 實作 Calendar API 的 list/get/insert/patch（不提供 delete）、重試與版本衝突、同步映射與安全 checkpoint；以 ETag/If-Match 避免覆寫遠端修改。
5. 測試單向/雙向/同時修改、離線重試、權限撤銷、時區、同名不同 ID、防重複、跨日/跨年、跨手機本機資料差異。最後由使用者 iPhone 原生行事曆實機 PASS 才標示完成。

**保護原則**：零新增費用；任何正式資料改寫須使用者在預覽後明確確認；原始待辦永不清空。

## 2026-10-27 11:19（臺北）｜舊視窗回收與安全修正 Checkpoint

- 已回收「工具_小工具集中區」舊視窗既有需求：正式 CRM 保留客戶／報價／進價／待辦／備份；Firebase `honbin-crm-notes-spark` 私人與共用記事、多人任務、延期審核、通知，先前 PASS 不重測。不擴充範圍、不切換 Work、不升級 Blaze 或新增付費項目。
- 正式原始碼安全修正 commit `cecbdbce7dede49dfc45526e87684a4a38de854e`，僅四個檔案：`calendar-sync-core.mjs`、`calendar-google-sync-ui.mjs`、及各自對應的合成測試。已修：拒絕 2 月 30 日等不存在日期、拒絕不合法時間變成全天事件、新裝置沒有 `todos` 鍵時仍能安全匯入、CRM 客戶欄位不隨 Google 回寫重複附加備註、重新授權必須使先前預覽失效。
- 該修正 GitHub Actions：R73 release checks run `40443238294` **success**，包含 JavaScript/日曆雙向核心/ICS/Google 連線安全/供應商進價安全/正式 R73 WebKit 與報價字型布局回歸；Pages run `40443237911` **success**。這是程式及自動化測試通過，**不是** Google OAuth 與 iPhone 真實行事曆資料交換 PASS。
- 正式推播公開設定於此日讀回為 `SPARK_LIVE_FREE`、`subscriptionsEnabled=true`、`senderEnabled=true`；TEST repo `honbin002-design/honbin-crm-auth-test` cron sender 最近 2026-10-27 08:49 臺北 run `40428814331` **success**。舊視窗兩支 iPhone 收件／其中一支任務完成深層連結實機 PASS/FROZEN 保留；排程成功不代表三類新事件均已實機驗收。
- 透過現有 Google Calendar 連線 **唯讀**查到目前只有「主要日曆」及「家族」，沒有名稱完全一致的「鴻繽 CRM 待辦」專用日曆。程式因此維持 fail-closed，不同步至主日曆或家族日曆。Google Cloud Calendar API／OAuth 正式授權及 iPhone 原生日曆讀回未驗收；iOS Safari/PWA 不能直接讀寫 iCloud EventKit。
- 最後施工原則：保持本機 `hongbin_personal_crm_v3`、報價、進價及 Firebase 現有實際資料不動；使用者按「預覽→確認」前**零正式日曆資料寫入**；不得把 .ics 匯出稱為雙向同步、不得把 GitHub Pages 成功稱為 OAuth/iPhone 實機 PASS。接續工作僅限既有需求及必要缺陷修復。

## 2026-10-27 本視窗續作｜防重複、iPhone 授權、安全控制

- 接手時 SOURCE HEAD 為 `b162fa08fa5bccba212dc4e071bd87cc1d016689`，舊視窗成果完整保留、不擴充功能、不修改真實 CRM／Firestore／Google 行程。
- `1a75d319e22d0d4e374d084c8c50e573616a1eb5`：修正跨 iPhone 失去本機 Google link 映射時，遠端已有 `honbinCrmTodoId` 不得再 `CREATE_GOOGLE`；孤兒 CRM 標記事件不自動匯回；錯誤 owner 標記、同一遠端事件對應多筆本機、重複本機 ID 均阻擋。加入合成回歸測試。
- `76f744d1c9e93c93bad8023cfe8d5b3e8ce87bc1`：修正靜態安全測試舊 regex。首次 run `40443864797` 失敗的原因僅為 assert 對原始碼文字格式的過度指定；該 run 的雙向核心運作測試已 PASS，不可謊報首次 run PASS。修正後 run `40443937117` SUCCESS。
- `a6fb8ac63fc5afd8a14b211482a413fad9be6eeb`：Google OAuth 改先由第一個明確按鍵預載驗證 SDK，第二次本人按鍵才同步開啟 popup，減少 iOS WebKit 非使用者手勢造成的彈窗阻擋。重新預覽失敗時一律使舊預覽失效；每筆候選同步動作均須呈現，避免 25 筆以外隱藏。
- `0e5d75346dce81e4acb6c6928097ea6177120370`：只允許本人 `owner` 且非主要日曆、名稱完全吻合「鴻繽 CRM 待辦」的 Google 專用次要日曆；排除有 writer 權限但歸別人擁有的共用日曆，避免 CRM 註記意外外流。
- 以上都沒有對任何真實行事曆寫入；GitHub Pages 部署完成後仍須分別看 R73 WebKit CI，真實 Google Calendar API OAuth／iPhone 原生日曆實機仍**未 PASS**。
- Google Calendar 已連線帳號唯讀看見主要與「家族」，尚沒有名稱完全一致的專用「鴻繽 CRM 待辦」。這不是程式故障，實際 Calendar API 啟用、Google OAuth scope 同意與專用日曆建立尚待本人確認。不能為了「直接完成」自動寫入家族日曆或冒用 OAuth 同意。
- 後續只接續已存在的同步需求：檢查 `0e5d75346` CI／Pages readback；正式手機上點第一次「連線 Google 日曆」載入登入 SDK、第二次才同意授權；必須找到 owner 專用日曆才可「預覽／明確確認」，且不能刪除紀錄、不能宣稱自動背景同步。
