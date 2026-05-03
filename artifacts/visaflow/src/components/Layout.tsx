import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useUser, UserButton } from "@clerk/react";
import { useGetMe, useListNotifications } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CheckSquare,
  Bell,
  Settings,
  ShieldCheck,
  ScrollText,
  Building2,
  Globe,
  ListChecks,
  FileText,
  Calendar,
  Plane,
  MessageSquare,
  Wallet,
  BarChart3,
  Workflow,
} from "lucide-react";
import { cn, ROLE_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/NotificationBell";

interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles?: string[];
  badge?: number;
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { data: me } = useGetMe();
  const { data: notifications } = useListNotifications({ unreadOnly: true });

  const role = me?.role ?? "student";
  const unreadCount = notifications?.length ?? 0;

  const isStudent = role === "student";
  const isStaff = ["advisor", "reviewer", "admin", "superadmin"].includes(role);
  const isAdmin = ["admin", "superadmin"].includes(role);

  const navItems: NavItem[] = [
    ...(isStudent
      ? [
          { href: "/student", icon: LayoutDashboard, label: "Accueil" },
          { href: "/student/steps", icon: ListChecks, label: "Mon parcours" },
          { href: "/student/documents", icon: FileText, label: "Documents" },
          { href: "/student/projet", icon: ScrollText, label: "Projet & motivation" },
          { href: "/student/finance", icon: Wallet, label: "Finances & logement" },
          { href: "/student/appointments", icon: Calendar, label: "Rendez-vous" },
          { href: "/student/post-arrival", icon: Plane, label: "Après l'arrivée" },
          { href: "/student/messages", icon: MessageSquare, label: "Messages" },
        ]
      : []),
    ...(isStaff && !isAdmin
      ? [
          { href: "/advisor", icon: LayoutDashboard, label: "Mon portefeuille" },
          { href: "/advisor/tasks", icon: CheckSquare, label: "Mes tâches" },
          { href: "/advisor/reports", icon: BarChart3, label: "Statistiques" },
        ]
      : []),
    ...(isAdmin
      ? [
          { href: "/admin", icon: LayoutDashboard, label: "Centre de pilotage" },
          { href: "/advisor", icon: Users, label: "Portefeuille" },
          { href: "/advisor/tasks", icon: CheckSquare, label: "Mes tâches" },
          { href: "/advisor/reports", icon: BarChart3, label: "Statistiques" },
        ]
      : []),
    {
      href: isStudent ? "/student/notifications" : "/app/notifications",
      icon: Bell,
      label: "Notifications",
      badge: unreadCount,
    },
    ...(isAdmin
      ? [
          { href: "/admin/users", icon: ShieldCheck, label: "Utilisateurs" },
          { href: "/admin/students", icon: GraduationCap, label: "Tous les étudiants" },
          { href: "/admin/schools", icon: Building2, label: "Écoles" },
          { href: "/admin/countries", icon: Globe, label: "Pays" },
          { href: "/admin/workflow", icon: Workflow, label: "Parcours" },
          { href: "/admin/matrix", icon: Workflow, label: "Matrice nationalité" },
          { href: "/admin/intake-calendar", icon: Workflow, label: "Calendrier admissions" },
          { href: "/admin/audit", icon: ScrollText, label: "Journal d'audit" },
        ]
      : []),
    { href: "/app/profile", icon: Settings, label: "Profil" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <Link href={isStudent ? "/student" : isAdmin ? "/admin" : "/advisor"}>
            <a className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-slate-900">VisaFlow</div>
                <div className="text-xs text-slate-500">France</div>
              </div>
            </a>
          </Link>
        </div>

        <div className="px-3 py-2">
          <div className="px-3 py-2 mb-1 rounded-lg bg-slate-50">
            <div className="text-xs text-slate-500">Connecté en tant que</div>
            <div className="text-sm font-medium text-slate-900 truncate">
              {me?.firstName} {me?.lastName}
            </div>
            <Badge variant="outline" className="mt-1 text-xs">
              {ROLE_LABELS[role] ?? role}
            </Badge>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              location === item.href ||
              (item.href !== "/app" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                  data-testid={`nav-${item.href.replace(/\//g, "-")}`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 ? (
                    <Badge className="bg-rose-500 hover:bg-rose-500 text-white">
                      {item.badge}
                    </Badge>
                  ) : null}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 flex items-center gap-3">
          <UserButton />
          <div className="text-xs text-slate-600 truncate">
            {user?.primaryEmailAddress?.emailAddress}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-6 lg:px-8 h-14 flex items-center justify-end gap-2">
          <NotificationBell />
        </header>
        <div className="max-w-7xl mx-auto p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
