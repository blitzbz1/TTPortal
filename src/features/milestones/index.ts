// F053: lifetime milestones domain barrel.
export * from './definitions';
export * from './cache';
export * from './hooks/useMilestonesQuery';
// Service fns + the earned-row type.
export { getUserMilestones, type UserMilestone } from '../../services/milestones';
