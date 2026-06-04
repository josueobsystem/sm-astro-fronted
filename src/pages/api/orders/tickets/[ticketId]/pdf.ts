import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getApiBaseUrl } from '@/lib/config';
import { fetchBackend } from '@/lib/backend';
import { copySetCookie } from '@/lib/proxy';

export const GET: APIRoute = async ({ params, request }) => {
  const ticketId = encodeURIComponent(params.ticketId || '');
  const response = await fetchBackend(`${getApiBaseUrl(env)}/api/orders/tickets/${ticketId}/pdf`, env, {
    headers: {
      Accept: request.headers.get('accept') || 'application/pdf',
      Cookie: request.headers.get('cookie') || '',
    },
  });

  const headers = new Headers();
  const contentType = response.headers.get('content-type');
  const contentDisposition = response.headers.get('content-disposition');

  if (contentType) {
    headers.set('content-type', contentType);
  }

  if (contentDisposition) {
    headers.set('content-disposition', contentDisposition);
  }

  copySetCookie(response, headers);

  return new Response(response.body, {
    status: response.status,
    headers,
  });
};
