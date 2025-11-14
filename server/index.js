const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
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
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
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

const server = http.createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/login' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!email || !password) {
        sendJson(res, 400, { error: 'Email and password are required.' });
        return;
      }

      const employer = employers.find((emp) => emp.email.toLowerCase() === email);
      if (!employer) {
        sendJson(res, 401, { error: 'Invalid email or password.' });
        return;
      }

      const hashed = hashPassword(password, employer.passwordSalt);
      const provided = Buffer.from(hashed, 'hex');
      const stored = Buffer.from(employer.passwordHash, 'hex');
      if (provided.length !== stored.length || !crypto.timingSafeEqual(provided, stored)) {
        sendJson(res, 401, { error: 'Invalid email or password.' });
        return;
      }

      const payload = {
        sub: employer.id,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
      };
      const token = createToken(payload);
      setSessionCookie(res, token);
      sendJson(res, 200, { employer: sanitizeEmployer(employer) });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error && (error.message === 'Invalid JSON body' || error.message === 'Payload too large')) {
        sendJson(res, 400, { error: error.message });
      } else {
        sendJson(res, 500, { error: 'Unable to log in right now.' });
      }
    }
    return;
  }

  if (url.pathname === '/api/logout' && req.method === 'POST') {
    clearSessionCookie(res);
    sendJson(res, 200, { success: true });
    return;
  }

  if (url.pathname === '/api/session' && req.method === 'GET') {
    const employer = authenticateRequest(req);
    if (!employer) {
      sendJson(res, 401, { error: 'Not authenticated.' });
      return;
    }
    sendJson(res, 200, { employer: sanitizeEmployer(employer) });
    return;
  }

  if (url.pathname.startsWith('/api/employer') && req.method === 'GET') {
    const employer = authenticateRequest(req);
    if (!employer) {
      sendJson(res, 401, { error: 'Not authenticated.' });
      return;
    }
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Auth API listening on port ${PORT}`);
});
