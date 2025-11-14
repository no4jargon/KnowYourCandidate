const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kyc.sqlite');
const db = new Database(dbPath);

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
  stats TEXT NOT NULL DEFAULT '{}',
  metadata TEXT NOT NULL DEFAULT '{}',
  llm_model TEXT,
  llm_response_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_hiring_tasks_employer_id ON hiring_tasks (employer_id);
CREATE INDEX IF NOT EXISTS idx_hiring_tasks_created_at ON hiring_tasks (created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_hiring_tasks_updated_at
AFTER UPDATE ON hiring_tasks
FOR EACH ROW
BEGIN
  UPDATE hiring_tasks
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
`);

function parseRow(row) {
  if (!row) return null;
  return {
    ...row,
    has_aptitude_test: Boolean(row.has_aptitude_test),
    has_domain_test: Boolean(row.has_domain_test),
    has_interview_script: Boolean(row.has_interview_script),
    job_description_facets: JSON.parse(row.job_description_facets),
    stats: JSON.parse(row.stats),
    metadata: JSON.parse(row.metadata || '{}')
  };
}

module.exports = {
  db,
  parseRow
};
