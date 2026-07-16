import { deriveSources, getCatalog } from "../../lib/api";
import { t } from "../../lib/i18n";
import { DataSourceBadge } from "../ui/DataSourceBadge";

export default async function SourcesPage(): Promise<JSX.Element> {
  // There is no dedicated sources endpoint, so the register is derived from the
  // provenance carried by each fetched food (unique sourceId + market + licence,
  // with a food count per source).
  const { foods, source } = await getCatalog();
  const sources = deriveSources(foods);
  // Sources with a licence obligation or unresolved governance question get an
  // expanded card below the table so a curator sees the governance status (and
  // any mandatory attribution) — not just a name in a row.
  const governed = sources.filter(
    (entry) => entry.attribution || entry.openQuestions || entry.governanceStatus,
  );

  return (
    <>
      <h1 className="page-title">{t.sources.title}</h1>
      <p className="page-lede">{t.sources.lede}</p>
      <DataSourceBadge source={source} />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{t.sources.columns.id}</th>
              <th>{t.sources.columns.name}</th>
              <th>{t.sources.columns.market}</th>
              <th>{t.sources.columns.licence}</th>
              <th>{t.sources.columns.cadence}</th>
              <th className="num">{t.sources.columns.foodCount}</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((entry) => (
              <tr key={entry.sourceId}>
                <td className="mono">{entry.sourceId}</td>
                <td>{entry.name}</td>
                <td>{entry.market}</td>
                <td>{entry.licence}</td>
                <td>{entry.cadence}</td>
                <td className="num">{entry.foodCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {governed.length > 0 && (
        <section aria-labelledby="source-governance-title" style={{ marginTop: "1.75rem" }}>
          <h2 id="source-governance-title" className="section-title">
            {t.sources.governanceTitle}
          </h2>
          <p className="page-lede">{t.sources.governanceLede}</p>
          {governed.map((entry) => (
            <div
              key={entry.sourceId}
              className="provenance"
              style={{ borderRadius: "var(--radius-md)", padding: "0.9rem 1.05rem", marginBottom: "1rem" }}
            >
              <strong>
                <span className="mono">{entry.sourceId}</span> — {entry.name}
              </strong>
              <dl style={{ marginTop: "0.6rem" }}>
                <dt>{t.common.licence}</dt>
                <dd>{entry.licence}</dd>
                {entry.governanceStatus && (
                  <>
                    <dt>{t.sources.governanceStatus}</dt>
                    <dd>{entry.governanceStatus}</dd>
                  </>
                )}
                {entry.attribution && (
                  <>
                    <dt>{t.sources.attribution}</dt>
                    <dd>{entry.attribution}</dd>
                  </>
                )}
              </dl>
              {entry.openQuestions && (
                <p
                  className="callout callout--warn"
                  role="note"
                  style={{ marginTop: "0.75rem", marginBottom: 0 }}
                >
                  <strong>{t.sources.openQuestionsLabel}:</strong> {entry.openQuestions}
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
