# 鴻繽科技 CRM｜Google Apps Script 雙模式同步記事｜隔離驗證交接

狀態：**CLOSED-ACCESS GAS SOURCE PACKAGE READY / LIVE GOOGLE HOLD**（2026-10-19）
此分支不包含任何正式 CRM、ERP、客戶、報價、舊隨手記或實際 Google 使用者資料。
正式 `main` / R73 的八個既有功能不在本階段修改範圍。

## 使用者操作限制
- 不要求使用者操作 Apps Script 編輯器、GitHub Codespaces、Terminal、貼指令碼或手動部署。
- 不使用 Work 模式或其額度。
- 如無法在正式授權下全自動完成，不得宣稱部署成功。
- 使用者可能仍需確認 Google 官方要求的登入與 OAuth 同意；禁止索取 Token、密碼或私密金鑰。
- 舊 `tools/gas/authorize_once.sh` 已停用，不能再請使用者執行。

## 已執行之證據（僅模擬資料，非 Google 實測）
- `gas-sync-probe/note-rules.cjs`：隔離的權限規則原型，測試使用受信任的伺服器身分回呼；這不是已部署服務。
- `gas-sync-probe/note-rules.test.cjs`：20 項模擬身分及權限案例已在本次對話以 JavaScript 執行，全部 PASS。
- `gas-sync-probe/event-service.cjs`：事件追加式記事及群組服務原型，具備版本比對、冪等操作識別碼、刪除墓碑紀錄及後端角色檢查。
- `gas-sync-probe/sheets-adapter.cjs`：Apps Script SpreadsheetApp + LockService 儲存介面原型；未連接真實試算表。
- `gas-sync-probe/signed-boundary.cjs`：雙層 Apps Script 間後端簽章、時效及授權請求檢查的程式原型；實際共享密鑰與 Google OAuth 未設定。
- `gas-sync-probe/nonce-registry.cjs`：後端 Sheets 防重放記錄原型；未連接真實 Sheets。
- `gas-sync-probe/offline-outbox.cjs`：iPhone 本機待同步草稿、重試、衝突保護及舊記事預覽原型；**未接入 CRM**。
- `.github/workflows/gas-notes-offline-tests.yml`：現在包含六組 Node 測試；單純存在 workflow **不等於**已有 GitHub Actions 成功證據。
- 已在對話中使用合成資料執行共 **90 個**離線檢查案例：權限 20、事件服務 18、Sheets 12、簽章 16、Nonce 12、待送草稿 12。簽章 16 項在本地測試協調器中使用模擬 HMAC；GitHub workflow 已設定用真正的 Node.js HMAC 執行，但其 Actions 最終狀態仍待核實。
- 以上皆為**程式原型和模擬資料測試**，不代表 Apps Script 真實部署及雲端安全完成。
- 先前 GitHub readiness workflow：API 網路可達、`clasp` 可執行；`CLASPRC_JSON` / `CLASP_JSON` 均為 MISSING；尚未部署 Google Script。
- `script.google.com/home/usersettings`：使用者畫面已確認 Apps Script API 設定顯示「開啟」；與實際 OAuth 憑證、服務建立是不同的驗證項目。

## 下一階段必要安全架構
1. **前端不得傳入可信身分**：由受 Google 授權且以使用者身分執行的 Apps Script A 在伺服器端辨識使用者；`Session.getActiveUser().getEmail()` 若為空，一律拒絕。
2. **中央工作表不得公開給一般成員**：以 App Script B（資料持有人權限）持有並存取隔離的 Google Sheets；A 到 B 使用伺服器間短期簽章請求，B 驗證簽章、過期時間、單次 nonce，及各次業務授權。**此層已有簽章與防重放原型，但尚未建立真正的 Apps Script 雙層服務、Google OAuth 及跨帳號驗證。**
3. **最小資料權限**：PRIVATE 只允許 owner；SHARED 每次由後端確認有效成員及角色；角色撤銷後後續查詢和寫入都拒絕。用戶端隱藏按鈕不可作為防護。
4. **同時編輯**：所有修改都需要 articleId、expectedVersion，並且在同一個 `LockService` 鎖內完成版本檢查及 Sheets 寫入；衝突回傳錯誤，不得覆蓋。**事件持久化與鎖定的程式原型已完成離線模擬，真實 Google Sheets 持久化和同時寫入尚未實測**。
5. **離線**：瀏覽器本機待送草稿須和已同步狀態區分，不能假裝儲存成功；重新連線先比對版本，衝突需人為選擇處理。
6. **舊記事**：`hongbin_crm_quick_notes_r73` 保持不變；新雲端資料不得自動接管或上傳；只允許驗證身分後、展示預覽與筆數、得到同意再依穩定 ID 匯入私人區並防重。既有 CRM 備份格式不動。
7. **URL 與裝置驗收**：先在隔離 Google 網頁驗證兩個真實 Google 帳號及不同 iPhone Safari，再考慮 CRM 唯一最小入口；測試未通過不得部署至正式 `main`。

## 狀態
| 項目 | 狀態 |
| --- | --- |
| 目前 CRM 原始碼／正式資料不變 | PASS（GitHub 最新 blob readback） |
| 合成身分／私人資料隔離規則 | UNIT PASS |
| 共用記事 ADMIN/EDITOR/VIEWER 規則 | UNIT PASS |
| 撤銷與版本衝突的規則 | UNIT PASS |
| Google 線上使用者身分／跨帳號 | NOT TESTED；不可將偽造角色測試當真人授權證據 |
| Google Sheets 儲存介面、A-B 簽章、Nonce 與鎖 | CODE PROTOTYPE + OFFLINE UNIT PASS；LIVE NOT TESTED |
| 自動建立／部署 GAS 實證 | BLOCKED（無安全授權途徑） |
| iPhone 離線待送／重試 | CODE PROTOTYPE + OFFLINE UNIT PASS；未接入 CRM |
| iPhone 真機同步與離線驗收 | NOT TESTED |
| 正式 CRM 雙模式同步記事 | HOLD |

## 此階段不能跨越的 Gate
- 必須證明能透過已授權的 AI 工具安全建立／部署 Apps Script，**不得要求使用者操作 Script、Codespaces、Terminal、貼上程式碼、提交 OAuth Token**。
- Script A 須在 Google 真實身分環境取得經 Google 驗證且非空的使用者識別；Script B 必須有可保護的持久化密鑰、獨立的中央工作表及禁止未簽章請求的公開端點。
- 需實際用兩個不同 Google 帳號／iPhone，測試本人與他人私密隔離、共用角色及撤銷權限。
- 離線草稿、本機舊記事匯入必須獨立經使用者同意；原 `hongbin_crm_quick_notes_r73` key 和原備份功能不得改動。
- Google Apps Script 及 Google Sheets 尚未產生正式／測試可用部署，因此正式 CRM 完全不接線。

不得將 UNIT PASS、GitHub workflow 綠勾或官方 API 文件誤報為已部署、可真正跨手機同步。

## 2026-10-19 14:21 後｜Apps Script 原始碼包進度（仍未部署）

- `entry-user.gs.js`：使用者端模板；由後端的 `Session.getActiveUser().getEmail()` 判定身分，取得空值即拒絕。沒有接受瀏覽器自行傳入的可信 actor。
- `entry-data.gs.js`：資料端模板；以簽章、期限、nonce、角色及版本閘門處理請求。服務內部持有 Google Sheets 連線權限，不直接分享原始工作表。
- `Index.html`：繁體中文、iPhone 友善的唯讀測試頁，將 PRIVATE／SHARED 分開，使用 `textContent` 避免記事 HTML 注入。
- `build-bundles.cjs`：建立兩個獨立的 `Code.gs` + `appsscript.json` 程式包，編譯無需 OAuth 憑證，也不執行部署。
- **預設封閉**：使用者端與資料端 Manifest 均預設 `MYSELF`。未完成實際 Google 帳號及簽章測試之前，不開放資料端匿名存取，也不整合正式 CRM。
- **新增 24 項離線驗證**：打包／安全預設 12、合成使用者 A→簽章→資料端 B→模擬 Sheets 整合 12。均在本次對話的隔離 JavaScript 協調器執行通過，其中簽章以**模擬加密函式**測試傳輸邏輯；GitHub Actions 已加入使用真實 Node.js crypto 的測試命令，尚未取得該次工作流程 PASS 證據。
- **累計 114 項離線測試**（先前 90＋新增 24）；不是 Google 真實登入、Apps Script 線上部署或跨 iPhone 真實同步的 PASS。
- GitHub Actions 新增 `build-bundles.test.cjs` 與 `bundle-runtime.test.cjs`，但目前只有工作流程設定回讀證據，沒有這次新版 CI 執行的實際狀態。
- 真正的 Google Apps Script OAuth／部署執行能力仍 **BLOCKED**。不得改用 Work、要求使用者操作 Codespaces／Terminal／Script、提供 Token，也不得因無法部署就偷偷將正式 CRM 改成其他方案。

## 2026-10-19｜進一步安全審查、資料遺失修正與部署權限 Gate

### 已完成原型修正（仍是離線驗證）
- `offline-outbox.cjs`：修正非同步上傳完成時可能覆寫同時新增的待送草稿，以及同一操作重複觸發兩次網路傳送。既有離線 12 項仍 PASS；新增 `offline-race.test.cjs` 2 項 PASS。
- `entry-user.gs.js` / `entry-data.gs.js`：都加入 `HONBIN_NOTES_TEST_GATE=ISOLATED_TEST_APPROVED` 明確啟用檢查；未設定一律拒絕同步請求，避免未驗證部署意外開始處理資料。使用者端／資料端新增 2 項整合測試 PASS。
- `legacy-import.cjs`：舊記事一律先預覽，明確同意前不產生匯入操作；SHA256 確定性作業 ID 用於後端冪等，避免重複匯入，並拒絕舊記事 ID 重複及不符合格式的資料；新增 `legacy-import.test.cjs` 12 項 PASS。此段**尚未接上實際 CRM localStorage 或 Google 雲端**。
- 此輪新增 16 項模擬檢查，累計 **130 項離線測試**（前輪 114 + 同步競態 2 + 未啟用安全閘 2 + 舊記事 12）。其中涉及 HMAC / SHA256 的本地測試協調器使用模擬加密函式，GitHub CI 程式使用真正 Node `crypto`；**最新 CI 成功狀態尚未取得證據**。
- `.github/workflows/gas-notes-offline-tests.yml` 已納入 10 組自動回歸測試；沒有憑證操作與任何部署指令。

### 確認的跨帳號部署限制
Google 官方清單文件：`https://developers.google.com/apps-script/manifest/web-app-api-executable?hl=zh-tw`
- `webapp.access=MYSELF` 意味著**只有部署者能進入該 Web App**。目前 Script A 與 B 都以 MYSELF 打包，故**現有程式包絕對不能宣稱支援兩個不同 Google 帳號的共用記事**。
- 若 Script A 將來要有不同 Google 帳號使用，必須先驗證 `access=ANYONE`（要求登入）及 `executeAs=USER_ACCESSING` 在實際帳號下能取得可信且非空的 email。
- Script B（資料擁有者）仍為 MYSELF 時，Script A 對 Script B 的 `UrlFetchApp.fetch()` 是否有合格的伺服器間授權必須**實測**；目前**沒有證據表明 MYSELF 可以在另一使用者身分的 URLFetch 呼叫中成功執行**。
- 若改成匿名可連線的 B，則產生公開端點與用量濫用風險；雖有 HMAC 模型，**未實測前不得自動放寬到 ANYONE_ANONYMOUS**，也不得把原始 Google Sheets 分享給所有成員。
- OAuth 部署工具仍缺安全授權；使用者已明確不接受 Codespaces、終端機、貼 Script、手動部署。堅持無 Work、既有 CRM main 保持不變。

## 2026-10-19｜帳號切換與共用群組易用性

- **問題修正：** iPhone 同一瀏覽器可能登入不同 Google 帳號。原型的離線待送功能若共用儲存區，A 帳號的私人草稿可能由 B 帳號錯誤上傳。
- `account-scoped-outbox.cjs`：每個**曾經受 Google Session 驗證**的帳號使用不同的本機佇列儲存分區。重新登入另一帳號時拒絕讀取或上傳原帳號待送資料；原草稿保留，原帳號重新登入後可恢復。
- `entry-user.gs.js`：所有 CREATE/UPDATE/DELETE 記事及群組管理寫入必須附帶 `__expectedGoogleAccount`，由伺服器再次與真正的 `Session.getActiveUser().getEmail()` 比較；不一致就拒絕，不採信瀏覽器聲稱的 actor。此欄位比對後從簽章資料移除。
- `gasWhoAmI()`：獨立的伺服器端登入帳號查詢，不含任何 OAuth Token。此方法仍需要 Google Session 真實環境驗證。
- `event-service.cjs` / `signed-boundary.cjs`：新增 `LIST_GROUPS` 後端權限操作，只回傳本人具有效成員身分的群組名稱、群組識別碼與角色，撤銷後不再返回該群組。
- `Index.html`：使用群組下拉選單代替手動輸入群組 ID，並顯示已驗證的 Google 帳號；仍是獨立、唯讀的 iPhone 測試畫面，沒有接入正式 CRM。
- **新增 22 項離線測試**：帳號隔離 12、已授權共用群組選擇 8、跨帳號寫入端到端補充 2，分別為 12、8、2 項。
- 上一輪累計 130 項，本輪新增 **22 項**，合計 **152 項隔離模擬測試**（部分 SHA256/HMAC 在本地協調器使用模擬函式；GitHub Actions 對應測試使用 Node `crypto`，最新工作流程結果尚未透過 CI 日誌驗證）。
- GitHub 工作流程已包含 **12 組**回歸測試；它不執行 Google OAuth、Apps Script 部署或變更正式 CRM。

### 阻礙仍然存在
- `MYSELF` Web App 仍僅供部署者。A→B 使用 `UrlFetchApp` 觸及 B 的 `MYSELF` 私人部署，跨不同 Google 帳號**尚無成功依據**，應視為架構性 BLOCKER；不能靠原型 PASS 宣告多手機同步。
- 無 Google Apps Script API OAuth 自動部署授權，使用者不接受工程手動操作，必須維持 HOLD。
- 舊 R73 `hongbin_crm_quick_notes_r73`、ERP 資料及正式 CRM `main` 均不接線、不轉移、不修改。

## 2026-10-19｜真實 Google Sheets 私人測試工作表與部署 Readback Gate

- 已透過現有已連線的**公司 Google Drive**帳號直接建立一份全新的原生 Google Sheets 測試檔，**沒有使用 Work 模式、Codespaces、Terminal 或使用者手動操作**。
- 建立並回讀 `Events`（11 個欄位）與 `UsedNonces`（2 個欄位），精確符合 `sheets-adapter.cjs`、`nonce-registry.cjs` 原型所需標頭；時間區設為 `Asia/Taipei`。
- 已實際呼叫 Google Sheets API，寫入**完全虛構**的記事事件與 nonce，讀回內容和欄位完整一致，最後將兩筆合成資料清除，第二次回讀確定兩個分頁都**只剩標題列**。
- Google Drive 權限 Readback 顯示 `shared=false`，只有公司帳號擁有者（owner），**沒有其他人權限，也沒有建立公開連結**。
- **刻意不在公開 GitHub 程式碼或本文件放入 Google Sheet 檔案 ID**。此實際試算表的 ID 留在本次操作歷史，可在已連線的公司帳號查找；未來真正部署時必須由私密 Script Properties 配置。
- 這個成果是 **LIVE GOOGLE SHEETS CREATE / WRITE / READ / CLEANUP PASS**，**不代表** Apps Script 已成功存取此表，也不代表 Google 帳號同步通過。
- Google 官方文件明示 Google Apps Script 部署實際授權包含 `entryPoints[].webApp.entryPointConfig.access` 與 `executeAs`，以 Google `projects.deployments.get` 回傳才算部署 Readback 證據。CLASP upstream issue `google/clasp#1115` 指出 `clasp deploy` 不能理所當然地視為已套用 manifest 網頁存取權限。
- 新增 `deployment-readback.cjs` 與 `deployment-readback.test.cjs`，12 項合成部署回讀檢查已離線 PASS：只接受 MYSELF 封閉測試權限、正確的 USER_ACCESSING／USER_DEPLOYING 執行者與兩個不同的部署 ID；任何公開／匿名權限、未知設定或錯誤身分一律拒絕。**真正部署 API 回讀尚未取得。**
- 前輪 **152 項**離線測試，加上本輪 12 項，共 **164 項離線測試**；另有 **1 次真實 Google Sheets 獨立讀寫＋清理驗證 PASS**，不把它冒充 Apps Script 身分／共用驗收。
- GitHub Actions 已納入 **13 組**Node 自動回歸測試；之後以 commit status `gas-sync-probe/node-regression: success` 完成**實際 Node CI PASS** 驗證。

### 保持 HOLD 的項目
- Script API 的 Google OAuth 私密授權及自動化部署；不得索取使用者密碼／Token，不得要求使用者自己寫 Script 或操作終端機。
- 目前 Script A、B 的 `MYSELF` 封閉存取**不支援跨帳號共用**。未經真實 A→B 存取與身分驗證前不得提升公開權限。
- 兩支不同 iPhone／不同 Google 帳號的私人隔離、角色／撤銷與同步驗收；**沒有實際 PASS**。
- 正式 CRM `main`、原本 `hongbin_crm_quick_notes_r73` 和所有 ERP／報價資料保持原狀；本測試試算表不含正式資料。

## 2026-10-19｜跨帳號 Google 原生 ACL 實測與 GitHub Node.js CI 回報

- 使用公司 Google 帳號建立的**隔離測試工作表**已直接以另一個已連線的 Google 個人帳號進行 2 次真實 API 負向驗證：
  1. Personal Google 帳號請求 Google Sheets metadata → **HTTP 403 PERMISSION_DENIED**。
  2. Personal Google 帳號請求 `Events!A1:C1` → **HTTP 403 PERMISSION_DENIED**。
- 同時以公司帳號回讀 Drive metadata：`shared=false`，`permissions` 僅 1 筆 owner。**PASS：目前這份未分享試算表的 Google 原生隔離**。
- 以上不代表 Apps Script A 使用 Google Session 取得身分或 B 安全轉發成功；**App Script 跨帳號同步仍未實測**，不得提升 GO LIVE。
- `.github/workflows/gas-notes-offline-tests.yml` 保持對獨立分支 `probe/gas-no-work-20261019` 的 13 組 Node 測試；新增提交狀態回報步驟，使用 GitHub Actions 的臨時 `github.token` 並限定 `contents:read` 和 `statuses:write`，只寫回 `gas-sync-probe/node-regression` 這個 commit status context。
- **實際 Node.js CI 已回報 PASS。** GitHub 回讀提交 `ff22866553365655a1f63e1367c4f35fa6bf7148` 的 `gas-sync-probe/node-regression` 狀態為 `success`；這表示該提交的 GitHub Actions 13 組 Node.js 測試已跑完並由 workflow 回報成功。先前的 statuses 空值為執行尚未完成時的暫時狀態。此項可列為 **NODE CI PASS**，但不是 Google Apps Script 真實部署。
- 這個改動沒有使用 Google OAuth、Google Apps Script API 部署憑證、Work 模式，也沒有修改正式 CRM main 或原本記事。

## 2026-10-19｜手機記事 CRUD 與真正 Node CI PASS

- `Index.html` 已在獨立 Google Apps Script 測試頁新增手機記事新增／編輯／刪除（非正式 CRM）。只對 Google Session 驗證過的帳號開放，發出寫入時加上 `__expectedGoogleAccount` 並要求後端再核對。
- 共用記事只允許 ADMIN / EDITOR 編輯，VIEWER 僅可查看；刪除共用記事只允許 ADMIN，私人記事只允許本人。後端仍是最終權限 Authority。
- 新增與編輯時帶入安全產生的 operationId、expectedVersion；回傳 VERSION_CONFLICT 時保留文字，不自動覆蓋對方更新。
- 未儲存草稿在切換私人／共用分頁、切換群組或按取消時會先確認；選擇留下就保留文字。未串接獨立離線 outbox，因此斷線時目前仍不宣稱草稿已經永久儲存，UI 會明確提示。
- `ui-smoke.test.cjs` 用模擬 DOM＋假 Google 服務實測 12 項互動，包括驗證登入、記事新增、編輯、刪除、HTML 安全顯示、衝突保留草稿、帳號切換、角色權限及離開提醒。
- GitHub Actions 測試已擴充至 **14 組 Node.js 回歸套件**，GitHub 提交 `5ac9ba0a928931e86095e185db84ce857c8292dd` 的 `gas-sync-probe/node-regression` **實際回報 success**，可列為 **NODE CI PASS**。
- 初次 UI CI 曾 FAIL，原因為測試模擬 DOM 沒有反映 HTML 原始 `class="active"`，已修正測試夾具後真正重跑並取得 success；不得保留舊失敗作為最終狀態。
- 這些結果**仍不是**實際 Apps Script OAuth／部署、真實 iPhone Safari 或兩台手機跨帳號同步的驗收；仍需獨立實測、使用者批准後才能接入正式 CRM main。
- Google Sheets 私人測試表仍為公司帳號獨有，另一個個人 Google 帳號實際讀取及 metadata 均回應 403；不分享原始 Sheets、不將檔案 ID 寫進公開程式碼。

## 2026-10-19｜網路回覆中斷後的重複記事／刪除風險修正

- **實際問題：** 使用者按「儲存」時，Google 可能已成功寫入，但 Safari／網路沒有收到 ACK；若每次重按都產生新的 `operationId`，後端的冪等設計無法阻止同一筆記事重複新增。
- `Index.html` 已補 `pendingSave`：同一筆內容、同一動作、同一帳號及版本在不確定結果下安全重試時，沿用最初的操作 ID；使用者若在 ACK 不明時修改內容，系統先阻擋新操作並提示核對雲端，保留未送出的草稿。成功後清除待送狀態。
- 同理補 `pendingDelete`：刪除後 ACK 遺失，重按時沿用原刪除 `operationId`，且提示「可能已刪除、須核對」，**不得再誤報「資料未更動」**。
- 同時修正實際使用者介面問題：從共用記事切換回私人記事時，自動重新讀取清單，不再出現空白列表須手動按更新。
- `ui-smoke.test.cjs` 已涵蓋「新增成功但 ACK 遺失」、「未確認前修改內容不得用新 ID 送出」、「刪除成功但 ACK 遺失」。先前測試模擬器的假隨機值產生器會重複產生 ID，已改成每次產生新 ID；重試仍沿用原本 ID。
- 最新 GitHub 提交 `09771e60dc5824e1ce21352b8541007e97bbb240` 的 `gas-sync-probe/node-regression` 實際狀態為 `success`；**14 組 Node.js 自動回歸測試 PASS**，其中手機操作模擬涵蓋 **15 項**情境。
- 安全提醒：先前 `account-scoped-outbox.cjs` 對帳號 Email 的 SHA256 分區**不是加密**，不能當成共用 iPhone 同源 localStorage 上私人文字的機密防護；目前該模組**沒有接入 CRM／Apps Script 畫面**。尚未有加密或安全金鑰保存方案時，禁止在跨帳號環境以這種分區方式持久化私人記事本文。
- 部署與上線依然 HOLD：官方 `MYSELF` 不支援跨不同 Google 使用者共同操作，且目前缺少安全的 Apps Script 建立／部署 OAuth 授權。真正 Google Script 部署、兩支 iPhone 不同帳號驗收均未完成。正式 `main` 與 R73 已 PASS 功能完全不更動。

## 2026-10-19｜跨帳號上線阻擋與讀取帳號比對

- Google 官方 `projects.deployments.get` 文件已核對：`MYSELF` 僅部署者可使用，`ANYONE` 需要登入，`ANYONE_ANONYMOUS` 任何人皆可進入；`executeAs=USER_ACCESSING` 表示以當下使用者身分執行。這是跨帳號同步是否可行的真實條件，不可拿 Node 的模擬帳號替代。
- `multi-account-gate.cjs`、`multi-account-gate.test.cjs`：新增 13 個「正式上線前 HOLD」檢查。缺少真實 OAuth 部署、不同 Google 帳號身分、服務 A→B 的伺服器間授權、真正共用記事 ACL／撤銷驗證、雙 iPhone 衝突測試或正式備份回歸時都必須維持 HOLD。此 gate 永不自行部署正式 CRM，完成技術證據仍須使用者驗收。
- `entry-user.gs.js`、`Index.html`、`bundle-runtime.test.cjs`：擴大 `__expectedGoogleAccount` 比對範圍，**所有 LIST、GET、CREATE、UPDATE、DELETE 請求都須匹配 Google Session 帳號**。Safari 切換 Google 帳號時，不能用過時的帳號標示繼續讀／寫記事。安全斷言經比對後移除，不會傳給資料服務當可信身分。
- `ui-smoke.test.cjs`：新增使用者切換帳號後，阻止讀取舊帳號記事的互動回歸。
- `.github/workflows/gas-notes-offline-tests.yml`：共 **15 組** Node.js 測試；新增測試失敗時回報是哪一組的 GitHub commit status，可直接用 GitHub 連線回讀，不必要求使用者開 GitHub 截圖。
- workflow 在 Node 測試後自動產生、暫存**僅限本人存取**的兩層 Apps Script 程式包 Artifact，保留 7 天，供未來 OAuth 部署準備；不含 Google 憑證，不會自動執行 `clasp deploy`、`gh secret set`，也不更動正式 CRM。
- GitHub commit `1a29255cb48487cf9abe09df6a9ed48097651f91` 的 `gas-sync-probe/node-regression` 已實際回報 **success**，因此 **15 組最新 Node CI PASS**。過渡版本有發生過失敗，並未列為成功；最新結果已通過，但真實 Google Apps Script 部署仍 **BLOCKED**。
- 已取得真實 Google Sheets API 的新增、讀取、刪除合成測試資料及雙帳號 403 權限隔離 PASS；**不要將其誤當成 Apps Script API 的 OAuth 自動部署授權**。
- `MYSELF` 的 B 資料端若由 A 用 `UrlFetchApp` 呼叫，仍缺實際服務間授權可行證據；不可改成 `ANYONE_ANONYMOUS` 偷偷繞過部署問題。正式跨帳號同步與主 CRM 整合維持 HOLD。

## 2026-10-19｜手機切換帳號後隱藏快取記事（重要安全修補）

- **找到的風險：** 原有測試頁雖然會由 Script A 拒絕舊帳號的 LIST/UPDATE 請求，但前端 `Index.html` 仍可能保留並顯示前一個 Google 帳號先前載入的私人記事；切換帳號後可能看到不該繼續顯示的快取內容。
- **修正：** 偵測 `GOOGLE_ACCOUNT_SWITCHED`、`GOOGLE_IDENTITY_UNAVAILABLE`、`UNVERIFIED_IDENTITY` 或缺少帳號斷言時，立即清空**可見**記事清單、群組選單與表單內容，停止編輯／同步，停用寫入按鈕，顯示重新驗證帳號提示。
- **避免手機草稿遺失：** 若切換當下正編輯尚未上傳的內容，僅放入**此頁 JavaScript 記憶體**、標記原 Google 帳號；只有重新經 `gasWhoAmI()` 驗證為原帳號且有對應群組修改權限，才能恢復暫存編輯內容。**這不是持久性離線備份，重新載入、關閉頁面或 Safari 回收後不保證保存**。
- **避免延遲回覆重新顯示舊資料：** 所有遠端請求的成功／失敗回呼都記錄發出時的 `accountEpoch` 和帳號；發生身分切換就增加世代編號，舊世代的晚到回覆不能再修改目前畫面。
- `ui-smoke.test.cjs` 已增加不同帳號不能顯示快取私人記事、錯帳號不能恢復草稿、原帳號重新驗證後才能恢復，以及舊請求延遲回覆不能重現私人資料等測試，合計 **19 個 UI 模擬情境**。
- GitHub 提交 `829c09b9fb1dc0815ed943060ce10cc4a57cb101` 的 `gas-sync-probe/node-regression` 實際狀態 **success**；這意味隔離分支的 **15 組 Node.js CI PASS**（UI 測試 19 項亦在其中）。
- **此結果仍不是**真實 iPhone Safari、Google Session 跨帳號切換或 GAS 雲端部署的驗收。個人帳號對私人 Sheets 的實際 403 只驗證 Google 原生檔案權限；不代表共用記事服務完成。
- 正式 CRM `main`、既有 `hongbin_crm_quick_notes_r73` 與 ERP/報價資料沒有改動；不接入正式服務直到 Google OAuth／跨帳號部署及真機測試安全通過。


## 2026-10-19｜不用工程操作的共用群組管理完成（隔離測試分支）

本輪目標是讓使用者在 iPhone 上直接管理共用記事，而不是靠手動群組 ID 或 Google Sheet 後台操作。

- \`Index.html\` 已增加「建立共用群組」「管理成員」、Google Email 輸入、ADMIN / EDITOR / VIEWER 角色、加入／變更權限及撤銷權限。群組 ID 由後端產生，使用者無須輸入。畫面明確註記：**加入成員不代表系統寄出邀請 Email**。
- 只向有效 ADMIN 顯示管理功能；後端 \`event-service.cjs\` 仍是最終權限檢查者，VIEWER / EDITOR 無法自行添加成員。只有最後一位 ADMIN 時禁止撤銷其管理權限。
- 使用者輸入的成員 Email 在伺服器端額外檢查格式（長度、@、網域），不合格不寫入事件紀錄。這是**格式**驗證，並不代表 Google 已驗證該電子郵件存在；真正使用者必須經 Google Session 授權才可讀取。
- 成員管理經 \`gasNoteCall\` 經 Google Session 的 \`__expectedGoogleAccount\` 比對，操作 ID 在未收到 ACK 時沿用，不冒充已儲存，也不儲存任何客戶資料。
- \`ui-smoke.test.cjs\` 增加 iPhone 建立群組、管理者讀取成員、阻擋無效 Email、加入 VIEWER、撤銷權限五種操作；現有 UI 合成案例共 **24 項**。額外在 \`event-service.test.cjs\` 測試 Email 不能亂填、合法別名正規化。
- GitHub commit \`5e532b7a6a418f8df9a1599bda0ef2428c1b7159\` 的 \`gas-sync-probe/node-regression\` 已回報 **success**，對應 **15 組 Node.js CI PASS**。中間一次測試假設群組只能有三位成員而 FAIL，已調整為依實際角色驗證，修正後重跑成功。
- **正式 Google Apps Script 授權與部署仍未完成。** 官方 API \`projects.create\` 要求 \`script.projects\` scope，\`projects.deployments.create\` 要求 \`script.deployments\` scope；目前已連接的 Drive/Sheets 工具並不提供這些管理操作。不能把既有 Drive 權限冒稱為 Script 部署權限。
- Script A / B 設為 \`MYSELF\` 的封閉程式包，不能直接讓不同 Google 帳號共用；真正的 A→B 授權傳輸、真實帳號隔離、雙 iPhone 實測仍為 HOLD。
- 施工全部保留在 GitHub \`probe/gas-no-work-20261019\`，**正式 CRM main、R73/R74 既有記事及 ERP 客戶、報價、交易資料都不改動、不上傳、不重置**。未取得安全授權工具前不要求使用者操作 Codespaces、Terminal 或貼 Script。

## 2026-10-19｜工作表容量自動擴充與容量故障安全回退

- **真實風險：** 透過公司 Google 連線回讀既有獨立測試 Sheet 的 Grid Properties，`Events` 實際配置 **999 列**、`UsedNonces` 實際配置 **1,999 列**。這是有限容量，先前 `getRange(last+1,...).setValues(...)` 在資料到達 Grid 尾端時可能失敗，不能把工作表當成無限列數。
- 已修正 `sheets-adapter.cjs`：使用後端 ScriptLock 包覆「讀取最後資料列、查詢 `getMaxRows()`、必要時 `insertRowsAfter()` 擴容、單筆 `setValues()`」的連續作業。成長步幅最多 1,000 列，既有事件重播上限 15,000 筆仍維持，不會無限成長。
- 已修正 `nonce-registry.cjs`：在獨立 ScriptLock 內檢查 `UsedNonces` 真正的 Grid 容量，僅在需要時擴充最多 500 列。原本防重放及已到期清理維持，最多 20,000 筆記錄後需要維護。
- 當 `getMaxRows()` 回傳異常、容量擴充失敗或 Google Sheets 寫入失敗時，**禁止確認已同步成功**；所有失敗原封回報給呼叫端，後端可用同一 `operationId` 重試。這不是聲稱 Google Sheets append 是 ACID 交易。
- `sheets-adapter.test.cjs`、`nonce-registry.test.cjs` 各增加 **3 個**容量與擴充失敗回歸案例，另外 `bundle-runtime.test.cjs` 也改用具有實際 Grid 上限的模擬表。原本的讀寫、權限、衝突與簽章測試皆保留。
- GitHub commit `d58043b28fe19f7a92ea7579fb372f4d22168396` 的 `gas-sync-probe/node-regression` 已回報 **success**。**15 組最新 Node.js CI PASS**；這表示整個測試流程通過，不代表現場 Apps Script 已執行。
- 實際公司 Google Sheet 本輪只做 metadata 讀取，**沒有插入或刪除任何正式／測試資料**。真實 Google Sheets 的 Apps Script 擴容行為仍待擁有正確 Google OAuth 的測試部署驗證。
- 正式 CRM main、既有 R73/R74 隨手記、報價、客戶與 ERP 均保持原狀。現階段仍必須 HOLD：Google Apps Script 實際安全部署、跨帳號 Script A→B 存取及兩支 iPhone 使用者驗收未完成。

## 2026-10-19｜Google 部署架構裁決與可信證據關卡

- Google 官方 Session／Web App 說明已證實：「execute as owner」通常無法使用 `Session.getActiveUser().getEmail()` 判斷其他使用者身分；「execute as user」不會自動取得公司私有 Google Sheets 的所有者權限。
- 現有 A→B 兩層封閉部署架構仍未證明跨帳號網路授權可行。不能只因 Node CI 全綠就宣稱部署可成功，也不能直接把 B 設成公開匿名服務。
- 新增 `GOOGLE-DEPLOYMENT-FEASIBILITY.md`：比對雙層 Apps Script、單一 Google 擁有者 Script + Google Identity Services、直接分享試算表及外部後端四種方式，對不符合用戶需求的路徑標明不採用或 HOLD。
- 發現原 `multi-account-gate.cjs` 只驗證可由呼叫者自行填入的多個 `true`，可能誤將虛構的授權證據當作「可進入驗收」。已修正成**真正 Google 官方部署與帳號證據驗證介面尚未接入前永遠 HOLD**；不能靠自行組裝布林值放行。
- `multi-account-gate.test.cjs` 新增「偽造全 TRUE 仍 HOLD」回歸；GitHub commit `688787f1f1088093f780071c1706a6db645e8c96` 的 `gas-sync-probe/node-regression` 回報 `success`。真正 Apps Script OAuth／線上同步仍完全未驗證。
- **不用 Work**。現有 Google Drive／Sheets 連線無 Apps Script 專案建立、更新、部署、部署回讀的專用 OAuth 介面。未確認存在安全的 OAuth 工作流程之前，不得要求使用者花 Work 額度或工程操作。
- 本次未接入正式 CRM `main`，也未存取／遷移／分享真實記事或 ERP、客戶、報價資料。

## 2026-10-19 晚間｜共用記事撤銷權限隱藏與真實隱私邊界

- 在獨立測試 UI 找到風險：成員被移出共用群組或從 ADMIN／EDITOR 降權時，雖然後端會拒絕後續讀寫，但手機可能仍留著之前顯示的共用記事或開啟中的編輯畫面。
- `Index.html` 增加伺服器權限錯誤處理（`FORBIDDEN_SHARED`、`FORBIDDEN_ADMIN`、`FORBIDDEN_WRITE`、`FORBIDDEN_DELETE`、`GROUP_NOT_FOUND` 等）：立即清空可見共用記事、群組、管理及編輯畫面，失效化之前尚未回來的請求。被撤銷權限後不能沿用舊草稿寫入。清單重新取得群組前也先隱藏舊內容。
- `ui-smoke.test.cjs` 新增兩種情境（權限降級拒絕 UPDATE／成員被撤銷拒絕 LIST，並模擬舊回覆延遲抵達），GitHub commit `e00b7a7b82c5e59bc26c7da4b10bf9e85a805136` 回報 `gas-sync-probe/node-regression: success`。
- 使用者版面的 `privacyBoundary` 明確揭露：這些記事目前是公司 Google Sheet 的**明文事件記錄**，被 CRM ACL 禁止的成員看不到，但真正擁有原始 Sheets 權限的人能讀取；**未實作端對端加密**。不以「私人」二字誤導使用者。
- `ui-smoke.test.cjs` 新增隱私揭露回歸，最新 commit `4d99b08a4f349a454683ab3f1c6f635d9fa9e285` 的 `gas-sync-probe/node-regression` 已實際回報 **success**；總共 **15 組 Node.js CI PASS**，其中 UI 模擬測試 **27 項**。
- 據 Google 官方 Session 文件，`getTemporaryActiveUserKey()` 每 30 天輪替，不能作為長期多手機帳號；單一 owner GAS＋Google 官方身分驗證仍需 OAuth Client ID、伺服器端驗證 ID Token、CSRF 等可靠機制，未取得可安全部署的執行證據；見 `GOOGLE-DEPLOYMENT-FEASIBILITY.md`。
- **權限撤銷並不代表能即時刪掉離線手機過去已讀資料。** 本次修正只保證網頁收到服務端拒絕或重新取得群組時清空快取；背景／離線及實機情境仍待驗證。
- 此輪不使用 Work；沒有 Google Apps Script 真實部署、沒有更改正式 CRM／ERP、沒有把原有 R73/R74 隨手記上傳雲端。
