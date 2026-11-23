#!/usr/bin/env python3
"""Build the offline SAINT SEVEN v0.6 HTML using only Python's standard library.

Run from any working directory. The project root is the parent of this script's
tools directory. With no arguments, the output is SAINT_SEVEN_v06_play.html next
to the project directory. --output accepts an absolute path or a path relative
to the current working directory. Source files and the live preview are never
modified by this builder.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import mimetypes
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent
STYLESHEET = re.compile(r'<link rel="stylesheet" href="([^"]+)">')
SCRIPT = re.compile(r'<script defer src="([^"]+)"></script>')
FONTS = ("Galmuri11.woff2", "Galmuri11-Bold.woff2")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def data_uri(path: Path, mime_type: str | None = None) -> str:
    mime_type = mime_type or mimetypes.guess_type(path.name)[0]
    if not mime_type:
        raise ValueError(f"Unknown asset type: {path}")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def build(root: Path = ROOT) -> tuple[str, int, int]:
    """Return the complete HTML, embedded image/audio count and script count."""
    source = read_text(root / "js/data.js")
    data = json.loads(source[source.index("{"):source.rindex("}") + 1])
    paths = {value["image"] for value in data["maps"].values()}
    paths.add(data["cinematic"]["atlas"])
    for character in data["characters"].values():
        paths.add(character["sprite"])
        if character.get("full"):
            paths.add(character["full"])
        if character.get("crouch"):
            paths.add(character["crouch"]["src"])
        for sprite in character.get("sprites", {}).values():
            paths.add(sprite["src"])
    paths.update(path.relative_to(root).as_posix()
                 for path in (root / "assets/endings").glob("*.png"))
    paths.update(path.relative_to(root).as_posix()
                 for path in (root / "assets/audio").glob("*.wav"))

    # Sorting keeps the asset dictionary and final file reproducible.
    embedded = {path: data_uri(root / path) for path in sorted(paths)}
    html = read_text(root / "index.html")

    # Read the actual index order, preserving stylesheet and deferred script
    # dependencies instead of maintaining a second hard-coded module list.
    css_paths = STYLESHEET.findall(html)
    css = "\n".join(read_text(root / path) for path in css_paths)
    for font in FONTS:
        css = css.replace("../assets/fonts/" + font,
                          data_uri(root / "assets/fonts" / font, "font/woff2"))
    html = STYLESHEET.sub("", html)
    html = html.replace("</head>", "<style>" + css + "</style></head>")

    js_paths = SCRIPT.findall(html)
    html = SCRIPT.sub("", html)
    javascript = "\n".join(read_text(root / path) for path in js_paths)
    javascript = javascript.replace("</script", "<\\/script")
    license_text = read_text(root / "assets/fonts/LICENSE.txt").replace("--", "- -")
    payload = (
        "<script>window.SAINT_EMBEDDED="
        + json.dumps(embedded, separators=(",", ":"))
        + ";</script>\n<script>" + javascript + "</script>\n<!-- "
        + license_text + " -->\n</body>"
    )
    html = html.replace("</body>", payload)

    if not css_paths or not js_paths:
        raise ValueError("index.html must contain local stylesheet and deferred script tags")
    if 'src="js/' in html or 'href="css/' in html or html.count("<script>") != 2:
        raise ValueError("Standalone validation failed: external modules remain")
    return html, len(paths), len(js_paths)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path,
        default=ROOT.parent / "SAINT_SEVEN_v06_play.html",
        help="Output HTML path; relative paths use the current working directory",
    )
    args = parser.parse_args()
    output = args.output.expanduser().resolve()
    html, asset_count, script_count = build()
    payload = html.encode("utf-8")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(payload)
    print(f"Output: {output}")
    print(f"Bytes: {len(payload)}")
    print(f"SHA-256: {hashlib.sha256(payload).hexdigest()}")
    print(f"Embedded images/audio: {asset_count}; fonts: {len(FONTS)}; scripts: {script_count}")


if __name__ == "__main__":
    main()
