const { randomUUID } = require('crypto');
const { db, parseRow } = require('../db');
const { createTest } = require('./testRepository');
const { createInterviewScript } = require('./interviewScriptRepository');

function buildInitialStats() {
  return {
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
}

function createTask(task) {
  const create = db.transaction((input) => {
    const stats = buildInitialStats();
    const metadata = JSON.stringify(input.metadata || {});
    const facets = JSON.stringify(input.job_description_facets);

    const insertStmt = db.prepare(`
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
        interview_script_id,
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
        NULL,
        NULL,
        NULL,
        @stats,
        @metadata,
        @llm_model,
        @llm_response_id
      )
    `);

    insertStmt.run({
      ...input,
      job_description_facets: facets,
      stats: JSON.stringify(stats),
      metadata
    });

    if (input.has_aptitude_test) {
      const aptitudeTest = createTest({
        hiring_task_id: input.id,
        kind: 'aptitude',
        title: `${input.title} · Aptitude`,
        description: null,
        difficulty: 'medium',
        sections: [],
        metadata: {
          version: 1,
          created_from: 'createTask'
        }
      });
      stats.aptitude.test_id = aptitudeTest.id;
      const updateStmt = db.prepare(
        'UPDATE hiring_tasks SET aptitude_test_id = @testId WHERE id = @taskId'
      );
      updateStmt.run({ testId: aptitudeTest.id, taskId: input.id });
    }

    if (input.has_domain_test) {
      const domainTest = createTest({
        hiring_task_id: input.id,
        kind: 'domain',
        title: `${input.title} · Domain`,
        description: null,
        difficulty: 'medium',
        sections: [],
        metadata: {
          version: 1,
          created_from: 'createTask'
        }
      });
      stats.domain.test_id = domainTest.id;
      const updateStmt = db.prepare(
        'UPDATE hiring_tasks SET domain_test_id = @testId WHERE id = @taskId'
      );
      updateStmt.run({ testId: domainTest.id, taskId: input.id });
    }

    if (input.has_interview_script) {
      const interviewScript = createInterviewScript({
        hiring_task_id: input.id,
        title: `${input.title} · Interview Script`,
        description: null,
        script: [],
        metadata: {
          version: 1,
          created_from: 'createTask'
        }
      });
      stats.interview.script_id = interviewScript.id;
      const updateStmt = db.prepare(
        'UPDATE hiring_tasks SET interview_script_id = @scriptId WHERE id = @taskId'
      );
      updateStmt.run({ scriptId: interviewScript.id, taskId: input.id });
    }

    const statsStmt = db.prepare('UPDATE hiring_tasks SET stats = @stats WHERE id = @taskId');
    statsStmt.run({ stats: JSON.stringify(stats), taskId: input.id });

    return getTaskById(input.id);
  });

  return create({
    ...task,
    id: task.id || randomUUID()
  });
}

function updateTask(id, updates = {}) {
  const fields = [];
  const params = { id };

  if (Object.prototype.hasOwnProperty.call(updates, 'has_aptitude_test')) {
    fields.push('has_aptitude_test = @has_aptitude_test');
    params.has_aptitude_test = updates.has_aptitude_test ? 1 : 0;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'has_domain_test')) {
    fields.push('has_domain_test = @has_domain_test');
    params.has_domain_test = updates.has_domain_test ? 1 : 0;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'has_interview_script')) {
    fields.push('has_interview_script = @has_interview_script');
    params.has_interview_script = updates.has_interview_script ? 1 : 0;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'aptitude_test_id')) {
    fields.push('aptitude_test_id = @aptitude_test_id');
    params.aptitude_test_id = updates.aptitude_test_id || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'domain_test_id')) {
    fields.push('domain_test_id = @domain_test_id');
    params.domain_test_id = updates.domain_test_id || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'interview_script_id')) {
    fields.push('interview_script_id = @interview_script_id');
    params.interview_script_id = updates.interview_script_id || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'stats')) {
    fields.push('stats = @stats');
    params.stats = JSON.stringify(updates.stats || {});
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
    fields.push('metadata = @metadata');
    params.metadata = JSON.stringify(updates.metadata || {});
  }

  if (!fields.length) {
    return getTaskById(id);
  }

  const stmt = db.prepare(`UPDATE hiring_tasks SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(params);
  return getTaskById(id);
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
  getActivityFeed,
  updateTask,
  buildInitialStats
};
