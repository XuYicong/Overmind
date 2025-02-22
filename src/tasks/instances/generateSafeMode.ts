import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type generateSafeModeTargetType = StructureController;
export const generateSafeModeTaskName = 'generateSafeMode';

@profile
export class TaskGenerateSafeMode extends Task {
	constructor(target: generateSafeModeTargetType, options = {} as TaskOptions) {
		super(generateSafeModeTaskName, target, options);
	}

	public get target(): generateSafeModeTargetType {
		return <generateSafeModeTargetType>super.target;
	}

	isValidTask() {
		return (this.creep.carry[RESOURCE_GHODIUM] >= 1000);
	}

	isValidTarget() {
		// Allows targeting other players for allies
		return (this.target != null && !!this.target.owner);
	}

	work() {
		return this.creep.generateSafeMode(this.target);
	}
}
