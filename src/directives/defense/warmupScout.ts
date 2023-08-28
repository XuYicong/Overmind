import { CombatWarmupOverlord } from 'overlords/scouting/combatWarmup';
import {profile} from '../../profiler/decorator';
import {bunkerLayout} from '../../roomPlanner/layouts/bunker';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';

/**
 * Send scout to a monitor room, and warm up room for a defensive combat in advance
 */
@profile
export class DirectiveWarmupScout extends Directive {

	static directiveName = 'WarmupScout';
	static color = COLOR_BLUE;
	static secondaryColor = COLOR_WHITE;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.scout = new CombatWarmupOverlord(this);
	}

	init(): void {
	}

	run(): void {

	}

	visuals(): void {
	}
}

