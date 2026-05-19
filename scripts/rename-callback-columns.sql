-- Run against your gameshub database (synchronize is off).
-- Renames columns to match CallbackTransaction entity updates.

ALTER TABLE callback_transactions
  RENAME COLUMN "sequenceNo" TO "sequenceNumber";

ALTER TABLE callback_transactions
  RENAME COLUMN status TO result;

ALTER TABLE callback_transactions
  ADD COLUMN IF NOT EXISTS code varchar(50);

ALTER TABLE callback_transactions
  ADD COLUMN IF NOT EXISTS "transactionId" varchar(200);

ALTER TABLE callback_transactions
  ADD COLUMN IF NOT EXISTS "notificationType" varchar(50);

-- Allow duplicate requestNo (no unique skip on callback)
ALTER TABLE callback_transactions
  DROP CONSTRAINT IF EXISTS "UQ_callback_transactions_requestNo";

ALTER TABLE callback_transactions
  DROP CONSTRAINT IF EXISTS callback_transactions_requestno_key;

ALTER TABLE callback_transactions
  DROP CONSTRAINT IF EXISTS "callback_transactions_requestNo_key";
