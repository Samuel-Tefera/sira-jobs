import { Type, type Schema } from "@google/genai/web";

export const JOB_CATEGORIES = [
  "technology",
  "engineering",
  "healthcare",
  "education",
  "finance",
  "sales",
  "marketing",
  "customer_service",
  "administration",
  "human_resources",
  "logistics",
  "construction",
  "manufacturing",
  "hospitality",
  "agriculture",
  "legal",
  "media",
  "other",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

export type JobLanguage = "am" | "en";
export type DeadlineCalendar = "ethiopian" | "gregorian" | "unknown";

export interface DeadlineParts {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface ScamAssessment {
  suspicious: boolean;
  reasons: string[];
}

// Shape of the JSON returned by Gemini.
export interface JobExtraction {
  is_job_post: boolean;
  language: JobLanguage;

  title: string | null;
  company: string | null;
  location: string | null;
  category: JobCategory;
  requirements: string[];
  details: string | null;
  apply_info: string | null;

  deadline_raw: string | null;
  deadline_date: DeadlineParts | null;
  calendar: DeadlineCalendar;

  formatted_en: string | null;
  formatted_am: string | null;

  scam: ScamAssessment;
}

const nullableString = (description: string): Schema => ({
  type: Type.STRING,
  description,
  nullable: true,
});

// Passed to Gemini as responseSchema
export const jobExtractionSchema: Schema = {
  type: Type.OBJECT,
  description: "Structured data extracted from a single Telegram job post.",
  properties: {
    is_job_post: {
      type: Type.BOOLEAN,
      description:
        "True only when the message is a job or vacancy announcement. False for greetings, questions, ads, or unrelated messages.",
    },
    language: {
      type: Type.STRING,
      format: "enum",
      enum: ["am", "en"],
      description: "The language most of the post is written in.",
    },
    title: nullableString(
      "Short job title without emoji. Null when the post is not a job or no title is stated."
    ),
    company: nullableString(
      "The hiring organization, not the channel or the person who forwarded the post. Null when not stated."
    ),
    location: nullableString(
      "The job location exactly as stated in the post. Null when not stated."
    ),
    category: {
      type: Type.STRING,
      format: "enum",
      enum: [...JOB_CATEGORIES],
      description: "The single category that best describes the job. Use 'other' if unsure.",
    },
    requirements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: "8",
      description:
        "Up to 8 short requirement items such as education, experience, and skills. Empty when the post is not a job or states none.",
    },
    details: nullableString(
      "Other useful information that fits nowhere else, such as salary, number of positions, job type, benefits, or working hours. Maximum 300 characters. Null when there is nothing to add."
    ),
    apply_info: nullableString(
      "Every phone number, email address, Telegram handle, link, and application instruction from the post, copied character for character. Null when none is stated."
    ),
    deadline_raw: nullableString(
      "The deadline text exactly as written in the post. Null when no deadline is stated."
    ),
    deadline_date: {
      type: Type.OBJECT,
      nullable: true,
      description:
        "The deadline date parts exactly as written. Do not convert between calendars. Null when there is no deadline or the date cannot be determined.",
      properties: {
        year: {
          type: Type.INTEGER,
          nullable: true,
          description: "Year as written. Null when the post does not state a year.",
        },
        month: {
          type: Type.INTEGER,
          nullable: true,
          minimum: 1,
          maximum: 13,
          description:
            "Month number as written. For Ethiopian month names use the Ethiopian month number. Null when unknown.",
        },
        day: {
          type: Type.INTEGER,
          nullable: true,
          minimum: 1,
          maximum: 31,
          description: "Day of the month as written. Null when unknown.",
        },
      },
      required: ["year", "month", "day"],
      propertyOrdering: ["year", "month", "day"],
    },
    calendar: {
      type: Type.STRING,
      format: "enum",
      enum: ["ethiopian", "gregorian", "unknown"],
      description:
        "Calendar used by the deadline. Use 'ethiopian' for Ethiopian month names or E.C./ዓ.ም, 'gregorian' for English month names or G.C., and 'unknown' when unsure.",
    },
    formatted_en: nullableString(
      "A complete, ready-to-publish version of the job post written in English, using only facts from the post and keeping every contact detail unchanged. Null when the message is not a job post."
    ),
    formatted_am: nullableString(
      "A complete, ready-to-publish version of the job post written in Amharic, using only facts from the post and keeping every contact detail unchanged. Null when the message is not a job post."
    ),
    scam: {
      type: Type.OBJECT,
      description: "Advisory scam assessment. A human makes the final decision.",
      properties: {
        suspicious: {
          type: Type.BOOLEAN,
          description: "True when the post shows one or more scam signals.",
        },
        reasons: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          maxItems: "6",
          description:
            "Short reasons for the suspicion, each under 12 words. Empty when suspicious is false.",
        },
      },
      required: ["suspicious", "reasons"],
      propertyOrdering: ["suspicious", "reasons"],
    },
  },
  required: [
    "is_job_post",
    "language",
    "title",
    "company",
    "location",
    "category",
    "requirements",
    "details",
    "apply_info",
    "deadline_raw",
    "deadline_date",
    "calendar",
    "formatted_en",
    "formatted_am",
    "scam",
  ],
  propertyOrdering: [
    "is_job_post",
    "language",
    "title",
    "company",
    "location",
    "category",
    "requirements",
    "details",
    "apply_info",
    "deadline_raw",
    "deadline_date",
    "calendar",
    "formatted_en",
    "formatted_am",
    "scam",
  ],
};
