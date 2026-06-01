#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version" 2>/dev/null || true)
DEFAULT_FILE="dist/hermes-desktop-${VERSION:-0.0.0}-portable.exe"
DEFAULT_TAG="v${VERSION:-0.0.0}"
FILE="${1:-${DEFAULT_FILE}}"
TAG="${2:-${DEFAULT_TAG}}"
NAME=$(basename "${FILE}")

if [[ ! -f "${FILE}" ]]; then
  echo "Missing file: ${FILE}" >&2
  exit 1
fi

TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^password=//p')
if [[ -z "${TOKEN}" ]]; then
  echo "No GitHub token from git credential" >&2
  exit 1
fi

python3 - <<'PY' "${TOKEN}" "${TAG}" "${FILE}" "${NAME}"
import json, os, sys, urllib.request

token, tag, file_path, name = sys.argv[1:5]
api = "https://api.github.com/repos/SugarWilliam/hermes-desktop"

def request(method, url, data=None, headers=None):
    h = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "hermes-desktop-release-script",
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read()
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read()

status, body = request("GET", f"{api}/releases/tags/{tag}")
if status != 200:
    print(body.decode(), file=sys.stderr)
    sys.exit(1)

release = json.loads(body)
release_id = release["id"]
upload_url = release["upload_url"]
html_url = release["html_url"]

for asset in release.get("assets", []):
    if asset.get("name") == name:
        asset_id = asset["id"]
        print(f"Deleting old asset id={asset_id} ({name})...")
        st, del_body = request(
            "DELETE",
            f"{api}/releases/assets/{asset_id}",
            headers={"Content-Type": "application/json"},
        )
        if st not in (204, 200):
            print(del_body.decode(), file=sys.stderr)
            sys.exit(1)
        break
else:
    print(f"No existing asset named {name}; uploading fresh.")

upload_target = upload_url.replace("{?name,label}", f"?name={name}")
print(f"Uploading {file_path} ({os.path.getsize(file_path) / 1e6:.1f} MB)...")
with open(file_path, "rb") as f:
    data = f.read()

st, up_body = request(
    "POST",
    upload_target,
    data=data,
    headers={"Content-Type": "application/octet-stream"},
)
if st not in (200, 201):
    print(up_body.decode(), file=sys.stderr)
    sys.exit(1)

asset = json.loads(up_body)
print(f"Uploaded: {asset.get('browser_download_url', asset)}")
print(f"Release: {html_url}")
PY
