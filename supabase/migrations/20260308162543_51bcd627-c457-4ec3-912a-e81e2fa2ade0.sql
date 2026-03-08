
-- Fix search_path on update_lead_search function
CREATE OR REPLACE FUNCTION update_lead_search()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name,'') || ' ' ||
    coalesce(NEW.email,'') || ' ' ||
    coalesce(NEW.phone,'') || ' ' ||
    coalesce(NEW.company_name,'')
  );
  RETURN NEW;
END;
$$;
