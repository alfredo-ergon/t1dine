import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

import { useLanguage } from "../i18n";
import { durations, easings } from "../motionUtils";
import { colors, fontWeights, gradients, spacing, typeScale } from "../theme";
import { useReducedMotion } from "../useReducedMotion";
import { Mascot } from "./Mascot";

// Branded splash shown once at startup while the persisted language choice
// and AsyncStorage-backed data (favourites/recents/custom foods) load. The
// ink gradient + a gentle fade/scale/bob entrance for Tino replaces a bare
// spinner with something that looks intentional. Purely presentational — it
// never blocks or delays the load it represents, and every animation is
// skipped (content shown fully in place) when reduce-motion is on.
export function Splash() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  const entrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: durations.slow,
      easing: easings.emphasized,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, entrance]);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: easings.standard, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: easings.standard, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, bob]);

  const scale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const translateY = Animated.add(entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }), bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }));

  return (
    <LinearGradient colors={gradients.ink.colors} start={gradients.ink.start} end={gradients.ink.end} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <Animated.View style={{ opacity: entrance, transform: [{ scale }, { translateY }] }}>
            <Mascot size={132} />
          </Animated.View>
          <Animated.View style={{ opacity: entrance }}>
            <Text style={styles.wordmark}>{t("app.name")}</Text>
            <Text style={styles.tagline}>{t("splash.tagline")}</Text>
          </Animated.View>
          <View style={styles.loadingRow} accessibilityRole="progressbar" accessibilityLabel={t("splash.loading")}>
            <ActivityIndicator color={colors.brandSoft} />
            <Text style={styles.loadingText}>{t("splash.loading")}</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xxl },
  wordmark: {
    marginTop: spacing.lg,
    fontSize: typeScale.title.size,
    fontWeight: fontWeights.extrabold,
    color: colors.onBrand,
    letterSpacing: typeScale.title.letterSpacing,
    textAlign: "center",
  },
  tagline: {
    marginTop: spacing.xs,
    fontSize: typeScale.body.size,
    color: colors.brandSoft,
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xxxl,
  },
  loadingText: { fontSize: 13, color: colors.brandSoft, opacity: 0.85 },
});
