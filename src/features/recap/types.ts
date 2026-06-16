// F052: weekly-recap domain types. The recap row + helpers come from the
// service; this barrel surface re-exports them so consumers import from
// `features/recap` rather than reaching into services.
export type { WeeklyRecap } from '../../services/recap';
