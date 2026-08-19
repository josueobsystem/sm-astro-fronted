import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { bearerHeadersFromRequest } from '@/lib/auth-session';
import { fetchBackend } from '@/lib/backend';
import { getBackendApiUrl } from '@/lib/config';

type PaymentResult = {
  actionDescription?: string;
  status?: string;
  transactionDate?: string;
  amount?: string;
  currency?: string;
  card?: string;
  brand?: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];

    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return undefined;
}

function parsePaymentResult(body: string): PaymentResult | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    const root = record(parsed);
    const envelopeData = root ? record(root.data) : null;
    const sources = [
      root ? record(root.dataMap) : null,
      envelopeData ? record(envelopeData.dataMap) : null,
      envelopeData ? record(envelopeData.data) : null,
      envelopeData,
      root,
    ].filter((value): value is Record<string, unknown> => Boolean(value));
    const source = sources.find((value) => Boolean(
      pickString(value, ['ACTION_DESCRIPTION', 'action_description']),
    ));

    if (!source) {
      return null;
    }

    const actionDescription = pickString(source, ['ACTION_DESCRIPTION', 'action_description']);

    return actionDescription ? {
      actionDescription,
      status: pickString(source, ['STATUS', 'status']),
      transactionDate: pickString(source, ['TRANSACTION_DATE', 'transaction_date']),
      amount: pickString(source, ['AMOUNT', 'amount']),
      currency: pickString(source, ['CURRENCY', 'currency']),
      card: pickString(source, ['CARD', 'card']),
      brand: pickString(source, ['BRAND', 'brand']),
    } : null;
  } catch {
    return null;
  }
}

function resultUrl(request: Request, payment: PaymentResult | null): URL {
  const requestUrl = new URL(request.url);
  const fallback = new URL('/checkout/success', requestUrl.origin);
  const value = requestUrl.searchParams.get('frontend_success_url');

  if (!value) {
    return fallback;
  }

  try {
    const url = new URL(value);

    // El parámetro se creó al iniciar el checkout. Aun así, se valida para que
    // este endpoint no pueda utilizarse como un redirect abierto.
    if (url.origin !== requestUrl.origin) {
      return fallback;
    }

    if (payment?.actionDescription) {
      // Se conserva la descripción de Niubiz para mostrarla una sola vez en la
      // parte superior del resultado, sin recrear el bloque de motivo inferior.
      url.searchParams.set('payment_status', payment.status || 'denied');
      url.searchParams.set('payment_message', payment.actionDescription);
      url.searchParams.set('payment_transaction_date', payment.transactionDate || '');
      url.searchParams.set('payment_amount', payment.amount || '');
      url.searchParams.set('payment_currency', payment.currency || '');
      url.searchParams.set('payment_card', payment.card || '');
      url.searchParams.set('payment_brand', payment.brand || '');
    }

    return url;
  } catch {
    return fallback;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const backendUrl = getBackendApiUrl('/api/orders/checkout/confirm', env);
  backendUrl.search = new URL(request.url).search;
  const contentType = request.headers.get('content-type');

  // Niubiz envía un POST de formulario. Se conserva el cuerpo sin intentar
  // interpretarlo para que el backend reciba exactamente la respuesta firmada.
  let payment: PaymentResult | null = null;

  try {
    const response = await fetchBackend(backendUrl, env, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        ...(contentType ? { 'Content-Type': contentType } : {}),
        ...bearerHeadersFromRequest(request),
      },
      body: await request.arrayBuffer(),
    });
    payment = parsePaymentResult(await response.text());
  } catch {
    // La pantalla de resultado consulta el estado final de la transacción y
    // mostrará el error si el backend no pudo confirmar el pago.
  }

  return Response.redirect(resultUrl(request, payment), 303);
};
