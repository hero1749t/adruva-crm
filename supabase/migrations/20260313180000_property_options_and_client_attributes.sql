ALTER TABLE public.leads
  ALTER COLUMN source TYPE text USING source::text,
  ALTER COLUMN business_type TYPE text USING business_type::text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS business_type text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'services'
  ) THEN
    UPDATE public.clients
    SET services = COALESCE(services, ARRAY[]::text[])
    WHERE services IS NULL;
  END IF;
END $$;

INSERT INTO public.custom_field_definitions (
  entity_type,
  field_key,
  label,
  field_type,
  options,
  is_required,
  is_visible,
  sort_order
)
SELECT *
FROM (
  VALUES
    (
      'lead',
      'source',
      'Source',
      'select',
      '[
        {"label":"Cold Outreach","value":"cold_outreach"},
        {"label":"Instagram","value":"instagram"},
        {"label":"Facebook","value":"facebook"},
        {"label":"Website","value":"website"},
        {"label":"WhatsApp","value":"whatsapp"},
        {"label":"Google","value":"google"},
        {"label":"Referral","value":"referral"}
      ]'::jsonb,
      false,
      true,
      -30
    ),
    (
      'lead',
      'business_type',
      'Business Type',
      'select',
      '[
        {"label":"Restaurant","value":"restaurant"},
        {"label":"Salon","value":"salon"},
        {"label":"Gym","value":"gym"},
        {"label":"Clinic","value":"clinic"},
        {"label":"Real Estate","value":"real_estate"},
        {"label":"Travel Agency","value":"travel_agency"},
        {"label":"Beauty & Spa","value":"beauty_spa"},
        {"label":"Retail Store","value":"retail_store"},
        {"label":"Local Service Business","value":"local_service_business"},
        {"label":"Other","value":"other"}
      ]'::jsonb,
      false,
      true,
      -29
    ),
    (
      'lead',
      'service_interest',
      'Service Interest',
      'multi_select',
      '[
        {"label":"Digital Marketing","value":"digital_marketing"},
        {"label":"Website Development","value":"website_development"},
        {"label":"Google Ads Management","value":"google_ads_management"},
        {"label":"Meta Ads Management","value":"meta_ads_management"},
        {"label":"Search Engine Optimization (SEO)","value":"seo"},
        {"label":"CRM & Automation Systems","value":"crm_automation_systems"}
      ]'::jsonb,
      false,
      true,
      -28
    ),
    (
      'client',
      'source',
      'Source',
      'select',
      '[
        {"label":"Cold Outreach","value":"cold_outreach"},
        {"label":"Instagram","value":"instagram"},
        {"label":"Facebook","value":"facebook"},
        {"label":"Website","value":"website"},
        {"label":"WhatsApp","value":"whatsapp"},
        {"label":"Google","value":"google"},
        {"label":"Referral","value":"referral"}
      ]'::jsonb,
      false,
      true,
      -30
    ),
    (
      'client',
      'business_type',
      'Business Type',
      'select',
      '[
        {"label":"Restaurant","value":"restaurant"},
        {"label":"Salon","value":"salon"},
        {"label":"Gym","value":"gym"},
        {"label":"Clinic","value":"clinic"},
        {"label":"Real Estate","value":"real_estate"},
        {"label":"Travel Agency","value":"travel_agency"},
        {"label":"Beauty & Spa","value":"beauty_spa"},
        {"label":"Retail Store","value":"retail_store"},
        {"label":"Local Service Business","value":"local_service_business"},
        {"label":"Other","value":"other"}
      ]'::jsonb,
      false,
      true,
      -29
    ),
    (
      'client',
      'services',
      'Service Interested',
      'multi_select',
      '[
        {"label":"Digital Marketing","value":"digital_marketing"},
        {"label":"Website Development","value":"website_development"},
        {"label":"Google Ads Management","value":"google_ads_management"},
        {"label":"Meta Ads Management","value":"meta_ads_management"},
        {"label":"Search Engine Optimization (SEO)","value":"seo"},
        {"label":"CRM & Automation Systems","value":"crm_automation_systems"}
      ]'::jsonb,
      false,
      true,
      -28
    )
) AS seed(entity_type, field_key, label, field_type, options, is_required, is_visible, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.custom_field_definitions existing
  WHERE existing.entity_type = seed.entity_type
    AND existing.field_key = seed.field_key
);
