import { useGetStudentDashboard } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function MyDossier() {
  const { data, isLoading } = useGetStudentDashboard();
  const [, setLocation] = useLocation();
  const d = data as any;

  useEffect(() => {
    if (isLoading) return;
    if (!d?.student) {
      setLocation("/app/onboarding");
    } else {
      setLocation(`/app/students/${d.student.id}`);
    }
  }, [d, isLoading, setLocation]);

  return <div>Chargement…</div>;
}
