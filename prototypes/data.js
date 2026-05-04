// KickMap — Mock Data
const PRODUCTS = [
  {
    id: "NK-AM90-001",
    name: "Air Max 90",
    brand: "Nike",
    gender: "Men",
    image: null,
    colorway: "White / Wolf Grey",
    regions: {
      MY: { price: 599, originalPrice: 749, currency: "MYR", inStock: true, onSale: true, stock: 24, sizes: ["6","7","7.5","8","8.5","9","10","11"] },
      ID: { price: 1850000, originalPrice: 1850000, currency: "IDR", inStock: true, onSale: false, stock: 15, sizes: ["6","7","8","9","10","11","12"] },
      SG: { price: 189, originalPrice: 229, currency: "SGD", inStock: true, onSale: true, stock: 7, sizes: ["7","8","9","10"] },
    },
    lowestSGD: 189,
    onSaleAnywhere: true,
    discountPct: 25,
  },
  {
    id: "AD-UB22-002",
    name: "Ultraboost 22",
    brand: "Adidas",
    gender: "Men",
    image: null,
    colorway: "Core Black / Carbon",
    regions: {
      MY: { price: 649, originalPrice: 649, currency: "MYR", inStock: true, onSale: false, stock: 32, sizes: ["7","8","8.5","9","10","11"] },
      ID: { price: 2100000, originalPrice: 2100000, currency: "IDR", inStock: false, onSale: false, stock: 0, sizes: [] },
      SG: { price: 220, originalPrice: 220, currency: "SGD", inStock: true, onSale: false, stock: 18, sizes: ["7","8","9","10","11"] },
    },
    lowestSGD: 220,
    onSaleAnywhere: false,
    discountPct: 0,
  },
  {
    id: "NK-DUNK-003",
    name: "Dunk Low",
    brand: "Nike",
    gender: "Men",
    image: null,
    colorway: "Panda Black / White",
    regions: {
      MY: { price: 479, originalPrice: 479, currency: "MYR", inStock: false, onSale: false, stock: 0, sizes: [] },
      ID: { price: 1650000, originalPrice: 2100000, currency: "IDR", inStock: true, onSale: true, stock: 5, sizes: ["8","9","10"] },
      SG: { price: 199, originalPrice: 199, currency: "SGD", inStock: true, onSale: false, stock: 22, sizes: ["6","7","8","9","10","11","12"] },
    },
    lowestSGD: 165,
    onSaleAnywhere: true,
    discountPct: 21,
  },
  {
    id: "NB-990V5-004",
    name: "990v5",
    brand: "New Balance",
    gender: "Men",
    image: null,
    colorway: "Marblehead / Silver",
    regions: {
      MY: { price: 749, originalPrice: 749, currency: "MYR", inStock: true, onSale: false, stock: 11, sizes: ["7","8","9","10","11"] },
      ID: { price: 2450000, originalPrice: 2450000, currency: "IDR", inStock: true, onSale: false, stock: 8, sizes: ["8","9","10"] },
      SG: { price: 250, originalPrice: 250, currency: "SGD", inStock: true, onSale: false, stock: 14, sizes: ["7","8","9","10","11","12"] },
    },
    lowestSGD: 250,
    onSaleAnywhere: false,
    discountPct: 0,
  },
  {
    id: "PU-RS-005",
    name: "RS-X3",
    brand: "Puma",
    gender: "Women",
    image: null,
    colorway: "White / Puma Silver",
    regions: {
      MY: { price: 399, originalPrice: 499, currency: "MYR", inStock: true, onSale: true, stock: 19, sizes: ["4","5","6","7","8"] },
      ID: { price: 1250000, originalPrice: 1450000, currency: "IDR", inStock: true, onSale: true, stock: 3, sizes: ["5","6","7"] },
      SG: { price: 129, originalPrice: 129, currency: "SGD", inStock: false, onSale: false, stock: 0, sizes: [] },
    },
    lowestSGD: 109,
    onSaleAnywhere: true,
    discountPct: 20,
  },
  {
    id: "AD-SB-006",
    name: "Samba OG",
    brand: "Adidas",
    gender: "Unisex",
    image: null,
    colorway: "Core Black / Gum",
    regions: {
      MY: { price: 549, originalPrice: 549, currency: "MYR", inStock: true, onSale: false, stock: 45, sizes: ["6","7","8","9","10","11","12"] },
      ID: { price: 1800000, originalPrice: 1800000, currency: "IDR", inStock: true, onSale: false, stock: 28, sizes: ["7","8","9","10","11"] },
      SG: { price: 180, originalPrice: 180, currency: "SGD", inStock: true, onSale: false, stock: 33, sizes: ["6","7","8","9","10","11"] },
    },
    lowestSGD: 180,
    onSaleAnywhere: false,
    discountPct: 0,
  },
  {
    id: "NK-TF-007",
    name: "Air Force 1 '07",
    brand: "Nike",
    gender: "Women",
    image: null,
    colorway: "Triple White",
    regions: {
      MY: { price: 449, originalPrice: 449, currency: "MYR", inStock: true, onSale: false, stock: 60, sizes: ["4","5","6","7","8","9"] },
      ID: { price: 1500000, originalPrice: 1900000, currency: "IDR", inStock: true, onSale: true, stock: 9, sizes: ["5","6","7","8"] },
      SG: { price: 159, originalPrice: 189, currency: "SGD", inStock: true, onSale: true, stock: 14, sizes: ["5","6","7","8","9"] },
    },
    lowestSGD: 143,
    onSaleAnywhere: true,
    discountPct: 16,
  },
  {
    id: "NB-550-008",
    name: "550",
    brand: "New Balance",
    gender: "Women",
    image: null,
    colorway: "White / Green",
    regions: {
      MY: { price: 529, originalPrice: 529, currency: "MYR", inStock: false, onSale: false, stock: 0, sizes: [] },
      ID: { price: 1700000, originalPrice: 1700000, currency: "IDR", inStock: true, onSale: false, stock: 21, sizes: ["5","6","7","8"] },
      SG: { price: 175, originalPrice: 175, currency: "SGD", inStock: true, onSale: false, stock: 17, sizes: ["5","6","7","8","9"] },
    },
    lowestSGD: 175,
    onSaleAnywhere: false,
    discountPct: 0,
  },
  {
    id: "RK-CL-009",
    name: "Classic Leather",
    brand: "Reebok",
    gender: "Unisex",
    image: null,
    colorway: "White / Light Grey",
    regions: {
      MY: { price: 319, originalPrice: 419, currency: "MYR", inStock: true, onSale: true, stock: 8, sizes: ["7","8","9","10","11"] },
      ID: { price: 990000, originalPrice: 1290000, currency: "IDR", inStock: true, onSale: true, stock: 12, sizes: ["7","8","9","10"] },
      SG: { price: 99, originalPrice: 139, currency: "SGD", inStock: true, onSale: true, stock: 6, sizes: ["8","9","10"] },
    },
    lowestSGD: 99,
    onSaleAnywhere: true,
    discountPct: 29,
  },
  {
    id: "AD-YZ-010",
    name: "Yeezy Boost 350 V2",
    brand: "Adidas",
    gender: "Men",
    image: null,
    colorway: "Zebra",
    regions: {
      MY: { price: 1199, originalPrice: 1199, currency: "MYR", inStock: true, onSale: false, stock: 4, sizes: ["8","9","10"] },
      ID: { price: 3900000, originalPrice: 3900000, currency: "IDR", inStock: false, onSale: false, stock: 0, sizes: [] },
      SG: { price: 380, originalPrice: 380, currency: "SGD", inStock: true, onSale: false, stock: 2, sizes: ["9","10"] },
    },
    lowestSGD: 338,
    onSaleAnywhere: false,
    discountPct: 0,
  },
  {
    id: "NK-JF1-011",
    name: "Jordan 1 Retro High OG",
    brand: "Jordan",
    gender: "Men",
    image: null,
    colorway: "Chicago Lost & Found",
    regions: {
      MY: { price: 1099, originalPrice: 1099, currency: "MYR", inStock: true, onSale: false, stock: 3, sizes: ["8","9","10","11"] },
      ID: { price: 3500000, originalPrice: 3500000, currency: "IDR", inStock: true, onSale: false, stock: 6, sizes: ["8","9","10"] },
      SG: { price: 319, originalPrice: 319, currency: "SGD", inStock: false, onSale: false, stock: 0, sizes: [] },
    },
    lowestSGD: 296,
    onSaleAnywhere: false,
    discountPct: 0,
  },
  {
    id: "VN-OS-012",
    name: "Old Skool",
    brand: "Vans",
    gender: "Unisex",
    image: null,
    colorway: "Black / White",
    regions: {
      MY: { price: 279, originalPrice: 279, currency: "MYR", inStock: true, onSale: false, stock: 75, sizes: ["5","6","7","8","9","10","11","12"] },
      ID: { price: 899000, originalPrice: 1099000, currency: "IDR", inStock: true, onSale: true, stock: 40, sizes: ["6","7","8","9","10","11"] },
      SG: { price: 99, originalPrice: 99, currency: "SGD", inStock: true, onSale: false, stock: 55, sizes: ["5","6","7","8","9","10","11"] },
    },
    lowestSGD: 82,
    onSaleAnywhere: true,
    discountPct: 18,
  },
];

const FX = {
  MYR_SGD: 0.3157,
  IDR_SGD: 0.000082,
  USD_SGD: 1.35,
  MYR_USD: 0.2338,
  IDR_USD: 0.0000607,
};

function toSGD(price, currency) {
  if (currency === "SGD") return price;
  if (currency === "MYR") return price * FX.MYR_SGD;
  if (currency === "IDR") return price * FX.IDR_SGD;
  return price;
}

function formatCurrency(price, currency) {
  if (currency === "SGD") return `S$${price.toFixed(0)}`;
  if (currency === "MYR") return `RM${price.toFixed(0)}`;
  if (currency === "IDR") return `Rp${(price/1000).toFixed(0)}K`;
  if (currency === "USD") return `US$${price.toFixed(0)}`;
  return price;
}

const BRANDS = [...new Set(PRODUCTS.map(p => p.brand))];
const LAST_UPDATED = "2h ago";
const SIZES_UK = ["3","3.5","4","4.5","5","5.5","6","6.5","7","7.5","8","8.5","9","9.5","10","10.5","11","11.5","12","13","14","15"];

// Export
if (typeof window !== 'undefined') {
  window.KM = { PRODUCTS, FX, toSGD, formatCurrency, BRANDS, LAST_UPDATED, SIZES_UK };
}
