import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetch';
import { proxyJsonResponse } from '@/lib/proxy';

export const GET: APIRoute = async ({ url }) => {
  const upstream = new URL(`${getApiBaseUrl(env)}/api/public/home`);

  url.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  const response = await fetchWithTimeout(upstream, {
    headers: {
      Accept: 'application/json',
    },
  });

  return proxyJsonResponse(response);
};
