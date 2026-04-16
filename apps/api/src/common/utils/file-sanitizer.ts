const INVALID_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g;

export function sanitizeFilename(rawName: string): string {
  const normalized = rawName
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'file';

  const collapsedDots = normalized.replace(/\.\.+/g, '.');
  const stripped = collapsedDots.replace(INVALID_FILENAME_CHARS, '_');
  const noLeadingDots = stripped.replace(/^\.+/, '');
  const safe = noLeadingDots.trim().slice(0, 120);

  return safe || 'file';
}
