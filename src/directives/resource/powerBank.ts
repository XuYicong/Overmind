import { PowerBankOverlord } from 'overlords/mining/powerBank';
import {log} from '../../console/log';
import {ExtractorOverlord} from '../../overlords/mining/extractor';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import { HaulingOverlord } from 'overlords/situational/hauler';

/**
 * Power mining directive. Spawns attack creeps to attack power bank, and collector creeps to collect power
 */
@profile
export class DirectivePowerBank extends Directive {

	static directiveName = 'powerBank';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_BROWN;
	// TODO
	overlords: {
		powerBank: PowerBankOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
		if (this.colony) {
			this.colony.destinations.push({pos: this.pos, order: this.memory[_MEM.TICK] || Game.time});
		}
	}

	spawnMoarOverlords() {
		let priority: number;
		if (this.room && this.room.my) {
			if (this.colony.level == 8) {
				priority = OverlordPriority.ownedRoom.mineralRCL8;
			} else {
				priority = OverlordPriority.ownedRoom.mineral;
			}
		} else {
			priority = OverlordPriority.remoteSKRoom.mineral;
		}
		this.overlords.powerBank = new PowerBankOverlord(this, priority);
	}

	init() {

	}

	run() {
		if (this.colony.level < 6) {
			log.notify(`Removing extraction directive in ${this.pos.roomName}: room RCL insufficient.`);
			this.remove();
		}
	}

}


