import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type signControllerTargetType = StructureController;
export const signControllerTaskName = 'signController';
const outpostSignature = "remote mining";
@profile
export class TaskSignController extends Task {

	public get target(): signControllerTargetType {
		return <signControllerTargetType>super.target;
	}

	constructor(target: signControllerTargetType, options = {} as TaskOptions) {
		super(signControllerTaskName, target, options);
	}

	isValidTask() {
		return true;
	}

	isValidTarget() {
		const controller = this.target;
		const validSign = controller.signedByScreeps || 
		(
			controller.sign && (
				controller.sign.text == Memory.settings.signature || controller.sign.text == outpostSignature
			)
		);
		return !validSign;
	}

	work() {
		const signature = this.target.room.owner ? Memory.settings.signature : outpostSignature;
		return this.creep.signController(this.target, signature);
	}
}

