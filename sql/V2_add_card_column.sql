ALTER TABLE tbl_user
    ADD COLUMN IF NOT EXISTS card JSONB DEFAULT NULL;

INSERT INTO tbl_system_config (config_name, config_value, description)
VALUES ('MAXIMUM_CARD', '100', 'Maximum items allowed in card')
ON CONFLICT (config_name) DO NOTHING;
