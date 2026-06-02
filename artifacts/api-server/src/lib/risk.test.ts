import { describe, expect, it } from "vitest";
import type { Document } from "@workspace/db";
import {
  computeVisaReadinessFromRisk,
  documentCategoryIsMissing,
  visaStepGateMessage,
  TLS_STEP_NAME,
} from "./risk";

describe("visaStepGateMessage", () => {
  const baseDoc = (category: string, status: string): Document =>
    ({
      id: 1,
      studentId: 1,
      category,
      status,
      name: category,
      fileUrl: null,
      uploadedAt: null,
      validatedAt: null,
      validatedBy: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as unknown as Document;

  it("returns null for unrelated steps", () => {
    expect(visaStepGateMessage([], "Admission")).toBeNull();
  });

  it("blocks TLS when admission letter is missing", () => {
    const docs = [baseDoc("justificatif_financier", "validated")];
    const msg = visaStepGateMessage(docs, TLS_STEP_NAME);
    expect(msg).toMatch(/lettre d'admission/i);
  });

  it("allows TLS when required categories are present", () => {
    const docs = [
      baseDoc("lettre_admission", "validated"),
      baseDoc("justificatif_financier", "received"),
    ];
    expect(visaStepGateMessage(docs, TLS_STEP_NAME)).toBeNull();
  });
});

describe("documentCategoryIsMissing", () => {
  it("treats empty category and all-missing status as missing", () => {
    const docs = [
      { category: "lettre_admission", status: "missing" },
      { category: "passeport", status: "validated" },
    ] as unknown as Document[];
    expect(documentCategoryIsMissing(docs, "lettre_admission")).toBe(true);
    expect(documentCategoryIsMissing(docs, "passeport")).toBe(false);
    expect(documentCategoryIsMissing(docs, "avi")).toBe(true);
  });
});

describe("computeVisaReadinessFromRisk", () => {
  it("inverts risk score into preparedness", () => {
    const ready = computeVisaReadinessFromRisk({ score: 25, recommendations: ["a"] });
    expect(ready.score).toBe(75);
    expect(ready.level).toBe("high");
    expect(ready.recommendations).toEqual(["a"]);
  });

  it("maps low preparedness when risk is high", () => {
    const ready = computeVisaReadinessFromRisk({ score: 80 });
    expect(ready.score).toBe(20);
    expect(ready.level).toBe("low");
  });
});
