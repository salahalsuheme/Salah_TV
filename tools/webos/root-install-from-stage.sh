#!/bin/sh
# Run once as root on the TV (Dev Manager → rooted shell, or SSH port 22).
set -e
STAGE=/media/developer/temp/salah-deploy
ME=com.salahalsuheme.salahtv
mkdir -p /var/lib/homehook /var/lib/webosbrew/init.d
cp -f "$STAGE/watch-salah.sh" /var/lib/homehook/watch.sh
cp -f "$STAGE/ensure-salah-app.sh" /var/lib/homehook/ensure-salah-app.sh
cp -f "$STAGE/Salah_Tv.ipk" /var/lib/homehook/Salah_Tv.ipk
cp -f "$STAGE/55-ensure-salah" /var/lib/webosbrew/init.d/55-ensure-salah
cp -f "$STAGE/60-homehook" /var/lib/webosbrew/init.d/60-homehook
chmod +x /var/lib/homehook/watch.sh /var/lib/homehook/ensure-salah-app.sh
chmod +x /var/lib/webosbrew/init.d/55-ensure-salah /var/lib/webosbrew/init.d/60-homehook
killall watch.sh 2>/dev/null || true
sh /var/lib/webosbrew/init.d/55-ensure-salah
sh /var/lib/webosbrew/init.d/60-homehook
luna-send -i 120 luna://com.webos.appInstallService/dev/install "{\"id\":\"$ME\",\"ipkUrl\":\"/var/lib/homehook/Salah_Tv.ipk\",\"subscribe\":true}"
luna-send -n 1 luna://com.webos.applicationManager/launch "{\"id\":\"$ME\"}"
ls -la /var/lib/homehook
