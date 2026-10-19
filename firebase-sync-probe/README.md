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
