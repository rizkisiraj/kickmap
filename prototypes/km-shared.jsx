// KickMap Shared Components & Config

const REGIONS = {
  MY: { label: "MY", color: "#3b82f6", dim: "rgba(59,130,246,0.15)", name: "Malaysia", flag: "🇲🇾", currency: "MYR" },
  ID: { label: "ID", color: "#ef4444", dim: "rgba(239,68,68,0.15)", name: "Indonesia", flag: "🇮🇩", currency: "IDR" },
  SG: { label: "SG", color: "#f59e0b", dim: "rgba(245,158,11,0.15)", name: "Singapore", flag: "🇸🇬", currency: "SGD" },
};

function RegionBadge({ region, size }) {
  const s = size || "sm";
  const r = REGIONS[region];
  const pad = s === "sm" ? "2px 7px" : "3px 10px";
  const fs = s === "sm" ? "10px" : "11px";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: pad, borderRadius: 99, fontSize: fs,
      fontWeight: 700, letterSpacing: "0.06em", fontFamily: "var(--font-head)",
      background: r.dim, color: r.color, border: "1px solid " + r.color + "33",
    }}>{r.label}</span>
  );
}

function SaleBadge({ pct, size }) {
  const s = size || "sm";
  const pad = s === "sm" ? "2px 7px" : "3px 10px";
  const fs = s === "sm" ? "10px" : "11px";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: pad, borderRadius: 99, fontSize: fs,
      fontWeight: 700, letterSpacing: "0.07em",
      background: "rgba(0,255,135,0.12)", color: "#00ff87",
      border: "1px solid rgba(0,255,135,0.3)",
    }}>{"SALE" + (pct ? " −" + pct + "%" : "")}</span>
  );
}

function RegionDot({ region, active }) {
  const r = REGIONS[region];
  return (
    <span title={r.name + ": " + (active ? "In Stock" : "Out of Stock")} style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: active ? r.color : "transparent",
      border: "1.5px solid " + (active ? r.color : "#444"),
      flexShrink: 0,
    }}></span>
  );
}

function SizeChip({ size, available }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 38, height: 28, borderRadius: 4, fontSize: 11,
      fontWeight: 600, fontFamily: "var(--font-mono)",
      background: available ? "rgba(240,240,240,0.1)" : "rgba(255,255,255,0.03)",
      color: available ? "#f0f0f0" : "#444",
      border: "1px solid " + (available ? "#3a3a3a" : "#1e1e1e"),
    }}>{size}</span>
  );
}

function LowStockIndicator({ stock }) {
  if (!stock || stock === 0 || stock > 10) return null;
  const pct = Math.min(100, (stock / 10) * 100);
  const col = stock <= 3 ? "#ef4444" : "#f59e0b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 40, height: 3, background: "#222", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: col, borderRadius: 2 }}></div>
      </div>
      <span style={{ fontSize: 10, color: col, fontWeight: 600, letterSpacing: "0.05em" }}>
        {stock <= 3 ? "ONLY " + stock + " LEFT" : "LOW STOCK"}
      </span>
    </div>
  );
}

function ProductImage({ product, size }) {
  const sz = size || 160;
  return (
    <div style={{
      width: sz, height: sz, flexShrink: 0,
      background: "repeating-linear-gradient(135deg, #1a1a1a 0px, #1a1a1a 10px, #161616 10px, #161616 20px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      <svg width={sz * 0.45} height={sz * 0.25} viewBox="0 0 90 50" fill="none">
        <ellipse cx="45" cy="35" rx="44" ry="10" fill="#222" />
        <path d="M5 35 Q15 10 35 12 Q50 14 60 20 Q75 28 80 30 Q85 32 85 35 Z" fill="#2a2a2a" stroke="#333" strokeWidth="1"/>
        <path d="M25 18 L45 14 L55 22 L30 24 Z" fill="#333"/>
        <path d="M35 12 Q42 8 52 13" stroke="#3a3a3a" strokeWidth="1.5" fill="none"/>
      </svg>
      <span style={{ fontSize: 9, color: "#444", fontFamily: "var(--font-mono)", marginTop: 6, textAlign: "center", padding: "0 8px", lineHeight: 1.3 }}>
        {product.colorway}
      </span>
    </div>
  );
}

function PriceDisplay({ original, current, currency, accent }) {
  const useAccent = accent !== false;
  const isDiscount = original > current;
  const { formatCurrency } = window.KM;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, fontFamily: "var(--font-mono)" }}>
      {isDiscount && (
        <span style={{ color: "var(--text3)", fontSize: "0.85em", textDecoration: "line-through" }}>
          {formatCurrency(original, currency)}
        </span>
      )}
      <span style={{ color: useAccent && isDiscount ? "var(--accent)" : "var(--text)", fontWeight: 600 }}>
        {formatCurrency(current, currency)}
      </span>
    </span>
  );
}

function ProductCard({ product, onNavigate }) {
  const [hovered, setHovered] = React.useState(false);
  const stockTotal = Object.values(product.regions).reduce((a, r) => a + r.stock, 0);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onNavigate("/product/" + product.id)}
      style={{
        background: hovered ? "var(--surface2)" : "var(--surface)",
        border: "1px solid " + (hovered ? "var(--border2)" : "var(--border)"),
        borderRadius: "var(--radius)", cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, transform 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", width: "100%" }}>
        <div style={{ width: "100%", paddingBottom: "100%", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <ProductImage product={product} size={300} />
          </div>
        </div>
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {product.onSaleAnywhere && <SaleBadge pct={product.discountPct} />}
          {stockTotal <= 10 && stockTotal > 0 && (
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 700, letterSpacing: "0.06em" }}>LOW STOCK</span>
          )}
        </div>
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{product.brand}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>{product.name}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{product.colorway}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {["MY","ID","SG"].map(r => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <RegionDot region={r} active={product.regions[r] && product.regions[r].inStock} />
              <span style={{ fontSize: 10, color: (product.regions[r] && product.regions[r].inStock) ? "var(--text2)" : "var(--text3)", fontWeight: 600 }}>{r}</span>
            </div>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text3)" }}>{product.gender}</span>
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 1 }}>FROM</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>S${product.lowestSGD}</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, letterSpacing: "0.04em" }}>VIEW →</div>
        </div>
      </div>
    </div>
  );
}

function Navbar({ currentPage, onNavigate }) {
  const navLinks = [
    { href: "/", label: "HEATMAP" },
    { href: "/deals", label: "DEALS" },
    { href: "/compare", label: "COMPARE" },
    { href: "/size-finder", label: "SIZE FINDER" },
  ];
  const { LAST_UPDATED } = window.KM;
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(10,10,10,0.92)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 24px", height: 52,
    }}>
      <button onClick={() => onNavigate("/")} style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 32, padding: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#0a0a0a", fontFamily: "var(--font-head)", letterSpacing: "-0.04em" }}>KM</span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>KickMap</span>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
        {navLinks.map(l => {
          const active = currentPage === l.href || (l.href !== "/" && currentPage.startsWith(l.href));
          return (
            <button key={l.href} onClick={() => onNavigate(l.href)} style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", borderRadius: 4,
              color: active ? "var(--accent)" : "var(--text2)",
              background: active ? "var(--accent-dim)" : "transparent",
              transition: "color 0.15s, background 0.15s",
            }}>{l.label}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>⟳ {LAST_UPDATED}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text2)" }}>🌐</span>
          {["MY","ID","SG"].map(r => (
            <span key={r} style={{ fontSize: 10, fontWeight: 700, color: REGIONS[r].color, letterSpacing: "0.04em" }}>{r}</span>
          ))}
        </div>
      </div>
    </nav>
  );
}

function FilterBar({ regionFilter, setRegionFilter, genderFilter, setGenderFilter, brandSearch, setBrandSearch }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 0", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 2, padding: "3px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
        {["All","MY","ID","SG"].map(r => {
          const active = regionFilter === r;
          const col = r !== "All" ? REGIONS[r] : null;
          return (
            <button key={r} onClick={() => setRegionFilter(r)} style={{
              padding: "4px 11px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              background: active ? (col ? col.dim : "var(--surface2)") : "transparent",
              color: active ? (col ? col.color : "var(--text)") : "var(--text2)",
              border: active ? ("1px solid " + (col ? col.color + "44" : "var(--border2)")) : "1px solid transparent",
              transition: "all 0.15s",
            }}>{r}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 2, padding: "3px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
        {["All","Men","Women","Unisex"].map(g => (
          <button key={g} onClick={() => setGenderFilter(g)} style={{
            padding: "4px 11px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
            background: genderFilter === g ? "var(--surface2)" : "transparent",
            color: genderFilter === g ? "var(--text)" : "var(--text2)",
            border: genderFilter === g ? "1px solid var(--border2)" : "1px solid transparent",
            transition: "all 0.15s",
          }}>{g}</button>
        ))}
      </div>
      <div style={{ position: "relative", marginLeft: "auto" }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 13 }}>⌕</span>
        <input value={brandSearch} onChange={e => setBrandSearch(e.target.value)} placeholder="Search brand or name..."
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px 6px 28px", fontSize: 12, color: "var(--text)", width: 220 }} />
      </div>
    </div>
  );
}

Object.assign(window, { REGIONS, RegionBadge, SaleBadge, RegionDot, SizeChip, LowStockIndicator, ProductImage, PriceDisplay, ProductCard, Navbar, FilterBar });
