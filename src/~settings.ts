// Global settings file containing player information

import {
	getUsername,
	onPublicServer,
} from './utilities/utils';

/**
 * Your username - you shouldn't need to change this.
 */
export const MY_USERNAME: string = getUsername();

/**
 * Enable this to build from source including screeps-profiler. (This is separate from Overmind-Profiler.)
 */
export const USE_PROFILER: boolean = false;

/**
 * Profiling is incredibly expensive and can cause the script to time out. By setting this option, you can limit the
 * number of colonies that will be handled while profiling. Colonies above this limit do not get run.
 */
export const PROFILER_COLONY_LIMIT = Math.ceil(Game.gcl.level / 2);

/**
 * While profiling, ensure these colonies are included in the randomly chosen ones specified by PROFILER_COLONY_LIMIT.
 */
export const PROFILER_INCLUDE_COLONIES: string[] = [/*'E15S49'*/];

/**
 * Enable this to wrap evaluations of constructor, init, and run phase for each colony in try...catch statemenets.
 */
export const USE_TRY_CATCH: boolean = true;

/**
 * If this is enabled, Memory.bot will default to true. This will not change the mode if already set - use setMode().
 */
export const DEFAULT_OPERATION_MODE: operationMode = 'automatic';

/**
 * Limit how many rooms you can claim (for any shard)
 */
export const MAX_OWNED_ROOMS = 4;

/**
 * If you are running on shard3 (CPU limit 20), only claim this many rooms
 */
export const SHARD3_MAX_OWNED_ROOMS = 2;

/**
 * The global Overmind object will be re-instantiated after this many ticks. In the meantime, refresh() is used.
 */
export const NEW_OVERMIND_INTERVAL = onPublicServer() ? 200 : 5;