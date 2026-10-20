# 鴻繽科技 CRM｜V4D 永久刪除｜最新唯一 CURRENT（2026-10-20 台南時間）

## 高優先級決議
使用者選擇「永久刪除整本共用記事簿」，拒絕以封存替代。不得默默刪除已有的「共用測試01」、私人記事或其他任何正式資料。所有不可逆資料刪除必須由使用者明確指定目標與二次確認。免費 Firebase Spark / iPhone-only；不改正式 CRM main、不升級 Blaze。

## 已完成與真實驗證
- Firestore V4C 規則 `firebase-sync-probe/firestore.notebook-hard-delete-v4c.rules`：OWNER-only DELETING 鎖，無復原 ACTIVE，成員與發送邀請 `existsAfter` 成對原子刪除；禁止前端根文件直接刪除。官方 Emulator 74 項 PASS。
- V4D 規則 `firebase-sync-probe/firestore.notebook-hard-delete-v4d.rules`：繼承 V4C，新增當根文件已由具特權的 Firebase Console 實體刪除後，擁有者用自己殘留的 index pointer 只能讀取**不存在**的主文件狀態；絕不因此讀到仍存在的別本內容。官方 Emulator 14 項 PASS。
- `notebook-hard-delete-v4c-service.mjs`：只有真正 OWNER 能先讀取伺服器資料、輸入記事簿名稱鎖定，再用 10 筆一批／兩兩原子交易逐批清理；每步成功才回報進度。保留 OWNER 的單一索引直至最後可信根文件刪除，以供 iPhone 意外關閉後續刪。後續由 OWNER 在 Firebase Console 手動精確刪除根文件，再用雙重 server readback 確認不存在、清理自己最後索引。重載 Safari 失去 receipt 時只可清除 owner 自己的失效索引，不能宣稱過往完整清理。Mock controller 38 項 PASS。
- `notebook-hard-delete-plan.mjs`：44 項 fail-closed 盤點 manifest 及跨帳號路徑安全測試 PASS。
- `firebase-notebook-hard-delete-v4c-test.html`：獨立 iPhone 候選，手動輸入名稱與「永久刪除」、兩次確認、進度、再接續、主文件 Firebase Console 路徑複製／再次確認。13 項 UI 閘門 PASS。
- 額外 V4C Firestore 官方 Emulator batch 壓力測試 7 項 PASS，實際 26 筆記事採 10/10/6 刪除交易，非純 JS 模擬。
- 既有共用記事、私人記事與 owner allowlist 回歸仍 PASS，絕對不能把其前一個封存 V3 當成永久刪除方案。

## 2026-10-20 新增：兩個獨立 iPhone 網頁已成功部署
獨立網站（**不是正式 CRM**）GitHub repo `honbin002-design/honbin-crm-auth-test`，main HEAD `b403a4e6d245f975ee2ef457f0e1fee731964824`。

1. 安全預覽： https://honbin002-design.github.io/honbin-crm-auth-test/notebook-hard-delete-v4d-test.html
   - 全部實際刪除功能**嚴格停用**。其專用 `notebook-delete-hold-config.mjs` 固定 `firestoreReadyForRealData=false`，即使正常同步記事使用 `notes-preview-config.mjs=true` 也不會意外啟用刪除。
   - 根目錄新增 `notebook-hard-delete-plan.mjs`、`notebook-hard-delete-v4c-service.mjs` 作為獨立腳本依賴；絕不載入既有 CRM 正式腳本。
   - `notebook-hard-delete-v4d-preflight.mjs` 14 項安全檢查 PASS。

2. 擁有者 V4D 規則複製頁（**只複製，暫勿發布**）： https://honbin002-design.github.io/honbin-crm-auth-test/firestore-notebook-hard-delete-v4d-deploy.html
   - 模板嵌入隔離分支已官方 Emulator 通過的完整 V4D Firestore 規則 407 行。
   - Google Auth verified、Google provider UID、**先從現有 Firebase 已發布規則確認僅原擁有者可 list `approvedAccounts`**，驗證後才啟用複製並代入 UID。
   - 無 Firebase 規則部署功能，無 Firestore 寫入功能，並移除直接前往 Firebase 發布頁的行動連結。
   - `firestore-notebook-hard-delete-v4d-preflight.mjs` 16 項檢查 PASS。

GitHub Actions：
- 安全檢查 PASS：https://github.com/honbin002-design/honbin-crm-auth-test/actions/runs/39379681094
- GitHub Pages 真實部署成功：https://github.com/honbin002-design/honbin-crm-auth-test/actions/runs/39379680422
- 既有 isolated 官方 emulator：https://github.com/honbin002-design/-hongbin-personal-crm-beta/actions/runs/39376305327
- 正式 CRM `honbin002-design/-hongbin-personal-crm-beta` 的 `main` 及正式 GitHub Pages 完全未更動；已發布的 Firestore 仍是 owner allowlist v2，不是 V4D。

## 剩餘 Gate／不可聲稱完成
1. 雖然 V4D emulator 通過，**真實 Firebase V4D rules 並未部署**，絕不可自行改變或誘導使用者在沒有檢查前發布。
2. 先引導使用者在 Safari 開啟 V4D **只複製**頁，驗證實際 Google owner 即時權限成功；若使用者明確授權才協助在 Firebase Console「規則」以完整全選替換並發布，逐頁截圖核對且失敗必停。
3. 真正 V4D 刪除功能仍需新建一份**專門限於全新虛構測試記事簿**的啟用旗標／條件，充分驗證多人邀請、跨帳號索引與在 iPhone 跨帳號權限拒絕。不可直接把已建立真實記事簿當作測試刪除物件。
4. V4D 手動 root 實體刪除只能在完整清理內容已 server readback PASS 後，讓 owner 在 Firebase Console 刪除**唯一指定 root 文件**，絕不能刪除整個 collection。由 TEST 頁再兩次讀回根不存在，最後移除 owner pointer。
5. Firestore 安全規則不能證明未知的動態子集合清空；特權管理員必須遵守完整掃描及實物檢查。雲端永久刪除亦不能遠端消除他人已下載的舊副本或平台備份立即消失。
6. Spark 免費額度、iPhone 限制與安全：不加付費後端、server、Cloud Functions、Blaze，也不顯示 OAuth secret 或原始 Firebase public config key。

## 下一步
讓使用者驗收上述兩個頁面可開啟（先不要要求貼到 Firebase）。若使用者報告 owner 已複製，才進一步確認規則部署的授權、完整有效內容與風險。正式 CRM 已 PASS 的部分不重做。
