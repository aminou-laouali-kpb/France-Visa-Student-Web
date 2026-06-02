import type {
  Task as ApiTask,
  AuditLog as ApiAuditLog,
  Country as ApiCountry,
  School as ApiSchool,
  UserProfile,
  StudentSummary as ApiStudentSummary,
  AdvisorDashboard,
  AdminDashboard,
  PortfolioStats,
  WorkflowTemplate as ApiWorkflowTemplate,
  WorkflowStep,
  CountStat as ApiCountStat,
} from "@workspace/api-client-react";

export type Role = "student" | "advisor" | "reviewer" | "admin" | "superadmin";

export type Task = ApiTask;
export type AuditLog = ApiAuditLog;
export type Country = ApiCountry;
export type School = ApiSchool;
export type UserRow = UserProfile;
export type StudentSummary = ApiStudentSummary;
export type AdvisorDashboardData = AdvisorDashboard;
export type AdminDashboardData = AdminDashboard;
export type PortfolioStatsData = PortfolioStats;
export type WorkflowTemplate = ApiWorkflowTemplate;
export type WorkflowTemplateStep = WorkflowStep;
export type CountStat = ApiCountStat;

export interface Student {
  id: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: string;
  completionScore: number;
  countryId?: number | null;
  schoolId?: number | null;
  advisorId?: number | null;
  reviewerId?: number | null;
  lastActivityAt?: string | null;
  updatedAt?: string | null;
  visaType?: "vls_ts" | "vls_t" | null;
  arrivalDate?: string | null;
  titreExpiryDate?: string | null;
  passportExpiry?: string | null;
  intakeDate?: string | null;
}

export interface Appointment {
  id: number;
  type: string;
  title: string;
  scheduledAt: string;
  location?: string | null;
  status?: string | null;
  provider?: string | null;
  centre?: string | null;
  feeEur?: string | number | null;
  confirmationNumber?: string | null;
}

export interface PostArrivalStep {
  id: number;
  studentId: number;
  code: string;
  label: string;
  description?: string | null;
  status:
    | "not_started"
    | "in_progress"
    | "submitted"
    | "under_review"
    | "validated"
    | "rejected"
    | "blocked";
  dueDate?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Step {
  id: number;
  stepOrder: number;
  stepName: string;
  status: string;
  isCampusFranceStep?: boolean;
  notes?: string | null;
  blockedReason?: string | null;
}

export interface Document {
  id: number;
  name: string;
  category: string;
  status: string;
  version: number;
  uploadedAt: string;
  rejectionReason?: string | null;
  extractionStatus?: "pending" | "processing" | "done" | "failed" | "skipped";
  extractedData?: Record<string, unknown> | null;
  aiCategory?: string | null;
  aiConfidence?: string | null;
  expiryDate?: string | null;
  extractedFirstName?: string | null;
  extractedLastName?: string | null;
  extractedDob?: string | null;
  extractionError?: string | null;
  extractedAt?: string | null;
  extractionAttempts?: number;
}

export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  authorId: number;
  authorName: string;
  authorRole: string;
  isInternal?: boolean;
  isCorrectionRequest?: boolean;
  originalLanguage?: string | null;
  translatedContent?: string | null;
  translatedToLanguage?: string | null;
}

export type InterviewMode = "text" | "voice";
export type InterviewStatus = "in_progress" | "completed" | "abandoned";
export interface InterviewRubric {
  motivation?: number;
  coherence?: number;
  french?: number;
  knowledge?: number;
  returnPlan?: number;
  overall?: number;
}
export interface InterviewTurnUI {
  id: number;
  interviewId: number;
  turnIndex: number;
  role: "interviewer" | "student";
  content: string;
  transcription?: string | null;
  createdAt: string;
}
export interface InterviewUI {
  id: number;
  studentId: number;
  mode: InterviewMode;
  status: InterviewStatus;
  programName?: string | null;
  schoolName?: string | null;
  countryName?: string | null;
  language: string;
  score?: InterviewRubric | null;
  feedback?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  suggestions?: string[] | null;
  createdAt: string;
  completedAt?: string | null;
  turns?: InterviewTurnUI[];
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface StudentFormData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  whatsapp?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  countryId?: number | null;
  schoolId?: number | null;
  financingType?: string;
  intakeDate?: string;
  hasVisaRefusalHistory?: boolean;
  status?: string;
  advisorId?: number | null;
  reviewerId?: number | null;
  visaType?: "vls_ts" | "vls_t" | null;
  arrivalDate?: string | null;
  titreExpiryDate?: string | null;
}

export interface VisaReadinessSummary {
  score: number;
  level: "low" | "medium" | "high";
  recommendations: string[];
}

export type MilestoneStatus = "done" | "current" | "upcoming" | "overdue" | "blocked";

export interface ProactiveMilestone {
  id: string;
  label: string;
  status: MilestoneStatus;
  dueDate: string | null;
  href: string | null;
  urgency: "low" | "medium" | "high";
  kind: "step" | "document" | "appointment" | "deadline" | "intake";
}

export interface StudentDashboardData {
  student: Student | null;
  totalSteps: number;
  completedSteps: number;
  completionScore: number;
  documentsCount: number;
  pendingDocuments: number;
  unreadNotifications: number;
  upcomingAppointments?: Appointment[];
  currentStep?: Step | null;
  nextActions?: string[];
  visaReadiness?: VisaReadinessSummary;
  timeline?: ProactiveMilestone[];
  recentComments?: Comment[];
  postArrivalSteps?: PostArrivalStep[];
}

export interface UploadUrlResponse {
  uploadURL: string;
  objectPath: string;
  uploadToken: string;
}

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken?: () => Promise<string | null>;
      };
    };
  }
}
