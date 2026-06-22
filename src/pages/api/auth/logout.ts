import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { fetchBackend } from '@/lib/backend';
import { readClientToken, serializeClearedClientTokenCookie } from '@/lib/auth-session';

export const POST: APIRoute = async ({ request, url }) => {
  const token = readClientToken(request);
  const headers = new Headers({
    'content-type': 'application/json',
  });
  headers.append('set-cookie', serializeClearedClientTokenCookie(url));

  if (!token) {
    return new Response(JSON.stringify({
      status: 'success',
      message: 'Successfully logged out',
      data: null,
    }), { status: 200, headers });
  }

  const response = await fetchBackend(`${getApiBaseUrl(env)}/api/client-auth/logout`, env, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return new Response(await response.text(), {
    status: response.status,
    headers,
  });
};
