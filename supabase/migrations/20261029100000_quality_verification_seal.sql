-- The application records the confirmation seal with every quality verification.
-- Keep the change safe for databases where the column was added manually already.
ALTER TABLE IF EXISTS public.quality_verifications
  ADD COLUMN IF NOT EXISTS verification_seal text;
