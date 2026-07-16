"use client";

import { CONFIDENCE_LEVELS, type ConfidenceLevel } from "@t1dine/domain";
import { FOOD_STATUSES, type FoodStatus } from "@t1dine/food-schema";
import { useMemo, useState } from "react";
import { formatFoodGroup, type CatalogFood } from "../../lib/catalog";
import {
  CONFIDENCE_LABELS,
  confidenceChipVariant,
  DATA_QUALITY_LABELS,
  dataQualityChipVariant,
  FOOD_TYPE_LABELS,
  PREPARATION_STATE_LABELS,
  STATUS_LABELS,
  statusChipVariant,
  t,
} from "../../lib/i18n";
import { Chip } from "../ui/Chip";
import { Mascot } from "../ui/Mascot";

type StatusFilter = FoodStatus | "all";
type ConfidenceFilter = ConfidenceLevel | "all";
type Decision = "approved" | "rejected";

const COLUMN_COUNT = 10;

function formatNumber(value: number | null, suffix: string): string {
  return value === null ? "—" : `${value} ${suffix}`;
}

export function FoodsReview({ items }: { items: CatalogFood[] }): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (statusFilter !== "all" && item.food.status !== statusFilter) return false;
        if (confidenceFilter !== "all" && item.confidence !== confidenceFilter) return false;
        return true;
      }),
    [items, statusFilter, confidenceFilter],
  );

  function decide(id: string, decision: Decision): void {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  }

  function resetDecision(id: string): void {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function toggleExpanded(id: string): void {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <>
      <p className="notice" role="note">
        {t.foods.mockWarning}
      </p>

      <div className="controls">
        <div className="field">
          <label htmlFor="filter-status">{t.foods.filterStatus}</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">{t.foods.all}</option>
            {FOOD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-confidence">{t.foods.filterConfidence}</label>
          <select
            id="filter-confidence"
            value={confidenceFilter}
            onChange={(event) => setConfidenceFilter(event.target.value as ConfidenceFilter)}
          >
            <option value="all">{t.foods.all}</option>
            {CONFIDENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {CONFIDENCE_LABELS[level]}
              </option>
            ))}
          </select>
        </div>

        <p className="controls__meta">
          {t.foods.showing} {visible.length} {t.foods.of} {items.length}
        </p>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{t.foods.columns.name}</th>
              <th>{t.foods.columns.type}</th>
              <th>{t.foods.columns.status}</th>
              <th>{t.foods.columns.confidence}</th>
              <th className="num">{t.foods.columns.carb}</th>
              <th className="num">{t.foods.columns.energy}</th>
              <th>{t.foods.columns.source}</th>
              <th>{t.foods.columns.licence}</th>
              <th>{t.foods.columns.quality}</th>
              <th>{t.foods.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const { food } = item;
              const decision = decisions[food.id];
              const isOpen = Boolean(expanded[food.id]);
              const synonyms = food.names[0]?.synonyms ?? [];
              return (
                <FoodRowGroup
                  key={food.id}
                  item={item}
                  decision={decision}
                  isOpen={isOpen}
                  synonyms={synonyms}
                  onApprove={() => decide(food.id, "approved")}
                  onReject={() => decide(food.id, "rejected")}
                  onReset={() => resetDecision(food.id)}
                  onToggle={() => toggleExpanded(food.id)}
                />
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMN_COUNT}>
                  <div className="empty-state">
                    <Mascot size={56} mono="#CBD5E1" decorative />
                    <p className="empty-state__title">{t.foods.emptyTitle}</p>
                    <p className="empty-state__hint">{t.foods.emptyHint}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface FoodRowGroupProps {
  item: CatalogFood;
  decision: Decision | undefined;
  isOpen: boolean;
  synonyms: string[];
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
  onToggle: () => void;
}

function FoodRowGroup({
  item,
  decision,
  isOpen,
  synonyms,
  onApprove,
  onReject,
  onReset,
  onToggle,
}: FoodRowGroupProps): JSX.Element {
  const { food, source } = item;
  const isCandidate = food.status === "candidate";
  // Additive INSA/PortFIR fields — only rendered when the record carries them.
  const preparationLabel = food.preparationState
    ? PREPARATION_STATE_LABELS[food.preparationState] ?? food.preparationState
    : null;
  const foodGroupLabel = formatFoodGroup(food.foodGroup);

  return (
    <>
      <tr>
        <td>
          <div className="cell-name">{item.primaryName}</div>
          {synonyms.length > 0 && <div className="cell-sub">{synonyms.join(", ")}</div>}
        </td>
        <td>{FOOD_TYPE_LABELS[food.type]}</td>
        <td>
          <Chip variant={statusChipVariant(food.status)} label={STATUS_LABELS[food.status]} />
        </td>
        <td>
          <Chip variant={confidenceChipVariant(item.confidence)} label={CONFIDENCE_LABELS[item.confidence]} />
        </td>
        <td className="num">{formatNumber(item.carbPer100g, "g")}</td>
        <td className="num">{formatNumber(item.energyKcalPer100g, "kcal")}</td>
        <td className="mono">{source.sourceId}</td>
        <td>{source.licence}</td>
        <td>
          <Chip variant={dataQualityChipVariant(item.dataQuality)} label={DATA_QUALITY_LABELS[item.dataQuality]} />
        </td>
        <td>
          <div className="actions">
            {decision ? (
              <>
                <Chip
                  variant={decision === "approved" ? "ok" : "danger"}
                  label={decision === "approved" ? t.foods.decidedApproved : t.foods.decidedRejected}
                />
                <button type="button" className="btn" onClick={onReset}>
                  {t.foods.reset}
                </button>
              </>
            ) : isCandidate ? (
              <>
                <button type="button" className="btn btn--approve" onClick={onApprove}>
                  {t.foods.approve}
                </button>
                <button type="button" className="btn btn--reject" onClick={onReject}>
                  {t.foods.reject}
                </button>
              </>
            ) : (
              <span className="muted">—</span>
            )}
            <button
              type="button"
              className="btn btn--link"
              aria-expanded={isOpen}
              onClick={onToggle}
            >
              {isOpen ? t.foods.hideDetails : t.foods.details}
            </button>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="provenance">
          <td colSpan={COLUMN_COUNT}>
            <strong>{t.foods.provenanceTitle}</strong>
            <dl>
              <dt>{t.foods.sourceId}</dt>
              <dd>{source.sourceId}</dd>
              <dt>{t.foods.sourceRecordId}</dt>
              <dd className="mono">{source.sourceRecordId}</dd>
              <dt>{t.common.market}</dt>
              <dd>{source.market ?? "—"}</dd>
              <dt>{t.foods.version}</dt>
              <dd>{source.sourceVersion}</dd>
              <dt>{t.foods.mappingVersion}</dt>
              <dd>{source.mappingVersion}</dd>
              <dt>{t.common.licence}</dt>
              <dd>{source.licence}</dd>
              {source.attribution && (
                <>
                  <dt>{t.foods.attribution}</dt>
                  <dd>{source.attribution}</dd>
                </>
              )}
              <dt>{t.foods.retrievedAt}</dt>
              <dd>{source.retrievedAt}</dd>
              <dt>{t.foods.digest}</dt>
              <dd className="mono">{source.rawSnapshotSha256}</dd>
              {preparationLabel && (
                <>
                  <dt>{t.foods.preparationState}</dt>
                  <dd>{preparationLabel}</dd>
                </>
              )}
              {foodGroupLabel && (
                <>
                  <dt>{t.foods.foodGroup}</dt>
                  <dd>{foodGroupLabel}</dd>
                </>
              )}
            </dl>
            {item.validationErrors.length > 0 && (
              <>
                <p className="cell-sub" style={{ marginTop: "0.5rem", fontWeight: 600 }}>
                  {t.foods.validationErrors}
                </p>
                <ul className="errors">
                  {item.validationErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
