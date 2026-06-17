import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { shouldIndexRequestHost } from '@/lib/config';

export const GET: APIRoute = ({ url }) => {
  const shouldIndex = shouldIndexRequestHost(url, env);

  if (!shouldIndex) {
    return new Response('User-agent: *\nDisallow: /\n', {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }

  return new Response('User-agent: *\nAllow: /\n', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
};
