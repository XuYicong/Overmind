import {Colony, getAllColonies} from '../Colony';
import {log} from '../console/log';
import {DirectiveColonize} from '../directives/colony/colonize';
import {Autonomy, getAutonomyLevel, Mem} from '../memory/Memory';
import {Pathing} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {Cartographer} from '../utilities/Cartographer';
import {isRoomAvailable, maxBy} from '../utilities/utils';
import {MAX_OWNED_ROOMS, SHARD3_MAX_OWNED_ROOMS} from '../~settings';
import {MIN_EXPANSION_DISTANCE} from './ExpansionEvaluator';


const CHECK_EXPANSION_FREQUENCY = 1000;

const UNOWNED_MINERAL_BONUS = 100;
const CATALYST_BONUS = 75;
const MAX_SCORE_BONUS = _.sum([UNOWNED_MINERAL_BONUS, CATALYST_BONUS]);

const TOO_CLOSE_PENALTY = 100;

interface ExpansionPlannerMemory {

}

const defaultExpansionPlannerMemory: ExpansionPlannerMemory = {};

@profile
export class ExpansionPlanner implements IExpansionPlanner {

	memory: ExpansionPlannerMemory;

	constructor() {
		this.memory = Mem.wrap(Memory, 'expansionPlanner', defaultExpansionPlannerMemory);
	}

	refresh() {
		this.memory = Mem.wrap(Memory, 'expansionPlanner', defaultExpansionPlannerMemory);
	}

	private handleExpansion(): void {
		const allColonies = getAllColonies();
		// If you already have max number of colonies, ignore
		if (allColonies.length >= Math.min(Game.gcl.level, MAX_OWNED_ROOMS)) {
			return;
		}
		// If you are on shard3, limit to 3 owned rooms // TODO: use CPU-based limiting metric
		if (Game.shard.name == 'shard3') {
			if (allColonies.length >= SHARD3_MAX_OWNED_ROOMS) {
				return;
			}
		}

		const roomName = this.chooseNextColonyRoom();
		if (roomName) {
			const pos = Pathing.findPathablePosition(roomName);
			const flagName = DirectiveColonize.createIfNotPresent(pos, 'room');
			// if(flagName && typeof flagName != 'number' && roomName) {
			// 	Game.flags[flagName].memory.waypoints = 
			// }
			log.notify(`Room ${roomName} selected as next colony! Creating colonization directive.`);
		}
	}

	private chooseNextColonyRoom(): string | undefined {
		// Generate a list of possible colonies to expand from based on level and whether they are already expanding
		// let possibleIncubators: Colony[] = []; // TODO: support incubation
		const possibleColonizers: Colony[] = [];
		for (const colony of getAllColonies()) {
			// if (colony.level >= DirectiveIncubate.requiredRCL
			// 	&& _.filter(colony.flags, flag => DirectiveIncubate.filter(flag)).length == 0) {
			// 	possibleIncubators.push(colony);
			// }
			if (colony.level >= DirectiveColonize.requiredRCL
				&& _.filter(colony.flags, (flag: Flag) => DirectiveColonize.filter(flag)).length == 0) {
				possibleColonizers.push(colony);
			}
		}
		const possibleBestExpansions = <{roomName:string, score:number}[]>_.compact(_.map(possibleColonizers, (col: Colony) => this.getBestExpansionRoomFor(col)));
		log.debug(JSON.stringify(possibleBestExpansions));
		const bestExpansion = maxBy(possibleBestExpansions, choice => choice!.score);
		if (bestExpansion) {
			log.alert(`Next expansion chosen: ${bestExpansion.roomName} with score ${bestExpansion.score}`);
			return bestExpansion.roomName;
		} else {
			log.alert(`No viable expansion rooms found!`);
		}
	}

	private getBestExpansionRoomFor(colony: Colony): { roomName: string, score: number } | undefined {
		const allColonyRooms = _.zipObject(_.map(getAllColonies(),
			(											   col: { room: { name: any; }; }) => [col.room.name, true])) as { [roomName: string]: boolean };
		const allOwnedMinerals = _.map(getAllColonies(), (col: { room: { mineral: any; }; }) => col.room.mineral!.mineralType) as MineralConstant[];
		let bestRoom: string = '';
		let bestScore: number = -Infinity;
		for (const roomName in colony.memory.expansionData.possibleExpansions) {
			let score = colony.memory.expansionData.possibleExpansions[roomName] as number | boolean;
			if (typeof score != 'number') continue;
			// Compute modified score
			if (score + MAX_SCORE_BONUS > bestScore) {
				// Exclude all rooms on the west
				// if(roomName.startsWith('W')) continue;
				// Is the room too close to an existing colony?
				const range2Rooms = Cartographer.findRoomsInRange(roomName, MIN_EXPANSION_DISTANCE);
				if (_.find(range2Rooms, (roomName: string | number) => allColonyRooms[roomName])) {
					continue; // too close to another colony
				}
				const range3Rooms = Cartographer.findRoomsInRange(roomName, MIN_EXPANSION_DISTANCE + 1);
				if (_.find(range3Rooms, (roomName: string | number) => allColonyRooms[roomName])) {
					score -= TOO_CLOSE_PENALTY;
				}
				// Are there powerful hostile rooms nearby?
				const adjacentRooms = Cartographer.findRoomsInRange(roomName, 1);
				if (_.find(adjacentRooms, (roomName: string | number) => Memory.rooms[roomName] ? Memory.rooms[roomName][_RM.AVOID] : false)) {
					continue;
				}
				// Reward new minerals and catalyst rooms
				const mineralType = Memory.rooms[roomName][_RM.MINERAL]
								  ? Memory.rooms[roomName][_RM.MINERAL]![_RM_MNRL.MINERALTYPE]
								  : undefined;
				if (mineralType) {
					if (!allOwnedMinerals.includes(mineralType)) {
						score += UNOWNED_MINERAL_BONUS;
					}
					if (mineralType == RESOURCE_CATALYST) {
						score += CATALYST_BONUS;
					}
				}
				// Update best choices
				if (score > bestScore && isRoomAvailable(roomName)) {
					bestScore = score;
					bestRoom = roomName;
				}
			}
		}
		if (bestRoom != '') {
			return {roomName: bestRoom, score: bestScore};
		}
	}

	init(): void {

	}

	run(): void {
		if (Game.time % CHECK_EXPANSION_FREQUENCY == 17 && getAutonomyLevel() == Autonomy.Automatic) {
			this.handleExpansion();
		}
	}

}
