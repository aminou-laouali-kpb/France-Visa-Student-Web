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
}

export interface Appointment {
  id: number;
  type: string;
  title: string;
  scheduledAt: string;
  location?: string | null;
  status?: string | null;
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
  recentComments?: Comment[];
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
