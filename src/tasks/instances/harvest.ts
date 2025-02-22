import {isSource} from '../../declarations/typeGuards';
import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type harvestTargetType = Source | Mineral;
export const harvestTaskName = 'harvest';

@profile
export class TaskHarvest extends Task {
	public get target(): harvestTargetType {
		return <harvestTargetType>super.target;
	}

	constructor(target: harvestTargetType, options = {} as TaskOptions) {
		super(harvestTaskName, target, options);
	}

	isValidTask() {
		return _.sum(_.values(this.creep.carry)) < this.creep.carryCapacity;
	}

	isValidTarget() {
		if (isSource(this.target)) {
			return this.target.energy > 0;
		} else {
			return this.target.mineralAmount > 0;
		}
	}

	work() {
		return this.creep.harvest(this.target);
	}
}

