// T1Dine shared design system — one source of truth for colour, spacing,
// type, radii, shadows, and the "Tino" mascot. Framework-agnostic (plain
// values + an SVG string) so mobile (React Native) and the admin/web app can
// both consume it. No relative imports here, so it bundles cleanly in Metro
// and webpack.

export const colors = {
  // Brand — emerald, matching the mascot.
  brand: "#0E9F6E",
  brandDark: "#0B7F58",
  brandDeep: "#075E45",
  brandSoft: "#E7F8F1",
  brandTint: "#F0FBF6",
  onBrand: "#FFFFFF",

  // Warm accent.
  accent: "#F59E0B",
  accentSoft: "#FEF3E2",

  // Neutrals.
  bg: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  text: "#0F172A",
  textMuted: "#64748B",
  textSubtle: "#94A3B8",
  border: "#E5E9EF",
  borderStrong: "#CBD5E1",

  // Dark surfaces (splash / headers).
  ink: "#0B1220",
  inkSoft: "#111C2E",

  // Confidence — always paired with an icon + text, never colour alone.
  confidenceHigh: "#15803D",
  confidenceHighBg: "#E7F6EC",
  confidenceMedium: "#B45309",
  confidenceMediumBg: "#FBF0DE",
  confidenceLow: "#C2410C",
  confidenceLowBg: "#FDE8DC",
  confidenceUnverified: "#B91C1C",
  confidenceUnverifiedBg: "#FCE9E9",

  // Semantic.
  success: "#15803D",
  warning: "#B45309",
  danger: "#B91C1C",
  info: "#0E7490",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const fontSize = { xs: 12, sm: 13, base: 15, md: 17, lg: 20, xl: 26, xxl: 32, display: 40 } as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

/** Cross-platform shadow tokens. `web` is a CSS box-shadow; `native` are RN props. */
export const shadow = {
  card: {
    web: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)",
    native: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  },
  floating: {
    web: "0 8px 24px rgba(15,23,42,0.12)",
    native: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 8 },
  },
} as const;

export const MASCOT_NAME = "Tino";

/**
 * The "Tino" mascot as inline SVG markup (viewBox 0 0 240 240).
 * - Mobile: render with react-native-svg's `SvgXml` (pass width/height props).
 * - Web: inject with dangerouslySetInnerHTML, sized via a wrapper, or pass a size here.
 * A `mono` variant (single-colour silhouette) is provided for tight/monochrome spots.
 */
export function mascotSvg(options?: { size?: number; mono?: string }): string {
  const size = options?.size;
  const dims = size ? `width="${size}" height="${size}" ` : "";
  if (options?.mono) {
    const c = options.mono;
    return `<svg ${dims}viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tino, mascote do T1Dine">` +
      `<path d="M120 58 C178 58 198 104 198 140 C198 188 165 216 120 216 C75 216 42 188 42 140 C42 104 62 58 120 58 Z" fill="${c}"/>` +
      `<path d="M119 44 C103 28 80 28 71 37 C84 56 107 55 119 44 Z" fill="${c}"/>` +
      `<path d="M121 50 C137 32 160 33 169 42 C156 61 133 59 121 50 Z" fill="${c}"/>` +
      `<g fill="#FFFFFF"><ellipse cx="98" cy="134" rx="9" ry="11"/><ellipse cx="142" cy="134" rx="9" ry="11"/>` +
      `<path d="M103 162 C112 174 128 174 137 162" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" fill="none"/></g></svg>`;
  }
  return `<svg ${dims}viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tino, mascote do T1Dine">
  <defs>
    <linearGradient id="tinoBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5BE49B"/><stop offset="1" stop-color="#0E9F6E"/></linearGradient>
    <linearGradient id="tinoLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#059669"/></linearGradient>
    <radialGradient id="tinoBelly" cx="0.5" cy="0.4" r="0.62"><stop offset="0" stop-color="#ECFDF5" stop-opacity="0.92"/><stop offset="0.7" stop-color="#ECFDF5" stop-opacity="0.25"/><stop offset="1" stop-color="#ECFDF5" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="120" cy="214" rx="60" ry="11" fill="#0F172A" opacity="0.12"/>
  <path d="M120 62 C120 42 120 30 120 22" stroke="#0B8F63" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M119 44 C103 28 80 28 71 37 C84 56 107 55 119 44 Z" fill="url(#tinoLeaf)"/>
  <path d="M121 50 C137 32 160 33 169 42 C156 61 133 59 121 50 Z" fill="url(#tinoLeaf)" opacity="0.96"/>
  <path d="M120 58 C178 58 198 104 198 140 C198 188 165 216 120 216 C75 216 42 188 42 140 C42 104 62 58 120 58 Z" fill="url(#tinoBody)"/>
  <ellipse cx="120" cy="152" rx="70" ry="62" fill="url(#tinoBelly)"/>
  <ellipse cx="80" cy="156" rx="13" ry="9" fill="#FB7185" opacity="0.5"/>
  <ellipse cx="160" cy="156" rx="13" ry="9" fill="#FB7185" opacity="0.5"/>
  <g fill="#0F172A"><ellipse cx="98" cy="134" rx="10" ry="12.5"/><ellipse cx="142" cy="134" rx="10" ry="12.5"/></g>
  <g fill="#FFFFFF"><circle cx="101" cy="129" r="3.5"/><circle cx="145" cy="129" r="3.5"/></g>
  <path d="M103 162 C112 175 128 175 137 162" stroke="#0F172A" stroke-width="6" stroke-linecap="round" fill="none"/>
  <ellipse cx="99" cy="214" rx="12" ry="7" fill="#0B7F58"/>
  <ellipse cx="141" cy="214" rx="12" ry="7" fill="#0B7F58"/>
</svg>`;
}

/** Default full-colour mascot markup (unsized; caller controls dimensions). */
export const MASCOT_SVG = mascotSvg();
