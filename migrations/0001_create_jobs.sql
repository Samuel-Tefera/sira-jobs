-- Migration number: 0001 	 2026-10-22T13:43:27.536Z

CREATE TABLE jobs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,

  -- source
  employer_chat_id  INTEGER NOT NULL,
  employer_username TEXT,
  raw_text          TEXT NOT NULL,

  -- structured fields (filled by AI)
  title             TEXT,
  company           TEXT,
  location          TEXT,
  category          TEXT,
  deadline          TEXT,         -- 2026-11-30
  apply_info        TEXT,

  -- post text
  formatted_en      TEXT,
  formatted_am      TEXT,

  -- moderation
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  scam_flag         TEXT,
  channel_message_id INTEGER,      -- set when posted to the channel

  -- timestamps (UTC)
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at       TEXT
);

CREATE INDEX idx_jobs_status_created ON jobs (status, created_at);
CREATE INDEX idx_jobs_category ON jobs (category);
CREATE INDEX idx_jobs_deadline ON jobs (deadline);
