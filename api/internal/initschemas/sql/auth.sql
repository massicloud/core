-- MassiCloud auth schema
-- Provides user authentication tables with helpers

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               text UNIQUE NOT NULL,
    encrypted_password  text NOT NULL,
    full_name           text,
    avatar_url          text,
    email_verified      boolean NOT NULL DEFAULT false,
    last_sign_in_at     timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);

CREATE TABLE IF NOT EXISTS auth.sessions (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    ip_address  inet,
    user_agent  text,
    expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth.sessions(token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth.sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at  timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Password helpers (security definer so callers don't need access to pgcrypto)
CREATE OR REPLACE FUNCTION auth.hash_password(input_password text)
RETURNS text AS $$
    SELECT crypt(input_password, gen_salt('bf', 10));
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.verify_password(
    input_password text,
    stored_hash text
) RETURNS boolean AS $$
    SELECT stored_hash = crypt(input_password, stored_hash);
$$ LANGUAGE sql SECURITY DEFINER;

-- Auto-update updated_at on row updates
CREATE OR REPLACE FUNCTION auth.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auth_users_updated_at ON auth.users;
CREATE TRIGGER auth_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION auth.set_updated_at();

-- =========================================================
-- PostgREST roles for tenant database
-- =========================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
END $$;

-- authenticator is the login role PostgREST uses; password is set at runtime.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'placeholder_replaced_at_runtime';
    END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO anon;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
    SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text AS $$
    SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS text AS $$
    SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'email';
$$ LANGUAGE sql STABLE;

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own user record" ON auth.users;
CREATE POLICY "Users can read own user record" ON auth.users
    FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Service role full access to users" ON auth.users;
CREATE POLICY "Service role full access to users" ON auth.users
    FOR ALL TO service_role
    USING (true);
