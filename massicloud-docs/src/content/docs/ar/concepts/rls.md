---
title: Row Level Security
description: كيف يستخدم MassiCloud ميزة RLS في Postgres للتحكم في الوصول إلى البيانات.
---

**Row Level Security** (RLS) هي ميزة في Postgres تُصفّي الصفوف بناءً على المستخدم الحالي. عندما تستعلم عن جدول بـ RLS، قاعدة البيانات نفسها تقرر ما يمكنك رؤيته — لا كود تطبيقك.

MassiCloud يُفعّل RLS افتراضيًا على كل جدول يُنشأ عبر المنصة. هذا مقصود: من الأأمن إلغاء تفعيل الحماية من أن تُفعّلها.

## كيف يعمل

عندما يصل طلب إلى REST API مع JWT، يقوم MassiCloud بـ:

1. التحقق من صحة JWT
2. استخراج الـ claims: `sub` (معرّف المستخدم)، `role`، إلخ
3. فتح اتصال بـ Postgres
4. تشغيل `SET LOCAL request.jwt.claims TO '<claims>'`
5. تشغيل `SET LOCAL role TO 'authenticated'` (أو `'anon'` / `'service_role'`)
6. تنفيذ استعلامك

يمكن لسياسات RLS على الجدول الآن قراءة هذه القيم عبر دوال مساعدة:

- `auth.uid()` — UUID المستخدم
- `auth.role()` — `'authenticated'` أو `'anon'`
- `auth.email()` — بريد المستخدم الإلكتروني

## السياسات الافتراضية

عند إنشاء جدول عبر البوابة، يُضيف MassiCloud سياستين افتراضيتين:

1. **المستخدمون يرون صفوفهم فقط** — إذا كان الجدول يحتوي على عمود `user_id`، فقط المستخدم الذي يطابق معرّفه يمكنه القراءة أو التعديل.
2. **وصول كامل لـ service_role** — طلبات `service_role` تتجاوز RLS كليًا.

إذا لم يكن لجدولك عمود `user_id`، تُستبدل السياسة الأولى بـ **"قراءة مصادقة للكل"**.

## كتابة سياساتك الخاصة

أنماط شائعة:

**المستخدمون يديرون صفوفهم الخاصة:**

```sql
CREATE POLICY "users manage own" ON todos
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid())
```

**أي شخص يقرأ؛ فقط المصادقون يمكنهم الإنشاء:**

```sql
CREATE POLICY "public read"  ON posts
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "auth insert" ON posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
```

**فقط كاتب الصف يمكنه تحديثه:**

```sql
CREATE POLICY "author updates" ON posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());
```

## حالات الحافة المهمة

- **جدول بـ RLS مُفعَّل لكن بلا سياسات يحجب كل شيء**، ما عدا `service_role` الذي يتجاوز RLS. إن كان استعلامك يعيد `[]` دون وجه حق، تحقق من وجود سياسات.
- **INSERT** يستخدم `WITH CHECK`، لا `USING`. تأكد من أن سياسات INSERT تُعرّف `WITH CHECK`.
- **UPDATE** يستخدم الاثنين: `USING` لأي صفوف يمكن استهدافها، `WITH CHECK` لما يُسمح بأن يبدو عليه الصف الجديد.
