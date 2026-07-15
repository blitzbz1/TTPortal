import type { Review } from '../../types/database';
import { sortReviews } from '../reviewSorting';

const review = (id: number, rating: number, created_at: string): Review => ({
  id,
  venue_id: 1,
  user_id: `u-${id}`,
  reviewer_name: `User ${id}`,
  rating,
  body: '',
  flagged: false,
  flag_count: 0,
  created_at,
});

const rows = [
  review(1, 3, '2026-01-02T00:00:00Z'),
  review(2, 5, '2026-01-01T00:00:00Z'),
  review(3, 5, '2026-01-03T00:00:00Z'),
];

describe('sortReviews', () => {
  it('sorts latest and oldest by creation date', () => {
    expect(sortReviews(rows, 'latest').map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortReviews(rows, 'oldest').map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it('sorts top rating first and recency breaks ties', () => {
    expect(sortReviews(rows, 'top').map((r) => r.id)).toEqual([3, 2, 1]);
  });
});
