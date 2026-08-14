#!/usr/bin/env python3
import argparse
import fnmatch
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent

EXCLUDED_DIRS = {
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

EXCLUDED_FILES = {
    ".DS_Store",
    ".env",
    "local.db",
}

EXCLUDED_PATTERNS = {
    "*.log",
    "*.pyc",
    "*.pyo",
    "*.sqlite",
    "*.sqlite3",
    "*.zip",
}


def should_exclude(path: Path) -> bool:
    rel_parts = path.relative_to(ROOT).parts

    if any(part in EXCLUDED_DIRS for part in rel_parts):
        return True

    if path.name in EXCLUDED_FILES:
        return True

    return any(fnmatch.fnmatch(path.name, pattern) for pattern in EXCLUDED_PATTERNS)


def build_zip(output_path: Path) -> tuple[int, int]:
    file_count = 0
    total_bytes = 0

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(ROOT.rglob("*")):
            if path == output_path or should_exclude(path):
                continue
            if path.is_file():
                archive.write(path, path.relative_to(ROOT).as_posix())
                file_count += 1
                total_bytes += path.stat().st_size

    return file_count, total_bytes


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an update zip without runtime/build folders.")
    parser.add_argument(
        "-o",
        "--output",
        default="update.zip",
        help="Output zip path. Defaults to update.zip.",
    )
    args = parser.parse_args()

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = ROOT / output_path

    output_path.parent.mkdir(parents=True, exist_ok=True)
    file_count, total_bytes = build_zip(output_path)
    size_mb = output_path.stat().st_size / (1024 * 1024)

    print(f"Created: {output_path}")
    print(f"Files: {file_count}")
    print(f"Source size: {total_bytes / (1024 * 1024):.2f} MB")
    print(f"Zip size: {size_mb:.2f} MB")


if __name__ == "__main__":
    main()
