# 鴻繽科技 CRM R74｜iPhone GitHub 專用隔離 TEST 指引

> 僅限 **R74 TEST 候選版**。嚴禁合併 main、部署 R73 正式入口、匯入真實客戶資料。
> 使用 GitHub Codespaces，不使用 Netlify、另一個 GitHub 帳號或付費 API。
> Codespaces 並非無限量免費；只能使用個人 GitHub 方案內每月免費額度，**不允許超額計費**。

## 先確認零費用限制

- GitHub Codespaces 個人帳號含免費計算／儲存配額；目前可用餘額必須在 [GitHub Billing](https://github.com/settings/billing) 確認。
- 如果 GitHub 帳號設有付款方式，請先設定 Codespaces 預算和「Stop usage when budget limit is reached」，確認不會發生額外支出。
- 建議選擇最低規格 **2 cores**，測試完成立即停止並在確定不用後刪除 Codespace。
- 沒有可用免費額度或畫面要求付費時，**停止操作，不可接受付費／試用**。

## 使用 iPhone Safari 啟動 TEST

1. 點選 [GitHub Codespaces：僅建立 R74 分支 TEST](https://codespaces.new/honbin002-design/-hongbin-personal-crm-beta/tree/r74-safety-work-20261016)。
2. 核對 Repository 為 `honbin002-design/-hongbin-personal-crm-beta`、Branch 為 `r74-safety-work-20261016`，採用最低可選的 **2 cores**。
3. 點選 GitHub 畫面上的 `Create codespace`，等待程式空間啟動；無需自己安裝任何電腦程式或 API Key。
4. 在編輯器開啟 **PORTS**（連接埠）分頁，找到 `4174`／`R74 TEST`，點其「Open in Browser」／網址圖示，使用 iPhone Safari 開啟。
5. 開啟的網址應屬於 `https://...-4174.app.github.dev`（網址每個 Codespace 不同），且 Port Visibility 保持 **Private**；請勿改為 Public。
6. 私人測試首頁自動跳到 `r74-test.html`，確認網址網域驗證後，建立 `R74測試客戶甲`、`R74測試客戶乙` 等示範資料，轉往 R74 主頁。
7. 確認黃色／深色提示中有 `R74 TEST 候選版`，接著才開始測試。不需匯入現有主資料、不需另行授權正式資料。

**重要**：請勿使用 `https://honbin002-design.github.io/...` 當 TEST；GitHub Pages 同帳號的不同儲存庫與路徑共用同一來源的 Local Storage。

## 測試後安全關閉

- 前往 [GitHub Codespaces 管理](https://github.com/codespaces)。
- 在此次 R74 Codespace 的操作選單選 **Stop codespace**。
- 確認不再需要測試環境後，可選 **Delete**；暫停計算不等於停止儲存配額使用。
- GitHub 免費帳號的 Codespaces 預設閒置自動停止時間為 30 分鐘，但最保險仍是**自行手動停止**。

## 不會變動的項目

- R73 正式 main 分支／正式 GitHub Pages。
- iPhone 上 `honbin002-design.github.io` 原有的客戶、報價、名片及其他 Local Storage 資料。
- 正式 PROD 記錄與現有 PASS/LOCKED 驗收結果。

## 已驗證與待驗證區分

- GitHub Actions WebKit 自動化測試確認基本 CRM 模組可運作，實際 iPhone Safari 仍須使用者驗證。
- Private Codespaces URL 只有建立 Codespace 後才由 GitHub 提供；**不可猜造固定 TEST 網址**。
- 現有 PDF 測試主要檢查 iOS 分享失敗時的下載連結；需 iPhone 確認實際 PDF 真實內容、排版及儲存。
- 尚未確認 Codespace 已由使用者啟動，不得聲稱 TEST 已部署可用。

## 故障處理

- 若 PORTS 看不到 `4174`，檢查 `R74 TEST` Codespace 終端輸出；在 GitHub Web VS Code 終端輸入 `python3 .devcontainer/r74_server.py --port 4174 --bind 0.0.0.0`，然後回 PORTS 檢查。
- 若提示憑證或 Github 登入，請在 Safari 登入原 GitHub 帳號；**不要把 Private 改成 Public**。
- 若看到 R73 或正式客戶資料，立即停止 TEST 並提供畫面，避免進行任何寫入操作。

參考：[GitHub 官方 Codespaces 分支直連說明](https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/setting-up-your-repository/facilitating-quick-creation-and-resumption-of-codespaces)、[GitHub 官方免費額度及計費](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces)、[GitHub 轉送連接埠](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace?tool=webui)。
