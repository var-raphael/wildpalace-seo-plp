import type { ParsedIntent } from "../intent/types";

export interface PublishedPageRecord {
  slug: string;
  locale: string;
  intent: ParsedIntent;
  h1: string;
  metaDescription: string;
  productCount: number;
  publishedAt: string; // ISO date
}

// In-memory store standing in for a real database table. In production
// this would be a Prisma model (the template already has Prisma wired up
// for sessions, so adding a PublishedPage model is a natural extension).
const publishedPages: PublishedPageRecord[] = [];

export function recordPublishedPage(page: PublishedPageRecord) {
  publishedPages.push(page);
}

export function getAllPublishedPages(): PublishedPageRecord[] {
  return publishedPages;
}
