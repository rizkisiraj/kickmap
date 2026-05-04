// KickMap Pages: SizeFinder, Brand, ProductDetail

function SizeFinderPage({ onNavigate }) {
  const { PRODUCTS, formatCurrency, SIZES_UK } = window.KM;
  const [selectedSize, setSelectedSize] = React.useState(null);

  const results = selectedSize
    ? PRODUCTS.filter(p => Object.values(p.regions).some(r => r.inStock && r.sizes.includes(selectedSize)))
    : [];

  return (
    <div style={{ padding: "0 24px 48px" }}>
      <div style={{ padding: "28px 0 20px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>Size Finder</h1>
        <p style={{ fontSize: 13, color: "var(--text2)" }}>Pick your UK size — see what's available across MY · ID · SG</p>
      </div>

      <div style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text2)", textTransform: "uppercase", marginBottom: 12 }}>UK SIZE</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SIZES_UK.map(s => {
            const hasStock = PRODUCTS.some(p => Object.values(p.regions).some(r => r.inStock && r.sizes.includes(s)));
            const selected = selectedSize === s;
            return (
              <button key={s} onClick={() => setSelectedSize(selected ? null : s)} style={{
                width: 52, height: 40, borderRadius: 6, fontSize: 13, fontWeight: 700,
                fontFamily: "var(--font-mono)",
                background: selected ? "var(--accent)" : hasStock ? "var(--surface2)" : "rgba(255,255,255,0.02)",
                color: selected ? "var(--bg)" : hasStock ? "var(--text)" : "var(--text3)",
                border: "1.5px solid " + (selected ? "var(--accent)" : hasStock ? "var(--border2)" : "var(--border)"),
                transition: "all 0.15s",
                cursor: hasStock ? "pointer" : "default",
              }}>{s}</button>
            );
          })}
        </div>
      </div>

      {selectedSize === null ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>↑</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text2)" }}>Select a size above to see available shoes</div>
        </div>
      ) : results.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text2)" }}>No shoes found in UK {selectedSize} across MY, ID, SG</div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 6 }}>Try an adjacent size</div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: "var(--text2)" }}>
            <span style={{ color: "var(--accent)", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 16 }}>{results.length}</span>
            {" "}shoes available in UK{" "}
            <span style={{ color: "var(--text)", fontWeight: 700 }}>{selectedSize}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {results.map(product => {
              const availableIn = Object.entries(product.regions).filter(([, r]) => r.inStock && r.sizes.includes(selectedSize));
              return (
                <div key={product.id} onClick={() => onNavigate("/product/" + product.id)}
                  style={{
                    display: "flex", background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: "var(--radius)",
                    overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border2)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                >
                  <div style={{ flexShrink: 0 }}><ProductImage product={product} size={96} /></div>
                  <div style={{ padding: "12px 14px", flex: 1 }}>
                    <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{product.brand}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{product.name}</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {availableIn.map(([r, data]) => (
                        <div key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <RegionBadge region={r} />
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, color: data.onSale ? "var(--accent)" : "var(--text)" }}>
                            {formatCurrency(data.price, data.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BrandPage({ brand, onNavigate }) {
  const { PRODUCTS } = window.KM;
  const products = PRODUCTS.filter(p => p.brand === brand);
  const saleCount = products.filter(p => p.onSaleAnywhere).length;

  return (
    <div style={{ padding: "0 24px 48px" }}>
      <div style={{ padding: "32px 0 24px", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        <button onClick={() => onNavigate("/")} style={{ fontSize: 11, color: "var(--text2)", marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
          ← All Products
        </button>
        <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", textTransform: "uppercase", lineHeight: 1 }}>{brand}</h1>
        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text2)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)" }}>{products.length}</span> products
          </span>
          <span style={{ color: "var(--text3)" }}>·</span>
          <span style={{ fontSize: 12, color: "var(--text2)" }}>In stock across 3 regions</span>
          {saleCount > 0 && (
            <>
              <span style={{ color: "var(--text3)" }}>·</span>
              <span style={{ fontSize: 12, color: "var(--accent)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{saleCount}</span> on sale
              </span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
        {products.map(p => <ProductCard key={p.id} product={p} onNavigate={onNavigate} />)}
      </div>
    </div>
  );
}

function ProductDetailPage({ productId, onNavigate }) {
  const { PRODUCTS, toSGD, formatCurrency, LAST_UPDATED } = window.KM;
  const product = PRODUCTS.find(p => p.id === productId);
  const [selectedRegion, setSelectedRegion] = React.useState("MY");

  if (!product) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 15, color: "var(--text2)" }}>Product not found</div>
        <button onClick={() => onNavigate("/")} style={{ marginTop: 16, color: "var(--accent)", fontSize: 13 }}>← Back to home</button>
      </div>
    );
  }

  const allSizes = [...new Set(Object.values(product.regions).flatMap(r => r.sizes))].sort((a, b) => parseFloat(a) - parseFloat(b));
  const pricesSGD = {};
  Object.entries(product.regions).forEach(([r, data]) => {
    if (data.inStock) pricesSGD[r] = toSGD(data.price, data.currency);
  });
  const vals = Object.values(pricesSGD);
  const minSGD = vals.length ? Math.min(...vals) : 0;
  const maxSGD = vals.length ? Math.max(...vals) : 0;
  const savings = maxSGD - minSGD;
  const cheapestEntry = Object.entries(pricesSGD).find(([, v]) => v === minSGD);
  const cheapestRegion = cheapestEntry ? cheapestEntry[0] : null;

  return (
    <div style={{ padding: "0 24px 48px" }}>
      <button onClick={() => onNavigate("/")} style={{ fontSize: 11, color: "var(--text2)", marginTop: 20, marginBottom: 20, display: "flex", alignItems: "center", gap: 4 }}>
        ← Back
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 32, alignItems: "start" }}>
        {/* Left: image */}
        <div style={{ position: "sticky", top: 72 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ width: "100%", paddingBottom: "100%", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ProductImage product={product} size={400} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: info */}
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => onNavigate("/brand/" + product.brand)} style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
              background: "var(--surface2)", border: "1px solid var(--border2)",
              color: "var(--text2)", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
            }}>{product.brand}</button>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}>
              {product.gender}
            </span>
            {product.onSaleAnywhere && <SaleBadge pct={product.discountPct} size="md" />}
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 4 }}>{product.name}</h1>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>{product.colorway}</div>

          {cheapestRegion && savings > 1 && (
            <div style={{ padding: "14px 16px", background: "var(--accent-dim)", border: "1px solid rgba(0,255,135,0.25)", borderRadius: 8, marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.08em", marginBottom: 4 }}>BEST DEAL</div>
              <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>
                Cheapest in{" "}
                <span style={{ color: REGIONS[cheapestRegion].color }}>{REGIONS[cheapestRegion].name}</span>
                {" at "}
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>S${minSGD.toFixed(0)}</span>
                {" — "}
                <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>save S${savings.toFixed(0)}</span>
                {" vs other regions"}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text2)", textTransform: "uppercase", marginBottom: 12 }}>
              Availability by Region
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {["MY","ID","SG"].map(r => {
                const data = product.regions[r];
                const isCheapest = cheapestRegion === r;
                return (
                  <div key={r} onClick={() => data.inStock && setSelectedRegion(r)}
                    style={{
                      padding: "14px",
                      background: selectedRegion === r ? "var(--surface2)" : "var(--surface)",
                      border: "1px solid " + (isCheapest ? "rgba(0,255,135,0.3)" : selectedRegion === r ? "var(--border2)" : "var(--border)"),
                      borderRadius: 8, cursor: data.inStock ? "pointer" : "default",
                      transition: "all 0.15s", opacity: data.inStock ? 1 : 0.5,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{REGIONS[r].flag}</span>
                        <RegionBadge region={r} />
                      </div>
                      {isCheapest && <span style={{ fontSize: 9, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em" }}>CHEAPEST</span>}
                    </div>
                    {data.inStock ? (
                      <PriceDisplay original={data.originalPrice} current={data.price} currency={data.currency} />
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>OUT OF STOCK</span>
                    )}
                    {data.inStock && <LowStockIndicator stock={data.stock} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text2)", textTransform: "uppercase", marginBottom: 10 }}>
              SIZES — {REGIONS[selectedRegion].flag} {selectedRegion}
              {!product.regions[selectedRegion].inStock && <span style={{ color: "var(--text3)", fontWeight: 400 }}> (not available)</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {allSizes.map(s => {
                const avail = product.regions[selectedRegion] && product.regions[selectedRegion].inStock && product.regions[selectedRegion].sizes.includes(s);
                return <SizeChip key={s} size={s} available={avail} />;
              })}
            </div>
          </div>

          <div style={{ marginTop: 32, fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-mono)", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            Last scraped · {LAST_UPDATED} · JD Sports MY, ID, SG
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SizeFinderPage, BrandPage, ProductDetailPage });
