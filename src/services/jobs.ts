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

export interface JobAiFields {
  title: string | null;
  company: string | null;
  location: string | null;
  category: string | null;
  deadline: string | null;
  apply_info: string | null;
  formatted_en: string | null;
  formatted_am: string | null;
  scam_flag: string | null;
}

export async function updateJobWithAiFields(
  db: D1Database,
  jobId: number,
  fields: JobAiFields
): Promise<void> {
  await db
    .prepare(
      `UPDATE jobs
       SET title = ?, company = ?, location = ?, category = ?, deadline = ?,
           apply_info = ?, formatted_en = ?, formatted_am = ?, scam_flag = ?
       WHERE id = ? AND status = 'pending'`
    )
    .bind(
      fields.title,
      fields.company,
      fields.location,
      fields.category,
      fields.deadline,
      fields.apply_info,
      fields.formatted_en,
      fields.formatted_am,
      fields.scam_flag,
      jobId
    )
    .run();
}

// Marks a pending job as approved before it is posted to the channel.
// Returns false when the job was already processed by another click.
export async function claimJobForApproval(db: D1Database, jobId: number): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE jobs
       SET status = 'approved', approved_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`
    )
    .bind(jobId)
    .run();

  return result.meta.changes > 0;
}

// Stores the Telegram message ID of the published channel post.
export async function setJobChannelMessageId(
  db: D1Database,
  jobId: number,
  channelMessageId: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE jobs
       SET channel_message_id = ?
       WHERE id = ? AND status = 'approved'`
    )
    .bind(channelMessageId, jobId)
    .run();
}

// Reverts an approval when publishing to the channel failed, so the admin can retry.
export async function resetJobToPending(db: D1Database, jobId: number): Promise<void> {
  await db
    .prepare(
      `UPDATE jobs
       SET status = 'pending', approved_at = NULL
       WHERE id = ? AND status = 'approved' AND channel_message_id IS NULL`
    )
    .bind(jobId)
    .run();
}

// Marks a pending job as rejected.
// Returns false when the job was already processed by another click.
export async function rejectJob(db: D1Database, jobId: number): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE jobs
       SET status = 'rejected'
       WHERE id = ? AND status = 'pending'`
    )
    .bind(jobId)
    .run();

  return result.meta.changes > 0;
}
