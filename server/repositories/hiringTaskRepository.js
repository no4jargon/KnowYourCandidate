const { db, parseRow } = require('../db');

function createTask(task) {
  const stmt = db.prepare(`
    INSERT INTO hiring_tasks (
      id,
      employer_id,
      title,
      location,
      job_description_raw,
      job_description_facets,
      has_aptitude_test,
      has_domain_test,
      has_interview_script,
      aptitude_test_id,
      domain_test_id,
      stats,
      metadata,
      llm_model,
      llm_response_id
    ) VALUES (
      @id,
      @employer_id,
      @title,
      @location,
      @job_description_raw,
      @job_description_facets,
      @has_aptitude_test,
      @has_domain_test,
      @has_interview_script,
      @aptitude_test_id,
      @domain_test_id,
      @stats,
      @metadata,
      @llm_model,
      @llm_response_id
    )
  `);

  stmt.run({
    ...task,
    job_description_facets: JSON.stringify(task.job_description_facets),
    stats: JSON.stringify(task.stats || {}),
    metadata: JSON.stringify(task.metadata || {})
  });

  return getTaskById(task.id);
}

function getTaskById(id) {
  const stmt = db.prepare('SELECT * FROM hiring_tasks WHERE id = ?');
  const row = stmt.get(id);
  return parseRow(row);
}

function listTasks({ page, pageSize, employerId }) {
  const offset = (page - 1) * pageSize;
  const baseQuery = employerId
    ? 'WHERE employer_id = @employer_id'
    : '';
  const listStmt = db.prepare(`
    SELECT *
    FROM hiring_tasks
    ${baseQuery}
    ORDER BY datetime(created_at) DESC
    LIMIT @limit OFFSET @offset
  `);
  const countStmt = db.prepare(
    `SELECT COUNT(*) as count FROM hiring_tasks ${baseQuery}`
  );

  const rows = listStmt.all({
    employer_id: employerId,
    limit: pageSize,
    offset
  });
  const countRow = countStmt.get({ employer_id: employerId });

  return {
    tasks: rows.map(parseRow),
    total: countRow.count
  };
}

function getActivityFeed({ limit = 15, employerId } = {}) {
  const baseQuery = employerId ? 'WHERE employer_id = @employer_id' : '';
  const stmt = db.prepare(`
    SELECT * FROM hiring_tasks
    ${baseQuery}
    ORDER BY datetime(created_at) DESC
  `);
  const rows = stmt.all({ employer_id: employerId });

  const events = rows.flatMap((row) => {
    const task = parseRow(row);
    const items = [
      {
        timestamp: task.created_at,
        message: `New hiring task created: ${task.title}`
      },
      {
        timestamp: task.created_at,
        message: `JD facets generated for ${task.title}`
      }
    ];

    if (task.has_aptitude_test) {
      items.push({
        timestamp: task.updated_at,
        message: `Aptitude test ready for ${task.title}`
      });
    }
    if (task.has_domain_test) {
      items.push({
        timestamp: task.updated_at,
        message: `Domain test ready for ${task.title}`
      });
    }
    if (task.has_interview_script) {
      items.push({
        timestamp: task.updated_at,
        message: `Interview script prepared for ${task.title}`
      });
    }

    return items;
  });

  const sorted = events
    .filter(Boolean)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return sorted.slice(0, limit);
}

module.exports = {
  createTask,
  getTaskById,
  listTasks,
  getActivityFeed
};
