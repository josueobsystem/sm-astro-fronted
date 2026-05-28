import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetch';
import { proxyJsonResponse } from '@/lib/proxy';

export const GET: APIRoute = async ({ request }) => {
  const response = await fetchWithTimeout(`${getApiBaseUrl(env)}/auth-status`, {
    headers: {
      Accept: 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
  });

  return proxyJsonResponse(response);
};
