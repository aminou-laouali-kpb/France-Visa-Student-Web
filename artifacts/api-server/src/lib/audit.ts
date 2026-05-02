import { db, auditLogsTable } from "@workspace/db";

export async function logAudit(params: {
  userId?: number | null;
  studentId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: string;
}) {
  try {
    await db.insert(auditLogsTable).values({
      userId: params.userId ?? null,
      studentId: params.studentId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      details: params.details ?? null,
    });
  } catch {
    // Don't fail the request on audit failures
  }
}
