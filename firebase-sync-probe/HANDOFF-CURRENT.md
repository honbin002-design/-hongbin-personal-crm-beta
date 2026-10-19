# 鴻繽科技 CRM｜Firebase Spark 同步記事｜唯一接續交接基準
更新日：2026-10-19（台灣時間）。僅測試分支，**不得代表正式部署或驗收**。

> 本文件根據本輪 GitHub 即時讀回、既有 `firebase-sync-probe/README.md`、`gas-sync-probe/STATUS-AND-GATES.md`、安全規則及使用者本次交接補齊。前一對話視窗的完整逐字內容未成功從跨視窗檢索服務讀回；**不得假稱已逐字核對整段對話**。疑義以使用者明確裁決與現有來源為準。

## A. 唯一正式範圍、禁止事項

- GitHub：`honbin002-design/-hongbin-personal-crm-beta`
- GitHub Pages 正式入口：`https://honbin002-design.github.io/-hongbin-personal-crm-beta/`
- 正式分支 `main`：本次只讀不可改，2026-10-19 核對 HEAD `67ace1636c0252680126abdd6fc5daf968542d2f`。
- 正式 `index.html` Git blob SHA `909d05477b2b33e9238798529283cad395750c0b`、`simple-core.js` SHA `4c7d58ba03a1a5ed53c797060b9d2572cfc0776c`；本輪再讀相符。
- 唯一新功能施工分支 `probe/gas-no-work-20261019`；本次初始最新 HEAD `41e264989d26de857653111112e04e15bbb81c47`，相對 main ahead 146 / behind 0，diff 全為新建的隔離施工檔與測試 workflow；正式來源檔沒有差異。
- 新方案來源 `firebase-sync-probe/`；舊 GAS 原型 `gas-sync-probe/` 保留為歷史備援，**不再花 Work 額度解決未驗證的 GAS 雙層部署**。
- 原 CRM 八大模組（客戶、供應商、產品、專案、報價單、行事曆、原隨手記及其他已通過功能）完全維持既有內容與行為；不動 ERP / HCMD / PDA5 或任何正式資料。
- 只許在隔離分支施工、驗證及回讀；**未取得使用者正式上線同意不得合併或推送 main**。
- 禁止付款資料、Billing 帳戶、Blaze、Cloud Functions、付費 Firebase／GCP API、付費伺服器／備份／PITR、試用扣款；只採 Google Firebase Spark 長期免費配額，額度滿時允許同步暫停、不可偷偷升級。
- 不要求使用者終端機、Cloud Shell、Codespaces、手貼程式碼或手動執行部署；使用者僅需必要官方登入授權、少量 Safari 操作及實機驗收。不得自作主張啟動 ChatGPT Work 或其他可能收費流程。
- 不得憑 emulator／Node CI 成功宣稱真實跨手機同步成功。

## B. 使用者已定功能（保留而非重新蒐集）

### 私人記事
- 使用自己的 **Google 登入**，Firebase Auth 以穩定 `uid` 為身分，不採信前端自報 Email 當作存取身分。
- 同一 Google 帳號跨多支 iPhone 同步；不同 Google 帳號完全隔離。
- 具有記事建立、列表、搜尋、修改、刪除、清楚的手機介面；兩機更新使用版本檢查／交易防覆蓋，逾期版本應顯示衝突而非自動蓋過。
- 離線／網路斷線的草稿必須與「已雲端同步」清楚區分；在帳號切換時不得上傳前帳號的本機草稿，失敗可安全重試／冪等。
- 原 R73 本機隨手記 `localStorage['hongbin_crm_quick_notes_r73']` **不能自行覆蓋、刪除、接管或上傳**。遷移前先提供記事數量及內容預覽、得到明確授權、採防重複匯入；原有備份結構不改。

### 多人共用記事
- 可以建立共用群組，管理成員與記事；受邀者透過**已驗證的 Google Email**收取/查看邀請，接受後才取得群組權限；不得直接相信前端 Email，邀請接受與成員建立必須同一 Firestore 原子批次。
- 權限分為 `ADMIN`（群組管理／邀請／權限／刪除共用記事）、`EDITOR`（可讀寫記事，無管理員能力）、`VIEWER`（僅可查看）。群組創辦人永遠保留管理員身分，不可被降權／移除。
- 管理員可撤銷待接受邀請及成員權限。撤銷後新的讀寫一律拒絕，已消耗或撤銷的邀請不能再利用；手機收到伺服器拒絕後應清空共用內容和失效的編輯狀態。
- 共用群組列表須只顯示已授權的群組；不得開放全域群組列舉。此項 Firebase 分支的授權索引已通過模擬器，群組／邀請候選 UI 已施工但尚未真機驗收；完整記事 UI **未完成**。
- 成員共用、資料版本衝突、防重複建立、帳號切換、邀請管理，都需最後跨帳號/跨手機實際驗收。

## C. Google/Firebase 真實狀態（已由前次使用者 Safari 截圖確認，尚非本輪重新登入）

- 使用公司 Google 帳號建立 Firebase Project `HONBIN-CRM-NOTES-SPARK`（ID `honbin-crm-notes-spark`）。
- 使用者確認方案 **Spark／US$0**；Google Firebase Authentication 的 Google 供應商為「已啟用」。
- Cloud Firestore Standard `(default)` 已建立，目前前次讀取規則為 `allow read, write: if false;`：所有用戶端讀寫拒絕。**47 項已通過的完整規則目前沒有佈署到該真實資料庫**。
- Web App `HONBIN CRM Notes` 已註冊；公開 Web SDK config 位於 `firebase-sync-probe/firebase-web-config.mjs`。公開 config **不是**管理員 OAuth / Secret，亦**不**代表 Firebase 管理權限。
- Firestore 真實專案計費與已授權網域在本輪沒有 Firebase 管理連線可重新回讀；不能說目前已全部設好。
- Google 官方 Firebase 專用插件存在但本次查詢為**尚未安裝**，先前已建議過，**7 天內不得重複打擾使用者建議安裝**。不以無法直連為理由偷偷換付費平台。

## D. 真正做過的測試與不能冒稱的項目

- `firebase-sync-probe/firestore.rules`：Google 身分、私人 UID ACL、群組 ADMIN/EDITOR/VIEWER、Email inbox 邀請／同批次兌換、撤銷權限、版本必須 +1、安全預設拒絕。
- `firestore.rules.test.mjs` **32 項**＋ `firestore.invites.test.mjs` **15 項**，合計 **47 項 Google 官方 Firestore Emulator 引擎測試**；非手寫模擬 ACL。早期通過提交 `483918684bea15e43d7d139f2c6b61f2d79f9a0b`。
- 最新初始 HEAD `41e264989d26de857653111112e04e15bbb81c47` 的 `firebase-sync-probe/rules-emulator` Commit Status 本輪確實回讀為 `success`；其 CI 另執行 `web-auth-preflight.test.mjs` 靜態安全檢查。**這不是兩支手機 Google 登入的 PASS**。
- `firebase-auth-smoke.html`：iPhone Safari `signInWithPopup`、Google-only + verified Email + session 登入與登出檢查。此頁沒有 Firestore 存取，也無舊記事匯入。
- 此 auth smoke 檔**只有在隔離 GitHub 分支，不是可執行的 HTTPS 頁面**；Github Blob／Raw 連結不得誤作測試網址。
- 過去 GAS 原型有 Node CI PASS、部分真 Google Sheets 的建立／寫入／回讀／清除 PASS，但 GAS A→B 真實 OAuth/跨帳號部署仍 BLOCKED；不移植該證據到 Firebase 正式成功欄。

## E. 現在必須完成（依序，不重作 PASS）

1. 確認 Firebase Spark 無綁定計費及 Authentication → Settings → Authorized domains 的所需網域（正式 `honbin002-design.github.io` 只是未來可能來源；實際測試來源要與實際 HTTPS 測試頁相符）。
2. 找到**不動 main、不付費、不要求使用者貼程式或 Work**的獨立 HTTPS 測試發佈方式。Firebase Hosting 如要使用，必須先證實符合 Spark 免費額度、能由已連接的安全管理工具部署且確定不改正式 CRM；未證實前 HOLD，不自行新增第三方付費環境。
3. 在獨立測試網頁上做一個 Google 帳號的 Safari 登入、登出、切換與 Email verified 真實測試。僅允許 Auth，維持 Firestore deny-all。
4. 群組安全索引與新增 22 項 Firestore Emulator 測試 **PASS**；接續完成群組成員及 Email 邀請列表／接受／撤銷功能，以及私人／共用記事完整手機 UI；每階段應保留全部 69 項已有的官方規則模擬器回歸。**不因本項開發而啟用真實資料庫寫入**。
5. 特別檢查多支手機同時寫入時，Firestore Transaction／版本衝突 UI、刪除策略、重送冪等、帳號切換與離線草稿隔離。
6. 經授權且完成規則安全審查，才部署**已測試的限定規則**並僅以合成測試資料測試。避免使用者原有記事或正式客戶／報價／庫存資料。
7. 真實兩個不同 Google 帳號、多支 iPhone：私人互斥、共用邀請與角色、撤銷即拒絕、衝突提示與不丟草稿；需人工最後驗收，不得代稱 PASS。
8. 確認所有 Gates PASS，再提議「僅增加私人／共用記事頁面入口」的最小整合 diff；**使用者明確同意後**才動 main。舊記事匯入另需逐次同意，不綁在部署授權中。

## F. 目前總結

- **PASS（歷史原始階段）**：既有 CRM 正式來源 SHA 保護 readback；隔離分支程式碼、69 項官方 Firestore Emulator 規則測試 CI success、公開 Firebase Web config 靜態檢查；過去截圖中的 Spark 專案／Auth/DB 創建。
- **HOLD**：實際 HTTPS auth smoke、Firebase 管理連線、Firebase 正式 ACL 部署、候選記事與 IndexedDB 草稿的 iPhone Safari 真機驗收、即時同步、真實帳號雙手機同步、舊記事遷移、正式 CRM 整合。
- **嚴禁宣稱**：正式同步完成、Cloud Firestore 已開通真實應用權限、已發佈獨立 Auth 測試網址、已取得 Google 管理員 OAuth。
- 每輪作業要記錄：實際分支/HEAD、異動檔、CI 結果、Auth／Firestore 的實測或未測、main 兩個 SHA 再驗、安全與免費條件。當沒有執行資格時清楚標示 HOLD，不要求使用者耗費 Work。

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
