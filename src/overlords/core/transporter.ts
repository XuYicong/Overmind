import {Colony} from '../../Colony';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {isResource, isRuin, hasGeneralPurposeStore, isTombstone, isCreep, isPowerCreep} from '../../declarations/typeGuards';
import {ALL_RESOURCE_TYPE_ERROR, BufferTarget, LogisticsRequest} from '../../logistics/LogisticsNetwork';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

/**
 * The transport overlord handles energy transport throughout a colony
 */
@profile
export class TransportOverlord extends Overlord {

	transporters: Zerg[];

	constructor(colony: Colony, priority = OverlordPriority.ownedRoom.transport) {
		super(colony, 'logistics', priority);
		this.transporters = this.zerg(Roles.transport);
	}

	private neededTransportPower(): number {

		if (!this.colony.storage
			&& !(this.colony.hatchery && this.colony.hatchery.battery)
			&& !this.colony.upgradeSite.battery) {
			return 0;
		}

		let transportPower = 0;
		const scaling = 2; // this.colony.stage == ColonyStage.Larva ? 1.5 : 2.0; // aggregate round-trip multiplier

		// Add contributions to transport power from hauling energy from mining sites
		for (const flagName in this.colony.miningSites) {
			const o = this.colony.miningSites[flagName].overlords.mine;
			if (!o.isSuspended && o.miners.length > 0) {
				// Only count sites which have a container output and which have at least one miner present
				// (this helps in difficult "rebooting" situations)
				if (o.container && !o.link) {
					transportPower += o.energyPerTick * scaling * o.distance;
				}
			}
		}

		// Add transport power needed to move to upgradeSite
		if (this.colony.upgradeSite.battery) {
			transportPower += UPGRADE_CONTROLLER_POWER * this.colony.upgradeSite.upgradePowerNeeded * scaling *
							  Pathing.distance(this.colony.pos, this.colony.upgradeSite.battery.pos);
		}


		if (this.colony.lowPowerMode) {
			// Reduce needed transporters when colony is in low power mode
			transportPower *= 0.5;
		}

		return transportPower / CARRY_CAPACITY;
	}

	init() {
		const ROAD_COVERAGE_THRESHOLD = 0.75; // switch from 1:1 to 2:1 transporters above this coverage threshold
		const setup = this.colony.roomPlanner.roadPlanner.roadCoverage < ROAD_COVERAGE_THRESHOLD
					? Setups.transporters.early : Setups.transporters.default;

		const transportPowerEach = setup.getBodyPotential(CARRY, this.colony);
		const neededTransportPower = this.neededTransportPower();
		const numTransporters = Math.ceil(neededTransportPower / transportPowerEach);

		if (this.transporters.length == 0) {
			this.wishlist(numTransporters, setup, {priority: OverlordPriority.ownedRoom.firstTransport});
		} else {
			this.wishlist(numTransporters, setup);
		}
	}

	private handleTransporter(transporter: Zerg, request: LogisticsRequest | undefined) {
		if (request) {
			const choices = this.colony.logisticsNetwork.bufferChoices(transporter, request);
			if(choices.length <= 0) {
				this.handleTransporter(transporter, undefined);
				return;
			}
			const bestChoice = _.last(_.sortBy(choices, choice => request.multiplier * choice.dQ
																/ Math.max(choice.dt, 0.1)));
			let task = null;
			const amount = this.colony.logisticsNetwork.predictedRequestAmount(transporter, request);
			// Target is requesting input
			if (amount > 0) {
				if (isResource(request.target) || isTombstone(request.target) || isRuin(request.target)) {
					log.warning(`Improper logistics request: should not request input for resource or tombstone or ruin!`);
					return;
				} else if (request.resourceType == 'all') {
					log.error(`${this.print}: cannot request 'all' as input!`);
					return;
				} else {
					task = Tasks.transfer(request.target, request.resourceType);
				}
				if (bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to get more stuff
					const buffer = deref(bestChoice.targetRef) as BufferTarget;
					const withdrawAmount = Math.min(buffer.store[request.resourceType] || 0,
												  transporter.carryCapacity - _.sum(_.values(transporter.carry)), amount);
					task = task.fork(Tasks.withdraw(buffer, request.resourceType, withdrawAmount));
					if (transporter.hasMineralsInCarry && request.resourceType == RESOURCE_ENERGY) {
						task = task.fork(Tasks.transferAll(buffer));
					}
				}
			}
			// Target is requesting output
			else if (amount < 0) {
				if (isResource(request.target)) {
					task = Tasks.pickup(request.target);
				} else {
					if (request.resourceType == 'all') {
						if (!hasGeneralPurposeStore(request.target)) {
							log.error(`TransportOverlord: ` + ALL_RESOURCE_TYPE_ERROR);
							return;
						}
						task = Tasks.withdrawAll(request.target);
					} else {
						if(isCreep(request.target) || isPowerCreep(request.target)) {
							log.warning(`Improper logistics request: should not request output for creeps or power creeps!`);
							return;
						}
						task = Tasks.withdraw(request.target, request.resourceType);
					}
				}
				if (task && bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to deposit stuff
					const buffer = deref(bestChoice.targetRef) as BufferTarget;
					task = task.fork(Tasks.transferAll(buffer));
				}
			} else {
				// console.log(`${transporter.name} chooses a store with 0 amount!`);
				transporter.park();
			}
			// Assign the task to the transporter
			transporter.task = task;
			this.colony.logisticsNetwork.invalidateCache(transporter, request);
		} else {
			// If nothing to do, put everything in a store structure
			if (transporter.carry.getUsedCapacity() > 0) {
				if (transporter.hasMineralsInCarry) {
					const target = this.colony.terminal || this.colony.storage;
					if (target) {
						transporter.task = Tasks.transferAll(target);
					}
				} else {
					const dropoffPoints: (StructureLink | StructureStorage)[] = _.compact([this.colony.storage!]);
					// , ...this.colony.dropoffLinks]);

					// let bestDropoffPoint = minBy(dropoffPoints, function(dropoff: StructureLink | StructureStorage) {
					// 	let range = transporter.pos.getMultiRoomRangeTo(dropoff.pos);
					// 	if (dropoff instanceof StructureLink) {
					// 		return Math.max(range, this.colony.linkNetwork.getDropoffAvailability(dropoff));
					// 	} else {
					// 		return range;
					// 	}
					// });

					const bestDropoffPoint = transporter.pos.findClosestByMultiRoomRange(dropoffPoints);

					if (bestDropoffPoint) transporter.task = Tasks.transfer(bestDropoffPoint);
					else transporter.creep.say('放哪啊', true);
				}
			} else {
				let parkingSpot = transporter.pos;
				if (this.colony.storage) {
					parkingSpot = this.colony.storage.pos;
				} else if (this.colony.roomPlanner.storagePos) {
					parkingSpot = this.colony.roomPlanner.storagePos;
				}
				transporter.park(parkingSpot);
			}
		}
		// console.log(JSON.stringify(transporter.memory.task));
	}

	private handleBigTransporter(bigTransporter: Zerg) {
		const bestRequestViaStableMatching = this.colony.logisticsNetwork.matching[bigTransporter.name];
		this.handleTransporter(bigTransporter, bestRequestViaStableMatching);
	}

	/* Handles small transporters, which don't do well with the logisticsNetwork's stable matching system */
	private handleSmolTransporter(smolTransporter: Zerg) {
		// Just perform a single-sided greedy selection of all requests
		const bestRequestViaGreedy = _.first(this.colony.logisticsNetwork.transporterPreferences(smolTransporter));
		this.handleTransporter(smolTransporter, bestRequestViaGreedy);
	}

	private pickupDroppedResources(transporter: Zerg): Boolean {
		const droppedResource = transporter.pos.lookFor(LOOK_RESOURCES)[0];
		if (droppedResource) {
			transporter.pickup(droppedResource);
			return true;
		}
		const tombstone = transporter.pos.lookFor(LOOK_TOMBSTONES)[0];
		if (tombstone) {
			const resourceType = _.last(_.sortBy(_.keys(tombstone.store),
											   resourceType => (tombstone.store[<ResourceConstant>resourceType] || 0)));
			transporter.withdraw(tombstone, <ResourceConstant>resourceType);
			return true;
		}
		const ruin = transporter.pos.lookFor(LOOK_RUINS).filter(ruin => _.sum(_.values(ruin.store)) > 0)[0];
		if (ruin) {
			const resourceType = _.last(_.sortBy(_.keys(ruin.store),
											   resourceType => (ruin.store[<ResourceConstant>resourceType] || 0)));
			transporter.withdraw(ruin, <ResourceConstant>resourceType);
			return true;
		}
		return false;
	}

	run() {
		this.autoRun(this.transporters, transporter => this.handleSmolTransporter(transporter));
	}
}
