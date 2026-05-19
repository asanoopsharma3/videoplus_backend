-- Allow duplicate requestNo on callback inserts
ALTER TABLE callback_transactions
  DROP CONSTRAINT IF EXISTS callback_transactions_requestno_key;

ALTER TABLE callback_transactions
  DROP CONSTRAINT IF EXISTS "callback_transactions_requestNo_key";

ALTER TABLE callback_transactions
  DROP CONSTRAINT IF EXISTS "UQ_callback_transactions_requestNo";
