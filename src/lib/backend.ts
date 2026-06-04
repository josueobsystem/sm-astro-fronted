import { getWorkerCfAuthorizationToken, type EnvLike } from './config';
import { fetchWithTimeout } from './fetch';

const WORKER_CF_HEADER_NAME = 'X-AUTORIZATION-WORKER-CF';

export function buildBackendHeaders(env?: EnvLike, headersInit: HeadersInit = {}): Headers {
  const headers = new Headers(headersInit);
  const token = getWorkerCfAuthorizationToken(env);

  if (token) {
    headers.set(WORKER_CF_HEADER_NAME, token);
  }

  return headers;
}

export function fetchBackend(
  input: RequestInfo | URL,
  env?: EnvLike,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: buildBackendHeaders(env, init.headers || {}),
  });
}

export function fetchBackendWithTimeout(
  input: RequestInfo | URL,
  env?: EnvLike,
  init: RequestInit = {},
  timeoutMs?: number,
): Promise<Response> {
  return fetchWithTimeout(
    input,
    {
      ...init,
      headers: buildBackendHeaders(env, init.headers || {}),
    },
    timeoutMs,
  );
}
