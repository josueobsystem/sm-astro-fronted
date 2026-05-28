type EnvLike = Record<string, string | undefined> | undefined;

export function getApiBaseUrl(env?: EnvLike): string {
  const runtimeUrl = env?.PUBLIC_API_BASE_URL;
  const buildUrl = import.meta.env.PUBLIC_API_BASE_URL;

  return String(runtimeUrl || buildUrl || 'http://localhost:8001').replace(/\/+$/, '');
}

export function getPublicSiteUrl(env?: EnvLike): string {
  const runtimeUrl = env?.PUBLIC_SITE_URL;
  const buildUrl = import.meta.env.PUBLIC_SITE_URL;

  return String(runtimeUrl || buildUrl || 'http://localhost:4321').replace(/\/+$/, '');
}

export function getNiubizCheckoutUrl(env?: EnvLike): string {
  const runtimeUrl = env?.PUBLIC_NIUBIZ_CHECKOUT_JS_URL;
  const buildUrl = import.meta.env.PUBLIC_NIUBIZ_CHECKOUT_JS_URL;

  return String(
    runtimeUrl || buildUrl || 'https://static-content-qas.vnforapps.com/env/sandbox/js/checkout.js',
  );
}
