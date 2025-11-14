const http = require('http');
const { URL } = require('url');
const { readTests, writeTests, findTestById, findTestByPublicId, findTestByTaskAndType } = require('./storage');
const { validateTest } = require('./validation');
const { generateTest, applyAiEdit } = require('./llm/generator');

const PORT = process.env.PORT || 4000;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        const error = new Error('Payload too large');
        error.statusCode = 413;
        req.destroy(error);
        reject(error);
        return;
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
        const parseError = new Error('Invalid JSON payload');
        parseError.statusCode = 400;
        reject(parseError);
      }
    });
  });
}

function handleValidationFailure(res, errors) {
  sendJson(res, 400, { error: 'Validation failed', details: errors });
}

async function handleRequest(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname.startsWith('/api/tests/task/')) {
      const segments = pathname
        .split('/')
        .filter((segment) => segment.length > 0);
      const taskId = segments[3] ? decodeURIComponent(segments[3]) : undefined;
      const type = segments[4] ? decodeURIComponent(segments[4]) : undefined;
      if (!taskId || !type) {
        sendJson(res, 400, { error: 'Missing taskId or type' });
        return;
      }
      if (!['aptitude', 'domain'].includes(type)) {
        sendJson(res, 400, { error: 'Invalid test type' });
        return;
      }
      const tests = readTests();
      const test = findTestByTaskAndType(tests, taskId, type);
      if (!test) {
        sendJson(res, 404, { error: 'Test not found' });
        return;
      }
      sendJson(res, 200, { test });
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/tests/public/')) {
      const publicId = pathname.replace('/api/tests/public/', '');
      if (!publicId) {
        sendJson(res, 400, { error: 'Missing public test id' });
        return;
      }
      const tests = readTests();
      const test = findTestByPublicId(tests, publicId);
      if (!test) {
        sendJson(res, 404, { error: 'Test not found' });
        return;
      }
      sendJson(res, 200, { test });
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/tests/')) {
      const id = pathname.replace('/api/tests/', '');
      if (!id) {
        sendJson(res, 400, { error: 'Missing test id' });
        return;
      }
      const tests = readTests();
      const test = findTestById(tests, id);
      if (!test) {
        sendJson(res, 404, { error: 'Test not found' });
        return;
      }
      sendJson(res, 200, { test });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/tests/generate') {
      const body = await parseBody(req);
      const { taskId, type, difficulty = 'medium', taskSummary = {} } = body;
      if (!taskId || !type) {
        sendJson(res, 400, { error: 'taskId and type are required' });
        return;
      }

      const tests = readTests();
      const existingIndex = tests.findIndex((test) => test.hiring_task_id === taskId && test.type === type);

      const { test: generatedTest, prompt } = generateTest({
        taskId,
        type,
        difficulty,
        taskSummary
      });

      if (existingIndex >= 0) {
        generatedTest.id = tests[existingIndex].id;
        generatedTest.public_id = tests[existingIndex].public_id;
        generatedTest.metadata.version = tests[existingIndex].metadata.version + 1;
      }

      const validation = validateTest(generatedTest);
      if (!validation.success) {
        handleValidationFailure(res, validation.errors);
        return;
      }

      if (existingIndex >= 0) {
        tests.splice(existingIndex, 1, generatedTest);
      } else {
        tests.push(generatedTest);
      }
      writeTests(tests);

      sendJson(res, 201, { test: generatedTest, prompt });
      return;
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/tests/')) {
      const id = pathname.replace('/api/tests/', '');
      const body = await parseBody(req);
      const { test: candidateTest, updatedBy = 'human' } = body;
      if (!candidateTest || typeof candidateTest !== 'object') {
        sendJson(res, 400, { error: 'Request must include a test object' });
        return;
      }
      const tests = readTests();
      const existingIndex = tests.findIndex((test) => test.id === id);
      if (existingIndex < 0) {
        sendJson(res, 404, { error: 'Test not found' });
        return;
      }

      const existing = tests[existingIndex];
      const merged = {
        ...candidateTest,
        id: existing.id,
        public_id: existing.public_id,
        hiring_task_id: existing.hiring_task_id,
        type: existing.type,
        metadata: {
          version: existing.metadata.version + 1,
          generated_at: new Date().toISOString(),
          source_model: updatedBy === 'ai-edit' ? 'mock-llm-editor' : 'human-editor'
        }
      };

      const validation = validateTest(merged);
      if (!validation.success) {
        handleValidationFailure(res, validation.errors);
        return;
      }

      tests.splice(existingIndex, 1, merged);
      writeTests(tests);
      sendJson(res, 200, { test: merged });
      return;
    }

    if (req.method === 'POST' && pathname.startsWith('/api/tests/') && pathname.endsWith('/edit')) {
      const id = pathname.split('/')[3];
      const body = await parseBody(req);
      const { instructions = '' } = body;
      if (!instructions.trim()) {
        sendJson(res, 400, { error: 'instructions are required' });
        return;
      }
      const tests = readTests();
      const existing = findTestById(tests, id);
      if (!existing) {
        sendJson(res, 404, { error: 'Test not found' });
        return;
      }

      const { test: proposedTest, prompt } = applyAiEdit({ test: existing, instructions });
      sendJson(res, 200, { proposedTest, prompt });
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (error) {
    console.error('Server error', error);
    if (error.details) {
      handleValidationFailure(res, error.details);
    } else if (error.statusCode) {
      sendJson(res, error.statusCode, { error: error.message || 'Request failed' });
    } else {
      sendJson(res, 500, { error: 'Internal server error' });
    }
  }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
