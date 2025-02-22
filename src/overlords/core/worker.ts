import { log } from 'console/log';
import {$} from '../../caching/GlobalCache';
import {Colony, ColonyStage, DEFCON} from '../../Colony';
import {Roles, Setups} from '../../creepSetups/setups';
import {TERMINAL_STATE_REBUILD} from '../../directives/terminalState/terminalState_rebuild';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {BuildPriorities, FortifyPriorities} from '../../priorities/priorities_structures';
import {profile} from '../../profiler/decorator';
import {boostResources} from '../../resources/map_resources';
import {Task} from '../../tasks/Task';
import {Tasks} from '../../tasks/Tasks';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {minBy} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {Overlord, ZergOptions} from '../Overlord';

/**
 * Spawns general-purpose workers, which maintain a colony, performing actions such as building, repairing, fortifying,
 * paving, and upgrading, when needed
 */
@profile
export class WorkerOverlord extends Overlord {

	workers: Zerg[];
	room: Room;
	repairStructures: Structure[];
	dismantleStructures: Structure[];
	fortifyBarriers: (StructureWall | StructureRampart)[];
	criticalBarriers: (StructureWall | StructureRampart)[];
	constructionSites: ConstructionSite[];
	nukeDefenseRamparts: StructureRampart[];
	nukeDefenseHitsRemaining: { [id: string]: number };

	static settings = {
		barrierHits         : {			// What HP to fortify barriers to at each RCL
			critical: 2500,
			1       : 3e+3,
			2       : 3e+3,
			3       : 2e+5,
			4       : 2.6e+5,
			5       : 4e+5,
			6       : 1e+6,
			7       : 2e+6,
			8       : 2e+7,
		},
		hitTolerance        : 100000, 	// allowable spread in HP
		fortifyDutyThreshold: 500000,	// ignore fortify duties until this amount of energy is present in the room
	};

	constructor(colony: Colony, priority = OverlordPriority.ownedRoom.work) {
		super(colony, 'worker', priority);
		// Compute barriers needing fortification or critical attention
		this.fortifyBarriers = $.structures(this, 'fortifyBarriers', () =>
			_.sortBy(_.filter(this.room.barriers, s =>
				s.hits < WorkerOverlord.settings.barrierHits[this.colony.level]
				&& this.colony.roomPlanner.barrierPlanner.barrierShouldBeHere(s.pos)
			), s => s.hits), 25);
		// TODO: critical barriers is not refreshed correctly
		this.criticalBarriers = $.structures(this, 'criticalBarriers', () =>
			_.filter(this.fortifyBarriers,
					 barrier => barrier.hits < WorkerOverlord.settings.barrierHits.critical), 10);
		// Generate a list of structures needing repairing (different from fortifying except in critical case)
		this.repairStructures = $.structures(this, 'repairStructures', () =>
			_.filter(this.colony.repairables, structure => {
				if (structure.structureType == STRUCTURE_CONTAINER) {
					// only repair containers in owned room
					if (structure.pos.roomName == this.colony.name) {
						return structure.hits < 0.5 * structure.hitsMax;
					} else {
						return false;
					}
				} else {
					return structure.hits < structure.hitsMax;
				}
			}));
		this.dismantleStructures = [];

		const homeRoomName = this.colony.room.name;
		const defcon = this.colony.defcon;
		// Filter constructionSites to only build valid ones
		const room = this.colony.room as any;
		const level = this.colony.controller.level;
		this.constructionSites = _.filter(this.colony.constructionSites, function(site) {
			// If site will be more than max amount of a structure at current level, ignore (happens after downgrade)
			const structureAmount = room[site.structureType + 's'] ? room[site.structureType + 's'].length :
									(room[site.structureType] ? 1 : 0);
			if (structureAmount >= CONTROLLER_STRUCTURES[site.structureType][level]) {
				return false;
			}
			if (defcon > DEFCON.safe) {
				// Only build non-road, non-container sites in the home room if defcon is unsafe
				return site.pos.roomName == homeRoomName &&
					   site.structureType != STRUCTURE_CONTAINER &&
					   site.structureType != STRUCTURE_ROAD;
			} else {
				// Build all non-container sites in outpost and all sites in room if defcon is safe
				if (site.pos.roomName != homeRoomName
					&& Cartographer.roomType(site.pos.roomName) == ROOMTYPE_CONTROLLER) {
					return site.structureType != STRUCTURE_CONTAINER &&
						   !(site.room && site.room.dangerousHostiles.length > 0);
				} else {
					return true;
				}
			}
		});

		// Nuke defense ramparts needing fortification
		this.nukeDefenseRamparts = [];
		this.nukeDefenseHitsRemaining = {};
		if (this.room.find(FIND_NUKES).length > 0) {
			for (const rampart of this.colony.room.ramparts) {
				const neededHits = this.neededRampartHits(rampart);
				if (rampart.hits < neededHits) {
					this.nukeDefenseRamparts.push(rampart);
					this.nukeDefenseHitsRemaining[rampart.id] = neededHits - rampart.hits;
				}
			}
		}

		// Spawn boosted workers if there is significant fortifying which needs to be done
		const opts: ZergOptions = {};
		const totalNukeDefenseHitsRemaining = _.sum(_.values(this.nukeDefenseHitsRemaining));
		const approximateRepairPowerPerLifetime = REPAIR_POWER * 50 / 3 * CREEP_LIFE_TIME;
		if (totalNukeDefenseHitsRemaining > 3 * approximateRepairPowerPerLifetime) {
			opts.boostWishlist = [boostResources.construct[3]];
		}

		// Register workers
		this.workers = this.zerg(Roles.worker, opts);
	}

	private neededRampartHits(rampart: StructureRampart): number {
		let neededHits = 0; // WorkerOverlord.settings.barrierHits[this.colony.level];
		for (const nuke of rampart.pos.lookFor(LOOK_NUKES)) {
			neededHits += 10e6;
		}
		for (const nuke of rampart.pos.findInRange(FIND_NUKES, 3)) {
			if (nuke.pos != rampart.pos) {
				neededHits += 5e6;
			}
		}
		return neededHits;
	}

	refresh() {
		super.refresh();
		$.refresh(this, 'repairStructures', 'dismantleStructures', 'fortifyBarriers', 'criticalBarriers',
				  'constructionSites', 'nukeDefenseRamparts');
	}

	init() {
		const setup = this.colony.level == 1 ? Setups.workers.early : Setups.workers.default;
		const workPartsPerWorker = setup.getBodyPotential(WORK, this.colony);
		let numWorkers: number;
		if (this.colony.stage == ColonyStage.Larva) {
			// TODO: 此时如果存在开房目标，则认为该房是跳板房
			// if (this.colony.)
			numWorkers = $.number(this, 'numWorkers', () => {
				// At lower levels, try to saturate the energy throughput of the colony
				const MAX_WORKERS = 16; // Maximum number of workers to spawn
				const energyMinedPerTick = _.sum(_.map(this.colony.miningSites, function(site) {
					const overlord = site.overlords.mine;
					const miningPowerAssigned = _.sum(overlord.miners, miner => miner.getActiveBodyparts(WORK));
					const saturation = Math.min(miningPowerAssigned / overlord.miningPowerNeeded, 1);
					return overlord.energyPerTick * saturation;
				}));
				const energyPerTickPerWorker = 1.1 * workPartsPerWorker; // Average energy per tick when working
				// TODO: instead of calculating, use 负反馈调节 to 动态决定数量。如房间存在遗址，就可以生产非常多worker
				const workerUptime = 0.6;
				const numWorkers = Math.ceil(energyMinedPerTick / (energyPerTickPerWorker * workerUptime));
				return Math.min(numWorkers, MAX_WORKERS);
			});
		} else if (this.colony.level < 6) {
			numWorkers = 2;
		} else {
			if (this.colony.roomPlanner.memory.relocating) {
				// If relocating, maintain a maximum of workers
				numWorkers = 5;
			} else {
				numWorkers = $.number(this, 'numWorkers', () => {
					// At higher levels, spawn workers based on construction and repair that needs to be done
					const MAX_WORKERS = 5; // Maximum number of workers to spawn
					if (this.nukeDefenseRamparts.length > 0) {
						return MAX_WORKERS;
					}
					const buildTicks = _.sum(this.constructionSites,
										   site => Math.max(site.progressTotal - site.progress, 0)) / BUILD_POWER;
					const repairTicks = _.sum(this.repairStructures,
											structure => structure.hitsMax - structure.hits) / REPAIR_POWER;
					const paveTicks = _.sum(this.colony.rooms,
										  room => this.colony.roadLogistics.energyToRepave(room)) / 1; // repairCost=1
					let fortifyTicks = 0;
					if (this.colony.assets.energy > WorkerOverlord.settings.fortifyDutyThreshold) {
						fortifyTicks = 0.25 * _.sum(this.fortifyBarriers, barrier =>
							Math.max(0, WorkerOverlord.settings.barrierHits[this.colony.level]
										- barrier.hits)) / REPAIR_POWER;
					}
					// max constructionTicks for private server manually setting progress
					let numWorkers = Math.ceil(2 * (5 * buildTicks + repairTicks + paveTicks + fortifyTicks) /
											   (workPartsPerWorker * CREEP_LIFE_TIME));
					numWorkers = Math.min(numWorkers, MAX_WORKERS);
					if (this.colony.controller.ticksToDowngrade <= (this.colony.level >= 4 ? 10000 : 2000)) {
						numWorkers = Math.max(numWorkers, 1);
					}
					return numWorkers;
				});
				if (this.colony.defcon != DEFCON.safe) {
					numWorkers += 2;
				}
			}
		}
		this.wishlist(numWorkers, setup);
	}

	private repairActions(worker: Zerg): boolean {
		const target = worker.pos.findClosestByMultiRoomRange(this.repairStructures);
		if (target) {
			worker.task = Tasks.repair(target);
			return true;
		} else {
			return false;
		}
	}

	private buildActions(worker: Zerg): boolean {
		const groupedSites = _.groupBy(this.constructionSites, site => site.structureType);
		for (const structureType of BuildPriorities) {
			if (groupedSites[structureType]) {
				const sites = groupedSites[structureType];
				const target = worker.pos.findClosestByMultiRoomRange(_.filter(groupedSites[structureType], site => {
					if(!worker.taskPreference[site.ref]) {
						worker.taskPreference[site.ref] = -1;
					}
					return worker.taskPreference[site.ref] > -10;
				}));
				if (target) {
					worker.task = Tasks.build(target);
					log.debug(worker.name + ' get build task at ' + target.pos);
					return true;
				}
			}
		}
		return false;
	}

	private dismantleActions(worker: Zerg): boolean {
		const targets = _.filter(this.dismantleStructures, s => (s.targetedBy || []).length < 3);
		const target = worker.pos.findClosestByMultiRoomRange(targets);
		if (target) {
			_.remove(this.dismantleStructures, s => s == target);
			worker.task = Tasks.dismantle(target);
			return true;
		} else {
			return false;
		}
	}

	// Find a suitable repair ordering of roads with a depth first search
	private buildPavingManifest(worker: Zerg, room: Room): Task | null {
		let energy = worker.carry.energy;
		const targetRefs: { [ref: string]: boolean } = {};
		const tasks: Task[] = [];
		let target: StructureRoad | undefined;
		let previousPos: RoomPosition | undefined;
		while (true) {
			if (energy <= 0) break;
			if (previousPos) {
				target = _.find(this.colony.roadLogistics.repairableRoads(room),
								road => road.hits < road.hitsMax && !targetRefs[road.id]
										&& road.pos.getRangeTo(previousPos!) <= 1);
			} else {
				target = _.find(this.colony.roadLogistics.repairableRoads(room),
								road => road.hits < road.hitsMax && !targetRefs[road.id]);
			}
			if (target) {
				previousPos = target.pos;
				targetRefs[target.id] = true;
				energy -= (target.hitsMax - target.hits) / REPAIR_POWER;
				tasks.push(Tasks.repair(target));
			} else {
				break;
			}
		}
		return Tasks.chain(tasks);
	}

	private pavingActions(worker: Zerg): boolean {
		const roomToRepave = this.colony.roadLogistics.workerShouldRepave(worker)!;
		this.colony.roadLogistics.registerWorkerAssignment(worker, roomToRepave);
		// Build a paving manifest
		const task = this.buildPavingManifest(worker, roomToRepave);
		if (task) {
			worker.task = task;
			return true;
		} else {
			return false;
		}
	}

	private fortifyActions(worker: Zerg, fortifyStructures = this.fortifyBarriers): boolean {
		let lowBarriers: (StructureWall | StructureRampart)[];
		const highestBarrierHits = _.max(_.map(fortifyStructures, structure => structure.hits))!;
		if (highestBarrierHits > WorkerOverlord.settings.hitTolerance) {
			// At high barrier HP, fortify only structures that are within a threshold of the lowest
			const lowestBarrierHits = _.min(_.map(fortifyStructures, structure => structure.hits))!;
			lowBarriers = _.filter(fortifyStructures, structure => structure.hits <= lowestBarrierHits +
																   WorkerOverlord.settings.hitTolerance);
		} else {
			// Otherwise fortify the lowest N structures
			const numBarriersToConsider = 5; // Choose the closest barrier of the N barriers with lowest hits
			lowBarriers = _.take(fortifyStructures, numBarriersToConsider);
		}
		const target = worker.pos.findClosestByMultiRoomRange(lowBarriers);
		if (target) {
			worker.task = Tasks.fortify(target);
			return true;
		} else {
			return false;
		}
	}

	private overRepairActions(worker: Zerg, fortifyStructures = this.room.barriers): boolean {
		if (this.colony.defcon == DEFCON.safe) return false;
		const lowestBarrier = _.min(fortifyStructures, structure => structure.hits);
		const closeTarget = _.findWhere(fortifyStructures,
			s => s.hits - lowestBarrier.hits < 1 && s.pos.inRangeToPos(worker.pos, 3));
		let target = lowestBarrier;
		// if (!!closeTarget) {
		// 	target = closeTarget;
		// }
		if (!target.pos) return false;
		if (worker.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 1) {
			worker.task = Tasks.recharge();
			return true;
		}
		if (!worker.pos.inRangeToPos(target.pos, 3)) {
			worker.goTo(target, {range: 3, fleeRange: 2});
		} else {
			if (_.any(this.room.playerHostiles, creep => creep.pos.inRangeToPos(worker.pos, 3))) {
				worker.flee(this.room.playerHostiles, undefined, {range: 3});
			}
			worker.creep.repair(target);
		}
		return true
	}

	private nukeFortifyActions(worker: Zerg, fortifyStructures = this.nukeDefenseRamparts): boolean {
		const target = minBy(fortifyStructures, rampart => {
			const structuresUnderRampart = rampart.pos.lookFor(LOOK_STRUCTURES);
			return _.min(_.map(structuresUnderRampart, structure => {
				const priority = _.findIndex(FortifyPriorities, sType => sType == structure.structureType);
				if (priority >= 0) { // if found
					return priority;
				} else { // not found
					return 999;
				}
			}))!;
		});
		if (target) {
			worker.task = Tasks.fortify(target);
			return true;
		} else {
			return false;
		}
	}

	private upgradeActions(worker: Zerg): boolean {
		// Sign controller if needed
		// if ((!this.colony.controller.signedByMe && !this.colony.controller.signedByScreeps)) {
		// 	worker.task = Tasks.signController(this.colony.controller);
		// 	return true;
		// }
		worker.task = Tasks.upgrade(this.room.controller!);
		return true;
	}

	private handleWorker(worker: Zerg) {
		if (worker.carry.energy > 0) {
			// Upgrade controller if close to downgrade
			if (this.colony.controller.ticksToDowngrade <= (this.colony.level >= 4 ? this.colony.level >= 6 ? 90000 : 20000 : 2000)) {
				if (this.upgradeActions(worker)) return;
			}
			// Repair damaged non-road non-barrier structures
			if (this.repairStructures.length > 0 && this.colony.defcon == DEFCON.safe) {
				if (this.repairActions(worker)) return;
			}
			// Fortify critical barriers
			if (this.criticalBarriers.length > 0) {
				if (this.fortifyActions(worker, this.criticalBarriers)) return;
			}
			// Outrepair attacks
			if (this.colony.defcon !== DEFCON.safe) {
				if (this.overRepairActions(worker)) return;
			}
			// Build new structures
			if (this.constructionSites.length > 0) {
				if (this.buildActions(worker)) return;
			}
			// Build ramparts to block incoming nuke
			if (this.nukeDefenseRamparts.length > 0 && this.colony.terminalState != TERMINAL_STATE_REBUILD) {
				if (this.nukeFortifyActions(worker, this.nukeDefenseRamparts)) return;
			}
			// Build and maintain roads
			if (this.colony.roadLogistics.workerShouldRepave(worker) && this.colony.defcon == DEFCON.safe) {
				if (this.pavingActions(worker)) return;
			}
			// Fortify walls and ramparts
			if (this.fortifyBarriers.length > 0) {
				if (this.fortifyActions(worker, this.fortifyBarriers)) return;
			}
			// Upgrade controller if less than RCL8 or no upgraders
			if ((this.colony.level < 8 || this.colony.upgradeSite.overlord.upgraders.length == 0)
				&& this.colony.defcon == DEFCON.safe) {
				if (this.upgradeActions(worker)) return;
			} else {
				this.fortifyActions(worker, this.room.walkableRamparts);
			}
		} else {
			// Dismantle marked structures
			if (this.dismantleStructures.length > 0 && this.colony.defcon == DEFCON.safe) {
				if (this.dismantleActions(worker)) return;
			}
			// Acquire more energy
			const workerWithdrawLimit = this.colony.stage == ColonyStage.Larva ? 400 : 100;
			worker.task = Tasks.recharge(workerWithdrawLimit);
		}
	}

	run() {
		this.autoRun(this.workers, worker => this.handleWorker(worker),
					 worker => worker.flee(worker.room.fleeDefaults, {invalidateTask: false}));
	}
}
