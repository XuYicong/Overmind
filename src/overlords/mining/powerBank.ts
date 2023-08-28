import { DirectivePowerBank } from 'directives/resource/powerBank';
import {CombatSetups, Roles, Setups} from '../../creepSetups/setups';
import {DirectivePairDestroy} from '../../directives/offense/pairDestroy';
import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
import {CombatIntel} from '../../intel/CombatIntel';
import {RoomIntel} from '../../intel/RoomIntel';
import {Movement} from '../../movement/Movement';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {boostResources} from '../../resources/map_resources';
import {CombatTargeting} from '../../targeting/CombatTargeting';
import {CombatZerg} from '../../zerg/CombatZerg';
import {Overlord} from '../Overlord';
import { Zerg } from 'zerg/Zerg';
import { Pathing } from 'movement/Pathing';
import { Energetics } from 'logistics/Energetics';

/**
 *  Power bank mining overlord - spawns attacker/healer pairs and transporters to mine power bank
 */
@profile
export class PowerBankOverlord extends Overlord {

	directive: DirectivePowerBank;
	attackers: CombatZerg[];
	healers: CombatZerg[];
	haulers: Zerg[];

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectivePowerBank, priority = OverlordPriority.offense.destroy) {
		super(directive, 'destroy', priority);
		this.directive = directive;
		this.attackers = this.combatZerg(Roles.melee, {
			notifyWhenAttacked: false,
			boostWishlist     : [boostResources.attack[3], boostResources.tough[3], boostResources.move[3]]
		});
		this.healers = this.combatZerg(Roles.healer, {
			notifyWhenAttacked: false,
			boostWishlist     : [boostResources.heal[3], boostResources.tough[3], boostResources.move[3],]
		});
	}

	private findTarget(attacker: CombatZerg): Creep | Structure | undefined {
		if (this.room) {
			// Prioritize specifically targeted structures first
			const targetingDirectives = DirectiveTargetSiege.find(this.room.flags) as DirectiveTargetSiege[];
			const targetedStructures = _.compact(_.map(targetingDirectives,
				(													 directive: { getTarget: () => any; }) => directive.getTarget())) as Structure[];
			if (targetedStructures.length > 0) {
				return CombatTargeting.findClosestReachable(attacker.pos, targetedStructures);
			} else {
				// Target nearby hostile creeps
				const creepTarget = CombatTargeting.findClosestHostile(attacker, true);
				if (creepTarget) return creepTarget;
				// Target nearby hostile structures
				const structureTarget = CombatTargeting.findClosestPrioritizedStructure(attacker);
				if (structureTarget) return structureTarget;
			}
		}
	}

	private attackActions(attacker: CombatZerg, healer: CombatZerg): void {
		const target = this.findTarget(attacker);
		if (target) {
			if (attacker.pos.isNearTo(target)) {
				attacker.attack(target);
			} else {
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
				attacker.goTo(this.colony.controller, {range: 5});
			} else {
				attacker.park();
			}
		}
		// Case 2: you have an active healer
		else {
			// Activate retreat condition if necessary
			// Handle recovery if low on HP
			if (attacker.needsToRecover(PowerBankOverlord.settings.retreatHitsPercent)) {
				// Do nothing
			} else if (healer.needsToRecover(PowerBankOverlord.settings.retreatHitsPercent)) {
				// Healer leads retreat to fallback position
				Movement.pairwiseMove(healer, attacker, CombatIntel.getFallbackFrom(this.directive.pos));
			} else {
				// Move to room and then perform attacking actions
				if (!attacker.inSameRoomAs(this)) {
					Movement.pairwiseMove(attacker, healer, this.pos);
				} else {
					this.attackActions(attacker, healer);
				}
			}
		}
	}

	private handleHealer(healer: CombatZerg): void {
		// If there are no hostiles in the designated room, run medic actions
		if (this.room && this.room.hostiles.length == 0 && this.room.powerBanks.length == 0) {
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
				healer.goTo(this.colony.controller, {range: 5});
			} else {
				healer.park();
			}
		}
		// Case 2: you have an attacker partner
		else {
			if (attacker.hitsMax - attacker.hits >= healer.hitsMax - healer.hits) {
				healer.heal(attacker);
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

		const attackerPriority = this.attackers.length < this.healers.length ? this.priority - 0.1 : this.priority + 0.1;
		const attackerSetup = this.canBoostSetup(CombatSetups.zerglings.boosted_T3) ? CombatSetups.zerglings.boosted_T3
																				  : CombatSetups.zerglings.default;
		this.wishlist(amount, attackerSetup, {priority: attackerPriority});

		const healerPriority = this.healers.length < this.attackers.length ? this.priority - 0.1 : this.priority + 0.1;
		const healerSetup = this.canBoostSetup(CombatSetups.healers.boosted_T3) ? CombatSetups.healers.boosted_T3
																			  : CombatSetups.healers.default;
		this.wishlist(amount, healerSetup, {priority: healerPriority});
		// Spawn haulers
		if (!this.colony.storage || _.sum(_.values(this.colony.storage.store)) > Energetics.settings.storage.total.cap) {
			return;
		}
		// Spawn a number of haulers sufficient to move all resources within a lifetime, up to a max
		const MAX_HAULERS = 5;
		// Calculate total needed amount of hauling power as (resource amount * trip distance)
		const tripDistance = 2 * Pathing.distance((this.colony.storage || this.colony).pos, this.directive.pos);
		const haulingPowerNeeded = Math.min(1000,
			//TODO: this.directive.totalResources,
										  this.colony.storage.store.getFreeCapacity()) * tripDistance;
		// Calculate amount of hauling each hauler provides in a lifetime
		const haulerCarryParts = Setups.transporters.early.getBodyPotential(CARRY, this.colony);
		const haulingPowerPerLifetime = CREEP_LIFE_TIME * haulerCarryParts * CARRY_CAPACITY;
		// Calculate number of haulers
		const numHaulers = Math.min(Math.ceil(haulingPowerNeeded / haulingPowerPerLifetime), MAX_HAULERS);
		// Request the haulers
		if (this.haulers.length == 0) {
			this.wishlist(numHaulers, Setups.transporters.early, {priority: OverlordPriority.collectionUrgent.haul});
		} else {
			this.wishlist(numHaulers, Setups.transporters.early);
		}
	}

	run() {
		for (const attacker of this.attackers) {
			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
			if (attacker.hasValidTask) {
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
