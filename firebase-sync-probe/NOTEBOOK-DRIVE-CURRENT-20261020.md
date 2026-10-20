# HONBIN CRM｜多本共用記事簿＋Google Drive 附件｜2026-10-20 Checkpoint

## 使用者已裁決
- 多本共用記事簿，每本可邀請不同 Google 帳號；角色 ADMIN / EDITOR / VIEWER。
- 私人記事和共用記事都要能有照片、PDF、Excel、Word 等附件。
- **所有附件實體檔案使用擁有者本人 Google Drive 的儲存空間**；不得偷偷改為其他成員出空間、任何知道連結者可看或付費服務。
- iPhone 單機操作；Spark 免費方案；既有正式 CRM main、R73 本機記事及正式資料不動。

## 已提交的隔離候選程式
- `firebase-notebook-scope.mjs`：每本記事簿的獨立選取／角色能力；附件上傳仍固定 HOLD。
- `firebase-notes-test.html`：同一頁已加入新建記事簿、選擇記事簿、該本 ADMIN 邀請 Google Email、受邀者查看／接受邀請，保留私人／共用記事 CRUD、版本衝突、IndexedDB 草稿及安全 HOLD。
- `firebase-groups-test.html`：另有進階群組成員、權限與邀請管理候選。
- `firebase-drive-attachment-policy.mjs`：只驗證由擁有者實際持有、在指定資料夾、完整受限 ACL、無公開／網域／Google Group 分享、不同記事簿 ACL 不互相洩漏。這是純前端／測試預檢，不是 Drive 伺服器安全保證。
- `firebase-drive-member-directory.mjs`：用 Firestore 規則已約束的 Google Email 邀請 ACCEPTED 紀錄、UID 與 invitationId 配對，推導每本記事簿的成員 Email；拒絕跨簿、撤銷、未接受、重複或無法驗證的對應。
- `firebase-drive-attachment-policy.test.mjs`：28 項 owner quota／restricted ACL 模擬測試。
- `firebase-drive-member-directory.test.mjs`：19 項 Email 邀請與 Drive ACL 聯合隔離測試。
- `firebase-notebook-scope.test.mjs`：18 項記事簿與角色政策測試。
- 原 142 項 Firestore 官方 Emulator 測試不變；新測試接入隔離 GitHub Actions。

## 尚未完成，禁止誤報
- iPhone Google Firebase Authentication 獨立 Pages 實測已 PASS；**Firestore 正式雲端安全規則尚未部署**，正式狀態以前次 deny-all 截圖為準，需重新核對。
- `firestoreReadyForRealData=false`，候選記事頁不連真實 Firestore，未做雙帳號／雙手機資料同步驗收。
- Drive API OAuth、擁有者帳號專用資料夾、真實檔案上傳、檔案預覽、ACL 變更與撤銷尚未實作／未驗收。
- **最重要的儲存限制**：他人直接上傳到個人 My Drive 共用資料夾，不保證擁有權與空間都屬於資料夾擁有者。沒有可驗證的 owner-side 上傳代理時，只能先評估「擁有者上傳，授權成員查看」；不能宣稱其他成員能無條件上傳且使用擁有者容量。
- 不要因前端 ACL 預檢 PASS 就假定 Drive 的分享權限已撤銷；撤銷要由 Google Drive API 真正完成並重新讀回驗證。

## 下一關卡
1. 維持 Firestore Rules fail-closed，檢查真實 Rules 的使用者授權部署程序，核對 Project ID `honbin-crm-notes-spark`。
2. 使用者明確同意後，才在 Firebase Console 發布已通過 Emulator 的限定 Security Rules；先用合成資料／兩個 Google 帳號驗證私人互斥、共用權限、邀請及撤銷。
3. 再獨立部署候選記事站到測試 GitHub Pages，開啟限定 TEST Firestore gate；不碰正式 CRM main。
4. Drive OAuth owner-side 免費 PoC：實測 iPhone 上傳檔案 owner、容量歸屬、restricted ACL、成員撤銷後舊連結無法開啟；PoC 不通過則附件維持 HOLD。
5. 最後雙帳號／雙手機驗收，全部 PASS 才提出正式 CRM 最小整合方案。

## 不能回退
- 已通過的 Firebase Google 登入、現有記事與群組 Firestore Rules Emulator 測試、獨立 HTTPS auth-only 測試站。
- 任何真實上線、付費、正式資料遷移、Drive 檔案權限修改，都需符合既有授權與安全 Gate。
