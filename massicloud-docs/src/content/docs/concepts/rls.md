---
title: Row Level Security
description: How MassiCloud uses Postgres RLS to control data access.
---

**Row Level Security** (RLS) is a Postgres feature that filters rows based on the current user. When you query a table with RLS, the database itself decides what you can see — not your application code.

MassiCloud enables RLS by default on every table created through the platform. This is intentional: it's safer to opt out of security than to opt in.

## How it works

When a request hits the REST API with a JWT, MassiCloud:

1. Validates the JWT
2. Extracts claims: `sub` (user id), `role`, etc.
3. Opens a Postgres connection
4. Runs `SET LOCAL request.jwt.claims TO '<claims>'`
5. Runs `SET LOCAL role TO 'authenticated'` (or `'anon'` / `'service_role'`)
6. Executes your query

RLS policies on the table can now read these via helper functions:

- `auth.uid()` — the user's UUID
- `auth.role()` — `'authenticated'` or `'anon'`
- `auth.email()` — the user's email

## Default policies

When you create a table through the portal, MassiCloud adds two default policies:

1. **Users see own rows** — if the table has a `user_id` column, only the user whose ID matches can read or modify.
2. **Service role full access** — `service_role` requests bypass RLS entirely.

If your table doesn't have a `user_id` column, the first policy is replaced with **"Authenticated read all"** — any logged-in user can read all rows, but nobody but service_role can modify.

You can modify these from the portal's Schema tab → Policies panel.

## Writing your own policies

Common patterns:

**Users can manage their own rows:**

```sql
CREATE POLICY "users manage own" ON todos
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid())
```

**Anyone can read; only authenticated users can create:**

```sql
CREATE POLICY "public read"  ON posts
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "auth insert" ON posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
```

**Only the row's author can update:**

```sql
CREATE POLICY "author updates" ON posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());
```

## Important edge cases

- **A table with RLS enabled but no policies blocks everything**, except `service_role` which bypasses RLS. If your query returns `[]` when it shouldn't, check that policies exist.
- **INSERT** uses `WITH CHECK`, not `USING`. Make sure your INSERT policies define `WITH CHECK`.
- **UPDATE** uses both: `USING` for which rows can be matched, `WITH CHECK` for what the new row is allowed to look like.
