import { GoogleGenAI } from "@google/genai/web";
import {
  JOB_CATEGORIES,
  jobExtractionSchema,
  type JobCategory,
  type JobExtraction,
} from "./schema";
import { SYSTEM_PROMPT, buildJobExtractionPrompt } from "./prompt";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export function createGeminiClient(apiKey: string | undefined): GoogleGenAI {
  const key = apiKey?.trim() ?? "";

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return new GoogleGenAI({ apiKey: key });
}

export interface JobExtractionRequest {
  client: GoogleGenAI;
  model?: string;
  rawText: string;
  today?: Date;
}

// Sends the job post to Gemini and returns the parsed structured response.
export async function requestJobExtraction(
  request: JobExtractionRequest
): Promise<JobExtraction> {
  const response = await request.client.models.generateContent({
    model: request.model || DEFAULT_GEMINI_MODEL,
    contents: buildJobExtractionPrompt(request.rawText, request.today),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: jobExtractionSchema,
      temperature: 0.1,
    },
  });

  const text = response.text?.trim();

  if (!text) {
    const blockReason = response.promptFeedback?.blockReason;
    throw new Error(
      blockReason
        ? `Gemini blocked the response: ${blockReason}`
        : "Gemini returned an empty response"
    );
  }

  return parseJobExtraction(stripCodeFence(text));
}

function stripCodeFence(text: string): string {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text;
}

function parseJobExtraction(text: string): JobExtraction {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("Gemini returned JSON with an unexpected shape");
  }

  if (typeof parsed.is_job_post !== "boolean") {
    throw new Error("Gemini response is missing is_job_post");
  }

  if (parsed.language !== "am" && parsed.language !== "en") {
    throw new Error("Gemini response is missing a valid language");
  }

  if (!JOB_CATEGORIES.includes(parsed.category as JobCategory)) {
    throw new Error("Gemini response is missing a valid category");
  }

  if (
    parsed.calendar !== "ethiopian" &&
    parsed.calendar !== "gregorian" &&
    parsed.calendar !== "unknown"
  ) {
    throw new Error("Gemini response is missing a valid calendar");
  }

  if (
    !Array.isArray(parsed.requirements) ||
    !parsed.requirements.every((item) => typeof item === "string")
  ) {
    throw new Error("Gemini response is missing requirements");
  }

  if (
    !isRecord(parsed.scam) ||
    typeof parsed.scam.suspicious !== "boolean" ||
    !Array.isArray(parsed.scam.reasons) ||
    !parsed.scam.reasons.every((reason) => typeof reason === "string")
  ) {
    throw new Error("Gemini response is missing a valid scam assessment");
  }

  return parsed as unknown as JobExtraction;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
