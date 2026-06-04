import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { fetchBackend } from '@/lib/backend';
import { proxyJsonResponse } from '@/lib/proxy';

export const GET: APIRoute = async ({ request, url }) => {
  const upstream = new URL(`${getApiBaseUrl(env)}/client-portal`);
  const sessionId = url.searchParams.get('session_id');

  if (sessionId) {
    upstream.searchParams.set('session_id', sessionId);
  }

  const response = await fetchBackend(upstream, env, {
    headers: {
      Accept: 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
  });

  return proxyJsonResponse(response);
};
