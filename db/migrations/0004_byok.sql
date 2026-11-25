-- Encrypted per-user BYOK AI key on app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ai_api_key_enc text;
