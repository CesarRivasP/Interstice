import { RELEASE } from './release.js';
import { VARIANT } from './variant.js';
import type { Scenario } from './types.js';

export const SUITES: Record<'release' | 'variant', Scenario[]> = { release: RELEASE, variant: VARIANT };
export type { Scenario, Step } from './types.js';
