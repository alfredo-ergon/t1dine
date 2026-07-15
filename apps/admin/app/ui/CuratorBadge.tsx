"use client";

import { useAdminToken } from "../lib/adminAuth";
import { t } from "../../lib/i18n";

/**
 * Global "sessão de curador" indicator with a logout control, shown in the site
 * header. Renders nothing when no curator is signed in (or before the first
 * client-side token read), so the header is unchanged for anonymous visitors.
 * Logging out here notifies every mounted `useAdminToken`, so any open admin
 * page falls back to its login form immediately.
 */
export function CuratorBadge(): JSX.Element | null {
  const { token, ready, clearToken } = useAdminToken();

  if (!ready || !token) return null;

  return (
    <div className="curator-badge" role="status">
      <span className="curator-badge__dot" aria-hidden />
      <span className="curator-badge__label">{t.curator.active}</span>
      <button type="button" className="curator-badge__logout" onClick={clearToken}>
        {t.curator.logout}
      </button>
    </div>
  );
}
