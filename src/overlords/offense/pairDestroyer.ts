import { Directive } from 'directives/Directive';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectivePairDestroy} from '../../directives/offense/pairDestroy';
import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
import {CombatIntel} from '../../intel/CombatIntel';
import {RoomIntel} from '../../intel/RoomIntel';
import {MoveOptions, Movement} from '../../movement/Movement';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {boostResources} from '../../resources/map_resources';
import {CombatTargeting} from '../../targeting/CombatTargeting';
import {CombatZerg} from '../../zerg/CombatZerg';
import {Overlord} from '../Overlord';
import { Tasks } from 'tasks/Tasks';

/**
 *  Destroyer overlord - spawns attacker/healer pairs for combat within a hostile room
 */
@profile
export class PairDestroyerOverlord extends Overlord {

	directive: Directive;
	attackers: CombatZerg[];
	healers: CombatZerg[];

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: Directive, priority = OverlordPriority.offense.destroy) {
		super(directive, 'destroy', priority);
		this.directive = directive;
		this.attackers = this.combatZerg(Roles.melee, {
			notifyWhenAttacked: false,
			boostWishlist     : [boostResources.attack[1], boostResources.tough[1], boostResources.move[1]]
		});
		this.healers = this.combatZerg(Roles.healer, {
			notifyWhenAttacked: false,
			boostWishlist     : [boostResources.heal[1], boostResources.tough[1], boostResources.move[1]]
		});
	}

	private findTarget(attacker: CombatZerg): Creep | Structure | undefined {
		// Prioritize specifically targeted structures first
		const targetingDirectives = DirectiveTargetSiege.find(attacker.room.flags) as DirectiveTargetSiege[];
		const targetedStructures = _.compact(_.map(targetingDirectives,
							(directive: { getTarget: () => any; }) => directive.getTarget())) as Structure[];
		if (targetedStructures.length > 0) {
			return CombatTargeting.findClosestReachable(attacker.pos, targetedStructures);
		} else {
			// Target nearby hostile creeps
			const creepTarget = CombatTargeting.findClosestHostile(attacker, true);
			if (creepTarget) return creepTarget;
			// Target nearby hostile structures
			const structureTarget = CombatTargeting.findClosestPrioritizedStructure(attacker, true);
			if (structureTarget) return structureTarget;
		}
	}

	private attackActions(attacker: CombatZerg, healer: CombatZerg): void {
		// Attack nearby creeps in any condition
		// const nearHostile = attacker.pos.neighbors.flatMap(p => p.lookFor(LOOK_CREEPS)).find(c=>!c.my);
		// if (nearHostile) {
		// 	attacker.attack(nearHostile);
		// 	return;
		// }
		let target: Creep | Structure | undefined 
		// Range to closest hostile tower
		const towerRange = _.min(attacker.room.towers.map(t=>attacker.pos.getRangeTo(t)));
		// Chase Bondi if close
		if (!towerRange || towerRange > 10) {
			target= attacker.room.playerHostiles.find(
				h=> h.hitsMax > 2000 && !h.inRampart && h.pos.inRangeTo(attacker.pos, 3));
		}
		// TODO: edge dancing can cause dead loops
		if (!target) {
			target = this.findTarget(attacker);
		}
		if (target) {
			if (attacker.pos.isNearTo(target)) {
				attacker.attack(target);
			} else {
				attacker.task = Tasks.goTo(target.pos);
				Movement.pairwiseMove(attacker, healer, target);
				attacker.autoMelee();
			}
		}
	}

	private handleSquad(attacker: CombatZerg): void {
		const healer = attacker.findPartner(this.healers);
		// Case 1: you don't have an active healer
		if (!healer || healer.spawning || healer.needsBoosts) {
			// Wait near the colony controller if you don't have a healer
			if (attacker.pos.getMultiRoomRangeTo(this.colony.controller.pos) > 5) {
				// TODO: 走不回屋when too far,need testing
				attacker.goTo(this.colony.controller, {
					range: 5, useFindRoute: false 
				});
			} else {
				attacker.park();
			}
		}
		// Case 2: you have an active healer
		else {
			// Activate retreat condition if necessary
			// Handle recovery if low on HP
			if (attacker.needsToRecover(PairDestroyerOverlord.settings.retreatHitsPercent) ||
				healer.needsToRecover(PairDestroyerOverlord.settings.retreatHitsPercent)) {
				const fallbackPos = CombatIntel.getFallbackFrom(this.directive.pos);
				// Healer leads retreat to fallback position
				if (attacker.inSameRoomAs(this)) {
					Movement.pairwiseMove(healer, attacker, fallbackPos);
				} else {
					Movement.pairwiseMove(healer, attacker, this.colony.pos);
				}
			} else {
				// Move to room and then perform attacking actions
				if (!attacker.inSameRoomAs(this) && (!attacker.room.dangerousPlayerHostiles.length || attacker.room.controller?.safeMode)) {
					// if target room is occupied, attack from a certain exit
					const back = CombatIntel.getFallbackFrom(this.directive.pos);
					let option: MoveOptions = {avoidSK: true, useFindRoute: false};
					const directed = !this.pos.room || (this.pos.room.controller && 
						!this.pos.room.controller.my && this.pos.room.controller.level > 4);
					// May find optimal path not via back, due to invisibility
					if (!directed || healer.pos.inRangeTo(back, 4)) {
						option.range = 1;
						Movement.pairwiseMove(attacker, healer, this.pos, option);
					} else {
						if (Memory.rooms[this.pos.roomName])
							Memory.rooms[this.pos.roomName][_RM.AVOID] = true;
						Movement.pairwiseMove(attacker, healer, back, option);
					}
				} else {
					this.attackActions(attacker, healer);
				}
			}
		}
	}

	private handleHealer(healer: CombatZerg): void {
		// If there are no hostiles in the designated room, run medic actions
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			healer.doMedicActions(this.room.name);
			return;
		}
		const attacker = healer.findPartner(this.attackers);
		// Case 1: you don't have an attacker partner
		if (!attacker || attacker.spawning || attacker.needsBoosts) {
			if (healer.hits < healer.hitsMax) {
				healer.heal(healer);
			}
			// Wait near the colony controller if you don't have an attacker
			if (healer.pos.getMultiRoomRangeTo(this.colony.controller.pos) > 5) {
				healer.goTo(this.colony.controller, {range: 5, useFindRoute: false});
			} else {
				healer.park();
			}
		}
		// Case 2: you have an attacker partner
		else {
			if (attacker.hitsMax - attacker.hits > healer.hitsMax - healer.hits) {
				if (healer.pos.isNearTo(attacker)) healer.heal(attacker);
				else healer.rangedHeal(attacker);
			} else {
				healer.heal(healer);
			}
		}
	}

	init() {
		let amount;
		if (this.directive.memory.amount) {
			amount = this.directive.memory.amount;
		} else {
			amount = 1;
		}

		if (RoomIntel.inSafeMode(this.pos.roomName)) {
			amount = 0;
		}

		this.reassignIdleCreeps(Roles.melee);
		this.reassignIdleCreeps(Roles.healer);
		const attackerPriority = this.attackers.length < this.healers.length ? this.priority - 0.1 : this.priority + 0.1;
		const attackerSetup = this.canBoostSetup(CombatSetups.zerglings.boosted_T1) ? CombatSetups.zerglings.boosted_T1
																				  : CombatSetups.zerglings.default;
		this.wishlist(amount, attackerSetup, {priority: attackerPriority});

		const healerPriority = this.healers.length < this.attackers.length ? this.priority - 0.1 : this.priority + 0.1;
		const healerSetup = this.canBoostSetup(CombatSetups.healers.boosted_T1) ? CombatSetups.healers.boosted_T1
								: (
									this.room && this.room.controller && this.room.controller.owner!=undefined && !this.room.controller.my
								) ? CombatSetups.healers.armored : CombatSetups.healers.default;
		this.wishlist(amount, healerSetup, {priority: healerPriority});
	}

	run() {
		for (const attacker of this.attackers) {
			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
			if (attacker.hasValidTask && !attacker.room.dangerousPlayerHostiles.length && 
				attacker.hits == attacker.hitsMax) {
				attacker.run();
			} else {
				if (attacker.needsBoosts) {
					this.handleBoosting(attacker);
				} else {
					this.handleSquad(attacker);
				}
			}
		}

		for (const healer of this.healers) {
			if (healer.hasValidTask) {
				healer.run();
			} else {
				if (healer.needsBoosts) {
					this.handleBoosting(healer);
				} else {
					this.handleHealer(healer);
				}
			}
		}
	}
}
