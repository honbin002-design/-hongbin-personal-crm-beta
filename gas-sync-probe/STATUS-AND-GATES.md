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
