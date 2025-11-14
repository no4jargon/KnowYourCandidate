const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');
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

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

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
      return res.status(404).json({ error: 'Hiring task not found' });
    }
    res.json({ data: task });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.errors });
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
