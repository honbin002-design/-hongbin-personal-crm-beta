# HONBIN CRM 共用記事簿封存／恢復候選｜2026-10-20

## 使用者需求與現況
- 使用者以 iPhone 在實際 Firebase TEST 雲端記事中，已 PASS 私人記事、建立一本「共用測試01」，詢問為何無法刪除整本記事簿。
- 根因：**目前已發布的白名單 v2 Security Rules 對 `groups/{groupId}` 設定 `allow delete: if false`**；用戶端也沒有整本刪除操作。不可用前端硬刪、移除群組索引等方法假裝刪掉；那不會撤銷其他人的資料存取。
- 先實作 owner-only **可逆封存** 取代永久刪除，避免多手機共同記事意外清除。

## 已完成，僅在隔離分支
- 新候選 `firebase-sync-probe/firestore.notebook-archive-v3.rules`：保留既有白名單；新增 `archivedAt` 伺服器權限 Gate。只有群組真正建立者能封存／恢復；群組 ADMIN 不能越權。封存後即刻拒絕建立者、編輯者、檢視者對該本記事的讀寫，禁止接受封存群組的新邀請；擁有者只能讀取記事簿 metadata 進行恢復。
- Firestore 硬刪整本群組 `allow delete:false` 未放寬；記事與成員仍留存供恢復。未封存的舊版群組不受影響。
- 新測試 `firebase-sync-probe/firestore.notebook-archive-v3.test.mjs` **33 項 Firestore 官方模擬器 PASS**，包含原有共用記事、編輯者／管理員不可封存、建立者資料恢復、跨群組隔離。
- 既有白名單 36 項與基礎 Firestore 142 項也保持 PASS。
- `firebase-sync-probe/firebase-group-service.mjs` 新增 `isNotebookOwner`、`archiveNotebook`、`restoreNotebook`、`listArchivedNotebooks`，隱藏封存項目但留復原入口。
- `firebase-sync-probe/firebase-notes-test.html` 新增封存與恢復按鈕、封存前兩次確認、未儲存草稿禁止封存、封存清單顯示在共用記事頁；不使用永久刪除。
- `firebase-sync-probe/web-notes-preflight.test.mjs` 新增 3 組靜態 Gate。
- CI job success: https://github.com/honbin002-design/-hongbin-personal-crm-beta/actions/runs/39370570734

## 尚未上線／下一步
1. 真正已發布的 Firebase v2 白名單規則**尚未更動**；v3 僅測試候選。不要宣稱目前 iPhone 網站有封存按鈕。
2. 若要正式啟用，需先設計安全的 iPhone 一鍵複製新版 v3 規則部署頁：以既有白名單 owner readback 確定登入者是唯一擁有者，使用其 Firebase UID 才能產生規則。
3. 使用者於 Firebase Console 僅對 TEST `honbin-crm-notes-spark` 再發布 v3，驗證真實 owner/admin/read-deny；然後將同一版本群組服務與 UI 最小部署到獨立 `honbin-crm-auth-test` 的 `notes-preview.html`。
4. 用「共用測試01」或新造另一測試本進行封存與恢復的 iPhone TEST 驗收；**不自動封存使用者已建立的任何記事簿**。
5. 正式 CRM main / R73、實際客戶資料、收款、OAuth/Google Drive 付費附件均不得碰。
