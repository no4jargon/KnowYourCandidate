import type { Test } from '../types';
import type { ValidationError } from '../../shared/testSchema';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

type HttpMethod = 'GET' | 'POST' | 'PUT';

export class ApiError extends Error {
  status: number;
  details?: ValidationError[];

  constructor(message: string, status: number, details?: ValidationError[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : response.statusText;
    throw new ApiError(message, response.status, payload.details);
  }

  return payload as T;
}

export async function fetchTestByTaskAndType(taskId: string, type: 'aptitude' | 'domain'): Promise<Test | null> {
  try {
    const data = await request<{ test: Test }>(`/api/tests/task/${encodeURIComponent(taskId)}/${encodeURIComponent(type)}`);
    return data.test;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function fetchTestById(id: string): Promise<Test | null> {
  try {
    const data = await request<{ test: Test }>(`/api/tests/${encodeURIComponent(id)}`);
    return data.test;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function fetchTestByPublicId(publicId: string): Promise<Test | null> {
  try {
    const data = await request<{ test: Test }>(`/api/tests/public/${encodeURIComponent(publicId)}`);
    return data.test;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

interface GenerateTestOptions {
  taskId: string;
  type: 'aptitude' | 'domain';
  difficulty?: 'easy' | 'medium' | 'hard';
  taskSummary?: Record<string, any>;
}

export async function generateTest(options: GenerateTestOptions): Promise<{ test: Test; prompt: string }> {
  const { taskId, type, difficulty = 'medium', taskSummary = {} } = options;
  const data = await request<{ test: Test; prompt: string }>('/api/tests/generate', {
    method: 'POST',
    body: { taskId, type, difficulty, taskSummary }
  });
  return data;
}

interface UpdateTestOptions {
  updatedBy?: 'human' | 'ai-edit';
}

export async function updateTest(id: string, test: Test, options: UpdateTestOptions = {}): Promise<Test> {
  const data = await request<{ test: Test }>(`/api/tests/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { test, updatedBy: options.updatedBy ?? 'human' }
  });
  return data.test;
}

export async function requestAiEdit(id: string, instructions: string): Promise<{ proposedTest: Test; prompt: string }> {
  const data = await request<{ proposedTest: Test; prompt: string }>(`/api/tests/${encodeURIComponent(id)}/edit`, {
    method: 'POST',
    body: { instructions }
  });
  return data;
}
