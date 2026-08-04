-- MassiCloud audit schema
-- Required for Law 18-07 compliance — tracks all data changes

CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.logs (
    id          bigserial PRIMARY KEY,
    schema_name text NOT NULL,
    table_name  text NOT NULL,
    operation   text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    row_id      text,
    old_data    jsonb,
    new_data    jsonb,
    changed_by  text,
    changed_at  timestamptz NOT NULL DEFAULT now(),
    ip_address  inet
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit.logs(schema_name, table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit.logs(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit.logs(operation);

-- Generic audit trigger function
-- Usage: CREATE TRIGGER tbl_audit AFTER INSERT OR UPDATE OR DELETE
--        ON public.your_table FOR EACH ROW EXECUTE FUNCTION audit.log_changes();
CREATE OR REPLACE FUNCTION audit.log_changes()
RETURNS trigger AS $$
DECLARE
    row_id_value text;
BEGIN
    BEGIN
        IF TG_OP = 'DELETE' THEN
            row_id_value := (row_to_json(OLD)::jsonb->>'id');
        ELSE
            row_id_value := (row_to_json(NEW)::jsonb->>'id');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        row_id_value := NULL;
    END;

    INSERT INTO audit.logs (
        schema_name, table_name, operation, row_id, old_data, new_data
    )
    VALUES (
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        TG_OP,
        row_id_value,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE')
             THEN row_to_json(OLD)::jsonb END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE')
             THEN row_to_json(NEW)::jsonb END
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
