import { CONFIDENCE_LEVELS } from "@t1dine/domain";
import { FOOD_STATUSES } from "@t1dine/food-schema";
import Link from "next/link";
import { deriveSources, getCatalog } from "../lib/api";
import { countByConfidence, countByStatus, countFailingValidation } from "../lib/catalog";
import {
  CONFIDENCE_LABELS,
  confidenceChipVariant,
  STATUS_LABELS,
  statusChipVariant,
  t,
} from "../lib/i18n";
import { Chip } from "./ui/Chip";
import { CuratorMetrics } from "./ui/CuratorMetrics";
import { DataSourceBadge } from "./ui/DataSourceBadge";
import { Icon } from "./ui/Icon";
import { Mascot } from "./ui/Mascot";

export default async function DashboardPage(): Promise<JSX.Element> {
  const { foods, source } = await getCatalog();
  const byStatus = countByStatus(foods);
  const byConfidence = countByConfidence(foods);
  const failing = countFailingValidation(foods);
  const sources = deriveSources(foods);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__content">
          <p className="hero__eyebrow">{t.dashboard.eyebrow}</p>
          <h1 id="hero-title" className="hero__title">
            {t.dashboard.title}
          </h1>
          <p className="hero__lede">{t.dashboard.lede}</p>
          <div className="hero__actions">
            <Link href="/revisao" className="btn btn--on-brand btn--solid">
              <Icon name="inbox" size={18} />
              {t.dashboard.heroCtaReview}
            </Link>
            <Link href="/ia" className="btn btn--on-brand">
              <Icon name="sparkles" size={18} />
              {t.dashboard.heroCtaAi}
            </Link>
          </div>
        </div>
        <div className="hero__mascot">
          <Mascot size={96} decorative />
        </div>
      </section>

      <DataSourceBadge source={source} />

      <section className="card-grid" aria-label="Métricas gerais">
        <div className="stat-card">
          <p className="stat-card__label">{t.dashboard.approved}</p>
          <p className="stat-card__value">{byStatus.approved}</p>
          <p className="stat-card__hint">{t.dashboard.approvedHint}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t.dashboard.totalFoods}</p>
          <p className="stat-card__value">{foods.length}</p>
          <p className="stat-card__hint">{t.dashboard.sources}: {sources.length}</p>
        </div>
        <div className={`stat-card${failing > 0 ? " stat-card--alert" : ""}`}>
          <p className="stat-card__label">{t.dashboard.failing}</p>
          <p className="stat-card__value">{failing}</p>
          <p className="stat-card__hint">{t.dashboard.byConfidence}</p>
        </div>
      </section>

      <CuratorMetrics />

      <section className="panel" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="section-title">
          {t.dashboard.quickActions}
        </h2>
        <div className="quick-actions">
          <Link className="quick-action" href="/revisao">
            <span className="quick-action__icon">
              <Icon name="inbox" size={20} />
            </span>
            <span>{t.dashboard.actionReview}</span>
          </Link>
          <Link className="quick-action" href="/adicionar">
            <span className="quick-action__icon">
              <Icon name="plus" size={20} />
            </span>
            <span>{t.dashboard.actionAdd}</span>
          </Link>
          <Link className="quick-action" href="/ia">
            <span className="quick-action__icon">
              <Icon name="sparkles" size={20} />
            </span>
            <span>{t.dashboard.actionAi}</span>
          </Link>
          <Link className="quick-action" href="/definicoes">
            <span className="quick-action__icon">
              <Icon name="gear" size={20} />
            </span>
            <span>{t.dashboard.actionSettings}</span>
          </Link>
        </div>
      </section>

      <section className="panel" aria-labelledby="by-status">
        <h2 id="by-status" className="section-title">
          {t.dashboard.byStatus}
        </h2>
        <div className="breakdown">
          {FOOD_STATUSES.map((status) => (
            <span key={status} className="breakdown__item">
              <Chip variant={statusChipVariant(status)} label={STATUS_LABELS[status]} />
              <span className="breakdown__count">{byStatus[status]}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="by-confidence">
        <h2 id="by-confidence" className="section-title">
          {t.dashboard.byConfidence}
        </h2>
        <div className="breakdown">
          {CONFIDENCE_LEVELS.map((level) => (
            <span key={level} className="breakdown__item">
              <Chip variant={confidenceChipVariant(level)} label={CONFIDENCE_LABELS[level]} />
              <span className="breakdown__count">{byConfidence[level]}</span>
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
