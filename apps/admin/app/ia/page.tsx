"use client";

import { AREA_TAXONOMY } from "@t1dine/food-schema";
import Link from "next/link";
import { useState } from "react";
import { aiGenerate, ApiError, type AdminSubmission } from "../lib/adminApi";
import { t } from "../../lib/i18n";
import { AdminGate } from "../ui/AdminGate";
import { Mascot } from "../ui/Mascot";

const MIN_COUNT = 1;
const MAX_COUNT = 20;

/** Cuisine keys the offline mock provider understands, surfaced as hints. */
const CUISINE_SUGGESTIONS = [
  "portuguese",
  "spanish",
  "italian",
  "greek",
  "french",
  "german",
  "british",
  "polish",
  "mediterranean",
];

interface FormState {
  region: string;
  cuisine: string;
  country: string;
  count: string;
}

const INITIAL: FormState = { region: "", cuisine: "", country: "", count: "5" };

function AiGenerateForm({ token }: { token: string }): JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<AdminSubmission[] | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setCreated(null);

    const count = Number(form.count);
    if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
      setError(t.ai.countError);
      return;
    }

    setSubmitting(true);
    try {
      const submissions = await aiGenerate(token, {
        count,
        region: form.region.trim() || undefined,
        cuisine: form.cuisine.trim() || undefined,
        country: form.country.trim().toUpperCase() || undefined,
      });
      setCreated(submissions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível gerar candidatos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="callout callout--warn" role="note">
        <p style={{ margin: "0 0 0.3rem", fontWeight: 700 }}>{t.ai.warningTitle}</p>
        <p style={{ margin: 0 }}>{t.ai.warningBody}</p>
      </div>

      <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ai-region">{t.ai.region}</label>
            <select id="ai-region" value={form.region} onChange={(e) => update("region", e.target.value)}>
              <option value="">{t.ai.anyRegion}</option>
              {AREA_TAXONOMY.map((group) => (
                <optgroup key={group.continent} label={group.continent}>
                  {group.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ai-cuisine">{t.ai.cuisine}</label>
            <input id="ai-cuisine" type="text" list="ai-cuisine-list" value={form.cuisine} onChange={(e) => update("cuisine", e.target.value)} />
            <datalist id="ai-cuisine-list">
              {CUISINE_SUGGESTIONS.map((cuisine) => (
                <option key={cuisine} value={cuisine} />
              ))}
            </datalist>
            <span className="field__hint">
              {t.ai.cuisineHint} {CUISINE_SUGGESTIONS.slice(0, 5).join(", ")}…
            </span>
          </div>
          <div className="field">
            <label htmlFor="ai-country">{t.ai.country}</label>
            <input id="ai-country" type="text" maxLength={2} value={form.country} onChange={(e) => update("country", e.target.value.toUpperCase())} />
          </div>
          <div className="field">
            <label htmlFor="ai-count">{t.ai.count}</label>
            <input id="ai-count" type="number" min={MIN_COUNT} max={MAX_COUNT} step={1} value={form.count} onChange={(e) => update("count", e.target.value)} required />
          </div>
        </div>

        {error && (
          <p className="callout callout--danger" role="alert">
            {error}
          </p>
        )}

        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? t.ai.submitting : t.ai.submit}
          </button>
        </div>
      </form>

      {created && (
        <div className="panel">
          <p className="callout callout--info" role="status" style={{ marginTop: 0 }}>
            <strong>
              {created.length} {t.ai.resultTitle}.
            </strong>{" "}
            {t.ai.resultBody}
          </p>
          <ul className="candidate-list">
            {created.map((submission) => {
              const name = submission.food.names?.[0]?.name ?? submission.id;
              return (
                <li key={submission.id}>
                  <span className="candidate-list__name">{name}</span>
                  <span className="candidate-list__meta mono">{submission.id}</span>
                </li>
              );
            })}
          </ul>
          <div className="actions">
            <Link className="btn btn--primary" href="/revisao">
              {t.ai.goToReview}
            </Link>
            <button type="button" className="btn" onClick={() => setCreated(null)}>
              {t.ai.generateMore}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function AiPage(): JSX.Element {
  return (
    <>
      <div className="page-head-with-mascot">
        <div>
          <h1 className="page-title">{t.ai.title}</h1>
          <p className="page-lede">{t.ai.lede}</p>
        </div>
        <Mascot size={64} decorative />
      </div>
      <AdminGate>{(token) => <AiGenerateForm token={token} />}</AdminGate>
    </>
  );
}
