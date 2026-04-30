'use client';

/**
 * Avatar - WhatsApp-style colored circle with initials.
 *
 * Color is deterministic per name so the same person always gets the
 * same color across sessions and devices. We use a small palette of
 * pleasant, accessible colors (good contrast against white text).
 */

const PALETTE = [
  '#dd6b20', // orange
  '#d53f8c', // pink
  '#9333ea', // purple
  '#2563eb', // blue
  '#0891b2', // cyan
  '#10b981', // emerald
  '#65a30d', // lime
  '#ca8a04', // amber
  '#dc2626', // red
];

/** Hash a string to one of the palette colors. djb2 is fast and stable
 *  enough for this — we just need consistency, not crypto. */
function colorForName(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) + name.charCodeAt(i);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Pull initials. For RTL Hebrew names, just take the first non-space char.
 *  Two-word names get both initials (so "שני כהן" → "שכ"). */
function initialsForName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0);
  return parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
}

export default function Avatar({
  name,
  size = 40,
  className = '',
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const safeName = name || '?';
  const bg = colorForName(safeName);
  const initials = initialsForName(safeName);

  return (
    <div
      className={`rounded-full grid place-items-center text-white font-semibold shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.4,
      }}
      aria-label={`${safeName} avatar`}
    >
      {initials}
    </div>
  );
}
