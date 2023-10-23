import { HelpOverlord } from 'overlords/situational/help';
import {AttackStructurePriorities} from '../../priorities/priorities_structures';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';
import { CombatIntel } from 'intel/CombatIntel';
import { ReservingOverlord } from 'overlords/colonization/reserver';
import { QuadOverlord } from 'overlords/offense/quad';

/**
 * 群友把自己spawn拆了，好傻哈哈哈
 */
@profile
export class DirectiveHelp extends Directive {

	static directiveName = 'help';
	static color = COLOR_GREY;
	static secondaryColor = COLOR_BLUE;

	overlords: {
		help: HelpOverlord;
		test: QuadOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.help = new HelpOverlord(this);
		// this.overlords.test = new QuadOverlord(this);
	}

	init(): void {

	}

	run(): void {
		// Remove the directive once recovered
		if (this.pos.room && this.pos.room.playerHostiles.length > 3) {
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'orange'});
		const fallback = CombatIntel.getFallbackFrom(this.pos);
		Visualizer.marker(fallback, {color: 'green'});
	}
}

