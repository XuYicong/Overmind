import { DirectiveInvasionDefense } from 'directives/defense/invasionDefense';
import {Roles, Setups} from '../../creepSetups/setups';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

/**
 * Sends out a stationary scout to a monitor room. Whenever a hostile appears, warm up colony defense
 */
@profile
export class CombatWarmupOverlord extends Overlord {

	scouts: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.scouting.stationary) {
		super(directive, 'warmup', priority);
		this.scouts = this.zerg(Roles.scout, {notifyWhenAttacked: false});
	}

	init() {
		this.wishlist(1, Setups.scout);
	}

	run() {
		for (const scout of this.scouts) {
			if (!(scout.pos.inRangeTo(this.pos, 3) && !scout.pos.isEdge)) {
				scout.goTo(this.pos, {range: 3});
			} else if (Game.time % 5 == 0 && scout.pos.room) {
				if (scout.pos.room.dangerousPlayerHostiles.length > 0) {
					DirectiveInvasionDefense.createIfNotPresent(this.colony.controller.pos, 'room');
				}
			}
		}
	}
}
