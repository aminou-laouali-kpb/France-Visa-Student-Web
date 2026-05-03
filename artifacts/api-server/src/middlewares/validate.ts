import type { RequestHandler } from "express";

interface ZodIssue {
  path: (string | number)[];
  message: string;
}
interface ZodLikeSchema {
  safeParse: (data: unknown) =>
    | { success: true; data: unknown }
    | { success: false; error: { issues: ZodIssue[] } };
}

export function validateBody(schema: ZodLikeSchema): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.issues.map((i: ZodIssue) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}
