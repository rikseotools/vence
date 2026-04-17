-- Add hardware fingerprint column to user_devices
-- This fingerprint survives localStorage clears (based on screen, GPU, timezone, etc.)
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS hw_fingerprint TEXT;
CREATE INDEX IF NOT EXISTS idx_user_devices_hw_fingerprint ON user_devices(hw_fingerprint);
