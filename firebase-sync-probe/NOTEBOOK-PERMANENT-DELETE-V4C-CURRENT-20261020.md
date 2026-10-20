# 鴻繽科技 CRM｜共用記事簿永久刪除 V4C 工程 CURRENT｜2026-10-20

## 使用者已裁決
- **永久刪除**整本共用記事簿，不採封存作為最終答案。
- 只有建立者可執行；刪除記事、軟刪除記事、成員、邀請、各帳號索引；不能影響其他記事簿、私人記事或全域核准帳號。
- iPhone 單機操作，0 元 Spark；不可要求 Blaze、付費 Cloud Functions／伺服器／新付費 API；不碰正式 CRM main/R73。
- 使用者的 `共用測試01` 已 PASS 建立，目前尚未獲得「刪除此本」的特定執行授權，因此**絕對不可直接刪除**。

## 最新 V4C 事實（已施工，不是規劃而已）
GitHub repo `honbin002-design/-hongbin-personal-crm-beta`；
隔離分支 `probe/gas-no-work-20261019`。

| 程式 | 實際內容與關卡 |
|---|---|
| `firebase-sync-probe/firestore.notebook-hard-delete-v4c.rules` | 只有 group owner 可以由 ACTIVE 單向切 DELETING；其他成員立即無權讀寫；不能恢復 ACTIVE；邀請收件匣 + 發送索引必須 `existsAfter` 同批實體刪除；會員 + 他人個別群組索引亦須同批刪除；只允許精確路徑清理。**根文件禁止前端硬刪** |
| `firebase-sync-probe/firestore.notebook-hard-delete-v4c.test.mjs` | **74 項真正 Firebase Firestore Emulator PASS**，含未配對刪除拒絕、合法配對成功、跨簿拒絕、成員被撤銷、軟刪除記事、鎖定無法復活、他本私人資料存續 |
| `firebase-sync-probe/firestore.notebook-hard-delete-v4b.rules` 及 `...v4.test.mjs` | 77 項獨立權限測試 PASS；此版為前一輪版本，**V4C 更安全，請勿以 V4B 上線** |
| `firebase-sync-probe/notebook-hard-delete-plan.mjs` 及 `.test.mjs` | 44 項掃描完整、資料隔離、owner only、root-last 與穩定重試識別碼安全測試 PASS |
| `firebase-sync-probe/notebook-hard-delete-v4c-service.mjs` | 真實 SDK 注入式程序：Google UID、擁有者、指定記事簿名稱、刪除 epoch、交易鎖定、全新伺服器掃描、每批 ≤10 個記事刪除、invitation+inbox 原子配對、member+pointer 原子配對、擁有者索引最後刪除、失敗重啟、重新從伺服器掃描。清理完成只會回報 `CONTENT_CLEANED_ROOT_LOCKED`，**不會聲稱根文件已刪** |
| `firebase-sync-probe/notebook-hard-delete-v4c-service.test.mjs` | **24 項 mock controller PASS**，包含 501 筆記事、斷線中斷、Firestore 成功刪除卻遺失 ACK 後安全重試、跨帳號阻斷、快取禁止用作最終證據 |
| `firebase-sync-probe/firebase-notebook-hard-delete-v4c-test.html` | iPhone 隔離候選 UI：只列本人成立的記事簿、盤點記事／成員／邀請筆數、親手輸入記事簿名稱與「永久刪除」、二次確認、失敗續刪與根文件警語。**安全 Gate false，不能接觸真實雲端** |
| `firebase-sync-probe/web-notebook-hard-delete-v4c-preflight.test.mjs` | **12 項 iPhone UI 靜態安全測試 PASS** |
| `.github/workflows/firebase-notes-emulator-tests.yml` | 舊 Firestore Emulator 142 項、owner allowlist 36 項、archive-v3 33 項等既有通過項也繼續綠燈 |

最近官方模擬器／UI CI：https://github.com/honbin002-design/-hongbin-personal-crm-beta/actions/runs/39374090221
如無法確認該 run 與最新版 HEAD 一致，需透過 GitHub 最新 HEAD check-runs readback，不依賴以上記錄推論新版本。

## 尚未完成／不允許宣稱
1. **純 Safari Firestore Security Rules 不能證明整棵動態子集合都已清空**；如果讓前端直接刪除 `groups/{gid}` root，可能留下孤兒資料。故 V4C 主文件仍保持 `DELETING`（無法復活）且 **`allow delete:false`**。
2. 無法以此架構保證真正的 root 文件物理刪除、Google 平台保留的備份立刻消失、他人已匯出的離線檔案被遠端抹除。這是產品／平台限制，不是測試沒寫。
3. V4C Security Rules **沒有**發布到 Firebase 真正專案 `honbin-crm-notes-spark`；該專案仍是先前已驗收的 global Google allowlist v2。
4. 未部署 V4C iPhone 操作頁，未執行跨 Google 帳號真實刪除驗收。沒有建立任何永久刪除任務；不需要使用者在 Firebase Console 操作。
5. 上一輪封存 Archive V3 是已 PASS 的舊候選，不得誤把封存當作這次使用者指定的永久刪除。
6. Firebase Spark 是免費方案但有讀寫配額限制；不可宣稱大量資料清理無配額成本／風險。
7. 失敗後重新讀取全量 server snapshot 才准接續，不可用 localCache 宣稱完成。

## 下一步（仍在隔離 TEST）
1. 設計**可信的最終 root hard-delete**方案，例如真正受控的擁有者 Firebase Console／具備正確稽核能力的特權執行器；要求 0 成本且 iPhone 可完成，不能偷加 Blaze 或暴露長期憑證。無法找到無額外風險者，明確維持 root HOLD 並請使用者裁決。
2. 特別驗證「其他帳號已存的本機草稿」無法藉由重新登入復活；Firestore 鎖定後所有新的 server writes 應遭拒絕，但他人裝置上已存在的副本不能遠端刪除。
3. 如可信最終清理能成立，正式撰寫／測試 vNext root-finality Gate 和跨帳號端對端回歸，再由使用者於 iPhone 發布到 Firebase TEST；**只實測全新的虛構記事簿，先不碰共用測試01**。
4. 只有上述全部 PASS，才能將正式刪除流程整合到已完成私人記事 PASS 的獨立測試站，最後才考慮 CRM 正式版最小整合。

## 持續遵守
- 正式 CRM `honbin002-design/-hongbin-personal-crm-beta` 的 `main` 及正式 Pages 完全不動。
- Firebase Auth smoke 與 iPhone 私人記事 PASS 已鎖定，不重做。
- 不對現在真實雲端群組進行任何非明確指定的不可逆刪除；不得在工作流程過程中暗中改 Rules 或移除私人記錄。
