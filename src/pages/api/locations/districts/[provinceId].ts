import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { proxyJsonResponse } from '@/lib/proxy';

export const GET: APIRoute = async ({ params, request }) => {
  const provinceId = String(params.provinceId || '').trim();

  if (!provinceId) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'provinceId es requerido.',
      data: null,
    }), {
      status: 400,
      headers: {
        'content-type': 'application/json',
      },
    });
  }

  const response = await fetch(`${getApiBaseUrl(env)}/api/locations/districts/${encodeURIComponent(provinceId)}`, {
    headers: {
      Accept: 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
  });

  return proxyJsonResponse(response);
};
