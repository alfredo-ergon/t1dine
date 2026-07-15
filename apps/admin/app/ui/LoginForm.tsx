"use client";

import { useState } from "react";
import { ApiError, login } from "../lib/adminApi";
import { t } from "../../lib/i18n";
import { Mascot } from "./Mascot";

/** Demo admin email pre-filled into the form. The password is deliberately
 * NEVER pre-filled — only the email hint is shown. */
const DEMO_ADMIN_EMAIL = "admin@t1dine.local";

/**
 * Curator sign-in form. On success it hands the bearer token back to the caller
 * (which stores it via `useAdminToken`). Password is never pre-filled and never
 * logged.
 */
export function LoginForm({ onAuthenticated }: { onAuthenticated: (token: string) => void }): JSX.Element {
  const [email, setEmail] = useState(DEMO_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await login(email.trim(), password);
      onAuthenticated(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.auth.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-card__head">
        <span className="auth-card__mascot">
          <Mascot size={48} decorative />
        </span>
        <div>
          <h2 className="auth-card__title">{t.auth.title}</h2>
          <p className="auth-card__lede">{t.auth.lede}</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-email">{t.auth.email}</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">{t.auth.password}</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? t.auth.submitting : t.auth.submit}
        </button>

        <p className="auth-hint">
          {t.auth.hint} <code>{DEMO_ADMIN_EMAIL}</code>
        </p>
      </form>
    </div>
  );
}
