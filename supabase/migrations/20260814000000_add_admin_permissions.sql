-- Add admin_permissions column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN admin_permissions JSONB DEFAULT NULL;
