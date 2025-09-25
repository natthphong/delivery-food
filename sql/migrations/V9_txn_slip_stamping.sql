ALTER TABLE tbl_transaction
  ADD COLUMN IF NOT EXISTS trans_ref       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS trans_date      DATE,
  ADD COLUMN IF NOT EXISTS trans_timestamp TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tbl_transaction_transref_transdate_notnull
  ON tbl_transaction (trans_ref, trans_date)
  WHERE trans_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_tbl_transaction_transdate
  ON tbl_transaction (trans_date);
