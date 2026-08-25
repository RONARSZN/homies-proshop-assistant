-- Adds the 'allocation' stock movement reason: gear handed to a team rider.
--
-- This is its own migration on purpose. Postgres allows ALTER TYPE ... ADD
-- VALUE inside a transaction, but the new value cannot be *used* until that
-- transaction commits. The table, constraint and policies that reference
-- 'allocation' therefore live in the next migration.

alter type public.stock_movement_reason add value if not exists 'allocation';
