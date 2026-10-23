#!/usr/bin/env bash
# Build web app + IPK → webos/build/Salah_Tv.ipk (same as package-salah-tv.ps1 on Windows).
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
if command -v python3 >/dev/null; then py=python3
elif command -v python >/dev/null; then py=python
else echo "python3 not found" >&2; exit 1
fi
"$py" src/build.py --stage-webos
cd webos
npm exec --yes --package=@webosose/ares-cli -- ares-package . --no-minify -o build
built="$(ls -t build/com.salahalsuheme.salahtv_*_all.ipk 2>/dev/null | head -1)"
if [[ -z "$built" ]]; then
  echo "IPK not built" >&2
  exit 1
fi
cp -f "$built" build/Salah_Tv.ipk
echo "OK: $(basename "$built") -> webos/build/Salah_Tv.ipk"
