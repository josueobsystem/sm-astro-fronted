import { getApiBaseUrl } from './config';
import { fetchBackendWithTimeout } from './backend';
import type { ApiEnvelope } from '@/types/api';

type RuntimeLocals = Parameters<typeof getApiBaseUrl>[0];

export type ApiResult<T> =
  | { ok: true; data: T; message: string | null }
  | { ok: false; status: number; message: string; validations?: Record<string, unknown> };

function isLocalApiUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();

  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function shortText(value: string, max = 180): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max)}...`;
}

export async function apiGet<T>(
  path: string,
  env?: RuntimeLocals,
  search?: Record<string, string | number | boolean | null | undefined>,
): Promise<ApiResult<T>> {
  const baseUrl = getApiBaseUrl(env);

  if (!import.meta.env.DEV && isLocalApiUrl(baseUrl)) {
    return {
      ok: false,
      status: 503,
      message:
        'Configuración inválida: PUBLIC_API_BASE_URL apunta a localhost. En Cloudflare Workers debes usar el dominio público de tu backend.',
    };
  }

  const url = new URL(path, baseUrl);

  Object.entries(search ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  try {
    const response = await fetchBackendWithTimeout(url, env, {
      headers: {
        Accept: 'application/json',
      },
    });
    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();
    const canParseJson = contentType.includes('application/json') || looksLikeJson(rawBody);

    if (!canParseJson) {
      return {
        ok: false,
        status: response.status || 502,
        message: `La API respondió un formato no JSON: ${shortText(rawBody || 'respuesta vacía')}`,
      };
    }

    let envelope: ApiEnvelope<T>;
    try {
      envelope = JSON.parse(rawBody) as ApiEnvelope<T>;
    } catch {
      return {
        ok: false,
        status: response.status || 502,
        message: `No se pudo interpretar la respuesta JSON de la API: ${shortText(rawBody || 'respuesta vacía')}`,
      };
    }

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
