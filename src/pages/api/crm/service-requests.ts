import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { fetchBackend } from '@/lib/backend';
import { proxyJsonResponse } from '@/lib/proxy';

export const POST: APIRoute = async ({ request }) => {
  const response = await fetchBackend(`${getApiBaseUrl(env)}/api/crm/service-requests`, env, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': request.headers.get('content-type') || 'application/json',
      'X-CSRF-TOKEN': request.headers.get('x-csrf-token') || '',
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: request.headers.get('cookie') || '',
    },
    body: await request.text(),
  });

  return proxyJsonResponse(response);
};
