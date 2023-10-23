import { Roles, Setups } from 'creepSetups/setups';
import {Colony} from '../../Colony';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {getOverlord, Overlord} from '../Overlord';
import { Tasks } from 'tasks/Tasks';

/**
 * The colony sleeps to save CPU. SleepOverlord spawns one sleeper to keep controller alive.
 */
@profile
export class SleepOverlord extends Overlord {

	sleeper: Zerg[];

	constructor(colony: Colony) {
		super(colony, 'sleep', OverlordPriority.default);
		this.sleeper = this.zerg(Roles.worker);;
	}

	init() {
		this.wishlist(1, Setups.workers.sleep, {noLifetimeFilter: true, reassignIdle: true})
	}

	handleSleep(sleep: Zerg) {
		if (this.colony.room.dangerousPlayerHostiles.length > 0) {
			global.unsleepColony(this.colony.room.name);

		} else if (sleep.spawning) {
			return;
		} else if (this.colony.room.dangerousHostiles.length > 0) {
			sleep.creep.suicide();

		} else if (sleep.creep.store.getUsedCapacity() > sleep.creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
			sleep.task = Tasks.transferAll(this.colony.room.storage!);

		} else if (sleep.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
			sleep.task = Tasks.upgrade(this.colony.room.controller!);

		} else if (true) {
			sleep.task = Tasks.harvest(_.max(this.colony.room.sources, s => s.energy));
		}
	}

	run() {
		for (const sleep of this.sleeper) {
			if (sleep.hasValidTask) {
				sleep.task!.run();
			} else {
				this.handleSleep(sleep);
			}
		}
	}
}
