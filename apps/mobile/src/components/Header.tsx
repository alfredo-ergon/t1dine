import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "../i18n";
import { colors, elevation, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";
import { LanguageSwitch } from "./LanguageSwitch";
import { Mascot } from "./Mascot";
import { PressableScale } from "./PressableScale";

interface HeaderProps {
  /** True when a stacked screen (Detail / Create food / Profile) is showing instead of a tab. */
  showBack: boolean;
  onBack: () => void;
  onCreateFood: () => void;
  onOpenProfile: () => void;
  /** Opens the "Conta" screen (Slice: accounts + multi-device sync). */
  onOpenAccount: () => void;
}

// Below this MEASURED header width, the "+ Novo alimento" / "Conta" pill
// buttons collapse to icon-only (44x44) so the action cluster never collides
// with the brand mark. Measured via onLayout on the header row itself —
// deliberately NOT `useWindowDimensions`, because on web the header can be
// rendered inside the centred ~480px phone-width column (see App.tsx) while
// the actual browser window is much wider; only the header's own rendered
// width tells us what will actually fit. Chosen so real phone widths (and
// the ~480px web column) always land in the compact branch, and only
// genuinely wide layouts (large tablets) get the full text labels.
const COMPACT_BREAKPOINT = 560;

// A translucent "light on dark" overlay palette, used only for the small
// pill/icon controls that sit on top of the ink gradient header — the rest
// of the app's controls sit on light surfaces and use the regular `colors`
// tokens. Kept local to this file since nothing else renders on a dark
// gradient like this.
const overlay = {
  fill: "rgba(255,255,255,0.14)",
  fillPressed: "rgba(255,255,255,0.24)",
  border: "rgba(255,255,255,0.30)",
};

// Persistent top bar: brand mark (Tino + wordmark) or Back (when a stacked
// screen is open), a quick "new custom food" entry point, a "Conta" entry
// point (Slice: accounts + multi-device sync), a "Perfil" entry point
// (Slice 5 — export/delete data), and the PT | EN language switch — always
// reachable regardless of which tab is active. Rendered on the signature ink
// gradient so it reads as one premium, branded surface across every screen.
export function Header({ showBack, onBack, onCreateFood, onOpenProfile, onOpenAccount }: HeaderProps) {
  const { t } = useLanguage();
  // Top safe-area inset (status bar / notch / camera cutout). The ink gradient
  // extends up under the status bar and the header content is padded below it,
  // so nothing hides behind the system bar on Android/iOS.
  const insets = useSafeAreaInsets();
  // Default to `true` (compact) until the first onLayout measurement lands,
  // so there is never a flash of the wide/text-label layout — compact is the
  // layout that is guaranteed to fit everywhere.
  const [headerWidth, setHeaderWidth] = useState(0);
  const isCompact = headerWidth === 0 || headerWidth < COMPACT_BREAKPOINT;

  const handleLayout = (event: LayoutChangeEvent) => {
    setHeaderWidth(event.nativeEvent.layout.width);
  };

  // First letter of the (localised) "Conta"/"Account" label — an avatar-style
  // monogram for the compact icon button. Plain text glyph (not an emoji), so
  // it always renders in the header's own colour/weight, unlike a pictogram.
  const accountInitial = t("account.openLabel").charAt(0).toUpperCase();

  return (
    <LinearGradient colors={gradients.ink.colors} start={gradients.ink.start} end={gradients.ink.end} style={[styles.gradient, { paddingTop: insets.top }]}>
      <View style={[styles.header, isCompact && styles.headerCompact, !showBack && styles.headerWithGreeting]} onLayout={handleLayout}>
        <View style={styles.left}>
          {showBack ? (
            <PressableScale
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t("nav.back")}
              style={({ pressed }) => [styles.backButton, pressed && styles.overlayPressed]}
            >
              <Text style={styles.backText} numberOfLines={1}>
                ‹ {t("nav.back")}
              </Text>
            </PressableScale>
          ) : (
            <View style={styles.brand}>
              <Mascot size={isCompact ? 28 : 32} />
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {t("app.name")}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.right, isCompact && styles.rightCompact]}>
          {!showBack && (
            <>
              <PressableScale
                onPress={onCreateFood}
                accessibilityRole="button"
                accessibilityLabel={t("create.openCta")}
                style={({ pressed }) => [isCompact ? styles.iconButton : styles.pillButton, pressed && styles.overlayPressed]}
              >
                {isCompact ? (
                  <Text style={styles.iconButtonText}>+</Text>
                ) : (
                  <Text style={styles.pillButtonText} numberOfLines={1}>
                    + {t("create.openCta")}
                  </Text>
                )}
              </PressableScale>
              <PressableScale
                onPress={onOpenAccount}
                accessibilityRole="button"
                accessibilityLabel={t("account.openLabel")}
                style={({ pressed }) => [isCompact ? styles.iconButton : styles.pillButton, pressed && styles.overlayPressed]}
              >
                {isCompact ? (
                  <Text style={styles.iconButtonText}>{accountInitial}</Text>
                ) : (
                  <Text style={styles.pillButtonText} numberOfLines={1}>
                    {t("account.openLabel")}
                  </Text>
                )}
              </PressableScale>
              <PressableScale
                onPress={onOpenProfile}
                accessibilityRole="button"
                accessibilityLabel={t("profile.openLabel")}
                style={({ pressed }) => [styles.iconButton, pressed && styles.overlayPressed]}
              >
                <Text style={styles.iconButtonText}>⚙</Text>
              </PressableScale>
            </>
          )}
          <LanguageSwitch />
        </View>
      </View>
      {/* Warm greeting on the branded ink surface — only on the main tabs, not
          on stacked/detail screens (where the Back control replaces the brand). */}
      {!showBack && (
        <Text style={[styles.greeting, isCompact && styles.greetingCompact]} numberOfLines={1}>
          {t("app.greeting")}
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...elevation.md.native,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // `flexWrap` is a pure safety net: the compact/wide split above is tuned
    // to fit on one line at every realistic width, but if it's ever wrong
    // (an unusually long translation, an extreme viewport), wrapping to a
    // second line is what happens instead of the brand and the action
    // cluster overlapping each other.
    flexWrap: "wrap",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  headerCompact: {
    paddingHorizontal: spacing.lg,
  },
  // When the greeting line renders below, the header row gives up most of its
  // bottom padding so the two sit as one tight block.
  headerWithGreeting: {
    paddingBottom: spacing.xs,
  },
  greeting: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  greetingCompact: {
    paddingHorizontal: spacing.lg,
  },
  // `minWidth: 0` overrides the flexbox default of "shrink no smaller than my
  // content" (the classic overlap bug on web, where react-native-web compiles
  // straight to CSS flexbox) so the brand mark can truncate/shrink instead of
  // pushing into — or under — the action cluster.
  left: { flex: 1, minWidth: 0 },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 0 },
  rightCompact: { gap: spacing.xs },
  title: {
    fontSize: typeScale.heading.size,
    fontWeight: typeScale.heading.weight,
    letterSpacing: typeScale.heading.letterSpacing,
    color: colors.onBrand,
    flexShrink: 1,
  },
  backButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: overlay.fill,
    borderWidth: 1,
    borderColor: overlay.border,
    alignSelf: "flex-start",
  },
  backText: { fontSize: 15, color: colors.onBrand, fontWeight: "700" },
  overlayPressed: { backgroundColor: overlay.fillPressed },
  pillButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: overlay.fill,
    borderWidth: 1,
    borderColor: overlay.border,
  },
  pillButtonText: { color: colors.onBrand, fontSize: 13, fontWeight: "700" },
  iconButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: overlay.fill,
    borderWidth: 1,
    borderColor: overlay.border,
  },
  iconButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },
});
