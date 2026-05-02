import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABELS: Record<string, string> = {
  prospect: "Prospect",
  active: "Actif",
  blocked: "Bloqué",
  submitted: "Déposé",
  visa_obtained: "Visa obtenu",
  visa_refused: "Visa refusé",
  withdrawn: "Abandonné",
  not_started: "À faire",
  in_progress: "En cours",
  under_review: "En revue",
  validated: "Validé",
  rejected: "Rejeté",
  missing: "Manquant",
  received: "Reçu",
  pending: "En attente",
  done: "Terminé",
  cancelled: "Annulé",
  upcoming: "À venir",
  completed: "Terminé",
  missed: "Manqué",
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
};

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-800 border-blue-200",
  prospect: "bg-gray-100 text-gray-800 border-gray-200",
  blocked: "bg-red-100 text-red-800 border-red-200",
  submitted: "bg-purple-100 text-purple-800 border-purple-200",
  visa_obtained: "bg-emerald-100 text-emerald-800 border-emerald-200",
  visa_refused: "bg-rose-100 text-rose-800 border-rose-200",
  withdrawn: "bg-gray-200 text-gray-700 border-gray-300",
  not_started: "bg-gray-100 text-gray-700 border-gray-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  under_review: "bg-amber-100 text-amber-800 border-amber-200",
  validated: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  missing: "bg-gray-100 text-gray-700 border-gray-200",
  received: "bg-blue-100 text-blue-700 border-blue-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  upcoming: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  missed: "bg-rose-100 text-rose-800 border-rose-200",
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-rose-100 text-rose-800 border-rose-200",
};

export const ROLE_LABELS: Record<string, string> = {
  student: "Étudiant",
  advisor: "Conseiller",
  reviewer: "Examinateur",
  admin: "Administrateur",
  superadmin: "Super-admin",
};
