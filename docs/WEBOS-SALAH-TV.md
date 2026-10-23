# شاشة صلاح (webOS)

تطبيق webOS **شاشة صلاح** — المطوّر **Salah Alsuheme**، المعرّف `com.salahalsuheme.salahtv`، الحزمة `Salah_Tv.ipk` (مبني على مشروع UrTV مفتوح المصدر للواجهة فقط).

## البناء والحزمة (أمر واحد)

أي تعديل على `src/template.html` أو `assets/` يُضمَّن في الحزمة عبر:

```powershell
cd D:\MyFiles\Salah_TV   # أو مسار المستودع
powershell -ExecutionPolicy Bypass -File tools\webos\package-salah-tv.ps1
```

الناتج الثابت: **`webos\build\Salah_Tv.ipk`** (نسخة إضافية في `%USERPROFILE%\Downloads\Salah_Tv.ipk`).

السكربت يشغّل `src/build.py --stage-webos` (يحدّث `dist/` و`webos/index.html` و`webos/assets/`) ثم `ares-package`.

على Linux/macOS:

```bash
./tools/webos/package-salah-tv.sh
```

تثبيت على التلفزيون: Dev Manager أو `ares-install --device tv webos\build\Salah_Tv.ipk`

ارفع `version` في `webos/appinfo.json` قبل كل إصدار.

## شاشة الساعة / توفير الطاقة

على تلفزيونات LG (خصوصاً OLED) النظام يعرض شاشة الساعة بعد دقائق من عدم الضغط على الريموت. التطبيق يقلّل ذلك بقدر ما يسمح به webOS:

- في `appinfo.json`: `screenSaverProperties.preferredType: 3` و `useGalleryMode` — وضع «معرض» يمدّد المهلة (حوالي 30 دقيقة) مع تخفيض تدريجي للسطوع.
- في الواجهة: اشتراك `com.webos.service.tvpower` لرفض بدء الشاشة المتحركة/الساعة طالما التطبيق في المقدمة.

**لا يمكن** إيقاف الشاشة بالكامل 100٪ من تطبيق عادي؛ إن أطفأ التلفزيون الشاشة (توفير طاقة قوي) راجع **الإعدادات → عام → توفير الطاقة** وارفع المهلة أو عطّلها إن ظهر الخيار على طرازك.

## تثبيت «ثابت» (بقدر ما يسمح LG)

LG **لا تسمح** بتطبيق شخصي دائم مثل تطبيق المتجر بدون نشر رسمي. لكن مع **Root + Homebrew** يمكن جعل الشاشة **تعود تلقائياً** بعد الحذف:

| ما يحدث | السبب |
|--------|--------|
| التطبيق يختفي بعد يوم/إقلاع | انتهاء **جلسة Developer Mode** — LG تحذف تطبيقات التطوير |
| ما يُحفظ على التلفزيون | ملف `Salah_Tv.ipk` في `/var/lib/homehook/` + سكربت `ensure-salah-app.sh` |

**الخطوات (مرة بعد كل تحديث IPK):**

1. ابنِ الحزمة: `powershell -File tools\webos\package-salah-tv.ps1`
2. على التلفزيون: **Developer Mode** → سجّل دخول → **Dev Mode ON** → **EXTEND** (والشبكة متصلة).
3. من الكمبيوتر:
   ```powershell
   node tools\webos\install-salah-as-home.js
   ```
   يرفع IPK، يثبّت التطبيق، ويفعّل **إعادة التثبيت عند الإقلاع** إذا كان التطبيق محذوفاً ووضع المطوّر ما زال مفعّلاً.

**مهم:** إذا انتهت الجلسة بالكامل وطُفِي Dev Mode، لن يعمل التثبيت التلقائي حتى تفتح **Developer Mode** مرة وتضغط **EXTEND** (مرة كل فترة، مثلاً أسبوعياً). هذا قيد من LG وليس من شاشة صلاح.

بديل: تثبيت نفس IPK من **Homebrew Channel** على التلفزيون (قائمة التطبيقات → Install) — أحياناً يبقى أطول، لكن التمديد من Developer Mode يبقى مفيداً.

## جعل شاشة صلاح = الشاشة الرئيسية (Home)

يتطلب **Root** + **SSH** (منفذ 22) من Homebrew، وتطبيق **Homebrew Channel** (لأيقونة «المنزل الأصلي» في الشريط).

| الإجراء | النتيجة |
|--------|---------|
| زر **Home** في الريموت | يفتح **شاشة صلاح** (حتى لو كنت على واجهة LG) |
| أيقونة **متصفح الويب** في الشريط | يفتح متصفح LG (`com.webos.app.browser`) |
| تشغيل التلفزيون / فصل الكهرباء | `52-salah-boot-burst` + `watch-salah.sh` يحاولان فتح صلاح كل 1–2 ثانية حتى تظهر (قد تلمح واجهة LG ثوانٍ حتى يجهز النظام) |

أي **رجوع** من تطبيق فتحته من شاشة صلاح يعيدك لصلاح (سكربت `watch-salah.sh` على التلفزيون).

**بعد فصل الفيش:** افتح تطبيق **Developer Mode** مرة واضغط **EXTEND** إن حُذفت شاشة صلاح (LG تحذف تطبيقات التطوير أحياناً). مع الروت يُعاد التثبيت من `/var/lib/homehook/Salah_Tv.ipk` إذا الجلسة ما زالت صالحة.

سجل المراقب على التلفزيون: `/var/lib/homehook/salah-watch.log`

### التثبيت (مرة واحدة بعد الروت)

1. Root عبر [jsbro-autoroot](https://raws0kil.github.io/jsbro-autoroot/) (مثال IP: `192.168.1.2`) — وافق على الاقتران، ثم **أعد التشغيل**.
2. من Homebrew: فعّل **SSH**، وعطّل **Quick Start+** من إعدادات LG إن أمكن.
3. من الكمبيوتر:
   ```powershell
   node tools\webos\install-salah-as-home.js
   # أو: powershell -File tools\webos\wait-root-and-install.ps1
   ```
   يرفع `watch-salah.sh` و`60-homehook` ويشغّل المراقب في الخلفية.

## التخصيصات الرئيسية

- عنوان التطبيق: **شاشة صلاح**
- شريط تطبيقات (dock) + ترس لاختصارات النظام (شبكة، بلوتوث، AirPlay، …)
- شعر بدل الحديث في سطر اليوم
- ترويسة: برمجة : عبقر صلاح
