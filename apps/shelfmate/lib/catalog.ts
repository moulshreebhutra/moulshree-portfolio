export type Step = "Cleanse" | "Treat" | "Moisturize" | "Protect";
export interface Product { id: string; name: string; step: Step; price: number; skin: string[]; concerns: string[]; gentle: boolean; how: string }

// An invented skincare brand. Prices in rupees.
export const CATALOG: Product[] = [
  {
    "id": "c1",
    "name": "Gentle Gel Cleanser",
    "step": "Cleanse",
    "price": 399,
    "skin": [
      "oily",
      "combination",
      "dry",
      "sensitive"
    ],
    "concerns": [
      "redness",
      "dryness"
    ],
    "gentle": true,
    "how": "Morning and night, massage for 60 seconds."
  },
  {
    "id": "c2",
    "name": "Neem Clarify Cleanser",
    "step": "Cleanse",
    "price": 449,
    "skin": [
      "oily",
      "combination"
    ],
    "concerns": [
      "breakouts"
    ],
    "gentle": false,
    "how": "Morning and night. Skip the morning wash if skin feels tight."
  },
  {
    "id": "t1",
    "name": "Niacinamide 10% Serum",
    "step": "Treat",
    "price": 599,
    "skin": [
      "oily",
      "combination"
    ],
    "concerns": [
      "breakouts",
      "dullness"
    ],
    "gentle": false,
    "how": "Three drops on clean skin, night."
  },
  {
    "id": "t2",
    "name": "Vitamin C Glow Serum",
    "step": "Treat",
    "price": 699,
    "skin": [
      "oily",
      "combination",
      "dry"
    ],
    "concerns": [
      "dullness"
    ],
    "gentle": false,
    "how": "Morning, before sunscreen."
  },
  {
    "id": "t3",
    "name": "Salicylic Spot Gel",
    "step": "Treat",
    "price": 349,
    "skin": [
      "oily",
      "combination"
    ],
    "concerns": [
      "breakouts"
    ],
    "gentle": false,
    "how": "Dab on active spots at night."
  },
  {
    "id": "t4",
    "name": "Bakuchiol Night Serum",
    "step": "Treat",
    "price": 899,
    "skin": [
      "dry",
      "sensitive",
      "combination"
    ],
    "concerns": [
      "lines",
      "redness"
    ],
    "gentle": true,
    "how": "Night, two pumps after cleansing."
  },
  {
    "id": "m1",
    "name": "Ceramide Barrier Cream",
    "step": "Moisturize",
    "price": 549,
    "skin": [
      "dry",
      "sensitive",
      "combination"
    ],
    "concerns": [
      "dryness",
      "redness",
      "lines"
    ],
    "gentle": true,
    "how": "Morning and night, a pea-sized amount."
  },
  {
    "id": "m2",
    "name": "Water-Gel Moisturizer",
    "step": "Moisturize",
    "price": 449,
    "skin": [
      "oily",
      "combination"
    ],
    "concerns": [
      "breakouts",
      "dullness"
    ],
    "gentle": true,
    "how": "Morning and night, light layer."
  },
  {
    "id": "s1",
    "name": "SPF 50 Sheer Fluid",
    "step": "Protect",
    "price": 499,
    "skin": [
      "oily",
      "combination",
      "dry",
      "sensitive"
    ],
    "concerns": [
      "breakouts",
      "dullness",
      "dryness",
      "lines",
      "redness"
    ],
    "gentle": true,
    "how": "Every morning, two finger lengths."
  },
  {
    "id": "c3", "name": "Creamy Milk Cleanser", "step": "Cleanse", "price": 429,
    "skin": ["dry", "sensitive", "combination"], "concerns": ["dryness", "redness", "lines"], "gentle": true, "how": "Morning and night, rinse with lukewarm water."
  },
  {
    "id": "m3", "name": "Rich Night Cream", "step": "Moisturize", "price": 649,
    "skin": ["dry", "sensitive"], "concerns": ["dryness", "lines"], "gentle": true, "how": "Night, a thin layer over serum."
  },
  {
    "id": "s2", "name": "Mineral SPF 30 Lotion", "step": "Protect", "price": 549,
    "skin": ["dry", "sensitive", "combination"], "concerns": ["redness", "dryness", "dullness"], "gentle": true, "how": "Every morning, two finger-lengths."
  }
];


/** Assumed cost of goods as a share of price. An input to the merchant guardrails, not a measured number. */
export const COST_SHARE = 0.45;
