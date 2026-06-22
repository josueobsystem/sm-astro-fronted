export const CLIENT_TOKEN_COOKIE = 'sm_client_token';

const TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

export function readClientToken(request: Request): string {
  const cookieHeader = request.headers.get('cookie') || '';
  const encodedToken = cookieHeader
    .split(';')
    .map((segment) => segment.trim())
    .map((segment) => {
      const separatorIndex = segment.indexOf('=');

      return separatorIndex === -1
        ? [segment, '']
        : [segment.slice(0, separatorIndex), segment.slice(separatorIndex + 1)];
    })
    .find(([name]) => name === CLIENT_TOKEN_COOKIE)?.[1] || '';

  try {
    return decodeURIComponent(encodedToken);
  } catch {
    return encodedToken;
  }
}

export function bearerHeadersFromRequest(request: Request): HeadersInit {
  const token = readClientToken(request);

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function serializeClientTokenCookie(token: string, url: URL): string {
  return serializeCookie(CLIENT_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE,
  });
}

export function serializeClearedClientTokenCookie(url: URL): string {
  return serializeCookie(CLIENT_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  });
}

export function accessTokenFromAuthBody(body: string): string {
  try {
    const payload = JSON.parse(body || '{}') as { data?: { access_token?: string } };

    return payload.data?.access_token || '';
  } catch {
    return '';
  }
}

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
  path: string;
  maxAge: number;
};

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
  ];

  if (options.httpOnly) {
    segments.push('HttpOnly');
  }

  if (options.secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
}
