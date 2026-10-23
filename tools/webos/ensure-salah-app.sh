#!/bin/sh
# If LG removed the dev app, reinstall from the cached IPK (survives reboot; needs Dev Mode ON).
ME=com.salahalsuheme.salahtv
IPK=/var/lib/homehook/Salah_Tv.ipk
APPS=/media/developer/apps/usr/palm/applications
LOG=/var/lib/homehook/ensure-salah.log
export PATH="/bin:/sbin:/usr/bin:/usr/sbin:$PATH"

[ -f "$IPK" ] || exit 0
[ -d "$APPS/$ME" ] && exit 0

echo "$(date -Iseconds 2>/dev/null || date) reinstall $ME" >> "$LOG" 2>/dev/null
luna-send -i 120 luna://com.webos.appInstallService/dev/install \
  "{\"id\":\"$ME\",\"ipkUrl\":\"$IPK\",\"subscribe\":true}" >> "$LOG" 2>&1
