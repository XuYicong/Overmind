import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type upgradeTargetType = StructureController;
export const upgradeTaskName = 'upgrade';


@profile
export class TaskUpgrade extends Task {

	public get target(): upgradeTargetType {
		return <upgradeTargetType>super.target;
	}
	constructor(target: upgradeTargetType, options = {} as TaskOptions) {
		super(upgradeTaskName, target, options);
		// Settings
		this.settings.targetRange = 3;
		this.settings.workOffRoad = true;
	}

	isValidTask() {
		return (this.creep.carry.energy > 0);
	}

	isValidTarget() {
		return this.target && !!this.target.my;
	}

	work() {
		if (this.target.upgradeBlocked) return ERR_BUSY;
		return this.creep.upgradeController(this.target);
	}
}

