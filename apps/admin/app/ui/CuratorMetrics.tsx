"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, listAdminFoods } from "../lib/adminApi";
import { useAdminToken } from "../lib/adminAuth";
import { t } from "../../lib/i18n";
import { Icon } from "./Icon";
import { Mascot } from "./Mascot";

interface Counts {
  pending: number;
  ai: number;
}

/**
 * Live "curation queue" metrics on the dashboard. Self-gating: it reads the
 * curator token directly (rather than the full AdminGate login form) so the
 * dashboard stays welcoming — a signed-out visitor sees a friendly sign-in CTA,
 * a signed-in curator sees headline counts fetched from `GET /admin/foods`.
 */
export function CuratorMetrics(): JSX.Element {
  const { token, ready } = useAdminToken();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (authToken: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const candidates = await listAdminFoods(authToken, { status: "candidate" });
      const ai = candidates.filter((row) => row.source === "ai").length;
      setCounts({ pending: candidates.length, ai });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.dashboard.metricsError);
      setCounts(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && token) void load(token);
  }, [ready, token, load]);

  return (
    <section className="panel" aria-labelledby="curator-metrics" lang="pt-PT">
      <h2 id="curator-metrics" className="section-title">
        {t.dashboard.curatorTitle}
      </h2>
      <p className="page-lede" style={{ marginBottom: "1.1rem", fontSize: "0.95rem" }}>
        {t.dashboard.curatorLede}
      </p>

      {!ready ? (
        <MetricSkeletons />
      ) : !token ? (
        <div className="signin-prompt">
          <span className="signin-prompt__mascot">
            <Mascot size={44} decorative />
          </span>
          <div className="signin-prompt__body">
            <p className="signin-prompt__title">{t.dashboard.signInTitle}</p>
            <p className="signin-prompt__hint">{t.dashboard.signInHint}</p>
          </div>
          <Link className="btn btn--primary" href="/revisao">
            {t.dashboard.signInCta}
            <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      ) : loading && !counts ? (
        <MetricSkeletons />
      ) : error ? (
        <div className="callout callout--danger" role="alert" style={{ margin: 0 }}>
          <p style={{ margin: "0 0 0.5rem" }}>{error}</p>
          <button type="button" className="btn" onClick={() => void load(token)}>
            {t.dashboard.retry}
          </button>
        </div>
      ) : (
        <div className="card-grid" style={{ margin: 0 }}>
          <div className="metric-card">
            <span className="metric-card__icon">
              <Icon name="clock" size={22} />
            </span>
            <span className="metric-card__value">{counts?.pending ?? 0}</span>
            <span className="metric-card__label">{t.dashboard.pending}</span>
            <span className="metric-card__hint">{t.dashboard.pendingHint}</span>
          </div>
          <div className="metric-card metric-card--accent">
            <span className="metric-card__icon">
              <Icon name="sparkles" size={22} />
            </span>
            <span className="metric-card__value">{counts?.ai ?? 0}</span>
            <span className="metric-card__label">{t.dashboard.aiCandidates}</span>
            <span className="metric-card__hint">{t.dashboard.aiCandidatesHint}</span>
          </div>
          <Link className="quick-action" href="/revisao" style={{ alignSelf: "stretch" }}>
            <span className="quick-action__icon">
              <Icon name="inbox" size={20} />
            </span>
            <span>{t.dashboard.heroCtaReview}</span>
          </Link>
        </div>
      )}
    </section>
  );
}

function MetricSkeletons(): JSX.Element {
  return (
    <div className="skeleton-grid" style={{ margin: 0 }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="metric-card skeleton-card">
          <span className="skeleton skeleton--line-lg" />
          <span className="skeleton skeleton--text" style={{ width: "70%" }} />
          <span className="skeleton skeleton--text" style={{ width: "50%" }} />
        </div>
      ))}
    </div>
  );
}
