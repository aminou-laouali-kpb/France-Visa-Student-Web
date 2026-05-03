import { useMyStudent, StudentGate } from "./StudentLayout";
import { FinancialReadinessTab } from "../FinancialReadinessTab";

export function StudentFinance() {
  return (
    <StudentGate>
      <StudentFinanceInner />
    </StudentGate>
  );
}

function StudentFinanceInner() {
  const { student } = useMyStudent();
  if (!student) return null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Garantie financière, logement & CVEC
        </h1>
        <p className="text-slate-600 mt-1">
          Renseignez vos justificatifs financiers, votre hébergement et votre
          paiement CVEC. Votre conseiller vérifiera chaque pièce avant la
          soumission de votre dossier.
        </p>
      </div>
      <FinancialReadinessTab
        studentId={student.id}
        isStaff={false}
        isAdmin={false}
      />
    </div>
  );
}
