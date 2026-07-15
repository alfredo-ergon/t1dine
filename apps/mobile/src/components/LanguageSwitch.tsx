import { StyleSheet, Text, View } from "react-native";

import { useLanguage, type Language } from "../i18n";
import { colors, MIN_TAP_TARGET, radius, spacing } from "../theme";
import { PressableScale } from "./PressableScale";

const OPTIONS: Language[] = ["pt", "en"];

// PT | EN toggle in the header. Portuguese is the app default; English is a
// toggle, never the other way round. Styled as a translucent "light on
// dark" segmented control since it only ever renders on the ink-gradient
// Header — see that component's `overlay` palette.
export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={t("language.switchLabel")}>
      {OPTIONS.map((option) => {
        const isActive = option === language;
        const label = t(`language.${option}`);
        return (
          <PressableScale
            key={option}
            onPress={() => setLanguage(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive, checked: isActive }}
            accessibilityLabel={label}
            style={[styles.option, isActive && styles.optionActive]}
          >
            <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{label}</Text>
          </PressableScale>
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
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  option: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: { backgroundColor: colors.onBrand },
  optionText: { fontSize: 13, fontWeight: "700", color: colors.onBrand },
  optionTextActive: { color: colors.brandDeep },
});
