
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_deleted ON leads(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_created ON clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_manager ON clients(assigned_manager);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_compound ON tasks(status, assigned_to, deadline);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);

-- Full-text search on leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_leads_search ON leads USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_lead_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name,'') || ' ' ||
    coalesce(NEW.email,'') || ' ' ||
    coalesce(NEW.phone,'') || ' ' ||
    coalesce(NEW.company_name,'')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_search_update ON leads;
CREATE TRIGGER leads_search_update
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_lead_search();
