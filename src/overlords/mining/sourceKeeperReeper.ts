import {debug, log} from '../../console/log';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveSKOutpost} from '../../directives/colony/outpostSK';
import {RoomIntel} from '../../intel/RoomIntel';
import {Mem} from '../../memory/Memory';
import {Movement} from '../../movement/Movement';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CombatTargeting} from '../../targeting/CombatTargeting';
import {minBy} from '../../utilities/utils';
import {Visualizer} from '../../visuals/Visualizer';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';
import {OverlordMemory} from '../Overlord';

interface SourceReaperOverlordMemory extends OverlordMemory {
	targetLairID?: string;
}

/**
 * SourceReaperOverlord -- spawns offensive creeps to allow source keeper mining
 */
@profile
export class SourceReaperOverlord extends CombatOverlord {

	static requiredRCL = 5;

	directive: DirectiveSKOutpost;
	memory: SourceReaperOverlordMemory;
	targetLair: StructureKeeperLair | undefined;

	reapers: CombatZerg[];
	defenders: CombatZerg[];

	constructor(directive: DirectiveSKOutpost, priority = OverlordPriority.remoteSKRoom.sourceReaper) {
		super(directive, 'sourceReaper', priority, SourceReaperOverlord.requiredRCL);
		this.directive = directive;
		this.priority += this.outpostIndex * OverlordPriority.remoteSKRoom.roomIncrement;
		this.reapers = this.combatZerg(Roles.melee);
		this.defenders = this.combatZerg(Roles.ranged).concat(this.combatZerg(Roles.armedHealer));
		this.memory = Mem.wrap(this.directive.memory, 'sourceReaper');
		this.computeTargetLair();
	}

	private computeTargetLair() {
		this.targetLair = this.memory.targetLairID ? <StructureKeeperLair>deref(this.memory.targetLairID) : undefined;
		if (!this.targetLair || this.targetLair.pos.findInRange(this.targetLair.room.sourceKeepers, 5).length <= 0) {
			this.targetLair = this.getNextTargetLair();
			if(this.targetLair) this.memory.targetLairID = this.targetLair.id;
		}
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, 'sourceReaper');
		this.computeTargetLair();
	}

	init() {
		const defenderAmount = this.room && (this.room.invaders.length > 0
											 || RoomIntel.isInvasionLikely(this.room)) ? 1 : 0;
		// if(this.room 
			// && this.room.sourceKeepers.length >0
			// ) {
			if(this.directive.colony.level < 7) {
				this.wishlist(2, CombatSetups.armedHealer.default);
			} else {
				this.wishlist(1, CombatSetups.zerglings.sourceKeeper);
			}
		// }
		this.wishlist(defenderAmount, CombatSetups.hydralisks.sourceKeeper);
	}

	private getNextTargetLair(): StructureKeeperLair | undefined {
		if (!this.room) return;
		// If any lairs have an active keeper, target that
		const activeLairs = _.filter(this.room.keeperLairs,
			(								lair: { pos: { findInRange: (arg0: any, arg1: number) => { (): any; new(): any; length: number; }; }; room: { sourceKeepers: any; }; }) => lair.pos.findInRange(lair.room.sourceKeepers, 5).length > 0);
		let activeLair = _.find(activeLairs, (lair: { pos: { findInRange: (arg0: any, arg1: number) => { (): any; new(): any; length: number; }; }; room: { sources: any; }; }) => lair.pos.findInRange(lair.room.sources, 5).length > 0);
		if (activeLair) return activeLair;
		else
		if(activeLairs[0]) return activeLairs[0];
		// Otherwise target whatever is closest to spawning
		return minBy(this.room.keeperLairs,
					 lair => lair.ticksToSpawn || Infinity); // not sure why ticksToSpawn is number | undefined
	}

	private handleReaper(reaper: CombatZerg) {

		// Go to keeper room
		if (!this.targetLair || !this.room || reaper.room != this.room || reaper.pos.isEdge) {
			// log.debugCreep(reaper, `Going to room!`);
			reaper.healSelfIfPossible();
			reaper.goTo(this.pos, {avoidSK: false});
			return;
		}

		if (this.room.invaders.length > 0) {
			// Handle invader actions
			// log.debugCreep(reaper, `Handling invader actions!`);
			if (reaper.hits >= reaper.hitsMax * .5) {
				const result = reaper.autoMelee(this.room.invaders);
				if (result == undefined) { // didn't attack
					reaper.autoHeal();
				}
			} else {
				reaper.healSelfIfPossible();
			}
			// Kite around ranged invaders until a defender arrives
			if (this.room.invaders.length > 2 && _.filter(this.defenders, (def: { room: Room | undefined; }) => def.room == this.room).length == 0) {
				reaper.kite(_.filter(this.room.hostiles, (hostile: { getActiveBodyparts: (arg0: string) => number; }) => hostile.getActiveBodyparts(RANGED_ATTACK) > 0));
				reaper.healSelfIfPossible();
			}
			// If defender is already here or a small invasion
			else {
				const target = CombatTargeting.findTarget(reaper, this.room.invaders);
				if (target) {
					Movement.invasionMove(reaper, target);
				} else {
					log.warning(`KeeperReaper@${reaper.pos.print}: no invader target!`);
				}
			}
		} else {
			// log.debugCreep(reaper, `Standard keeperReaper actions`);
			// Standard keeperReaper actions
			const nearestHostile = reaper.pos.findClosestByRange(this.room.hostiles) as Creep;
			if (nearestHostile && reaper.pos.isNearTo(nearestHostile)) {
				reaper.attack(nearestHostile);
				reaper.move(reaper.pos.getDirectionTo(nearestHostile));
			} else {
				const keeper = this.targetLair.pos.findClosestByLimitedRange(this.room.sourceKeepers, 7);
				if (keeper) { // attack the source keeper
					// stop and heal at range 4 if needed
					const approachRange = (reaper.hits == reaper.hitsMax || reaper.pos.getRangeTo(keeper) <= 3) ? 1 : 4;
					reaper.goTo(keeper, {range: approachRange, avoidSK: false});
				} else { // travel to next lair
					reaper.goTo(this.targetLair, {range: 1, avoidSK: false});
				}
			}
			reaper.healSelfIfPossible();
		}

	}

	private handleDefender(defender: CombatZerg) {

		// Go to keeper room
		if (!this.targetLair || !this.room) {
			debug(defender, `Going to room!`);
			defender.healSelfIfPossible();
			defender.goToRoom(this.pos.roomName);
			return;
		}

		if (this.room.invaders.length > 0) {
			// Handle invader actions
			debug(defender, `AutoCombat`);
			defender.autoSkirmish(this.room.name);

		} else {
			debug(defender, `Standard duty`);
			const minKeepersToHelp = this.reapers.length == 0 ? 1 : 2;
			if (this.room.sourceKeepers.length >= minKeepersToHelp) {
				// Help out with keeper reaping
				defender.autoRanged();
				defender.autoHeal(false);

				const reaper = defender.pos.findClosestByRange(this.reapers);
				if (reaper) {
					defender.goTo(reaper, {
						movingTarget: defender.pos.getRangeTo(reaper) > 8,
						maxRooms    : 1,
						repath      : 0.1,
						avoidSK: false
					});
				} else {
					const keeper = this.targetLair.pos.findClosestByLimitedRange(this.room.sourceKeepers, 7);
					if (keeper) { // attack the source keeper
						const partner = defender.findPartner(_.filter(this.defenders, (other) => other.name != defender.name));
						const range = defender.pos.getRangeTo(keeper);
						const partnerRange = partner ? partner.pos.getRangeTo(keeper) : range;
						const hits = partner ? defender.hits + partner.hits : defender.hits;
						const hitsMax = partner ? defender.hitsMax + partner.hitsMax : defender.hitsMax;
						const lowHealth = hits < hitsMax * .9;
						const minRange = lowHealth ? 4 : partner ? 2 : 3;
						const maxRange = lowHealth ? 4 : 3;
						if (Math.min(range, partnerRange) < minRange) {
							defender.kite(this.room.hostiles, {range: minRange});
						} else if (Math.max(range, partnerRange) > maxRange) {
							if(partner) {
								if(defender.ticksToLive && partner.ticksToLive && defender.ticksToLive < partner.ticksToLive){
									Movement.pairwiseMove(defender, partner, keeper, {avoidSK: false});
								}
							} else {
								defender.goTo(keeper, {maxRooms: 1, range: maxRange, avoidSK: false});
							}
						}
					} else { // travel to next lair
						defender.goTo(this.targetLair, {range: 5, avoidSK: false});
					}
				}
			} else {
				// Do medic actions
				debug(defender, `Medic actions`);
				defender.doMedicActions(this.room.name);
			}
		}

	}

	run() {
		this.autoRun(this.reapers, reaper => this.handleReaper(reaper));
		this.autoRun(this.defenders, defender => this.handleDefender(defender));
	}

	visuals() {
		if (this.room && this.targetLair) {
			Visualizer.marker(this.targetLair.pos);
		}
	}

}
