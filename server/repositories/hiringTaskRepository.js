const { randomUUID } = require('crypto');
const { db, parseRow } = require('../db');
const { createTest, getTestById } = require('./testRepository');
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
  const baseTaskQuery = employerId ? 'WHERE employer_id = @employer_id' : '';
  const taskStmt = db.prepare(`
    SELECT * FROM hiring_tasks
    ${baseTaskQuery}
    ORDER BY datetime(created_at) DESC
  `);
  const taskRows = taskStmt.all({ employer_id: employerId });

  const events = taskRows.flatMap((row) => {
    const task = parseRow(row);
    const base = [
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
      base.push({
        timestamp: task.updated_at,
        message: `Aptitude test ready for ${task.title}`
      });
    }
    if (task.has_domain_test) {
      base.push({
        timestamp: task.updated_at,
        message: `Domain test ready for ${task.title}`
      });
    }
    if (task.has_interview_script) {
      base.push({
        timestamp: task.updated_at,
        message: `Interview script prepared for ${task.title}`
      });
    }

    return base;
  });

  const attemptLimit = limit * 3;
  const attemptWhere = employerId ? 'WHERE ht.employer_id = @employer_id' : '';
  const attemptStmt = db.prepare(`
    SELECT
      ta.*, 
      t.kind AS test_kind,
      ht.title AS task_title
    FROM test_attempts ta
    INNER JOIN tests t ON t.id = ta.test_id
    INNER JOIN hiring_tasks ht ON ht.id = ta.hiring_task_id
    ${attemptWhere}
    ORDER BY datetime(ta.started_at) DESC
    LIMIT @attempt_limit
  `);
  const attemptRows = attemptStmt.all({
    employer_id: employerId,
    attempt_limit: attemptLimit
  });

  for (const attempt of attemptRows) {
    if (attempt.started_at) {
      events.push({
        timestamp: attempt.started_at,
        message: `Candidate ${attempt.candidate_name} started the ${attempt.test_kind} test for ${attempt.task_title}`
      });
    }

    if (attempt.submitted_at) {
      events.push({
        timestamp: attempt.submitted_at,
        message: `Candidate ${attempt.candidate_name} completed the ${attempt.test_kind} test for ${attempt.task_title}`
      });

      if (attempt.total_score != null) {
        const totalScore = Number(attempt.total_score) || 0;
        const maxScore = Number(attempt.max_score) || 20;
        events.push({
          timestamp: attempt.submitted_at,
          message: `Score posted: ${attempt.candidate_name} scored ${totalScore}/${maxScore} on the ${attempt.test_kind} test for ${attempt.task_title}`
        });
      }
    }
  }

  const sorted = events
    .filter((item) => item && item.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return sorted.slice(0, limit);
}

function refreshStatsForTest(testId) {
  const test = getTestById(testId);
  if (!test) {
    return null;
  }

  const summaryStmt = db.prepare(`
    SELECT
      COUNT(CASE WHEN submitted_at IS NOT NULL THEN 1 END) AS submitted_attempts,
      AVG(CASE WHEN submitted_at IS NOT NULL THEN total_score ELSE NULL END) AS average_score,
      MAX(submitted_at) AS last_attempt_at
    FROM test_attempts
    WHERE test_id = @test_id
  `);

  const summary = summaryStmt.get({ test_id: testId }) || {};
  const attempts = Number(summary.submitted_attempts || 0);
  const averageScore = attempts ? Number(summary.average_score || 0) : 0;
  const lastAttemptAt = summary.last_attempt_at || null;

  const task = getTaskById(test.hiring_task_id);
  if (!task) {
    return null;
  }

  const statsKey = test.kind === 'aptitude' ? 'aptitude' : 'domain';
  const updatedStats = {
    ...task.stats,
    [statsKey]: {
      ...(task.stats?.[statsKey] || {}),
      test_id: test.id,
      attempts,
      average_score: averageScore,
      last_attempt_at: lastAttemptAt
    }
  };

  return updateTask(task.id, { stats: updatedStats });
}

module.exports = {
  createTask,
  getTaskById,
  listTasks,
  getActivityFeed,
  updateTask,
  buildInitialStats,
  refreshStatsForTest
};
