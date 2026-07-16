// Shared visual tokens so screens/components stay visually consistent
// without pulling in a styling framework. This module is now a thin,
// backward-compatible layer over `@t1dine/design-tokens` — the single
// source of truth for colour, spacing, radius, type, and shadow across
// every T1Dine surface (mobile + admin/web). Existing named exports
// (`colors.textPrimary`, `spacing.md`, etc.) keep working so screens don't
// need a big-bang rewrite, but every value is now backed by a token.

import {
  colors as tokens,
  spacing as tokenSpacing,
  radius as tokenRadius,
  fontSize,
  fontWeight,
  shadow,
  gradients as tokenGradients,
  auroraBackground as tokenAuroraBackground,
  elevation as tokenElevation,
  motion as tokenMotion,
  typeScale as tokenTypeScale,
} from "@t1dine/design-tokens";

export const colors = {
  // --- Backward-compatible aliases (existing screens/components) ---
  background: tokens.bg,
  surface: tokens.surface,
  border: tokens.border,
  borderStrong: tokens.borderStrong,
  textPrimary: tokens.text,
  textSecondary: tokens.textMuted,
  textMuted: tokens.textMuted,
  textFaint: tokens.textSubtle,
  // "accent" historically meant "primary action colour" in this app (buttons,
  // active states, links) — that's the brand colour in the design system.
  accent: tokens.brand,
  accentPressed: tokens.brandDark,
  accentSoft: tokens.brandSoft,
  dark: tokens.ink,
  success: tokens.success,
  star: tokens.accent,
  starInactive: tokens.borderStrong,
  danger: tokens.danger,

  // --- Direct passthroughs for new/updated UI ---
  brand: tokens.brand,
  brandDark: tokens.brandDark,
  brandDeep: tokens.brandDeep,
  brandSoft: tokens.brandSoft,
  brandTint: tokens.brandTint,
  onBrand: tokens.onBrand,
  ink: tokens.ink,
  inkSoft: tokens.inkSoft,
  surfaceAlt: tokens.surfaceAlt,
  textSubtle: tokens.textSubtle,
  warmAccent: tokens.accent,
  warmAccentSoft: tokens.accentSoft,
  confidenceHigh: tokens.confidenceHigh,
  confidenceHighBg: tokens.confidenceHighBg,
  confidenceMedium: tokens.confidenceMedium,
  confidenceMediumBg: tokens.confidenceMediumBg,
  confidenceLow: tokens.confidenceLow,
  confidenceLowBg: tokens.confidenceLowBg,
  confidenceUnverified: tokens.confidenceUnverified,
  confidenceUnverifiedBg: tokens.confidenceUnverifiedBg,
  warning: tokens.warning,
  info: tokens.info,

  // --- v2 premium tokens (WoW redesign) ---
  brandGradientFrom: tokens.brandGradientFrom,
  brandGradientTo: tokens.brandGradientTo,
  accentWarm: tokens.accentWarm,
  accentCool: tokens.accentCool,
  surfaceElevated: tokens.surfaceElevated,
  surfaceSunken: tokens.surfaceSunken,
  surfaceGlass: tokens.surfaceGlass,
  scrim: tokens.scrim,
  focusRing: tokens.focusRing,
  hairline: tokens.hairline,
} as const;

export const spacing = {
  xs: tokenSpacing.xs,
  sm: tokenSpacing.sm,
  md: tokenSpacing.md,
  lg: tokenSpacing.lg,
  xl: tokenSpacing.xl,
  xxl: tokenSpacing.xxl,
  xxxl: tokenSpacing.xxxl,
} as const;

export const radius = {
  sm: tokenRadius.sm,
  md: tokenRadius.md,
  lg: tokenRadius.lg,
  xl: tokenRadius.xl,
  pill: tokenRadius.pill,
} as const;

export const fontSizes = fontSize;
export const fontWeights = fontWeight;
export const shadows = shadow;

// v2 design-system passthroughs for the premium redesign.
export const gradients = tokenGradients;
export const auroraBackground = tokenAuroraBackground;
export const elevation = tokenElevation;
export const motion = tokenMotion;
export const typeScale = tokenTypeScale;

// WCAG 2.2 / platform guidance: interactive targets should be at least 44x44.
export const MIN_TAP_TARGET = 44;
