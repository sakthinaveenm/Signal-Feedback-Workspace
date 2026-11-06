/** Call from an app's trusted backend. Never ship admin or project keys in a
 * public browser bundle or native app binary; use your own server as a relay.
 * Browser/mobile apps call that relay after your own user/abuse checks.
 */
export async function submitFeedback({ apiUrl, projectId, projectKey, title, description = '', type = 'Feedback', source = 'Web', contact = '' }) {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/ingest/${encodeURIComponent(projectId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Project-Key': projectKey },
    body: JSON.stringify({ title, description, type, source, contact }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Feedback submission failed (${response.status})`);
  return response.json();
}
