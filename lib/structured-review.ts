import type {
  ReviewFinding,
  ReviewSeverity,
  StructuredReview,
} from "@/types";

const severityRank: Record<ReviewSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function isFinding(value: unknown): value is ReviewFinding {
  if (!value || typeof value !== "object") return false;
  const finding = value as Record<string, unknown>;
  return (
    typeof finding.id === "string" &&
    typeof finding.title === "string" &&
    typeof finding.problem === "string" &&
    typeof finding.impact === "string" &&
    typeof finding.fix === "string" &&
    ["critical", "high", "medium", "low"].includes(String(finding.severity))
  );
}

export function parseStoredReview(value: string | null): StructuredReview | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StructuredReview>;
    if (parsed.version === 1 && Array.isArray(parsed.findings) && parsed.findings.every(isFinding)) {
      return {
        version: 1,
        summary: typeof parsed.summary === "string" ? parsed.summary : "Review complete.",
        findings: parsed.findings,
      };
    }
  } catch {
    // Reviews created before structured output are displayed as one legacy finding.
  }

  return {
    version: 1,
    summary: "This review was created with the previous review format.",
    findings: [{
      id: "legacy-review",
      severity: "medium",
      title: "Review notes",
      path: null,
      line: null,
      problem: value,
      impact: "Read the original review notes below.",
      fix: "Check each suggestion before changing the code.",
      suggested_code: null,
      language: null,
    }],
  };
}

export function serializeReview(review: StructuredReview): string {
  return JSON.stringify(review);
}

export function meetsMinimumSeverity(
  severity: ReviewSeverity,
  minimum: ReviewSeverity,
): boolean {
  return severityRank[severity] >= severityRank[minimum];
}

export function findingToMarkdown(finding: ReviewFinding): string {
  const location = finding.path
    ? `\`${finding.path}${finding.line ? `:${finding.line}` : ""}\``
    : "General review note";
  const code = finding.suggested_code
    ? `\n\n**Suggested code**\n\n\`\`\`${finding.language ?? ""}\n${finding.suggested_code}\n\`\`\``
    : "";

  return [
    `### ${finding.severity.toUpperCase()}: ${finding.title}`,
    `**Where:** ${location}`,
    `**Problem:** ${finding.problem}`,
    `**Why it matters:** ${finding.impact}`,
    `**How to fix:** ${finding.fix}${code}`,
  ].join("\n\n");
}

export function reviewToMarkdown(review: StructuredReview, findings = review.findings): string {
  if (findings.length === 0) return review.summary || "No problems found in these changes.";
  return [review.summary, ...findings.map(findingToMarkdown)].filter(Boolean).join("\n\n---\n\n");
}
