const { randomUUID } = require('crypto');
const { db } = require('../db');

function parseAttemptRow(row) {
  if (!row) return null;
  return {
    ...row,
    total_score: Number(row.total_score ?? 0),
    max_score: Number(row.max_score ?? 0),
    metadata: JSON.parse(row.metadata || '{}')
  };
}

function parseResponseRow(row) {
  if (!row) return null;
  return {
    ...row,
    score: row.score != null ? Number(row.score) : null,
    metadata: JSON.parse(row.metadata || '{}')
  };
}

function createAttempt(attempt) {
  const stmt = db.prepare(`
    INSERT INTO test_attempts (
      id,
      test_id,
      hiring_task_id,
      candidate_name,
      candidate_email,
      started_at,
      submitted_at,
      total_score,
      max_score,
      metadata
    ) VALUES (
      @id,
      @test_id,
      @hiring_task_id,
      @candidate_name,
      @candidate_email,
      @started_at,
      @submitted_at,
      @total_score,
      @max_score,
      @metadata
    )
  `);

  const id = attempt.id || randomUUID();
  stmt.run({
    ...attempt,
    id,
    candidate_email: attempt.candidate_email ?? null,
    started_at: attempt.started_at ?? new Date().toISOString(),
    submitted_at: attempt.submitted_at ?? null,
    total_score: attempt.total_score ?? 0,
    max_score: attempt.max_score ?? 0,
    metadata: JSON.stringify(attempt.metadata || {})
  });

  return getAttemptById(id);
}

function getAttemptById(id) {
  const stmt = db.prepare('SELECT * FROM test_attempts WHERE id = ?');
  const row = stmt.get(id);
  return parseAttemptRow(row);
}

function listAttemptsByTest(testId) {
  const stmt = db.prepare(
    'SELECT * FROM test_attempts WHERE test_id = ? ORDER BY datetime(started_at) DESC'
  );
  const rows = stmt.all(testId);
  return rows.map(parseAttemptRow);
}

function updateAttempt(id, updates = {}) {
  const fields = [];
  const params = { id };

  for (const key of [
    'candidate_name',
    'candidate_email',
    'started_at',
    'submitted_at',
    'total_score',
    'max_score'
  ]) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${key} = @${key}`);
      params[key] = updates[key];
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
    fields.push('metadata = @metadata');
    params.metadata = JSON.stringify(updates.metadata || {});
  }

  if (!fields.length) {
    return getAttemptById(id);
  }

  const stmt = db.prepare(`UPDATE test_attempts SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(params);
  return getAttemptById(id);
}

function deleteAttempt(id) {
  const stmt = db.prepare('DELETE FROM test_attempts WHERE id = ?');
  stmt.run(id);
}

function createResponse(response) {
  return upsertResponse(response);
}

function upsertResponse(response) {
  const stmt = db.prepare(`
    INSERT INTO test_responses (
      id,
      attempt_id,
      question_id,
      raw_answer,
      normalized_answer,
      score,
      metadata
    ) VALUES (
      @id,
      @attempt_id,
      @question_id,
      @raw_answer,
      @normalized_answer,
      @score,
      @metadata
    )
    ON CONFLICT(attempt_id, question_id) DO UPDATE SET
      raw_answer = excluded.raw_answer,
      normalized_answer = excluded.normalized_answer,
      score = excluded.score,
      metadata = excluded.metadata
  `);

  const id = response.id || response.existing_id || randomUUID();
  stmt.run({
    ...response,
    id,
    raw_answer: response.raw_answer ?? null,
    normalized_answer: response.normalized_answer ?? null,
    score: response.score ?? null,
    metadata: JSON.stringify(response.metadata || {})
  });

  return getResponseByAttemptAndQuestion(response.attempt_id, response.question_id);
}

function bulkUpsertResponses(attemptId, responses = []) {
  const run = db.transaction((items) => {
    for (const item of items) {
      upsertResponse({
        attempt_id: attemptId,
        question_id: item.question_id,
        raw_answer: item.raw_answer,
        normalized_answer: item.normalized_answer,
        score: item.score,
        metadata: item.metadata || {}
      });
    }
  });

  run(responses);
  return listResponsesByAttempt(attemptId);
}

function getResponseById(id) {
  const stmt = db.prepare('SELECT * FROM test_responses WHERE id = ?');
  const row = stmt.get(id);
  return parseResponseRow(row);
}

function getResponseByAttemptAndQuestion(attemptId, questionId) {
  const stmt = db.prepare(
    'SELECT * FROM test_responses WHERE attempt_id = ? AND question_id = ?'
  );
  const row = stmt.get(attemptId, questionId);
  return parseResponseRow(row);
}

function listResponsesByAttempt(attemptId) {
  const stmt = db.prepare(
    'SELECT * FROM test_responses WHERE attempt_id = ? ORDER BY question_id'
  );
  const rows = stmt.all(attemptId);
  return rows.map(parseResponseRow);
}

function deleteResponsesByAttempt(attemptId) {
  const stmt = db.prepare('DELETE FROM test_responses WHERE attempt_id = ?');
  stmt.run(attemptId);
}

module.exports = {
  createAttempt,
  getAttemptById,
  listAttemptsByTest,
  updateAttempt,
  deleteAttempt,
  createResponse,
  upsertResponse,
  bulkUpsertResponses,
  getResponseById,
  getResponseByAttemptAndQuestion,
  listResponsesByAttempt,
  deleteResponsesByAttempt
};
