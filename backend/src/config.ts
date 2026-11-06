export function validateEnvironment(input: Record<string, unknown>) {
  const uri = String(input.MONGODB_URI || '');
  if (!/^mongodb(\+srv)?:\/\//.test(uri) || uri.includes('YOUR_CLUSTER')) {
    throw new Error('Set MONGODB_URI to your MongoDB Atlas connection URI.');
  }
  const key = String(input.ADMIN_API_KEY || '');
  if (key.length < 32 || key.startsWith('replace-with-')) {
    throw new Error('ADMIN_API_KEY must be a random secret of at least 32 characters.');
  }
  const port = Number(input.PORT || 3001);
  const hops = Number(input.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  if (!Number.isInteger(hops) || hops < 0 || hops > 10) throw new Error('Invalid TRUST_PROXY_HOPS.');
  const origins = String(input.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const origin of origins) {
    let parsed: URL;
    try { parsed = new URL(origin); } catch { throw new Error('Invalid CORS_ORIGINS.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins without paths.');
    }
  }
  return { ...input, MONGODB_URI: uri, ADMIN_API_KEY: key, PORT: port,
    MONGODB_DB_NAME: String(input.MONGODB_DB_NAME || 'signal'), TRUST_PROXY_HOPS: hops,
    CORS_ORIGINS: origins.join(',') };
}
