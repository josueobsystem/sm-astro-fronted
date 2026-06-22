import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  return Response.json({
    status: 'error',
    message: 'El cambio de contraseña debe configurarse como API con token y enlace hacia Astro.',
    data: null,
  }, { status: 501 });
};
