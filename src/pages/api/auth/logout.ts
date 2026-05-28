import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { proxyJsonResponse } from '@/lib/proxy';

export const POST: APIRoute = async ({ request }) => {
  const apiBaseUrl = getApiBaseUrl(env);
  const cookie = request.headers.get('cookie') || '';

  const csrfResponse = await fetch(`${apiBaseUrl}/csrf-token`, {
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
    },
  });
  const csrfPayload = await csrfResponse.json().catch(() => ({ token: '' })) as { token?: string };

  const response = await fetch(`${apiBaseUrl}/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-CSRF-TOKEN': csrfPayload.token || '',
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: cookie,
    },
  });

  return proxyJsonResponse(response);
};
