import {Colony} from '../../Colony';
import {Roles, Setups} from '../../creepSetups/setups';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';
import {getUsername, isRoomAvailable} from '../../utilities/utils';
const DEFAULT_NUM_SCOUTS = 1;

/**
 * Sends out scouts which randomly traverse rooms to uncover possible expansion locations and gather intel
 */
@profile
export class RandomWalkerScoutOverlord extends Overlord {

	scouts: Zerg[];

	constructor(colony: Colony, priority = OverlordPriority.scouting.randomWalker) {
		super(colony, 'scout', priority);
		this.scouts = this.zerg(Roles.scout, {notifyWhenAttacked: false});
	}

	init() {
		if(this.colony.level < 4) {
			this.wishlist(DEFAULT_NUM_SCOUTS, Setups.scout);
		}
	}
	private handleScout(scout: Zerg) {
		// Stomp on enemy construction sites
		// const enemyConstructionSites = scout.room.find(FIND_HOSTILE_CONSTRUCTION_SITES);
		// if (enemyConstructionSites.length > 0 && enemyConstructionSites[0].pos.isWalkable(true)) {
		// 	scout.goTo(enemyConstructionSites[0].pos);
		// 	return;
		// }
		// Check if room might be connected to newbie/respawn zone
		const indestructibleWalls = _.filter(scout.room.walls, wall => wall.hits == undefined);
		if (indestructibleWalls.length > 0 || (
			scout.room.controller?.owner && scout.room.controller.owner.username != getUsername())
			) { // go back to origin colony if you find a room near newbie zone, or an owned room
			scout.task = Tasks.goToRoom(this.colony.room.name); // todo: make this more precise
		} else {
			// Pick a new room
			// TODO: pick a room that is reachable from current room
			const neighboringRooms = _.values(Game.map.describeExits(scout.pos.roomName)) as string[];
			const roomName = _.sample(neighboringRooms)!;
			if (isRoomAvailable(roomName)) {
				scout.task = Tasks.goToRoom(roomName);
			}
		}
	}

	run() {
		this.autoRun(this.scouts, scout => this.handleScout(scout));
	}
}
