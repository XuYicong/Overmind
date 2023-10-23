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
import { CombatOverlord } from 'overlords/CombatOverlord';

const DEBUG = false;

/**
 * Spawns 黄球来拆家
 */
@profile
export class DismantleOverlord extends CombatOverlord {

	memory: any;
	directive: Directive;
	intel: CombatIntel;
	zergs: CombatZerg[];

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: Directive, priority = OverlordPriority.offense.destroy) {
		super(directive, 'dismantle', priority, 4);
		this.directive = directive;
		this.memory = Mem.wrap(this.directive.memory, this.name);
		this.intel = new CombatIntel(this.directive);
		this.zergs = this.combatZerg(Roles.dismantler, {
			notifyWhenAttacked: false,
		});
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, this.name);
	}

	handleDismantler(ce: CombatZerg) {
		ce.autoDismantle();
		ce.autoRanged();
		if (!ce.inSameRoomAs(this)) {
			ce.goToRoom(this.pos.roomName);
		}else {
			const target = ce.pos.findClosestByRange(ce.room.hostileStructures);
			if (target == null) {
				if (!ce.pos.inRangeTo(this, 4)) ce.goTo(this, {range:4});
				return;
			}
			if (!ce.pos.isNearTo(target)) ce.goTo(target, {range:1});
		}
	}

	init() {
		this.wishlist(4, CombatSetups.dismantlers.default, {priority: OverlordPriority.offense.destroy, reassignIdle: true});
	}

	run() {
		this.autoRun(this.zergs, ce => this.handleDismantler(ce));
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
