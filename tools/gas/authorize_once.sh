#!/usr/bin/env bash
# Isolated, one-time GAS deployment proof from a browser-based GitHub Codespace.
# No GitHub Secrets, no credential upload, no CRM edits, no Sheets access.
set -euo pipefail
umask 077

EXPECTED='probe/gas-no-work-20261019'
if [[ "$(git branch --show-current 2>/dev/null || true)" != "$EXPECTED" ]]; then
  echo "HOLD: 請先使用 GitHub Codespaces 開啟測試分支 $EXPECTED"
  exit 1
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'BLOCKED: Codespaces 缺少 Node.js 或 npm。'
  exit 1
fi

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/home" "$ROOT/probe"
export HOME="$ROOT/home"

echo '[1/4] 安裝獨立的 Google clasp CLI (3.4.1)'
npm install --prefix "$ROOT/tools" --no-audit --no-fund --silent @google/clasp@3.4.1
CLI="$ROOT/tools/node_modules/.bin/clasp"
"$CLI" --version

echo '[2/4] Google 官方授權：請在 iPhone 開啟終端機提供的登入網址'
echo '僅在 Google 官方網域輸入登入資料；授權碼只貼回 Codespaces 終端機。'
echo '不要把任何授權碼、Token 或終端機登入畫面傳給 ChatGPT。'
"$CLI" login --no-localhost

echo '[3/4] 自動建立完全獨立的測試 Script'
cd "$ROOT/probe"
"$CLI" create-script --type standalone --title "HONBIN GAS isolated no-Work proof"
cat > Code.gs <<'GAS'
function doGet() {
  return ContentService.createTextOutput('HONBIN GAS PROOF READY');
}
GAS
cat > appsscript.json <<'MANIFEST'
{
  "timeZone": "Asia/Taipei",
  "runtimeVersion": "V8",
  "webapp": {
    "access": "MYSELF",
    "executeAs": "USER_DEPLOYING"
  }
}
MANIFEST

echo '[4/4] 上傳測試內容、部署僅限本人查看的網頁'
"$CLI" push --force
"$CLI" create-deployment --description "Isolated owner-only automatic deployment verification"
echo 'RESULT: GAS_CREATE_PUSH_DEPLOY_PASS'
echo 'WEBAPP_ACCESS: MYSELF'
echo 'CRM_MAIN_MODIFIED: no'
echo 'GOOGLE_SHEETS_ACCESSED: no'
echo 'GOOGLE_CREDENTIAL_STORED_IN_GITHUB: no'
echo '臨時 OAuth 授權檔將隨測試環境自動清除。'
