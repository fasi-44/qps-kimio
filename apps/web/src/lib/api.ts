export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: Record<string, unknown>,
  ) {
    super((data?.message as string) ?? `HTTP ${status}`);
  }
}

// Default to a same-origin path so the browser never carries the API host.
// Next.js rewrites (see next.config.ts) proxy /api/* to the real backend at
// runtime — no API URL baked into the client bundle, and no cross-origin/CORS.
export const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '/api');

/** Origin that serves uploaded files (the API host without the /api prefix). */
export const FILE_BASE_URL = BASE_URL.replace(/\/api\/?$/, '');

/** Resolve a stored document path (e.g. "/uploads/x.pdf") to an absolute URL. */
export function fileUrl(path: string): string {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/i.test(path)) return path; // already absolute / legacy pasted URL
  return `${FILE_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Friendly file name from a stored path — strips the dir and the uuid prefix the API adds. */
export function fileName(path: string): string {
  if (!path) return '';
  const base = path.split(/[\\/]/).pop() ?? path;
  return base.replace(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/, '');
}

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<string> | null = null;

export function setToken(access: string | null, refresh?: string | null) {
  _accessToken = access;
  if (refresh !== undefined) _refreshToken = refresh;
}

export function getToken() {
  return _accessToken;
}

async function doRefresh(): Promise<string> {
  if (!_refreshToken) throw new ApiError(401, { message: 'No refresh token' });
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: _refreshToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data);
  }
  const json = await res.json();
  const tokens = (json?.data ?? json) as { accessToken: string; refreshToken?: string };
  _accessToken = tokens.accessToken;
  // Persist the rotated refresh token so the next silent refresh succeeds
  if (tokens.refreshToken) {
    _refreshToken = tokens.refreshToken;
  }
  if (typeof document !== 'undefined') {
    document.cookie = `auth_token=${tokens.accessToken}; path=/; samesite=strict; max-age=43200`;
  }
  // Keep localStorage in sync so rehydration uses the new tokens
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(localStorage.getItem('qps-auth-v1') ?? '{}');
      if (stored.state) {
        stored.state.accessToken = tokens.accessToken;
        if (tokens.refreshToken) stored.state.refreshToken = tokens.refreshToken;
        localStorage.setItem('qps-auth-v1', JSON.stringify(stored));
      }
    } catch {}
  }
  return tokens.accessToken;
}

async function refreshOnce(): Promise<string> {
  if (!_refreshPromise) {
    _refreshPromise = doRefresh().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

interface RequestOpts {
  skipAuth?: boolean;
  isFormData?: boolean;
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOpts = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!opts.isFormData) headers['Content-Type'] = 'application/json';
  if (!opts.skipAuth && _accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const init: RequestInit = {
    method,
    headers,
    body: body
      ? opts.isFormData
        ? (body as FormData)
        : JSON.stringify(body)
      : undefined,
  };

  let res = await fetch(`${BASE_URL}${path}`, init);

  if (res.status === 401 && !opts.skipAuth && _refreshToken) {
    try {
      const newToken = await refreshOnce();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    } catch {
      if (typeof window !== 'undefined') {
        // Clear persisted auth so login page doesn't redirect in a loop
        try { localStorage.removeItem('qps-auth-v1'); } catch {}
        document.cookie = 'auth_token=; path=/; max-age=0';
        window.location.href = '/login';
      }
      throw new ApiError(401, { message: 'Session expired' });
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, data as Record<string, unknown>);
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json();
  // Unwrap NestJS TransformInterceptor envelope: { success, data, timestamp }
  return (json?.data !== undefined ? json.data : json) as T;
}

export const api = {
  get: <T = unknown>(path: string, opts?: RequestOpts) =>
    request<T>('GET', path, undefined, opts),
  post: <T = unknown>(path: string, body?: unknown, opts?: RequestOpts) =>
    request<T>('POST', path, body, opts),
  patch: <T = unknown>(path: string, body?: unknown, opts?: RequestOpts) =>
    request<T>('PATCH', path, body, opts),
  put: <T = unknown>(path: string, body?: unknown, opts?: RequestOpts) =>
    request<T>('PUT', path, body, opts),
  delete: <T = unknown>(path: string, opts?: RequestOpts) =>
    request<T>('DELETE', path, undefined, opts),
  upload: <T = unknown>(path: string, form: FormData) =>
    request<T>('POST', path, form, { isFormData: true }),
};
