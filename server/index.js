const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const {
  createTask,
  listTasks,
  getTaskById,
  getActivityFeed,
  updateTask,
  refreshStatsForTest
} = require('./repositories/hiringTaskRepository');
const {
  createTest,
  getTestById,
  getTestByPublicId,
  getTestByTaskAndKind,
  updateTest
} = require('./repositories/testRepository');
const {
  createAttempt,
  getAttemptById,
  listResponsesByAttempt,
  bulkUpsertResponses,
  updateAttempt
} = require('./repositories/candidateAttemptRepository');
const {
  createInterviewScript,
  getInterviewScriptById,
  updateInterviewScript
} = require('./repositories/interviewScriptRepository');
const {
  generateAndValidateFacets,
  JDFacetsSchema
} = require('./services/facetService');
const { generateTest, validateTestUpdate } = require('./services/testGenerationService');
const {
  generateInterviewScript,
  validateInterviewScriptUpdate
} = require('./services/interviewScriptService');
const { scoreAttempt, normalizeAnswer } = require('./services/scoringService');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';
const TOKEN_COOKIE = 'kyc_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const employersPath = path.join(__dirname, 'employers.json');
let employers = [];

try {
  const raw = fs.readFileSync(employersPath, 'utf-8');
  employers = JSON.parse(raw);
} catch (error) {
  console.error('Failed to load employers data:', error);
  process.exit(1);
}

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173'
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (!name) {
      return acc;
    }
    acc[name] = decodeURIComponent(valueParts.join('='));
    return acc;
  }, {});
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [headerB64, bodyB64, signature] = parts;
  try {
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64url');
    const provided = Buffer.from(signature, 'base64url');
    const expected = Buffer.from(expectedSignature, 'base64url');
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Payload too large'));
        req.connection.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(body);
}

function sanitizeEmployer(employer) {
  return {
    id: employer.id,
    email: employer.email,
    name: employer.name
  };
}

function buildQuestionIndex(test) {
  const map = new Map();
  if (!test?.sections) {
    return map;
  }
  for (const section of test.sections) {
    for (const question of section.questions || []) {
      const id = question.id || question.prompt;
      map.set(id, { ...question, id });
    }
  }
  return map;
}

function authenticateRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[TOKEN_COOKIE];
  const payload = verifyToken(token);
  if (!payload || !payload.sub) {
    return null;
  }
  const employer = employers.find((emp) => emp.id === payload.sub);
  if (!employer) {
    return null;
  }
  return employer;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieParts = [
    `${TOKEN_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${TOKEN_TTL_SECONDS}`,
    'SameSite=Lax'
  ];
  if (secure) {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieParts = [
    `${TOKEN_COOKIE}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax'
  ];
  if (secure) {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

const CreateTaskSchema = z.object({
  employerId: z.string().min(1).default('emp-1'),
  title: z.string().min(1),
  location: z.string().min(1),
  jobDescriptionRaw: z.string().min(1),
  hasAptitudeTest: z.boolean().optional(),
  hasDomainTest: z.boolean().optional(),
  hasInterviewScript: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

const PaginationQuerySchema = z.object({
  page: z.preprocess((value) => Number(value ?? 1), z.number().int().min(1)),
  pageSize: z.preprocess((value) => Number(value ?? 10), z.number().int().min(1).max(100)),
  employerId: z.string().optional()
});

const StartAttemptSchema = z.object({
  candidateName: z.string().min(1, 'Candidate name is required'),
  candidateEmail: z.string().email().optional(),
  attemptId: z.string().uuid().optional()
});

const CandidateResponseSchema = z.object({
  questionId: z.string().min(1),
  rawAnswer: z.any().optional()
});

const AutosaveResponsesSchema = z.object({
  responses: z.array(CandidateResponseSchema).min(1)
});

const SubmitAttemptSchema = z.object({
  responses: z.array(CandidateResponseSchema).optional()
});

const GenerateTestPayloadSchema = z
  .object({
    instructions: z.string().max(2000).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional()
  })
  .strict();

const GenerateInterviewScriptPayloadSchema = z
  .object({
    instructions: z.string().max(2000).optional()
  })
  .strict();

const UpdateTestPayloadSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    sections: z.any().optional(),
    metadata: z.record(z.any()).optional()
  })
  .strict()
  .refine((value) => value.sections === undefined || Array.isArray(value.sections), {
    message: 'Sections must be an array when provided',
    path: ['sections']
  });

const UpdateInterviewScriptPayloadSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    script: z.any().optional(),
    metadata: z.record(z.any()).optional()
  })
  .strict()
  .refine((value) => value.script === undefined || Array.isArray(value.script), {
    message: 'Script must be an array when provided',
    path: ['script']
  });

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/login', (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const employer = employers.find((emp) => emp.email.toLowerCase() === email);
    if (!employer) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const hashed = hashPassword(password, employer.passwordSalt);
    const provided = Buffer.from(hashed, 'hex');
    const stored = Buffer.from(employer.passwordHash, 'hex');
    if (provided.length !== stored.length || !crypto.timingSafeEqual(provided, stored)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const payload = {
      sub: employer.id,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
    };
    const token = createToken(payload);
    setSessionCookie(res, token);
    res.json({ employer: sanitizeEmployer(employer) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Unable to log in right now.' });
  }
});

app.post('/api/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get('/api/session', (req, res) => {
  const employer = authenticateRequest(req);
  if (!employer) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  res.json({ employer: sanitizeEmployer(employer) });
});

app.post('/api/hiring-tasks', async (req, res, next) => {
  try {
    const payload = CreateTaskSchema.parse(req.body);

    const { facets, model, responseId } = await generateAndValidateFacets(
      payload.jobDescriptionRaw,
      { title: payload.title, location: payload.location }
    );

    const task = createTask({
      employer_id: payload.employerId,
      title: payload.title,
      location: payload.location,
      job_description_raw: payload.jobDescriptionRaw,
      job_description_facets: facets,
      has_aptitude_test: payload.hasAptitudeTest ? 1 : 0,
      has_domain_test: payload.hasDomainTest ? 1 : 0,
      has_interview_script: payload.hasInterviewScript ? 1 : 0,
      metadata: payload.metadata || {},
      llm_model: model,
      llm_response_id: responseId
    });

    res.status(201).json({ data: task });
  } catch (error) {
    next(error);
  }
});

app.post('/api/hiring-tasks/:id/tests/:kind/generate', async (req, res, next) => {
  try {
    const kind = req.params.kind;
    if (kind !== 'aptitude' && kind !== 'domain') {
      res.status(400).json({ error: 'Unsupported test kind' });
      return;
    }

    const payload = GenerateTestPayloadSchema.parse(req.body ?? {});
    const task = getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Hiring task not found' });
      return;
    }

    const { test, metadata, model, responseId } = await generateTest({
      kind,
      facets: task.job_description_facets,
      jobDescription: task.job_description_raw,
      instructions: payload.instructions || '',
      difficulty: payload.difficulty || 'medium'
    });

    const existing = getTestByTaskAndKind(task.id, kind);
    const testMetadata = {
      ...metadata,
      response_id: responseId
    };

    let saved;
    if (existing) {
      saved = updateTest(existing.id, {
        title: test.title,
        description: test.description ?? null,
        difficulty: test.difficulty,
        sections: test.sections,
        metadata: testMetadata
      });
    } else {
      saved = createTest({
        hiring_task_id: task.id,
        kind,
        title: test.title,
        description: test.description ?? null,
        difficulty: test.difficulty,
        sections: test.sections,
        metadata: testMetadata
      });
    }

    const statsKey = kind === 'aptitude' ? 'aptitude' : 'domain';
    const hasKey = kind === 'aptitude' ? 'has_aptitude_test' : 'has_domain_test';
    const idKey = kind === 'aptitude' ? 'aptitude_test_id' : 'domain_test_id';

    const updatedStats = {
      ...task.stats,
      [statsKey]: {
        ...(task.stats?.[statsKey] || {}),
        test_id: saved.id
      }
    };

    const updatedTask = updateTask(task.id, {
      [hasKey]: true,
      [idKey]: saved.id,
      stats: updatedStats
    });

    res.status(existing ? 200 : 201).json({
      data: saved,
      task: updatedTask,
      llm: { model, responseId }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/hiring-tasks/:id/interview-script/generate', async (req, res, next) => {
  try {
    const payload = GenerateInterviewScriptPayloadSchema.parse(req.body ?? {});
    const task = getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Hiring task not found' });
      return;
    }

    const { script, metadata, model, responseId } = await generateInterviewScript({
      facets: task.job_description_facets,
      jobDescription: task.job_description_raw,
      instructions: payload.instructions || ''
    });

    const scriptMetadata = {
      ...metadata,
      response_id: responseId
    };

    let saved;
    if (task.interview_script_id) {
      saved = updateInterviewScript(task.interview_script_id, {
        title: script.title,
        description: script.description ?? null,
        script: script.script,
        metadata: scriptMetadata
      });
    } else {
      saved = createInterviewScript({
        hiring_task_id: task.id,
        title: script.title,
        description: script.description ?? null,
        script: script.script,
        metadata: scriptMetadata
      });
    }

    const updatedTask = updateTask(task.id, {
      has_interview_script: true,
      interview_script_id: saved.id,
      stats: {
        ...task.stats,
        interview: {
          ...(task.stats?.interview || {}),
          script_id: saved.id
        }
      }
    });

    res.status(task.interview_script_id ? 200 : 201).json({
      data: saved,
      task: updatedTask,
      llm: { model, responseId }
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/hiring-tasks', (req, res, next) => {
  try {
    const { page, pageSize, employerId } = PaginationQuerySchema.parse(req.query);
    const { tasks, total } = listTasks({ page, pageSize, employerId });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    res.json({
      data: tasks,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/hiring-tasks/activity', (req, res, next) => {
  try {
    const employerId = typeof req.query.employerId === 'string' ? req.query.employerId : undefined;
    const items = getActivityFeed({ employerId });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
});

app.get('/api/hiring-tasks/:id', (req, res, next) => {
  try {
    const task = getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Hiring task not found' });
      return;
    }
    res.json({ data: task });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tests/:id', (req, res, next) => {
  try {
    const test = getTestById(req.params.id);
    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }
    res.json({ data: test });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tests/public/:publicId', (req, res, next) => {
  try {
    const test = getTestByPublicId(req.params.publicId);
    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }
    res.json({ data: test });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tests/public/:publicId/attempts', (req, res, next) => {
  try {
    const payload = StartAttemptSchema.parse(req.body ?? {});
    const test = getTestByPublicId(req.params.publicId);
    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    let attempt;
    if (payload.attemptId) {
      attempt = getAttemptById(payload.attemptId);
      if (!attempt || attempt.test_id !== test.id) {
        res.status(404).json({ error: 'Attempt not found' });
        return;
      }
      if (attempt.submitted_at) {
        res.status(409).json({ error: 'Attempt already submitted' });
        return;
      }
    } else {
      attempt = createAttempt({
        test_id: test.id,
        hiring_task_id: test.hiring_task_id,
        candidate_name: payload.candidateName,
        candidate_email: payload.candidateEmail ?? null,
        metadata: {
          started_via: 'candidate',
          last_autosave_at: null
        }
      });
    }

    const responses = listResponsesByAttempt(attempt.id);
    const statusCode = payload.attemptId ? 200 : 201;
    res.status(statusCode).json({
      data: {
        attempt,
        responses,
        test: {
          id: test.id,
          public_id: test.public_id,
          kind: test.kind,
          title: test.title
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/tests/attempts/:attemptId/responses', (req, res, next) => {
  try {
    const payload = AutosaveResponsesSchema.parse(req.body ?? {});
    const attempt = getAttemptById(req.params.attemptId);
    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }
    if (attempt.submitted_at) {
      res.status(409).json({ error: 'Attempt already submitted' });
      return;
    }

    const test = getTestById(attempt.test_id);
    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    const questionIndex = buildQuestionIndex(test);
    const formattedResponses = [];
    for (const response of payload.responses) {
      const question = questionIndex.get(response.questionId);
      if (!question) {
        res.status(400).json({ error: `Unknown question id: ${response.questionId}` });
        return;
      }
      const rawAnswer = Object.prototype.hasOwnProperty.call(response, 'rawAnswer')
        ? response.rawAnswer
        : null;
      const normalized = normalizeAnswer(question, rawAnswer);
      formattedResponses.push({
        question_id: question.id,
        raw_answer: rawAnswer ?? null,
        normalized_answer: normalized,
        score: null
      });
    }

    const responses = bulkUpsertResponses(attempt.id, formattedResponses);
    const metadata = {
      ...(attempt.metadata || {}),
      last_autosave_at: new Date().toISOString()
    };
    const updatedAttempt = updateAttempt(attempt.id, { metadata });

    res.json({
      data: {
        attempt: updatedAttempt,
        responses
      }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tests/attempts/:attemptId/submit', async (req, res, next) => {
  try {
    const payload = SubmitAttemptSchema.parse(req.body ?? {});
    const attempt = getAttemptById(req.params.attemptId);
    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }
    if (attempt.submitted_at) {
      res.status(409).json({ error: 'Attempt already submitted' });
      return;
    }

    const test = getTestById(attempt.test_id);
    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    const task = getTaskById(attempt.hiring_task_id);
    if (!task) {
      res.status(404).json({ error: 'Hiring task not found' });
      return;
    }

    if (payload.responses && payload.responses.length) {
      const questionIndex = buildQuestionIndex(test);
      const formattedResponses = [];
      for (const response of payload.responses) {
        const question = questionIndex.get(response.questionId);
        if (!question) {
          res.status(400).json({ error: `Unknown question id: ${response.questionId}` });
          return;
        }
        const rawAnswer = Object.prototype.hasOwnProperty.call(response, 'rawAnswer')
          ? response.rawAnswer
          : null;
        const normalized = normalizeAnswer(question, rawAnswer);
        formattedResponses.push({
          question_id: question.id,
          raw_answer: rawAnswer ?? null,
          normalized_answer: normalized,
          score: null
        });
      }
      bulkUpsertResponses(attempt.id, formattedResponses);
    }

    const existingResponses = listResponsesByAttempt(attempt.id);
    const scoring = await scoreAttempt({
      test,
      attempt: { ...attempt, task_title: task.title },
      responses: existingResponses
    });

    const savedResponses = bulkUpsertResponses(attempt.id, scoring.responses);
    const submittedAt = new Date().toISOString();
    const metadata = {
      ...(attempt.metadata || {}),
      last_scored_at: submittedAt,
      llm_events: scoring.llm
    };
    const updatedAttempt = updateAttempt(attempt.id, {
      submitted_at: submittedAt,
      total_score: scoring.totalScore,
      max_score: scoring.maxScore,
      metadata
    });

    const updatedTask = refreshStatsForTest(test.id);

    res.json({
      data: {
        attempt: updatedAttempt,
        responses: savedResponses
      },
      task: updatedTask ? { id: updatedTask.id, stats: updatedTask.stats } : undefined
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/tests/:id', (req, res, next) => {
  try {
    const existing = getTestById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    const payload = UpdateTestPayloadSchema.parse(req.body ?? {});
    const normalized = validateTestUpdate(payload);
    const saved = updateTest(req.params.id, normalized);
    res.json({ data: saved });
  } catch (error) {
    next(error);
  }
});

app.get('/api/interview-scripts/:id', (req, res, next) => {
  try {
    const script = getInterviewScriptById(req.params.id);
    if (!script) {
      res.status(404).json({ error: 'Interview script not found' });
      return;
    }
    res.json({ data: script });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/interview-scripts/:id', (req, res, next) => {
  try {
    const existing = getInterviewScriptById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Interview script not found' });
      return;
    }

    const payload = UpdateInterviewScriptPayloadSchema.parse(req.body ?? {});
    const { metadata, ...content } = payload;
    const validatedContent = validateInterviewScriptUpdate(content);
    const saved = updateInterviewScript(req.params.id, {
      ...validatedContent,
      ...(metadata ? { metadata } : {})
    });
    res.json({ data: saved });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.errors });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  if (err instanceof Error && err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});

module.exports = {
  app,
  JDFacetsSchema
};
