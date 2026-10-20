# HONBIN CRM｜全域 Google 帳號白名單｜2026-10-20

## 使用者裁決
- 只有擁有者親自核准的 Google 帳號可使用 HONBIN CRM 記事。
- 核准帳號仍需每本記事簿各自的成員邀請與角色限制。
- 優先 iPhone 一鍵操作、零付費、正式 CRM main 完全不動。
- 使用者已授權進入 Firebase 安全規則部署階段；但**尚未在 Firebase Console 實際發布**。

## 已完成
- `firestore.owner-allowlist-v2.rules`：全域 Google verified Email allowlist `approvedAccounts/{lowercaseEmail}`；固定擁有者 UID 在 iPhone 規則複製頁動態代入；僅擁有者可新增、撤銷、恢復核准。未核准或已撤銷的 Google 使用者無法存取任何記事、記事簿、群組索引、邀請。
- `firestore.owner-allowlist-v2.test.mjs`：36 項真正 Firestore 官方 Emulator PASS，包括未核准、撤銷、重新核准、非法操作、非 Google Provider、未驗證 Email、不可讀他人記事等。
- 舊版 142 項 Firestore Emulator 測試也繼續 PASS；GitHub Actions `39362729317` rules-emulator SUCCESS。
- 獨立 auth repo `honbin002-design/honbin-crm-auth-test` 已建立 `firestore-owner-allowlist-deploy.html`，以 Firebase Google Auth 驗證本人，將該帳號 Firebase UID 只在本機代入規則，一鍵複製到剪貼簿，不上傳 UID 到 GitHub。
- 同一 auth repo `approved-accounts.html` 是手機端的全域核准／撤銷帳號管理頁。沒有擁有者讀取權限時，管理介面保持隱藏；每次變更仍由 Firestore Rules 強制檢查。
- 舊的 `firestore-rules-deploy.html` 仍禁用複製並連到新頁，避免發布無白名單的舊規則。
- Firebase Auth 單獨登入頁、原始正式 CRM main、Firestore 真實 Rules 均未修改。

## 使用者下一步
1. iPhone 開啟 `https://honbin002-design.github.io/honbin-crm-auth-test/firestore-owner-allowlist-deploy.html`。
2. 用**真正的 CRM 擁有者 Google 帳號**驗證；確認頁面顯示的 Email；勾選確認唯一管理員。
3. 按「一鍵複製完整白名單安全規則」。
4. 開啟 `https://console.firebase.google.com/project/honbin-crm-notes-spark/firestore/rules`，確認正確專案，替換全部舊規則並按「發布」。
5. 回覆「白名單規則已發布」。遇到付費升級、規則語法錯誤，停止並截圖。

## 重要安全界線
- Firebase Authentication 本身可能仍允許其他 Google 帳號完成身分驗證；**Firestore Rules 會拒絕未核准者的 CRM 資料存取**。要讓介面立刻登出未核准者，待正式 Rules 上線後接續實作。
- Firestore 正式雲端規則尚未由使用者發布，真實雙帳號驗收尚未進行。
- `notes-preview-config.mjs` 的 `firestoreReadyForRealData=false` 尚未解除；只有使用者回報 Rules 發布且讀回確認後，才可在獨立 TEST 開啟雲端同步。
- Google Drive 附件仍 HOLD；沒有 owner-side 上傳與 ACL 真實驗證前不可開放。
- `firestore.owner-allowlist.rules` 為被編譯錯誤淘汰的舊候選，不可使用；**唯一可發布候選是 `firestore.owner-allowlist-v2.rules`**。

## 測試與連結
- Emulator CI PASS: https://github.com/honbin002-design/-hongbin-personal-crm-beta/actions/runs/39362729317
- Pages auth repo: https://github.com/honbin002-design/honbin-crm-auth-test
- GitHub Pages helper: https://honbin002-design.github.io/honbin-crm-auth-test/firestore-owner-allowlist-deploy.html
