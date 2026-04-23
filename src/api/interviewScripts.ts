import { InterviewScript } from '../types';

interface ApiResponse<T> {
  data: T;
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
    throw new Error(message);
  }

  return payload as T;
}

export async function getInterviewScript(scriptId: string): Promise<InterviewScript> {
  const response = await fetch(`/api/interview-scripts/${scriptId}`);
  const data = await parseResponse<ApiResponse<InterviewScript>>(response);
  return data.data;
}

export async function generateInterviewScriptArtifact(
  taskId: string,
  instructions = ''
): Promise<InterviewScript> {
  const response = await fetch(`/api/hiring-tasks/${taskId}/interview-script/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ instructions })
  });

  const data = await parseResponse<ApiResponse<InterviewScript>>(response);
  return data.data;
}
