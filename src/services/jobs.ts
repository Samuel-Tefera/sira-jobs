import type { Job } from "../type";

export interface NewJobInput {
  employerChatId: number;
  employerUsername: string | null;
  rawText: string;
}

// Inserts a raw job submission with status pending.
export async function createJob(db: D1Database, input: NewJobInput): Promise<Job> {
  const result = await db
    .prepare(
      `INSERT INTO jobs (employer_chat_id, employer_username, raw_text)
       VALUES (?, ?, ?)`
    )
    .bind(input.employerChatId, input.employerUsername, input.rawText)
    .run();

  const jobId = Number(result.meta.last_row_id);
  const job = await getJobById(db, jobId);

  if (!job) {
    throw new Error(`Job #${jobId} was inserted but could not be read back`);
  }

  return job;
}

export async function getJobById(db: D1Database, jobId: number): Promise<Job | null> {
  return db.prepare("SELECT * FROM jobs WHERE id = ?").bind(jobId).first<Job>();
}
