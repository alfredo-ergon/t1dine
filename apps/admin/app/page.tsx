import { CONFIDENCE_LEVELS } from "@t1dine/domain";
import { FOOD_STATUSES } from "@t1dine/food-schema";
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
import { DataSourceBadge } from "./ui/DataSourceBadge";
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
        </div>
        <div className="hero__mascot">
          <Mascot size={92} decorative />
        </div>
      </section>

      <DataSourceBadge source={source} />

      <section className="card-grid" aria-label="Métricas gerais">
        <div className="stat-card">
          <p className="stat-card__label">{t.dashboard.totalFoods}</p>
          <p className="stat-card__value">{foods.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t.dashboard.sources}</p>
          <p className="stat-card__value">{sources.length}</p>
        </div>
        <div className={`stat-card${failing > 0 ? " stat-card--alert" : ""}`}>
          <p className="stat-card__label">{t.dashboard.failing}</p>
          <p className="stat-card__value">{failing}</p>
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
