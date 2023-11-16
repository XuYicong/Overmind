// Jump table to instantiate flags based on type

import {DirectiveClearRoom} from './colony/clearRoom';
import {DirectiveColonize} from './colony/colonize';
import {DirectiveIncubate} from './colony/incubate';
import {DirectiveOutpost} from './colony/outpost';
import {DirectiveSKOutpost} from './colony/outpostSK';
import {DirectiveGuard} from './defense/guard';
import {DirectiveInvasionDefense} from './defense/invasionDefense';
import {DirectiveOutpostDefense} from './defense/outpostDefense';
import { DirectiveWarmupScout } from './defense/warmupScout';
import {Directive} from './Directive';
import {DirectiveControllerAttack} from './offense/controllerAttack';
import {DirectivePairDestroy} from './offense/pairDestroy';
import { DirectivePairHarasser } from './offense/pairHarasser';
import {DirectiveSwarmDestroy} from './offense/swarmDestroy';
import {DirectiveExtract} from './resource/extract';
import {DirectiveHarvest} from './resource/harvest';
import {DirectiveHaul} from './resource/haul';
import { DirectivePowerMine } from './resource/powerMine';
import {DirectiveRPBunker} from './roomPlanner/roomPlanner_bunker';
import {DirectiveRPCommandCenter} from './roomPlanner/roomPlanner_commandCenter';
import { DirectiveRPEvolutionChamber } from './roomPlanner/roomPlanner_evolutionChamber';
import {DirectiveRPHatchery} from './roomPlanner/roomPlanner_hatchery';
import {DirectiveBootstrap} from './situational/bootstrap';
import {DirectiveNukeResponse} from './situational/nukeResponse';
import {DirectiveDismantle} from './targeting/dismantle';
import { DirectiveHelp } from './situational/help';
import {DirectiveTargetSiege} from './targeting/siegeTarget';
import {DirectiveTerminalEmergencyState} from './terminalState/terminalState_emergency';
import {DirectiveTerminalEvacuateState} from './terminalState/terminalState_evacuate';
import {DirectiveTerminalRebuildState} from './terminalState/terminalState_rebuild';
import { DirectiveHarass } from './offense/harass';
import { DirectiveQuad } from './offense/quad';
/**
 * This is the initializer for directives, which maps flags by their color code to the corresponding directive
 */
export function DirectiveWrapper(flag: Flag): Directive | undefined {
	const turn_to: {[roomName:string]: {"path": ProtoPos[], [thing:string]:any}} = {
		'E9S23':{"path":[{"shard":"shard3","roomName":"W20S30","x":31,"y":37},{"shard":"shard2","roomName":"W20S30","x":40,"y":23},{"shard":"shard1","roomName":"W20S30","x":30,"y":27},{"shard":"shard0","roomName":"W40S61","x":13,"y":1},{"shard":"shard0","roomName":"W69S60","x":1,"y":42},{"shard":"shard0","roomName":"W70S69","x":32,"y":48},{"shard":"shard0","roomName":"W40S70","x":30,"y":24},{"shard":"shard1","roomName":"W20S40","x":34,"y":39},{"shard":"shard0","roomName":"W30S79","x":38,"y":48},{"shard":"shard0","roomName":"W20S80","x":27,"y":4},{"shard":"shard1","roomName":"W10S40","x":7,"y":34},{"shard":"shard0","roomName":"W10S71","x":44,"y":1},{"shard":"shard0","roomName":"E39S70","x":48,"y":6},{"shard":"shard0","roomName":"E40S40","x":4,"y":13},{"shard":"shard1","roomName":"E20S20","x":39,"y":9},{"shard":"shard0","roomName":"E40S29","x":6,"y":48},{"shard":"shard0","roomName":"E10S30","x":30,"y":9},{"shard":"shard1","roomName":"E10S20","x":33,"y":14},{"shard":"shard2","roomName":"E10S20","x":29,"y":21}],"distance":682,"totalRooms":42},
		'W38S8':{"path":[{"shard":"shard3","roomName":"W20S30","x":31,"y":37},{"shard":"shard2","roomName":"W20S30","x":40,"y":23},{"shard":"shard1","roomName":"W20S30","x":30,"y":27},{"shard":"shard0","roomName":"W40S61","x":13,"y":1},{"shard":"shard0","roomName":"W69S60","x":1,"y":12},{"shard":"shard0","roomName":"W69S30","x":1,"y":10},{"shard":"shard0","roomName":"W70S20","x":18,"y":22},{"shard":"shard1","roomName":"W40S10","x":37,"y":26},{"shard":"shard2","roomName":"W40S10","x":32,"y":36}],"distance":431,"totalRooms":21} ,
		'W22N19':{"path":[{"shard":"shard3","roomName":"W20S30","x":31,"y":37},{"shard":"shard2","roomName":"W20S30","x":40,"y":23},{"shard":"shard1","roomName":"W20S30","x":26,"y":8},{"shard":"shard0","roomName":"W31S60","x":47,"y":4},{"shard":"shard0","roomName":"W30S40","x":17,"y":5},{"shard":"shard1","roomName":"W20S20","x":44,"y":9},{"shard":"shard0","roomName":"W29S30","x":1,"y":9},{"shard":"shard0","roomName":"W31N0","x":48,"y":17},{"shard":"shard0","roomName":"W29N10","x":1,"y":19},{"shard":"shard0","roomName":"W30N30","x":43,"y":43}],"distance":521,"totalRooms":23} ,		'W41N11':{"path":[{"shard":"shard3","roomName":"W20S30","x":31,"y":37},{"shard":"shard2","roomName":"W20S30","x":40,"y":23},{"shard":"shard1","roomName":"W20S30","x":15,"y":43},{"shard":"shard0","roomName":"W40S51","x":4,"y":1},{"shard":"shard0","roomName":"W51S50","x":48,"y":7},{"shard":"shard0","roomName":"W51S10","x":48,"y":18},{"shard":"shard0","roomName":"W50N10","x":40,"y":34},{"shard":"shard1","roomName":"W30N10","x":5,"y":19},{"shard":"shard0","roomName":"W60N21","x":24,"y":48},{"shard":"shard0","roomName":"W70N20","x":24,"y":45},{"shard":"shard1","roomName":"W40N10","x":21,"y":23},{"shard":"shard2","roomName":"W40N10","x":15,"y":13}],"distance":580,"totalRooms":27},
		'W25S22':{"path":[{"shard":"shard3","roomName":"W30S30","x":22,"y":4},{"shard":"shard2","roomName":"W30S30","x":7,"y":22},{"shard":"shard1","roomName":"W30S30","x":23,"y":5},{"shard":"shard0","roomName":"W61S60","x":48,"y":2},{"shard":"shard0","roomName":"W60S30","x":38,"y":39}],"distance":567,"totalRooms":11} ,
		'W29N9':{"path":[{"shard":"shard3","roomName":"W20S30","x":31,"y":37},{"shard":"shard2","roomName":"W20S30","x":40,"y":23},{"shard":"shard1","roomName":"W20S30","x":26,"y":8},{"shard":"shard0","roomName":"W31S60","x":47,"y":4},{"shard":"shard0","roomName":"W30S40","x":17,"y":5},{"shard":"shard1","roomName":"W20S20","x":44,"y":9},{"shard":"shard0","roomName":"W29S30","x":1,"y":9},{"shard":"shard0","roomName":"W31N0","x":48,"y":17}],"distance":429,"totalRooms":19},	
		'E11N19':{"path":[{"shard":"shard3","roomName":"W20S30","x":31,"y":37},{"shard":"shard2","roomName":"W20S30","x":40,"y":23},{"shard":"shard1","roomName":"W20S30","x":26,"y":8},{"shard":"shard0","roomName":"W31S60","x":47,"y":4},{"shard":"shard0","roomName":"W30S40","x":17,"y":5},{"shard":"shard1","roomName":"W20S20","x":44,"y":9},{"shard":"shard0","roomName":"W29S30","x":1,"y":9},{"shard":"shard0","roomName":"W31N0","x":48,"y":17},{"shard":"shard0","roomName":"W29N10","x":1,"y":19},{"shard":"shard0","roomName":"W30N30","x":43,"y":43},{"shard":"shard1","roomName":"W20N20","x":38,"y":12},{"shard":"shard0","roomName":"W30N39","x":40,"y":1},{"shard":"shard0","roomName":"W20N40","x":24,"y":23},{"shard":"shard1","roomName":"W10N20","x":14,"y":38},{"shard":"shard0","roomName":"W10N31","x":37,"y":48},{"shard":"shard0","roomName":"E10N30","x":41,"y":22}],"distance":556,"totalRooms":35},
		// 从s1到s0E29N64。目标位置需转义
		'W22N20':{"path":[{"shard":"shard1","roomName":"W20N20","x":38,"y":12},{"shard":"shard0","roomName":"W30N39","x":40,"y":1},{"shard":"shard0","roomName":"W20N40","x":24,"y":23},{"shard":"shard1","roomName":"W10N20","x":14,"y":38},{"shard":"shard0","roomName":"W10N31","x":37,"y":48},{"shard":"shard0","roomName":"E10N30","x":41,"y":22},{"shard":"shard1","roomName":"E10N20","x":29,"y":43},{"shard":"shard0","roomName":"E20N41","x":44,"y":48},{"shard":"shard0","roomName":"E31N40","x":1,"y":4},{"shard":"shard0","roomName":"E29N64","x":36,"y":5}],"distance":535,"totalRooms":21},
	};
	const turn_back: {[roomName:string]: {"path": ProtoPos[], [thing:string]:any}} = {
		'E9S23':{"path":[{"shard":"shard3","roomName":"E10S20","x":29,"y":33},{"shard":"shard2","roomName":"E10S20","x":45,"y":27},{"shard":"shard1","roomName":"E10S20","x":39,"y":29},{"shard":"shard0","roomName":"E10S29","x":33,"y":48},{"shard":"shard0","roomName":"E40S30","x":25,"y":41},{"shard":"shard1","roomName":"E20S20","x":25,"y":7},{"shard":"shard0","roomName":"E39S40","x":48,"y":34},{"shard":"shard0","roomName":"E40S71","x":7,"y":1},{"shard":"shard0","roomName":"W10S70","x":6,"y":23},{"shard":"shard1","roomName":"W10S40","x":21,"y":41},{"shard":"shard0","roomName":"W20S79","x":19,"y":48},{"shard":"shard0","roomName":"W30S80","x":42,"y":18},{"shard":"shard1","roomName":"W20S40","x":35,"y":35},{"shard":"shard0","roomName":"W40S69","x":7,"y":48},{"shard":"shard0","roomName":"W69S70","x":1,"y":4},{"shard":"shard0","roomName":"W70S61","x":36,"y":1},{"shard":"shard0","roomName":"W40S60","x":24,"y":39},{"shard":"shard1","roomName":"W20S30","x":26,"y":10},{"shard":"shard2","roomName":"W20S30","x":39,"y":8}],"distance":682,"totalRooms":42},
	
	}
	const roomName = flag.pos.roomName;
	// TODO: 对于跨shard目标，将directive传递到目标shard
	if(turn_to[roomName]) {
		flag.memory.waypoints = _.map(turn_to[roomName].path, (pos) => pos.roomName +':'+ pos.x +':'+  pos.y);
	}
	switch (flag.color) {

		// Colony directives ===========================================================================================
		case COLOR_PURPLE:
			switch (flag.secondaryColor) {
				case COLOR_PURPLE:
					return new DirectiveOutpost(flag);
				case COLOR_YELLOW:
					return new DirectiveSKOutpost(flag);
				case COLOR_WHITE:
					// flag.memory.waypoints = ['W25S35:15:19'];
					return new DirectiveIncubate(flag);
				case COLOR_GREY:
					// Occupy a new room via a center room portal
					// flag.memory.waypoints = ['W25S35:15:19'];
					return new DirectiveColonize(flag);
				case COLOR_ORANGE:
					return new DirectiveClearRoom(flag);
			}
			break;

		// Offensive combat directives =================================================================================
		case COLOR_RED:
			switch (flag.secondaryColor) {
				case COLOR_RED:
					return new DirectiveSwarmDestroy(flag);
				case COLOR_CYAN:
					return new DirectivePairDestroy(flag);
				case COLOR_GREEN:
					return new DirectiveQuad(flag);
				case COLOR_BROWN:
					return new DirectivePairHarasser(flag);
				case COLOR_PURPLE:
					return new DirectiveControllerAttack(flag);
				case COLOR_WHITE:
					return new DirectiveHarass(flag);
			}
			break;

		// Defensive combat directives =================================================================================
		case COLOR_BLUE:
			switch (flag.secondaryColor) {
				case COLOR_BLUE:
					return new DirectiveGuard(flag);
				case COLOR_RED:
					return new DirectiveOutpostDefense(flag);
				case COLOR_PURPLE:
					return new DirectiveInvasionDefense(flag);
				case COLOR_WHITE:
					return new DirectiveWarmupScout(flag);
			}
			break;

		// Situational directives ======================================================================================
		case COLOR_ORANGE:
			switch (flag.secondaryColor) {
				case COLOR_ORANGE:
					return new DirectiveBootstrap(flag);
				case COLOR_BLUE:
					return new DirectiveNukeResponse(flag);
			}
			break;

		// Resource directives =========================================================================================
		case COLOR_YELLOW:
			switch (flag.secondaryColor) {
				case COLOR_RED:
					return new DirectivePowerMine(flag);
				case COLOR_YELLOW:
					return new DirectiveHarvest(flag);
				case COLOR_CYAN:
					return new DirectiveExtract(flag);
				case COLOR_BLUE:
					if(flag.memory.waypoints) {
						// If has one trun waypoint, assume has turn back waypoints
						flag.memory.waypoints = flag.memory.waypoints.concat(
							_.map(turn_back[roomName].path, (pos) => pos.roomName +':'+ pos.x +':'+  pos.y));
					}
					return new DirectiveHaul(flag);
			}
			break;

		// Terminal state directives ===================================================================================
		case COLOR_BROWN:
			switch (flag.secondaryColor) {
				case COLOR_RED:
					return new DirectiveTerminalEvacuateState(flag);
				case COLOR_ORANGE:
					return new DirectiveTerminalEmergencyState(flag);
				case COLOR_YELLOW:
					return new DirectiveTerminalRebuildState(flag);
			}
			break;

		// Targeting colors ============================================================================================
		case COLOR_GREY:
			switch (flag.secondaryColor) {
				case COLOR_ORANGE:
					return new DirectiveTargetSiege(flag);
				case COLOR_YELLOW:
					return new DirectiveDismantle(flag);
				case COLOR_BLUE:
					return new DirectiveHelp(flag);
			}
			break;

		// Room planning directives ====================================================================================
		case COLOR_WHITE:
			switch (flag.secondaryColor) {
				case COLOR_GREEN:
					return new DirectiveRPHatchery(flag);
				case COLOR_BLUE:
					return new DirectiveRPCommandCenter(flag);
				case COLOR_RED:
					return new DirectiveRPBunker(flag);
				case COLOR_CYAN:
					return new DirectiveRPEvolutionChamber(flag);
			}
			break;
	}

}
