/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_BASE_URL?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_NIUBIZ_CHECKOUT_JS_URL?: string;
  readonly WORKER_CF_AUTHORIZATION_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'cloudflare:workers' {
  export const env: Record<string, string | undefined>;
}
