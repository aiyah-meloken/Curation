import { useMemo, useState } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDajialaBalance } from "../hooks/useDajialaBalance";
import { useAdminByAccount, BizSummary } from "../hooks/useAdminSubscriptions";
import { cmp, fmtTime, SortableHeader } from "../lib/tableHelpers";
import { BizDrawer } from "./BizDrawer";

type SortKey = "name" | "subscriber_count" | "article_count" | "avg_daily_freq"
             | "estimated_daily_cost" | "last_monitored_at";
type Filter = "active" | "all" | "ended";

const GRID = "minmax(220px,1fr) 90px 70px 70px 80px 90px 110px";

export function AdminSubscriptionPanel() {
  const [filter, setFilter] = useState<Filter>("active");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [drawerBiz, setDrawerBiz] = useState<BizSummary | null>(null);
  const qc = useQueryClient();

  const includeEnded = filter !== "active";
  const { data: balance } = useDajialaBalance();
  const { data: bizRows = [], isFetching, refetch } = useAdminByAccount(includeEnded);

  const filtered = useMemo(() => {
    let rows = bizRows;
    if (filter === "ended") {
      rows = rows
        .map(r => ({ ...r, subscribers: r.subscribers.filter(s => !!s.ended_at) }))
        .filter(r => r.subscribers.length > 0);
    }
    const sorted = [...rows].sort((a, b) => {
      const av: unknown = (a as unknown as Record<string, unknown>)[sortKey];
      const bv: unknown = (b as unknown as Record<string, unknown>)[sortKey];
      const c = cmp(av, bv);
      return sortDir === "asc" ? c : -c;
    });
    return sorted;
  }, [bizRows, filter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", background: "var(--bg-panel)",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <BalanceCell label="当前余额" value={balance?.current_remain} />
        <BalanceCell label="今日消耗" value={balance?.today_consumed} />
        <BalanceCell label="昨日消耗" value={balance?.yesterday_consumed} />
        <BalanceCell label="跨日变化" value={balance?.day_delta} />
        <div style={{ marginLeft: "auto", color: "var(--text-faint)",
                      fontSize: "var(--fs-xs)" }}>
          {balance?.latest_snapshot_at
            ? `快照 ${fmtTime(balance.latest_snapshot_at)}`
            : "暂无快照"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 16px", borderBottom: "1px solid var(--bg-panel)",
                    color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
        <span>显示</span>
        <select value={filter} onChange={e => setFilter(e.target.value as Filter)}
                style={{ background: "var(--bg-panel)", color: "var(--text-primary)",
                         border: "1px solid var(--border)", borderRadius: 4,
                         padding: "2px 8px", fontSize: "var(--fs-xs)" }}>
          <option value="active">仅活跃订阅</option>
          <option value="all">全部订阅</option>
          <option value="ended">仅已结束</option>
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => refetch()} title="刷新" disabled={isFetching}
                style={{ background: "var(--bg-panel)",
                         border: "1px solid var(--border)", color: "var(--text-primary)",
                         borderRadius: 4, padding: "2px 6px",
                         cursor: isFetching ? "default" : "pointer",
                         display: "flex", alignItems: "center" }}>
          <RefreshCw size={12}
                     style={isFetching ? { animation: "spin 1s linear infinite" }
                                       : undefined} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID,
                      padding: "6px 16px", borderBottom: "1px solid var(--bg-panel)",
                      background: "var(--bg-panel)", color: "var(--text-muted)",
                      fontSize: "var(--fs-xs)", fontWeight: 500,
                      position: "sticky", top: 0, zIndex: 1 }}>
          <SortableHeader label="公众号" active={sortKey === "name"} dir={sortDir}
                          onClick={() => toggleSort("name")} />
          <SortableHeader label="订阅" active={sortKey === "subscriber_count"}
                          dir={sortDir} align="center"
                          onClick={() => toggleSort("subscriber_count")} />
          <SortableHeader label="文章" active={sortKey === "article_count"}
                          dir={sortDir} align="center"
                          onClick={() => toggleSort("article_count")} />
          <SortableHeader label="日均" active={sortKey === "avg_daily_freq"}
                          dir={sortDir} align="center"
                          onClick={() => toggleSort("avg_daily_freq")} />
          <SortableHeader label="日成本" active={sortKey === "estimated_daily_cost"}
                          dir={sortDir} align="center"
                          onClick={() => toggleSort("estimated_daily_cost")} />
          <SortableHeader label="最后同步" active={sortKey === "last_monitored_at"}
                          dir={sortDir} align="center"
                          onClick={() => toggleSort("last_monitored_at")} />
          <span style={{ textAlign: "center" }}>操作</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center",
                        color: "var(--text-faint)", fontSize: "var(--fs-sm)" }}>
            {isFetching ? "加载中…" : "暂无公众号订阅"}
          </div>
        ) : filtered.map(row => (
          <div key={row.biz}
               onClick={() => setDrawerBiz(row)}
               style={{ display: "grid", gridTemplateColumns: GRID,
                        padding: "8px 16px", alignItems: "center",
                        borderBottom: "1px solid var(--bg-panel)",
                        cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {row.avatar_url && (
                <img src={row.avatar_url} alt="" referrerPolicy="no-referrer"
                     style={{ width: 24, height: 24, borderRadius: "50%",
                              flexShrink: 0 }} />
              )}
              <span style={{ color: "var(--accent-blue)", fontSize: "var(--fs-sm)",
                              overflow: "hidden", textOverflow: "ellipsis",
                              whiteSpace: "nowrap" }}>
                {row.name || row.biz}
              </span>
            </div>
            <span style={{ color: "var(--text-primary)", fontSize: "var(--fs-sm)",
                            textAlign: "center" }}>
              {row.active_count}/{row.subscriber_count}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)",
                            textAlign: "center" }}>
              {row.article_count}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)",
                            textAlign: "center" }}>
              {row.avg_daily_freq ? row.avg_daily_freq.toFixed(1) : "—"}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)",
                            textAlign: "center" }}>
              {row.estimated_daily_cost
                ? `¥${row.estimated_daily_cost.toFixed(3)}`
                : "—"}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)",
                            textAlign: "center" }}>
              {row.last_monitored_at
                ? fmtTime(row.last_monitored_at)
                : "—"}
            </span>
            <span style={{ textAlign: "center" }}
                  onClick={e => e.stopPropagation()}>
              <button onClick={() => alert("待实现：多用户订阅选择")}
                      style={{ background: "var(--bg-panel)",
                               border: "1px solid var(--border)", borderRadius: 4,
                               color: "var(--accent-blue)", padding: "2px 6px",
                               cursor: "pointer", fontSize: "var(--fs-xs)",
                               display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Plus size={10} /> 订阅者
              </button>
            </span>
          </div>
        ))}
      </div>

      {drawerBiz && (
        <BizDrawer biz={drawerBiz} includeEnded={includeEnded}
                   onClose={() => {
                     setDrawerBiz(null);
                     qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
                   }} />
      )}
    </div>
  );
}

function BalanceCell({ label, value }:
    { label: string; value: number | null | undefined }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>
        {label}
      </div>
      <div style={{ color: "var(--text-primary)", fontSize: "var(--fs-md)",
                    fontWeight: 600 }}>
        {value == null ? "—" : `¥ ${Math.abs(value).toFixed(2)}`}
      </div>
    </div>
  );
}
