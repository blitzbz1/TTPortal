// F054: TT Wrapped domain types. The payload shape + helpers come from the
// service; this barrel surface re-exports them so consumers import from
// `features/wrapped` rather than reaching into services.
export type {
  YearInReview,
  WrappedArchetype,
  WrappedTopVenue,
  WrappedTopMonth,
  WrappedPartner,
} from '../../services/wrapped';
