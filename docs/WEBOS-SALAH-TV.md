# شاشة صلاح (webOS)

نسخة مخصّصة من [UrTV](https://github.com/tshi-dev/UrTV) لتطبيق webOS على تلفزيون KMC / LG (معرّف التطبيق: `sa.urtv.screensaver`).

## البناء

```powershell
cd path\to\Salah_TV
python src/build.py
Copy-Item dist\urtv.html webos\index.html -Force
```

## التعبئة والتثبيت

```powershell
cd webos
npx ares-package . --no-minify -o build
ares-install --device tv (Get-ChildItem build\sa.urtv.screensaver_*_all.ipk | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
```

ارفع `version` في `webos/appinfo.json` قبل كل إصدار.

## التخصيصات الرئيسية

- عنوان التطبيق: **شاشة صلاح**
- شريط تطبيقات (dock) + ترس لاختصارات النظام (شبكة، بلوتوث، AirPlay، …)
- شعر بدل الحديث في سطر اليوم
- ترويسة: برمجة : عبقر صلاح
