import {hasPos} from '../../declarations/typeGuards';
import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type goToTargetType = { pos: RoomPosition } | RoomPosition;
export const goToTaskName = 'goTo';

@profile
export class TaskGoTo extends Task {

	constructor(target: goToTargetType, options = {} as TaskOptions) {
		if (hasPos(target)) {
			super(goToTaskName, {ref: '', pos: target.pos}, options);
		} else {
			super(goToTaskName, {ref: '', pos: target}, options);
		}
		// Settings
		this.settings.targetRange = 1;
	}

	isValidTask() {
		return !this.creep.pos.inRangeTo(this.targetPos, this.settings.targetRange);
	}

	isValidTarget() {
		return true;
	}

	work() {
		return OK;
	}

}
