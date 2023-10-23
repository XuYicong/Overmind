/**
 * Default ordering for processing spawning requests and prioritizing overlords
 */
export let OverlordPriority = {
	emergency: {				// Colony-wide emergencies such as a catastrohic crash
		bootstrap: 0
	},

	core: {						// Functionality related to spawning more creeps
		queen  : 100,
		manager: 101,
	},

	defense: {					// Defense of local and remote rooms
		meleeDefense : 200,
		rangedDefense: 201,
	},

	warSpawnCutoff: 299, 		// Everything past this is non-critical and won't be spawned in case of emergency

	offense: {					// Offensive operations like raids or sieges
		destroy         : 300,
		healPoint       : 301,
		siege           : 302,
		controllerAttack: 399
	},

	ownedRoom: { 				// Operation of an owned room
		firstTransport: 500,		// High priority to spawn the first transporter
		mine          : 501,
		work          : 502,
		mineralRCL8   : 503,
		transport     : 510,		// Spawn the rest of the transporters
		mineral       : 520
	},

	outpostDefense: {
		outpostDefense: 504,
		guard         : 551,
	},

	outpostOffense: {
		harass: 580,
	},

	upgrading: {				// Spawning upgraders
		upgrade: 600,
	},

	throttleThreshold: 699,  	// Everything past this may be throttled in the event of low CPU

	collectionUrgent: { 		// Collecting resources that are time sensitive, like decaying resources on ground
		haul: 700
	},

	powerMine: {
		cool         : 750,
		drill        : 751,
		roomIncrement: 5,
	},

	remoteRoom: { 				// Operation of a remote room. Allows colonies to restart one room at a time.
		reserve      : 800,
		mine         : 801,
		roomIncrement: 5, 			// remote room priorities are incremented by this for each outpost
	},
	// In case of low energy, mind your own colony before caring about new ones
	// Open at least 2 outposts before colonizing
	colonization: { 			// Colonizing new rooms
		claim  : 807,
		pioneer: 808,
		safeModeBonus: 400,
	},

	remoteSKRoom: {
		sourceReaper : 900,
		mineral      : 901,
		mine         : 902,
		roomIncrement: 5,
	},

	scouting: {
		stationary  : 1000,
		randomWalker: 1001
	},

	tasks: {				// Non-urgent tasks, such as collection from a deserted storage
		haul: 1100,
		dismantle: 1101,
	},

	default: 99999				// Default overlord priority to ensure it gets run last
};
