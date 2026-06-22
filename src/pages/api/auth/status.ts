import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuthStatus } from '@/lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const status = await getAuthStatus(request, env);

  return Response.json(status);
};
