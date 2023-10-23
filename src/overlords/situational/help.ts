import { Directive } from 'directives/Directive';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {hasGeneralPurposeStore} from '../../declarations/typeGuards';
import {DirectiveHaul} from '../../directives/resource/haul';
import {Energetics} from '../../logistics/Energetics';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';
import { CombatIntel } from 'intel/CombatIntel';
import { BuildPriorities } from 'priorities/priorities_structures';

/**
 * 出worker，修指定房间内的所有hostile construction site
 */
@profile
export class HelpOverlord extends Overlord {

	helpers: Zerg[];
	directive: Directive;
	// waypointsTo?: RoomPosition[];
	// waypointsBack?: RoomPosition[];
	requiredRCL: 4;

	constructor(directive: Directive, priority = OverlordPriority.tasks.haul) {
		super(directive, 'help', priority);
		this.directive = directive;
		// if(this.directive.waypoints) {
			// Supposing that the two routes are of same length
			// const mid = this.directive.waypoints.length /2;
			// this.waypointsTo = this.directive.waypoints.slice(0, mid);
			// this.waypointsBack = this.directive.waypoints.slice(mid);
		// }
		this.helpers = this.zerg(Roles.worker);
	}

	init() {
		if (!this.directive.room || 
			this.directive.room.hostileConstructionSites.some(s=>s.structureType == STRUCTURE_SPAWN)) {
			this.wishlist(2, Setups.workers.early, {reassignIdle: true});
		}
	}

	private handleHelper(helper: Zerg) {
		const fallback = CombatIntel.getFallbackFrom(this.directive.pos);
		if (helper.carry.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
			// 收集能量
			if (helper.room.drops[RESOURCE_ENERGY]?.length > 0) {
				helper.task = Tasks.pickup(helper.room.drops[RESOURCE_ENERGY][0]);
			} else if (fallback.room) {
				if (fallback.room.tombstones.some(s => s.store[RESOURCE_ENERGY] > 0)) {
					helper.task = Tasks.withdraw(fallback.room.tombstones.find(s => s.store[RESOURCE_ENERGY] > 0)!, RESOURCE_ENERGY)
				} else {
					helper.task = Tasks.harvest(_.max(fallback.room.sources, s => s.energy));
				}
			} else {
				helper.task = Tasks.goToRoom(fallback.roomName);
			}
		} else {
			if (this.directive.room) {
				for (const buildType of BuildPriorities) {
					const target = this.directive.room.hostileConstructionSites.find(s=> s.structureType == buildType);
					if (target) {
						helper.task = Tasks.help(target);
						break;
					}
				} 
				if (helper.isIdle){
					helper.say('援建完成', true);
				}
			} else {
				helper.task = Tasks.goToRoom(this.directive.pos.roomName);
			}
		}
	}

	run() {
		for (const helper of this.helpers) {
			if (helper.isIdle) {
				this.handleHelper(helper);
			}
			helper.run();
		}
	}
}
