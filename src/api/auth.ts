export interface EmployerSession {
  id: string;
  email: string;
  name: string;
}

interface ApiError {
  error?: string;
}

const API_BASE = '/api';

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error('Received malformed response from server.');
  }
}

function buildUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (!path.startsWith('/')) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
}

export async function login(email: string, password: string): Promise<EmployerSession> {
  const response = await fetch(buildUrl('/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const data = await parseJson<ApiError>(response);
    const message = data.error || 'Unable to log in with those credentials.';
    throw new Error(message);
  }

  const data = await parseJson<{ employer: EmployerSession }>(response);
  if (!data.employer) {
    throw new Error('Server response was missing employer information.');
  }

  return data.employer;
}

export async function logout(): Promise<void> {
  await fetch(buildUrl('/logout'), {
    method: 'POST',
    credentials: 'include'
  });
}

export async function fetchSession(): Promise<EmployerSession | null> {
  const response = await fetch(buildUrl('/session'), {
    method: 'GET',
    credentials: 'include'
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const data = await parseJson<ApiError>(response);
    const message = data.error || 'Failed to refresh session.';
    throw new Error(message);
  }

  const data = await parseJson<{ employer: EmployerSession }>(response);
  if (!data.employer) {
    throw new Error('Server response was missing employer information.');
  }

  return data.employer;
}
