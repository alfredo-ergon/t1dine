import type { DataSource } from "../../lib/api";
import { t } from "../../lib/i18n";

/**
 * Small, always-visible indicator of where the catalog data came from for this
 * render: the live API (green) or the synthetic local fallback (amber). Colour
 * is paired with text so state is never conveyed by colour alone (WCAG 1.4.1),
 * and `role="status"` announces it to assistive tech.
 */
export function DataSourceBadge({ source }: { source: DataSource }): JSX.Element {
  const isLive = source === "api";
  return (
    <p className="data-source-line">
      <span
        className={`data-badge data-badge--${isLive ? "live" : "local"}`}
        role="status"
      >
        {isLive ? t.dataSource.api : t.dataSource.local}
      </span>
    </p>
  );
}
