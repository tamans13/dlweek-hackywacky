export function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function fromSlugMatch<T extends string>(slug: string, values: T[]) {
  return values.find((value) => toSlug(value) === slug) || null;
}

export function toTitle(value: string) {
  if (!value) return value;
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
