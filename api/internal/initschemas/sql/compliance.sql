-- MassiCloud compliance schema
-- Algerian Law 18-07 / 25-11 data protection compliance

CREATE SCHEMA IF NOT EXISTS compliance;

-- Track what personal data is stored and the legal basis
CREATE TABLE IF NOT EXISTS compliance.data_registry (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_schema    text NOT NULL,
    table_name      text NOT NULL,
    column_name     text NOT NULL,
    data_category   text NOT NULL CHECK (data_category IN (
        'personal', 'sensitive', 'biometric', 'health',
        'financial', 'location', 'communication'
    )),
    purpose         text NOT NULL,
    legal_basis     text NOT NULL CHECK (legal_basis IN (
        'consent', 'contract', 'legal_obligation',
        'vital_interests', 'public_task', 'legitimate_interests'
    )),
    retention_days  integer CHECK (retention_days >= 0),
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(table_schema, table_name, column_name)
);

-- Track user consents (for processing personal data)
CREATE TABLE IF NOT EXISTS compliance.consents (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id      uuid NOT NULL,
    purpose         text NOT NULL,
    granted         boolean NOT NULL,
    granted_at      timestamptz,
    revoked_at      timestamptz,
    ip_address      inet,
    user_agent      text,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_consents_subject
    ON compliance.consents(subject_id);
CREATE INDEX IF NOT EXISTS idx_compliance_consents_purpose
    ON compliance.consents(purpose);

-- Track data subject requests (access, deletion, rectification, portability)
CREATE TABLE IF NOT EXISTS compliance.data_requests (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id      uuid NOT NULL,
    request_type    text NOT NULL CHECK (request_type IN (
        'access', 'deletion', 'rectification',
        'portability', 'restriction', 'objection'
    )),
    status          text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'rejected'
    )),
    requested_at    timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    notes           text,
    response        text
);

CREATE INDEX IF NOT EXISTS idx_compliance_requests_subject
    ON compliance.data_requests(subject_id);
CREATE INDEX IF NOT EXISTS idx_compliance_requests_status
    ON compliance.data_requests(status);

-- Track data breaches (must be notified within 5 days per Law 18-07)
CREATE TABLE IF NOT EXISTS compliance.breaches (
    id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    discovered_at        timestamptz NOT NULL,
    nature               text NOT NULL,
    affected_subjects    integer DEFAULT 0,
    data_categories      text[] DEFAULT '{}',
    severity             text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    contained_at         timestamptz,
    notified_anpdp_at    timestamptz,
    notified_subjects_at timestamptz,
    notes                text,
    created_at           timestamptz NOT NULL DEFAULT now()
);
