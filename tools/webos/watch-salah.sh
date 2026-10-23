#!/bin/sh
# Home + cold boot -> شاشة صلاح. Root + /var/lib/homehook.
ME=com.salahalsuheme.salahtv
LGHOME=com.webos.app.home
LIVETV=com.webos.app.livetv
FLAG=/tmp/allow_lg_home
FLAG_MAX=30
APPS=/media/developer/apps/usr/palm/applications
IPK=/var/lib/homehook/Salah_Tv.ipk
EXTRA=/var/lib/homehook/hosts-extra
LOG=/var/lib/homehook/salah-watch.log
export PATH="/bin:/sbin:/usr/bin:/usr/sbin:$PATH"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG" 2>/dev/null; }

for p in $(ps w 2>/dev/null | awk '/\/var\/lib\/homehook\/watch\.sh/{print $1}'); do
  [ "$p" = "$$" ] && continue
  kill "$p" 2>/dev/null
done

ensure_app() {
  [ -d "$APPS/$ME" ] && return 0
  [ -f "$IPK" ] || return 1
  log "reinstall $ME from IPK"
  luna-send -i 120 luna://com.webos.appInstallService/dev/install \
    "{\"id\":\"$ME\",\"ipkUrl\":\"$IPK\",\"subscribe\":true}" >> "$LOG" 2>&1
  [ -d "$APPS/$ME" ]
}

launch_me() {
  luna-send -n 1 luna://com.webos.applicationManager/launch "{\"id\":\"$ME\"}" </dev/null >/dev/null 2>&1
}

i=0
while [ "$i" -lt 120 ]; do
  if luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}' >/dev/null 2>&1; then
    log "luna ready (${i}s)"
    break
  fi
  i=$((i + 1))
  sleep 1
done

ensure_app || log "ensure_app: app missing (Dev Mode / IPK?)"

boot_start=$(date +%s)
prev=""
last=0
okhome=0
ticks=0

log "watch start pid=$$"

while true; do
  out=$(luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}' </dev/null 2>/dev/null)
  now=$(date +%s)
  since=$((now - boot_start))
  min_gap=3
  [ "$since" -lt 600 ] && min_gap=1

  case "$out" in
    *'"appId":"'$ME'"'*)
      rm -f "$FLAG" 2>/dev/null
      okhome=0
      prev=$ME
      ;;
    *'"appId":"'$LGHOME'"'*)
      if [ "$prev" != "$LGHOME" ]; then
        okhome=0
        if [ -f "$FLAG" ]; then
          age=$((now - $(stat -c %Y "$FLAG" 2>/dev/null || echo 0)))
          if [ "$age" -ge 0 ] && [ "$age" -lt "$FLAG_MAX" ]; then
            okhome=1
          fi
          rm -f "$FLAG" 2>/dev/null
        fi
      fi
      if [ "$okhome" -eq 0 ] && [ -d "$APPS/$ME" ]; then
        if [ $((now - last)) -ge "$min_gap" ] || [ $((now - last)) -lt 0 ]; then
          last=$now
          launch_me
          log "launch lg-home"
        fi
      fi
      prev=$LGHOME
      ;;
    *'"appId":"'$LIVETV'"'*)
      if [ "$since" -lt 600 ] && [ -d "$APPS/$ME" ]; then
        if [ $((now - last)) -ge "$min_gap" ] || [ $((now - last)) -lt 0 ]; then
          last=$now
          launch_me
          log "launch livetv"
        fi
      fi
      prev=$LIVETV
      ;;
    *)
      if [ "$since" -lt 180 ] && [ -d "$APPS/$ME" ]; then
        case "$out" in
          *'"appId":""'*|*'"appId":null'*|*'"windowId":""'*)
            if [ $((now - last)) -ge 2 ] || [ $((now - last)) -lt 0 ]; then
              last=$now
              launch_me
              log "launch boot-idle"
            fi
            ;;
        esac
      fi
      prev=other
      ;;
  esac

  ticks=$((ticks + 1))
  if [ $((ticks % 45)) -eq 1 ]; then
    ensure_app
  fi
  if [ $((ticks % 30)) -eq 1 ] && [ -f "$EXTRA" ]; then
    grep -v '^#' "$EXTRA" | while IFS= read -r l; do
      [ -n "$l" ] && ! grep -qF "$l" /etc/hosts 2>/dev/null && echo "$l" >> /etc/hosts
    done
  fi
  sleep 1
done
