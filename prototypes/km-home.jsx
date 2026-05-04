// KickMap — Interactive Heatmap Homepage with Dynamic Filters

const SEA_MAP = {
  background: [
    { id: "TH", d: "M310 80 L330 70 L355 75 L365 90 L360 110 L350 130 L340 160 L330 180 L320 175 L315 155 L305 135 L300 115 L305 95 Z" },
    { id: "VN", d: "M390 75 L410 70 L425 85 L430 105 L425 130 L415 160 L405 185 L395 200 L385 195 L380 175 L375 150 L380 125 L385 100 Z" },
    { id: "KH", d: "M355 165 L390 160 L400 175 L395 195 L375 200 L355 195 L345 180 Z" },
    { id: "PH", d: "M490 100 L505 90 L515 100 L510 120 L500 130 L490 120 Z M520 85 L535 80 L540 95 L530 105 L520 95 Z M505 130 L515 125 L520 140 L510 148 L502 140 Z" },
    { id: "BN", d: "M448 210 L460 207 L465 215 L458 222 L448 218 Z" },
    { id: "PG", d: "M590 260 L620 245 L650 250 L660 265 L645 280 L615 285 L590 275 Z" },
    { id: "TL", d: "M548 310 L568 305 L575 315 L565 322 L548 318 Z" },
  ],
  interactive: [
    {
      id: "MY", label: "Malaysia",
      paths: [
        "M320 185 L340 178 L360 182 L375 195 L380 210 L375 228 L360 238 L345 242 L330 238 L318 225 L312 210 Z",
        "M440 205 L480 198 L510 202 L525 215 L530 230 L520 245 L500 252 L475 255 L455 250 L440 238 L432 222 Z",
      ],
    },
    {
      id: "ID", label: "Indonesia",
      paths: [
        "M295 238 L325 228 L355 232 L375 245 L378 265 L365 278 L340 282 L315 278 L295 265 L285 250 Z",
        "M340 288 L380 282 L415 285 L430 295 L425 308 L405 315 L375 318 L348 314 L332 305 Z",
        "M435 248 L475 242 L510 245 L530 258 L535 278 L525 295 L505 302 L478 305 L455 298 L438 282 L430 265 Z",
        "M535 235 L555 228 L568 238 L572 255 L562 270 L548 275 L538 260 Z M558 250 L572 255 L578 270 L568 280 L558 268 Z",
        "M430 318 L445 314 L452 322 L445 330 L432 328 Z M455 318 L468 315 L474 323 L466 330 L456 327 Z M480 318 L510 314 L520 323 L508 330 L480 326 Z",
      ],
    },
    {
      id: "SG", label: "Singapore",
      paths: ["M358 242 L370 240 L374 248 L370 256 L358 255 L353 248 Z"],
    },
  ],
};

// Derive color from filtered stock count vs total
function getColorFromCount(matched, total) {
  if (total === 0) return { fill: "#ef444433", glow: "#ef4444", label: "No Results", pct: 0 };
  const pct = matched / total;
  if (pct === 0) return { fill: "#ef444433", glow: "#ef4444", label: "No Stock", pct: 0 };
  if (pct <= 0.25) return { fill: "#f59e0b44", glow: "#f59e0b", label: "Low", pct };
  if (pct <= 0.6)  return { fill: "#22c55e44", glow: "#22c55e", label: "Medium", pct };
  return { fill: "#00ff8755", glow: "#00ff87", label: "High", pct };
}

function applyFilters(products, filters) {
  return products.filter(p => {
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.model && !p.name.toLowerCase().includes(filters.model.toLowerCase()) && p.id !== filters.model) return false;
    if (filters.gender && filters.gender !== "All" && p.gender !== filters.gender) return false;
    if (filters.size) {
      // product must have the size available in at least one region
      const hasSize = Object.values(p.regions).some(r => r.inStock && r.sizes.includes(filters.size));
      if (!hasSize) return false;
    }
    if (filters.onSaleOnly && !p.onSaleAnywhere) return false;
    return true;
  });
}

function getRegionStats(regionId, filteredProducts) {
  const inStock = filteredProducts.filter(p => p.regions[regionId] && p.regions[regionId].inStock);
  const onSale = inStock.filter(p => p.regions[regionId] && p.regions[regionId].onSale);
  const size12 = inStock.filter(p => p.regions[regionId].sizes.includes("12")).length;
  const size13 = inStock.filter(p => p.regions[regionId].sizes.includes("13")).length;
  const brandCounts = {};
  inStock.forEach(p => { brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1; });
  const topBrand = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0];
  return { total: inStock.length, onSale: onSale.length, size12, size13, topBrand: topBrand ? topBrand[0] : "—" };
}

// ── Filter Bar ──────────────────────────────────────────────────

function HeatmapFilterBar({ filters, setFilters, allProducts }) {
  const { BRANDS, SIZES_UK } = window.KM;
  const [modelSearch, setModelSearch] = React.useState(filters.model || "");
  const [modelSuggestions, setModelSuggestions] = React.useState([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const searchRef = React.useRef(null);

  const handleModelInput = (val) => {
    setModelSearch(val);
    if (val.length >= 1) {
      const matches = allProducts.filter(p =>
        p.name.toLowerCase().includes(val.toLowerCase()) ||
        p.brand.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6);
      setModelSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setModelSuggestions([]);
      setShowSuggestions(false);
      setFilters(f => ({ ...f, model: "" }));
    }
  };

  const selectModel = (product) => {
    setModelSearch(product.name);
    setFilters(f => ({ ...f, model: product.name }));
    setShowSuggestions(false);
  };

  const clearAll = () => {
    setFilters({ brand: "", model: "", size: "", gender: "All", onSaleOnly: false });
    setModelSearch("");
    setShowSuggestions(false);
  };

  const hasActiveFilters = filters.brand || filters.model || filters.size || filters.gender !== "All" || filters.onSaleOnly;

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "14px 16px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text2)", textTransform: "uppercase" }}>
          Filter Map
        </span>
        {hasActiveFilters && (
          <button onClick={clearAll} style={{
            marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "var(--accent)",
            background: "var(--accent-dim)", border: "1px solid rgba(0,255,135,0.25)",
            borderRadius: 99, padding: "2px 10px", cursor: "pointer", letterSpacing: "0.06em",
          }}>CLEAR ALL ✕</button>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* Brand pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 9, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Brand</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {BRANDS.map(b => (
              <button key={b} onClick={() => setFilters(f => ({ ...f, brand: f.brand === b ? "" : b }))} style={{
                padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: filters.brand === b ? "var(--accent-dim)" : "var(--surface2)",
                color: filters.brand === b ? "var(--accent)" : "var(--text2)",
                border: "1px solid " + (filters.brand === b ? "rgba(0,255,135,0.3)" : "var(--border)"),
                cursor: "pointer", transition: "all 0.12s",
              }}>{b}</button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch", flexShrink: 0 }} />

        {/* Size chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 9, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>UK Size</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 340 }}>
            {SIZES_UK.map(s => (
              <button key={s} onClick={() => setFilters(f => ({ ...f, size: f.size === s ? "" : s }))} style={{
                width: 36, height: 28, borderRadius: 4, fontSize: 11, fontWeight: 600,
                fontFamily: "var(--font-mono)",
                background: filters.size === s ? "var(--accent)" : "var(--surface2)",
                color: filters.size === s ? "var(--bg)" : "var(--text2)",
                border: "1px solid " + (filters.size === s ? "var(--accent)" : "var(--border)"),
                cursor: "pointer", transition: "all 0.12s",
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch", flexShrink: 0 }} />

        {/* Right column: model search + gender + on sale */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 180 }}>
          {/* Model search */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 9, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Model</span>
            <div style={{ position: "relative" }} ref={searchRef}>
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 12, pointerEvents: "none" }}>⌕</span>
              <input
                value={modelSearch}
                onChange={e => handleModelInput(e.target.value)}
                onFocus={() => modelSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. Air Max, Dunk..."
                style={{
                  width: "100%", background: "var(--bg)", border: "1px solid var(--border)",
                  borderRadius: 6, padding: "5px 10px 5px 26px", fontSize: 11,
                  color: "var(--text)",
                }}
              />
              {filters.model && (
                <button onClick={() => { setModelSearch(""); setFilters(f => ({ ...f, model: "" })); }}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 13, cursor: "pointer" }}>✕</button>
              )}
              {showSuggestions && modelSuggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  background: "var(--surface2)", border: "1px solid var(--border2)",
                  borderRadius: 6, zIndex: 100, overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}>
                  {modelSuggestions.map(p => (
                    <div key={p.id} onMouseDown={() => selectModel(p)}
                      style={{
                        padding: "8px 12px", cursor: "pointer", fontSize: 12,
                        borderBottom: "1px solid var(--border)", transition: "background 0.1s",
                        display: "flex", alignItems: "center", gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ fontSize: 10, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", width: 48, flexShrink: 0 }}>{p.brand}</span>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>{p.name}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text3)" }}>{p.colorway}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Gender + On Sale row */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 3, padding: "3px", background: "var(--bg)", borderRadius: 6, border: "1px solid var(--border)" }}>
              {["All","Men","Women","Unisex"].map(g => (
                <button key={g} onClick={() => setFilters(f => ({ ...f, gender: g }))} style={{
                  padding: "3px 9px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: filters.gender === g ? "var(--surface2)" : "transparent",
                  color: filters.gender === g ? "var(--text)" : "var(--text3)",
                  border: filters.gender === g ? "1px solid var(--border2)" : "1px solid transparent",
                  transition: "all 0.12s", cursor: "pointer",
                }}>{g}</button>
              ))}
            </div>
            <button onClick={() => setFilters(f => ({ ...f, onSaleOnly: !f.onSaleOnly }))} style={{
              padding: "4px 11px", borderRadius: 99, fontSize: 10, fontWeight: 700,
              background: filters.onSaleOnly ? "rgba(0,255,135,0.12)" : "var(--bg)",
              color: filters.onSaleOnly ? "var(--accent)" : "var(--text3)",
              border: "1px solid " + (filters.onSaleOnly ? "rgba(0,255,135,0.3)" : "var(--border)"),
              cursor: "pointer", transition: "all 0.12s", letterSpacing: "0.05em",
            }}>SALE ONLY</button>
          </div>
        </div>
      </div>

      {/* Active filter summary */}
      {hasActiveFilters && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "var(--text3)" }}>Showing:</span>
          {filters.brand && <FilterChip label={filters.brand} onRemove={() => setFilters(f => ({ ...f, brand: "" }))} />}
          {filters.model && <FilterChip label={"Model: " + filters.model} onRemove={() => { setFilters(f => ({ ...f, model: "" })); setModelSearch(""); }} />}
          {filters.size && <FilterChip label={"UK " + filters.size} onRemove={() => setFilters(f => ({ ...f, size: "" }))} />}
          {filters.gender !== "All" && <FilterChip label={filters.gender} onRemove={() => setFilters(f => ({ ...f, gender: "All" }))} />}
          {filters.onSaleOnly && <FilterChip label="On Sale" onRemove={() => setFilters(f => ({ ...f, onSaleOnly: false }))} />}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px 2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600,
      background: "var(--accent-dim)", color: "var(--accent)",
      border: "1px solid rgba(0,255,135,0.2)",
    }}>
      {label}
      <button onClick={onRemove} style={{ color: "var(--accent)", fontSize: 11, opacity: 0.7, cursor: "pointer", lineHeight: 1 }}>✕</button>
    </span>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────

function MapTooltip({ region, pos, stats, colorInfo, filteredCount, totalCount }) {
  if (!region || !pos) return null;
  return (
    <div style={{
      position: "fixed", left: pos.x + 16, top: pos.y - 10,
      pointerEvents: "none", zIndex: 200,
      background: "rgba(14,14,14,0.97)",
      border: "1px solid " + colorInfo.glow + "55",
      borderRadius: 8, padding: "12px 16px", minWidth: 200,
      boxShadow: "0 0 32px " + colorInfo.glow + "18, 0 4px 24px rgba(0,0,0,0.5)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{REGIONS[region.id].flag}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{region.label}</span>
        <span style={{
          marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
          background: colorInfo.glow + "22", color: colorInfo.glow,
          border: "1px solid " + colorInfo.glow + "44", letterSpacing: "0.06em",
        }}>{colorInfo.label.toUpperCase()}</span>
      </div>

      {/* Mini stock bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: "var(--text3)" }}>Matched stock</span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: colorInfo.glow, fontWeight: 600 }}>
            {filteredCount}/{totalCount}
          </span>
        </div>
        <div style={{ height: 3, background: "#222", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: totalCount > 0 ? (filteredCount / totalCount * 100) + "%" : "0%",
            background: colorInfo.glow, transition: "width 0.3s",
          }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {[
          ["Available", stats.total + " sneakers"],
          ["UK 12 in stock", stats.size12 + " styles"],
          ["UK 13 in stock", stats.size13 + " styles"],
          ["Top brand", stats.topBrand],
          ["On sale", stats.onSale + " deals"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 11, color: "var(--text2)" }}>{k}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: colorInfo.glow, fontWeight: 600, letterSpacing: "0.06em", textAlign: "center" }}>
        CLICK TO EXPLORE →
      </div>
    </div>
  );
}

// ── Slide Panel ──────────────────────────────────────────────────

function SlidePanel({ region, filteredProducts, onClose, onNavigate }) {
  const { formatCurrency } = window.KM;
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 280); };

  const products = filteredProducts.filter(p => p.regions[region.id] && p.regions[region.id].inStock);
  const stats = getRegionStats(region.id, filteredProducts);
  const totalAll = window.KM.PRODUCTS.filter(p => p.regions[region.id] && p.regions[region.id].inStock).length;
  const colorInfo = getColorFromCount(products.length, totalAll);

  return (
    <>
      <div onClick={handleClose} style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.55)",
        opacity: visible ? 1 : 0, transition: "opacity 0.28s",
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 400, zIndex: 400,
        background: "var(--surface)", borderLeft: "1px solid var(--border)",
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.28s cubic-bezier(0.32,0,0.16,1)",
        display: "flex", flexDirection: "column",
        boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{REGIONS[region.id].flag}</span>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{region.label}</h2>
                <p style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>
                  {products.length} sneakers matched · JD Sports
                  {products.length < totalAll && (
                    <span style={{ color: "var(--text3)" }}> (of {totalAll} total)</span>
                  )}
                </p>
              </div>
            </div>
            <button onClick={handleClose} style={{
              width: 32, height: 32, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: 16,
            }}>✕</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { label: "In Stock", value: stats.total },
              { label: "On Sale", value: stats.onSale },
              { label: "Top Brand", value: stats.topBrand },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--bg)", borderRadius: 6, padding: "8px 10px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: colorInfo.glow }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Product list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
          {products.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>◎</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>No matches in {region.label}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>Try adjusting your filters</div>
            </div>
          ) : products.map(product => {
            const data = product.regions[region.id];
            return (
              <div key={product.id}
                onClick={() => { handleClose(); setTimeout(() => onNavigate("/product/" + product.id), 300); }}
                style={{
                  display: "flex", gap: 12, padding: "11px 0",
                  borderBottom: "1px solid var(--border)", cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                <div style={{ flexShrink: 0, borderRadius: 6, overflow: "hidden", background: "var(--bg)" }}>
                  <ProductImage product={product} size={62} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{product.brand}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {data.onSale ? (
                      <>
                        <span style={{ fontSize: 11, color: "var(--text3)", textDecoration: "line-through", fontFamily: "var(--font-mono)" }}>
                          {formatCurrency(data.originalPrice, data.currency)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                          {formatCurrency(data.price, data.currency)}
                        </span>
                        <SaleBadge pct={product.discountPct} />
                      </>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                        {formatCurrency(data.price, data.currency)}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 10, color: "var(--text3)" }}>
                    {data.sizes.length} sizes · {data.stock} in stock
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button onClick={() => { handleClose(); setTimeout(() => onNavigate("/compare"), 300); }}
            style={{
              width: "100%", padding: "10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(0,255,135,0.25)",
              letterSpacing: "0.06em", cursor: "pointer",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,255,135,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--accent-dim)"}
          >COMPARE ALL REGIONS →</button>
        </div>
      </div>
    </>
  );
}

// ── SVG Map ──────────────────────────────────────────────────────

function HeatmapSVG({ regionColors, onRegionClick, onRegionHover }) {
  const [hoveredId, setHoveredId] = React.useState(null);

  return (
    <svg viewBox="220 60 420 310" style={{ width: "100%", height: "100%" }} xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="800" height="600" fill="#0d1117" />
      {[...Array(8)].map((_, i) => (
        <line key={"h"+i} x1="0" y1={i*80} x2="800" y2={i*80} stroke="#161b22" strokeWidth="0.5" />
      ))}
      {[...Array(11)].map((_, i) => (
        <line key={"v"+i} x1={i*80} y1="0" x2={i*80} y2="600" stroke="#161b22" strokeWidth="0.5" />
      ))}
      {SEA_MAP.background.map(c => (
        <path key={c.id} d={c.d} fill="#1a1f2e" stroke="#252b3b" strokeWidth="0.8" />
      ))}
      {SEA_MAP.interactive.map(region => {
        const col = regionColors[region.id] || { fill: "#33333333", glow: "#555", label: "—" };
        const isHovered = hoveredId === region.id;
        const labels = { MY: [[346,215],[483,228]], ID: [[332,262],[383,301],[483,275]], SG: [[363,250]] };

        return (
          <g key={region.id}
            onMouseEnter={e => { setHoveredId(region.id); onRegionHover(region, { x: e.clientX, y: e.clientY }); }}
            onMouseMove={e => onRegionHover(region, { x: e.clientX, y: e.clientY })}
            onMouseLeave={() => { setHoveredId(null); onRegionHover(null, null); }}
            onClick={() => onRegionClick(region)}
            style={{ cursor: "pointer" }}
          >
            {isHovered && region.paths.map((d, i) => (
              <path key={"glow"+i} d={d}
                fill={col.glow + "22"} stroke={col.glow} strokeWidth="4"
                style={{ filter: "blur(7px)" }}
              />
            ))}
            {region.paths.map((d, i) => (
              <path key={i} d={d}
                fill={isHovered ? col.glow + "66" : col.fill}
                stroke={isHovered ? col.glow : col.glow + "99"}
                strokeWidth={isHovered ? 1.5 : 1}
                style={{ transition: "fill 0.25s, stroke 0.25s" }}
              />
            ))}
            {(labels[region.id] || []).map(([x, y], i) => (
              <text key={i} x={x} y={y} textAnchor="middle" fontSize="7"
                fill={isHovered ? col.glow : "#666"}
                fontFamily="var(--font-head)" fontWeight="700"
                style={{ transition: "fill 0.2s", pointerEvents: "none" }}
              >{region.id}</text>
            ))}
            {(labels[region.id] || []).slice(0,1).map(([x, y], i) => (
              <circle key={"dot"+i} cx={x} cy={y} r="3" fill={col.glow} opacity={isHovered ? 1 : 0.7} style={{ pointerEvents: "none" }} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── Main HomePage ─────────────────────────────────────────────

function HomePage({ onNavigate }) {
  const { PRODUCTS } = window.KM;

  const [filters, setFilters] = React.useState({
    brand: "", model: "", size: "", gender: "All", onSaleOnly: false,
  });
  const [tooltip, setTooltip] = React.useState({ region: null, pos: null });
  const [selectedRegion, setSelectedRegion] = React.useState(null);

  // Apply filters globally
  const filteredProducts = React.useMemo(() => applyFilters(PRODUCTS, filters), [filters]);

  // Compute per-region color based on filtered stock
  const regionColors = React.useMemo(() => {
    const cols = {};
    SEA_MAP.interactive.forEach(region => {
      const total = PRODUCTS.filter(p => p.regions[region.id] && p.regions[region.id].inStock).length;
      const matched = filteredProducts.filter(p => p.regions[region.id] && p.regions[region.id].inStock).length;
      cols[region.id] = getColorFromCount(matched, total);
    });
    return cols;
  }, [filteredProducts]);

  // Stats for tooltip
  const getTooltipData = (region) => {
    const stats = getRegionStats(region.id, filteredProducts);
    const total = PRODUCTS.filter(p => p.regions[region.id] && p.regions[region.id].inStock).length;
    const matched = filteredProducts.filter(p => p.regions[region.id] && p.regions[region.id].inStock).length;
    return { stats, colorInfo: regionColors[region.id], filteredCount: matched, totalCount: total };
  };

  const hasFilters = filters.brand || filters.model || filters.size || filters.gender !== "All" || filters.onSaleOnly;

  return (
    <div style={{ padding: "0 24px 48px" }}>
      {/* Hero */}
      <div style={{ padding: "24px 0 16px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Find your size. <span style={{ color: "var(--accent)" }}>Find the best price.</span>
          </h1>
          <p style={{ marginTop: 5, fontSize: 12, color: "var(--text2)" }}>
            Live JD Sports stock ·{" "}
            <span style={{ color: REGIONS.MY.color }}>MY</span> ·{" "}
            <span style={{ color: REGIONS.ID.color }}>ID</span> ·{" "}
            <span style={{ color: REGIONS.SG.color }}>SG</span>
            {hasFilters && (
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                {" "}· {filteredProducts.length} products matched
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {[
            { label: "Matched", value: filteredProducts.length },
            { label: "On Sale", value: filteredProducts.filter(p => p.onSaleAnywhere).length },
            { label: "Regions", value: 3 },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-mono)", color: s.label === "Matched" && hasFilters ? "var(--accent)" : "var(--text)", transition: "color 0.2s" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "var(--text2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <HeatmapFilterBar filters={filters} setFilters={setFilters} allProducts={PRODUCTS} />

      {/* Map + sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 210px", gap: 16, alignItems: "start" }}>
        <div style={{
          background: "#0d1117", border: "1px solid var(--border)",
          borderRadius: 10, overflow: "hidden", position: "relative",
          aspectRatio: "420 / 310",
        }}>
          <HeatmapSVG
            regionColors={regionColors}
            onRegionClick={r => setSelectedRegion(r)}
            onRegionHover={(r, pos) => setTooltip({ region: r, pos })}
          />
          <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 9, color: "#2a2a2a", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
            SOUTHEAST ASIA · JD SPORTS
          </div>
        </div>

        {/* Right: legend + region cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text3)", textTransform: "uppercase", marginBottom: 9 }}>Availability</div>
            {[
              { color: "#00ff87", label: "High stock" },
              { color: "#22c55e", label: "Medium" },
              { color: "#f59e0b", label: "Low stock" },
              { color: "#ef4444", label: "No match" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }}></div>
                <span style={{ fontSize: 10, color: "var(--text2)" }}>{item.label}</span>
              </div>
            ))}
          </div>

          {SEA_MAP.interactive.map(region => {
            const col = regionColors[region.id];
            const stats = getRegionStats(region.id, filteredProducts);
            const totalAll = PRODUCTS.filter(p => p.regions[region.id] && p.regions[region.id].inStock).length;
            const pct = totalAll > 0 ? stats.total / totalAll : 0;
            return (
              <div key={region.id} onClick={() => setSelectedRegion(region)}
                style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderLeft: "3px solid " + col.glow,
                  borderRadius: 8, padding: "11px 12px", cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 13 }}>{REGIONS[region.id].flag}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{region.label}</span>
                  </div>
                  <span style={{ fontSize: 9, color: col.glow, fontWeight: 700, letterSpacing: "0.05em" }}>{col.label.toUpperCase()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-mono)", color: col.glow }}>{stats.total}</span>
                  {hasFilters && <span style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>/ {totalAll}</span>}
                </div>
                {/* Mini bar */}
                <div style={{ height: 2, background: "#222", borderRadius: 1, overflow: "hidden", marginBottom: 5 }}>
                  <div style={{ height: "100%", width: (pct * 100) + "%", background: col.glow, borderRadius: 1, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 9, color: "var(--text3)" }}>sneakers in stock</div>
                {stats.onSale > 0 && <div style={{ fontSize: 9, color: "var(--accent)", fontWeight: 600, marginTop: 3 }}>{stats.onSale} on sale</div>}
              </div>
            );
          })}

          <button onClick={() => onNavigate("/compare")} style={{
            padding: "9px", borderRadius: 6, fontSize: 10, fontWeight: 700,
            background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)",
            letterSpacing: "0.07em", cursor: "pointer", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "rgba(0,255,135,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >COMPARE PRICES →</button>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.region && tooltip.pos && (() => {
        const { stats, colorInfo, filteredCount, totalCount } = getTooltipData(tooltip.region);
        return (
          <MapTooltip
            region={tooltip.region} pos={tooltip.pos}
            stats={stats} colorInfo={colorInfo}
            filteredCount={filteredCount} totalCount={totalCount}
          />
        );
      })()}

      {/* Slide panel */}
      {selectedRegion && (
        <SlidePanel
          region={selectedRegion}
          filteredProducts={filteredProducts}
          onClose={() => setSelectedRegion(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

Object.assign(window, { HomePage });
