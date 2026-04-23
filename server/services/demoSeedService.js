const demoData = require('../demoData.json');
const { db } = require('../db');

function countTasks() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM hiring_tasks').get();
  return Number(row?.count || 0);
}

function slugifyCandidateName(candidateName) {
  return String(candidateName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'candidate';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeQuestion(question) {
  if (question?.type === 'text' && question?.correct_answer?.kind === 'llm_rubric') {
    if (typeof question.correct_answer.value === 'string') {
      return {
        ...question,
        correct_answer: {
          kind: 'llm_rubric',
          value: {
            rubric: question.correct_answer.value
          }
        }
      };
    }

    if (
      !question.correct_answer.value ||
      typeof question.correct_answer.value !== 'object' ||
      typeof question.correct_answer.value.rubric !== 'string'
    ) {
      return {
        ...question,
        correct_answer: {
          kind: 'llm_rubric',
          value: {
            rubric: 'Evaluate whether the answer is correct, specific, and grounded in the question.'
          }
        }
      };
    }
  }

  return question;
}

function normalizeTest(test, overrides = {}) {
  const base = clone(test);
  return {
    ...base,
    ...overrides,
    sections: (base.sections || []).map((section) => ({
      ...section,
      questions: (section.questions || []).map(normalizeQuestion)
    })),
    metadata: {
      ...(base.metadata || {}),
      ...(overrides.metadata || {}),
      seeded_demo: true
    }
  };
}

function computeStats({ aptitudeTestId, domainTestId, interviewScriptId, attempts }) {
  const summarize = (testId) => {
    const submitted = attempts.filter((attempt) => attempt.test_id === testId && attempt.submitted_at);
    const attemptCount = submitted.length;
    const averageScore = attemptCount
      ? submitted.reduce((sum, attempt) => sum + Number(attempt.total_score || 0), 0) / attemptCount
      : 0;
    const lastAttemptAt = submitted.length
      ? submitted
          .map((attempt) => attempt.submitted_at)
          .filter(Boolean)
          .sort()
          .slice(-1)[0] || null
      : null;

    return {
      test_id: testId || null,
      attempts: attemptCount,
      average_score: Number(averageScore.toFixed(1)),
      last_attempt_at: lastAttemptAt
    };
  };

  return {
    aptitude: summarize(aptitudeTestId),
    domain: summarize(domainTestId),
    interview: {
      script_id: interviewScriptId || null,
      completed: 0,
      last_completed_at: null
    }
  };
}

function buildDemoDataset() {
  const { mockHiringTasks, mockTests, mockCandidateResults, mockInterviewScript } = demoData;

  const primaryTask = clone(mockHiringTasks[0]);
  const secondaryTask = clone(mockHiringTasks[1]);
  const tertiaryTask = clone(mockHiringTasks[2]);

  const aptitudeTestOne = normalizeTest(mockTests['test-apt-1'], {
    id: 'test-apt-1',
    public_id: 'pub-apt-1',
    hiring_task_id: primaryTask.id,
    title: 'Backend Engineer Aptitude Test'
  });

  const domainTestOne = normalizeTest(mockTests['test-dom-1'], {
    id: 'test-dom-1',
    public_id: 'pub-dom-1',
    hiring_task_id: primaryTask.id,
    title: 'Backend Engineer Domain Test'
  });

  const aptitudeTestTwo = normalizeTest(mockTests['test-apt-1'], {
    id: 'test-apt-2',
    public_id: 'pub-apt-2',
    hiring_task_id: secondaryTask.id,
    title: 'Frontend Developer Aptitude Test',
    description: 'Demo aptitude assessment for frontend candidates.'
  });

  const interviewScript = {
    ...clone(mockInterviewScript),
    id: 'interview-1',
    hiring_task_id: primaryTask.id,
    title: 'Backend Engineer Interview Script',
    description: 'Structured 10–15 minute interview guide.',
    metadata: {
      version: 1,
      source_model: 'demo-seed',
      seeded_demo: true
    }
  };

  const candidateResults = mockCandidateResults[primaryTask.id] || [];
  const attempts = [];

  for (const result of candidateResults) {
    const slug = slugifyCandidateName(result.candidate_name);

    if (result.aptitude_taken_at) {
      attempts.push({
        id: `attempt-apt-${slug}`,
        test_id: aptitudeTestOne.id,
        hiring_task_id: primaryTask.id,
        candidate_name: result.candidate_name,
        candidate_email: null,
        started_at: result.aptitude_taken_at,
        submitted_at: result.aptitude_taken_at,
        total_score: Number(result.aptitude_score || 0),
        max_score: 20,
        metadata: {
          seeded_demo: true,
          started_via: 'demo-seed',
          last_autosave_at: result.aptitude_taken_at,
          last_scored_at: result.aptitude_taken_at
        }
      });
    }

    if (result.domain_taken_at) {
      attempts.push({
        id: `attempt-dom-${slug}`,
        test_id: domainTestOne.id,
        hiring_task_id: primaryTask.id,
        candidate_name: result.candidate_name,
        candidate_email: null,
        started_at: result.domain_taken_at,
        submitted_at: result.domain_taken_at,
        total_score: Number(result.domain_score || 0),
        max_score: 20,
        metadata: {
          seeded_demo: true,
          started_via: 'demo-seed',
          last_autosave_at: result.domain_taken_at,
          last_scored_at: result.domain_taken_at
        }
      });
    }
  }

  const primaryTaskStats = computeStats({
    aptitudeTestId: aptitudeTestOne.id,
    domainTestId: domainTestOne.id,
    interviewScriptId: interviewScript.id,
    attempts
  });

  const secondaryTaskStats = computeStats({
    aptitudeTestId: aptitudeTestTwo.id,
    domainTestId: null,
    interviewScriptId: null,
    attempts
  });

  const tertiaryTaskStats = computeStats({
    aptitudeTestId: null,
    domainTestId: null,
    interviewScriptId: null,
    attempts
  });

  const tasks = [
    {
      ...primaryTask,
      has_aptitude_test: true,
      has_domain_test: true,
      has_interview_script: true,
      aptitude_test_id: aptitudeTestOne.id,
      domain_test_id: domainTestOne.id,
      interview_script_id: interviewScript.id,
      stats: primaryTaskStats,
      metadata: {
        seeded_demo: true,
        interview_scores: {}
      },
      llm_model: 'demo-seed',
      llm_response_id: 'demo-seed'
    },
    {
      ...secondaryTask,
      has_aptitude_test: true,
      has_domain_test: false,
      has_interview_script: false,
      aptitude_test_id: aptitudeTestTwo.id,
      domain_test_id: null,
      interview_script_id: null,
      stats: secondaryTaskStats,
      metadata: {
        seeded_demo: true
      },
      llm_model: 'demo-seed',
      llm_response_id: 'demo-seed'
    },
    {
      ...tertiaryTask,
      has_aptitude_test: false,
      has_domain_test: false,
      has_interview_script: false,
      aptitude_test_id: null,
      domain_test_id: null,
      interview_script_id: null,
      stats: tertiaryTaskStats,
      metadata: {
        seeded_demo: true
      },
      llm_model: 'demo-seed',
      llm_response_id: 'demo-seed'
    }
  ];

  return {
    tasks,
    tests: [aptitudeTestOne, domainTestOne, aptitudeTestTwo],
    interviewScripts: [interviewScript],
    attempts
  };
}

function insertTask(task) {
  db.prepare(`
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
      llm_response_id,
      created_at,
      updated_at
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
      @interview_script_id,
      @stats,
      @metadata,
      @llm_model,
      @llm_response_id,
      @created_at,
      @updated_at
    )
  `).run({
    ...task,
    job_description_facets: JSON.stringify(task.job_description_facets || {}),
    has_aptitude_test: task.has_aptitude_test ? 1 : 0,
    has_domain_test: task.has_domain_test ? 1 : 0,
    has_interview_script: task.has_interview_script ? 1 : 0,
    stats: JSON.stringify(task.stats || {}),
    metadata: JSON.stringify(task.metadata || {}),
    created_at: task.created_at,
    updated_at: task.created_at
  });
}

function insertTest(test) {
  const timestamp = test.metadata?.generated_at || '2025-11-01T10:45:00Z';
  db.prepare(`
    INSERT INTO tests (
      id,
      public_id,
      hiring_task_id,
      kind,
      title,
      description,
      difficulty,
      sections,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @public_id,
      @hiring_task_id,
      @kind,
      @title,
      @description,
      @difficulty,
      @sections,
      @metadata,
      @created_at,
      @updated_at
    )
  `).run({
    ...test,
    description: test.description ?? null,
    difficulty: test.difficulty || 'medium',
    sections: JSON.stringify(test.sections || []),
    metadata: JSON.stringify(test.metadata || {}),
    created_at: timestamp,
    updated_at: timestamp
  });
}

function insertInterviewScript(script) {
  const timestamp = script.created_at || '2025-11-01T11:00:00Z';
  db.prepare(`
    INSERT INTO interview_scripts (
      id,
      hiring_task_id,
      title,
      description,
      script,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @hiring_task_id,
      @title,
      @description,
      @script,
      @metadata,
      @created_at,
      @updated_at
    )
  `).run({
    ...script,
    title: script.title ?? null,
    description: script.description ?? null,
    script: JSON.stringify(script.script || []),
    metadata: JSON.stringify(script.metadata || {}),
    created_at: timestamp,
    updated_at: timestamp
  });
}

function insertAttempt(attempt) {
  db.prepare(`
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
  `).run({
    ...attempt,
    candidate_email: attempt.candidate_email ?? null,
    metadata: JSON.stringify(attempt.metadata || {})
  });
}

function clearDemoTables() {
  db.exec(`
    DELETE FROM test_responses;
    DELETE FROM test_attempts;
    DELETE FROM interview_scripts;
    DELETE FROM tests;
    DELETE FROM hiring_tasks;
  `);
}

function seedDemoData(options = {}) {
  const { reset = false } = options;

  if (!reset && countTasks() > 0) {
    return {
      seeded: false,
      reason: 'existing-data'
    };
  }

  const dataset = buildDemoDataset();

  const run = db.transaction(() => {
    if (reset) {
      clearDemoTables();
    }

    for (const task of dataset.tasks) {
      insertTask(task);
    }

    for (const test of dataset.tests) {
      insertTest(test);
    }

    for (const script of dataset.interviewScripts) {
      insertInterviewScript(script);
    }

    for (const attempt of dataset.attempts) {
      insertAttempt(attempt);
    }
  });

  run();

  return {
    seeded: true,
    tasks: dataset.tasks.length,
    tests: dataset.tests.length,
    attempts: dataset.attempts.length
  };
}

module.exports = {
  seedDemoData
};
