# CRM 私人／多人共用記事｜Google Drive 附件儲存裁決（2026-10-20）

## 使用者已確認的需求
- 多本獨立共用記事簿，每本有不同成員與 ADMIN / EDITOR / VIEWER 角色；私人記事亦可有附件。
- 照片（iPhone 拍攝／相簿）、PDF、Excel、Word 等附件由**擁有者自己的 Google Drive**提供儲存空間，不使用其他成員的 Drive 容量。
- 每篇記事可連結多個附件；附件清單顯示檔名、類型、大小、上傳者、時間及開啟／預覽入口。
- 不開啟 Firebase Blaze、不使用付費 API／伺服器、不動正式 CRM main、不覆蓋舊 R73 本機記事；先 TEST，使用者實機驗收後才考慮整合。

## 嚴格分層
- Firebase Authentication：身分驗證。
- Firestore：記事文字、版本、記事簿成員與角色、附件 metadata（Drive fileId、groupId、noteId、mimeType、size、ownerUid、createdAt、status）；不得放二進位大檔。
- Google Drive：附件實體 bytes，由**擁有者帳號**建立及持有檔案，佔用擁有者儲存空間；不可假定每位成員自行上傳後檔案也算擁有者的容量。

## 安全與免費方案可行性 Gate（未 PASS 前不得部署附件）
1. 使用 Google Drive API 的 OAuth 授權；前端不存 refresh token、client secret 或服務帳戶金鑰，不要求共用者登入擁有者 Google 帳號。
2. 嚴禁 `anyoneWithLink` / `anyone` 公開分享。附件存取必須以實際 Google 身分與 Drive restricted ACL 為準，不能只靠 CRM 畫面隱藏。
3. 每本記事簿成員不同：建立／新增／降權／撤銷成員時，Drive 端存取權需一致，避免舊連結繞過 Firestore ACL。測試包含不同 Google 帳號、舊連結、角色變更、撤銷後直開檔案、非群組成員跨簿存取。
4. 若採每本簿專屬資料夾，須實測資料夾權限繼承、成員能否修改／刪除其他檔案、分享再分享等風險。尤其 EDITOR（可改記事）不等於必須擁有 Drive folder editor 權限。
5. **關鍵可行性風險：**無付費後端／持久擁有者授權時，其他成員無法自然地將檔案直接寫進擁有者的 Drive 並保證檔案所有權／容量歸擁有者。先做免費可行性 PoC，若不符合，明確標記限制並向使用者提出選項；不得暗中改成成員各自出空間、公開連結或付費後端。
6. OAuth 授權範圍最小化；既有 Drive 文件不可被掃描、移動、刪除或共用；建立專用資料夾並確認授權範圍及撤銷機制。任何刪除與權限變更需留稽核，失敗則 fail closed。
7. 大小／類型／配額與免費 API 限制須實測；Drive 的儲存額度取決於擁有者 Google 帳號方案，不能假設無限免費。
8. Firestore 正式雲端 Security Rules 目前仍 deny-all，`firestoreReadyForRealData=false`，此文件不是上線授權。先完成權限測試及 Google Drive PoC，才提出最小部署範圍及驗收。

## 開發順序
A. 維持已 PASS 的獨立 GitHub Pages Google 登入驗收。
B. 多本群組記事簿 UI／角色與 Firestore Emulator 回歸；不動 CRM main。
C. Drive 附件 OAuth、單一擁有者儲存及跨帳號存取的最小 PoC，確認完全免費、安全及 iPhone 可用。
D. 通過後才做多附件 UI、上傳、預覽、撤銷、衝突／離線處理；若 PoC 無法達成，先停在附件 Gate，不影響文字記事繼續施工。
E. 真實雙帳號／雙 iPhone 驗收；明確授權後才考慮正式 CRM 最小整合。
