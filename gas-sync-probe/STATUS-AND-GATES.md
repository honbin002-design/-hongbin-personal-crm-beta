# 鴻繽科技 CRM｜Google Apps Script 雙模式同步記事｜隔離驗證交接

狀態：**OFFLINE UNIT PASS / LIVE GOOGLE HOLD**（2026-10-19）
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
- `.github/workflows/gas-notes-offline-tests.yml`：可在分支提交時執行 Node 測試；單純存在 workflow **不等於**已有 GitHub Actions 成功證據。
- 先前 GitHub readiness workflow：API 網路可達、`clasp` 可執行；`CLASPRC_JSON` / `CLASP_JSON` 均為 MISSING；尚未部署 Google Script。
- `script.google.com/home/usersettings`：使用者畫面已確認 Apps Script API 設定顯示「開啟」；與實際 OAuth 憑證、服務建立是不同的驗證項目。

## 下一階段必要安全架構
1. **前端不得傳入可信身分**：由受 Google 授權且以使用者身分執行的 Apps Script A 在伺服器端辨識使用者；`Session.getActiveUser().getEmail()` 若為空，一律拒絕。
2. **中央工作表不得公開給一般成員**：以 App Script B（資料持有人權限）持有並存取隔離的 Google Sheets；A 到 B 使用伺服器間短期簽章請求，B 驗證簽章、過期時間、單次 nonce，及各次業務授權。**此層尚未建置或實測。**
3. **最小資料權限**：PRIVATE 只允許 owner；SHARED 每次由後端確認有效成員及角色；角色撤銷後後續查詢和寫入都拒絕。用戶端隱藏按鈕不可作為防護。
4. **同時編輯**：所有修改都需要 articleId、expectedVersion，並且在同一個 `LockService` 鎖內完成版本檢查及 Sheets 寫入；衝突回傳錯誤，不得覆蓋。**持久化、鎖與併發整合仍未建置／實測**。
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
| Google 線上使用者身分／跨帳號 | NOT TESTED |
| Google Sheets 後端、跨 Apps Script 簽章與鎖 | NOT BUILT |
| 自動建立／部署 GAS 實證 | BLOCKED（無安全授權途徑） |
| iPhone 真機同步與離線驗收 | NOT TESTED |
| 正式 CRM 雙模式同步記事 | HOLD |

不得將 UNIT PASS、GitHub workflow 綠勾或官方 API 文件誤報為已部署、可真正跨手機同步。
