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

  // v2 — premium surfaces & signature accents (additive; existing keys unchanged).
  brandGradientFrom: "#12B886",
  brandGradientTo: "#0B7F58",
  accentWarm: "#FB7185",
  accentCool: "#38BDF8",
  surfaceElevated: "#FFFFFF",
  surfaceSunken: "#EEF2F6",
  surfaceGlass: "rgba(255,255,255,0.72)",
  scrim: "rgba(11,18,32,0.55)",
  focusRing: "#5BE49B",
  hairline: "rgba(15,23,42,0.06)",
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

/**
 * Signature gradients (v2). Each carries a `web` CSS string for the admin/web
 * app and native `colors`/`start`/`end` stops for expo-linear-gradient on mobile.
 * Gradients are decorative only — never the sole carrier of meaning (a11y).
 */
export const gradients = {
  brand: {
    colors: ["#12B886", "#0E9F6E", "#0B7F58"],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    web: "linear-gradient(135deg, #12B886 0%, #0E9F6E 55%, #0B7F58 100%)",
  },
  ink: {
    colors: ["#12243B", "#0B1220"],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    web: "linear-gradient(160deg, #12243B 0%, #0B1220 100%)",
  },
  sunrise: {
    colors: ["#F59E0B", "#FB7185"],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    web: "linear-gradient(90deg, #F59E0B 0%, #FB7185 100%)",
  },
  mist: {
    colors: ["#F0FBF6", "#F5F7FA"],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    web: "linear-gradient(180deg, #F0FBF6 0%, #F5F7FA 100%)",
  },
} as const;

/**
 * Signature "Aurora" page background (v2). Two soft radial glows — cyan
 * top-right, emerald top-left — layered over the mist gradient. This
 * atmospheric wash is what the design system is named for. Framework-agnostic
 * data only: mobile renders `glows` as react-native-svg <RadialGradient>s over
 * the `gradients.mist` LinearGradient; the admin/web app can drop `web`
 * straight into a CSS `background`. Purely decorative — never a11y-meaningful.
 */
export const auroraBackground = {
  glows: [
    // cyan, top-right — matches `radial-gradient(... at 82% 8% ...)`.
    { color: "#38BDF8", opacity: 0.1, cx: "0.82", cy: "0.08", r: "0.6" },
    // emerald, top-left — matches `radial-gradient(... at 6% 4% ...)`.
    { color: "#0E9F6E", opacity: 0.12, cx: "0.06", cy: "0.04", r: "0.6" },
  ],
  web:
    "radial-gradient(60% 52% at 82% 8%, rgba(56,189,248,0.10), transparent 70%)," +
    "radial-gradient(58% 48% at 6% 4%, rgba(14,159,110,0.12), transparent 70%)," +
    "linear-gradient(180deg, #F0FBF6 0%, #F5F7FA 100%)",
} as const;

/** Elevation scale (v2) — web box-shadow + RN native props. `glow` is the brand halo. */
export const elevation = {
  xs: { web: "0 1px 2px rgba(15,23,42,0.05)", native: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 } },
  sm: { web: "0 2px 6px rgba(15,23,42,0.06)", native: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 } },
  md: { web: "0 8px 20px rgba(15,23,42,0.08)", native: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 } },
  lg: { web: "0 16px 40px rgba(15,23,42,0.14)", native: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 28, elevation: 10 } },
  glow: { web: "0 10px 34px rgba(14,159,110,0.30)", native: { shadowColor: "#0E9F6E", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.32, shadowRadius: 24, elevation: 9 } },
} as const;

/** Motion tokens (v2). Durations in ms; easings are CSS cubic-beziers. */
export const motion = {
  duration: { instant: 90, fast: 160, base: 240, slow: 380 },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.2, 0, 0, 1.15)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

/** Type scale (v2) — named roles with size / lineHeight / weight / letterSpacing. */
export const typeScale = {
  display: { size: 40, lineHeight: 46, weight: "800", letterSpacing: -0.5 },
  title: { size: 30, lineHeight: 36, weight: "800", letterSpacing: -0.3 },
  heading: { size: 22, lineHeight: 28, weight: "700", letterSpacing: -0.2 },
  subheading: { size: 17, lineHeight: 24, weight: "600", letterSpacing: 0 },
  body: { size: 15, lineHeight: 22, weight: "400", letterSpacing: 0 },
  label: { size: 13, lineHeight: 18, weight: "600", letterSpacing: 0.2 },
  caption: { size: 12, lineHeight: 16, weight: "500", letterSpacing: 0.2 },
  overline: { size: 11, lineHeight: 14, weight: "700", letterSpacing: 1 },
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
