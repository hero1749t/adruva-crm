CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  invoice_date date := COALESCE(NEW.created_at::date, now()::date);
  fy_start integer;
  fy_end integer;
  fy_code text;
  next_num integer;
BEGIN
  IF EXTRACT(MONTH FROM invoice_date) >= 4 THEN
    fy_start := EXTRACT(YEAR FROM invoice_date);
  ELSE
    fy_start := EXTRACT(YEAR FROM invoice_date) - 1;
  END IF;

  fy_end := (fy_start + 1) % 100;
  fy_code := LPAD((fy_start % 100)::text, 2, '0') || LPAD(fy_end::text, 2, '0');

  SELECT COALESCE(
    MAX(
      CASE
        WHEN invoice_number ~ ('^ADR-' || fy_code || '-[0-9]{5}$')
        THEN CAST(split_part(invoice_number, '-', 3) AS integer)
        ELSE NULL
      END
    ),
    0
  ) + 1
  INTO next_num
  FROM public.invoices;

  NEW.invoice_number := 'ADR-' || fy_code || '-' || LPAD(next_num::text, 5, '0');
  RETURN NEW;
END;
$$;
