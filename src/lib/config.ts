export type EnvLike = Record<string, string | undefined> | undefined;

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizedOrigin(url: URL): string {
  return `${url.protocol}//${url.host}`.toLowerCase();
}

export function getApiBaseUrl(env?: EnvLike): string {
  const runtimeUrl = env?.PUBLIC_API_BASE_URL;
  const buildUrl = import.meta.env.PUBLIC_API_BASE_URL;

  return normalizeUrl(String(runtimeUrl || buildUrl || 'http://localhost:8001'));
}

export function getBackendApiUrl(path: string, env?: EnvLike): URL {
  const baseUrl = new URL(`${getApiBaseUrl(env)}/`);
  const endpointUrl = new URL(path.startsWith('/') ? path : `/${path}`, 'http://internal.local');
  const basePath = baseUrl.pathname.replace(/\/+$/, '');
  let endpointPath = endpointUrl.pathname;

  if (basePath.endsWith('/api') && endpointPath.startsWith('/api/')) {
    endpointPath = endpointPath.slice('/api'.length);
  }

  baseUrl.pathname = `${basePath}${endpointPath}`.replace(/\/{2,}/g, '/') || '/';
  baseUrl.search = endpointUrl.search;
  baseUrl.hash = endpointUrl.hash;

  return baseUrl;
}

export function getPublicSiteUrl(env?: EnvLike): string {
  const runtimeUrl = env?.PUBLIC_SITE_URL;
  const buildUrl = import.meta.env.PUBLIC_SITE_URL;

  return normalizeUrl(String(runtimeUrl || buildUrl || 'http://localhost:4321'));
}

export function getIndexableSiteUrl(env?: EnvLike): string {
  const runtimeUrl = env?.PUBLIC_INDEXABLE_SITE_URL;
  const buildUrl = import.meta.env.PUBLIC_INDEXABLE_SITE_URL;

  return normalizeUrl(String(runtimeUrl || buildUrl || 'https://soniamorales.pe'));
}

export function getNiubizCheckoutUrl(env?: EnvLike): string {
  const runtimeUrl = env?.PUBLIC_NIUBIZ_CHECKOUT_JS_URL;
  const buildUrl = import.meta.env.PUBLIC_NIUBIZ_CHECKOUT_JS_URL;

  return String(
    runtimeUrl || buildUrl || 'https://static-content-qas.vnforapps.com/env/sandbox/js/checkout.js',
  );
}

export function shouldIndexRequestHost(requestUrl: URL, env?: EnvLike): boolean {
  const indexableSiteUrl = safeUrl(getIndexableSiteUrl(env));
  if (!indexableSiteUrl) {
    return false;
  }

  return normalizedOrigin(requestUrl) === normalizedOrigin(indexableSiteUrl);
}
