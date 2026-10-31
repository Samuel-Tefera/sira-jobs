export type JobStatus = "pending" | "approved" | "rejected";

// Shape of a row in the jobs table.

export interface Job {
  id: number;
  employer_chat_id: number;
  employer_username: string | null;
  raw_text: string;

  title: string | null;
  company: string | null;
  location: string | null;
  category: string | null;
  deadline: string | null;
  apply_info: string | null;

  formatted_en: string | null;
  formatted_am: string | null;

  status: JobStatus;
  scam_flag: string | null;
  channel_message_id: number | null;

  created_at: string;
  approved_at: string | null;
}

export interface Env {
  BOT_TOKEN: string;
  ADMIN_ID: string;
  CHANNEL_ID: string;
  BRAND_NAME: string;

  WEBHOOK_SECRET?: string;

  jobs_db: D1Database;
}
