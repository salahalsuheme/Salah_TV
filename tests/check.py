#!/usr/bin/env python3
"""Static checks for the whole repo: build, data files, photos, fonts, scripts, safety lists, private data.

    python3 tests/check.py          (needs: pip install fonttools brotli pillow)

Prints one line per check and exits non-zero if any failed. No network.
"""
import json
import py_compile
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
failures = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -> {detail}"))
    if not ok:
        failures.append(name)


def tracked(*globs):
    out = subprocess.run(["git", "ls-files", *globs], cwd=ROOT, capture_output=True, text=True).stdout.split()
    return [ROOT / f for f in out]


# ---- build
before = {n: (ROOT / "dist" / n).read_bytes() for n in ("urtv.html", "tv.html") if (ROOT / "dist" / n).is_file()}
r = subprocess.run([sys.executable, "src/build.py"], cwd=ROOT, capture_output=True, text=True)
check("src/build.py runs", r.returncode == 0, r.stderr[-400:])
for page, limit in (("urtv.html", 4_000_000), ("tv.html", 400_000)):
    html = (ROOT / "dist" / page).read_text(encoding="utf-8")
    left = sorted(set(re.findall(r"__[A-Z][A-Z_]+__", html)))
    check(f"{page}: every build token replaced", not left, left)
    check(f"{page}: size under {limit // 1000} KB", len(html.encode()) < limit, len(html.encode()))
stale = [n for n, b in before.items() if (ROOT / "dist" / n).read_bytes() != b]
check("dist/ matched a fresh build (run src/build.py after editing src/)", len(before) == 2 and not stale, stale)

# ---- data files
for f in tracked("*.json"):
    try:
        json.loads(f.read_text(encoding="utf-8"))
        ok, err = True, ""
    except ValueError as e:
        ok, err = False, e
    check(f"valid JSON: {f.relative_to(ROOT)}", ok, err)

# ---- photos: every listed photo exists, is 1920x1080, has a credit; nothing unlisted
index = json.loads((ROOT / "photos/index.json").read_text(encoding="utf-8"))
listed = {p["f"] for p in index}
on_disk = {p.name for p in (ROOT / "photos").glob("*.jpg")}
check("photos: every index entry has a file", listed <= on_disk, sorted(listed - on_disk))
check("photos: no file missing from the index", on_disk <= listed, sorted(on_disk - listed))
bad = [f for f in sorted(on_disk) if Image.open(ROOT / "photos" / f).size != (1920, 1080)]
check("photos: all 1920x1080", not bad, bad)
credits = (ROOT / "docs/PHOTO-CREDITS.md").read_text(encoding="utf-8")
check("photos: every photo credited in docs/PHOTO-CREDITS.md", all(f in credits for f in on_disk),
      [f for f in on_disk if f not in credits])
bundled = json.loads((ROOT / "assets/backgrounds/backgrounds.json").read_text(encoding="utf-8"))
check("bundled backgrounds exist", all((ROOT / "assets/backgrounds" / b["file"]).is_file() for b in bundled))

# ---- build JSON in script tags cannot break out of <script>
sys.path.insert(0, str(ROOT / "src"))
from build import js_json   # noqa: E402
embedded = js_json({"c": "</script><b>"})
check("embedded JSON cannot end its <script>", "</" not in embedded and json.loads(embedded)["c"] == "</script><b>", embedded)
page = (ROOT / "dist/tv.html").read_text(encoding="utf-8")
check("no bundled verses/poetry/hadith", "const VERSES" not in page and "const POETRY" not in page and "const HADITH" not in page)
font = set(TTFont(ROOT / "assets/fonts/Thmanyah-Regular.woff2").getBestCmap())
team_ar = json.loads((ROOT / "assets/shared/teams-ar.json").read_text(encoding="utf-8"))
names = "".join(v for v in (team_ar.values() if isinstance(team_ar, dict) else []) if isinstance(v, str))
missing = sorted({c for c in names if not c.isspace() and ord(c) not in font})
check("Arabic team names: every character in Thmanyah", not missing, missing)

# ---- the clubs list (assets/shared/teams.json, built by .github/tools/team_ids.py in CI)
from team_ids import ARAB, KNOWN, LEAGUES, NATIONAL, NATIONAL_LEAGUE, plain_ar, team_key   # noqa: E402
clubs = json.loads((ROOT / "assets/shared/teams.json").read_text(encoding="utf-8"))
ids = [c["id"] for c in clubs]
check("clubs: unique ids", len(ids) == len(set(ids)), sorted({i for i in ids if ids.count(i) > 1}))
by_id = {c["id"]: c for c in clubs}
check("clubs: the known ids are the clubs the app uses",
      all(team_key(by_id.get(i, {}).get("en", "")) == team_key(n) for i, n in KNOWN.items()),
      {i: by_id.get(i, {}).get("en") for i, n in KNOWN.items() if team_key(by_id.get(i, {}).get("en", "")) != team_key(n)})
prefs_leagues = re.findall(r'\{"([^"]+)", "[^"]+"\}', (ROOT / "android/app/src/main/java/sa/urtv/screensaver/Prefs.java")
                           .read_text(encoding="utf-8").split("LEAGUES = {")[1].split("};")[0])
count = {l: sum(l in c["leagues"] for c in clubs) for l in prefs_leagues}
check("clubs: every league of the app has at least its minimum", all(count[l] >= LEAGUES.get(l, {}).get("min", 1)
      for l in prefs_leagues), {l: (n, LEAGUES.get(l, {}).get("min")) for l, n in count.items() if n < LEAGUES.get(l, {}).get("min", 1)})
national = [c for c in clubs if NATIONAL_LEAGUE in c["leagues"]]
check(f"clubs: all {len(NATIONAL)} national teams", len(national) == len(NATIONAL), len(national))
ours = [c for c in clubs if NATIONAL_LEAGUE in c["leagues"] or any(LEAGUES.get(l, {}).get("country") == "Saudi Arabia"
                                                                     for l in c["leagues"])]
check("clubs: every Saudi club and national team has our own or Wikidata's Arabic name, not a transliteration",
      all(c.get("ar") and c.get("arFrom") != "translit" for c in ours),
      [c["en"] for c in ours if not c.get("ar") or c.get("arFrom") == "translit"])
arab = [c for c in clubs if any(LEAGUES.get(l, {}).get("country") in ARAB for l in c["leagues"])]
check("clubs: no club of an Arab league is named by transliteration (add it to teams-ar.json)",
      all(c.get("arFrom") != "translit" for c in arab), [c["en"] for c in arab if c.get("arFrom") == "translit"])
check("clubs: every team has an Arabic name", all(c.get("ar") for c in clubs), [c["en"] for c in clubs if not c.get("ar")][:10])
check("clubs: each Arabic name's source is given", all(c.get("arFrom") in ("curated", "wikidata", "thesportsdb", "translit")
                                                      for c in clubs), sorted({str(c.get("arFrom")) for c in clubs}))
names = {}
for c in clubs:
    if c.get("ar"):
        names.setdefault(plain_ar(c["ar"]), []).append(c["en"])
check("clubs: no two teams share an Arabic name", all(len(v) == 1 for v in names.values()),
      {k: v for k, v in names.items() if len(v) > 1})
missing = sorted({ch for c in clubs for ch in c.get("ar", "") if not ch.isspace() and ord(ch) not in font})
check("clubs: every character of the Arabic names in Thmanyah", not missing, missing)

# ---- launcher config
cfg = ET.parse(ROOT / "android/launcher/src/main/res/values/config.xml").getroot()
arr = {a.get("name"): [i.text for i in a] for a in cfg.findall("string-array")}
check("launcher: no dock app is also hidden", not set(arr["dock_apps"]) & set(arr["hidden_apps"]))
check("launcher: screensaver app not hidden", "sa.urtv.screensaver" not in arr["hidden_apps"])

# ---- optimize: never disable a kept package
def pkgs(path):
    return {l.split("#")[0].strip() for l in path.read_text().splitlines() if l.split("#")[0].strip()}
keep = pkgs(ROOT / "optimize/lists/keep.txt")
for lst in sorted((ROOT / "optimize/lists").glob("*.txt")):
    if lst.name != "keep.txt":
        check(f"optimize: {lst.name} disables nothing from keep.txt", not pkgs(lst) & keep, sorted(pkgs(lst) & keep))

# ---- scripts
for f in tracked("*.py"):
    try:
        py_compile.compile(str(f), doraise=True)
        ok, err = True, ""
    except py_compile.PyCompileError as e:
        ok, err = False, e
    check(f"python compiles: {f.relative_to(ROOT)}", ok, err)
for f in tracked("*.sh"):
    r = subprocess.run(["bash", "-n", str(f)], capture_output=True, text=True)
    check(f"bash syntax: {f.relative_to(ROOT)}", r.returncode == 0, r.stderr)

# ---- nothing private or secret in the repo
texts = [f for f in tracked() if f.suffix in {".md", ".py", ".sh", ".java", ".xml", ".json", ".yml", ".html", ".txt", ".gradle"}]
ip = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
allowed_ip = {"0.0.0.0", "127.0.0.1"}
# the network check and its simulation hold only address ranges and made-up addresses, never someone's network
network_code = {ROOT / "optimize/find-tv.py", ROOT / "tests/find_tv_test.py"}
found = []
for f in texts:
    if f.name.endswith(".html") or f.parent.name == "photos" or f == Path(__file__).resolve():   # not this scan
        continue
    if f in network_code:
        s = f.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"(?i)tailscale|\.ts\.net", s):
            found.append(f"{f.relative_to(ROOT)}: tailscale")
        continue
    s = f.read_text(encoding="utf-8", errors="ignore")
    found += [f"{f.relative_to(ROOT)}: {m}" for m in set(ip.findall(s)) - allowed_ip
              if all(0 <= int(x) <= 255 for x in m.split(".")) and not m.startswith(("1.", "2.", "3.", "4."))
              and not m.startswith(("192.0.2.", "198.51.100.", "203.0.113."))]   # reserved for examples
    if re.search(r"(?i)(client-id|access_key|api_key)\s*[:=]\s*['\"][A-Za-z0-9_-]{20,}", s):
        found.append(f"{f.relative_to(ROOT)}: looks like a key")
    if re.search(r"(?i)tailscale|\.ts\.net", s):
        found.append(f"{f.relative_to(ROOT)}: tailscale")
check("no private IPs, keys or network names", not found, found[:10])

print()
print(f"{len(failures)} failed" if failures else "all checks passed")
sys.exit(1 if failures else 0)
