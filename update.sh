#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_DIR="$ROOT_DIR/.update"
LOCAL_VERSION_FILE="$ROOT_DIR/version.json"
STATE_FILE="$UPDATE_DIR/state.json"
LOG_FILE="$UPDATE_DIR/update.log"
TMP_DIR=""

mkdir -p "$UPDATE_DIR"

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"
}

write_state() {
  local status="$1"
  local message="$2"
  local version="${3:-}"
  python3 - "$STATE_FILE" "$status" "$message" "$LOG_FILE" "$$" "$version" <<'PY'
import json
import sys
from datetime import datetime, timezone

state_file, status, message, log_file, pid, version = sys.argv[1:7]
state = {
    "pid": int(pid),
    "running": status == "running",
    "status": status,
    "message": message,
    "log_path": log_file,
    "updated_at": datetime.now(timezone.utc).isoformat(),
}
if version:
    state["version"] = version
with open(state_file, "w", encoding="utf-8") as handle:
    json.dump(state, handle, indent=2)
PY
}

fail() {
  local exit_code=$?
  log "Update failed with exit code $exit_code."
  write_state "failed" "Update failed. Check update.log for details."
  exit "$exit_code"
}

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

trap fail ERR
trap cleanup EXIT

download() {
  local url="$1"
  local output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 --retry-delay 2 -o "$output" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$output" "$url"
  else
    log "Missing curl or wget."
    return 1
  fi
}

restart_service() {
  local service_name="$1"

  if ! command -v systemctl >/dev/null 2>&1; then
    log "systemctl not found. Skipping restart for $service_name."
    return 0
  fi

  if ! systemctl list-unit-files "$service_name.service" >/dev/null 2>&1; then
    log "Service $service_name is not registered. Skipping restart."
    return 0
  fi

  if [ "${EUID:-$(id -u)}" -eq 0 ]; then
    systemctl restart "$service_name"
  elif command -v sudo >/dev/null 2>&1; then
    sudo -n systemctl restart "$service_name" || log "Could not restart $service_name without sudo permission."
  else
    log "sudo not found. Skipping restart for $service_name."
  fi
}

if ! command -v python3 >/dev/null 2>&1; then
  log "python3 is required."
  exit 1
fi

if [ ! -f "$LOCAL_VERSION_FILE" ]; then
  log "Missing local version.json."
  exit 1
fi

write_state "running" "Starting update."
TMP_DIR="$(mktemp -d "$UPDATE_DIR/tmp.XXXXXX")"
REMOTE_VERSION_FILE="$TMP_DIR/version.json"
ZIP_FILE="$TMP_DIR/update.zip"
EXTRACT_DIR="$TMP_DIR/extracted"

REMOTE_VERSION_URL="$(python3 - "$LOCAL_VERSION_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    data = json.load(handle)

url = str(data.get("update_url", "")).strip()
if not url:
    raise SystemExit("version.json is missing update_url")
if url.endswith(".json"):
    print(url)
else:
    print(f"{url.rstrip('/')}/version.json")
PY
)"

log "Downloading remote version metadata: $REMOTE_VERSION_URL"
download "$REMOTE_VERSION_URL" "$REMOTE_VERSION_FILE"

TARGET_VERSION="$(python3 - "$REMOTE_VERSION_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    remote = json.load(handle)

print(str(remote.get("version", "")).strip())
PY
)"
log "Remote version is $TARGET_VERSION."
write_state "running" "Downloading update package for version $TARGET_VERSION." "$TARGET_VERSION"

ZIP_URL="$(python3 - "$REMOTE_VERSION_FILE" "$LOCAL_VERSION_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    remote = json.load(handle)
with open(sys.argv[2], "r", encoding="utf-8") as handle:
    local = json.load(handle)

url = str(remote.get("update_url") or local.get("update_url") or "").strip()
if not url:
    raise SystemExit("Remote version metadata is missing update_url")
if url.endswith(".zip"):
    print(url)
else:
    print(f"{url.rstrip('/')}/update.zip")
PY
)"

log "Downloading update package: $ZIP_URL"
download "$ZIP_URL" "$ZIP_FILE"

mkdir -p "$EXTRACT_DIR"
log "Extracting update package."
write_state "running" "Extracting update package for version $TARGET_VERSION." "$TARGET_VERSION"
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$ZIP_FILE" -d "$EXTRACT_DIR"
else
  python3 -m zipfile -e "$ZIP_FILE" "$EXTRACT_DIR"
fi

SOURCE_DIR="$(python3 - "$EXTRACT_DIR" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
children = [path for path in root.iterdir() if path.name not in {".", ".."}]
directories = [path for path in children if path.is_dir()]

if len(children) == 1 and directories:
    candidate = directories[0]
    if (candidate / "version.json").exists():
        print(candidate)
        raise SystemExit

print(root)
PY
)"

if [ ! -f "$SOURCE_DIR/version.json" ]; then
  log "The update package does not contain version.json."
  exit 1
fi

log "Syncing source files into $ROOT_DIR"
write_state "running" "Syncing source files for version $TARGET_VERSION." "$TARGET_VERSION"
python3 - "$SOURCE_DIR" "$ROOT_DIR" <<'PY'
from pathlib import Path
import shutil
import sys

source = Path(sys.argv[1]).resolve()
target = Path(sys.argv[2]).resolve()

excluded_dirs = {
    ".git",
    ".idea",
    ".next",
    ".pytest_cache",
    ".ruff_cache",
    ".update",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    "node_modules",
    "venv",
}
preserved_files = {
    ".env",
    "backend/.env",
    "frontend/.env",
    "backend/local.db",
}

def should_skip(path: Path) -> bool:
    rel = path.relative_to(source).as_posix()
    parts = set(path.relative_to(source).parts)
    return bool(parts & excluded_dirs) or rel in preserved_files

for path in sorted(source.rglob("*")):
    if should_skip(path):
        continue

    rel = path.relative_to(source)
    destination = target / rel

    if path.is_dir():
        destination.mkdir(parents=True, exist_ok=True)
    elif path.is_file():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
PY

BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [ -d "$BACKEND_DIR" ]; then
  log "Installing backend dependencies."
  write_state "running" "Installing backend dependencies for version $TARGET_VERSION." "$TARGET_VERSION"
  cd "$BACKEND_DIR"
  if [ ! -d "venv" ]; then
    python3 -m venv venv
  fi
  ./venv/bin/python -m pip install --upgrade pip
  ./venv/bin/python -m pip install -r requirements.txt

  if [ -f "alembic.ini" ] && [ -x "./venv/bin/alembic" ]; then
    log "Running backend migrations."
    write_state "running" "Running backend migrations for version $TARGET_VERSION." "$TARGET_VERSION"
    ./venv/bin/alembic upgrade head
  fi
fi

if [ -d "$FRONTEND_DIR" ]; then
  log "Installing frontend dependencies and building."
  write_state "running" "Building frontend for version $TARGET_VERSION." "$TARGET_VERSION"
  cd "$FRONTEND_DIR"
  npm install
  npm run build
fi

write_state "completed" "Đã cập nhật phiên bản $TARGET_VERSION thành công." "$TARGET_VERSION"

log "Restarting frontend service if available."
restart_service "license-frontend"

log "Restarting backend service if available."
restart_service "license-backend"

log "Update completed."
