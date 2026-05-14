export const PLAN_DEFINITIONS = [
  {
    id: "free",
    name: "Free Plan",
    priceMonthly: 0,
    monthlyCredits: 300,
    starterCredits: 25,
    features: [
      "Basic AI chat",
      "Limited demo search",
      "Limited website generation",
      "Community support"
    ],
    stripePriceKey: null
  },
  {
    id: "starter",
    name: "Starter Plan",
    priceMonthly: 9,
    monthlyCredits: 600,
    features: [
      "AI chat",
      "Web search",
      "AI Search quick and standard",
      "Basic website generation",
      "Conversation history"
    ],
    stripePriceKey: "starter"
  },
  {
    id: "pro",
    name: "Pro Plan",
    priceMonthly: 29,
    monthlyCredits: 2000,
    features: [
      "Advanced AI search",
      "Deep research",
      "Website builder",
      "Code analysis",
      "Security scan",
      "Priority processing"
    ],
    stripePriceKey: "pro"
  },
  {
    id: "business",
    name: "Business Plan",
    priceMonthly: 79,
    monthlyCredits: 6000,
    features: [
      "Team-ready structure",
      "Advanced website generation",
      "More agent runs",
      "Admin analytics",
      "Priority support"
    ],
    stripePriceKey: "business"
  },
  {
    id: "enterprise",
    name: "Enterprise Plan",
    priceMonthly: null,
    monthlyCredits: null,
    features: [
      "Custom credits",
      "Dedicated configuration",
      "SLA-ready structure",
      "Custom agents",
      "Private deployment support"
    ],
    stripePriceKey: null
  }
];

export const CREDIT_PACKS = [
  { id: "credits-100", name: "100 credits", credits: 100, price: 5 },
  { id: "credits-500", name: "500 credits", credits: 500, price: 19 },
  { id: "credits-1500", name: "1,500 credits", credits: 1500, price: 49 }
];
