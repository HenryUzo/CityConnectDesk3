-- Add emoji column to categories for UI display
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS emoji text;

-- Optionally backfill common categories with emojis if name/key matches
UPDATE categories
SET emoji = CASE
  WHEN key = 'electrician' THEN '🔌'
  WHEN key = 'plumber' THEN '🔧'
  WHEN key = 'carpenter' THEN '🪚'
  WHEN key = 'hvac_technician' THEN '❄️'
  WHEN key = 'painter' THEN '🎨'
  WHEN key = 'tiler' THEN '🧱'
  WHEN key = 'mason' THEN '🧱'
  WHEN key = 'roofer' THEN '🏠'
  WHEN key = 'gardener' THEN '🌿'
  WHEN key = 'cleaner' THEN '🧼'
  WHEN key = 'security_guard' THEN '🛡️'
  WHEN key = 'cook' THEN '🍳'
  WHEN key = 'laundry_service' THEN '🧺'
  WHEN key = 'pest_control' THEN '🐜'
  WHEN key = 'welder' THEN '⚙️'
  WHEN key = 'mechanic' THEN '🔩'
  WHEN key = 'phone_repair' THEN '📱'
  WHEN key = 'appliance_repair' THEN '🔌'
  WHEN key = 'tailor' THEN '🧵'
  WHEN key = 'market_runner' THEN '🛒'
  ELSE emoji
END
WHERE emoji IS NULL;
