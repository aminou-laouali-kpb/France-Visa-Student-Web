import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Show, useAuth } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useApiAuthSetup } from "@/lib/api";
import { activateUserCache, purgeUserCache } from "@/lib/registerSW";
import { Layout } from "@/components/Layout";
import { Landing } from "@/pages/Landing";
import { SignInPage, SignUpPage } from "@/pages/AuthPages";
import { Dashboard } from "@/pages/Dashboard";
import { Onboarding } from "@/pages/Onboarding";
import { StudentsList } from "@/pages/StudentsList";
import { StudentDetail } from "@/pages/StudentDetail";
import { MyDossier } from "@/pages/MyDossier";
import { StudentDashboard } from "@/pages/student/StudentDashboard";
import { StudentSteps } from "@/pages/student/StudentSteps";
import { StudentDocuments } from "@/pages/student/StudentDocuments";
import { StudentFinance } from "@/pages/student/StudentFinance";
import { StudentAppointments } from "@/pages/student/StudentAppointments";
import { StudentPostArrival } from "@/pages/student/StudentPostArrival";
import { StudentMessages } from "@/pages/student/StudentMessages";
import { StudentProjet } from "@/pages/student/StudentProjet";
import { MyTasks } from "@/pages/MyTasks";
import { Notifications } from "@/pages/Notifications";
import { Profile } from "@/pages/Profile";
import { AdminUsers, AdminCountries } from "@/pages/Admin";
import { AdvisorPortfolio } from "@/pages/advisor/AdvisorPortfolio";
import { AdvisorReports } from "@/pages/advisor/AdvisorReports";
import { AdvisorTasks } from "@/pages/advisor/AdvisorTasks";
import { AdminGlobalDashboard } from "@/pages/admin/AdminGlobalDashboard";
import { AdminStudents } from "@/pages/admin/AdminStudents";
import { AdminWorkflow } from "@/pages/admin/AdminWorkflow";
import { AdminAuditLogs } from "@/pages/admin/AdminAuditLogs";
import { AdminSchoolsManager } from "@/pages/admin/AdminSchoolsManager";
import { AdminMatrix } from "@/pages/admin/AdminMatrix";
import { AdminIntakeCalendar } from "@/pages/admin/AdminIntakeCalendar";
import { AdminBilling } from "@/pages/admin/AdminBilling";
import { AdminBranding } from "@/pages/admin/AdminBranding";
import { AdminBulkImport } from "@/pages/admin/AdminBulkImport";
import { PrivacySettings } from "@/pages/PrivacySettings";
import { BrandingTheme } from "@/lib/branding";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Watches the Clerk userId and keeps the SW cache scoped per user.
// - When a user signs in, tells the SW to activate that user's cache.
// - When the userId changes or becomes null (sign-out / account switch),
//   instructs the SW to purge the previous user's cache before the new
//   session can render any cached data.
function CacheGuard() {
  const { userId } = useAuth();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const prev = prevUserIdRef.current;

    if (userId && userId !== prev) {
      // Signed in (or switched to a different account).
      if (prev) {
        purgeUserCache(prev);
      }
      activateUserCache(userId);
    } else if (!userId && prev) {
      // Signed out — purge the outgoing user's cache immediately.
      purgeUserCache(prev);
    }

    prevUserIdRef.current = userId ?? null;
  }, [userId]);

  return null;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/app" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>{children}</Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function RoleGate({
  allow,
  children,
}: {
  allow: string[];
  children: React.ReactNode;
}) {
  const { data: me, isLoading } = useGetMe();
  if (isLoading) return null;
  const role = (me as { role?: string } | undefined)?.role ?? "student";
  if (!allow.includes(role)) return <Redirect to="/app" />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  return (
    <Protected>
      <RoleGate allow={["admin", "superadmin"]}>{children}</RoleGate>
    </Protected>
  );
}

function StaffOnly({ children }: { children: React.ReactNode }) {
  return (
    <Protected>
      <RoleGate allow={["advisor", "reviewer", "admin", "superadmin"]}>
        {children}
      </RoleGate>
    </Protected>
  );
}

function AppRouter() {
  useApiAuthSetup();
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-in/:rest*" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/sign-up/:rest*" component={SignUpPage} />

      <Route path="/app">
        <Protected>
          <Dashboard />
        </Protected>
      </Route>
      <Route path="/app/onboarding">
        <Protected>
          <Onboarding />
        </Protected>
      </Route>
      <Route path="/app/dossier">
        <Protected>
          <MyDossier />
        </Protected>
      </Route>
      <Route path="/student">
        <Protected>
          <StudentDashboard />
        </Protected>
      </Route>
      <Route path="/student/notifications">
        <Protected>
          <Notifications />
        </Protected>
      </Route>
      <Route path="/student/steps">
        <Protected>
          <StudentSteps />
        </Protected>
      </Route>
      <Route path="/student/documents">
        <Protected>
          <StudentDocuments />
        </Protected>
      </Route>
      <Route path="/student/finance">
        <Protected>
          <StudentFinance />
        </Protected>
      </Route>
      <Route path="/student/appointments">
        <Protected>
          <StudentAppointments />
        </Protected>
      </Route>
      <Route path="/student/post-arrival">
        <Protected>
          <StudentPostArrival />
        </Protected>
      </Route>
      <Route path="/student/messages">
        <Protected>
          <StudentMessages />
        </Protected>
      </Route>
      <Route path="/student/projet">
        <Protected>
          <StudentProjet />
        </Protected>
      </Route>
      <Route path="/student/interview">
        <Protected>
          <Redirect to="/student/projet" />
        </Protected>
      </Route>
      <Route path="/app/students">
        <Protected>
          <StudentsList />
        </Protected>
      </Route>
      <Route path="/app/students/:id">
        <Protected>
          <StudentDetail />
        </Protected>
      </Route>
      <Route path="/app/tasks">
        <Protected>
          <MyTasks />
        </Protected>
      </Route>
      <Route path="/app/notifications">
        <Protected>
          <Notifications />
        </Protected>
      </Route>
      <Route path="/app/profile">
        <Protected>
          <Profile />
        </Protected>
      </Route>
      <Route path="/advisor">
        <StaffOnly>
          <AdvisorPortfolio />
        </StaffOnly>
      </Route>
      <Route path="/advisor/tasks">
        <StaffOnly>
          <AdvisorTasks />
        </StaffOnly>
      </Route>
      <Route path="/advisor/reports">
        <StaffOnly>
          <AdvisorReports />
        </StaffOnly>
      </Route>
      <Route path="/advisor/students/:id">
        <StaffOnly>
          <StudentDetail />
        </StaffOnly>
      </Route>

      <Route path="/admin">
        <AdminOnly>
          <AdminGlobalDashboard />
        </AdminOnly>
      </Route>
      <Route path="/admin/users">
        <AdminOnly>
          <AdminUsers />
        </AdminOnly>
      </Route>
      <Route path="/admin/students">
        <AdminOnly>
          <AdminStudents />
        </AdminOnly>
      </Route>
      <Route path="/admin/schools">
        <AdminOnly>
          <AdminSchoolsManager />
        </AdminOnly>
      </Route>
      <Route path="/admin/countries">
        <AdminOnly>
          <AdminCountries />
        </AdminOnly>
      </Route>
      <Route path="/admin/workflow">
        <AdminOnly>
          <AdminWorkflow />
        </AdminOnly>
      </Route>
      <Route path="/admin/matrix">
        <AdminOnly>
          <AdminMatrix />
        </AdminOnly>
      </Route>
      <Route path="/admin/intake-calendar">
        <AdminOnly>
          <AdminIntakeCalendar />
        </AdminOnly>
      </Route>
      <Route path="/admin/audit">
        <AdminOnly>
          <AdminAuditLogs />
        </AdminOnly>
      </Route>
      <Route path="/admin/audit-logs">
        <AdminOnly>
          <AdminAuditLogs />
        </AdminOnly>
      </Route>
      <Route path="/admin/billing">
        <AdminOnly>
          <AdminBilling />
        </AdminOnly>
      </Route>
      <Route path="/admin/branding">
        <AdminOnly>
          <AdminBranding />
        </AdminOnly>
      </Route>
      <Route path="/admin/import">
        <AdminOnly>
          <AdminBulkImport />
        </AdminOnly>
      </Route>
      <Route path="/app/privacy">
        <Protected>
          <PrivacySettings />
        </Protected>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CacheGuard />
        <WouterRouter base={basePath}>
          <BrandingTheme>
            <AppRouter />
          </BrandingTheme>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
