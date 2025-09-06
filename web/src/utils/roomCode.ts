export function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function normalizeRoomCode(input: string): string {
  return input.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
}

export function formatRoomCode(code: string): string {
  const clean = normalizeRoomCode(code);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}
