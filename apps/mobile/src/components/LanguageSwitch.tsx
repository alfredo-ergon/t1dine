import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLanguage, type Language } from "../i18n";
import { colors, MIN_TAP_TARGET, radius, spacing } from "../theme";

const OPTIONS: Language[] = ["pt", "en"];

// PT | EN toggle in the header. Portuguese is the app default; English is a
// toggle, never the other way round.
export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={t("language.switchLabel")}>
      {OPTIONS.map((option) => {
        const isActive = option === language;
        const label = t(`language.${option}`);
        return (
          <Pressable
            key={option}
            onPress={() => setLanguage(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive, checked: isActive }}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.option, isActive && styles.optionActive, pressed && styles.optionPressed]}
          >
            <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: "hidden",
  },
  option: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  optionActive: { backgroundColor: colors.accent },
  optionPressed: { opacity: 0.85 },
  optionText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  optionTextActive: { color: colors.onBrand },
});
