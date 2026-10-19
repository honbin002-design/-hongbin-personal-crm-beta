# 鴻繽科技 CRM｜同步記事 Google 部署可行性裁決（2026-10-19）

> 狀態：**GOOGLE DEPLOYMENT HOLD**。此文件屬獨立測試分支；不得修改正式 CRM、共用原始客戶或報價資料、要求使用者操作 Codespaces／Terminal／貼 Script，或逕行使用 Work 額度。

## 一、已用來源確認的事實

1. Google Apps Script 的 `Session.getActiveUser().getEmail()` **可能是空字串**；Web App 若「以部署者身分執行」，通常無法以此識別訪問者。來源：Google 官方 [Session](https://developers.google.com/apps-script/reference/base/session)。
2. Web App 以 `USER_ACCESSING` 執行時，訪問者需要授權；程式直接存取私有的公司 Google Sheets，通常不能因為使用者成功登入就取得公司資料表權限。不能把「Google 帳號已登入」當成「公司資料庫已開放」。
3. 目前兩層 Apps Script 的 A / B Manifest 都設定 `access: MYSELF`，只能視為**封閉部署測試模板**，不符合不同 Google 帳號共同使用的要求。來源：Google 官方 [Web Apps](https://developers.google.com/apps-script/guides/web)。
4. B（資料擁有者）若仍是 `MYSELF`，A 對 B 的 `UrlFetchApp.fetch()` 是否有**可用且合法的服務間驗證**沒有實測證據。公開 B 並只靠共享 HMAC 不是「私人端點」，需要另行評估外部呼叫濫用、金鑰和額度風險；**未經使用者允許不得改用**。
5. Google 官方 Google Identity Services 支援瀏覽器取得 Google ID Token；真正授權使用者必須由**伺服器端**檢查簽章、`aud`、`iss`、`exp`，並以 `sub` 作為穩定唯一身分識別。單憑瀏覽器送出的電子郵件不能授權。來源：Google 官方 [驗證 Google ID Token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)。Google 的 `tokeninfo` 用於開發及偵錯，不能不經評估直接當正式版高信賴授權架構。
6. Google Apps Script API 的建立、管理與部署須具備獨立 OAuth 權限；既有的 Google Drive／Sheets 連線**無法代替**。來源：Google 官方 [Apps Script API](https://developers.google.com/apps-script/api/how-tos/execute)。

## 二、候選方案實際限制

| 方案 | 優點 | 尚未解決／不適合 |
| --- | --- | --- |
| **現有雙層 A→B**（A 以訪問者身分；B 持有私人 Sheet） | 保留事件及權限程式，不需重寫已通過測試部分 | B `MYSELF` 的跨帳號網路呼叫未證實能通過；擴大 B 存取權限會改變安全邊界。**不能立即部署** |
| **單一擁有者 Apps Script + Google Identity Services** | 可能避免 A→B 跨 Script 呼叫；Sheet 可保持僅公司帳號擁有 | 需要另建 Google OAuth Web Client ID、前端 Google 登入、後端正確驗證 Google ID Token（含公鑰輪替）、CSRF 與濫用防護。Apps Script 原生驗證 JWT 的可靠實作尚未實證。**只是候選，未證明可行** |
| **每位成員直接分享 Google Sheet** | 免 A→B 代理層 | 編輯者可繞過 CRM 操作原始表，損害細粒度權限、版本、審計；私人／共用隔離也需多檔案管理。**不採用** |
| **外部付費後端或第三方登入** | 可能降低 Apps Script 限制 | 違反既有免費、Google 原生、低第三方依賴原則。**不採用** |

**裁決：雙層 A→B 保留測試分支，不升級正式版；單一擁有者 + Google 身分驗證可列研究備案，但未完成安全驗證前不轉向，也不要求使用者開 Work。**

## 三、啟用 Work 或真人授權前，必須先取得的證據

- 能由受信任且經使用者確認的授權工具存取 Apps Script 專案的 **create / content update / deploy / deployment get** 管理操作，或已證實 Cloud Browser 可以在 Google 官方管理介面完成相同步驟；**不得以能操作 Drive 推論能部署 Script**。
- 在隔離測試專案取得 Google 真正的部署 Readback；不得只看 `clasp` 指令成功或本地 Manifest。
- 明確選出**不會分享原始 Sheets、可讓兩個不同 Google 帳號以各自身分操作**的授權／傳輸方案；先做最小限度兩帳號實測，再接完整記事功能。
- 測試 A 的私人記事不能由 B 讀取；共用群組 VIEWER／EDITOR／ADMIN、撤銷、衝突、刪除、離線回復及兩支 iPhone Safari 實測均 PASS。
- 正式 CRM 的八項已 PASS 功能與舊本機隨手記保留；任何遷移必須使用者預覽、確認、可回退。

## 四、目前已完成的真實證據

- GitHub 隔離分支 Node.js 自動回歸 **PASS**，不是 Apps Script 雲端身份驗證證據。
- 公司帳號私人 Google Sheets 已完成真實寫入、讀回及清除虛構資料，另一個帳號直接讀取返回 403；**只證明 Sheet 原生 ACL**。
- `multi-account-gate.cjs` 已修正為**不可由呼叫者填入布林值來解除 HOLD**。必須先接入能獨立讀取 Google 權限與登入結果的可信服務，才能討論解除。
- 目前無安全的 Script OAuth 自動部署授權；正式 CRM `main` 保持不變。

## 五、下一步（不使用 Work）

只進行不需 Script OAuth 的原始碼安全修正、部署證據規格與 Google 官方能力查證。若無可執行的授權或可靠的驗證方式，**明確停止宣稱實際同步可用**；不再把增加離線測試數量當成解除部署阻礙。

