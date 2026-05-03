export type Role = "student" | "advisor" | "reviewer" | "admin" | "superadmin";

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
  isInternal?: boolean;
  isCorrectionRequest?: boolean;
}

export interface Task {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
}

export interface Appointment {
  id: number;
  type: string;
  title: string;
  scheduledAt: string;
  location?: string | null;
  status?: string | null;
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

export interface UserRow {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  phone?: string | null;
}

export interface Country {
  id: number;
  name: string;
  code: string;
  visaCenter?: string | null;
  requiresCampusFrance: boolean;
}

export interface School {
  id: number;
  name: string;
  city: string;
  website?: string | null;
}

export interface AuditLog {
  id: number;
  createdAt: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: string | null;
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
}

export interface AdvisorDashboardData {
  studentCount: number;
  activeStudents: number;
  blockedStudents: number;
  visaObtained: number;
  overdueTasks: number;
  students: Array<Student & { completionScore: number }>;
}

export interface AdminDashboardData {
  userCount: number;
  studentCount: number;
  documentCount: number;
  visaObtained: number;
  activeStudents: number;
  blockedStudents: number;
  submittedStudents: number;
  visaRefused: number;
  usersByRole: Record<string, number>;
  recentActivity: AuditLog[];
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
