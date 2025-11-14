const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kyc.sqlite');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS hiring_tasks (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  job_description_raw TEXT NOT NULL,
  job_description_facets TEXT NOT NULL,
  has_aptitude_test INTEGER NOT NULL DEFAULT 0,
  has_domain_test INTEGER NOT NULL DEFAULT 0,
  has_interview_script INTEGER NOT NULL DEFAULT 0,
  aptitude_test_id TEXT,
  domain_test_id TEXT,
  interview_script_id TEXT,
  stats TEXT NOT NULL DEFAULT '{}',
  metadata TEXT NOT NULL DEFAULT '{}',
  llm_model TEXT,
  llm_response_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_hiring_tasks_employer_id ON hiring_tasks (employer_id);
CREATE INDEX IF NOT EXISTS idx_hiring_tasks_created_at ON hiring_tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hiring_tasks_aptitude_test ON hiring_tasks (aptitude_test_id);
CREATE INDEX IF NOT EXISTS idx_hiring_tasks_domain_test ON hiring_tasks (domain_test_id);
CREATE INDEX IF NOT EXISTS idx_hiring_tasks_interview_script ON hiring_tasks (interview_script_id);

CREATE TRIGGER IF NOT EXISTS trg_hiring_tasks_updated_at
AFTER UPDATE ON hiring_tasks
FOR EACH ROW
BEGIN
  UPDATE hiring_tasks
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
`);

try {
  db.exec('ALTER TABLE hiring_tasks ADD COLUMN interview_script_id TEXT');
} catch (error) {
  if (!String(error.message || '').includes('duplicate column name')) {
    throw error;
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  hiring_task_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('aptitude', 'domain')),
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  sections TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (hiring_task_id) REFERENCES hiring_tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tests_hiring_task ON tests (hiring_task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tests_hiring_task_kind ON tests (hiring_task_id, kind);

CREATE TRIGGER IF NOT EXISTS trg_tests_updated_at
AFTER UPDATE ON tests
FOR EACH ROW
BEGIN
  UPDATE tests
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
`);

db.exec(`
CREATE TABLE IF NOT EXISTS test_attempts (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL,
  hiring_task_id TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  submitted_at TEXT,
  total_score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
  FOREIGN KEY (hiring_task_id) REFERENCES hiring_tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_test_attempts_test ON test_attempts (test_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_hiring_task ON test_attempts (hiring_task_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_submitted_at ON test_attempts (submitted_at);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS test_responses (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  raw_answer TEXT,
  normalized_answer TEXT,
  score REAL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (attempt_id) REFERENCES test_attempts (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_responses_attempt_question ON test_responses (attempt_id, question_id);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS interview_scripts (
  id TEXT PRIMARY KEY,
  hiring_task_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  script TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (hiring_task_id) REFERENCES hiring_tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interview_scripts_hiring_task ON interview_scripts (hiring_task_id);

CREATE TRIGGER IF NOT EXISTS trg_interview_scripts_updated_at
AFTER UPDATE ON interview_scripts
FOR EACH ROW
BEGIN
  UPDATE interview_scripts
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
`);

function parseRow(row) {
  if (!row) return null;
  const stats = normalizeStats(row.stats);
  return {
    ...row,
    has_aptitude_test: Boolean(row.has_aptitude_test),
    has_domain_test: Boolean(row.has_domain_test),
    has_interview_script: Boolean(row.has_interview_script),
    job_description_facets: JSON.parse(row.job_description_facets),
    stats,
    metadata: JSON.parse(row.metadata || '{}')
  };
}

function normalizeStats(statsJson) {
  const defaultStats = {
    aptitude: {
      test_id: null,
      attempts: 0,
      average_score: 0,
      last_attempt_at: null
    },
    domain: {
      test_id: null,
      attempts: 0,
      average_score: 0,
      last_attempt_at: null
    },
    interview: {
      script_id: null,
      completed: 0,
      last_completed_at: null
    }
  };

  if (!statsJson) {
    return defaultStats;
  }

  let parsed;
  try {
    parsed = JSON.parse(statsJson);
  } catch (_error) {
    return defaultStats;
  }

  if (parsed && typeof parsed === 'object' && 'aptitude_candidates' in parsed) {
    return {
      ...defaultStats,
      aptitude: {
        ...defaultStats.aptitude,
        attempts: Number(parsed.aptitude_candidates) || 0,
        average_score: Number(parsed.aptitude_avg_score) || 0
      },
      domain: {
        ...defaultStats.domain,
        attempts: Number(parsed.domain_candidates) || 0,
        average_score: Number(parsed.domain_avg_score) || 0
      }
    };
  }

  return {
    aptitude: {
      ...defaultStats.aptitude,
      ...(parsed.aptitude || {})
    },
    domain: {
      ...defaultStats.domain,
      ...(parsed.domain || {})
    },
    interview: {
      ...defaultStats.interview,
      ...(parsed.interview || {})
    }
  };
}

module.exports = {
  db,
  parseRow
};
