import type { Connection, Feedback, FeedbackInput, Filters, Page, Priority, Project, Status, Summary } from './types';
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export function normalizeUrl(input: string, development = false) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Enter a valid API URL, such as https://api.example.com.'); }
  if (url.username || url.password || url.search || url.hash || !['', '/', '/v1', '/v1/'].includes(url.pathname)) {
    throw new Error('Use the API origin only, with no credentials, query, or path.');
  }
  if (url.protocol !== 'https:' && !(development && url.protocol === 'http:')) {
    throw new Error('Use HTTPS for your backend. HTTP is allowed only in development builds.');
  }
  return url.origin;
}
export class SignalApi {
  constructor(private readonly connection: Connection, private readonly transport: typeof fetch = fetch) {}
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await this.transport(`${this.connection.url}/v1${path}`, {
        ...options, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...options.headers, Authorization: `Bearer ${this.connection.key}` },
      });
      if (response.status === 204) return undefined as T;
      const data = await response.json().catch(() => null) as { message?: string | string[] } | null;
      if (!response.ok) {
        const message = response.status === 401 ? 'Your API key was rejected. Check the connection in Settings.'
          : response.status === 429 ? 'Too many requests. Please wait a minute and retry.'
          : Array.isArray(data?.message) ? data.message.join('\n') : data?.message || `Request failed (${response.status}).`;
        throw new ApiError(message, response.status);
      }
      if (data === null) throw new Error('The backend returned an invalid response. Check the API URL.');
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new Error('The request timed out. Check your connection and try again.');
      if (error instanceof TypeError) throw new Error('Cannot reach the API. Check the URL and your network connection.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  projects() { return this.request<Project[]>('/projects'); }
  summary(projectId?: string) { return this.request<Summary>('/summary' + (projectId ? `?projectId=${encodeURIComponent(projectId)}` : '')); }
  feedback(filters: Filters, page = 1) {
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    for (const [key, value] of Object.entries(filters)) if (value?.trim()) query.set(key, value.trim());
    return this.request<Page>(`/feedback?${query}`);
  }
  report(id: string) { return this.request<Feedback>(`/feedback/${encodeURIComponent(id)}`); }
  createProject(data: { name: string; url: string; platform: string }) {
    return this.request<{ project: Project; ingestionKey: string }>('/projects', { method: 'POST', body: JSON.stringify(data) });
  }
  createFeedback(data: FeedbackInput) { return this.request<Feedback>('/feedback', { method: 'POST', body: JSON.stringify(data) }); }
  updateFeedback(id: string, data: { status: Status; priority: Priority; notes: string }) {
    return this.request<Feedback>(`/feedback/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
}
