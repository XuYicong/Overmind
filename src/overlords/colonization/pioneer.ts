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
			this.wishlist(4, Setups.pioneer, {reassignIdle:true});
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
		if (pioneer.flee(pioneer.room.dangerousPlayerHostiles, {dropEnergy: false}, {fleeRange: 5})) {
			return;
		}
		// Build and recharge
		if (pioneer.carry.energy == 0) {
			pioneer.task = Tasks.recharge();
		} else if (pioneer.room == this.room && !pioneer.pos.isEdge) {
			// Remove any blocking structures preventing claimer from reaching controller
			if (!this.room.my && this.room.structures.length > 0) {
				const dismantleTarget = this.findStructureBlockingController(pioneer);
				if (dismantleTarget) {
					pioneer.task = Tasks.dismantle(dismantleTarget);
					return;
				}
			}
			// const dismantlePotential = _.sum(this.room!.hostiles, h => CombatIntel.getDismantlePotential(h));
			if (!this.room || !this.room.controller) {
				log.warning('not this room or not this room controller');
				return;
			}
			const danger = this.room.playerHostiles.length > 0 || this.room.creeps.length > 6;
			const shouldUpgrade = this.room.controller.ticksToDowngrade < 9000 || 
				this.room.controller.progress >= this.room.controller.progressTotal ||
				(danger && this.room.controller.maxTicksToDowngrade - this.room.controller.ticksToDowngrade > 1000);
			const canUpgrade = !(this.room.controller.upgradeBlocked > 0);
			const canBuild = this.spawnSite && !danger;

			if (canUpgrade && shouldUpgrade) {
				// Save controller if it's about to downgrade 
				pioneer.task = Tasks.upgrade(this.room.controller);
			} else if (canBuild) {
				pioneer.task = Tasks.build(this.spawnSite!);
			} else if (this.room.barriers.length > 0) {
				pioneer.task = Tasks.fortify(_.min(this.room.barriers, b => b.hits));
			} else if (canUpgrade) {
				// or if you have nothing else to do
				pioneer.task = Tasks.upgrade(this.room.controller);
			} else {
				// cases are: upgrade blocked and (danger or !spawnSite) and no barriers
				const rampartSite = this.room.constructionSites.find(s => s.structureType == STRUCTURE_RAMPART);
				if (rampartSite) {
					pioneer.task = Tasks.build(rampartSite);
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

