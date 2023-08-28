import { DirectiveColonize } from 'directives/colony/colonize';
import {$} from '../../caching/GlobalCache';
import {Roles, Setups} from '../../creepSetups/setups';
import {Directive} from '../../directives/Directive';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';
import { Overseer } from 'Overseer';
import { MoveOptions } from 'movement/Movement';

/**
 * Claim an unowned room
 */
@profile
export class ClaimingOverlord extends Overlord {

	claimers: Zerg[];
	directive: Directive;
	canSpawn: () => boolean;

	constructor(directive: Directive, priority = OverlordPriority.colonization.claim, canSpawn: ()=>boolean = ()=>true) {
		super(directive, 'claim', priority);
		this.directive = directive;
		this.claimers = this.zerg(Roles.claim);
		this.canSpawn = canSpawn;
	}

	init() {
		const amount = $.number(this, 'claimerAmount', () => {
			if(!this.canSpawn()) return 0;
			if (this.room) { // if you have vision
				if (this.room.my) { // already claimed
					return 0;
				} else { // don't ask for claimers if you can't reach controller
					const pathablePos = this.room.creeps[0] ? this.room.creeps[0].pos
															: Pathing.findPathablePosition(this.room.name);
					if (!Pathing.isReachable(pathablePos, this.room.controller!.pos,
											 _.filter(this.room.structures, s => !s.isWalkable))) {
						return 0;
					}
				}
			}
			return 1; // otherwise ask for 1 claimer
		});
		this.wishlist(amount, Setups.infestors.claim);
	}

	private handleClaimer(claimer: Zerg): void {
		if (claimer.room == this.room && !claimer.pos.isEdge) {
			// if (!this.room.controller!.signedByMe) {
			// 	// Takes care of an edge case where planned newbie zone signs prevents signing until room is reserved
			// 	if (!this.room.my && this.room.controller!.signedByScreeps) {
			// 		claimer.task = Tasks.claim(this.room.controller!);
			// 	} else {
			// 		claimer.task = Tasks.signController(this.room.controller!);
			// 	}
			// } else {
				claimer.task = Tasks.claim(this.room.controller!);
			// }
		} else {
			let option: MoveOptions = {ensurePath: true, avoidSK: true,};
			if (this.pos.roomName[1] != claimer.pos.roomName[1]) {
				option.waypoints = this.directive.waypoints;
			}
			claimer.goTo(this.pos, option);
		}
	}

	run() {
		this.autoRun(this.claimers, claimer => this.handleClaimer(claimer));
	}
}
