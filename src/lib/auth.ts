import { getApiBaseUrl } from './config';
import { fetchBackendWithTimeout } from './backend';
import { readClientToken } from './auth-session';

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
  const token = readClientToken(request);

  if (!token) {
    return { authenticated: false, user_id: null };
  }

  try {
    const response = await fetchBackendWithTimeout(`${getApiBaseUrl(env)}/api/client-auth/me`, env, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { authenticated: false, user_id: null };
    }

    const payload = await response.json() as {
      data?: Partial<AuthStatus>;
    } & Partial<AuthStatus>;
    const data = payload.data || payload;
    const user = data.user ?? null;

    return {
      authenticated: true,
      user_id: data.user_id ?? user?.id ?? null,
      csrf_token: null,
      user,
      actor_type: data.actor_type ?? null,
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      roles: Array.isArray(data.roles) ? data.roles : [],
      is_admin: Boolean(data.is_admin),
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
