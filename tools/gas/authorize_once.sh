#!/usr/bin/env bash
# One-time Google authorization setup for isolated GAS proof.
# NO Apps Script edits, NO printing tokens, NO commits containing credentials.
set -euo pipefail
umask 077
REPO="honbin002-design/-hongbin-personal-crm-beta"
BRANCH="probe/gas-no-work-20261019"
CRED_FILE="$HOME/.clasprc.json"

if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
  echo "STOP: 請使用 GitHub Codespaces 的 $BRANCH 測試分支。"
  exit 1
fi

echo "【1/4】檢查 Google clasp 工具"
if ! command -v clasp >/dev/null 2>&1; then
  npm install --global --no-audit --no-fund @google/clasp@3.2.0
fi
clasp --version

echo "【2/4】Google OAuth 首次授權"
if [[ ! -s "$CRED_FILE" ]]; then
  echo "請依終端機顯示的 Google 授權連結操作。"
  echo "僅使用你信任的 Google 帳號；授權完成後返回這個終端機。"
  clasp login --no-localhost
fi
if [[ ! -s "$CRED_FILE" ]]; then
  echo "BLOCKED: 授權檔尚未產生；未對 GitHub 寫入任何憑證。"
  exit 1
fi

echo "【3/4】直接寫入 GitHub Actions Secret（絕不輸出內容）"
if ! gh secret set CLASPRC_JSON --app actions --repo "$REPO" < "$CRED_FILE"; then
  echo "目前 GitHub 授權不足。以下僅要求額外 GitHub 登入，不要求分享 Token。"
  env -u GH_TOKEN -u GITHUB_TOKEN gh auth login --hostname github.com --web --scopes repo
  env -u GH_TOKEN -u GITHUB_TOKEN gh secret set CLASPRC_JSON --app actions --repo "$REPO" < "$CRED_FILE"
fi
env -u GH_TOKEN -u GITHUB_TOKEN gh secret list --app actions --repo "$REPO" \
  | grep -q '^CLASPRC_JSON[[:space:]]' || {
    # Some Codespaces use only their injected token for gh read access.
    gh secret list --app actions --repo "$REPO" | grep -q '^CLASPRC_JSON[[:space:]]'
  }
rm -f "$CRED_FILE"
echo "SECRET_SAVED: yes（已清除本機臨時授權檔）"

echo "【4/4】觸發獨立 GitHub Actions 部署驗證"
git -c user.name="GAS probe" -c user.email="gas-probe@users.noreply.github.com" \
  commit --allow-empty --no-gpg-sign -m "Trigger isolated GAS deployment proof after user OAuth" >/dev/null
git push origin "HEAD:$BRANCH"
echo "READY: GitHub Actions 已觸發；請回報 workflow 成功/失敗結果。"
echo "不會修改 main 分支、正式 CRM 或任何 Google Sheets。"
