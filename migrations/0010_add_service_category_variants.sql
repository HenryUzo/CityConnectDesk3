ALTER TYPE service_category ADD VALUE IF NOT EXISTS 'general_repairs';
ALTER TYPE service_category ADD VALUE IF NOT EXISTS 'locksmith';
ALTER TYPE service_category ADD VALUE IF NOT EXISTS 'glass_windows';

UPDATE service_requests
SET category = 'general_repairs'::service_category
WHERE category = 'maintenance_repair'::service_category
  AND lower(coalesce(category_label, '')) IN ('general repairs', 'general repair');

UPDATE service_requests
SET category = 'locksmith'::service_category
WHERE category = 'maintenance_repair'::service_category
  AND lower(coalesce(category_label, '')) = 'locksmith';

UPDATE service_requests
SET category = 'glass_windows'::service_category
WHERE category = 'maintenance_repair'::service_category
  AND (
    lower(coalesce(category_label, '')) IN ('glass windows', 'glass window', 'glass & windows')
    OR (
      lower(coalesce(category_label, '')) LIKE '%glass%'
      AND lower(coalesce(category_label, '')) LIKE '%window%'
    )
  );
