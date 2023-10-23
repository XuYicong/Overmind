// @formatter:off
/* tslint:disable:ordered-imports */

'use strict';
// Import ALL the things! ==============================================================================================
import './console/globals'; // Global functions accessible from CLI
import './prototypes/Creep'; // Creep prototypes
import './prototypes/RoomObject'; // RoomObject and targeting prototypes
import './prototypes/RoomPosition'; // RoomPosition prototypes
import './prototypes/RoomVisual'; // Prototypes used in Visualizer class
import './prototypes/Room'; // Non-structure room prototypes
import './prototypes/RoomStructures'; // IVM-cached structure prototypes
import './prototypes/Structures'; // Prototypes for accessed structures
import './prototypes/Miscellaneous'; // Everything else
import './tasks/initializer'; // This line is necessary to ensure proper compilation ordering...
import './zerg/CombatZerg'; // ...so is this one... rollup is dumb about generating reference errors
import {USE_PROFILER} from './~settings';
import {Mem} from './memory/Memory';
import {OvermindConsole} from './console/Console';
import {Stats} from './stats/stats';
import profiler from './profiler/screeps-profiler';
import _Overmind from './Overmind_obfuscated'; // this should be './Overmind_obfuscated' unless you are me
import { log } from 'console/log';
// =====================================================================================================================

// Main loop
function main(): void {
	// Memory operations: load and clean memory, suspend operation as needed -------------------------------------------
	Mem.load();														// Load previous parsed memory if present
	if (!Mem.shouldRun()) return;									// Suspend operation if necessary
	Mem.clean();													// Clean memory contents
	// let timeRec = Game.cpu.getUsed();
	// log.debug('used before: '+timeRec);
	// Instantiation operations: build or refresh the game state -------------------------------------------------------
	if (!Overmind || Overmind.shouldBuild || Game.time >= Overmind.expiration) {
		delete global.Overmind;										// Explicitly delete the old Overmind object
		Mem.garbageCollect(true);								// Run quick garbage collection
		global.Overmind = new _Overmind();							// Instantiate the Overmind object
		Overmind.build();											// Build phase: instantiate all game components
	} else {
		Overmind.refresh();											// Refresh phase: update the Overmind state
	}
	// timeRec = Game.cpu.getUsed() - timeRec;
	// log.debug('used mid: '+timeRec);
	// Tick loop cycle: initialize and run each component --------------------------------------------------------------
	Overmind.init();												// Init phase: spawning and energy requests
	// timeRec = Game.cpu.getUsed() - timeRec;
	// log.debug('used inter: '+timeRec);
	Overmind.run();													// Run phase: execute state-changing actions
	Overmind.visuals(); 											// Draw visuals
	Stats.run(); 													// Record statistics

	// timeRec = Game.cpu.getUsed() - timeRec;
	// log.debug('used last: '+(timeRec-7)); // 35 creeps
	Overmind.postRun();												// Error catching is run at end of every tick
}

// This gets run on each global reset
function onGlobalReset(): void {
	if (USE_PROFILER) profiler.enable();
	Mem.format();
	OvermindConsole.init();
	Memory.stats.persistent.lastGlobalReset = Game.time;
	OvermindConsole.printUpdateMessage();
	// Make a new Overmind object
	global.Overmind = new _Overmind();
}

// Decide which loop to export as the script loop
export var loop: () => void;
if (USE_PROFILER) {
	// Wrap the main loop in the profiler
	loop = () => profiler.wrap(main);
} else {
	// Use the default main loop
	loop = main;
}

// Run the global reset code
onGlobalReset();



