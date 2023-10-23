import { QuadOverlord } from 'overlords/offense/quad';
import {log} from '../../console/log';
import {CombatIntel} from '../../intel/CombatIntel';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';

@profile
export class DirectiveQuad extends Directive {

	static directiveName = 'quad';
	static color = COLOR_RED;
	static secondaryColor = COLOR_GREEN;

	overlords: {
		destroy: QuadOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.destroy = new QuadOverlord(this);
	}

	init(): void {
		this.alert(`Quad directive active`);
	}

	run(): void {
		// If there are no hostiles left in the room then remove the flag and associated healpoint
		if (Game.time % 100 == 0 && this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			log.notify(`Quad mission at ${this.pos.roomName} completed successfully.`);
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
		const fallback = CombatIntel.getFallbackFrom(this.pos);
		Visualizer.marker(fallback, {color: 'green'});
	}
}
