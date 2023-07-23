/* Withdraw a resource from a target */

import {StoreStructure} from '../../declarations/typeGuards';
import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type withdrawAllTargetType = StoreStructure | Tombstone | Ruin;

export const withdrawAllTaskName = 'withdrawAll';

@profile
export class TaskWithdrawAll extends Task {

	public get target(): withdrawAllTargetType {
		return <withdrawAllTargetType>super.target;
	}

	constructor(target: withdrawAllTargetType, options = {} as TaskOptions) {
		super(withdrawAllTaskName, target, options);
	}

	isValidTask() {
		return (_.sum(_.values(this.creep.carry)) < this.creep.carryCapacity);
	}

	isValidTarget() {
		return _.sum(_.values(this.target.store)) > 0;
	}

	work() {
		for (const resourceType in this.target.store) {
			const amountInStore = this.target.store[<ResourceConstant>resourceType] || 0;
			if (amountInStore > 0) {
				return this.creep.withdraw(this.target, <ResourceConstant>resourceType);
			}
		}
		return -1;
	}

}

