import { useGetStudentDashboard } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { StudentDashboardData } from "@/types";

export function MyDossier() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetStudentDashboard();
  const [, setLocation] = useLocation();
  const d = data as unknown as StudentDashboardData | undefined;

  useEffect(() => {
    if (isLoading) return;
    if (!d?.student) {
      setLocation("/app/onboarding");
    } else {
      setLocation(`/app/students/${d.student.id}`);
    }
  }, [d, isLoading, setLocation]);

  return <div>{t("common.loading")}</div>;
}
