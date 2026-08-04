-- Phase 2: store FCM web push tokens per user/device

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL,
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT user_push_tokens_token_key UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_id_idx
  ON public.user_push_tokens(user_id);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_enabled_idx
  ON public.user_push_tokens(user_id)
  WHERE enabled = true;

COMMENT ON TABLE public.user_push_tokens IS
  'FCM registration tokens for web push; one row per browser/device token.';

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Admins can view all push tokens" ON public.user_push_tokens;

CREATE POLICY "Users can view own push tokens"
  ON public.user_push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON public.user_push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
  ON public.user_push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens"
  ON public.user_push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all push tokens"
  ON public.user_push_tokens
  FOR SELECT
  USING (public.is_admin());
