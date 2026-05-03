export function countryFlagEmoji(code?: string | null): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  const cc = code.toUpperCase();
  return String.fromCodePoint(
    A + cc.charCodeAt(0) - 65,
    A + cc.charCodeAt(1) - 65,
  );
}

export function CountryFlag({
  code,
  name,
}: {
  code?: string | null;
  name?: string | null;
}) {
  const flag = countryFlagEmoji(code);
  return (
    <span className="inline-flex items-center gap-1.5">
      {flag && (
        <span className="text-base leading-none" aria-hidden>
          {flag}
        </span>
      )}
      <span>{name ?? "—"}</span>
    </span>
  );
}
