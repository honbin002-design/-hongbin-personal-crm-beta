# HONBIN CRM｜Google Firebase Spark 零付款同步記事候選｜獨立技術驗證

> 2026-10-19。**不代表已上線或已取得使用者同意切換架構。**
> 本目錄僅在 GitHub `probe/gas-no-work-20261019` 測試分支。絕不修改正式 CRM `main`、既有 R73 隨手記、Google Sheets 或 ERP 交易資料。

## 本輪已通過的「真」驗證

- 使用 Google 官方 Firebase **Firestore Emulator**（不是自行模擬的 ACL 函式）執行 **32 項**規則案例。
- GitHub commit `8d3b95f71d7d781a1c10050015bc18cdd0a0ebb0`，狀態檢查 `firebase-sync-probe/rules-emulator: success`。
- 稽核主題：拒絕未登入或非 Google 登入者、不同 UID 的私人隔離、共用 ADMIN/EDITOR/VIEWER、檢視者不可改寫、陌生人不能入群、自授管理權限失敗、群組降權／撤銷後拒絕讀取、版本跳號／過期寫入拒絕、原始擁有者不可移除等。
- 真實 Firebase 雲端專案尚未建立，真實 iPhone Google 登入及同步尚未驗證。
- 模擬身分資料由官方 rules-unit-testing 建立，**不是真實 Google Account OAuth 身分驗收**。

## 免費與架構裁決

Google Firebase 是 **Google 自家服務**，不是額外外包廠商。可使用**Spark 免費方案**（不需付款資料，且不要啟用 Blaze）。Google 官方 2026-10 文件提到，第一個免費 Firestore 資料庫有 1 GiB、50,000 reads/day、20,000 writes/day、20,000 deletes/day、10 GiB outbound/month。超限可能停止服務，**不是無限制免費**。Google 社交帳號 Firebase Authentication 在 Spark 支援；不使用簡訊／電話認證、Cloud Functions、付費備份、PITR 等付費服務。

- Google 原生 Firebase Auth 給每人穩定的 `uid`；不再依靠 Apps Script `Session` 或私人 Script A→B 伺服器間 OAuth。
- 直接由 iPhone CRM 網頁透過 Google Firebase Web SDK 讀取 Firestore。所有文檔在後端由**Firestore Security Rules**授權，不能依賴前端按鈕隱藏。
- 私人記事路徑：`users/{uid}/notes/{noteId}`，只有 uid 相同的 Firebase Google 使用者可以讀／寫。
- 共用群組：`groups/{groupId}/notes/{noteId}`，依群組建立者或 ACTIVE 的成員 UID 角色授權；撤銷後，新的伺服器讀寫會拒絕。
- 支援記錄版本整數遞增，可用 Firestore Transaction 防止兩支手機覆蓋。**尚未整合實際版本衝突 UI 與離線 outbox**。
- Firestore 專案擁有者／管理員仍可在後台查看明文記事；**不是端對端加密**。

## 目前不能宣告已完成的功能

1. **Email 邀請尚未完成。** 此第一個安全規則原型是用經 Google 登入後穩定的 `uid` 設定群組成員；對方還沒登入時管理者不知道 UID。要有使用者要求的 Email 邀請，必須先設計 Email 邀請建立／經本人 Google Email 驗證後兌換／撤銷後不能重新兌換／群組列表發現／防重複及權限回退，再以真 Firestore Emulator 驗證。不得讓前端自報 Email 決定權限。
2. **iPhone Safari 登入尚未測試。** Google 官方說 `signInWithRedirect` 在限制第三方儲存的 Safari 需配合 Firebase Hosting／同源代理等額外設定。GitHub Pages 無法直接假定原本的 redirect 流程可行；Google 官方有 `signInWithPopup` 替代方案，但 iPhone 可能阻擋彈出視窗，仍須實機驗證。若改用 Firebase Hosting 的 Spark 免費額度，也需額外確認登入流程、網站發佈與現有 GitHub Pages 的整合。
3. **還沒有真正 Firebase 專案。** 必須由公司 Google 帳號擁有、確認 Spark 計費狀態、啟用 Google Authentication 與一個 Firestore 免費資料庫、受限網域設定後，才可以用測試資料做兩個不同 Google 帳號實測。未經使用者允許不建立 Firebase 專案，也不要求 Work。
4. **沒有永久離線草稿、雲端自動備份或不受限制的即時同步額度。** 禁止以其他付費功能解決這些問題。
5. **正式 CRM 尚未整合。** 只有權限規則與模擬器驗證，不會改動 main 或遷移任何既有記事。

## GitHub 實際測試與繼續施工

- `firestore.rules`：預設拒絕、不依賴前端 Email 的後端身分／權限規則。
- `firestore.rules.test.mjs`：32 項 Google 官方資料庫模擬器案例。
- `package.json`、`firebase.json`：獨立 Node／Firestore Emulator 測試配置。
- `.github/workflows/firebase-notes-emulator-tests.yml`：GitHub Actions 自動執行，獨立回報 `firebase-sync-probe/rules-emulator`；沒有任何 `firebase deploy`、Google OAuth Token、付款帳戶或實際建立專案。
- 既有 Apps Script 施工保留做歷史備援，但目前**不再要求使用者為無法證實的 Apps Script 部署消耗 Work 額度**。

## 官方參考資料（2026-10 核對）

- [Firebase Spark 價格方案](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Cloud Firestore 免費額度](https://firebase.google.com/docs/firestore/pricing)
- [Firebase Authentication Google 登入](https://firebase.google.com/docs/auth/web/google-signin)
- [Safari / 第三方儲存與 redirect 登入限制](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [官方 Firestore Emulator 規則測試](https://firebase.google.com/docs/firestore/security/test-rules-emulator)

**下一個實作 Gate：在不連接真實資料、不啟用 Work 的前提下完成「Email 邀請接受／撤銷不重用」規則與 Firebase Emulator 測試。然後才評估連線 Firebase 專用工具。**


## 2026-10-19｜Spark 零元授權條件與 Email 邀請 Gate

使用者已明確同意「**完全免費才採用 Firebase**」；執行的硬限制是：
- 僅能使用 Google Firebase **Spark（免費）**；不提供信用卡、不建立或連結 Google Cloud Billing 帳戶，不升級 **Blaze**、不設置試用或付費服務。
- 僅限 Google 社交登入、第一個 Cloud Firestore 免費資料庫、免費額度內的靜態網頁；超過免費額度允許暫停同步，**不准為了不中斷而付費**。
- 不使用 Cloud Functions、付費自動備份／PITR、TTL 自動刪除、付費 Firebase App Hosting 等需要計費方案的功能；Firebase 社交登入與一般 Firestore 安全規則／原子批次寫入在 Spark 的免費配額內可用。
- **Spark 不是無限免費**：官方文件列明 1 GiB 儲存、每天 50,000 次讀取／20,000 次寫入／20,000 次刪除、每月 10 GiB 傳出量等免費額度。啟用 Blaze 或連結 Billing 會改變成本風險，需停工並重新徵得使用者明確同意。參考：https://firebase.google.com/docs/projects/billing/firebase-pricing-plans 及 https://firebase.google.com/docs/firestore/pricing

### 已驗證的 Email 邀請安全機制

- `firestore.rules` 新增 `inboxes/{recipientEmail}/invites/{invitationId}`。僅群組 ADMIN 可建立狀態 PENDING 的邀請，只有 Firebase 已驗證 Google Email 相符的登入者能讀取自己的 inbox。
- 受邀者接受後將邀請改為 ACCEPTED 並建立 `groups/{groupId}/members/{uid}`，兩筆操作必須在**同一 Firestore writeBatch** 中成功；以 `getAfter()` 驗證目標 UID、邀請 ID 和指定角色。這能阻擋任意偽造 UID、無邀請直接加入、把 VIEWER 自行改成 ADMIN、接受邀請但不消耗它、撤銷後沿用已接受邀請重新加入。
- 群組 ADMIN 可撤銷尚未接受的邀請。受邀者被撤銷權限後，舊邀請無法重新用；管理員日後另建新邀請才可重新加入。**沒有寄送任何真實 Email**：郵件通知／手機分享邀請 UI 仍是待完成工作。
- 原本 **32 項** Firestore Emulator 權限測試仍保留，新增 **15 項** Email 邀請／原子兌換測試，合計 **47 項真實 Firebase 規則引擎測試**。GitHub commit `483918684bea15e43d7d139f2c6b61f2d79f9a0b` 的 `firebase-sync-probe/rules-emulator` 已回讀狀態 **success**。
- 施工曾遇到字串插入使 Regex 產生編譯錯誤，已修復，**唯有最新通過的提交才算 PASS**。全程僅改隔離 GitHub 分支，沒有建立真實 Firebase project、沒有計費、沒有部署，也沒有更動 CRM／ERP／正式記事。

### 上線前仍必須解決

- Firebase 專用 ChatGPT 連線目前**尚未安裝／連接**，無法操作使用者的 Firebase 雲端專案。先前已提供 Firebase 連線建議；安裝／連接需要使用者親自確認，不能由對話代替。
- 尚缺 Spark 真實專案存在／方案及 Billing 狀態回讀、Firebase Google Auth 授權網域與 iPhone Safari 使用、群組列表與邀請 UI、兩支手機的實際跨帳號同步與版本衝突驗收。
- 原有 R73/R74 隨手記禁止未經預覽與使用者同意自動上傳。公司 Google 資料擁有者具備原始雲端資料存取權，**非端對端加密**。正式 CRM main 維持不變。


## 2026-10-19｜真正 Spark 專案與 Firebase Web App 已建立（使用者 Safari 畫面核對）

- 使用者透過公司 Google 帳號在 iPhone Safari **親自**建立 Firebase 專案，專案顯示名稱 `HONBIN-CRM-NOTES-SPARK`、Firebase Project ID `honbin-crm-notes-spark`。
- 使用者在 Firebase「用量與帳單」親自核對畫面為 **Spark｜免付費（月費 US$0）**，沒有升級 Blaze。
- Authentication 的 Google 登入供應商已顯示「已啟用」，不啟用 SMS 多重驗證。
- Cloud Firestore Standard `(default)` 資料庫已建立，使用者在安全規則頁讀回 `allow read, write: if false;`，目前所有用戶端讀寫均被拒絕。**此前通過官方模擬器的 47 項 Firestore ACL 規則尚未部署到真實資料庫。**
- 使用者已註冊 `HONBIN CRM Notes` Web App，已提供 Firebase Web SDK 連線設定。公開網頁 config 現在保存在隔離分支的 `firebase-web-config.mjs`；這是 Firebase 公開專案識別資訊，**不是 OAuth Token、Google 密碼或服務帳戶密鑰**，真正資料存取仍須安全規則。
- 新增 `firebase-auth-smoke.html`：專用 iPhone Safari Google 彈出式登入測試，驗證 Firebase 登入來源 `google.com`、Google Email Verified、帳號切換與登出；**完全沒有 Firestore 讀寫程式碼**，不會上傳原有記事。
- 新增 `web-auth-preflight.test.mjs`：GitHub Actions 靜態檢查 Firebase config、Google 登入、無資料庫呼叫／無敏感 Token 顯示、Safari 工作階段安全；**不代表真實 iPhone Google OAuth 已通過**。
- **下一個實際必要步驟**：Firebase Console → Authentication → 設定 → 已授權網域，確認／新增 `honbin002-design.github.io`（不含 `https://`、專案路徑）；這只是允許網頁來源發起 Google 登入，**不會開啟 Firestore 資料權限**。
- **真機仍 HOLD**：目前 `firebase-auth-smoke.html` 只有存於隔離 GitHub 分支，**尚未發佈可在 iPhone Safari 執行的 HTTPS 測試網址**。GitHub Pages 正式 CRM 的 `main` 完全未修改。不得把 GitHub blob 原始碼頁當成能直接執行的 Firebase 網頁，也不能聲稱已完成兩支手機測試。
- 完全免費的硬限制維持：不綁信用卡、不連結 Billing、不升級 Blaze、不開 Cloud Functions／付費備份／付費 Hosting；Spark 額度耗盡可停用，不得為了不中斷而付費。

## 2026-10-19 晚間後續施工｜安全共用群組索引 Gate

- 不變更 `main`，在隔離分支的 `firestore.rules` 新增 `users/{uid}/groupIndex/{groupId}`：個人可讀的**純索引指標**（`uid`, `groupId`, `createdAt`），沒有共用記事、群組名稱或成員名單。
- 索引由 Google Auth 的同 UID 建立；群組創辦人可與建立群組使用同一 Firestore 原子批次。已授權成員可為自己建立索引，不可偽造、改動他人的索引；已失去權限的人即使保留舊索引也無法讀取群組內容。
- `firestore.group-directory.test.mjs` 新增 **22 項真正 Firestore Emulator 規則測試**，驗證登入隔離、偽造索引、全域群組列舉拒絕、成員降權／撤銷及舊索引清除。
- `package.json` 的 `test:rules` 納入新套件；現在合計 **69 項官方 Emulator 規則測試**（原 47＋新增 22）。
- Commit `38e85f4c7fdddce25ccd38c613b2c2640a8ffa2d` 已由 GitHub commit-status 讀回 `firebase-sync-probe/rules-emulator = success`。此結果為**隔離官方規則模擬器 PASS**，不代表 Firestore 雲端部署、實際帳號登入或兩支手機同步。
- 本輪 GitHub Pages 正式 CRM 仍維持原本來源；不能在同一個現有 Pages 站點隨意改部署來源以發佈測試頁，避免覆蓋 main 上線服務。獨立 HTTPS 測試網域及 Firebase 後台管理授權仍是下個安全 Gate；**未建立任何額外付費服務或外部站台**。

## 2026-10-20｜隔離共用群組／Email 邀請候選及真官方 Emulator CI PASS

**本次實際施工於 `probe/gas-no-work-20261019`，正式 `main` 零變更。**

- `firebase-group-service.mjs`：Firestore Web SDK 可注入操作層，提供建立群組與本人 UID 索引、只讀本人群組清單、發送 Email 地址邀請、查看自己的收件邀請、同一 writeBatch 接受邀請／建立成員、接受後建立索引、斷線 ACK 遺失後的已接受邀請恢復、變更／撤銷成員。若成員被撤銷，恢復索引前須通過真實群組讀取的後端授權。
- `firestore.rules` 新增 `groups/{groupId}/sentInvites/{invitationId}` 管理員寄件索引，建立時以 `getAfter()` 驗證對應的原始收件邀請，並由單一 writeBatch 寫入；只允許有效 ADMIN 讀取寄件索引。管理員可依已知邀請 ID 讀取所屬群組邀請的即時狀態，**不允許遍歷他人全部收件匣**。撤銷後索引不會刪除，可保留管理紀錄；不是實際寄信。
- `firebase-groups-test.html`：繁體中文、手機友善的獨立群組與邀請操作介面；具有登入、群組建立及列表、接受邀請、重新開頁讀回管理員寄件清單、撤銷待接受邀請、成員權限調整／撤銷。帳號切換及權限撤銷／降級時立即失效或隱藏舊畫面，文字採 `textContent` 避免 HTML 插入。
- **真實連線保護未鬆動**：`firebase-web-config.mjs` 的 `firestoreReadyForRealData=false`。介面於旗標為 false 時不初始化、讀取或寫入真實 Firestore。仍維持上一輪 Firebase 專案的 deny-all 規則；沒有雲端部署，也沒有讀取或上傳舊 R73 隨手記。
- `firestore.group-workflow.test.mjs`（21）、`firestore.outbound.test.mjs`（14）新增共 **35 項 Firebase 官方 Emulator** 實際規則引擎測試，結合先前 69 項，**目前總計 104 項**。
- 同時以 `web-group-preflight.test.mjs` 執行候選 UI 模組語法、未啟用旗標、無舊資料匯入、安全清除及操作範圍的靜態檢查。這些靜態測試不是 iPhone 真機測試。
- 曾發現測試斷言將「邀請已被撤銷」的應用層 `INVITATION_NOT_PENDING` 當作 Firestore `PERMISSION_DENIED`，及一項 UI 回歸斷言未配合安全清除邏輯的重構；均已修正，不保留 FAIL 作為最新狀態。
- **實際 CI 證據**：提交 `eefaa8226a82cc36c17dc684416cac123553cc11`；GitHub Actions job `rules-emulator` 顯示 `completed/success`，commit status `firebase-sync-probe/rules-emulator=success`。此 PASS 表示 Node 靜態檢查＋官方 Firestore Emulator 全部跑完，**不等於**線上 Google 登入或真實跨手機同步。
- 該提交回讀後 `main` 的 `index.html` blob SHA `909d05477b2b33e9238798529283cad395750c0b` 與 `simple-core.js` SHA `4c7d58ba03a1a5ed53c797060b9d2572cfc0776c` 保持不變。隔離分支對 `main` 的新增變更皆為新目錄與測試 workflow，沒有變更既有 CRM 原始碼。

**不得誤報完成：** 目前沒有可執行的免費隔離 HTTPS 測試網域、真正 iPhone Safari Google Auth 驗收、已部署的 Firebase Security Rules、跨 Google 帳號／跨手機同步、記事私人及共用 CRUD、文章版本衝突與離線草稿完整 UI、Email 通知實際寄送、舊本機記事遷移或正式 CRM 整合。群組與邀請 UI 是已施工並通過靜態檢查的隔離候選，還不是可對外使用的正式成品。

**下一步依原範圍**：先確認安全且長期免費的獨立 HTTPS Auth 測試入口及 Firebase 授權網域，再在官方 Google 登入實機 PASS 後，完成 Firebase 私人／共用記事 CRUD 的隔離前端、版本衝突與離線草稿；真實 Security Rules 部署與正式 CRM 整合需符合既定批准 Gate，絕不能自行改動 main／Spark 計費。

## 2026-10-20｜私人＋共用記事 CRUD／版本衝突／iPhone 候選施工 Checkpoint

### 已施工（仍是隔離版）

1. `firebase-sync-probe/firebase-note-service.mjs`：全新注入式 Firebase Web SDK 資料層，不會自行初始化網路；以 Google 已驗證 UID 及即時 `currentUid()` 防跨帳號待送寫入。私人路徑 `users/{uid}/notes/{noteId}`、共用路徑 `groups/{groupId}/notes/{noteId}`，沿用原本真實 Firestore Security Rules。
2. 私人／共用記事 `create/list/search/update/softDelete`；新記事由手機預先固定隨機 note ID、ACK 遺失後沿用相同 ID，初版內容吻合且尚未修改時允許安全確認，不會建立第二筆。所有修改透過 Firestore `runTransaction` 先讀取，檢查 `expectedVersion`，只允許後續版本 +1；逾期編輯拋出 `NOTE_VERSION_CONFLICT`（附遠端版本供介面提示），絕不覆蓋遠端。
3. `firestore.rules` 的 `safeNoteUpdate()` 新增 `resource.data.deleted == false`，禁止已標記刪除的記事利用手動版本更新恢復／重寫。**此處為軟刪除，不是立即清除資料或端對端加密**：歷史明文仍在 Firestore，並不宣稱已抹除所有快取。
4. `firebase-sync-probe/firebase-notes-test.html`：獨立繁體中文 iPhone 候選畫面，含 Google 帳號驗證、私人／共用切換、已授權共用群組、搜尋、建立、編輯、軟刪除、版本衝突提醒與保留當前輸入、帳號切換清空可見敏感內容、降權／撤銷後隱藏先前記事；資料一律以 `textContent` 顯示。
5. **仍有的明確限制**：候選畫面的草稿只在該 Safari 頁面記憶體內按帳號／範圍暫存，關閉頁面可能遺失；尚未提供真正持久離線草稿、即時 `onSnapshot` 同步、衝突的人工合併 UI 或兩支 iPhone 真機 PASS。UI 具備手動重新讀取及版本衝突保護，不宣稱秒級即時同步。
6. **絕對保護仍在**：`firebase-web-config.mjs` 的 `firestoreReadyForRealData = false` 完全不動，候選頁未通過 `===true` 時不初始化任何真實 Firestore。舊 `hongbin_crm_quick_notes_r73` 沒有讀／寫／匯入；`main` 未修改；沒有 Firebase deployment、Cloud Functions、Blaze、Billing 或新測試伺服器。

### 驗收證據及數量

- 既有 104 項真實官方 Firestore Emulator 規則及客戶端流程測試保持原樣。
- `firestore.notes-crud.test.mjs` 新增 **32 項**真實 Firestore Emulator 測試：兩個不同 Google UID 私人隔離、兩個同 UID 手機的過期版本衝突、固定 ID 防重複、群組 OWNER/EDITOR/VIEWER 能力、撤銷權限、軟刪除及被刪除記事後端禁止復活等。總計 **136 項官方 Emulator 測試**（104＋32）。
- `web-notes-preflight.test.mjs` 新增獨立的 Safari 候選 HTML／程式語法／安全閘／帳號／草稿／不讀舊資料的靜態測試（不計入 136 項官方 Emulator 測試）；再補上群組索引撤銷時清空舊內容的檢查。
- 已回讀程式提交 `58ea2f3a640db4794770c58877baebe0f932ad7b` 的 GitHub Actions `rules-emulator` 為 `completed/success` 且 commit-status 為 `firebase-sync-probe/rules-emulator=success`，包含當時 136 項官方 Emulator 與記事 UI 靜態檢查；後續多加的撤銷可見內容修正需要以最新提交的 CI 結果再核對，不可把較早 PASS 冒稱最新提交已通過。

### 接續工作與封版安全界線

- 首要待決 Gate：**建立無付費、獨立 HTTPS 網站測試入口**，核對 Firebase Google 授權網域及 iPhone Safari Popup 實際登入；目前未有安全可執行 URL，也沒有 Firebase 管理工具授權可部署。
- 隔離分支可繼續原定功能內的離線草稿持久化（需每帳號隔離）、版本衝突 UX、限額與權限負向測試。不得因施工進度自動整合正式 CRM 或讓 Firebase 真實規則從 deny-all 改為開放。
- 真正跨手機、跨 Google 帳號私人與共用同步、撤銷、離線與上限行為必須待真實測試與使用者驗收。既有 main 的客戶、報價、行事曆與 R73 本機記事未經額外同意一律不能更動或遷移。

## 2026-10-20｜iPhone Safari IndexedDB 離線草稿隔離候選 Gate

**隔離分支原有 `main` 禁改規則持續有效。此為開發候選，不是已上線服務。**

- 新增 `firebase-offline-drafts.mjs`：專屬資料庫 `honbin-crm-notes-local-drafts-v1`，與既有 CRM localStorage `hongbin_crm_quick_notes_r73` 完全分離。紀錄以已驗證 Firebase `uid`／`PRIVATE` 或 `SHARED`／群組 ID 組合為隔離索引；不儲存 Google Email、登入 Token 或密碼欄位；僅存記事編輯草稿、雲端版本及待建立文件的固定 ID。同一索引的非同步讀寫排隊，避免「先刪除後又被較早提交的保存復活」。
- `firebase-notes-test.html` 已接入 IndexedDB：使用者登入驗證後，只恢復目前 UID 與已授權記事範圍的草稿，明確標示「僅在這支手機保存，尚未雲端同步」。輸入會呼叫本機儲存；按「儲存」時先確定草稿及固定建立 ID 已存入 IndexedDB，再用原本 `runTransaction` 提交 Firestore。Firebase 連線錯誤保留草稿，不作自動重送；雲端成功後清除該草稿，取消操作則按使用者確認清除。
- 若共用群組被撤銷，頁面下一次確認伺服器授權後隱藏原記事並嘗試刪除本機共用草稿。若角色降為 `VIEWER`，標題／正文設為唯讀且不能恢復舊 `EDITOR` 草稿。因離線時無法即時讀取最新撤銷狀態，**不承諾沒有網路時也能立即撤銷先前已存在此裝置的明文內容**。
- **資安誠實限制**：IndexedDB 是瀏覽器站點的本機儲存，程式**沒有額外加密**；此處的帳號隔離是應用層 UI／讀取路徑隔離，**不是端對端加密，也不是用戶端資料庫的不可破解安全邊界**。同一裝置上能操作該站點或取得網站資料的人可能接觸本機草稿；需裝置密碼，避免公用手機。Safari 清除網站資料、隱私模式或空間回收可能使草稿遺失。尚無雲端離線備份、實機恢復 PASS 或跨手機同步 PASS。
- `firebase-offline-drafts.test.mjs` 新增 **19 項使用 `fake-indexeddb` 執行的 IndexedDB API 測試**：帳號與群組隔離、重新開啟物件仍能讀取、輸入資料欄位白名單、編輯版本、待建記事 ID、無效 ID、快速保存順序、保存與刪除競態、存儲不可用時拒絕。此 19 項是**本機 IndexedDB 測試，不能併入官方 Firestore Emulator 136 項**。
- `web-notes-preflight.test.mjs` 同步驗證離線草稿函式、安全 `false` 旗標、雲端交易前先保存 nonce、`VIEWER` 唯讀及不碰 R73 原始資料。
- **實際 CI PASS**：提交 `76b8adf2a25e3c006e42917b2b11ae4285ef0eb1`，GitHub `firebase-sync-probe/rules-emulator=success` 並已讀取完成的 `rules-emulator` GitHub Actions job：`HONBIN_OFFLINE_DRAFT_INDEXEDDB_PASS 19`、`HONBIN_FIREBASE_NOTES_WEB_STATIC_PASS 24`、`HONBIN_FIRESTORE_NOTE_CRUD_EMULATOR_PASS 32`、`FIRESTORE_EMULATOR_RESULT=success`，保留原全部 136 項官方 Firestore Emulator 測試。
- **部署 Gate 未改**：`firebase-web-config.mjs` 的 `firestoreReadyForRealData = false`，未部署到正式 Firebase Cloud Firestore，正式安全規則仍以使用者前次提供的 deny-all 畫面為基準（本輪無管理登入可即時重新查證）；未建立 HTTPS 測試網站，未整合 CRM `main`，未匯入舊 R73 記事，未使用計費或 Work。

**下一個有效工作包**：獨立且 Spark 免費的 HTTPS Auth 測試入口與 Firebase Google 已授權網域實機查證；也可在隔離分支做候選 UI 實際瀏覽器事件測試與版本衝突選擇／人工合併流程。不得把 IndexedDB 模擬器 PASS 說成 iPhone Safari 跨裝置同步已通過。
