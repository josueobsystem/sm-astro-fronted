# SM Astro Frontend

Frontend SSR separado del backend Laravel/Inertia.

## Stack

- Astro 6 con `output: "server"`
- Vue 3 para islas interactivas
- Adapter `@astrojs/cloudflare` para Cloudflare Workers
- Comunicación con Laravel por API JSON

## Desarrollo

```bash
npm install
cp .env.example .env
npm run dev
```

Variables principales:

```bash
PUBLIC_API_BASE_URL=http://localhost:8001
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_NIUBIZ_CHECKOUT_JS_URL=https://static-content-qas.vnforapps.com/env/sandbox/js/checkout.js
```

## Deploy Cloudflare Workers

```bash
npm run deploy
```

El `wrangler.jsonc` usa el entrypoint recomendado para Astro 6:

```jsonc
"main": "@astrojs/cloudflare/entrypoints/server"
```

## Endpoints Laravel usados

- `GET /api/public/home`
- `GET /api/public/events/{slug}`
- `POST /api/orders/reservations`
- `GET /api/orders/reservations/{id}`
- `POST /api/orders/checkout/session`
- `GET /api/orders/checkout/success`
# sm-astro-fronted
# sm-astro-fronted
