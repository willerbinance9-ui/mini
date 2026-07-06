import { authStorage } from './storage';
import { sanitizeUserFacingError } from '../utils/userFacingError';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function resolveDefaultBaseUrl() {
  // In Expo dev sessions on a physical device, derive host from Metro host URI.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const lanHost = String(hostUri).split(':')[0];
  if (lanHost) return `http://${lanHost}:4000`;

  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

const configuredBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? resolveDefaultBaseUrl()).replace(/\/+$/, '');
const fallbackBaseUrls = ['https://ema-0gp3.onrender.com', 'https://mini-rdjs.onrender.com'];
const BASE_URL_CANDIDATES = Array.from(
  new Set([configuredBaseUrl, ...fallbackBaseUrls].map((u) => u.replace(/\/+$/, '')))
);

const REQUEST_TIMEOUT_MS = 45_000;

/** Auth routes may exist on a different Render service; retry other bases on credential/token mismatch. */
const AUTH_FAILOVER_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/totp/verify',
  '/auth/recover-password/verify',
  '/auth/recover-password',
  '/auth/me',
]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function shouldFailoverAuth(path: string, status: number, data: unknown): boolean {
  if (!AUTH_FAILOVER_PATHS.has(path)) return false;
  const msg = String((data as { message?: string } | null)?.message || '').toLowerCase();
  if (status !== 401) return false;
  return (
    msg.includes('invalid email') ||
    msg.includes('invalid token') ||
    msg.includes('missing token')
  );
}

function parseResponseBody(raw: string, contentType: string): unknown {
  if (!raw) return null;
  if (contentType.includes('application/json') || raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return JSON.parse(raw);
    } catch {
      return { message: raw.slice(0, 200) };
    }
  }
  return { message: raw.slice(0, 200) };
}

function promoteBaseUrl(baseUrl: string) {
  if (BASE_URL_CANDIDATES[0] === baseUrl) return;
  const idx = BASE_URL_CANDIDATES.indexOf(baseUrl);
  if (idx > 0) {
    BASE_URL_CANDIDATES.splice(idx, 1);
    BASE_URL_CANDIDATES.unshift(baseUrl);
  }
}

async function fetchWithAuth(baseUrl: string, path: string, options: RequestInit, token: string | null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await authStorage.getToken();
  const authFailover = AUTH_FAILOVER_PATHS.has(path);
  let lastAuthError: (Error & { status?: number; code?: string }) | null = null;

  for (const baseUrl of BASE_URL_CANDIDATES) {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await fetchWithAuth(baseUrl, path, options, token);
        break;
      } catch {
        // Render instances may be cold; poke health and back off.
        try {
          await fetch(`${baseUrl}/health`);
        } catch {
          // ignore and retry with backoff
        }
        await sleep(700 * (attempt + 1));
      }
    }

    if (!response) continue;

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    const data = parseResponseBody(raw, contentType);

    if (response.ok) {
      promoteBaseUrl(baseUrl);
      return (data ?? {}) as T;
    }

    const fallback = 'Request failed. Please try again.';
    const rawMessage =
      (data as { message?: string } | null)?.message ||
      (typeof data === 'string' ? data : '') ||
      fallback;
    const message = sanitizeUserFacingError(String(rawMessage), fallback);
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = response.status;
    if ((data as { code?: string } | null)?.code) err.code = String((data as { code: string }).code);

    if (authFailover && shouldFailoverAuth(path, response.status, data)) {
      lastAuthError = err;
      continue;
    }

    throw err;
  }

  if (lastAuthError) throw lastAuthError;
  throw new Error(sanitizeUserFacingError('Unable to reach Min right now. Check your connection and try again.'));
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), headers }),
  put: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body), headers }),
  patch: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), headers }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
