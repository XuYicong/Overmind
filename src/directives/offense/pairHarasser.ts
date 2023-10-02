import { PairHarraserOverlord } from 'overlords/offense/pairHarraser';
import {log} from '../../console/log';
import {CombatIntel} from '../../intel/CombatIntel';
import {PairDestroyerOverlord} from '../../overlords/offense/pairDestroyer';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';

/**
 * Spawns a pair of attacker/healer creeps to siege a room
 */
@profile
export class DirectivePairHarasser extends Directive {

	static directiveName = 'destroy';
	static color = COLOR_RED;
	static secondaryColor = COLOR_BROWN;

	overlords: {
		destroy: PairHarraserOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.destroy = new PairHarraserOverlord(this);
	}

	init(): void {
		this.alert(`Pair harasser directive active`);
	}

	run(): void {
		// If there are no hostiles left in the room then remove the flag and associated healpoint
		if (Game.time % 100 == 0 && this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			log.notify(`Pair harasser mission at ${this.pos.roomName} completed successfully.`);
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
		const fallback = CombatIntel.getFallbackFrom(this.pos);
		Visualizer.marker(fallback, {color: 'green'});
	}
}
