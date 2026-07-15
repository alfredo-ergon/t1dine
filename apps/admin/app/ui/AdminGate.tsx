"use client";

import type { ReactNode } from "react";
import { useAdminToken } from "../lib/adminAuth";
import { t } from "../../lib/i18n";
import { LoginForm } from "./LoginForm";

/**
 * Gate for the admin (`/admin/*`) surfaces. Reads the curator token via
 * `useAdminToken`; when absent it renders the login form, and once signed in it
 * renders `children(token)` — a render-prop so the token is passed to the gated
 * content without a context provider. Before the first client read (`ready`),
 * it shows a neutral placeholder to avoid a hydration flash of the login form.
 */
export function AdminGate({ children }: { children: (token: string) => ReactNode }): JSX.Element {
  const { token, ready, setToken } = useAdminToken();

  if (!ready) {
    return (
      <p className="notice" role="status">
        {t.auth.checking}
      </p>
    );
  }

  if (!token) {
    return <LoginForm onAuthenticated={setToken} />;
  }

  return <>{children(token)}</>;
}
