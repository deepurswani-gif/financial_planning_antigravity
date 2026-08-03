-- Calendar-year subscription expiry for detailed planning unlock.
-- Intro pricing (₹399) covers through through year through Dec 2026; renew each calendar year after.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS subscription_valid_until date;

COMMENT ON COLUMN public.user_profiles.subscription_valid_until IS
  'Inclusive end date of paid/coupon detailed-planning access (calendar year).';

-- Keep existing update policy; subscription_valid_until is writable when activating.
-- Re-assert policy so activation can set subscription_active + subscription_valid_until together.
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND email = (select up.email from public.user_profiles up where up.id = auth.uid())
    AND role = (select up.role from public.user_profiles up where up.id = auth.uid())
    AND is_approved = (select up.is_approved from public.user_profiles up where up.id = auth.uid())
    AND (
      subscription_active = (select up.subscription_active from public.user_profiles up where up.id = auth.uid())
      OR subscription_active = true
    )
  );
