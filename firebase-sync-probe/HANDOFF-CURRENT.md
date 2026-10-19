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
- 共用群組列表須只顯示已授權的群組；不得開放全域群組列舉。此項 Firebase 分支的授權索引和完整 UI **未完成**。
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

- **PASS**：既有 CRM 正式來源 SHA 保護 readback；隔離分支程式碼、69 項官方 Firestore Emulator 規則測試 CI success、公開 Firebase Web config 靜態檢查；過去截圖中的 Spark 專案／Auth/DB 創建。
- **HOLD**：實際 HTTPS auth smoke、Firebase 管理連線、Firebase 正式 ACL 部署、群組完整 UI、真實帳號雙手機同步、舊記事遷移、正式 CRM 整合。
- **嚴禁宣稱**：正式同步完成、Cloud Firestore 已開通真實應用權限、已發佈獨立 Auth 測試網址、已取得 Google 管理員 OAuth。
- 每輪作業要記錄：實際分支/HEAD、異動檔、CI 結果、Auth／Firestore 的實測或未測、main 兩個 SHA 再驗、安全與免費條件。當沒有執行資格時清楚標示 HOLD，不要求使用者耗費 Work。

## 2026-10-19 晚間後續施工｜安全共用群組索引 Gate

- 不變更 `main`，在隔離分支的 `firestore.rules` 新增 `users/{uid}/groupIndex/{groupId}`：個人可讀的**純索引指標**（`uid`, `groupId`, `createdAt`），沒有共用記事、群組名稱或成員名單。
- 索引由 Google Auth 的同 UID 建立；群組創辦人可與建立群組使用同一 Firestore 原子批次。已授權成員可為自己建立索引，不可偽造、改動他人的索引；已失去權限的人即使保留舊索引也無法讀取群組內容。
- `firestore.group-directory.test.mjs` 新增 **22 項真正 Firestore Emulator 規則測試**，驗證登入隔離、偽造索引、全域群組列舉拒絕、成員降權／撤銷及舊索引清除。
- `package.json` 的 `test:rules` 納入新套件；現在合計 **69 項官方 Emulator 規則測試**（原 47＋新增 22）。
- Commit `38e85f4c7fdddce25ccd38c613b2c2640a8ffa2d` 已由 GitHub commit-status 讀回 `firebase-sync-probe/rules-emulator = success`。此結果為**隔離官方規則模擬器 PASS**，不代表 Firestore 雲端部署、實際帳號登入或兩支手機同步。
- 本輪 GitHub Pages 正式 CRM 仍維持原本來源；不能在同一個現有 Pages 站點隨意改部署來源以發佈測試頁，避免覆蓋 main 上線服務。獨立 HTTPS 測試網域及 Firebase 後台管理授權仍是下個安全 Gate；**未建立任何額外付費服務或外部站台**。
