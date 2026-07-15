"use client";

import { collectCanonicalFoodErrors, FOOD_TYPES, type FoodType } from "@t1dine/food-schema";
import Link from "next/link";
import { useState } from "react";
import { addFood, ApiError, type AdminSubmission } from "../lib/adminApi";
import { buildManualFood } from "../lib/foodDraft";
import { FOOD_TYPE_LABELS, t } from "../../lib/i18n";
import { AdminGate } from "../ui/AdminGate";

interface FormState {
  namePt: string;
  nameEn: string;
  country: string;
  type: FoodType;
  carb: string;
  energy: string;
  cuisine: string;
  mediterranean: boolean;
}

const INITIAL: FormState = {
  namePt: "",
  nameEn: "",
  country: "PT",
  type: "ingredient",
  carb: "",
  energy: "",
  cuisine: "",
  mediterranean: false,
};

function AddFoodForm({ token }: { token: string }): JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<AdminSubmission | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset(): void {
    setForm(INITIAL);
    setErrors([]);
    setCreated(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrors([]);
    setCreated(null);

    const carb = Number(form.carb);
    const energy = Number(form.energy);
    const country = form.country.trim().toUpperCase();

    const localErrors: string[] = [];
    if (form.namePt.trim().length === 0 || form.nameEn.trim().length === 0 || country.length < 2) {
      localErrors.push(t.add.required);
    }
    if (!Number.isFinite(carb) || carb < 0) localErrors.push("Hidratos de carbono tem de ser um número ≥ 0.");
    if (!Number.isFinite(energy) || energy < 0) localErrors.push("Energia tem de ser um número ≥ 0.");
    if (localErrors.length > 0) {
      setErrors(localErrors);
      return;
    }

    const food = buildManualFood({
      namePt: form.namePt,
      nameEn: form.nameEn,
      country,
      type: form.type,
      carbPer100g: carb,
      energyKcalPer100g: energy,
      cuisineTags: form.cuisine.split(","),
      mediterranean: form.mediterranean,
    });

    // Validate at the boundary with the SAME validator the API applies, so any
    // problem is surfaced here rather than as an opaque 400.
    const foodErrors = collectCanonicalFoodErrors(food, "food");
    if (foodErrors.length > 0) {
      setErrors(foodErrors);
      return;
    }

    setSubmitting(true);
    try {
      const submission = await addFood(token, food);
      setCreated(submission);
      setForm(INITIAL);
    } catch (err) {
      setErrors([err instanceof ApiError ? err.message : "Não foi possível adicionar o alimento."]);
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const name = created.food.names?.[0]?.name ?? form.namePt;
    return (
      <div className="callout callout--success" role="status">
        <p style={{ margin: 0 }}>
          <strong>{t.add.successTitle}:</strong> «{name}» {t.add.successBody}
        </p>
        <div className="actions" style={{ marginTop: "0.6rem" }}>
          <Link className="btn btn--primary" href="/alimentos">
            {t.add.seeInFoods}
          </Link>
          <button type="button" className="btn" onClick={reset}>
            {t.add.addAnother}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
      {errors.length > 0 && (
        <div className="callout callout--danger" role="alert">
          <p style={{ margin: "0 0 0.35rem", fontWeight: 600 }}>{t.add.validationTitle}</p>
          <ul className="errors" style={{ color: "inherit" }}>
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="add-name-pt">{t.add.namePt}</label>
          <input id="add-name-pt" type="text" value={form.namePt} onChange={(e) => update("namePt", e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="add-name-en">{t.add.nameEn}</label>
          <input id="add-name-en" type="text" value={form.nameEn} onChange={(e) => update("nameEn", e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="add-country">{t.add.country}</label>
          <input
            id="add-country"
            type="text"
            value={form.country}
            maxLength={2}
            onChange={(e) => update("country", e.target.value.toUpperCase())}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="add-type">{t.add.type}</label>
          <select id="add-type" value={form.type} onChange={(e) => update("type", e.target.value as FoodType)}>
            {FOOD_TYPES.map((type) => (
              <option key={type} value={type}>
                {FOOD_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="add-carb">{t.add.carb}</label>
          <input id="add-carb" type="number" inputMode="decimal" min={0} step="0.1" value={form.carb} onChange={(e) => update("carb", e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="add-energy">{t.add.energy}</label>
          <input id="add-energy" type="number" inputMode="decimal" min={0} step="1" value={form.energy} onChange={(e) => update("energy", e.target.value)} required />
        </div>
        <div className="field field--wide">
          <label htmlFor="add-cuisine">{t.add.cuisine}</label>
          <input id="add-cuisine" type="text" placeholder="portuguesa, sobremesa" value={form.cuisine} onChange={(e) => update("cuisine", e.target.value)} />
          <span className="field__hint">{t.add.cuisineHint}</span>
        </div>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={form.mediterranean} onChange={(e) => update("mediterranean", e.target.checked)} />
        <span>
          <strong>{t.add.mediterranean}</strong>
          <span className="field__hint"> — {t.add.mediterraneanHint}</span>
        </span>
      </label>

      <div className="actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? t.add.submitting : t.add.submit}
        </button>
      </div>
    </form>
  );
}

export default function AddPage(): JSX.Element {
  return (
    <>
      <h1 className="page-title">{t.add.title}</h1>
      <p className="page-lede">{t.add.lede}</p>
      <p className="notice" role="note">
        {t.common.synthetic}
      </p>
      <AdminGate>{(token) => <AddFoodForm token={token} />}</AdminGate>
    </>
  );
}
