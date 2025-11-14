import { HiringTask, JDFacets, LiveFeedItem } from '../types';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ListHiringTasksParams {
  page?: number;
  pageSize?: number;
  employerId?: string;
}

export interface CreateHiringTaskPayload {
  employerId?: string;
  title: string;
  location: string;
  jobDescriptionRaw: string;
  hasAptitudeTest?: boolean;
  hasDomainTest?: boolean;
  hasInterviewScript?: boolean;
  metadata?: Record<string, unknown>;
}

interface CreateHiringTaskResponse {
  data: HiringTask;
}

interface GetHiringTaskResponse {
  data: HiringTask;
}

interface ListHiringTasksResponse extends PaginatedResponse<HiringTask> {}

interface ActivityFeedResponse {
  data: LiveFeedItem[];
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error || response.statusText || 'Request failed';
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function createHiringTask(payload: CreateHiringTaskPayload): Promise<HiringTask> {
  const response = await fetch('/api/hiring-tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      employerId: payload.employerId ?? 'emp-1',
      title: payload.title,
      location: payload.location,
      jobDescriptionRaw: payload.jobDescriptionRaw,
      hasAptitudeTest: payload.hasAptitudeTest ?? false,
      hasDomainTest: payload.hasDomainTest ?? false,
      hasInterviewScript: payload.hasInterviewScript ?? false,
      metadata: payload.metadata ?? {}
    })
  });

  const data = await handleResponse<CreateHiringTaskResponse>(response);
  return data.data;
}

export async function listHiringTasks({
  page = 1,
  pageSize = 10,
  employerId
}: ListHiringTasksParams = {}): Promise<ListHiringTasksResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  if (employerId) {
    params.set('employerId', employerId);
  }

  const response = await fetch(`/api/hiring-tasks?${params.toString()}`);
  return handleResponse<ListHiringTasksResponse>(response);
}

export async function getHiringTask(id: string): Promise<HiringTask> {
  const response = await fetch(`/api/hiring-tasks/${id}`);
  const data = await handleResponse<GetHiringTaskResponse>(response);
  return data.data;
}

export async function getActivityFeed(employerId?: string): Promise<LiveFeedItem[]> {
  const params = employerId ? `?employerId=${encodeURIComponent(employerId)}` : '';
  const response = await fetch(`/api/hiring-tasks/activity${params}`);
  const data = await handleResponse<ActivityFeedResponse>(response);
  return data.data;
}

export function formatFacets(facets: JDFacets): string {
  return JSON.stringify(facets, null, 2);
}
