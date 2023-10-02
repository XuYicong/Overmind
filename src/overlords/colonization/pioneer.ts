import { MoveOptions } from 'movement/Movement';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveColonize} from '../../directives/colony/colonize';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';
import { CombatIntel } from 'intel/CombatIntel';

/**
 * Spawn pioneers - early workers which help to build a spawn in a new colony, then get converted to workers or drones
 */
@profile
export class PioneerOverlord extends Overlord {

	directive: DirectiveColonize;
	pioneers: Zerg[];
	spawnSite: ConstructionSite | undefined;

	constructor(directive: DirectiveColonize, priority = OverlordPriority.colonization.pioneer) {
		super(directive, 'pioneer', priority);
		this.directive = directive;
		this.pioneers = this.zerg(Roles.pioneer);
		this.spawnSite = this.room ? _.filter(this.room.constructionSites,
											  s => s.structureType == STRUCTURE_SPAWN)[0] : undefined;
	}

	refresh() {
		super.refresh();
		this.spawnSite = this.room ? _.filter(this.room.constructionSites,
											  s => s.structureType == STRUCTURE_SPAWN)[0] : undefined;
	}

	init() {
		if(this.directive.waypoints && this.directive.waypoints.length > 4) {
			// We are crossing shards to reach the room. Reduce shards CPU use by sending less
			this.wishlist(1, Setups.pioneer);
		} else {
			this.wishlist(4, Setups.pioneer);
		}
	}

	private findStructureBlockingController(pioneer: Zerg): Structure | undefined {
		const blockingPos = Pathing.findBlockingPos(pioneer.pos, pioneer.room.controller!.pos,
													_.filter(pioneer.room.structures, s => !s.isWalkable));
		if (blockingPos) {
			const structure = blockingPos.lookFor(LOOK_STRUCTURES)[0];
			if (structure) {
				return structure;
			} else {
				log.error(`${this.print}: no structure at blocking pos ${blockingPos.print}! (Why?)`);
			}
		}
	}

	private handlePioneer(pioneer: Zerg): void {
		// Ensure you are in the assigned room
		if (pioneer.room == this.room && !pioneer.pos.isEdge) {
			// Remove any blocking structures preventing claimer from reaching controller
			if (!this.room.my && this.room.structures.length > 0) {
				const dismantleTarget = this.findStructureBlockingController(pioneer);
				if (dismantleTarget) {
					pioneer.task = Tasks.dismantle(dismantleTarget);
					return;
				}
			}
			// Build and recharge
			if (pioneer.carry.energy == 0) {
				pioneer.task = Tasks.recharge();
			} else {
				// const dismantlePotential = _.sum(this.room!.hostiles, h => CombatIntel.getDismantlePotential(h));
				if (this.room && this.room.controller &&
					   (this.room.controller.ticksToDowngrade < 9000 
						|| !this.spawnSite || this.room.playerHostiles.length > 0
						|| this.room.controller.progress >= this.room.controller.progressTotal) &&
					   !(this.room.controller.upgradeBlocked > 0)) {
					// Save controller if it's about to downgrade or if you have nothing else to do
					pioneer.task = Tasks.upgrade(this.room.controller);
				} else if (this.spawnSite) {
					pioneer.task = Tasks.build(this.spawnSite);
				}
			}
		} else {
			// pioneer.task = Tasks.goTo(this.pos);
			let option: MoveOptions = {ensurePath: true, avoidSK: true,};
			if (this.pos.roomName[1] != pioneer.pos.roomName[1]) {
				option.waypoints = this.directive.waypoints;
			}
			pioneer.goTo(this.pos, option);
		}
	}

	run() {
		this.autoRun(this.pioneers, pioneer => this.handlePioneer(pioneer));
	}
}

