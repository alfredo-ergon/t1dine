import { deriveSources, getCatalog } from "../../lib/api";
import { t } from "../../lib/i18n";
import { DataSourceBadge } from "../ui/DataSourceBadge";

export default async function SourcesPage(): Promise<JSX.Element> {
  // There is no dedicated sources endpoint, so the register is derived from the
  // provenance carried by each fetched food (unique sourceId + market + licence,
  // with a food count per source).
  const { foods, source } = await getCatalog();
  const sources = deriveSources(foods);

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
    </>
  );
}
