import type { Env } from "../../type";
import {
  DEFAULT_GEMINI_MODEL,
  createGeminiClient,
  requestJobExtraction,
} from "./client";
import type { JobExtraction } from "./schema";

export {
  DEFAULT_GEMINI_MODEL,
  createGeminiClient,
  requestJobExtraction,
} from "./client";
export {
  JOB_CATEGORIES,
  jobExtractionSchema,
  type DeadlineCalendar,
  type DeadlineParts,
  type JobCategory,
  type JobExtraction,
  type JobLanguage,
  type ScamAssessment,
} from "./schema";
export { SYSTEM_PROMPT, buildJobExtractionPrompt } from "./prompt";

export async function analyzeJobPost(
  env: Env,
  rawText: string,
  today?: Date
): Promise<JobExtraction> {
  const client = createGeminiClient(env.GEMINI_API_KEY);

  return requestJobExtraction({
    client,
    model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    rawText,
    today,
  });
}
