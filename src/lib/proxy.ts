export function copySetCookie(source: Response, target: Headers): void {
  const headersWithCookies = source.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = typeof headersWithCookies.getSetCookie === 'function'
    ? headersWithCookies.getSetCookie()
    : splitSetCookie(source.headers.get('set-cookie'));

  cookies.forEach((cookie) => {
    target.append('set-cookie', cookie);
  });
}

export function splitSetCookie(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value.split(/,(?=\s*[^;,]+=)/g).map((cookie) => cookie.trim()).filter(Boolean);
}

export async function proxyJsonResponse(response: Response): Promise<Response> {
  const headers = new Headers({
    'content-type': response.headers.get('content-type') || 'application/json',
  });
  copySetCookie(response, headers);

  return new Response(await response.text(), {
    status: response.status,
    headers,
  });
}
