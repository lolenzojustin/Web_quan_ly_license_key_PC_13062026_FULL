import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, status

from app.api import deps
from app.models.admin import Admin

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[4]
VERSION_FILE = PROJECT_ROOT / "version.json"
UPDATE_SCRIPT = PROJECT_ROOT / "update.sh"
UPDATE_STATE_DIR = PROJECT_ROOT / ".update"
UPDATE_STATE_FILE = UPDATE_STATE_DIR / "state.json"
UPDATE_LOG_FILE = UPDATE_STATE_DIR / "update.log"


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Missing {path.name}.",
        )

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid JSON in {path.name}: {exc}",
        ) from exc


def _remote_version_url(update_url: str) -> str:
    update_url = update_url.strip()
    if not update_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="version.json is missing update_url.",
        )
    if update_url.endswith(".json"):
        return update_url
    return f"{update_url.rstrip('/')}/version.json"


def _download_remote_version(update_url: str) -> dict[str, Any]:
    request = Request(
        _remote_version_url(update_url),
        headers={"User-Agent": "LicenseManagerUpdater/1.0"},
    )

    try:
        with urlopen(request, timeout=15) as response:
            payload = response.read().decode("utf-8")
    except HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Remote version check failed with HTTP {exc.code}.",
        ) from exc
    except URLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not connect to update server: {exc.reason}",
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Update server timed out.",
        ) from exc

    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Remote version.json is invalid: {exc}",
        ) from exc


def _version_parts(version: str) -> list[int]:
    parts = [int(part) for part in re.findall(r"\d+", version or "")]
    return parts or [0]


def _is_newer(remote_version: str, current_version: str) -> bool:
    remote = _version_parts(remote_version)
    current = _version_parts(current_version)
    max_len = max(len(remote), len(current))
    remote.extend([0] * (max_len - len(remote)))
    current.extend([0] * (max_len - len(current)))
    return remote > current


def _process_is_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _read_update_state() -> dict[str, Any]:
    if not UPDATE_STATE_FILE.exists():
        return {"running": False}

    try:
        state = json.loads(UPDATE_STATE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"running": False, "error": "Update state file is invalid."}

    pid = state.get("pid")
    running = (
        state.get("status") == "running"
        and isinstance(pid, int)
        and _process_is_running(pid)
    )
    return {**state, "running": running}


def _tail_log(max_lines: int = 80) -> str:
    if not UPDATE_LOG_FILE.exists():
        return ""

    try:
        lines = UPDATE_LOG_FILE.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return ""
    return "\n".join(lines[-max_lines:])


@router.get("/update/check")
def check_update(_: Admin = Depends(deps.get_current_admin)):
    local_version = _read_json(VERSION_FILE)
    remote_version = _download_remote_version(str(local_version.get("update_url", "")))

    current = str(local_version.get("version", "0.0.0"))
    latest = str(remote_version.get("version", "0.0.0"))

    return {
        "current_version": current,
        "latest_version": latest,
        "update_available": _is_newer(latest, current),
        "update_url": remote_version.get("update_url") or local_version.get("update_url"),
        "changelog": remote_version.get("changelog", ""),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/update/current")
def current_version(_: Admin = Depends(deps.get_current_admin)):
    local_version = _read_json(VERSION_FILE)
    return {
        "current_version": str(local_version.get("version", "0.0.0")),
    }


@router.get("/update/status")
def update_status(_: Admin = Depends(deps.get_current_admin)):
    return {**_read_update_state(), "log": _tail_log()}


@router.post("/update/run", status_code=status.HTTP_202_ACCEPTED)
def run_update(_: Admin = Depends(deps.get_current_admin)):
    if not UPDATE_SCRIPT.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Missing update.sh.",
        )

    local_version = _read_json(VERSION_FILE)
    remote_version = _download_remote_version(str(local_version.get("update_url", "")))
    latest_version = str(remote_version.get("version", "0.0.0"))
    if not _is_newer(latest_version, str(local_version.get("version", "0.0.0"))):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No newer version is available.",
        )

    state = _read_update_state()
    if state.get("running"):
        return {**state, "log": _tail_log()}

    UPDATE_STATE_DIR.mkdir(parents=True, exist_ok=True)
    UPDATE_LOG_FILE.write_text("", encoding="utf-8")

    log_handle = None
    try:
        log_handle = UPDATE_LOG_FILE.open("a", encoding="utf-8")
        process = subprocess.Popen(
            ["bash", str(UPDATE_SCRIPT)],
            cwd=str(PROJECT_ROOT),
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not start update.sh because bash was not found.",
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not start update.sh: {exc}",
        ) from exc
    finally:
        if log_handle is not None:
            log_handle.close()

    state = {
        "pid": process.pid,
        "running": True,
        "status": "running",
        "message": f"Starting update to version {latest_version}.",
        "version": latest_version,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "log_path": str(UPDATE_LOG_FILE),
    }
    UPDATE_STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    return state
