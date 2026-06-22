import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  return Response.json({
    status: 'error',
    message: 'La recuperación de contraseña debe configurarse como API con enlace hacia Astro.',
    data: null,
  }, { status: 501 });
};
