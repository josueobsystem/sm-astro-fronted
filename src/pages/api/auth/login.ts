import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { fetchBackend } from '@/lib/backend';
import { accessTokenFromAuthBody, serializeClientTokenCookie } from '@/lib/auth-session';

export const POST: APIRoute = async ({ request, url }) => {
  const response = await fetchBackend(`${getApiBaseUrl(env)}/api/client-auth/login`, env, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': request.headers.get('content-type') || 'application/json',
    },
    body: await request.text(),
  });

  const body = await response.text();
  const headers = new Headers({
    'content-type': response.headers.get('content-type') || 'application/json',
  });

  if (response.ok) {
    const token = accessTokenFromAuthBody(body);

    if (token) {
      headers.append('set-cookie', serializeClientTokenCookie(token, url));
    }
  }

  return new Response(body, {
    status: response.status,
    headers,
  });
};
