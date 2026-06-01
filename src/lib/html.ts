const BLOCKED_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'noscript',
];

function stripBlockedTags(value: string): string {
  return BLOCKED_TAGS.reduce((html, tag) => {
    const withContent = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    const standalone = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');

    return html.replace(withContent, '').replace(standalone, '');
  }, value);
}

export function sanitizeEventHtml(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  let safe = String(value);

  safe = safe.replace(/<!--[\s\S]*?-->/g, '');
  safe = stripBlockedTags(safe);

  // Remove inline handlers and inline CSS so event descriptions cannot alter global UI.
  safe = safe.replace(/\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');
  safe = safe.replace(/\s+style\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');

  // Block script/data urls in links or images.
  safe = safe.replace(/\s+(href|src)\s*=\s*(['"])\s*(javascript:|data:text\/html)[^'"]*\2/gi, '');
  safe = safe.replace(/\s+(href|src)\s*=\s*(javascript:[^\s>]+|data:text\/html[^\s>]+)/gi, '');

  return safe;
}
