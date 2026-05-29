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

function computeStats({ aptitudeTestId, domainTestId, interviewScriptId, attempts, interviewResults = [] }) {
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

  const completedInterviews = interviewResults.filter(
    (candidate) => Number(candidate.interview_score || 0) > 0
  );
  const lastInterviewAt = completedInterviews.length
    ? completedInterviews
        .map((candidate) => candidate.interview_completed_at)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null
    : null;

  return {
    aptitude: summarize(aptitudeTestId),
    domain: summarize(domainTestId),
    interview: {
      script_id: interviewScriptId || null,
      completed: completedInterviews.length,
      last_completed_at: lastInterviewAt
    }
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addMinutes(timestamp, minutes) {
  return new Date(new Date(timestamp).getTime() + minutes * 60 * 1000).toISOString();
}

function generateCandidateBatch({
  names,
  startDate,
  aptitudeBase,
  domainBase,
  interviewBase = 0,
  interviewCount = 0,
  spacingMinutes = 73,
  domainOffsetMinutes = 42,
  interviewOffsetMinutes = 160
}) {
  const aptitudePattern = [2, 1, 0, 3, -1, 2, -2, 1, 0, -1, 2, -2, 1, 0, 3, -1, 2, 1, -1, 0, 2, -2];
  const domainPattern = [1, 0, 2, -1, 1, -2, 2, 0, -1, 1, 0, 2, -2, 1, 0, -1, 2, 1, -1, 0, 2, -2];
  const interviewPattern = [1, 0, 2, -1, 1, 0, 2, -1, 1, 0];

  return names.map((candidateName, index) => {
    const aptitude_taken_at = addMinutes(startDate, index * spacingMinutes);
    const domain_taken_at = addMinutes(aptitude_taken_at, domainOffsetMinutes);
    const hasInterviewScore = index < interviewCount;
    const interview_score = hasInterviewScore
      ? clamp(interviewBase + interviewPattern[index % interviewPattern.length], 10, 20)
      : 0;

    return {
      candidate_name: candidateName,
      aptitude_taken_at,
      aptitude_score: clamp(aptitudeBase + aptitudePattern[index % aptitudePattern.length], 11, 20),
      domain_taken_at,
      domain_score: clamp(domainBase + domainPattern[index % domainPattern.length], 10, 20),
      interview_score,
      interview_completed_at: hasInterviewScore
        ? addMinutes(domain_taken_at, interviewOffsetMinutes + index * 11)
        : null,
      overall_score: 0
    };
  }).map((candidate) => ({
    ...candidate,
    overall_score:
      Number(candidate.aptitude_score || 0) +
      Number(candidate.domain_score || 0) +
      Number(candidate.interview_score || 0)
  }));
}

function buildAttemptRecords({ taskId, aptitudeTestId, domainTestId, candidates }) {
  const attempts = [];
  const interviewScores = {};

  for (const candidate of candidates) {
    const slug = slugifyCandidateName(candidate.candidate_name);

    if (candidate.aptitude_taken_at && aptitudeTestId) {
      attempts.push({
        id: `attempt-apt-${taskId}-${slug}`,
        test_id: aptitudeTestId,
        hiring_task_id: taskId,
        candidate_name: candidate.candidate_name,
        candidate_email: null,
        started_at: candidate.aptitude_taken_at,
        submitted_at: candidate.aptitude_taken_at,
        total_score: Number(candidate.aptitude_score || 0),
        max_score: 20,
        metadata: {
          seeded_demo: true,
          started_via: 'demo-seed',
          last_autosave_at: candidate.aptitude_taken_at,
          last_scored_at: candidate.aptitude_taken_at
        }
      });
    }

    if (candidate.domain_taken_at && domainTestId) {
      attempts.push({
        id: `attempt-dom-${taskId}-${slug}`,
        test_id: domainTestId,
        hiring_task_id: taskId,
        candidate_name: candidate.candidate_name,
        candidate_email: null,
        started_at: candidate.domain_taken_at,
        submitted_at: candidate.domain_taken_at,
        total_score: Number(candidate.domain_score || 0),
        max_score: 20,
        metadata: {
          seeded_demo: true,
          started_via: 'demo-seed',
          last_autosave_at: candidate.domain_taken_at,
          last_scored_at: candidate.domain_taken_at
        }
      });
    }

    if (Number(candidate.interview_score || 0) > 0) {
      interviewScores[candidate.candidate_name] = Number(candidate.interview_score || 0);
    }
  }

  return {
    attempts,
    interviewScores
  };
}

function buildDemoDataset() {
  const { mockHiringTasks, mockTests, mockCandidateResults, mockInterviewScript } = demoData;

  const primaryTask = clone(mockHiringTasks[0]);
  const secondaryTask = clone(mockHiringTasks[1]);
  const tertiaryTask = clone(mockHiringTasks[2]);

  const platformTask = {
    ...clone(primaryTask),
    id: 'task-4',
    title: 'Platform Engineer, Hyderabad',
    location: 'Hyderabad, India',
    created_at: '2025-10-28T09:30:00Z',
    job_description_raw:
      'We are hiring a Platform Engineer to strengthen our developer platform and runtime infrastructure for a growing fintech product.\n\nKey Responsibilities:\n- Improve deployment reliability and observability\n- Build internal tooling for service ownership and incident response\n- Scale Kubernetes-based workloads and shared data services\n- Partner with backend teams on performance, security, and resilience\n\nRequirements:\n- 4+ years in backend or platform engineering\n- Strong experience with APIs, PostgreSQL, and distributed systems\n- Hands-on knowledge of cloud infrastructure and container orchestration\n- Clear communication and ownership during incidents',
    job_description_facets: {
      ...clone(primaryTask.job_description_facets),
      role_title: 'Platform Engineer',
      seniority: 'mid-level',
      location: 'Hyderabad, India',
      work_type: 'hybrid',
      must_have_skills: ['python', 'sql', 'distributed systems', 'kubernetes'],
      nice_to_have_skills: ['aws', 'terraform'],
      tools_and_tech: ['kubernetes', 'postgresql', 'django'],
      typical_tasks: ['scale internal platforms', 'improve service reliability']
    }
  };

  const dataEngineerTask = {
    ...clone(primaryTask),
    id: 'task-5',
    title: 'Data Engineer, Chennai',
    location: 'Chennai, India',
    created_at: '2025-10-24T11:15:00Z',
    job_description_raw:
      'We are looking for a Data Engineer to build reliable analytics pipelines for transaction and customer reporting.\n\nKey Responsibilities:\n- Model data for finance and operations use cases\n- Build ETL jobs and quality checks\n- Improve warehouse performance and monitoring\n- Work closely with analytics and backend teams\n\nRequirements:\n- 3-6 years in data or backend engineering\n- Strong SQL and Python fundamentals\n- Experience with workflow orchestration and data quality practices\n- Comfortable collaborating across engineering and analytics',
    job_description_facets: {
      ...clone(primaryTask.job_description_facets),
      role_title: 'Data Engineer',
      seniority: 'mid-level',
      department: 'data',
      location: 'Chennai, India',
      work_type: 'hybrid',
      must_have_skills: ['python', 'sql', 'data modeling'],
      nice_to_have_skills: ['airflow', 'dbt'],
      tools_and_tech: ['python', 'postgresql', 'sql'],
      domain_industry: 'fintech',
      typical_tasks: ['build data pipelines', 'improve warehouse performance'],
      data_intensity: 'high',
      communication_intensity: 'medium',
      math_data_intensity: 'high'
    }
  };

  const closedSeniorBackendTask = {
    ...clone(primaryTask),
    id: 'task-6',
    title: 'Senior Backend Engineer, Pune',
    location: 'Pune, India',
    created_at: '2025-10-18T08:45:00Z',
    job_description_raw:
      'Senior Backend Engineer needed to lead design and scaling work across core payment and ledger services.\n\nKey Responsibilities:\n- Architect robust APIs and event-driven workflows\n- Guide engineers on performance, security, and review quality\n- Improve reliability for money movement and reconciliation services\n- Partner with product and operations on rollout readiness\n\nRequirements:\n- 6+ years in backend systems\n- Strong Python, SQL, and system design fundamentals\n- Experience in regulated or transaction-heavy environments\n- Demonstrated mentoring and operational ownership',
    job_description_facets: {
      ...clone(primaryTask.job_description_facets),
      role_title: 'Senior Backend Engineer',
      seniority: 'senior',
      location: 'Pune, India',
      work_type: 'hybrid',
      must_have_skills: ['python', 'sql', 'distributed systems', 'system design'],
      nice_to_have_skills: ['aws', 'kubernetes', 'redis'],
      tools_and_tech: ['django', 'postgresql', 'redis'],
      typical_tasks: ['lead backend architecture', 'mentor engineers', 'improve transactional reliability'],
      communication_intensity: 'high'
    }
  };

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

  const platformAptitudeTest = normalizeTest(mockTests['test-apt-1'], {
    id: 'test-apt-4',
    public_id: 'pub-apt-4',
    hiring_task_id: platformTask.id,
    title: 'Platform Engineer Aptitude Test',
    description: 'Demo aptitude assessment for platform candidates.'
  });

  const platformDomainTest = normalizeTest(mockTests['test-dom-1'], {
    id: 'test-dom-4',
    public_id: 'pub-dom-4',
    hiring_task_id: platformTask.id,
    title: 'Platform Engineer Domain Test',
    description: 'Demo domain assessment for platform candidates.'
  });

  const dataEngineerAptitudeTest = normalizeTest(mockTests['test-apt-1'], {
    id: 'test-apt-5',
    public_id: 'pub-apt-5',
    hiring_task_id: dataEngineerTask.id,
    title: 'Data Engineer Aptitude Test',
    description: 'Demo aptitude assessment for data engineering candidates.'
  });

  const dataEngineerDomainTest = normalizeTest(mockTests['test-dom-1'], {
    id: 'test-dom-5',
    public_id: 'pub-dom-5',
    hiring_task_id: dataEngineerTask.id,
    title: 'Data Engineer Domain Test',
    description: 'Demo domain assessment for data engineering candidates.'
  });

  const closedSeniorAptitudeTest = normalizeTest(mockTests['test-apt-1'], {
    id: 'test-apt-6',
    public_id: 'pub-apt-6',
    hiring_task_id: closedSeniorBackendTask.id,
    title: 'Senior Backend Engineer Aptitude Test',
    description: 'Demo aptitude assessment for senior backend candidates.'
  });

  const closedSeniorDomainTest = normalizeTest(mockTests['test-dom-1'], {
    id: 'test-dom-6',
    public_id: 'pub-dom-6',
    hiring_task_id: closedSeniorBackendTask.id,
    title: 'Senior Backend Engineer Domain Test',
    description: 'Demo domain assessment for senior backend candidates.'
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

  const platformInterviewScript = {
    ...clone(mockInterviewScript),
    id: 'interview-4',
    hiring_task_id: platformTask.id,
    title: 'Platform Engineer Interview Script',
    description: 'Structured 10–15 minute interview guide.',
    metadata: {
      version: 1,
      source_model: 'demo-seed',
      seeded_demo: true
    }
  };

  const dataEngineerInterviewScript = {
    ...clone(mockInterviewScript),
    id: 'interview-5',
    hiring_task_id: dataEngineerTask.id,
    title: 'Data Engineer Interview Script',
    description: 'Structured 10–15 minute interview guide.',
    metadata: {
      version: 1,
      source_model: 'demo-seed',
      seeded_demo: true
    }
  };

  const closedSeniorInterviewScript = {
    ...clone(mockInterviewScript),
    id: 'interview-6',
    hiring_task_id: closedSeniorBackendTask.id,
    title: 'Senior Backend Engineer Interview Script',
    description: 'Structured 10–15 minute interview guide.',
    metadata: {
      version: 1,
      source_model: 'demo-seed',
      seeded_demo: true
    }
  };

  const primaryCandidates = mockCandidateResults[primaryTask.id] || [];
  const frontendCandidates = generateCandidateBatch({
    names: [
      'Saanvi Gupta',
      'Aarav Mehta',
      'Mira Kapoor',
      'Dhruv Nair',
      'Isha Bhandari',
      'Rohan Saxena',
      'Navya Jain',
      'Kartikeya Sen'
    ],
    startDate: '2025-11-06T09:00:00Z',
    aptitudeBase: 17,
    domainBase: 0,
    interviewBase: 0,
    interviewCount: 0,
    spacingMinutes: 62,
    domainOffsetMinutes: 0,
    interviewOffsetMinutes: 0
  });
  const platformCandidates = generateCandidateBatch({
    names: [
      'Nikhil Rao',
      'Pooja Menon',
      'Aditya Bansal',
      'Neha Kulkarni',
      'Varun Shetty',
      'Shreya Das',
      'Abhishek Jain',
      'Ishita Kapoor',
      'Mohit Suri',
      'Ritika Joshi',
      'Harsh Vora',
      'Tanvi Kulshreshtha',
      'Yash Agarwal',
      'Sonal Deshpande'
    ],
    startDate: '2025-10-29T09:10:00Z',
    aptitudeBase: 16,
    domainBase: 15,
    interviewBase: 15,
    interviewCount: 5,
    spacingMinutes: 67,
    domainOffsetMinutes: 38,
    interviewOffsetMinutes: 150
  });
  const dataEngineerCandidates = generateCandidateBatch({
    names: [
      'Devika Nambiar',
      'Akash Yadav',
      'Rhea Thomas',
      'Siddharth Mehta',
      'Nandini Rao',
      'Pranav Kulkarni',
      'Mitali Shah',
      'Kunal Arora',
      'Bhavna Iqbal',
      'Gaurav Sinha',
      'Aparna Iyer',
      'Saurabh Pillai',
      'Kriti Bhatia',
      'Jatin Narang',
      'Lavanya Krish',
      'Rishabh Tiwari',
      'Madhuri Sen',
      'Anirudh Bose'
    ],
    startDate: '2025-10-25T08:40:00Z',
    aptitudeBase: 17,
    domainBase: 16,
    interviewBase: 16,
    interviewCount: 6,
    spacingMinutes: 59,
    domainOffsetMinutes: 35,
    interviewOffsetMinutes: 142
  });
  const closedSeniorCandidates = generateCandidateBatch({
    names: [
      'Aisha Khan',
      'Rajat Menon',
      'Simran Kaur',
      'Deepak Bedi',
      'Nupur Shah',
      'Aman Chawla',
      'Ira Mukherjee',
      'Keshav Rao',
      'Diya Arvind',
      'Manav Kapoor',
      'Sana Mirza',
      'Rohit Batra',
      'Tara Bhonsle',
      'Kabir Anand',
      'Zoya Merchant',
      'Anmol Gill',
      'Reyansh Desai',
      'Pallavi Rao',
      'Rhea Khanna',
      'Shivam Puri'
    ],
    startDate: '2025-10-19T09:00:00Z',
    aptitudeBase: 17,
    domainBase: 16,
    interviewBase: 17,
    interviewCount: 8,
    spacingMinutes: 54,
    domainOffsetMinutes: 36,
    interviewOffsetMinutes: 135
  });

  const attempts = [];

  const primaryRecords = buildAttemptRecords({
    taskId: primaryTask.id,
    aptitudeTestId: aptitudeTestOne.id,
    domainTestId: domainTestOne.id,
    candidates: primaryCandidates
  });
  attempts.push(...primaryRecords.attempts);

  const frontendRecords = buildAttemptRecords({
    taskId: secondaryTask.id,
    aptitudeTestId: aptitudeTestTwo.id,
    domainTestId: null,
    candidates: frontendCandidates
  });
  attempts.push(...frontendRecords.attempts);

  const platformRecords = buildAttemptRecords({
    taskId: platformTask.id,
    aptitudeTestId: platformAptitudeTest.id,
    domainTestId: platformDomainTest.id,
    candidates: platformCandidates
  });
  attempts.push(...platformRecords.attempts);

  const dataEngineerRecords = buildAttemptRecords({
    taskId: dataEngineerTask.id,
    aptitudeTestId: dataEngineerAptitudeTest.id,
    domainTestId: dataEngineerDomainTest.id,
    candidates: dataEngineerCandidates
  });
  attempts.push(...dataEngineerRecords.attempts);

  const closedSeniorRecords = buildAttemptRecords({
    taskId: closedSeniorBackendTask.id,
    aptitudeTestId: closedSeniorAptitudeTest.id,
    domainTestId: closedSeniorDomainTest.id,
    candidates: closedSeniorCandidates
  });
  attempts.push(...closedSeniorRecords.attempts);

  const primaryTaskStats = computeStats({
    aptitudeTestId: aptitudeTestOne.id,
    domainTestId: domainTestOne.id,
    interviewScriptId: interviewScript.id,
    attempts,
    interviewResults: primaryCandidates
  });

  const secondaryTaskStats = computeStats({
    aptitudeTestId: aptitudeTestTwo.id,
    domainTestId: null,
    interviewScriptId: null,
    attempts,
    interviewResults: frontendCandidates
  });

  const tertiaryTaskStats = computeStats({
    aptitudeTestId: null,
    domainTestId: null,
    interviewScriptId: null,
    attempts,
    interviewResults: []
  });

  const platformTaskStats = computeStats({
    aptitudeTestId: platformAptitudeTest.id,
    domainTestId: platformDomainTest.id,
    interviewScriptId: platformInterviewScript.id,
    attempts,
    interviewResults: platformCandidates
  });

  const dataEngineerTaskStats = computeStats({
    aptitudeTestId: dataEngineerAptitudeTest.id,
    domainTestId: dataEngineerDomainTest.id,
    interviewScriptId: dataEngineerInterviewScript.id,
    attempts,
    interviewResults: dataEngineerCandidates
  });

  const closedSeniorTaskStats = computeStats({
    aptitudeTestId: closedSeniorAptitudeTest.id,
    domainTestId: closedSeniorDomainTest.id,
    interviewScriptId: closedSeniorInterviewScript.id,
    attempts,
    interviewResults: closedSeniorCandidates
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
        workflow_status: 'open',
        interview_scores: primaryRecords.interviewScores
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
        seeded_demo: true,
        workflow_status: 'open'
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
        seeded_demo: true,
        workflow_status: 'open'
      },
      llm_model: 'demo-seed',
      llm_response_id: 'demo-seed'
    },
    {
      ...platformTask,
      has_aptitude_test: true,
      has_domain_test: true,
      has_interview_script: true,
      aptitude_test_id: platformAptitudeTest.id,
      domain_test_id: platformDomainTest.id,
      interview_script_id: platformInterviewScript.id,
      stats: platformTaskStats,
      metadata: {
        seeded_demo: true,
        workflow_status: 'open',
        interview_scores: platformRecords.interviewScores
      },
      llm_model: 'demo-seed',
      llm_response_id: 'demo-seed'
    },
    {
      ...dataEngineerTask,
      has_aptitude_test: true,
      has_domain_test: true,
      has_interview_script: true,
      aptitude_test_id: dataEngineerAptitudeTest.id,
      domain_test_id: dataEngineerDomainTest.id,
      interview_script_id: dataEngineerInterviewScript.id,
      stats: dataEngineerTaskStats,
      metadata: {
        seeded_demo: true,
        workflow_status: 'open',
        interview_scores: dataEngineerRecords.interviewScores
      },
      llm_model: 'demo-seed',
      llm_response_id: 'demo-seed'
    },
    {
      ...closedSeniorBackendTask,
      has_aptitude_test: true,
      has_domain_test: true,
      has_interview_script: true,
      aptitude_test_id: closedSeniorAptitudeTest.id,
      domain_test_id: closedSeniorDomainTest.id,
      interview_script_id: closedSeniorInterviewScript.id,
      stats: closedSeniorTaskStats,
      metadata: {
        seeded_demo: true,
        workflow_status: 'closed',
        status_reason: 'Hire completed',
        hired_candidate_name: 'Aisha Khan',
        interview_scores: closedSeniorRecords.interviewScores
      },
      llm_model: 'demo-seed',
      llm_response_id: 'demo-seed'
    }
  ];

  return {
    tasks,
    tests: [
      aptitudeTestOne,
      domainTestOne,
      aptitudeTestTwo,
      platformAptitudeTest,
      platformDomainTest,
      dataEngineerAptitudeTest,
      dataEngineerDomainTest,
      closedSeniorAptitudeTest,
      closedSeniorDomainTest
    ],
    interviewScripts: [
      interviewScript,
      platformInterviewScript,
      dataEngineerInterviewScript,
      closedSeniorInterviewScript
    ],
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
