import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { fetchBackendWithTimeout } from '@/lib/backend';
import { proxyJsonResponse } from '@/lib/proxy';

export const GET: APIRoute = async ({ request }) => {
  const response = await fetchBackendWithTimeout(`${getApiBaseUrl(env)}/auth-status`, env, {
    headers: {
      Accept: 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
  });

  return proxyJsonResponse(response);
};
