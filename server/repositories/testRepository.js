const { randomUUID } = require('crypto');
const { db } = require('../db');

function parseTestRow(row) {
  if (!row) return null;
  return {
    ...row,
    sections: JSON.parse(row.sections || '[]'),
    metadata: JSON.parse(row.metadata || '{}')
  };
}

function createTest(test) {
  const stmt = db.prepare(`
    INSERT INTO tests (
      id,
      public_id,
      hiring_task_id,
      kind,
      title,
      description,
      difficulty,
      sections,
      metadata
    ) VALUES (
      @id,
      @public_id,
      @hiring_task_id,
      @kind,
      @title,
      @description,
      @difficulty,
      @sections,
      @metadata
    )
  `);

  const id = test.id || randomUUID();
  const publicId = test.public_id || randomUUID();

  stmt.run({
    ...test,
    id,
    public_id: publicId,
    description: test.description ?? null,
    difficulty: test.difficulty || 'medium',
    sections: JSON.stringify(test.sections || []),
    metadata: JSON.stringify(test.metadata || {})
  });

  return getTestById(id);
}

function getTestById(id) {
  const stmt = db.prepare('SELECT * FROM tests WHERE id = ?');
  const row = stmt.get(id);
  return parseTestRow(row);
}

function getTestByPublicId(publicId) {
  const stmt = db.prepare('SELECT * FROM tests WHERE public_id = ?');
  const row = stmt.get(publicId);
  return parseTestRow(row);
}

function listTestsByHiringTask(hiringTaskId) {
  const stmt = db.prepare(
    'SELECT * FROM tests WHERE hiring_task_id = ? ORDER BY datetime(created_at) DESC'
  );
  const rows = stmt.all(hiringTaskId);
  return rows.map(parseTestRow);
}

function updateTest(id, updates = {}) {
  const fields = [];
  const params = { id };

  if (Object.prototype.hasOwnProperty.call(updates, 'public_id')) {
    fields.push('public_id = @public_id');
    params.public_id = updates.public_id;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'kind')) {
    fields.push('kind = @kind');
    params.kind = updates.kind;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
    fields.push('title = @title');
    params.title = updates.title;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
    fields.push('description = @description');
    params.description = updates.description ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'difficulty')) {
    fields.push('difficulty = @difficulty');
    params.difficulty = updates.difficulty;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'sections')) {
    fields.push('sections = @sections');
    params.sections = JSON.stringify(updates.sections || []);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
    fields.push('metadata = @metadata');
    params.metadata = JSON.stringify(updates.metadata || {});
  }

  if (!fields.length) {
    return getTestById(id);
  }

  const stmt = db.prepare(`UPDATE tests SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(params);
  return getTestById(id);
}

function deleteTest(id) {
  const stmt = db.prepare('DELETE FROM tests WHERE id = ?');
  stmt.run(id);
}

module.exports = {
  createTest,
  getTestById,
  getTestByPublicId,
  listTestsByHiringTask,
  updateTest,
  deleteTest
};
