export interface MockProduct {
  id: string;
  title: string;
  tags: string[];
  collection: string; // living-room | bedroom | kids-room | nursery
}

export const MOCK_CATALOG: MockProduct[] = [
  {
    id: "1",
    title: "Botanical Grasscloth Wallpaper",
    tags: ["botanical", "grasscloth", "sustainable", "green"],
    collection: "living-room",
  },
  {
    id: "2",
    title: "Midnight Blue Kids Wallpaper",
    tags: ["midnight-blue", "peel-and-stick", "playful"],
    collection: "kids-room",
  },
  {
    id: "3",
    title: "Sustainable Sage Green Nursery Wallpaper",
    tags: ["sage-green", "sustainable", "organic"],
    collection: "nursery",
  },
  {
    id: "4",
    title: "Peel and Stick Botanical Wallpaper (Renters)",
    tags: ["peel-and-stick", "botanical", "renter-friendly", "removable"],
    collection: "living-room",
  },
  {
    id: "5",
    title: "Charcoal Geometric Living Room Wallpaper",
    tags: ["charcoal", "geometric", "modern"],
    collection: "living-room",
  },
  {
    id: "6",
    title: "Blush Pink Floral Bedroom Wallpaper",
    tags: ["blush-pink", "floral", "romantic"],
    collection: "bedroom",
  },
  {
    id: "7",
    title: "Textured Grasscloth Neutral Wallpaper",
    tags: ["grasscloth", "neutral", "beige", "natural-material"],
    collection: "living-room",
  },
  {
    id: "8",
    title: "Navy Nautical Kids Wallpaper",
    tags: ["navy", "nautical", "playful"],
    collection: "kids-room",
  },
];
