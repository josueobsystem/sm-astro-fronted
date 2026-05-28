import { getApiBaseUrl } from './config';
import { fetchWithTimeout } from './fetch';

type RuntimeEnv = Parameters<typeof getApiBaseUrl>[0];

export type AuthStatus = {
  authenticated: boolean;
  user_id: string | number | null;
  csrf_token?: string | null;
  user?: AuthUser | null;
  actor_type?: 'client' | 'user' | null;
  permissions?: string[];
  roles?: string[];
  is_admin?: boolean;
};

export type AuthUser = {
  id: string | number;
  name: string;
  email: string;
  profile_photo_url?: string | null;
  person?: {
    id?: string | number | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    document_type?: string | null;
    document_number?: string | null;
  } | null;
};

export async function getAuthStatus(request: Request, env?: RuntimeEnv): Promise<AuthStatus> {
  const cookie = request.headers.get('cookie') || '';

  if (!cookie) {
    return { authenticated: false, user_id: null };
  }

  try {
    const response = await fetchWithTimeout(`${getApiBaseUrl(env)}/auth-status`, {
      headers: {
        Accept: 'application/json',
        Cookie: cookie,
      },
    });

    if (!response.ok) {
      return { authenticated: false, user_id: null };
    }

    const payload = await response.json() as Partial<AuthStatus>;

    return {
      authenticated: Boolean(payload.authenticated),
      user_id: payload.user_id ?? null,
      csrf_token: payload.csrf_token ?? null,
      user: payload.user ?? null,
      actor_type: payload.actor_type ?? null,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      is_admin: Boolean(payload.is_admin),
    };
  } catch {
    return { authenticated: false, user_id: null };
  }
}

export function sanitizeRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
}

export function loginUrlFor(url: URL): string {
  const redirect = `${url.pathname}${url.search}`;

  return `/login?redirect=${encodeURIComponent(redirect)}`;
}
