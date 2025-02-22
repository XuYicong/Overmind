import { OvermindConsole } from 'console/Console';
import {Colony, ColonyMemory, ColonyStage, DEFCON} from './Colony';
import {log} from './console/log';
import {bodyCost} from './creepSetups/CreepSetup';
import {Roles} from './creepSetups/setups';
import {DirectiveClearRoom} from './directives/colony/clearRoom';
import {DirectiveColonize} from './directives/colony/colonize';
import {DirectiveOutpost} from './directives/colony/outpost';
import {DirectiveGuard} from './directives/defense/guard';
import {DirectiveInvasionDefense} from './directives/defense/invasionDefense';
import {DirectiveOutpostDefense} from './directives/defense/outpostDefense';
import {Directive} from './directives/Directive';
import {Notifier} from './directives/Notifier';
import {DirectiveBootstrap} from './directives/situational/bootstrap';
import {DirectiveNukeResponse} from './directives/situational/nukeResponse';
import {DirectiveTerminalEvacuateState} from './directives/terminalState/terminalState_evacuate';
import {RoomIntel} from './intel/RoomIntel';
import {LogisticsNetwork} from './logistics/LogisticsNetwork';
import {Autonomy, getAutonomyLevel, Mem} from './memory/Memory';
import {Pathing} from './movement/Pathing';
import {Overlord} from './overlords/Overlord';
import {profile} from './profiler/decorator';
import {CombatPlanner} from './strategy/CombatPlanner';
import {Cartographer, ROOMTYPE_CONTROLLER, ROOMTYPE_SOURCEKEEPER} from './utilities/Cartographer';
import {isRoomAvailable, derefCoords, hasJustSpawned, minBy, onPublicServer} from './utilities/utils';
import {USE_TRY_CATCH} from './~settings';


// export const DIRECTIVE_CHECK_FREQUENCY = 2;

interface OverseerMemory {
	suspendUntil: { [overlordRef: string]: number }; // overlords are suspended until tick
}

const defaultOverseerMemory: OverseerMemory = {
	suspendUntil: {},
};

/**
 * The Overseer object acts as a scheduler, running directives and overlords for all colonies each tick. It is also
 * in charge of starting new "processes" (directives) to respond to various situations.
 */
@profile
export class Overseer implements IOverseer {

	private memory: OverseerMemory;
	private overlords: Overlord[];								// Overlords sorted by priority
	private sorted: boolean;
	private overlordsByColony: { [col: string]: Overlord[] };	// Overlords grouped by colony
	private directives: Directive[];							// Directives across the colony
	combatPlanner: CombatPlanner;
	notifier: Notifier;

	static settings = {
		outpostCheckFrequency: onPublicServer() ? 512 : 100,
		cpuBucketLowerBound: 7000,
		cpuUsageLowerBound: 0.75,
	};

	constructor() {
		this.memory = Mem.wrap(Memory, 'overseer', defaultOverseerMemory);
		this.directives = [];
		this.overlords = [];
		this.overlordsByColony = {};
		this.sorted = false;
		this.notifier = new Notifier();
		this.combatPlanner = new CombatPlanner();
	}

	refresh() {
		this.memory = Mem.wrap(Memory, 'overseer', defaultOverseerMemory);
		this.notifier.clear();
	}

	private try(callback: () => any, identifier?: string): void {
		if (USE_TRY_CATCH) {
			try {
				callback();
			} catch (e: any) {
				if (identifier) {
					e.name = `Caught unhandled exception at ${'' + callback} (identifier: ${identifier}): \n`
							 + e.name + '\n' + e.stack;
				} else {
					e.name = `Caught unhandled exception at ${'' + callback}: \n` + e.name + '\n' + e.stack;
				}
				Overmind.exceptions.push(e);
			}
		} else {
			callback();
		}
	}

	private get colonies(): Colony[] {
		return _.values(Overmind.colonies);
	}

	registerDirective(directive: Directive): void {
		this.directives.push(directive);
	}

	removeDirective(directive: Directive): void {
		_.remove(this.directives, dir => dir.name == directive.name);
		for (const name in directive.overlords) {
			this.removeOverlord(directive.overlords[name]);
		}
	}

	registerOverlord(overlord: Overlord): void {
		this.overlords.push(overlord);
		if (!this.overlordsByColony[overlord.colony.name]) {
			this.overlordsByColony[overlord.colony.name] = [];
		}
		this.overlordsByColony[overlord.colony.name].push(overlord);
	}

	getOverlordsForColony(colony: Colony): Overlord[] {
		return this.overlordsByColony[colony.name];
	}

	private removeOverlord(overlord: Overlord): void {
		_.remove(this.overlords, o => o.ref == overlord.ref);
		if (this.overlordsByColony[overlord.colony.name]) {
			_.remove(this.overlordsByColony[overlord.colony.name], o => o.ref == overlord.ref);
		}
	}

	private hasOverlord(colony: Colony, name: string): boolean {
		return _.any(this.getOverlordsForColony(colony), overlord => overlord.name == name);
	}

	isOverlordSuspended(overlord: Overlord): boolean {
		if (this.memory.suspendUntil[overlord.ref]) {
			if (Game.time < this.memory.suspendUntil[overlord.ref]) {
				return true;
			} else {
				delete this.memory.suspendUntil[overlord.ref];
				return false;
			}
		}
		return false;
	}

	suspendOverlordFor(overlord: Overlord, ticks: number): void {
		this.memory.suspendUntil[overlord.ref] = Game.time + ticks;
	}

	suspendOverlordUntil(overlord: Overlord, untilTick: number): void {
		this.memory.suspendUntil[overlord.ref] = untilTick;
	}

	remainingSuspendTime(overlord: Overlord): number {
		if (this.memory.suspendUntil[overlord.ref]) {
			return this.memory.suspendUntil[overlord.ref] - Game.time;
		}
		return 0;
	}

	private registerLogisticsRequests(colony: Colony): void {
		// Register logistics requests for all dropped resources and tombstones
		for (const room of colony.rooms) {
			// Pick up all nontrivial dropped resources
			for (const resourceType in room.drops) {
				for (const drop of room.drops[resourceType]) {
					if (drop.amount > LogisticsNetwork.settings.droppedEnergyThreshold
						|| drop.resourceType != RESOURCE_ENERGY) {
						colony.logisticsNetwork.requestOutput(drop);
					}
				}
			}
			// Pick up all nontrivial ruin resources
			for (const ruin of room.ruins) {
				if (ruin.store.getUsedCapacity() > LogisticsNetwork.settings.droppedEnergyThreshold
					|| _.sum(_.values(ruin.store)) > ruin.store.energy) {
					if (colony.bunker && ruin.pos.isEqualTo(colony.bunker.anchor)) continue;
					colony.logisticsNetwork.requestOutput(ruin, {resourceType: 'all'});
				}
			}
		}
		// Place a logistics request directive for every tombstone with non-empty store that isn't on a container
		for (const tombstone of colony.tombstones) {
			if (tombstone.store.getUsedCapacity() > LogisticsNetwork.settings.droppedEnergyThreshold
				|| tombstone.store.getUsedCapacity() > tombstone.store.energy) {
				if (colony.bunker && tombstone.pos.isEqualTo(colony.bunker.anchor)) continue;
				colony.logisticsNetwork.requestOutput(tombstone, {resourceType: 'all'});
			}
		}
	}

	private handleBootstrapping(colony: Colony) {
		// Bootstrap directive: in the event of catastrophic room crash, enter emergency spawn mode.
		// Doesn't apply to incubating colonies.
		if (!colony.isIncubating && !colony.memory.sleep) {
			const noQueen = colony.getCreepsByRole(Roles.loader).length == 0;
			if (noQueen && colony.hatchery && !colony.spawnGroup) {
				const setup = colony.hatchery.overlord.queenSetup;
				const energyToMakeQueen = bodyCost(setup.generateBody(colony.room.energyCapacityAvailable));
				if (colony.room.energyAvailable < energyToMakeQueen || hasJustSpawned()) {
					const result = DirectiveBootstrap.createIfNotPresent(colony.hatchery.pos, 'pos');
					if (typeof result == 'string' || result == OK) { // successfully made flag
						colony.hatchery.settings.suppressSpawning = true;
					}
				}
			}
		}
	}

	private handleOutpostDefense(colony: Colony) {
		// Guard directive: defend your outposts and all rooms of colonies that you are incubating
		for (const room of colony.outposts) {
			// Handle player defense
			if (room.playerHostiles.length > 0) {
				DirectiveOutpostDefense.createIfNotPresent(Pathing.findPathablePosition(room.name), 'room');
				return;
			}
			// Handle NPC invasion directives
			if (Cartographer.roomType(room.name) != ROOMTYPE_SOURCEKEEPER) { // SK rooms can fend for themselves
				const defenseFlags = _.filter(room.flags, flag => DirectiveGuard.filter(flag) ||
																  DirectiveOutpostDefense.filter(flag));
				const inDanger = room.dangerousHostiles.length > 0 || room.invaderCore;
				if (inDanger && defenseFlags.length == 0) {
					DirectiveGuard.create((room.invaderCore && room.invaderCore.pos) || room.dangerousHostiles[0].pos);
				}
			}
		}
	}

	private handleColonyInvasions(colony: Colony) {
		// Defend against invasions in owned rooms
		if (colony.room.dangerousPlayerHostiles.length) {
			DirectiveInvasionDefense.createIfNotPresent(colony.controller.pos, 'room');
		}
	}

	private handleNukeResponse(colony: Colony) {
		// Place nuke response directive if there is a nuke present in colony room
		if (colony.room && colony.level >= DirectiveNukeResponse.requiredRCL) {
			for (const nuke of colony.room.find(FIND_NUKES)) {
				DirectiveNukeResponse.createIfNotPresent(nuke.pos, 'pos');
			}
		}
	}

	/* Place new event-driven flags where needed to be instantiated on the next tick */
	private placeDirectives(colony: Colony): void {
		if (colony.memory.sleep) return;
		this.handleBootstrapping(colony);
		if (Game.time%10 == colony.id) {
			this.handleOutpostDefense(colony);
			this.handleColonyInvasions(colony);
		}
		if (Game.time % 4 == 0) this.handleNukeResponse(colony);
		if (getAutonomyLevel() > Autonomy.Manual) {
			// Place pioneer directives in case the colony doesn't have a spawn for some reason
			if (Game.time % 29 == 0 && colony.spawns.length == 0 &&
				!DirectiveClearRoom.isPresent(colony.pos, 'room')) {
				// verify that there are no spawns (not just a caching glitch)
				const spawns = Game.rooms[colony.name]!.find(FIND_MY_SPAWNS);
				if (spawns.length == 0) {
					const pos = Pathing.findPathablePosition(colony.room.name);
					DirectiveColonize.createIfNotPresent(pos, 'room');
				}
			}
		}
	}

	private computePossibleOutposts(colony: Colony, depth = 3): string[] {
		return _.filter(Cartographer.findRoomsInRange(colony.room.name, depth), roomName => {
			if (Cartographer.roomType(roomName) != ROOMTYPE_CONTROLLER) {
				return false;
			}
			const alreadyAnOutpost = _.some(Overmind.cache.outpostFlags,
										 flag => (flag.memory.setPosition || flag.pos).roomName == roomName);
			const alreadyAColony = !!Overmind.colonies[roomName];
			if (alreadyAColony || alreadyAnOutpost) {
				return false;
			}
			const alreadyOwned = RoomIntel.roomOwnedBy(roomName);
			const alreadyReserved = RoomIntel.roomReservedBy(roomName);
			const isBlocked = Game.flags[roomName + '-Block'] != null; // TODO: this is ugly
			if (isBlocked) {
				// Game.notify("Room " + roomName + " is blocked, not expanding there.");
			}
			const disregardReservations = !onPublicServer() && colony.room.energyAvailable > 300005;
			if (alreadyOwned || (alreadyReserved && !disregardReservations)) {
				return false;
			}
			const neighboringRooms = _.values(Game.map.describeExits(roomName)) as string[];
			const isReachableFromColony = _.some(neighboringRooms, r => colony.roomNames.includes(r));
			if(!isReachableFromColony || !isRoomAvailable(roomName)){
				return false;
			}
			const shouldBackOff = _.some(neighboringRooms,
						r => false// RoomIntel.roomOwnedBy(r) || RoomIntel.roomReservedBy(r)
						);
			return !shouldBackOff;
		});
	}

	private handleNewOutposts(colony: Colony): boolean {
		// TODO: adjust outpost allocations based on energy stats

		const possibleOutposts = this.computePossibleOutposts(colony);

		const origin = colony.pos;
		const bestOutpost = minBy(possibleOutposts, function(roomName) {
			if (!Memory.rooms[roomName]) return false;
			const sourceCoords = Memory.rooms[roomName][_RM.SOURCES] as SavedSource[] | undefined;
			if (!sourceCoords) return false;
			const sourcePositions = _.map(sourceCoords, src => derefCoords(src.c, roomName));
			const sourceDistances = _.map(sourcePositions, pos => Pathing.distance(origin, pos));
			if (_.some(sourceDistances, dist => dist == undefined || dist > Colony.settings.maxSourceDistance)) {
				return false;
			}
			return _.sum(sourceDistances) / sourceDistances.length;
		});

		if (bestOutpost) {
			const pos = Pathing.findPathablePosition(bestOutpost);
			log.info(`Colony ${colony.room.print} now remote mining from ${pos.print}`);
			DirectiveOutpost.createIfNotPresent(pos, 'room', {memory: {[_MEM.COLONY]: colony.name}});
			return true;
		}
		return false;
	}

	private manageOutposts(): void {
		// Remove and create outposts based on CPU stats
		if (Game.time % Overseer.settings.outpostCheckFrequency != 0) return;

		// Suspend and unsuspend colonies based on CPU usage
		function isColonySuspended(roomName: string): boolean {
			return !Overmind.colonies[roomName];
			// const colonyMemory = Memory.colonies[roomName] as ColonyMemory | undefined;
			// return !!colonyMemory && !!colonyMemory.suspend;
		}

		const ownedRooms = [];
		// Unsuspend crucial colonies
		for (const roomName in Game.rooms) {
			const room = Game.rooms[roomName];
			if (room.my) {
				ownedRooms.push(room);
				// TODO: unsuspend on invasion
				if (room.controller!.ticksToDowngrade < 50000 && isColonySuspended(room.name)) {
					OvermindConsole.unsuspendColony(room.name);
					return;
				}
			}
		}
		const roomsByTickdown = _.sortBy(ownedRooms, room => room.controller!.ticksToDowngrade);

		// Choose target colony to modify its outposts
		const coloniesByOutpost = _.sortBy(this.colonies, colony => _.sum(colony.roomNames,
			roomName => Memory.rooms[roomName] && Memory.rooms[roomName][_RM.SOURCES]
						? Memory.rooms[roomName][_RM.SOURCES]!.length
						: 0) - colony.room.sources.length);

		// Suspend colony on low CPU bucket
		if (Game.cpu.bucket < Overseer.settings.cpuBucketLowerBound) {
			for (let i=coloniesByOutpost.length-1; i >= 0; --i) {
				// if (coloniesByOutpost[i].roomNames.length <= 1) break;
				const names = _.filter(coloniesByOutpost[i].roomNames, 
					rmnm => rmnm != coloniesByOutpost[i].room.name && !!Game.rooms[rmnm]);
				// choose any room not adjacent to colony
				const farOuts = _.filter(names, roomName => {
					const neighboringRooms = _.values(Game.map.describeExits(roomName)) as string[];
					return !neighboringRooms.includes(coloniesByOutpost[i].room.name)
				});
				let roomName = "";
				if (farOuts.length > 0) {
					roomName = farOuts[0];
				} else if (names.length > 0) {
					// choose any room not same as colony
					roomName = names[0];
				} else {
					// if no vision in any outpost
					continue;
				}
				// remove all flags here
				for (const flag of Game.rooms[roomName].flags) {
					flag.remove();
				}
				log.info('remove outpost '+roomName);
				return;
			}

			for (let i = roomsByTickdown.length -1; i>=0; --i) {
				const room = roomsByTickdown[i];
				if (!isColonySuspended(room.name) && Overmind.colonies[room.name].defcon == DEFCON.safe && 
				!this.hasOverlord(Overmind.colonies[room.name], 'warmup')) {
					OvermindConsole.suspendColony(room.name);
					return;
				}
			}
		}

		// Create outposts or unsuspend colonies on low CPU usage
		if (Memory.stats.persistent.avgCPU / Game.cpu.limit < Overseer.settings.cpuUsageLowerBound) {
			for (let i=0; i< coloniesByOutpost.length; ++i) {
				if (this.handleNewOutposts(coloniesByOutpost[i])) return;
			}

			for (let i = 0; i < roomsByTickdown.length; ++i) {
				const room = roomsByTickdown[i];
				if (isColonySuspended(room.name)) {
					OvermindConsole.unsuspendColony(room.name);
					return;
				}
			}
		}

	}

	// Safe mode condition =============================================================================================

	private handleSafeMode(colony: Colony): void {
		if (colony.stage == ColonyStage.Larva && onPublicServer()) {
			return;
		}
		// Safe mode activates when there are dangerous player hostiles that can reach the spawn
		const criticalStructures = _.compact([...colony.spawns,
											  colony.storage,
											  colony.terminal]) as Structure[];
		for (const structure of criticalStructures) {
			if (structure.hits < structure.hitsMax &&
				structure.pos.findInRange(colony.room.dangerousPlayerHostiles, 2).length > 0) {
				const ret = colony.controller.activateSafeMode();
				if (ret != OK && !colony.controller.safeMode) {
					if (colony.terminal) {
						DirectiveTerminalEvacuateState.createIfNotPresent(colony.terminal.pos, 'room');
					}
				} else {
					return;
				}
			}
		}
		const firstHostile = _.first(colony.room.dangerousPlayerHostiles);
		if (firstHostile && colony.spawns[0]) {
			const barriers = _.map(colony.room.barriers, barrier => barrier.pos);
			if (Pathing.isReachable(firstHostile.pos, colony.spawns[0].pos, barriers)) {
				const ret = colony.controller.activateSafeMode();
				if (ret != OK && !colony.controller.safeMode) {
					if (colony.terminal) {
						DirectiveTerminalEvacuateState.createIfNotPresent(colony.terminal.pos, 'room');
					}
				} else {
					return;
				}
			}
		}
	}

	// Initialization ==================================================================================================

	init(): void {
		// Initialize directives
		for (const directive of this.directives) {
			directive.init();
		}
		// Sort overlords by priority if needed (assumes priority does not change after constructor phase
		if (!this.sorted) {
			this.overlords.sort((o1, o2) => o1.priority - o2.priority);
			for (const colName in this.overlordsByColony) {
				this.overlordsByColony[colName].sort((o1, o2) => o1.priority - o2.priority);
			}
			this.sorted = true;
		}
		// Initialize overlords
		for (const overlord of this.overlords) {
			// if (!this.isOverlordSuspended(overlord)) {
				overlord.preInit();
				this.try(() => overlord.init());
			// }
		}
		// Register cleanup requests to logistics network
		for (const colony of this.colonies) {
			this.registerLogisticsRequests(colony);
		}
	}

	// Operation =======================================================================================================

	run(): void {
		for (const directive of this.directives) {
			directive.run();
		}
		for (const overlord of this.overlords) {
			// if (!this.isOverlordSuspended(overlord)) {
				this.try(() => overlord.run());
			// }
		}
		for (const colony of this.colonies) {
			this.handleSafeMode(colony);
			this.placeDirectives(colony);
		}
		this.manageOutposts();
	}

	getCreepReport(colony: Colony): string[][] {
		const spoopyBugFix = false;
		const roleOccupancy: { [role: string]: [number, number] } = {};

		for (const overlord of this.overlordsByColony[colony.name]) {
			for (const role in overlord.creepUsageReport) {
				const report = overlord.creepUsageReport[role];
				if (report == undefined) {
					if (Game.time % 101 == 0) {
						log.info(`Role ${role} is not reported by ${overlord.ref}!`);
					}
				} else {
					if (roleOccupancy[role] == undefined) {
						roleOccupancy[role] = [0, 0];
					}
					roleOccupancy[role][0] += report[0];
					roleOccupancy[role][1] += report[1];
					// if (spoopyBugFix) { // bizzarely, if you comment these lines out, the creep report is incorrect
					// 	log.debug(`report: ${JSON.stringify(report)}`);
					// 	log.debug(`occupancy: ${JSON.stringify(roleOccupancy)}`);
					// }
				}
			}
		}


		// let padLength = _.max(_.map(_.keys(roleOccupancy), str => str.length)) + 2;
		const roledata: string[][] = [];
		for (const role in roleOccupancy) {
			const [current, needed] = roleOccupancy[role];
			// if (needed > 0) {
			// 	stringReport.push('| ' + `${role}:`.padRight(padLength) +
			// 					  `${Math.floor(100 * current / needed)}%`.padLeft(4));
			// }
			roledata.push([role, `${current}/${needed}`]);
		}
		return roledata;
	}

	visuals(): void {
		for (const directive of this.directives) {
			directive.visuals();
		}
		for (const overlord of this.overlords) {
			overlord.visuals();
		}
		this.notifier.visuals();
		// for (let colony of this.colonies) {
		// 	this.drawCreepReport(colony);
		// }
	}
}
