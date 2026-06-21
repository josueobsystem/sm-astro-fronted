import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { sanitizeRedirect } from '@/lib/auth';
import { fetchBackend } from '@/lib/backend';
import { getApiBaseUrl } from '@/lib/config';
import { copySetCookie } from '@/lib/proxy';

export const GET: APIRoute = async ({ request, url }) => {
  const redirect = sanitizeRedirect(url.searchParams.get('redirect'));
  const upstream = new URL(`${getApiBaseUrl(env)}/api/auth/google`);
  upstream.searchParams.set('redirect', redirect);

  const response = await fetchBackend(upstream, env, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Cookie: request.headers.get('cookie') || '',
    },
    redirect: 'manual',
  });

  const location = response.headers.get('location');
  const headers = new Headers();
  copySetCookie(response, headers);

  if (location) {
    headers.set('location', location);

    return new Response(null, {
      status: response.status >= 300 && response.status < 400 ? response.status : 302,
      headers,
    });
  }

  const contentType = response.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  return new Response(await response.text(), {
    status: response.status,
    headers,
  });
};
