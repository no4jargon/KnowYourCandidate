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
  getActivityFeed
} = require('./repositories/hiringTaskRepository');
const {
  generateAndValidateFacets,
  JDFacetsSchema
} = require('./services/facetService');

const { randomUUID } = crypto;

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

function sanitizeEmployer(employer) {
  return {
    id: employer.id,
    email: employer.email,
    name: employer.name
  };
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
      id: randomUUID(),
      employer_id: payload.employerId,
      title: payload.title,
      location: payload.location,
      job_description_raw: payload.jobDescriptionRaw,
      job_description_facets: facets,
      has_aptitude_test: payload.hasAptitudeTest ? 1 : 0,
      has_domain_test: payload.hasDomainTest ? 1 : 0,
      has_interview_script: payload.hasInterviewScript ? 1 : 0,
      aptitude_test_id: null,
      domain_test_id: null,
      stats: {
        aptitude_candidates: 0,
        aptitude_avg_score: 0,
        domain_candidates: 0,
        domain_avg_score: 0
      },
      metadata: payload.metadata || {},
      llm_model: model,
      llm_response_id: responseId
    });

    res.status(201).json({ data: task });
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
