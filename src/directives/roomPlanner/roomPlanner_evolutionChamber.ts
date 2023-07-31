import { evolutionChamberLayout } from 'roomPlanner/layouts/dynamic';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';

/**
 * Manually place a EvolutionChamber anchored at the target location for the RoomPlanner to use in semiautomatic or manual mode
 */
@profile
export class DirectiveRPEvolutionChamber extends Directive {

	static directiveName = 'roomPlanner:CommandCenter';
	static color = COLOR_WHITE;
	static secondaryColor = COLOR_CYAN;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {

	}

	init(): void {
		this.colony.roomPlanner.addComponent('evolutionChamber', this.pos, this.memory.rotation);
	}

	run(): void {

	}

	visuals(): void {
		Visualizer.drawLayout(evolutionChamberLayout, this.pos);
	}
}

