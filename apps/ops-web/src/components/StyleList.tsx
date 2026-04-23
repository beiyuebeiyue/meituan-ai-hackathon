import { resolveAssetUrl } from "../api/client";

type StyleRow = Record<string, unknown>;

type StyleListProps = {
  title: string;
  items: StyleRow[];
};

export function StyleList({ title, items }: StyleListProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
      </div>
      <div className="list">
        {items.length === 0 ? <div className="empty">暂无数据</div> : null}
        {items.map((item) => (
          <article className="style-row" key={String(item.style_id ?? item.title)}>
            <div className="style-row-main">
              <div className="thumb">
                {item.image_url ? (
                  <img src={resolveAssetUrl(String(item.image_url))} alt={String(item.title)} />
                ) : (
                  <div className="thumb-placeholder" />
                )}
              </div>
              <div>
                <h4>{String(item.title ?? "未知款式")}</h4>
                <p>
                  曝光 {String(item.impressions ?? 0)} · 点击 {String(item.clicks ?? 0)} · CTR{" "}
                  {typeof item.ctr === "number" ? `${(Number(item.ctr) * 100).toFixed(1)}%` : "0%"}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
