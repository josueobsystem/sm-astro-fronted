import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuthStatus } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/config';
import { proxyJsonResponse } from '@/lib/proxy';

export const POST: APIRoute = async ({ request }) => {
  const authStatus = await getAuthStatus(request, env);

  if (!authStatus.authenticated) {
    return Response.json({
      status: 'error',
      message: 'Debes iniciar sesión para iniciar el pago.',
      data: null,
    }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({
      status: 'error',
      message: 'El cuerpo de la solicitud no es válido.',
      data: null,
    }, { status: 400 });
  }

  const personId = authStatus.user?.person?.id ? String(authStatus.user.person.id) : null;
  const response = await fetch(`${getApiBaseUrl(env)}/api/orders/checkout/session`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
    body: JSON.stringify({
      ...payload,
      customer_name: payload.customer_name || authStatus.user?.name || null,
      customer_email: payload.customer_email || authStatus.user?.email || null,
      customer_phone: payload.customer_phone || authStatus.user?.person?.phone || null,
      person_id: payload.person_id || personId,
    }),
  });

  return proxyJsonResponse(response);
};
