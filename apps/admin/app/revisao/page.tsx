"use client";

import { regionForCountry } from "@t1dine/food-schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Name, source, region, confidence, carb, energy, validation, actions + the
// leading selection checkbox column added for bulk approve/reject.
const COLUMN_COUNT = 9;

interface BulkProgress {
  done: number;
  total: number;
}

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

/** A header checkbox that also renders the tri-state "some selected" look via the
 * native `indeterminate` DOM property (which has no JSX/HTML attribute, so it is
 * set imperatively). */
function SelectAllCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: () => void;
  ariaLabel: string;
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="select-checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  );
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);

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

  // Selection is only ever acted on for rows that are currently visible, so a
  // stale id left in the set after filtering or a reload can never be approved.
  const visibleIds = useMemo(() => visible.map((row) => row.submission.id), [visible]);
  const selectedVisibleIds = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  );
  const selectedCount = selectedVisibleIds.length;
  const allVisibleSelected = visible.length > 0 && selectedCount === visible.length;
  const someVisibleSelected = selectedCount > 0 && selectedCount < visible.length;

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible(): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection(): void {
    setSelectedIds(new Set());
  }

  async function bulkDecide(decision: "approve" | "reject"): Promise<void> {
    const ids = [...selectedVisibleIds];
    if (ids.length === 0 || bulkRunning) return;
    setBulkRunning(true);
    setActionError(null);
    setToast(null);
    setBulkProgress({ done: 0, total: ids.length });

    let succeeded = 0;
    let failed = 0;
    // Loop client-side over the single-item endpoints; one failure must not
    // abort the rest (tolerant handling), so each call is caught individually.
    for (const id of ids) {
      try {
        if (decision === "approve") await approveFood(token, id);
        else await rejectFood(token, id);
        succeeded += 1;
      } catch {
        failed += 1;
      } finally {
        setBulkProgress({ done: succeeded + failed, total: ids.length });
      }
    }

    if (failed === 0) {
      const base = decision === "approve" ? t.review.bulkApprovedToast : t.review.bulkRejectedToast;
      setToast(`${base} (${succeeded}).`);
    } else {
      setActionError(
        `${t.review.bulkPartialLead}: ${succeeded} ${t.review.bulkPartialOk}, ${failed} ${t.review.bulkPartialFail}.`,
      );
    }

    clearSelection();
    setBulkProgress(null);
    setBulkRunning(false);
    await load();
  }

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

      {visible.length > 0 && (
        <div className="bulk-bar" role="group" aria-label={t.review.bulkBarAria}>
          <span className="bulk-bar__count" role="status" aria-live="polite">
            {selectedCount} {t.review.selectedCount}
          </span>
          <button
            type="button"
            className="btn btn--approve"
            onClick={() => void bulkDecide("approve")}
            disabled={selectedCount === 0 || bulkRunning || loading}
            aria-label={`${t.review.bulkApprove} (${selectedCount})`}
          >
            {t.review.bulkApprove} ({selectedCount})
          </button>
          <button
            type="button"
            className="btn btn--reject"
            onClick={() => void bulkDecide("reject")}
            disabled={selectedCount === 0 || bulkRunning || loading}
            aria-label={`${t.review.bulkReject} (${selectedCount})`}
          >
            {t.review.bulkReject} ({selectedCount})
          </button>
          <button
            type="button"
            className="btn btn--link"
            onClick={clearSelection}
            disabled={selectedCount === 0 || bulkRunning}
          >
            {t.review.bulkClear}
          </button>
          {bulkProgress && (
            <span className="bulk-bar__progress" role="status" aria-live="polite">
              <progress value={bulkProgress.done} max={bulkProgress.total} />
              {t.review.bulkProgress} {bulkProgress.done}/{bulkProgress.total}
            </span>
          )}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="table-wrap" role="status" aria-live="polite" style={{ padding: "1.1rem 1.2rem" }}>
          <p className="muted" style={{ margin: "0 0 0.85rem" }}>
            {t.review.loading}
          </p>
          {[0, 1, 2, 3, 4].map((row) => (
            <span
              key={row}
              className="skeleton"
              style={{ display: "block", height: "1.9rem", margin: "0.55rem 0", width: `${94 - row * 6}%` }}
            />
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="select-cell" scope="col">
                  <SelectAllCheckbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    disabled={bulkRunning || visible.length === 0}
                    onChange={toggleSelectAllVisible}
                    ariaLabel={t.review.selectAllAria}
                  />
                </th>
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
                  bulkRunning={bulkRunning}
                  selected={selectedIds.has(row.submission.id)}
                  isOpen={Boolean(expanded[row.submission.id])}
                  onToggleSelect={() => toggleSelected(row.submission.id)}
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
  bulkRunning: boolean;
  selected: boolean;
  isOpen: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onToggle: () => void;
}

function ReviewRowGroup({
  row,
  busy,
  bulkRunning,
  selected,
  isOpen,
  onToggleSelect,
  onApprove,
  onReject,
  onToggle,
}: ReviewRowGroupProps): JSX.Element {
  const { submission, enriched } = row;
  const { food } = enriched;
  const foodType = FOOD_TYPE_LABELS[food.type] ?? String(food.type);
  const disabled = busy || bulkRunning;

  return (
    <>
      <tr>
        <td className="select-cell">
          <input
            type="checkbox"
            className="select-checkbox"
            checked={selected}
            disabled={bulkRunning}
            onChange={onToggleSelect}
            aria-label={`${t.review.selectRowAria}: ${enriched.primaryName}`}
          />
        </td>
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
            <button type="button" className="btn btn--approve" onClick={onApprove} disabled={disabled}>
              {busy ? t.review.approving : t.review.approve}
            </button>
            <button type="button" className="btn btn--reject" onClick={onReject} disabled={disabled}>
              {busy ? t.review.rejecting : t.review.reject}
            </button>
            <button
              type="button"
              className="btn btn--link"
              aria-expanded={isOpen}
              onClick={onToggle}
              disabled={bulkRunning}
            >
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
