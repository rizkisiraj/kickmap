// KickMap Pages: Deals, Compare

function DealsPage({ onNavigate }) {
  const { PRODUCTS, formatCurrency, LAST_UPDATED } = window.KM;
  const deals = PRODUCTS.filter(p => p.onSaleAnywhere).sort((a, b) => b.discountPct - a.discountPct);
  const biggestDeal = deals[0];

  return (
    <div style={{ padding: "0 24px 48px" }}>
      <div style={{
        padding: "14px 16px", margin: "24px 0",
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 12, color: "var(--text2)" }}>
          <span style={{ color: "var(--accent)", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 15 }}>{deals.length}</span>
          {" "}products on sale across 3 regions.
        </span>
        {biggestDeal && (
          <span style={{ fontSize: 12, color: "var(--text2)" }}>
            Biggest discount:{" "}
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{biggestDeal.brand} {biggestDeal.name}</span>
            {" — "}
            <span style={{ color: "var(--accent)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{biggestDeal.discountPct}% off</span>
            {" in "}
            {Object.entries(biggestDeal.regions).filter(([,v]) => v.onSale).map(([k]) => (
              <RegionBadge key={k} region={k} />
            ))}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>⟳ {LAST_UPDATED}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {deals.map((product, idx) => {
          const saleRegions = Object.entries(product.regions).filter(([,v]) => v.onSale);
          const bestRegion = saleRegions[0];
          const totalStock = Object.values(product.regions).reduce((a, r) => a + r.stock, 0);
          return (
            <div key={product.id} onClick={() => onNavigate("/product/" + product.id)}
              style={{
                display: "flex", alignItems: "stretch",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", overflow: "hidden", cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border2)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <div style={{
                width: 44, display: "flex", alignItems: "center", justifyContent: "center",
                background: idx === 0 ? "var(--accent-dim)" : "var(--surface2)",
                borderRight: "1px solid var(--border)", flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "var(--font-mono)", color: idx === 0 ? "var(--accent)" : "var(--text3)" }}>
                  #{idx + 1}
                </span>
              </div>
              <div style={{ flexShrink: 0 }}><ProductImage product={product} size={88} /></div>
              <div style={{ padding: "12px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{product.brand}</span>
                  <span style={{ color: "var(--text3)", fontSize: 10 }}>·</span>
                  <span style={{ fontSize: 11, color: "var(--text2)" }}>{product.gender}</span>
                  {saleRegions.map(([r]) => <RegionBadge key={r} region={r} />)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>{product.name}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{product.colorway}</div>
                {totalStock <= 10 && <LowStockIndicator stock={totalStock} />}
              </div>
              {bestRegion && (
                <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 6, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text3)", textDecoration: "line-through", fontFamily: "var(--font-mono)" }}>
                      {formatCurrency(bestRegion[1].originalPrice, bestRegion[1].currency)}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                      {formatCurrency(bestRegion[1].price, bestRegion[1].currency)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <SaleBadge pct={product.discountPct} />
                    <span style={{ fontSize: 11, color: "var(--text2)", fontFamily: "var(--font-mono)" }}>
                      SAVE {formatCurrency(bestRegion[1].originalPrice - bestRegion[1].price, bestRegion[1].currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparePage() {
  const { PRODUCTS, FX, toSGD, formatCurrency } = window.KM;
  const [currency, setCurrency] = React.useState("SGD");
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState("name");

  const getConverted = (price, fromCurrency) => {
    const sgd = toSGD(price, fromCurrency);
    if (currency === "SGD") return sgd;
    if (currency === "USD") return sgd / FX.USD_SGD;
    if (currency === "MYR") return sgd / FX.MYR_SGD;
    return sgd;
  };
  const sym = { SGD: "S$", USD: "US$", MYR: "RM" }[currency];

  const filtered = PRODUCTS
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price") return a.lowestSGD - b.lowestSGD;
      if (sortBy === "discount") return b.discountPct - a.discountPct;
      return 0;
    });

  return (
    <div style={{ padding: "0 24px 48px" }}>
      <div style={{ padding: "24px 0 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>Price Comparison</h1>
          <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>Cheapest price highlighted · prices converted to selected currency</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 2, padding: "3px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
            {["SGD","USD","MYR"].map(c => (
              <button key={c} onClick={() => setCurrency(c)} style={{
                padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                background: currency === c ? "var(--surface2)" : "transparent",
                color: currency === c ? "var(--text)" : "var(--text2)",
                border: currency === c ? "1px solid var(--border2)" : "1px solid transparent",
                transition: "all 0.15s",
              }}>{c}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 2, padding: "3px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
            {[["name","NAME"],["price","PRICE"],["discount","DEAL"]].map(([v,l]) => (
              <button key={v} onClick={() => setSortBy(v)} style={{
                padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                background: sortBy === v ? "var(--surface2)" : "transparent",
                color: sortBy === v ? "var(--text)" : "var(--text2)",
                border: sortBy === v ? "1px solid var(--border2)" : "1px solid transparent",
                transition: "all 0.15s",
              }}>{l}</button>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 13 }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
              style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px 6px 26px", fontSize: 12, color: "var(--text)", width: 160 }} />
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border2)" }}>
              <th style={{ position: "sticky", left: 0, background: "var(--bg)", padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text2)", textTransform: "uppercase", borderRight: "1px solid var(--border)", width: 260 }}>PRODUCT</th>
              {["MY","ID","SG"].map(r => (
                <th key={r} style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: REGIONS[r].color, textTransform: "uppercase", minWidth: 130 }}>
                  {REGIONS[r].flag} {r} <span style={{ color: "var(--text3)", fontWeight: 400 }}>({REGIONS[r].currency})</span>
                </th>
              ))}
              <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text2)", textTransform: "uppercase", minWidth: 120, borderLeft: "1px solid var(--border)" }}>
                BEST ({currency})
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product, idx) => {
              const rowSGD = {};
              Object.entries(product.regions).forEach(([r, data]) => {
                if (data.inStock) rowSGD[r] = toSGD(data.price, data.currency);
              });
              const minSGD = Math.min(...Object.values(rowSGD));
              const cheapest = Object.entries(rowSGD).find(([,v]) => v === minSGD);
              const cheapestR = cheapest ? cheapest[0] : null;
              const bestVal = getConverted(minSGD, "SGD");

              return (
                <tr key={product.id} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"}
                >
                  <td style={{ position: "sticky", left: 0, background: "var(--bg)", padding: "10px 14px", borderRight: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 4, overflow: "hidden" }}>
                        <ProductImage product={product} size={36} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{product.brand}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{product.name}</div>
                      </div>
                      {product.onSaleAnywhere && <SaleBadge />}
                    </div>
                  </td>
                  {["MY","ID","SG"].map(r => {
                    const data = product.regions[r];
                    const isCheapest = cheapestR === r;
                    return (
                      <td key={r} style={{
                        padding: "10px 16px", textAlign: "right",
                        background: isCheapest ? "rgba(0,255,135,0.05)" : "transparent",
                        borderLeft: isCheapest ? "1px solid rgba(0,255,135,0.2)" : "1px solid transparent",
                        borderRight: isCheapest ? "1px solid rgba(0,255,135,0.2)" : "1px solid transparent",
                      }}>
                        {data.inStock ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                            {data.onSale && (
                              <span style={{ fontSize: 10, color: "var(--text3)", textDecoration: "line-through", fontFamily: "var(--font-mono)" }}>
                                {sym}{getConverted(data.originalPrice, data.currency).toFixed(0)}
                              </span>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {data.onSale && <span style={{ fontSize: 9, color: "var(--accent)" }}>↓</span>}
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: isCheapest ? "var(--accent)" : "var(--text)" }}>
                                {sym}{getConverted(data.price, data.currency).toFixed(0)}
                              </span>
                            </div>
                            {isCheapest && <span style={{ fontSize: 9, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em" }}>BEST</span>}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: 13 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ padding: "10px 16px", textAlign: "right", borderLeft: "1px solid var(--border)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                      {sym}{bestVal.toFixed(0)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { DealsPage, ComparePage });
