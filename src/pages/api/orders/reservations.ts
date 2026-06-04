import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuthStatus } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/config';
import { fetchBackend } from '@/lib/backend';
import { proxyJsonResponse } from '@/lib/proxy';

export const POST: APIRoute = async ({ request }) => {
  const authStatus = await getAuthStatus(request, env);

  if (!authStatus.authenticated) {
    return Response.json({
      status: 'error',
      message: 'Debes iniciar sesión para reservar entradas.',
      data: null,
    }, { status: 401 });
  }

  const response = await fetchBackend(`${getApiBaseUrl(env)}/api/orders/reservations`, env, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': request.headers.get('content-type') || 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
    body: await request.text(),
  });

  return proxyJsonResponse(response);
};
