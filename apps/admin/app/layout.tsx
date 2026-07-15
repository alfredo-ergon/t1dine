import { colors, elevation, gradients, motion, radius, shadow, spacing, typeScale } from "@t1dine/design-tokens";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "../lib/i18n";
import { CuratorBadge } from "./ui/CuratorBadge";
import { Mascot } from "./ui/Mascot";
import { NavLinks } from "./ui/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: `${t.brand} — ${t.brandSuffix}`,
  description: "Portal interno de curadoria de dados alimentares T1Dine (dados sintéticos).",
};

/**
 * Bridge the shared design tokens into CSS custom properties, once, so the rest
 * of the styling (globals.css) reads from `var(--…)` instead of scattered hex.
 * This keeps the design-tokens package the single source of truth for colour,
 * radius and elevation across mobile and web.
 */
const tokenStyles = `:root{
  --brand:${colors.brand};
  --brand-dark:${colors.brandDark};
  --brand-deep:${colors.brandDeep};
  --brand-soft:${colors.brandSoft};
  --brand-tint:${colors.brandTint};
  --on-brand:${colors.onBrand};
  --accent:${colors.accent};
  --accent-soft:${colors.accentSoft};
  --bg:${colors.bg};
  --surface:${colors.surface};
  --surface-alt:${colors.surfaceAlt};
  --text:${colors.text};
  --text-muted:${colors.textMuted};
  --text-subtle:${colors.textSubtle};
  --border:${colors.border};
  --border-strong:${colors.borderStrong};
  --ink:${colors.ink};
  --ink-soft:${colors.inkSoft};
  --success:${colors.success};
  --warning:${colors.warning};
  --danger:${colors.danger};
  --info:${colors.info};
  --conf-high:${colors.confidenceHigh};
  --conf-high-bg:${colors.confidenceHighBg};
  --conf-medium:${colors.confidenceMedium};
  --conf-medium-bg:${colors.confidenceMediumBg};
  --conf-low:${colors.confidenceLow};
  --conf-low-bg:${colors.confidenceLowBg};
  --conf-unverified:${colors.confidenceUnverified};
  --conf-unverified-bg:${colors.confidenceUnverifiedBg};
  --radius-sm:${radius.sm}px;
  --radius-md:${radius.md}px;
  --radius-lg:${radius.lg}px;
  --radius-xl:${radius.xl}px;
  --radius-pill:${radius.pill}px;
  --shadow-card:${shadow.card.web};
  --shadow-floating:${shadow.floating.web};

  /* v2 — premium surfaces & signature accents */
  --brand-grad-from:${colors.brandGradientFrom};
  --brand-grad-to:${colors.brandGradientTo};
  --accent-warm:${colors.accentWarm};
  --accent-cool:${colors.accentCool};
  --surface-elevated:${colors.surfaceElevated};
  --surface-sunken:${colors.surfaceSunken};
  --surface-glass:${colors.surfaceGlass};
  --scrim:${colors.scrim};
  --focus-ring:${colors.focusRing};
  --hairline:${colors.hairline};

  /* Signature gradients (decorative only — never the sole carrier of meaning) */
  --gradient-brand:${gradients.brand.web};
  --gradient-ink:${gradients.ink.web};
  --gradient-sunrise:${gradients.sunrise.web};
  --gradient-mist:${gradients.mist.web};

  /* Elevation scale */
  --elev-xs:${elevation.xs.web};
  --elev-sm:${elevation.sm.web};
  --elev-md:${elevation.md.web};
  --elev-lg:${elevation.lg.web};
  --elev-glow:${elevation.glow.web};

  /* Motion */
  --dur-instant:${motion.duration.instant}ms;
  --dur-fast:${motion.duration.fast}ms;
  --dur-base:${motion.duration.base}ms;
  --dur-slow:${motion.duration.slow}ms;
  --ease-standard:${motion.easing.standard};
  --ease-emphasized:${motion.easing.emphasized};
  --ease-exit:${motion.easing.exit};

  /* Type scale */
  --type-display-size:${typeScale.display.size}px;
  --type-display-lh:${typeScale.display.lineHeight}px;
  --type-title-size:${typeScale.title.size}px;
  --type-title-lh:${typeScale.title.lineHeight}px;
  --type-heading-size:${typeScale.heading.size}px;
  --type-heading-lh:${typeScale.heading.lineHeight}px;
  --type-subheading-size:${typeScale.subheading.size}px;
  --type-subheading-lh:${typeScale.subheading.lineHeight}px;
  --type-label-size:${typeScale.label.size}px;
  --type-overline-size:${typeScale.overline.size}px;

  /* Spacing */
  --space-xs:${spacing.xs}px;
  --space-sm:${spacing.sm}px;
  --space-md:${spacing.md}px;
  --space-lg:${spacing.lg}px;
  --space-xl:${spacing.xl}px;
  --space-xxl:${spacing.xxl}px;
  --space-xxxl:${spacing.xxxl}px;
}`;

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="pt-PT">
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokenStyles }} />
      </head>
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <Link href="/" className="site-header__brand" aria-label={`${t.brand} · ${t.brandSuffix}`}>
              <span className="site-header__logo">
                <Mascot size={34} />
              </span>
              <span className="site-header__wordmark">
                {t.brand}
                <span className="site-header__suffix"> · {t.brandSuffix}</span>
              </span>
            </Link>
            <NavLinks />
            <CuratorBadge />
          </div>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
