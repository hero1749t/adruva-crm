import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import LeadsPage from "@/pages/LeadsPage";
import LeadDetailPage from "@/pages/LeadDetailPage";
import ClientsPage from "@/pages/ClientsPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import TasksPage from "@/pages/TasksPage";
import CalendarPage from "@/pages/CalendarPage";
import TeamPage from "@/pages/TeamPage";
import SettingsPage from "@/pages/SettingsPage";
import LogsPage from "@/pages/LogsPage";
import PaymentsPage from "@/pages/PaymentsPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import ReportsPage from "@/pages/ReportsPage";
import RolesPage from "@/pages/RolesPage";
import CustomFieldsPage from "@/pages/CustomFieldsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="leads" element={<LeadsPage />} />
                <Route path="leads/:id" element={<LeadDetailPage />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="clients/:id" element={<ClientDetailPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="payments" element={<ProtectedRoute allowedRoles={["owner", "admin"]} routeName="Payments"><PaymentsPage /></ProtectedRoute>} />
                <Route path="integrations" element={<ProtectedRoute allowedRoles={["owner"]} routeName="Integrations"><IntegrationsPage /></ProtectedRoute>} />
                <Route path="team" element={<ProtectedRoute allowedRoles={["owner", "admin"]} routeName="Team"><TeamPage /></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute allowedRoles={["owner"]} routeName="Settings"><SettingsPage /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute allowedRoles={["owner", "admin"]} routeName="Reports"><ReportsPage /></ProtectedRoute>} />
                <Route path="roles" element={<ProtectedRoute allowedRoles={["owner"]} routeName="Roles & Permissions"><RolesPage /></ProtectedRoute>} />
                <Route path="custom-fields" element={<ProtectedRoute allowedRoles={["owner", "admin"]} routeName="Custom Fields"><CustomFieldsPage /></ProtectedRoute>} />
                <Route path="invoices" element={<Navigate to="/payments" replace />} />
                <Route path="logs" element={<ProtectedRoute allowedRoles={["owner", "admin"]} routeName="Logs"><LogsPage /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
