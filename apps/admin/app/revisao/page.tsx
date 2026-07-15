"use client";

import { regionForCountry } from "@t1dine/food-schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  approveFood,
  listAdminFoods,
  rejectFood,
  type AdminSubmission,
  type FoodSource,
} from "../lib/adminApi";
import { enrichCanonicalFood, type CatalogFood } from "../../lib/catalog";
import {
  CONFIDENCE_LABELS,
  confidenceChipVariant,
  FOOD_TYPE_LABELS,
  SUBMISSION_SOURCE_LABELS,
  submissionSourceChipVariant,
  t,
} from "../../lib/i18n";
import { AdminGate } from "../ui/AdminGate";
import { Chip } from "../ui/Chip";
import { Mascot } from "../ui/Mascot";

type SourceFilter = FoodSource | "all";
type RegionFilter = string; // region id, or "all"

const COLUMN_COUNT = 8;

interface ReviewRow {
  submission: AdminSubmission;
  enriched: CatalogFood;
  regionId: string | null;
  regionName: string;
}

function toReviewRow(submission: AdminSubmission): ReviewRow {
  const enriched = enrichCanonicalFood(submission.food);
  const countries = Array.isArray(submission.food.countries) ? submission.food.countries : [];
  const region = countries.map((code) => regionForCountry(code)).find((r) => r !== undefined);
  return {
    submission,
    enriched,
    regionId: region?.id ?? null,
    regionName: region?.name ?? t.review.unknownRegion,
  };
}

function formatNumber(value: number | null, suffix: string): string {
  return value === null ? "—" : `${value} ${suffix}`;
}

function ReviewQueue({ token }: { token: string }): JSX.Element {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const submissions = await listAdminFoods(token, { status: "candidate" });
      setRows(submissions.map(toReviewRow));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar a fila de revisão.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Filter options are derived from what is actually in the queue, so a filter
  // never offers a value that would return nothing.
  const availableSources = useMemo(() => {
    const set = new Set<FoodSource>();
    for (const row of rows) set.add(row.submission.source);
    return [...set];
  }, [rows]);

  const availableRegions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.regionId) map.set(row.regionId, row.regionName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (sourceFilter !== "all" && row.submission.source !== sourceFilter) return false;
        if (regionFilter !== "all" && row.regionId !== regionFilter) return false;
        return true;
      }),
    [rows, sourceFilter, regionFilter],
  );

  async function decide(id: string, decision: "approve" | "reject"): Promise<void> {
    setBusyId(id);
    setActionError(null);
    setToast(null);
    try {
      if (decision === "approve") {
        await approveFood(token, id);
        setToast(t.review.approvedToast);
      } else {
        await rejectFood(token, id);
        setToast(t.review.rejectedToast);
      }
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "A ação falhou. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleExpanded(id: string): void {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <>
      <p className="callout callout--info" role="note">
        <strong>IA + Utilizadores.</strong> {t.review.aiNote}
      </p>

      <div className="controls">
        <div className="field">
          <label htmlFor="filter-source">{t.review.filterSource}</label>
          <select
            id="filter-source"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
          >
            <option value="all">{t.review.allSources}</option>
            {availableSources.map((source) => (
              <option key={source} value={source}>
                {SUBMISSION_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-region">{t.review.filterRegion}</label>
          <select
            id="filter-region"
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
          >
            <option value="all">{t.review.allRegions}</option>
            {availableRegions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
          {loading ? t.review.reloading : t.review.reload}
        </button>

        <p className="controls__meta">
          {t.review.showing} {visible.length} {t.review.of} {rows.length} {t.review.candidates}
        </p>
      </div>

      {toast && (
        <p className="callout callout--success" role="status">
          {toast}
        </p>
      )}
      {actionError && (
        <p className="callout callout--danger" role="alert">
          {actionError}
        </p>
      )}
      {error && (
        <p className="callout callout--danger" role="alert">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className="notice" role="status">
          {t.review.loading}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t.review.columns.name}</th>
                <th>{t.review.columns.source}</th>
                <th>{t.review.columns.region}</th>
                <th>{t.review.columns.confidence}</th>
                <th className="num">{t.review.columns.carb}</th>
                <th className="num">{t.review.columns.energy}</th>
                <th>{t.review.columns.validation}</th>
                <th>{t.review.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <ReviewRowGroup
                  key={row.submission.id}
                  row={row}
                  busy={busyId === row.submission.id}
                  isOpen={Boolean(expanded[row.submission.id])}
                  onApprove={() => void decide(row.submission.id, "approve")}
                  onReject={() => void decide(row.submission.id, "reject")}
                  onToggle={() => toggleExpanded(row.submission.id)}
                />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT}>
                    <div className="empty-state">
                      <Mascot size={56} mono="#CBD5E1" decorative />
                      <p className="empty-state__title">{t.review.emptyTitle}</p>
                      <p className="empty-state__hint">{t.review.emptyHint}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface ReviewRowGroupProps {
  row: ReviewRow;
  busy: boolean;
  isOpen: boolean;
  onApprove: () => void;
  onReject: () => void;
  onToggle: () => void;
}

function ReviewRowGroup({ row, busy, isOpen, onApprove, onReject, onToggle }: ReviewRowGroupProps): JSX.Element {
  const { submission, enriched } = row;
  const { food } = enriched;
  const foodType = FOOD_TYPE_LABELS[food.type] ?? String(food.type);

  return (
    <>
      <tr>
        <td>
          <div className="cell-name">{enriched.primaryName}</div>
          <div className="cell-sub">{foodType}</div>
        </td>
        <td>
          <Chip
            variant={submissionSourceChipVariant(submission.source)}
            label={SUBMISSION_SOURCE_LABELS[submission.source]}
          />
        </td>
        <td>{row.regionName}</td>
        <td>
          <Chip variant={confidenceChipVariant(enriched.confidence)} label={CONFIDENCE_LABELS[enriched.confidence]} />
        </td>
        <td className="num">{formatNumber(enriched.carbPer100g, "g")}</td>
        <td className="num">{formatNumber(enriched.energyKcalPer100g, "kcal")}</td>
        <td>
          {enriched.isValid ? (
            <Chip variant="ok" label={t.review.valid} />
          ) : (
            <Chip variant="danger" label={t.review.invalid} />
          )}
        </td>
        <td>
          <div className="actions">
            <button type="button" className="btn btn--approve" onClick={onApprove} disabled={busy}>
              {busy ? t.review.approving : t.review.approve}
            </button>
            <button type="button" className="btn btn--reject" onClick={onReject} disabled={busy}>
              {busy ? t.review.rejecting : t.review.reject}
            </button>
            <button type="button" className="btn btn--link" aria-expanded={isOpen} onClick={onToggle}>
              {isOpen ? t.foods.hideDetails : t.foods.details}
            </button>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="provenance">
          <td colSpan={COLUMN_COUNT}>
            <strong>{t.review.provenance}</strong>
            <dl>
              <dt>{t.foods.sourceId}</dt>
              <dd className="mono">{enriched.source.sourceId}</dd>
              <dt>{t.foods.sourceRecordId}</dt>
              <dd className="mono">{enriched.source.sourceRecordId}</dd>
              <dt>{t.common.licence}</dt>
              <dd>{enriched.source.licence}</dd>
              <dt>{t.foods.retrievedAt}</dt>
              <dd>{enriched.source.retrievedAt}</dd>
              <dt>{t.foods.digest}</dt>
              <dd className="mono">{enriched.source.rawSnapshotSha256}</dd>
            </dl>
            {enriched.validationErrors.length > 0 && (
              <>
                <p className="cell-sub" style={{ marginTop: "0.5rem", fontWeight: 600 }}>
                  {t.foods.validationErrors}
                </p>
                <ul className="errors">
                  {enriched.validationErrors.map((err) => (
                    <li key={err}>{err}</li>
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

export default function ReviewPage(): JSX.Element {
  return (
    <>
      <h1 className="page-title">{t.review.title}</h1>
      <p className="page-lede">{t.review.lede}</p>
      <AdminGate>{(token) => <ReviewQueue token={token} />}</AdminGate>
    </>
  );
}
