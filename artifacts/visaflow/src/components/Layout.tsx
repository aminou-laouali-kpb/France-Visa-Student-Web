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
  Sparkles,
  CreditCard,
  Palette,
  Lock,
} from "lucide-react";
import { cn, ROLE_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { Upload, Menu } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  const isStudent = role === "student";
  const isStaff = ["advisor", "reviewer", "admin", "superadmin"].includes(role);
  const isAdmin = ["admin", "superadmin"].includes(role);

  const navItems: NavItem[] = [
    ...(isStudent
      ? [
          { href: "/student", icon: LayoutDashboard, label: t("nav.home") },
          { href: "/student/steps", icon: ListChecks, label: t("nav.myJourney") },
          { href: "/student/documents", icon: FileText, label: t("nav.documents") },
          { href: "/student/projet", icon: ScrollText, label: t("nav.projet") },
          { href: "/student/finance", icon: Wallet, label: t("nav.finance") },
          { href: "/student/appointments", icon: Calendar, label: t("nav.appointments") },
          { href: "/student/post-arrival", icon: Plane, label: t("nav.postArrival") },
          { href: "/student/messages", icon: MessageSquare, label: t("nav.messages") },
          { href: "/student/interview", icon: Sparkles, label: t("nav.interview") },
        ]
      : []),
    ...(isStaff && !isAdmin
      ? [
          { href: "/advisor", icon: LayoutDashboard, label: t("nav.portfolio") },
          { href: "/advisor/tasks", icon: CheckSquare, label: t("nav.tasks") },
          { href: "/advisor/reports", icon: BarChart3, label: t("nav.stats") },
        ]
      : []),
    ...(isAdmin
      ? [
          { href: "/admin", icon: LayoutDashboard, label: t("nav.controlCenter") },
          { href: "/advisor", icon: Users, label: t("nav.portfolio") },
          { href: "/advisor/tasks", icon: CheckSquare, label: t("nav.tasks") },
          { href: "/advisor/reports", icon: BarChart3, label: t("nav.stats") },
        ]
      : []),
    {
      href: isStudent ? "/student/notifications" : "/app/notifications",
      icon: Bell,
      label: t("nav.notifications"),
      badge: unreadCount,
    },
    ...(isAdmin
      ? [
          { href: "/admin/users", icon: ShieldCheck, label: t("nav.users") },
          { href: "/admin/students", icon: GraduationCap, label: t("nav.allStudents") },
          { href: "/admin/schools", icon: Building2, label: t("nav.schools") },
          { href: "/admin/countries", icon: Globe, label: t("nav.countries") },
          { href: "/admin/workflow", icon: Workflow, label: t("nav.workflow") },
          { href: "/admin/matrix", icon: Workflow, label: t("nav.matrix") },
          { href: "/admin/intake-calendar", icon: Workflow, label: t("nav.intakeCalendar") },
          { href: "/admin/audit", icon: ScrollText, label: t("nav.auditLog") },
          { href: "/admin/billing", icon: CreditCard, label: t("nav.billing") },
          { href: "/admin/branding", icon: Palette, label: t("nav.branding") },
          { href: "/admin/import", icon: Upload, label: t("nav.bulkImport") },
        ]
      : []),
    { href: "/app/profile", icon: Settings, label: t("nav.profile") },
    { href: "/app/privacy", icon: Lock, label: t("nav.privacy") },
  ];

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
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
            <div className="text-xs text-slate-500">{t("layout.loggedInAs")}</div>
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

      <main className="flex-1 overflow-auto w-full">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-4 lg:px-8 h-14 flex items-center gap-2">
          <button
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-slate-100"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={t("common.toggleMenu")}
            data-testid="button-sidebar-toggle"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <LanguageSwitcher />
          <NotificationBell />
        </header>
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <PWAInstallPrompt />
    </div>
  );
}
