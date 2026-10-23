#!/usr/bin/env python3
"""src/template.html -> dist/urtv.html, tv.html, webos.html; optional --stage-webos for IPK."""
import argparse
import base64
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONTS = {
    "__F_LIGHT__": "Thmanyah-Light.woff2",
    "__F_REGULAR__": "Thmanyah-Regular.woff2",
    "__F_MEDIUM__": "Thmanyah-Medium.woff2",
    "__F_DISPLAY__": "ThmanyahDisplay-Bold.woff2",
}
REPO = "https://raw.githubusercontent.com/tshi-dev/UrTV/master/"


def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def js_json(value):
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")


def main():
    html = (ROOT / "src/template.html").read_text(encoding="utf-8")
    teams = json.loads((ROOT / "assets/shared/teams-ar.json").read_text(encoding="utf-8"))
    html = html.replace("__TEAMS_AR__", js_json(teams))
    clubs = json.loads((ROOT / "assets/shared/teams.json").read_text(encoding="utf-8"))
    by_id = {c["id"]: c["ar"] for c in clubs if c.get("id") and c.get("ar")}
    html = html.replace("__TEAMS_BY_ID__", js_json(by_id))

    bg_dir = ROOT / "assets/backgrounds"
    bgs = json.loads((bg_dir / "backgrounds.json").read_text(encoding="utf-8"))
    variants = (
        ("urtv.html", True, None),
        ("tv.html", False, REPO),
        ("webos.html", False, ""),
    )
    font_preload = (
        '<link rel="preload" href="assets/fonts/Thmanyah-Regular.woff2" as="font" type="font/woff2" crossorigin>\n'
        '<link rel="preload" href="assets/fonts/ThmanyahDisplay-Bold.woff2" as="font" type="font/woff2" crossorigin>\n'
        '<link rel="preload" href="assets/fonts/Thmanyah-Medium.woff2" as="font" type="font/woff2" crossorigin>'
    )
    for name, inline, asset_base in variants:
        page = html.replace("__FONT_PRELOAD__", font_preload if name == "webos.html" else "")
        for token, font in FONTS.items():
            if inline:
                font_url = data_uri(ROOT / "assets/fonts" / font, "font/woff2")
            else:
                font_url = f"{asset_base}assets/fonts/{font}"
            page = page.replace(token, font_url)
        entries = []
        for bg in bgs:
            if inline:
                u = data_uri(bg_dir / bg["file"], "image/jpeg")
            else:
                u = f"{asset_base}assets/backgrounds/{bg['file']}"
            entries.append(f'  {{u:"{u}", c:{js_json(bg["credit"])}, d:{bg["brightness"]}}}')
        out = ROOT / "dist" / name
        out.parent.mkdir(exist_ok=True)
        out.write_text(page.replace("__BG_SET__", ",\n".join(entries)), encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size / 1e6:.1f} MB)")


def stage_webos():
    """Sync dist/webos.html and bundled assets into webos/ (ignored by git; used by ares-package)."""
    webos = ROOT / "webos"
    asset_root = webos / "assets"
    if asset_root.is_dir():
        shutil.rmtree(asset_root)
    (asset_root / "fonts").mkdir(parents=True)
    (asset_root / "backgrounds").mkdir(parents=True)
    for f in sorted((ROOT / "assets/fonts").glob("*.woff2")):
        shutil.copy2(f, asset_root / "fonts" / f.name)
    for f in sorted((ROOT / "assets/backgrounds").iterdir()):
        if f.is_file():
            shutil.copy2(f, asset_root / "backgrounds" / f.name)
    shutil.copy2(ROOT / "dist/webos.html", webos / "index.html")
    print(f"staged {webos.relative_to(ROOT)}/index.html + assets/")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--stage-webos",
        action="store_true",
        help="after build, copy webos.html and assets/ into webos/ for Salah_Tv.ipk packaging",
    )
    args = ap.parse_args()
    main()
    if args.stage_webos:
        stage_webos()
