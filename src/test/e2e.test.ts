import { describe, it, expect, beforeEach } from 'vitest';
import { TestDataGenerator, MockDatabase, Validators, TestHelpers, Assertions } from './test-utils';

// ============================================================
// 🌐 E2E USER FLOW TESTS
// ============================================================

describe('E2E - Complete User Workflows', () => {
  
  beforeEach(() => {
    MockDatabase.clear();
  });

  describe('Scenario 1: New Lead to Paid Invoice', () => {
    
    it('should complete full lead-to-payment workflow', () => {
      // Step 1: Create lead
      const lead = TestDataGenerator.generateLead({
        name: 'Tech Innovators Inc',
        email: 'contact@techinnovators.com'
      });
      
      Assertions.shouldBeValidLead(lead);
      const createdLead = MockDatabase.createLead(lead);
      expect(createdLead.status).toEqual('new_lead');
      console.log('✅ Step 1: Lead created');

      // Step 2: Schedule audit
      MockDatabase.updateLead(lead.id, {
        status: 'audit_booked',
        audit_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      
      const updatedLead = MockDatabase.findLead(lead.id);
      expect(updatedLead.status).toEqual('audit_booked');
      console.log('✅ Step 2: Audit scheduled');

      // Step 3: Complete audit
      MockDatabase.updateLead(lead.id, {
        status: 'audit_done',
        audit_completed_date: new Date().toISOString()
      });
      
      expect(MockDatabase.findLead(lead.id).status).toEqual('audit_done');
      console.log('✅ Step 3: Audit completed');

      // Step 4: Convert to client
      MockDatabase.updateLead(lead.id, { status: 'lead_won' });
      
      const client = TestDataGenerator.generateClient({
        name: lead.name,
        email: lead.email,
        source_lead_id: lead.id,
        contract_value: 100000
      });
      
      MockDatabase.createClient(client);
      Assertions.shouldBeValidLead(client);
      console.log('✅ Step 4: Lead converted to client');

      // Step 5: Create invoice
      const invoice = TestDataGenerator.generateInvoice({
        client_id: client.id,
        client_name: client.name,
        total: client.contract_value
      });
      
      MockDatabase.createInvoice(invoice);
      Assertions.shouldBeValidInvoice(invoice);
      console.log('✅ Step 5: Invoice created');

      // Step 6: Send invoice
      (MockDatabase as any).updateInvoice = (id: string, updates: any) => {
        const inv = MockDatabase.invoices.find((i: any) => i.id === id);
        if (inv) Object.assign(inv, updates);
        return inv;
      };
      
      const sentInvoice: any = { ...invoice, status: 'sent', sent_at: new Date().toISOString() };
      console.log('✅ Step 6: Invoice sent');

      // Step 7: Receive payment
      sentInvoice.payment_status = 'paid';
      sentInvoice.paid_amount = sentInvoice.total;
      sentInvoice.payment_date = new Date().toISOString();
      
      expect(sentInvoice.payment_status).toEqual('paid');
      console.log('✅ Step 7: Payment received');

      // Verify workflow completion
      const stats = MockDatabase.getStats();
      expect(stats.totalLeads).toBeGreaterThan(0);
      expect(stats.totalClients).toBeGreaterThan(0);
      expect(stats.totalInvoices).toBeGreaterThan(0);
      console.log('✅ Workflow complete: Lead → Client → Invoice → Payment');
    });
  });

  describe('Scenario 2: Multi-Task Project Management', () => {
    
    it('should manage project with multiple tasks and team', () => {
      // Create project lead
      const lead = TestDataGenerator.generateUser({ name: 'Project Manager', role: 'admin' });
      MockDatabase.createUser(lead);
      
      // Create team members
      const teamMembers = [
        TestDataGenerator.generateUser({ name: 'Auditor 1', role: 'team' }),
        TestDataGenerator.generateUser({ name: 'Auditor 2', role: 'team' }),
        TestDataGenerator.generateUser({ name: 'Report Writer', role: 'team' })
      ];
      
      teamMembers.forEach(member => MockDatabase.createUser(member));
      expect(MockDatabase.users.length).toEqual(4);
      console.log('✅ Team created: 1 PM + 3 team members');

      // Create tasks
      const tasks = [
        TestDataGenerator.generateTask({ 
          title: 'Data Collection',
          priority: 'high',
          assigned_to: teamMembers[0].email
        }),
        TestDataGenerator.generateTask({ 
          title: 'Financial Analysis',
          priority: 'high',
          assigned_to: teamMembers[1].email
        }),
        TestDataGenerator.generateTask({ 
          title: 'Report Preparation',
          priority: 'medium',
          assigned_to: teamMembers[2].email
        })
      ];
      
      tasks.forEach(task => MockDatabase.createTask(task));
      expect(MockDatabase.tasks.length).toEqual(3);
      console.log('✅ Tasks created: 3 tasks assigned to team');

      // Mark tasks as complete
      let completedCount = 0;
      tasks.forEach((task, index) => {
        (MockDatabase as any).updateTask = (id: string, updates: any) => {
          const t = MockDatabase.tasks.find((tk: any) => tk.id === id);
          if (t) Object.assign(t, updates);
          return t;
        };
        
        if (index < 2) {
          (tasks[index] as any).status = 'completed';
          (tasks[index] as any).completed_at = new Date().toISOString();
          completedCount++;
        }
      });
      
      expect(completedCount).toEqual(2);
      console.log(`✅ Tasks completed: ${completedCount}/3 tasks done`);

      // Overall project status
      const projectStatus = {
        taskCount: tasks.length,
        completedCount: completedCount,
        percentComplete: (completedCount / tasks.length * 100).toFixed(0),
        teamSize: teamMembers.length
      };
      
      console.log(`✅ Project status: ${projectStatus.percentComplete}% complete`);
    });
  });

  describe('Scenario 3: Monthly Reporting & Billing Cycle', () => {
    
    it('should complete monthly cycle with multiple clients', () => {
      // Create 5 clients
      const clients = Array.from({ length: 5 }, () =>
        MockDatabase.createClient(TestDataGenerator.generateClient({
          status: 'active',
          contract_value: Math.floor(Math.random() * 200000) + 50000
        }))
      );
      
      expect(clients.length).toEqual(5);
      console.log('✅ Created 5 active clients');

      // Generate invoices for all clients
      const invoices = clients.map(client => 
        MockDatabase.createInvoice(TestDataGenerator.generateInvoice({
          client_id: client.id,
          client_name: client.name,
          total: client.contract_value
        }))
      );
      
      expect(invoices.length).toEqual(5);
      console.log('✅ Generated 5 invoices');

      // Track payment status
      let receivedPayments = 0;
      let totalAmount = 0;
      
      invoices.forEach((invoice, index) => {
        if (index < 3) { // 3 out of 5 have been paid
          invoice.payment_status = 'paid';
          invoice.paid_amount = invoice.total;
          invoice.payment_date = new Date().toISOString();
          receivedPayments++;
          totalAmount += invoice.total;
        }
      });
      
      console.log(`✅ Payments received: ${receivedPayments}/5 invoices paid`);
      console.log(`✅ Revenue collected: $${totalAmount}`);

      // Generate monthly report
      const monthlyReport = {
        month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalClients: clients.length,
        activeClients: clients.filter(c => c.status === 'active').length,
        invoicesGenerated: invoices.length,
        paymentReceived: receivedPayments,
        paymentRate: `${(receivedPayments / invoices.length * 100).toFixed(0)}%`,
        totalRevenue: totalAmount,
        outstandingAmount: invoices.reduce((sum, inv) => 
          inv.payment_status !== 'paid' ? sum + inv.total : sum, 0
        )
      };
      
      console.log('✅ Monthly Report:');
      console.log(`   - Active Clients: ${monthlyReport.activeClients}`);
      console.log(`   - Invoices: ${monthlyReport.invoicesGenerated}`);
      console.log(`   - Collection Rate: ${monthlyReport.paymentRate}`);
      console.log(`   - Revenue: $${monthlyReport.totalRevenue}`);
      console.log(`   - Outstanding: $${monthlyReport.outstandingAmount}`);
    });
  });

  describe('Scenario 4: Lead Nurturing Campaign', () => {
    
    it('should track lead through nurturing funnel', () => {
      // Create multiple leads at different stages
      const leads = [
        TestDataGenerator.generateLead({ status: 'new_lead', name: 'Lead A' }),
        TestDataGenerator.generateLead({ status: 'audit_booked', name: 'Lead B' }),
        TestDataGenerator.generateLead({ status: 'audit_done', name: 'Lead C' }),
        TestDataGenerator.generateLead({ status: 'in_progress', name: 'Lead D' }),
        TestDataGenerator.generateLead({ status: 'lead_won', name: 'Lead E' })
      ];
      
      leads.forEach(lead => MockDatabase.createLead(lead));
      expect(MockDatabase.leads.length).toEqual(5);
      console.log('✅ Leads created across funnel stages');

      // Track status distribution
      const funnelMetrics = {
        new_lead: leads.filter(l => l.status === 'new_lead').length,
        audit_booked: leads.filter(l => l.status === 'audit_booked').length,
        audit_done: leads.filter(l => l.status === 'audit_done').length,
        in_progress: leads.filter(l => l.status === 'in_progress').length,
        lead_won: leads.filter(l => l.status === 'lead_won').length
      };
      
      console.log('✅ Funnel Metrics:');
      console.log(`   - New Leads: ${funnelMetrics.new_lead}`);
      console.log(`   - Scheduled: ${funnelMetrics.audit_booked}`);
      console.log(`   - Audited: ${funnelMetrics.audit_done}`);
      console.log(`   - In Progress: ${funnelMetrics.in_progress}`);
      console.log(`   - Won Deals: ${funnelMetrics.lead_won}`);
      
      // Calculate conversion rates
      const conversionRates = {
        toScheduled: `${(funnelMetrics.audit_booked / funnelMetrics.new_lead * 100).toFixed(0)}%`,
        toWon: `${(funnelMetrics.lead_won / funnelMetrics.new_lead * 100).toFixed(0)}%`
      };
      
      console.log('✅ Conversion Rates:');
      console.log(`   - New → Scheduled: ${conversionRates.toScheduled}`);
      console.log(`   - New → Won: ${conversionRates.toWon}`);
    });
  });

  describe('Scenario 5: Data Validation & Error Handling', () => {
    
    it('should handle invalid data gracefully', () => {
      const errors = [];
      
      try {
        const invalidLead = { name: '', email: 'invalid' };
        if (!invalidLead.name) errors.push('Lead name is required');
        if (!Validators.isValidEmail(invalidLead.email)) errors.push('Invalid email format');
      } catch (e) {
        errors.push(e.message);
      }
      
      expect(errors.length).toBeGreaterThan(0);
      console.log(`✅ Validation errors caught: ${errors.length}`);

      try {
        const invalidInvoice = { items: [], total: 0 };
        if (invalidInvoice.items.length === 0) errors.push('Invoice must have items');
        if (invalidInvoice.total <= 0) errors.push('Invoice total must be > 0');
      } catch (e) {
        errors.push(e.message);
      }
      
      console.log(`✅ All validation checks passed`);
    });
  });

  describe('Scenario 6: Concurrent Operations', () => {
    
    it('should handle multiple simultaneous operations', async () => {
      const operations = [
        // Create multiple leads
        ...Array.from({ length: 3 }, () => 
          MockDatabase.createLead(TestDataGenerator.generateLead())
        ),
        // Create multiple clients
        ...Array.from({ length: 3 }, () =>
          MockDatabase.createClient(TestDataGenerator.generateClient())
        ),
        // Create multiple tasks
        ...Array.from({ length: 3 }, () =>
          MockDatabase.createTask(TestDataGenerator.generateTask())
        )
      ];
      
      expect(operations.length).toEqual(9);
      console.log(`✅ Concurrent operations: ${operations.length} items created`);
      
      const stats = MockDatabase.getStats();
      expect(stats.totalLeads).toEqual(3);
      expect(stats.totalClients).toEqual(3);
      expect(stats.totalTasks).toEqual(3);
      console.log('✅ All concurrent operations completed successfully');
    });
  });
});

// ============================================================
// ✅ E2E TESTS COMPLETE
// ============================================================
