import { CandidateAttempt, CandidateResponse, HiringTask, HiringTaskStats, Test, TestSection } from '../types';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface ApiResponse<T> {
  data: T;
  task?: Pick<HiringTask, 'id' | 'stats'>;
}

interface GenerateTestOptions {
  instructions?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: any;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch (_error) {
    payload = undefined;
  }

  if (!response.ok) {
    const message = payload?.error || response.statusText || 'Request failed';
    throw new ApiError(message, response.status, payload?.details);
  }

  return payload as T;
}

export interface TestUpdatePayload {
  title?: string;
  description?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard';
  sections?: TestSection[];
  metadata?: Record<string, unknown>;
}

export async function getTest(testId: string): Promise<Test> {
  const response = await fetch(`/api/tests/${testId}`);
  const data = await parseResponse<ApiResponse<Test>>(response);
  return data.data;
}

export async function getTestByPublicId(publicId: string): Promise<Test> {
  const response = await fetch(`/api/tests/public/${publicId}`);
  const data = await parseResponse<ApiResponse<Test>>(response);
  return data.data;
}

export async function generateTestArtifact(
  taskId: string,
  kind: 'aptitude' | 'domain',
  options: GenerateTestOptions = {}
): Promise<{ test: Test; task?: HiringTask }> {
  const response = await fetch(`/api/hiring-tasks/${taskId}/tests/${kind}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instructions: options.instructions ?? '',
      difficulty: options.difficulty ?? 'medium'
    })
  });

  const data = await parseResponse<ApiResponse<Test>>(response);
  return { test: data.data, task: data.task };
}

export async function updateTest(testId: string, payload: TestUpdatePayload): Promise<Test> {
  const response = await fetch(`/api/tests/${testId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await parseResponse<ApiResponse<Test>>(response);
  return data.data;
}

export async function editTestWithPrompt(testId: string, instructions: string): Promise<Test> {
  const response = await fetch(`/api/tests/${testId}/edit-with-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructions })
  });
  const data = await parseResponse<ApiResponse<Test>>(response);
  return data.data;
}

export interface AttemptSession {
  attempt: CandidateAttempt;
  responses: CandidateResponse[];
  test: {
    id: string;
    public_id: string;
    kind: Test['kind'];
    title: string;
  };
}

export interface CandidateResponseInput {
  questionId: string;
  rawAnswer?: string | number | null;
}

export async function startOrResumeAttempt(
  publicId: string,
  payload: { candidateName: string; candidateEmail?: string; attemptId?: string }
): Promise<AttemptSession> {
  const response = await fetch(`/api/tests/public/${publicId}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await parseResponse<ApiResponse<AttemptSession>>(response);
  return data.data;
}

export async function autosaveAttemptResponses(
  attemptId: string,
  responses: CandidateResponseInput[]
): Promise<{ attempt: CandidateAttempt; responses: CandidateResponse[] }> {
  const response = await fetch(`/api/tests/attempts/${attemptId}/responses`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responses })
  });
  const data = await parseResponse<ApiResponse<{ attempt: CandidateAttempt; responses: CandidateResponse[] }>>(response);
  return data.data;
}

export async function submitAttempt(
  attemptId: string,
  responses?: CandidateResponseInput[]
): Promise<{ attempt: CandidateAttempt; responses: CandidateResponse[]; task?: { id: string; stats: HiringTaskStats } }> {
  const response = await fetch(`/api/tests/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responses })
  });
  const data = await parseResponse<
    ApiResponse<{ attempt: CandidateAttempt; responses: CandidateResponse[] }>
  >(response);
  return { ...data.data, task: data.task };
}
