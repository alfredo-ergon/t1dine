"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getAiConfig,
  updateAiConfig,
  type AiConfig,
  type AiConfigSource,
} from "../lib/adminApi";
import { AI_MODEL_LABELS, t } from "../../lib/i18n";
import { AdminGate } from "../ui/AdminGate";
import { Chip } from "../ui/Chip";
import { Icon } from "../ui/Icon";

const iaCopy = t.settings.ia;

function sourceLabel(source: AiConfigSource): string {
  switch (source) {
    case "admin":
      return iaCopy.sourceAdmin;
    case "env":
      return iaCopy.sourceEnv;
    case "none":
      return iaCopy.sourceNone;
  }
}

/** Friendly, human label for a model id (server label first, then our fallback map). */
function modelLabel(id: string, label: string): string {
  if (label && label !== id) return label;
  return AI_MODEL_LABELS[id] ?? id;
}

/** Format an ISO timestamp for display; falls back to the "—" placeholder. */
function formatUpdatedAt(iso: string | null): string {
  if (!iso) return iaCopy.never;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AiSettingsForm({ token }: { token: string }): JSX.Element {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state. `apiKey` is NEVER seeded from the server — the plaintext key is
  // never returned, and we never echo it back into the field.
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [enabled, setEnabled] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const applyConfig = useCallback((next: AiConfig): void => {
    setConfig(next);
    setModel(next.model);
    setEnabled(next.enabled);
    setApiKey(""); // never pre-fill the key input
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      applyConfig(await getAiConfig(token));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : iaCopy.loadError);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [token, applyConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ensure the current model is always selectable even if it isn't in the list.
  const modelOptions = useMemo(() => {
    if (!config) return [];
    const options = [...config.availableModels];
    if (model && !options.some((option) => option.id === model)) {
      options.unshift({ id: model, label: model });
    }
    return options;
  }, [config, model]);

  function mapError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.code === "ai_key_required") return iaCopy.errorKeyRequired;
      if (err.code === "invalid_model") return iaCopy.errorInvalidModel;
      return err.message || iaCopy.errorGeneric;
    }
    return iaCopy.errorGeneric;
  }

  async function submit(update: { apiKey?: string | null; model?: string; enabled?: boolean }, successMessage: string): Promise<void> {
    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);
    try {
      const next = await updateAiConfig(token, update);
      applyConfig(next); // refresh status; clears the key field
      setSavedMessage(successMessage);
    } catch (err) {
      setSaveError(mapError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const update: { apiKey?: string; model?: string; enabled?: boolean } = { model, enabled };
    // Only send a new key when the curator actually typed one.
    const trimmed = apiKey.trim();
    if (trimmed.length > 0) update.apiKey = trimmed;
    await submit(update, iaCopy.saved);
  }

  async function handleClearKey(): Promise<void> {
    await submit({ apiKey: null }, iaCopy.cleared);
  }

  if (loading && !config) {
    return (
      <div className="panel" role="status" aria-live="polite">
        <p className="muted" style={{ margin: "0 0 0.75rem" }}>
          {iaCopy.loading}
        </p>
        <span className="skeleton skeleton--line-lg" />
        <span className="skeleton skeleton--text" style={{ width: "80%" }} />
        <span className="skeleton skeleton--text" style={{ width: "60%" }} />
      </div>
    );
  }

  if (loadError && !config) {
    return (
      <div className="callout callout--danger" role="alert">
        <p style={{ margin: "0 0 0.6rem" }}>{loadError}</p>
        <button type="button" className="btn" onClick={() => void load()}>
          {t.dashboard.retry}
        </button>
      </div>
    );
  }

  if (!config) return <></>;

  return (
    <div className="settings-layout">
      <p className="callout callout--info" role="note" style={{ margin: 0 }}>
        {iaCopy.lede}
      </p>

      {/* ---------- Status ---------- */}
      <section className="panel" aria-labelledby="ia-status">
        <h2 id="ia-status" className="section-title">
          {iaCopy.statusTitle}
        </h2>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-item__label">{iaCopy.provider}</span>
            <span className="status-item__value">{config.provider}</span>
          </div>
          <div className="status-item">
            <span className="status-item__label">{iaCopy.keyState}</span>
            <span className="status-item__value">
              {config.keySet ? (
                <Chip variant="ok" label={iaCopy.keySet} />
              ) : (
                <Chip variant="neutral" label={iaCopy.keyNotSet} />
              )}
            </span>
          </div>
          <div className="status-item">
            <span className="status-item__label">{iaCopy.keyMaskedLabel}</span>
            <span className="status-item__value mono">{config.keyMasked || iaCopy.never}</span>
          </div>
          <div className="status-item">
            <span className="status-item__label">{iaCopy.effectiveSource}</span>
            <span className="status-item__value">
              <Chip
                variant={config.effectiveSource === "none" ? "neutral" : "accent"}
                label={sourceLabel(config.effectiveSource)}
              />
            </span>
          </div>
          <div className="status-item">
            <span className="status-item__label">{iaCopy.enabledState}</span>
            <span className="status-item__value">
              <Chip
                variant={config.enabled ? "ok" : "neutral"}
                label={config.enabled ? iaCopy.enabledOn : iaCopy.enabledOff}
              />
            </span>
          </div>
          <div className="status-item">
            <span className="status-item__label">{iaCopy.updatedAt}</span>
            <span className="status-item__value">{formatUpdatedAt(config.updatedAt)}</span>
          </div>
        </div>
      </section>

      {/* ---------- Security note (PT + EN, prominent) ---------- */}
      <div className="security-note" role="note">
        <span className="security-note__icon" aria-hidden>
          <Icon name="lock" size={22} />
        </span>
        <p className="security-note__text">
          <span lang="pt-PT">{iaCopy.securityNotePt}</span>
          <span className="en" lang="en">
            {iaCopy.securityNoteEn}
          </span>
        </p>
      </div>

      {/* ---------- Update form ---------- */}
      <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          {iaCopy.formTitle}
        </h2>

        {saveError && (
          <p className="callout callout--danger" role="alert" style={{ margin: 0 }}>
            {saveError}
          </p>
        )}

        <div className="field field--wide">
          <label htmlFor="ia-key">{iaCopy.apiKeyLabel}</label>
          <input
            id="ia-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={iaCopy.apiKeyPlaceholder}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <span className="field__hint">{iaCopy.apiKeyHint}</span>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="ia-model">{iaCopy.modelLabel}</label>
            <select
              id="ia-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              disabled={modelOptions.length === 0}
            >
              {modelOptions.length === 0 ? (
                <option value="">{iaCopy.noModels}</option>
              ) : (
                modelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {modelLabel(option.id, option.label)}
                  </option>
                ))
              )}
            </select>
            <span className="field__hint">{iaCopy.modelHint}</span>
          </div>
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span className="switch__control" aria-hidden />
          <span className="switch__text">
            <span className="switch__title">{iaCopy.enabledToggle}</span>
            <span className="field__hint">{iaCopy.enabledToggleHint}</span>
          </span>
        </label>

        <div className="settings-form__footer">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? iaCopy.saving : iaCopy.save}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void handleClearKey()}
            disabled={saving || !config.keySet}
            title={iaCopy.clearKeyHint}
          >
            {iaCopy.clearKey}
          </button>
          {savedMessage && (
            <span className="saved-flash" role="status">
              <Icon name="check" size={16} />
              {savedMessage}
            </span>
          )}
        </div>
        <p className="field__hint" style={{ marginTop: "-0.4rem" }}>
          {iaCopy.clearKeyHint}
        </p>
      </form>
    </div>
  );
}

export default function SettingsPage(): JSX.Element {
  return (
    <>
      <div className="page-head-with-mascot">
        <div>
          <h1 className="page-title">{t.settings.title}</h1>
          <p className="page-lede">{t.settings.lede}</p>
        </div>
        <span className="quick-action__icon" aria-hidden style={{ width: "3rem", height: "3rem" }}>
          <Icon name="gear" size={26} />
        </span>
      </div>
      <AdminGate>{(token) => <AiSettingsForm token={token} />}</AdminGate>
    </>
  );
}
