
CREATE OR REPLACE FUNCTION public.fire_automation_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  trigger_evt text;
  entity_data jsonb;
  old_entity_data jsonb;
BEGIN
  -- Determine trigger event and entity type
  IF TG_TABLE_NAME = 'leads' THEN
    IF TG_OP = 'INSERT' THEN
      trigger_evt := 'lead_created';
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      trigger_evt := 'lead_status_changed';
    ELSE
      RETURN NEW;
    END IF;
    entity_data := jsonb_build_object(
      '_entity_type', 'lead',
      'name', NEW.name,
      'email', NEW.email,
      'phone', NEW.phone,
      'status', NEW.status,
      'source', NEW.source,
      'assigned_to', NEW.assigned_to,
      'company_name', NEW.company_name
    );
    IF TG_OP = 'UPDATE' THEN
      old_entity_data := jsonb_build_object('status', OLD.status);
    END IF;
  ELSIF TG_TABLE_NAME = 'clients' THEN
    IF TG_OP = 'INSERT' THEN
      trigger_evt := 'client_created';
    ELSE
      RETURN NEW;
    END IF;
    entity_data := jsonb_build_object(
      '_entity_type', 'client',
      'client_name', NEW.client_name,
      'email', NEW.email,
      'assigned_manager', NEW.assigned_manager,
      'status', NEW.status
    );
  ELSE
    RETURN NEW;
  END IF;

  -- Only fire if matching rules exist
  IF EXISTS (
    SELECT 1 FROM public.automation_rules
    WHERE trigger_event = trigger_evt AND is_active = true
  ) THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://nrvevkiddjqndapvmcmo.supabase.co/functions/v1/execute-automation',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ydmV2a2lkZGpxbmRhcHZtY21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTA0MzQsImV4cCI6MjA4ODUyNjQzNH0.4XFJEy7COFzUMwtTBtEfTxpRFD4kADWCJygBDQ_vbZA"}'::jsonb,
        body := jsonb_build_object(
          'trigger_event', trigger_evt,
          'entity_id', NEW.id,
          'entity_data', entity_data,
          'old_data', COALESCE(old_entity_data, '{}'::jsonb)
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Automation trigger failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
