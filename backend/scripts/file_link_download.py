"""
Uploadcare File Downloader
Downloads files from Uploadcare CDN URLs to a local directory.

Usage:
    python3 download_uploadcare_files.py <uuid_or_url> [<uuid_or_url> ...]
    python3 download_uploadcare_files.py --from-file urls.txt
"""

import os
import sys
import re
import requests
from pathlib import Path
from urllib.parse import urlparse, unquote

# ── Configuration ─────────────────────────────────────────────
# IMPORTANT: This is ONLY the base domain, NOT including any UUID.
CDN_BASE = "https://5kcn84nzfr.ucarecd.net"
DOWNLOAD_DIR = "./downloads"
# ──────────────────────────────────────────────────────────────

UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


def extract_uuid(url_or_uuid):
    """Extract UUID from a CDN URL or bare UUID string."""
    match = UUID_PATTERN.search(url_or_uuid.strip())
    return match.group(0) if match else None


def build_cdn_url(uuid):
    """Build the download URL: CDN_BASE/<uuid>/"""
    return "{}/{}/".format(CDN_BASE.rstrip("/"), uuid)


def get_filename_from_response(response, uuid):
    """Determine a good filename from the HTTP response headers."""

    # 1. Content-Disposition header (most reliable)
    cd = response.headers.get("Content-Disposition", "")
    if "filename=" in cd:
        raw = cd.split("filename=")[-1].strip().strip('"').strip("'")
        name = unquote(raw.split(";")[0])
        if name:
            return name

    # 2. URL path segment
    path = urlparse(response.url).path.rstrip("/")
    if path:
        segment = path.split("/")[-1]
        if "." in segment:
            return unquote(segment)

    # 3. Guess extension from Content-Type
    ct = response.headers.get("Content-Type", "").split(";")[0].strip()
    ext_map = {
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
        "application/msword": ".doc",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "audio/mpeg": ".mp3",
        "audio/webm": ".webm",
        "video/mp4": ".mp4",
        "text/plain": ".txt",
        "text/csv": ".csv",
        "application/zip": ".zip",
        "application/json": ".json",
    }
    ext = ext_map.get(ct, "")
    return "{}{}".format(uuid, ext)


def download_file(url_or_uuid, dest_dir=DOWNLOAD_DIR):
    """Download a single file from Uploadcare. Returns local path or None."""

    uuid = extract_uuid(url_or_uuid)
    if not uuid:
        print("  ❌ Could not extract UUID from: {}".format(url_or_uuid))
        return None

    cdn_url = build_cdn_url(uuid)
    print("  ⬇  URL: {}".format(cdn_url))

    try:
        resp = requests.get(cdn_url, stream=True, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print("  ❌ Download failed: {}".format(exc))
        return None

    filename = get_filename_from_response(resp, uuid)
    dest_path = Path(dest_dir) / filename

    # Avoid overwriting
    counter = 1
    stem = dest_path.stem
    suffix = dest_path.suffix
    while dest_path.exists():
        dest_path = Path(dest_dir) / "{} ({}){}".format(stem, counter, suffix)
        counter += 1

    dest_path.parent.mkdir(parents=True, exist_ok=True)

    total = int(resp.headers.get("Content-Length", 0))
    downloaded = 0
    with open(dest_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded / total * 100
                print("\r  ⬇  {:.1f}%  ({:,} / {:,} bytes)".format(pct, downloaded, total), end="")

    print()

    # Verify
    if dest_path.exists():
        size_kb = dest_path.stat().st_size / 1024
        print("  ✅ Saved: {}  ({:.1f} KB)".format(dest_path, size_kb))
        return str(dest_path)
    else:
        print("  ❌ File was not saved")
        return None


def main():
    args = sys.argv[1:]

    if not args:
        print(__doc__)
        sys.exit(0)

    urls = []

    if args[0] == "--from-file" and len(args) >= 2:
        filepath = args[1]
        if not os.path.isfile(filepath):
            print("❌ File not found: {}".format(filepath))
            sys.exit(1)
        with open(filepath) as f:
            urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]
    else:
        urls = args

    print()
    print("📦 Uploadcare File Downloader")
    print("   CDN:    {}".format(CDN_BASE))
    print("   Output: {}".format(os.path.abspath(DOWNLOAD_DIR)))
    print("   Files:  {}".format(len(urls)))

    results = []
    for i, url in enumerate(urls, 1):
        print()
        print("── [{}/{}] {} ──".format(i, len(urls), url))
        path = download_file(url)
        results.append((url, path))

    # Summary
    ok = sum(1 for _, p in results if p)
    fail = len(results) - ok
    print()
    print("═══════════════════════════════")
    print("  SUMMARY: {} succeeded, {} failed".format(ok, fail))
    print("═══════════════════════════════")

    if ok:
        print()
        print("📁 Downloaded files:")
        for url, path in results:
            if path:
                print("   → {}".format(path))

    if fail:
        print()
        print("⚠️  Failed:")
        for url, path in results:
            if not path:
                print("   → {}".format(url))

    print()


if __name__ == "__main__":
    main()