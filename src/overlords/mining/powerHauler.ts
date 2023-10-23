import { DirectiveHaul } from 'directives/resource/haul';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectivePowerMine} from '../../directives/resource/powerMine';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

/**
 * Spawns special-purpose haulers for transporting resources to/from a specified target
 */
@profile
export class PowerHaulingOverlord extends Overlord {

	haulers: Zerg[];
	directive: DirectivePowerMine;
	tickToSpawnOn: number;
	numHaulers: number;

	// TODO bug where haulers can come from tiny rooms not ready yet
	requiredRCL = 6;
	// Allow time for body to spawn
	prespawnAmount = 300;

	constructor(directive: DirectivePowerMine, priority = OverlordPriority.collectionUrgent.haul) {
		super(directive, 'powerHaul', priority);
		this.directive = directive;
		this.haulers = this.zerg(Roles.transport);
		// Spawn haulers to collect ALL the power at the same time.
		const haulingPartsNeeded = this.directive.totalResources / CARRY_CAPACITY;
		// Calculate amount of hauling each hauler provides in a lifetime
		const haulerCarryParts = Setups.transporters.default.getBodyPotential(CARRY, this.colony);
		// Calculate number of haulers
		this.numHaulers = Math.ceil(haulingPartsNeeded / haulerCarryParts);
		// setup time to request the haulers
		const route = Game.map.findRoute(this.directive.pos.roomName, this.colony.room.name);
		const distance = route == -2 ? 50 : route.length * 50;
		this.tickToSpawnOn = Game.time + (this.directive.calculateRemainingLifespan() || 0) - distance - this.prespawnAmount;
	}

	init() {
	}

	private handleHauler(hauler: Zerg) {
		if (hauler.carry.getUsedCapacity() == 0) {
			if (this.directive.memory.state >= 4) {
				// FIXME: Maybe ditch this and put it as a separate on-finishing method to reassign
				// hauler.say('💀 RIP 💀', true);
				// log.warning(`${hauler.name} is committing suicide as directive is done!`);
				this.numHaulers = 0;
				// 找装得最多的，帮他运一半
				const target = _.max(this.haulers, h => 
					h.carry.getUsedCapacity()
				);
				if (hauler.pos.inRangeToPos(target.pos, 1)) {
					const amount = Math.ceil(target.carry.getUsedCapacity(RESOURCE_POWER)/2);
					target.transfer(hauler, RESOURCE_POWER, amount);
					this.directive.memory.totalCollected -= amount;
				} else {
					hauler.goTo(target, {range: 1});
				}
				return;
			}
			// Travel to directive and collect resources
			if (hauler.inSameRoomAs(this.directive)) {
				// Pick up drops first
				if (this.directive.hasDrops) {
					const allDrops: Resource[] = _.flatten(_.values(this.directive.drops));
					const drop = allDrops[0];
					if (drop) {
						hauler.task = Tasks.pickup(drop);
						return;
					}
				} else if (this.directive.powerBank) {
					if (hauler.pos.getRangeTo(this.directive.powerBank) > 4) {
						hauler.goTo(this.directive.powerBank);
					} else {
						hauler.say('🚬');
					}
					return;
				} else if (this.room && this.room.ruins) {
					const pb = this.room.ruins.find(ruin => !!ruin.store[RESOURCE_POWER] && ruin.store[RESOURCE_POWER]! > 0);
					if (pb) {
						hauler.task = Tasks.withdraw(pb, RESOURCE_POWER);
					}
				} else if (this.room && this.room.drops) {
					const allDrops: Resource[] = _.flatten(_.values(this.room.drops));
					const drop = allDrops[0];
					if (drop) {
						hauler.task = Tasks.pickup(drop);
						return;
					} else {
						hauler.say('💀 RIP 💀', true);
						log.warning(`${hauler.name} is committing suicide!`);
						hauler.retire();
						return;
					}
				}
				// Shouldn't reach here
				log.warning(`${hauler.name} in ${hauler.room.print}: nothing to collect!`);
			} else {
				hauler.goTo(this.directive);
			}
		} else {
			// Travel to colony room and deposit resources
			if (hauler.inSameRoomAs(this.colony)) {
				for (const r in hauler.carry) {
					const resourceType = <ResourceConstant>r;
					const amount = hauler.carry[resourceType];
					if (amount == 0) continue;
					// prefer to put everything in storage
					if (this.colony.storage && this.colony.storage.store.getUsedCapacity() < STORAGE_CAPACITY) {
						hauler.task = Tasks.transfer(this.colony.storage, resourceType);
						return;
					} else if (this.colony.terminal && this.colony.terminal.store.getUsedCapacity() < TERMINAL_CAPACITY) {
						hauler.task = Tasks.transfer(this.colony.terminal, resourceType);
						return;
					}
				}
				// Shouldn't reach here
				log.warning(`${hauler.name} in ${hauler.room.print}: nowhere to put resources!`);
			} else {
				this.directive.memory.totalCollected += hauler.carry[RESOURCE_POWER];
				hauler.task = Tasks.goToRoom(this.colony.room.name);
			}
		}
	}

	checkIfStillCarryingPower() {
		return _.find(this.haulers, hauler => hauler.carry.power != undefined && hauler.carry.power > 0);
	}

	run() {
		if (Game.time >= this.tickToSpawnOn && this.directive.memory.state < 4) {
			this.wishlist(this.numHaulers, Setups.transporters.default);
		}
		for (const hauler of this.haulers) {
			if (hauler.isIdle) {
				this.handleHauler(hauler);
			}
			// 临死时原地呼救
			if (hauler.ticksToLive !== undefined && hauler.ticksToLive <= 1) {
				DirectiveHaul.createIfNotPresent(hauler.pos, "pos");
			} else {
				hauler.run();
			}
		}
	}
}
