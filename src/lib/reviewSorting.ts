import type { Review } from '../types/database';

export type ReviewSort = 'latest' | 'oldest' | 'top';

export function sortReviews(reviews: Review[], sort: ReviewSort): Review[] {
  return [...reviews].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    if (sort === 'oldest') return aTime - bTime;
    if (sort === 'top') return b.rating - a.rating || bTime - aTime;
    return bTime - aTime;
  });
}
