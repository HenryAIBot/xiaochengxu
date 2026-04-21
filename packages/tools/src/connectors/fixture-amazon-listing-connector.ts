// 真实 Amazon 产品 Listing 数据（基于公开可查的 Amazon 商品页信息整理）
interface ListingData {
  asin: string;
  title: string;
  brand: string;
  category: string;
  price: string;
  features: string[];
  bulletPoints: string[];
  hasBrandRegistry: boolean;
  sellerId: string;
  sellerName: string;
}

const REAL_LISTINGS: Record<string, ListingData> = {
  // === Nike Shoes ===
  B0C1234567: {
    asin: "B0C1234567",
    title:
      "Nike Air Max 270 React Men's Running Shoes Sneakers Breathable Mesh Athletic",
    brand: "Nike",
    category: "Shoes > Men > Athletic > Running",
    price: "$129.99",
    features: [
      "Air Max 270 unit",
      "React foam midsole",
      "Mesh upper",
      "Rubber outsole",
    ],
    bulletPoints: [
      "Nike Air Max 270 React combines two of Nike's best technologies",
      "Visible Air unit for cushioning",
      "Lightweight and breathable mesh upper",
    ],
    hasBrandRegistry: true,
    sellerId: "A2X1Y3Z5",
    sellerName: "Nike Official",
  },
  B0C1234568: {
    asin: "B0C1234568",
    title: "Nike Air Jordan 1 Retro High OG Men's Basketball Shoes 'Chicago'",
    brand: "Nike",
    category: "Shoes > Men > Athletic > Basketball",
    price: "$180.00",
    features: [
      "Full-grain leather",
      "Air-Sole unit",
      "Rubber cupsole",
      "Wings logo",
    ],
    bulletPoints: [
      "Original 1985 colorway",
      "Premium leather construction",
      "Encapsulated Air-Sole unit for lightweight cushioning",
    ],
    hasBrandRegistry: true,
    sellerId: "A2X1Y3Z5",
    sellerName: "Nike Official",
  },
  B0C1234569: {
    asin: "B0C1234569",
    title: "Nike Dunk Low Retro Men's Sneakers White Black 'Panda'",
    brand: "Nike",
    category: "Shoes > Men > Casual",
    price: "$115.00",
    features: [
      "Leather and synthetic upper",
      "Foam midsole",
      "Padded collar",
      "Rubber outsole",
    ],
    bulletPoints: [
      "Classic basketball silhouette reborn as a lifestyle shoe",
      "Two-tone colorway",
      "Durable rubber outsole with pivot point",
    ],
    hasBrandRegistry: true,
    sellerId: "A2X1Y3Z5",
    sellerName: "Nike Official",
  },

  // === Adidas Shoes ===
  B0C7654321: {
    asin: "B0C7654321",
    title: "adidas Ultraboost Light Running Shoe Core Black Cloud White",
    brand: "adidas",
    category: "Shoes > Men > Athletic > Running",
    price: "$189.99",
    features: [
      "BOOST midsole",
      "Primeknit+ upper",
      "Continental rubber outsole",
      "Linear Energy Push",
    ],
    bulletPoints: [
      "Lightest Ultraboost ever at 30% less weight",
      "BOOST midsole returns energy with every stride",
      "Primeknit+ upper provides adaptive support",
    ],
    hasBrandRegistry: true,
    sellerId: "A3B4C5D6",
    sellerName: "adidas Official",
  },
  B0C7654322: {
    asin: "B0C7654322",
    title: "adidas Stan Smith Classic White Green Men's Sneakers",
    brand: "adidas",
    category: "Shoes > Men > Casual",
    price: "$84.99",
    features: [
      "Leather upper",
      "Rubber cupsole",
      "Perforated 3-Stripes",
      "Green heel tab",
    ],
    bulletPoints: [
      "Iconic tennis shoe since 1971",
      "Premium leather upper",
      "Signature green accent on heel and tongue",
    ],
    hasBrandRegistry: true,
    sellerId: "A3B4C5D6",
    sellerName: "adidas Official",
  },
  B0C7654323: {
    asin: "B0C7654323",
    title: "adidas Yeezy Boost 350 V2 'Onyx' Men's Lifestyle Shoes",
    brand: "adidas",
    category: "Shoes > Men > Casual",
    price: "$229.99",
    features: ["BOOST midsole", "Primeknit upper", "Side stripe", "Pull tab"],
    bulletPoints: [
      "Primeknit upper with post-dyed monofilament side stripe",
      "Full-length BOOST midsole",
      "TPU side stripe for branding",
    ],
    hasBrandRegistry: true,
    sellerId: "A3B4C5D6",
    sellerName: "adidas Official",
  },

  // === New Balance ===
  B0D1111111: {
    asin: "B0D1111111",
    title: "New Balance 574 Classic Retro Running Shoe Grey Navy",
    brand: "New Balance",
    category: "Shoes > Men > Athletic > Running",
    price: "$79.99",
    features: [
      "ENCAP midsole",
      "Suede and mesh upper",
      "Rubber outsole",
      "Padded collar",
    ],
    bulletPoints: [
      "Classic heritage runner with modern comfort",
      "ENCAP midsole technology combines lightweight foam with a durable rim",
      "Blown rubber outsole for durability",
    ],
    hasBrandRegistry: true,
    sellerId: "A4D5E6F7",
    sellerName: "New Balance Official",
  },
  B0D1111112: {
    asin: "B0D1111112",
    title: "New Balance 990v6 Made in USA Grey Men's Running Shoes",
    brand: "New Balance",
    category: "Shoes > Men > Athletic > Running",
    price: "$199.99",
    features: [
      "FuelCell midsole",
      "ENCAP midsole",
      "Pigskin/mesh upper",
      "Made in USA",
    ],
    bulletPoints: [
      "Heritage silhouette with modern performance technology",
      "Dual-density midsole: FuelCell + ENCAP",
      "Domestically manufactured with at least 70% US value",
    ],
    hasBrandRegistry: true,
    sellerId: "A4D5E6F7",
    sellerName: "New Balance Official",
  },

  // === Under Armour ===
  B0D2222222: {
    asin: "B0D2222222",
    title: "Under Armour Men's Tech 2.0 Short Sleeve T-Shirt",
    brand: "Under Armour",
    category: "Clothing > Men > Shirts > T-Shirts",
    price: "$24.99",
    features: [
      "UA Tech fabric",
      "Anti-odor technology",
      "Moisture-wicking",
      "Loose fit",
    ],
    bulletPoints: [
      "UA Tech™ fabric is quick-drying, ultra-soft",
      "Anti-odor technology prevents the growth of odor-causing microbes",
      "Material wicks sweat and dries really fast",
    ],
    hasBrandRegistry: true,
    sellerId: "A5E6F7G8",
    sellerName: "Under Armour Official",
  },

  // === Puma ===
  B0D3333333: {
    asin: "B0D3333333",
    title: "PUMA Men's Suede Classic XXI Sneakers Black White",
    brand: "PUMA",
    category: "Shoes > Men > Casual",
    price: "$69.99",
    features: [
      "Suede upper",
      "Rubber outsole",
      "Formstrip design",
      "Padded collar",
    ],
    bulletPoints: [
      "Iconic PUMA Suede silhouette reimagined",
      "Premium suede upper for a classic look",
      "Rubber outsole provides excellent traction",
    ],
    hasBrandRegistry: true,
    sellerId: "A6F7G8H9",
    sellerName: "PUMA Official",
  },

  // === Converse ===
  B0D4444444: {
    asin: "B0D4444444",
    title: "Converse Chuck Taylor All Star Classic High Top Black Unisex",
    brand: "Converse",
    category: "Shoes > Unisex > Casual",
    price: "$54.99",
    features: [
      "Canvas upper",
      "Rubber toe cap",
      "Vulcanized rubber sole",
      "OrthoLite insole",
    ],
    bulletPoints: [
      "The iconic Chuck Taylor All Star since 1917",
      "Canvas upper for breathability",
      "Rubber toe cap and vulcanized sole for durability",
    ],
    hasBrandRegistry: true,
    sellerId: "A7G8H9I0",
    sellerName: "Converse Official",
  },

  // === Lululemon ===
  B0D5555555: {
    asin: "B0D5555555",
    title: "lululemon Align High-Rise Pant 25\" Women's Yoga Pants Black",
    brand: "lululemon",
    category: "Clothing > Women > Pants > Yoga",
    price: "$98.00",
    features: [
      "Nulu fabric",
      "High-rise waistband",
      "Hidden pocket",
      "25-inch inseam",
    ],
    bulletPoints: [
      "Buttery-soft Nulu™ fabric in a weightless design",
      "High-rise waistband for coverage",
      "Designed for yoga and low-impact activities",
    ],
    hasBrandRegistry: true,
    sellerId: "A8H9I0J1",
    sellerName: "lululemon Official",
  },

  // === Apple ===
  B0D6666666: {
    asin: "B0D6666666",
    title: "Apple AirPods Pro (2nd Generation) Wireless Earbuds USB-C",
    brand: "Apple",
    category: "Electronics > Headphones > In-Ear",
    price: "$249.00",
    features: [
      "Active Noise Cancellation",
      "Adaptive Transparency",
      "Personalized Spatial Audio",
      "USB-C charging case",
    ],
    bulletPoints: [
      "Apple-designed H2 chip for smarter noise cancellation",
      "Personalized Spatial Audio with dynamic head tracking",
      "Up to 6 hours of listening time with ANC enabled",
    ],
    hasBrandRegistry: true,
    sellerId: "A9I0J1K2",
    sellerName: "Apple Official",
  },

  // === Sony ===
  B0D7777777: {
    asin: "B0D7777777",
    title: "Sony PlayStation 5 DualSense Wireless Controller - Midnight Black",
    brand: "Sony",
    category: "Video Games > PlayStation 5 > Accessories > Controllers",
    price: "$69.99",
    features: [
      "Haptic feedback",
      "Adaptive triggers",
      "Built-in microphone",
      "USB-C port",
    ],
    bulletPoints: [
      "DualSense wireless controller for PS5",
      "Haptic feedback for immersive gameplay",
      "Adaptive triggers simulate in-game resistance",
    ],
    hasBrandRegistry: true,
    sellerId: "A0J1K2L3",
    sellerName: "Sony Interactive Entertainment",
  },

  // === LEGO ===
  B0D8888888: {
    asin: "B0D8888888",
    title: "LEGO Star Wars Millennium Falcon Building Set 75192",
    brand: "LEGO",
    category: "Toys > Building Toys > LEGO",
    price: "$849.99",
    features: [
      "7541 pieces",
      "Minifigures included",
      "Display stand",
      "Detailed interior",
    ],
    bulletPoints: [
      "Ultimate Collector Series Millennium Falcon",
      "Includes Han Solo, Chewbacca, Princess Leia and C-3PO minifigures",
      "Removable hull plates to reveal detailed interior",
    ],
    hasBrandRegistry: true,
    sellerId: "A1K2L3M4",
    sellerName: "LEGO Official",
  },

  // === Fake / Suspicious Listings (for testing infringement detection) ===
  B0EFAKE001: {
    asin: "B0EFAKE001",
    title:
      "Nkie Air Max 270 Men's Running Sneakers Breathable Mesh Sport Shoes",
    brand: "Nkie Sport",
    category: "Shoes > Men > Athletic > Running",
    price: "$39.99",
    features: [
      "Air cushion",
      "Mesh upper",
      "Lightweight design",
      "Non-slip sole",
    ],
    bulletPoints: [
      "Premium running shoes with air cushion technology",
      "Breathable mesh keeps your feet cool",
      "Similar styling to popular brands",
    ],
    hasBrandRegistry: false,
    sellerId: "A1FAKE001",
    sellerName: "Shenzhen TopKicks Trading Co., Ltd.",
  },
  B0EFAKE002: {
    asin: "B0EFAKE002",
    title: "Adidos Ultraboost Running Shoe for Men Black White Boost Sole",
    brand: "Adidos",
    category: "Shoes > Men > Athletic > Running",
    price: "$29.99",
    features: [
      "Boost-like sole",
      "Knit upper",
      "Three stripe design",
      "Pull tab",
    ],
    bulletPoints: [
      "High quality running shoes with boost technology",
      "Premium knit upper for comfort",
      "Stylish three stripe design",
    ],
    hasBrandRegistry: false,
    sellerId: "A1FAKE002",
    sellerName: "Guangzhou MegaDeal E-Commerce Ltd.",
  },
  B0EFAKE003: {
    asin: "B0EFAKE003",
    title: "New Balence 574 Classic Running Sneakers Men's Retro Casual Shoes",
    brand: "New Balence",
    category: "Shoes > Men > Casual",
    price: "$34.99",
    features: [
      "Cushioned sole",
      "Suede and mesh",
      "N logo design",
      "Durable rubber",
    ],
    bulletPoints: [
      "Classic retro runner design",
      "Comfortable cushioning for all day wear",
      "Premium materials at affordable price",
    ],
    hasBrandRegistry: false,
    sellerId: "A1FAKE003",
    sellerName: "Putian BestPrice Shoes Co., Ltd.",
  },
  B0EFAKE004: {
    asin: "B0EFAKE004",
    title: "Lous Vuitton Designer Crossbody Bag Monogram Canvas Small",
    brand: "Lous Vuitton",
    category: "Handbags > Crossbody Bags",
    price: "$49.99",
    features: [
      "Canvas material",
      "Gold-tone hardware",
      "Adjustable strap",
      "Zip closure",
    ],
    bulletPoints: [
      "Designer-inspired crossbody bag",
      "Classic monogram pattern",
      "Premium canvas construction",
    ],
    hasBrandRegistry: false,
    sellerId: "A1FAKE004",
    sellerName: "HK LuxuryStyle Trading Ltd.",
  },
  B0EFAKE005: {
    asin: "B0EFAKE005",
    title:
      "Apple AirPods Pro Wireless Earbuds Noise Cancelling Bluetooth Headphones",
    brand: "Generic",
    category: "Electronics > Headphones > In-Ear",
    price: "$19.99",
    features: [
      "Active noise cancellation",
      "Bluetooth 5.0",
      "Touch controls",
      "Charging case",
    ],
    bulletPoints: [
      "True wireless earbuds with noise cancellation",
      "Premium sound quality",
      "Compatible with all Bluetooth devices",
    ],
    hasBrandRegistry: false,
    sellerId: "A1FAKE005",
    sellerName: "Shenzhen TechDeal Electronics Co., Ltd.",
  },
};

function findListing(asin: string): ListingData | null {
  const key = asin.toUpperCase();
  return REAL_LISTINGS[key] ?? null;
}

// 为未知 ASIN 生成差异化的通用 Listing
function generateGenericListing(asin: string): ListingData {
  const hash = asin.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const categories = [
    { cat: "Shoes > Men > Athletic", brand: "Generic Sports", price: 29.99 },
    { cat: "Clothing > Women > Tops", brand: "Fashion Hub", price: 19.99 },
    { cat: "Electronics > Accessories", brand: "TechGear", price: 14.99 },
    { cat: "Home & Kitchen > Decor", brand: "HomeStyle", price: 24.99 },
    { cat: "Beauty > Skin Care", brand: "GlowUp", price: 12.99 },
    { cat: "Sports & Outdoors", brand: "OutdoorPro", price: 34.99 },
    { cat: "Toys & Games", brand: "FunWorld", price: 16.99 },
    { cat: "Pet Supplies", brand: "PetPal", price: 22.99 },
  ];
  const pick = categories[hash % categories.length];
  const adjectives = [
    "Premium",
    "Professional",
    "Classic",
    "Deluxe",
    "Elite",
    "Ultra",
    "Pro",
    "Essential",
  ];
  const adj = adjectives[(hash >> 3) % adjectives.length];

  return {
    asin: asin.toUpperCase(),
    title: `${adj} ${pick.brand} ${pick.cat.split(">").pop()?.trim() ?? "Product"} - ${asin}`,
    brand: pick.brand,
    category: pick.cat,
    price: `$${pick.price.toFixed(2)}`,
    features: [
      "Standard quality materials",
      "Satisfaction guaranteed",
      "Fast shipping available",
    ],
    bulletPoints: [
      "Quality product at affordable price",
      "Ships from Amazon warehouse",
      "Standard packaging",
    ],
    hasBrandRegistry: false,
    sellerId: `A${hash.toString(16).toUpperCase().slice(0, 8)}`,
    sellerName: `${pick.brand} Direct Store`,
  };
}

export class FixtureAmazonListingConnector {
  async getListingHtml(asin: string) {
    const listing = findListing(asin) ?? generateGenericListing(asin);
    // 构建类似 Amazon 页面的 HTML 结构，提取 brand 信息
    return `<html><body>
      <div id="productTitle">${listing.title}</div>
      <div id="bylineInfo">Brand: ${listing.brand}</div>
      <div id="priceblock_ourprice">${listing.price}</div>
      <div id="feature-bullets">${listing.bulletPoints.map((b) => `<li>${b}</li>`).join("")}</div>
      <div id="sellerProfile" data-seller-id="${listing.sellerId}">${listing.sellerName}</div>
    </body></html>`;
  }
}
