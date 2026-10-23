#!/bin/sh
# After power-on: burst launch Salah until foreground (runs once in background from webosbrew init.d).
ME=com.salahalsuheme.salahtv
APPS=/media/developer/apps/usr/palm/applications
IPK=/var/lib/homehook/Salah_Tv.ipk
LOG=/var/lib/homehook/salah-watch.log
export PATH="/bin:/sbin:/usr/bin:/usr/sbin:$PATH"

(
  sleep 1
  i=0
  while [ "$i" -lt 120 ]; do
    if ! luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}' >/dev/null 2>&1; then
      i=$((i + 1))
      sleep 1
      continue
    fi
    if [ ! -d "$APPS/$ME" ] && [ -f "$IPK" ]; then
      /var/lib/homehook/ensure-salah-app.sh
      sleep 3
    fi
    if [ -d "$APPS/$ME" ]; then
      luna-send -n 1 luna://com.webos.applicationManager/launch "{\"id\":\"$ME\"}" </dev/null >/dev/null 2>&1
      out=$(luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}' </dev/null 2>/dev/null)
      case "$out" in
        *'"appId":"'$ME'"'*)
          echo "$(date '+%Y-%m-%d %H:%M:%S') boot-burst ok (${i}s)" >> "$LOG" 2>/dev/null
          exit 0
          ;;
      esac
    fi
    i=$((i + 1))
    sleep 2
  done
  echo "$(date '+%Y-%m-%d %H:%M:%S') boot-burst gave up" >> "$LOG" 2>/dev/null
) </dev/null >/dev/null 2>&1 &

exit 0
