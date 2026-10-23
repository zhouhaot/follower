/** Compatibility entry point for the first candidate's lotus-only API.
 * All resource handling and target checks now live in the shared adapter.
 */
import { createImageTargetTracker } from './image-target-tracker.mjs';
export const createLotusTracker = (options) => createImageTargetTracker({ ...options, cardKey: 'lotus' });
