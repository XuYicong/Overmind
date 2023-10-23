import { Zerg } from 'zerg/Zerg';
import {$} from '../../caching/GlobalCache';
import {log} from '../../console/log';
import {CombatSetups, Roles, Setups} from '../../creepSetups/setups';
import {DirectiveSwarmDestroy} from '../../directives/offense/swarmDestroy';
import {CombatIntel} from '../../intel/CombatIntel';
import {RoomIntel} from '../../intel/RoomIntel';
import {Mem} from '../../memory/Memory';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {boostResources} from '../../resources/map_resources';
import {Visualizer} from '../../visuals/Visualizer';
import {CombatZerg} from '../../zerg/CombatZerg';
import {Swarm} from '../../zerg/Swarm';
import {SwarmOverlord} from '../SwarmOverlord';
import { Overlord } from 'overlords/Overlord';
import { Directive } from 'directives/Directive';
import { Priority } from 'priorities/priorities';

const DEBUG = false;

/**
 * Spawns 一体机四人队，以两组两人队的形式组织
 */
@profile
export class QuadOverlord extends Overlord {

	memory: any;
	directive: Directive;
	intel: CombatIntel;
	zergs: CombatZerg[];

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: Directive, priority = OverlordPriority.offense.destroy) {
		super(directive, 'destroy', priority);
		this.directive = directive;
		this.memory = Mem.wrap(this.directive.memory, this.name);
		this.intel = new CombatIntel(this.directive);
		this.zergs = this.combatZerg(Roles.ranged, {
			notifyWhenAttacked: false,
			boostWishlist     : [boostResources.ranged_attack[1], boostResources.heal[1], boostResources.move[1]]
		});
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, this.name);
		// this.makeSwarms();
	}

	private swap(i1: number, i2: number) {
		const id1 = i1 -1, id2 = i2 -1;
		const tp = this.zergs[id1];
		this.zergs[id1] = this.zergs[id2];
		this.zergs[id2] = tp;
	}

	// private findLine(line: number[]): number[] {
	// 	if (line.length >= 4) return line;
	// 	const last = line[line.length-1];
	// 	const existingPoses = _.map(line, id => this.zergs[id].pos);
	// 	const nexPoses = _.filter(this.zergs[last].pos.neighbors, pos=> 
	// 		!_.any(existingPoses, ext=> ext.isEqualTo(pos)) && 
	// 	);
	// }

	private handle(index: number): void {
		// zerg1 is the zerg with path
		const zerg1 = this.zergs[index],zerg2 = this.zergs[index+1],
			zerg3 = this.zergs[index+2] ,zerg4 = this.zergs[index+3];
		if (zerg4 == undefined) {
			zerg1?.goTo(this.colony.controller, {range: 6});
			zerg2?.goTo(this.colony.controller, {range: 6});
			zerg3?.goTo(this.colony.controller, {range: 6});
			return;
		}
		let clusterExpected = true;
		for (let i=0; i<4; ++i) {
			if (this.zergs[index+i].room.hostiles.length <= 90) {
				clusterExpected = false;
				break;
			}
		}
		if (zerg1.inSameRoomAs(this.directive)) clusterExpected = true;
		// if not touched, let them touch
		// If on edge, everyone gotta move
		let edgy = _.any([zerg1, zerg2, zerg3, zerg4], z=>z.pos.rangeToEdge <=0);
		if (edgy) {
			zerg1.goTo(this.directive);
		}
		let touch = false;
		for (let i=0; i<3; ++i) {
			if(!this.zergs[i+1].pos.isNearTo(this.zergs[i])) {
				this.zergs[i+1].goTo(this.zergs[i], {range: edgy?0:1});
				touch = true;
			} else if (edgy) {
				// Assume we're not cluster at edge
				this.zergs[i+1].move(this.zergs[i+1].pos.getDirectionTo(this.zergs[i]));
			}
		}
		if (touch) return;
		if(clusterExpected) {
			// 到达目标房间
			zerg1.autoSkirmish(this.directive.pos.roomName);
			zerg2.autoSkirmish(this.directive.pos.roomName);
			zerg3.autoSkirmish(this.directive.pos.roomName);
			zerg4.autoSkirmish(this.directive.pos.roomName);
			// if (zerg1.pos.isNearTo(zerg2) && zerg1.pos.isNearTo(zerg3) &&zerg1.pos.isNearTo(zerg4) &&
			// 	zerg2.pos.isNearTo(zerg3) &&zerg2.pos.isNearTo(zerg4) &&zerg3.pos.isNearTo(zerg4)) {
			// 	// TODO: quad move
			// 	zerg1.goTo(this.directive, {noPush: true});
			// 	// zerg1.creep.memory.

			// } else {
			// 	const targets = zerg2.pos.availableNeighbors(false).filter(pos=> pos.isNearTo(zerg3));
			// 	const target = targets.find(pos=>pos.isNearTo(zerg1));
			// 	if (target != undefined) {
			// 		zerg3.move(zerg3.pos.getDirectionTo(target));
			// 	} else {
			// 		zerg3.move(zerg3.pos.getDirectionTo(targets[0]));
			// 	}
			// 	zerg4.move(zerg4.pos.getDirectionTo(zerg3));
			// }
		} else {
			zerg1.goTo(this.directive);
			zerg2.move(zerg2.pos.getDirectionTo(zerg1));
			zerg3.move(zerg3.pos.getDirectionTo(zerg2));
			zerg4.move(zerg4.pos.getDirectionTo(zerg3));
		}
		// ---------
		// if (!zerg2.pos.isNearTo(zerg1) && _.any([zerg3, zerg4],z=>z.pos.isNearTo(zerg1))) {
		// 	const z = zerg3.pos.isNearTo(zerg1) ? 3 : 4;
		// 	this.swap(2, z);
		// 	return this.handle(index);
		// }
		// if (!zerg3.pos.isNearTo(zerg2) && zerg4.pos.isNearTo(zerg2)) {
		// 	this.swap(3, 4);
		// 	return this.handle(index);
		// }
		// if (cluster) {
		// } else {
		// 	// Everyone follow another one
		// 	// zerg1.move()
		// 	if (zerg2.pos.isNearTo(zerg1)) {
		// 		zerg2.move(zerg2.pos.getDirectionTo(zerg1.pos));
		// 	} else {
		// 		zerg2.goTo(zerg1.pos);
		// 	}
		// }
	}

	init() {
		const hydraliskSetup = this.canBoostSetup(CombatSetups.hydralisks.siege_T1) ? CombatSetups.hydralisks.siege_T1
																					: CombatSetups.hydralisks.default;

		this.wishlist(4, Setups.scout, {priority: OverlordPriority.offense.destroy, reassignIdle: true});
	}

	run() {
		// this.autoRun(this.zergs, hydralisk => undefined);
		for (let i = 0; i < this.zergs.length; i+=4) {
			this.handle(i);

		}
	}

	visuals() {
		// Visualizer.marker(this.fallback, {color: 'green'});
		// for (const ref in this.swarms) {
		// 	const swarm = this.swarms[ref];
		// 	Visualizer.marker(swarm.anchor, {color: 'blue'});
		// 	if (swarm.target) {
		// 		Visualizer.marker(swarm.target.pos, {color: 'orange'});
		// 	}
		// }
	}
}
