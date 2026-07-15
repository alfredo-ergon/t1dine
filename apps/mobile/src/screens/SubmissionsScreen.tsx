import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FadeIn } from "../components/FadeIn";
import { Mascot } from "../components/Mascot";
import { tPlural, useLanguage } from "../i18n";
import { loadSubmissions, type SubmissionRecord } from "../submissions";
import { colors, elevation, fontWeights, radius, spacing, typeScale } from "../theme";

// "As minhas contribuições" (Slice: my submissions). Local-first and
// read-only from this screen's point of view — every record here was
// written by DetailScreen at the moment a submission succeeded (see
// ../submissions.ts). There is no per-user submissions endpoint on the API,
// so this screen NEVER fetches a live status; it is honest about that with
// a permanent disclaimer rather than implying a status it cannot verify.
export function SubmissionsScreen() {
  const { language, t } = useLanguage();
  const [submissions, setSubmissions] = useState<SubmissionRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSubmissions().then((records) => {
      if (!cancelled) setSubmissions(records);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = submissions ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <FadeIn>
        <Text style={styles.h1}>{t("submissions.title")}</Text>
        {submissions !== null && <Text style={styles.meta}>{tPlural(t, "submissions.count", list.length)}</Text>}
      </FadeIn>

      {submissions !== null && list.length === 0 && (
        <FadeIn delay={80}>
          <View style={styles.empty}>
            <Mascot size={84} />
            <Text style={styles.emptyTitle}>{t("submissions.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("submissions.emptyBody")}</Text>
          </View>
        </FadeIn>
      )}

      {list.map((submission, index) => (
        <FadeIn key={submission.id} delay={Math.min(index, 6) * 40}>
          <SubmissionCard submission={submission} language={language} t={t} />
        </FadeIn>
      ))}

      {list.length > 0 && <Text style={styles.disclaimer}>{t("submissions.disclaimer")}</Text>}
    </ScrollView>
  );
}

interface SubmissionCardProps {
  submission: SubmissionRecord;
  language: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function SubmissionCard({ submission, t }: SubmissionCardProps) {
  const date = submission.submittedAt.slice(0, 10);

  return (
    <View style={styles.card}>
      <Text style={styles.cardName}>{submission.name}</Text>
      <Text style={styles.cardDate}>{t("submissions.submittedAtLabel", { date })}</Text>
      <View style={styles.statusPill} accessible accessibilityLabel={t("submissions.statusPending")}>
        <Text style={styles.statusDot}>●</Text>
        <Text style={styles.statusText}>{t("submissions.statusPending")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: typeScale.title.size, lineHeight: typeScale.title.lineHeight, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginTop: spacing.sm },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },
  empty: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md },
  emptyBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 280 },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.xs.native,
  },
  cardName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  cardDate: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.confidenceMediumBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusDot: { fontSize: 8, color: colors.confidenceMedium },
  statusText: { fontSize: 12, fontWeight: "700", color: colors.confidenceMedium },
  disclaimer: { fontSize: 12, color: colors.textFaint, marginTop: spacing.lg, lineHeight: 17, textAlign: "center" },
});
