import {SpawnGroup} from 'logistics/SpawnGroup';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveControllerAttack} from '../../directives/offense/controllerAttack';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {Overlord, hasColony} from '../Overlord';

/**
 * Controller attacker overlord.  Spawn CLAIM creeps to mass up on a controller and attack all at once
 * This module was contributed by @sarrick and has since been modified
 */
@profile
export class ControllerAttackerOverlord extends Overlord {

	controllerAttackers: Zerg[];
	attackPositions: RoomPosition[];
	assignments: { [attackerName: string]: RoomPosition };
	readyTick: number;

	constructor(directive: DirectiveControllerAttack, priority = OverlordPriority.offense.controllerAttack) {
		super(directive, 'controllerAttack', priority);
		this.controllerAttackers = this.zerg(Roles.claim);
		this.spawnGroup = new SpawnGroup(this, {requiredRCL: 4});
		this.refresh();
	}

	refresh() {
		super.refresh();
		if (this.room && this.room.controller) {
			this.attackPositions = this.room.controller.pos.availableNeighbors(true);
			this.readyTick = Game.time + (this.room.controller.upgradeBlocked || 0);
		} else {
			this.attackPositions = [];
			this.readyTick = Game.time;
		}
		this.assignments = this.getPositionAssignments();
	}

	private getPositionAssignments(): { [attackerName: string]: RoomPosition } {
		const assignments: { [attackerName: string]: RoomPosition } = {};
		const maxLoops = Math.min(this.attackPositions.length, this.controllerAttackers.length);
		const controllerAttackers = _.sortBy(this.controllerAttackers, (zerg: { name: any; }) => zerg.name);
		for (let i = 0; i < maxLoops; i++) {
			assignments[controllerAttackers[i].name] = this.attackPositions[i];
		}
		return assignments;
	}

	init() {
		// Prespawn attackers to arrive as cooldown disappears
		if (this.attackPositions.length > 0 && Game.time >= this.readyTick - CREEP_CLAIM_LIFE_TIME) {
			this.wishlist(this.attackPositions.length, Setups.infestors.controllerAttacker, {noLifetimeFilter: true});
		}
	}

	run() {
		for (const controllerAttacker of this.controllerAttackers) {
			const attackPos = this.assignments[controllerAttacker.name];
			if (attackPos) {
				controllerAttacker.goTo(attackPos, {ensurePath: true, waypoints: hasColony(this.initializer) ? this.initializer.waypoints : []});
			} else {
				log.debug(`No attack position for ${controllerAttacker.print}!`);
			}
		}
		if (this.room && this.room.controller && !this.room.controller.upgradeBlocked) {
			if (!_.find(this.controllerAttackers, (creep: { pos: { isEqualTo: (arg0: RoomPosition) => any; }; name: string | number; }) => !creep.pos.isEqualTo(this.assignments[creep.name]))
				|| _.find(this.controllerAttackers, (creep: { pos: { isNearTo: (arg0: StructureController) => any; }; ticksToLive: any; }) => creep.pos.isNearTo(this.room!.controller!)
															&& (creep.ticksToLive || 10) <= 2)) {
				this.launchAttack();
			}
		}
	}

	private launchAttack(): void {
		let signed = false;
		if (this.room && this.room.controller) {
			for (const attacker of this.controllerAttackers) {
				attacker.attackController(this.room.controller);
				if (!signed) {
					signed = (attacker.signController(this.room.controller, '到此一游') == OK);
				}
			}
		}
	}

}
