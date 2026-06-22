import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { fetchBackend } from '@/lib/backend';
import { proxyJsonResponse } from '@/lib/proxy';
import { bearerHeadersFromRequest } from '@/lib/auth-session';

export const POST: APIRoute = async ({ request }) => {
  const response = await fetchBackend(`${getApiBaseUrl(env)}/api/crm/service-requests`, env, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': request.headers.get('content-type') || 'application/json',
      ...bearerHeadersFromRequest(request),
    },
    body: await request.text(),
  });

  return proxyJsonResponse(response);
};
