import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable, studentsTable, type User, type Student } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

export async function getOrCreateUser(clerkId: string): Promise<User | null> {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (existing) return existing;

  // Fetch from Clerk and create local user
  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@unknown.local`;
    const firstName = clerkUser.firstName ?? "";
    const lastName = clerkUser.lastName ?? "";

    // First user becomes superadmin; everyone else defaults to student
    const allUsers = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    const isFirstUser = allUsers.length === 0;

    const [created] = await db
      .insert(usersTable)
      .values({
        clerkId,
        email,
        firstName: firstName || email.split("@")[0],
        lastName: lastName || "",
        avatarUrl: clerkUser.imageUrl ?? null,
        role: isFirstUser ? "superadmin" : "student",
      })
      .returning();
    return created;
  } catch (err) {
    return null;
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await getOrCreateUser(auth.userId);
  if (!user) {
    res.status(401).json({ error: "User sync failed" });
    return;
  }
  if (!user.isActive) {
    res.status(403).json({ error: "Account disabled" });
    return;
  }
  req.currentUser = user;
  next();
};

export function requireRole(...roles: User["role"][]): RequestHandler {
  return (req, res, next) => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.currentUser.role)) {
      res.status(403).json({ error: "Forbidden — insufficient role" });
      return;
    }
    next();
  };
}

export function isStaff(user: User): boolean {
  return ["advisor", "reviewer", "admin", "superadmin"].includes(user.role);
}

export function isAdmin(user: User): boolean {
  return ["admin", "superadmin"].includes(user.role);
}

export function canAccessStudent(user: User, student: Student): boolean {
  if (isAdmin(user)) return true;
  if (user.role === "advisor" && student.advisorId === user.id) return true;
  if (user.role === "reviewer" && student.reviewerId === user.id) return true;
  if (user.role === "student" && student.userId === user.id) return true;
  return false;
}

export async function loadAndAuthorizeStudent(
  studentId: number,
  user: User,
): Promise<{ student: Student | null; allowed: boolean }> {
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));
  if (!student) return { student: null, allowed: false };
  return { student, allowed: canAccessStudent(user, student) };
}

export function requireStudentAccess(
  paramName = "studentId",
  mode: "read" | "write" = "read",
): RequestHandler {
  return async (req, res, next) => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const studentId = Number(req.params[paramName]);
    if (!Number.isFinite(studentId)) {
      res.status(400).json({ error: "Invalid student id" });
      return;
    }
    const { student, allowed } = await loadAndAuthorizeStudent(studentId, req.currentUser);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (mode === "write" && req.currentUser.role === "student") {
      res.status(403).json({ error: "Read-only for students on this resource" });
      return;
    }
    (req as Request & { targetStudent?: Student }).targetStudent = student;
    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      targetStudent?: Student;
    }
  }
}
