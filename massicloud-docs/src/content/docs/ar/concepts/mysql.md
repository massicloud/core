---
title: MySQL
description: MySQL 8.4 كخيار قاعدة بيانات أساسي، مع CRUD عبر REST وتوافق مع SDK.
---

إلى جانب Postgres، يمكن لـ MassiCloud توفير مثيل **MySQL 8.4 LTS** مخصص لكل قاعدة بيانات. يحصل على نفس سهولة REST عبر HTTP التي يوفرها Postgres — نفس شكل الروابط، نفس استدعاءات SDK — عبر خدمة REST خفيفة طوّرتها MassiCloud بدلاً من PostgREST.

## متى تختار MySQL بدلاً من Postgres

يبقى Postgres الخيار الافتراضي والأكثر قدرة — Row Level Security، أنواع `json`/`jsonb`، الإضافات، استعلامات العلاقات المضمّنة (`select=*,posts(*)`)، وSQL كامل. اختر MySQL عندما:

- تُرحّل تطبيقًا أو مخطط ORM موجودًا مسبقًا ومكتوبًا لـ MySQL.
- تمتلك فريقك خبرة تشغيلية بـ MySQL تحديدًا.
- لا تحتاج إلى تفويض على مستوى الصف — قواعد بيانات MySQL لا تملك سوى مستويين من الوصول (راجع [المصادقة](/ar/concepts/authentication)).

إن كنت تبدأ من الصفر بلا سبب محدد لاختيار MySQL، استخدم Postgres.

## ما هو مدعوم

- **CRUD عبر REST** — `GET`/`POST`/`PATCH`/`DELETE` على `/rest/{table}`، بنفس شكل الروابط المستخدم في Postgres.
- **فلترة أساسية** — مجموعة فرعية من صيغة فلاتر PostgREST: `eq`، `neq`، `gt`، `gte`، `lt`، `lte`، `like`، `in`، `is null` / `is not null`، بالإضافة إلى `select`، `order`، `limit`، `offset`.
- **وحدة تحكم SQL** في البوابة، مع استعلامات بدء سريع خاصة بـ MySQL (`SHOW TABLES`، `EXPLAIN`، `SHOW ENGINE INNODB STATUS`، إلخ).
- **قوالب مخطط جاهزة** عند الإنشاء (قاعدة بيانات فارغة، أو جدول `users` أساسي).

## ما هو غير مدعوم

- **Row Level Security** — لا يملك MySQL معادلًا لـ RLS. كل طلب إما `massi_anon` (قراءة فقط) أو `massi_service` (وصول كامل)؛ لا يوجد فلترة صفوف حسب المستخدم. فلتر في كود تطبيقك إن احتجت ذلك.
- **العلاقات المضمّنة** — عمليات الربط على طريقة PostgREST مثل `select=*,posts(*)` غير مُنفَّذة. استخدم وحدة تحكم SQL لأي شيء يتجاوز الفلترة على جدول واحد.
- **RPC مخصصة / دوال مخزّنة** — لا يوجد بعد معادل لاستدعاءات `rpc()` في Postgres.
- **الوقت الفعلي (Realtime)** — لا يوجد معادل للوقت الفعلي القائم على `LISTEN`/`NOTIFY` في Postgres؛ MySQL لا يملك آلية مماثلة.
- **النسخ الاحتياطي** — غير مُفعّل بعد لمثيلات MySQL (مثيلات Postgres تُنسخ احتياطيًا تلقائيًا).

إذا واجه كودك إحدى هذه الحدود، تُعيد خدمة mysql-rest خطأ `400` يوضّح أن الفلتر غير مدعوم — لن تُعيد بيانات خاطئة بصمت أبدًا.

## مثال

إنشاء واستخدام قاعدة بيانات MySQL يبدو تمامًا مثل Postgres من منظور SDK:

```ts
const massi = createClient({
  url: 'https://api.massicloud.work',
  key: anonKey,
  stage: 'production',
  db: 'mysql_main',
})

const { data, error } = await massi.from('users').select().eq('email', 'someone@example.dz')
```

لا يعرف SDK — ولا يحتاج أن يعرف — ما إذا كانت `mysql_main` قاعدة Postgres أو MySQL: المنصة توجّه الطلب إلى خدمة REST الصحيحة من جهة الخادم، حسب طريقة توفير القاعدة.

## نموذج المصادقة

دوران ثابتان، يُعدّان تلقائيًا عند إنشاء المثيل:

| الدور            | الوصول                              |
| ---------------- | ------------------------------------ |
| `massi_anon`     | `SELECT` فقط، كل الصفوف              |
| `massi_service`  | قراءة/كتابة كاملة، كل الصفوف         |

الدور الذي يحصل عليه الطلب يعتمد على المفتاح المُرسَل (anon أو service) — تمامًا كما في Postgres، لكن بدون مستوى `authenticated` أو الفلترة القائمة على RLS.
