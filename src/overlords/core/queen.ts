import { log } from 'console/log';
import {CreepSetup} from '../../creepSetups/CreepSetup';
import {Roles, Setups} from '../../creepSetups/setups';
import {TERMINAL_STATE_REBUILD} from '../../directives/terminalState/terminalState_rebuild';
import {Hatchery} from '../../hiveClusters/hatchery';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {DEFAULT_PRESPAWN, Overlord} from '../Overlord';
import { TransportRequest } from 'logistics/TransportRequestGroup';
import { Task } from 'tasks/Task';
import { TaskTransfer } from 'tasks/instances/transfer';

type rechargeObjectType = StructureStorage
	| StructureTerminal
	| StructureContainer
	| StructureLink
	| Tombstone
	| Resource;

/**
 * Spawns a dedicated hatchery attendant to refill spawns and extensions
 */
@profile
export class QueenOverlord extends Overlord {

	hatchery: Hatchery;
	queenSetup: CreepSetup;
	loaders: Zerg[];
	settings: any;

	constructor(hatchery: Hatchery, priority = OverlordPriority.core.queen) {
		super(hatchery, 'supply', priority);
		this.hatchery = hatchery;
		this.queenSetup = this.colony.storage ? Setups.queens.default : Setups.queens.early;
		if (this.colony.terminalState == TERMINAL_STATE_REBUILD) {
			this.queenSetup = Setups.queens.early;
		}
		this.loaders = this.zerg(Roles.loader);
		this.settings = {
			refillTowersBelow: 500,
		};
	}

	init() {
		const amount = this.colony.defcon + 1;
		const prespawn = this.hatchery.spawns.length <= 1 ? 100 : DEFAULT_PRESPAWN;
		this.wishlist(amount, this.queenSetup, {prespawn: prespawn});
	}

	private supplyActions(loader: Zerg) {
		// Chain two tasks only for now
		if(loader.task && loader.task._parent) return;
		// Select the closest supply target out of the highest priority and refill it
		const basePos = loader.task ? loader.task.targetPos : loader.pos;
		const request = this.hatchery.transportRequests.popPrioritizedClosestRequest(basePos, 'supply', 
						(req)=>req.resourceType == RESOURCE_ENERGY);
		if (request) {
			const task = Tasks.transfer(request.target);
			if(loader.task) {
				task.fork(loader.task);
				loader.task.options.nextPos = task.targetPos;
			} else {
				loader.task = task;
			}
		} else if(loader.pos.roomName != this.pos.roomName) {
			loader.task = Tasks.goToRoom(this.pos.roomName)
		} else if(loader.isIdle) {
			this.rechargeActions(loader); // if there are no targets, refill yourself
		}
	}

	private mineralActions(loader: Zerg): void {
		if (loader.hasValidTask) return;

		// Assume loader is idle here
		const commandCenter = this.colony.commandCenter;
		if (!commandCenter) return;
		const evacuate = function(resourceType: ResourceConstant): Task {
			if (commandCenter.terminal && commandCenter.terminal.store.getFreeCapacity() > 0) {
				return Tasks.transferAll(commandCenter.terminal);
			} else if (commandCenter.storage.store.getFreeCapacity() > 0) {
				return Tasks.transferAll(commandCenter.storage);
			} else {
				return Tasks.drop(loader.pos, resourceType);
			}
		}

		// Handle withdraw requests
		let request = this.hatchery.transportRequests.popPrioritizedClosestRequest(loader.pos, 'withdraw', 
							req => req.resourceType != RESOURCE_ENERGY);
		if (request) {
			// TODO: evacuate ALL
			loader.task = evacuate(request.resourceType);
			let amount = 0;
			while(request) {
				amount += request.amount;
				const task = Tasks.withdraw(request.target, request.resourceType);
				loader.task.fork(task);
				if (amount >= loader.carryCapacity) break;
				request = this.hatchery.transportRequests.popPrioritizedClosestRequest(loader.pos, 'withdraw', 
							req => req.resourceType != RESOURCE_ENERGY);
			}
		} else {
			// Handle supply tasks
			// TODO: add multiple tasks at the same time
			const store = commandCenter.terminal || commandCenter.storage;
			let supplyTask: TaskTransfer | undefined;
			for (const priority in this.hatchery.transportRequests.supply) {
				for (const request of this.hatchery.transportRequests.supply[priority]) {
					if (request.resourceType == RESOURCE_ENERGY) continue;
					// figure out how much you can withdraw
					const amount = Math.min(
						Math.min(
							request.amount, 
							store.store.getUsedCapacity(request.resourceType)
						), 
						loader.carry.getFreeCapacity(request.resourceType)
					);
					if (amount == 0) continue;
					supplyTask = Tasks.transfer(request.target, request.resourceType, amount);
				}
			}
			if (supplyTask) {
				log.info(supplyTask.data.resourceType+', '+supplyTask.data.amount);
				loader.task = supplyTask.fork(
					Tasks.withdraw(store, supplyTask.data.resourceType, supplyTask.data.amount),
				);
			}
		}

		// Put energies aside first, if got a task
		if (loader.hasValidTask && loader.carry.getUsedCapacity(RESOURCE_ENERGY) > 0) {
			loader.task!.fork(evacuate(RESOURCE_ENERGY));
			return;
		}
	}

	private generateSafeModeActions(loader: Zerg): void {
		// Assume store is empty
		if (this.colony.controller.safeModeAvailable > 3) return;
		const commandCenter = this.colony.commandCenter;
		if (!commandCenter) return;
		const terminal = commandCenter.terminal;
		if (!terminal) return;

		const GHODIUM_AMOUNT = 1000;
		if (terminal.store.getUsedCapacity(RESOURCE_GHODIUM) < GHODIUM_AMOUNT ) return;
		if (loader.carry.getFreeCapacity(RESOURCE_GHODIUM) < GHODIUM_AMOUNT) return;

		loader.task = Tasks.withdraw(terminal, RESOURCE_GHODIUM, GHODIUM_AMOUNT);
		loader.task.parent = Tasks.generateSafeMode(this.colony.controller);
	}

	private rechargeActions(loader: Zerg): void {
		if (this.hatchery.link && !this.hatchery.link.isEmpty) {
			loader.task = Tasks.withdraw(this.hatchery.link);
		} else if (this.hatchery.battery && this.hatchery.battery.energy > 0) {
			loader.task = Tasks.withdraw(this.hatchery.battery);
		} else {
			loader.task = Tasks.recharge();
		}
	}

	private idleActions(loader: Zerg): void {
		if (this.hatchery.link) {
			// Can energy be moved from the link to the battery?
			if (this.hatchery.battery && !this.hatchery.battery.isFull && !this.hatchery.link.isEmpty) {
				// Move energy to battery as needed
				if (loader.carry.energy < loader.carryCapacity) {
					loader.task = Tasks.withdraw(this.hatchery.link);
				} else {
					loader.task = Tasks.transfer(this.hatchery.battery);
				}
			} else {
				if (loader.carry.energy < loader.carryCapacity) { // make sure you're recharged
					if (!this.hatchery.link.isEmpty) {
						loader.task = Tasks.withdraw(this.hatchery.link);
					} else if (this.hatchery.battery && !this.hatchery.battery.isEmpty) {
						loader.task = Tasks.withdraw(this.hatchery.battery);
					}
				}
			}
		} else {
			if (this.hatchery.battery && loader.carry.energy < loader.carryCapacity) {
				loader.task = Tasks.withdraw(this.hatchery.battery);
			}
		}
	}

	private handleLoader(loader: Zerg): void {
		if (loader.isIdle) {
			this.mineralActions(loader);
		}
		if (loader.carry.energy > 0) {
			this.supplyActions(loader);
		} else if (loader.isIdle) {
			this.generateSafeModeActions(loader);
			if (loader.isIdle) {
				this.rechargeActions(loader);
			}
		}
		// If there aren't any tasks that need to be done, recharge the battery from link
		if (loader.isIdle) {
			this.idleActions(loader);
		}
		// // If all of the above is done and hatchery is not in emergencyMode, move to the idle point and renew as needed
		// if (!this.emergencyMode && queen.isIdle) {
		// 	if (queen.pos.isEqualTo(this.idlePos)) {
		// 		// If queen is at idle position, renew her as needed
		// 		if (queen.ticksToLive < this.settings.renewQueenAt && this.availableSpawns.length > 0) {
		// 			this.availableSpawns[0].renewCreep(queen.creep);
		// 		}
		// 	} else {
		// 		// Otherwise, travel back to idle position
		// 		queen.goTo(this.idlePos);
		// 	}
		// }
	}

	run() {
		for (const loader of this.loaders) {
			// Get a task
			this.handleLoader(loader);
			// Run the task if you have one; else move back to idle pos
			if (loader.hasValidTask) {
				loader.run();
			// } else {
			// 	if (this.queens.length > 1) {
			// 		queen.goTo(this.hatchery.idlePos, {range: 1});
			// 	} else {
			// 		queen.goTo(this.hatchery.idlePos);
			// 	}
			}
		}
	}
}
