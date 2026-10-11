/** Standalone Agent 1 build: no visual substitute for Agent 3's overview.
 * Discovery/state processing works; merge Agent 3 for the real warning. */
import type {MountOverview} from '../src/core/contracts.ts';
export const mountOverview:MountOverview = () => ({update:() => {},destroy:() => {}});
