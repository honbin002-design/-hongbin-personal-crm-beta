# HONBIN CRM｜共用記事簿永久刪除｜安全清理與測試計畫
日期：2026-10-20
狀態：**設計與純測試階段／不可操作真實刪除**
使用者裁決：永久刪除整本共用記事簿，記事、成員、邀請均不可恢復；不是封存。

## 0. 不動範圍
- 鎖定專案：Firebase Spark `honbin-crm-notes-spark` 獨立 TEST；正式 CRM GitHub main / R73 完全不動。
- 現有私人記事雲端儲存及重載：使用者 PASS。新增「共用測試01」：使用者 PASS。任何實際已建立記事簿均不得自動刪除。
- 現行已發布 Firestore owner Google allowlist v2 繼續運作；不將隔離候選的 archive-v3 直接上線。
- Google Drive 附件沒有啟用；若將來有附件，必須先設計 Drive 子樹、owner、ACL、回收站永久刪除等獨立權限與容量流程，**不能宣稱目前已清理 Drive 附件**。

## 1. 從既有程式核對的實際資料模型
| 位置 | 內容 | 永久刪除必要動作 |
| --- | --- | --- |
| `groups/{gid}` | 建立者 UID、名稱、時間 | 最後刪除或轉不可還原最小墓碑 |
| `groups/{gid}/notes/{noteId}` | 共用記事文字、含 `deleted:true` 的軟刪除記事 | 全數列舉、實體刪除；不得只刪可見的記事 |
| `groups/{gid}/members/{uid}` | ADMIN/EDITOR/VIEWER、已撤銷者也可能仍在 | 全數列舉、實體刪除 |
| `groups/{gid}/sentInvites/{inviteId}` | 送出邀請的索引、收件者 Email | 全數列舉、實體刪除 |
| `inboxes/{email}/invites/{inviteId}` | PENDING/ACCEPTED/REVOKED 的真實邀請 | 依各筆 sentInvites 精確路徑刪除；不可刪別本邀請 |
| `users/{uid}/groupIndex/{gid}` | 建立者及曾加入者的群組索引 | 依 owner UID 和全部 member UID 精確路徑清除 |
| `users/{uid}/notes/{noteId}` | **私人記事** | **絕對禁止碰觸** |
| `approvedAccounts/{email}` | 全域 CRM 帳號白名單 | **絕對禁止碰觸** |
| 其他 `groups/{otherId}` | 其他記事簿 | **絕對禁止碰觸** |

**Firestore 不會因刪除 `groups/{gid}` 自動刪除其子集合。** 直接刪主文件屬於禁止方案。

## 2. 應實作的永久刪除狀態機（尚未上線）
1. **PREVIEW**：在 iPhone 顯示記事簿名稱、建立者、所有內容／成員／邀請／索引的伺服器盤點數量。取得全部 server-side 列舉，不准依賴本機快取；無權限或漏掃即停止。展示「不可恢復」與不可逆範圍。
2. **OWNER_CONFIRM**：僅真正的**記事簿建立者**可執行；不是普通群組 ADMIN，也不是別本記事簿管理員。除了確認視窗，要求手動輸入記事簿名稱，第二次確認永久刪除；禁止草稿未儲存時啟動。
3. **LOCK**：用原子交易將指定群組切換到 `DELETING`，寫入隨機 deletionId、deletingAt。Firestore Rules 拒絕此群組全部成員／管理員的新記事、更新、邀請、接受邀請和群組列表存取；但允許真正建立者在限定 path 清理。不可從 DELETING 恢復 ACTIVE，避免競態和資料復活。
4. **CLEAN_INBOXES**：逐一刪除 **該群組** sentInvites 對應 Email inbox 的唯一邀請，包含已接受與已撤銷。只用從可信 sentInvites 紀錄取得的 Email＋inviteId，不可列舉或修改對方所有邀請。
5. **CLEAN_CHILDREN**：逐一實體刪除該群組所有共用記事（含已軟刪除）、送出邀請索引和成員紀錄；每批最多 10 個動作，並考慮 Firestore Rules 10/20 access calls 限制。不能依賴「刪主文件 = 刪子集合」。
6. **CLEAN_POINTERS**：依全員 UID 與建立者 UID 刪除 `users/{uid}/groupIndex/{gid}`；規則必須新增有限度的「建立者針對本人 DELETING 群組之確切 gid 索引 get/delete」能力，**絕不給跨使用者群組索引的 list**。
7. **SERVER_READBACK**：再次從伺服器逐項檢查群組 notes、members、sentInvites 均為空，並對清單裡全部 inbox/pointer 精確 `get` 取得不存在；驗證 deletionId 與 owner UID 未變且群組仍 DELETING。
8. **FINALIZE**：只有所有伺服器檢查都通過才允許最後完成。嚴格實體硬刪主文件的安全性仍有重要前置 Gate（見下一節）。
9. **RESUME**：Safari 關閉、網路斷線或批次失敗，保留 `DELETING` 及 deletionId；重新登入後由原建立者繼續，不能改由其他群組 ADMIN 接手。任何失敗**不得**顯示「已刪除成功」。
10. **POST_VERIFY**：再次確認原本的 root（或墓碑狀態）和所有外部 reference；其他記事簿、私人記事、全域白名單仍正常；更換帳號後舊連結不得存取內容。

## 3. 現有架構的真正 blocker／不可假裝已解決
- 目前公開 v2 規則 `groups/{gid}`、`members`、`sentInvites`、`inboxes` 的直接刪除多處為 `allow delete:false`，不能只增加前端按鈕。**需另建 v4 Rules 並以 Emulator 驗證後、由使用者在 iPhone 明確發布**。
- 原有群組 Admin 可在其他人 Email inbox **get** 某張邀請，但不能列舉整個 inbox。刪除設計只准建立者對該 gid＋inviteId 做 get/delete；其他邀請完全隔離。
- 鎖定 DELETING 後若未新增 owner-only cleanup read/deletes，就連擁有者都無法讀子集合。Security Rules 的鎖與清理白名單要一起設計。
- **最關鍵：Firestore Security Rules 無法做「查詢所有子集合及跨使用者索引都已清空」的伺服器端完整證明。** 純 Safari 客戶端宣稱已掃完，並不能當成不可偽造的 server-side 證據。若允許前端自由刪除 root，可能在子集合尚未清完前留下孤兒資料。
- 零成本、iPhone-only、無持續後端的安全折衷是**不可恢復的最小墓碑**（去除名稱、文字、成員、邀請，僅留 owner/deletionId/deletedAt 用來封鎖復活），可保證內容永久清除並保留垃圾回收追溯；**但仍有一份沒有記事內容的根文件，不等於所有文件 100% 實體硬刪**。
- 若使用者堅持「根文件也絕對零殘留」，則在驗證所有掃描範圍完整後，還需要可信的特權執行器或由擁有者於 Firebase Console 做最後受控收尾，且另行驗證無任何殘留。不得跳過此 Gate，也不得偷偷改 Blaze 付費方案／公開 Cloud Functions。
- 已登入他人裝置先前看過或下載的內容，無法用資料庫刪除來遠端消除；只能保證之後無權從雲端取得。

## 4. 自動化 Gate（預計驗收，不得用未完成宣稱 PASS）
- 建立者 vs 一般 ADMIN/EDITOR/VIEWER/外人：僅建立者可鎖定、清理、最終完成。
- 鎖定後：禁止新增記事、修改、恢復舊邀請、接受邀請、建立新索引；已存在的舊連結再試必拒絕。
- 含軟刪除記事、撤銷成員、邀請不同收件者、同人重複索引、多人多本：逐項清理正確。
- 刪除只匹配 `groups/{gid}`、該群組送出邀請、精確 inbox 路徑和精確 index path，絕不碰私人記事、全域白名單、其他本記事。
- 超過 500 筆記事、多批次與 Firestore Rules 讀取次數限制，網路中斷、重複提交、頁面關閉、同時兩位管理員操作、權限撤銷與換帳號。
- 伺服器回讀全部歸零；若任何 inbox、pointer、members 或 notes 尚存，不能進 FINAL。
- 成員事後使用舊 Google 帳號、舊 URL、原本的本機草稿都不得使已刪除記事復活。
- 模擬器測試 PASS 後，再跑兩個不同 Google 帳號的**虛構資料** TEST 驗收；正式 CRM 完全不碰。

## 5. 目前實際施工
- 已新增純函式模組 `notebook-hard-delete-plan.mjs`：在所有三類清單的 server 完整盤點且群組 DELETING 的前提下，產出 **僅乾跑、不執行** 的跨路徑清理 manifest，root 永遠不在清理清單。
- 已新增 `notebook-hard-delete-plan.test.mjs` 42 項合成測試：所有路徑隔離、跨群組拒絕、漏掃拒絕、重複拒絕、建立者授權、群組鎖與 root-last、伺服器讀回門檻、分批 <= 10。
- 此為 **純計畫與靜態安全 Gate**，不是真正的 Firestore 永久刪除 Emulator 實作，也不會動到現有任何筆正式資料。
- 隔離分支上的 `archive-v3` 僅為先前嘗試，永久刪除改為**獨立 v4 設計**；不得請使用者發布 archive-v3 當成永久刪除功能。

## 6. 下一步工程與發布條件
1. v4 Firestore Rules：嚴格定義 DELETING、owner-only enumerate/delete、精確跨帳號 pointer get/delete、唯一邀請刪除、root-finality；真實 Emulator 負面測試。
2. 支援大量記事且可恢復刪除進度的客戶端實作；不洩漏 Email、Token、Firestore 無權路徑。
3. 只在 TEST 建立全新虛構多成員記事簿進行全流程驗收，保留使用者「共用測試01」。
4. 使用者看見刪除預覽，明確同意特定記事簿名稱後才執行；絕不依靠隱含「繼續工作」對真實資料做不可逆刪除。
5. 若證明不了 root-hard-delete 安全性，提供清楚標示的「資料永久刪除＋極簡防復活墓碑」方案或等待可信特權收尾，不假報完全物理刪除。
