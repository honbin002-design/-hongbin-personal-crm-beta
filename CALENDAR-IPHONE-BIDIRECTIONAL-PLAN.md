# 鴻繽科技 CRM × iPhone 原生行事曆｜雙向同步施工計畫（2026-10-27）

## 現況與不能省略的限制

- 正式 CRM 是 GitHub Pages 靜態網頁，待辦存在**該 iPhone Safari/PWA 的 localStorage**，不是 Firebase 共用任務資料。不得因啟用同步而覆寫、清空、改寫既有報價、客戶、任務、記事、供應商進價。
- iOS Safari/PWA 沒有直接讀寫 Apple「行事曆」本機 EventKit 資料庫的權限。不能以 JavaScript 直接雙向操作 iCloud 行事曆。
- **零新增費用的可行路線**：專屬 Google Calendar（例如「鴻繽 CRM 待辦」）作中介。iPhone「設定 → App → 行事曆 → 行事曆帳號 → 加入帳號 → Google」，開啟行事曆同步。iPhone 原生行事曆必須將 CRM 待辦存到**該 Google 日曆**；若事件存在「iCloud／我的 iPhone」行事曆，不能自動當成 Google 日曆事件。
- Google Calendar API 需要 Google Cloud Console 開啟 Calendar API、OAuth 同意畫面、建立 Web OAuth Client ID、設定正式 GitHub Pages 來源。這需要帳號擁有者明確授權；**Client ID 可公開、Client Secret／refresh token／登入憑證不得寫入 GitHub Pages 或 localStorage**。
- 若使用者堅持只用 iCloud 行事曆、不新增 Google 日曆，需另行評估 iOS 捷徑配合人工觸發，不能假裝靜態網頁能直接雙向同步 iCloud。

## 同步資料與保護

- 對應欄位：CRM 待辦 `id/text/date/time/notes/customerName/done`，Google Calendar `eventId/summary/start/end/description/extendedProperties.private`。預設台南時區 `Asia/Taipei`。
- 只同步專用 Google 日曆，不讀取個人其他日曆；Google 授權僅於使用者明確按「連線／同步」時請求；短期 access token 只保留在記憶體。
- 一筆 CRM 待辦 ↔ 一筆 Google event；建立後保存對應 ID、雙方版本指紋。事件 `extendedProperties.private.honbinCrmTodoId` 用於偵測已存在連結，避免重複建立。
- 初次同步採「預覽差異 → 明確確認」；新 Google 事件可匯入 CRM，舊 CRM 待辦可建立 Google 事件。既有待辦不得直接變更 ID。
- 只有一方修改才可建議單向更新；雙方修改、對方刪除、對應遺失、時區不支援均標記衝突**不得自動覆寫**。
- **不自動刪除**任一端紀錄；Google event 的刪除不等於 CRM 待辦刪除；CRM 待辦不存在不代表要刪 Google event。
- Google 日曆不能原生承載 CRM 的完成狀態／客戶關聯等所有欄位；必須設計 private extendedProperties 或 metadata，同步前先確認。
- 不建立付費後端、不啟用計費，不影響既有 iPhone 系統推播；API 配額或授權失敗時應顯示錯誤，不可誤報已同步。

## 已施工（安全第一階段）

- `calendar-sync-core.mjs`：純函式、唯讀產生操作建議，無 Google API、Firebase、localStorage 或任何外部寫入。
- `tests/calendar-sync-core.mjs`：合成資料測試雙向修改、首次建立/匯入、重複事件映射、同時修改衝突、刪除保護、跨年日期、未填日期。
- `.github/workflows/r73-activate.yml`：納入 CI 驗證。此階段不要求使用者提供 Google 帳號密碼或存取憑證。
- 尚**未**連接真實 Google Calendar API、未建立 OAuth Client、未改動正式 CRM 待辦資料，也未宣稱已完成雙向同步。

## 後續施工 Gate

1. 確認 iPhone 原生行事曆可接受「Google 日曆」為 CRM 專用日曆（而非只同步 iCloud）；使用者仍可在原生行事曆檢視與編輯。
2. 由最高權限使用者在既有／新的 Google Cloud 專案啟用 Google Calendar API 並建立 OAuth Client ID，限定正式 GitHub Pages origin。不得公開 client secret。
3. 在正式 CRM 加入 opt-in「連接 Google 日曆／選擇專用日曆／預覽同步差異／確認同步」UI，只有登入並授權後執行；不影響現有備份還原。
4. 實作 Calendar API 的 list/get/insert/patch（不提供 delete）、重試與版本衝突、同步映射與安全 checkpoint；以 ETag/If-Match 避免覆寫遠端修改。
5. 測試單向/雙向/同時修改、離線重試、權限撤銷、時區、同名不同 ID、防重複、跨日/跨年、跨手機本機資料差異。最後由使用者 iPhone 原生行事曆實機 PASS 才標示完成。

**保護原則**：零新增費用；任何正式資料改寫須使用者在預覽後明確確認；原始待辦永不清空。
