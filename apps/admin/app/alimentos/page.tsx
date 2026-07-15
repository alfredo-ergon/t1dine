import { getCatalog } from "../../lib/api";
import { t } from "../../lib/i18n";
import { DataSourceBadge } from "../ui/DataSourceBadge";
import { FoodsReview } from "./FoodsReview";

export default async function FoodsPage(): Promise<JSX.Element> {
  // Server-side fetch: the API is read here, then the enriched (plain,
  // serialisable) foods are handed to the client review component via props.
  const { foods, source } = await getCatalog();

  return (
    <>
      <h1 className="page-title">{t.foods.title}</h1>
      <p className="page-lede">{t.foods.lede}</p>
      <DataSourceBadge source={source} />
      {/* `foods` is plain, serialisable data; the interactive review lives in a client component. */}
      <FoodsReview items={foods} />
    </>
  );
}
