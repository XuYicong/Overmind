/* Withdraw a resource from a target */

import {hasStore, hasGeneralPurposeStore} from '../../declarations/typeGuards';
import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type withdrawTargetType = AnyStoreStructure
| Tombstone | Ruin;

export const withdrawTaskName = 'withdraw';

@profile
export class TaskWithdraw extends Task {

	public get target(): withdrawTargetType {
		return <withdrawTargetType>super.target;
	}
	data: {
		resourceType: ResourceConstant,
		amount: number | undefined,
	};

	constructor(target: withdrawTargetType,
				resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number, options = {} as TaskOptions) {
		super(withdrawTaskName, target, options);
		// Settings
		this.settings.oneShot = true;
		this.data.resourceType = resourceType;
		this.data.amount = amount;
	}

	isValidTask() {
		const amount = this.data.amount || 1;
		return (this.creep.carry.getFreeCapacity() >= amount);
	}

	isValidTarget() {
		const amount = this.data.amount || 1;
		const target = this.target;
		if (hasGeneralPurposeStore(target)) {
			return target.store[this.data.resourceType] >= amount;
		} else if (hasStore(target) && this.data.resourceType == RESOURCE_ENERGY) {
			return target.store[RESOURCE_ENERGY] >= amount;
		} else { 
			if (target instanceof StructureLab) {
				return this.data.resourceType == target.mineralType && target.mineralAmount >= amount;
			} else if (target instanceof StructurePowerSpawn) {
				return this.data.resourceType == RESOURCE_POWER && target.power >= amount;
			}
		}
		return false;
	}

	work() {
		return this.creep.withdraw(this.target, this.data.resourceType, this.data.amount);
	}

}

