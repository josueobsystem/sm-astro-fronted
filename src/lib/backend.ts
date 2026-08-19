import { type EnvLike } from './config';
import { fetchWithTimeout } from './fetch';

export function buildBackendHeaders(headersInit: HeadersInit = {}): Headers {
  return new Headers(headersInit);
}

export function fetchBackend(
  input: RequestInfo | URL,
  _env?: EnvLike,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: buildBackendHeaders(init.headers || {}),
  });
}

export function fetchBackendWithTimeout(
  input: RequestInfo | URL,
  _env?: EnvLike,
  init: RequestInit = {},
  timeoutMs?: number,
): Promise<Response> {
  return fetchWithTimeout(
    input,
    {
      ...init,
      headers: buildBackendHeaders(init.headers || {}),
    },
    timeoutMs,
  );
}
