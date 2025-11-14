const { randomUUID } = require('crypto');
const { db } = require('../db');

function parseScriptRow(row) {
  if (!row) return null;
  return {
    ...row,
    script: JSON.parse(row.script || '[]'),
    metadata: JSON.parse(row.metadata || '{}')
  };
}

function createInterviewScript(script) {
  const stmt = db.prepare(`
    INSERT INTO interview_scripts (
      id,
      hiring_task_id,
      title,
      description,
      script,
      metadata
    ) VALUES (
      @id,
      @hiring_task_id,
      @title,
      @description,
      @script,
      @metadata
    )
  `);

  const id = script.id || randomUUID();

  stmt.run({
    ...script,
    id,
    title: script.title ?? null,
    description: script.description ?? null,
    script: JSON.stringify(script.script || []),
    metadata: JSON.stringify(script.metadata || {})
  });

  return getInterviewScriptById(id);
}

function getInterviewScriptById(id) {
  const stmt = db.prepare('SELECT * FROM interview_scripts WHERE id = ?');
  const row = stmt.get(id);
  return parseScriptRow(row);
}

function listInterviewScriptsByHiringTask(hiringTaskId) {
  const stmt = db.prepare(
    'SELECT * FROM interview_scripts WHERE hiring_task_id = ? ORDER BY datetime(created_at) DESC'
  );
  const rows = stmt.all(hiringTaskId);
  return rows.map(parseScriptRow);
}

function updateInterviewScript(id, updates = {}) {
  const fields = [];
  const params = { id };

  if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
    fields.push('title = @title');
    params.title = updates.title ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
    fields.push('description = @description');
    params.description = updates.description ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'script')) {
    fields.push('script = @script');
    params.script = JSON.stringify(updates.script || []);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
    fields.push('metadata = @metadata');
    params.metadata = JSON.stringify(updates.metadata || {});
  }

  if (!fields.length) {
    return getInterviewScriptById(id);
  }

  const stmt = db.prepare(`UPDATE interview_scripts SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(params);
  return getInterviewScriptById(id);
}

function deleteInterviewScript(id) {
  const stmt = db.prepare('DELETE FROM interview_scripts WHERE id = ?');
  stmt.run(id);
}

module.exports = {
  createInterviewScript,
  getInterviewScriptById,
  listInterviewScriptsByHiringTask,
  updateInterviewScript,
  deleteInterviewScript
};
