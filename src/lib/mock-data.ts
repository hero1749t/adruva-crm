// Mock data and types for Adruva CRM

export type UserRole = 'owner' | 'admin' | 'team';
export type UserStatus = 'active' | 'inactive';
export type LeadStatus = 'new_lead' | 'audit_booked' | 'audit_done' | 'in_progress' | 'lead_won' | 'lead_lost';
export type ClientStatus = 'active' | 'paused' | 'completed';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type BillingStatus = 'due' | 'paid' | 'overdue';

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  email: string;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  company_name: string | null;
  phone: string;
  email: string;
  source: string | null;
  service_interest: string | null;
  assigned_to: string | null;
  assigned_to_name?: string;
  status: LeadStatus;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  lead_id: string | null;
  client_name: string;
  company_name: string | null;
  phone: string | null;
  email: string;
  plan: string | null;
  monthly_payment: number | null;
  start_date: string | null;
  contract_end_date: string | null;
  billing_status: BillingStatus;
  assigned_manager: string | null;
  assigned_manager_name?: string;
  status: ClientStatus;
  created_at: string;
}

export interface Task {
  id: string;
  client_id: string;
  client_name?: string;
  task_title: string;
  deadline: string;
  priority: TaskPriority;
  assigned_to: string | null;
  assigned_to_name?: string;
  status: TaskStatus;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

// Current user mock
export const currentUser: Profile = {
  id: '1',
  name: 'Adruva Owner',
  role: 'owner',
  status: 'active',
  email: 'owner@adruva.com',
  created_at: '2024-01-01',
};

// Mock leads
export const mockLeads: Lead[] = [
  { id: '1', name: 'Rahul Sharma', company_name: 'TechNova Solutions', phone: '+919876543210', email: 'rahul@technova.in', source: 'referral', service_interest: 'seo', assigned_to: '2', assigned_to_name: 'Priya Admin', status: 'new_lead', notes: null, is_deleted: false, created_at: '2026-03-01', updated_at: '2026-03-01' },
  { id: '2', name: 'Anita Desai', company_name: 'GreenLeaf Organics', phone: '+919123456789', email: 'anita@greenleaf.co', source: 'organic', service_interest: 'gmb', assigned_to: '3', assigned_to_name: 'Vikram Team', status: 'audit_booked', notes: null, is_deleted: false, created_at: '2026-02-28', updated_at: '2026-03-02' },
  { id: '3', name: 'Karan Mehta', company_name: 'BlueSky Travels', phone: '+918765432109', email: 'karan@bluesky.in', source: 'cold_call', service_interest: 'meta_ads', assigned_to: '2', assigned_to_name: 'Priya Admin', status: 'audit_done', notes: 'Interested in Meta + Google Ads combo', is_deleted: false, created_at: '2026-02-20', updated_at: '2026-03-03' },
  { id: '4', name: 'Sneha Patel', company_name: 'FitZone Gym', phone: '+917654321098', email: 'sneha@fitzone.in', source: 'social', service_interest: 'google_ads', assigned_to: '3', assigned_to_name: 'Vikram Team', status: 'in_progress', notes: null, is_deleted: false, created_at: '2026-02-15', updated_at: '2026-03-04' },
  { id: '5', name: 'Amit Verma', company_name: 'CloudStack IT', phone: '+916543210987', email: 'amit@cloudstack.io', source: 'referral', service_interest: 'website', assigned_to: '2', assigned_to_name: 'Priya Admin', status: 'lead_won', notes: 'Closed deal for SEO Pro', is_deleted: false, created_at: '2026-01-10', updated_at: '2026-02-28' },
  { id: '6', name: 'Deepika Rao', company_name: 'Artisan Bakers', phone: '+919988776655', email: 'deepika@artisan.in', source: 'walk_in', service_interest: 'gmb', assigned_to: null, assigned_to_name: undefined, status: 'new_lead', notes: null, is_deleted: false, created_at: '2026-03-05', updated_at: '2026-03-05' },
  { id: '7', name: 'Manish Kumar', company_name: 'QuickFix Repairs', phone: '+918877665544', email: 'manish@quickfix.co', source: 'organic', service_interest: 'seo', assigned_to: '3', assigned_to_name: 'Vikram Team', status: 'lead_lost', notes: 'Budget constraints', is_deleted: false, created_at: '2026-01-20', updated_at: '2026-02-15' },
  { id: '8', name: 'Pooja Singh', company_name: 'StyleHub Fashion', phone: '+917766554433', email: 'pooja@stylehub.in', source: 'social', service_interest: 'meta_ads', assigned_to: '2', assigned_to_name: 'Priya Admin', status: 'in_progress', notes: null, is_deleted: false, created_at: '2026-02-10', updated_at: '2026-03-06' },
];

// Mock clients
export const mockClients: Client[] = [
  { id: '1', lead_id: '5', client_name: 'Amit Verma', company_name: 'CloudStack IT', phone: '+916543210987', email: 'amit@cloudstack.io', plan: 'seo_pro', monthly_payment: 25000, start_date: '2026-03-01', contract_end_date: '2026-09-01', billing_status: 'paid', assigned_manager: '2', assigned_manager_name: 'Priya Admin', status: 'active', created_at: '2026-03-01' },
  { id: '2', lead_id: null, client_name: 'Ravi Gupta', company_name: 'UrbanEats', phone: '+919112233445', email: 'ravi@urbaneats.in', plan: 'combo', monthly_payment: 45000, start_date: '2026-01-15', contract_end_date: '2026-07-15', billing_status: 'due', assigned_manager: '3', assigned_manager_name: 'Vikram Team', status: 'active', created_at: '2026-01-15' },
  { id: '3', lead_id: null, client_name: 'Neha Jain', company_name: 'BrightSmile Dental', phone: '+918223344556', email: 'neha@brightsmile.in', plan: 'gmb', monthly_payment: 12000, start_date: '2025-11-01', contract_end_date: '2026-05-01', billing_status: 'overdue', assigned_manager: '2', assigned_manager_name: 'Priya Admin', status: 'active', created_at: '2025-11-01' },
  { id: '4', lead_id: null, client_name: 'Suresh Iyer', company_name: 'GreenTech Solar', phone: '+917334455667', email: 'suresh@greentech.in', plan: 'google_ads', monthly_payment: 35000, start_date: '2025-10-01', contract_end_date: '2026-04-01', billing_status: 'paid', assigned_manager: '3', assigned_manager_name: 'Vikram Team', status: 'paused', created_at: '2025-10-01' },
];

// Mock tasks
export const mockTasks: Task[] = [
  { id: '1', client_id: '1', client_name: 'CloudStack IT', task_title: 'Initial Website Audit', deadline: '2026-03-04', priority: 'high', assigned_to: '3', assigned_to_name: 'Vikram Team', status: 'completed', notes: null, completed_at: '2026-03-03', created_at: '2026-03-01' },
  { id: '2', client_id: '1', client_name: 'CloudStack IT', task_title: 'GMB Profile Setup & Optimise', deadline: '2026-03-06', priority: 'high', assigned_to: '3', assigned_to_name: 'Vikram Team', status: 'in_progress', notes: null, completed_at: null, created_at: '2026-03-01' },
  { id: '3', client_id: '1', client_name: 'CloudStack IT', task_title: 'Keyword Research', deadline: '2026-03-08', priority: 'high', assigned_to: '2', assigned_to_name: 'Priya Admin', status: 'pending', notes: null, completed_at: null, created_at: '2026-03-01' },
  { id: '4', client_id: '2', client_name: 'UrbanEats', task_title: 'Meta Business Manager Setup', deadline: '2026-03-02', priority: 'medium', assigned_to: '3', assigned_to_name: 'Vikram Team', status: 'overdue', notes: null, completed_at: null, created_at: '2026-02-25' },
  { id: '5', client_id: '2', client_name: 'UrbanEats', task_title: 'Monthly Report — Month 2', deadline: '2026-03-15', priority: 'medium', assigned_to: '2', assigned_to_name: 'Priya Admin', status: 'pending', notes: null, completed_at: null, created_at: '2026-03-01' },
  { id: '6', client_id: '3', client_name: 'BrightSmile Dental', task_title: 'On-Page SEO Implementation', deadline: '2026-03-10', priority: 'medium', assigned_to: '3', assigned_to_name: 'Vikram Team', status: 'in_progress', notes: null, completed_at: null, created_at: '2026-02-20' },
  { id: '7', client_id: '3', client_name: 'BrightSmile Dental', task_title: 'GMB Review Response Setup', deadline: '2026-03-07', priority: 'low', assigned_to: '2', assigned_to_name: 'Priya Admin', status: 'overdue', notes: null, completed_at: null, created_at: '2026-02-28' },
  { id: '8', client_id: '1', client_name: 'CloudStack IT', task_title: 'On-Page SEO Implementation', deadline: '2026-03-15', priority: 'medium', assigned_to: '3', assigned_to_name: 'Vikram Team', status: 'pending', notes: null, completed_at: null, created_at: '2026-03-01' },
];

export const mockTeam: Profile[] = [
  currentUser,
  { id: '2', name: 'Priya Admin', role: 'admin', status: 'active', email: 'priya@adruva.com', created_at: '2024-02-01' },
  { id: '3', name: 'Vikram Team', role: 'team', status: 'active', email: 'vikram@adruva.com', created_at: '2024-03-01' },
  { id: '4', name: 'Meera Team', role: 'team', status: 'inactive', email: 'meera@adruva.com', created_at: '2024-04-01' },
];

// Status color helpers
export const leadStatusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new_lead: { label: 'New Lead', color: 'bg-muted text-muted-foreground' },
  audit_booked: { label: 'Audit Booked', color: 'bg-primary/20 text-primary' },
  audit_done: { label: 'Audit Done', color: 'bg-accent/20 text-accent' },
  in_progress: { label: 'In Progress', color: 'bg-warning/20 text-warning' },
  lead_won: { label: 'Lead Won', color: 'bg-success/20 text-success' },
  lead_lost: { label: 'Lead Lost', color: 'bg-destructive/20 text-destructive' },
};

export const taskPriorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-destructive/20 text-destructive' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  medium: { label: 'Medium', color: 'bg-warning/20 text-warning' },
  low: { label: 'Low', color: 'bg-success/20 text-success' },
};

export const taskStatusConfig: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', color: 'bg-primary/20 text-primary' },
  completed: { label: 'Completed', color: 'bg-success/20 text-success' },
  overdue: { label: 'Overdue', color: 'bg-destructive/20 text-destructive' },
};

export const clientStatusConfig: Record<ClientStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-success/20 text-success' },
  paused: { label: 'Paused', color: 'bg-warning/20 text-warning' },
  completed: { label: 'Completed', color: 'bg-muted text-muted-foreground' },
};
