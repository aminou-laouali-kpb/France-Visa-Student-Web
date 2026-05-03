import type { ReactNode } from "react";
import { useGetStudentDashboard } from "@workspace/api-client-react";
import type { StudentDashboardData } from "@/types";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function useMyStudent() {
  const { data: raw, isLoading, refetch } = useGetStudentDashboard();
  const data = raw as unknown as StudentDashboardData | undefined;
  return { student: data?.student, dashboard: data, isLoading, refetch };
}

export function StudentGate({ children }: { children: ReactNode }) {
  const { student, isLoading } = useMyStudent();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !student) setLocation("/app/onboarding");
  }, [isLoading, student, setLocation]);

  if (isLoading) return <div className="p-8">Chargement…</div>;
  if (!student) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <GraduationCap className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Bienvenue sur VisaFlow !</h2>
          <p className="text-slate-600 mb-6">
            Créons votre dossier visa étudiant pour démarrer votre parcours en France.
          </p>
          <Link href="/app/onboarding">
            <Button size="lg" data-testid="button-create-dossier">Créer mon dossier</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  return <>{children}</>;
}
