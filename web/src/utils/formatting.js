export function formatPersonName(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return fallback;
  }

  return compact
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

export function displayPersonName(primary, fallback = "", finalFallback = "Contributor") {
  return formatPersonName(primary, formatPersonName(fallback, finalFallback));
}