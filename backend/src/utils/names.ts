export function normalizePersonName(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return null;
  }

  return compact
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

export function coalescePersonName(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = normalizePersonName(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}