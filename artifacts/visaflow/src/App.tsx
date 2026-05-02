import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Show } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useApiAuthSetup } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { Landing } from "@/pages/Landing";
import { SignInPage, SignUpPage } from "@/pages/AuthPages";
import { Dashboard } from "@/pages/Dashboard";
import { Onboarding } from "@/pages/Onboarding";
import { StudentsList } from "@/pages/StudentsList";
import { StudentDetail } from "@/pages/StudentDetail";
import { MyDossier } from "@/pages/MyDossier";
import { MyTasks } from "@/pages/MyTasks";
import { Notifications } from "@/pages/Notifications";
import { Profile } from "@/pages/Profile";
import { AdminUsers, AdminAudit, AdminSchools, AdminCountries } from "@/pages/Admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

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
      <Route path="/app/admin/users">
        <Protected>
          <AdminUsers />
        </Protected>
      </Route>
      <Route path="/app/admin/audit">
        <Protected>
          <AdminAudit />
        </Protected>
      </Route>
      <Route path="/app/admin/schools">
        <Protected>
          <AdminSchools />
        </Protected>
      </Route>
      <Route path="/app/admin/countries">
        <Protected>
          <AdminCountries />
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
        <WouterRouter base={basePath}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
