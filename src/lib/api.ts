import { getApiBaseUrl } from './config';
import type { ApiEnvelope } from '@/types/api';

type RuntimeLocals = Parameters<typeof getApiBaseUrl>[0];

export type ApiResult<T> =
  | { ok: true; data: T; message: string | null }
  | { ok: false; status: number; message: string; validations?: Record<string, unknown> };

export async function apiGet<T>(
  path: string,
  env?: RuntimeLocals,
  search?: Record<string, string | number | boolean | null | undefined>,
): Promise<ApiResult<T>> {
  const url = new URL(path, getApiBaseUrl(env));

  Object.entries(search ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
    const envelope = (await response.json()) as ApiEnvelope<T>;

    if (!response.ok || envelope.status === 'error') {
      return {
        ok: false,
        status: response.status,
        message: envelope.message || 'No pudimos obtener la información solicitada.',
        validations: envelope.validations,
      };
    }

    return {
      ok: true,
      data: envelope.data as T,
      message: envelope.message,
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      message: error instanceof Error ? error.message : 'API no disponible.',
    };
  }
}

export function formatMoney(value: number | string | null | undefined, currency = 'S/'): string {
  const amount = Number(value || 0);

  return `${currency} ${amount.toFixed(2)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Por confirmar';
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}
