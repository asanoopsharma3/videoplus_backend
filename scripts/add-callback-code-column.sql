-- Run against your gameshub database (synchronize is off).
-- Ensures code, transactionId, and notificationType columns exist.

ALTER TABLE callback_transactions
  ADD COLUMN IF NOT EXISTS code varchar(50);

ALTER TABLE callback_transactions
  ADD COLUMN IF NOT EXISTS "transactionId" varchar(200);

ALTER TABLE callback_transactions
  ADD COLUMN IF NOT EXISTS "notificationType" varchar(50);
