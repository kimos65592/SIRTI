# Study JARVIS v0.1.0 — Web

مساعد تعليمي عربي لتنظيم المذاكرة، السؤال عن المنهج، التدريب، والصوت.

## التشغيل

يمكن فتح `index.html` مباشرة في متصفح حديث. بعض ميزات الصوت قد تتطلب HTTPS أو localhost حسب المتصفح.

## المجلدات

- `index.html` — الواجهة.
- `style.css` — التصميم.
- `app.js` — منطق التطبيق.
- `ai/huggingface.js` — الاتصال بـ Hugging Face Inference Providers.
- `data/subjects.js` — المواد.
- `data/schedule.js` — التخزين المحلي للجدول.
- `data/curriculum.js` — الموضوعات الأولية.

## Hugging Face

الموديل الافتراضي:

`Qwen/Qwen3-4B-Thinking-2507:fastest`

عدّل الموديل من الإعدادات عند الحاجة.

> مهم: لا تضع HF Token داخل ملف عام أو مستودع GitHub. هذه النسخة تطلبه من المستخدم وتحفظه محليًا في المتصفح.

## GitHub Pages

ارفع الملفات مع نفس المجلدات، ثم من إعدادات المستودع فعّل GitHub Pages من فرع النشر الذي تستخدمه. لا تحتاج Gradle أو Kotlin أو Android Studio لهذه النسخة.
