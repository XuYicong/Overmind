import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type buildTargetType = ConstructionSite;
export const helpTaskName = 'help';

@profile
export class TaskHelp extends Task {
	public get target(): buildTargetType {
		return <buildTargetType>super.target;
	}

	constructor(target: buildTargetType, options = {} as TaskOptions) {
		super(helpTaskName, target, options);
		// Settings
		this.settings.targetRange = 3;
		this.settings.workOffRoad = true;
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
	}

	isValidTarget() {
		return this.target && !this.target.my && this.target.progress < this.target.progressTotal;
	}

	work() {
		// Fixes issue #9 - workers freeze if creep sitting on square
		if (!this.target.isWalkable) {
			const creepOnTarget = this.target.pos.lookFor(LOOK_CREEPS)[0];
			if (creepOnTarget) {
				const zerg = Overmind.zerg[creepOnTarget.name];
				if (zerg) {
					this.creep.say('move pls');
					zerg.moveOffCurrentPos();
				}
			}
		}
		return this.creep.build(this.target);
	}
}
