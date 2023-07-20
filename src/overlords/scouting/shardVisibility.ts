import {Roles, Setups} from '../../creepSetups/setups';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

// The number of shards to keep visibility on
const NUMBER_SHARDS = 3;
// Which shard am I starting from
const MY_SHARD_ID = 3;
/**
 * Sends out a stationary scout, which travels to a shard and remains there indefinitely
 */
@profile
export class ShardVisibilityScoutOverlord extends Overlord {

	scouts: Zerg[];
	shardWaypoints: RoomPosition[][];
	directive: Directive;

	constructor(directive: Directive, priority = OverlordPriority.scouting.stationary) {
		super(directive, 'scout', priority);
		this.directive = directive;
		this.scouts = this.zerg(Roles.scout, {notifyWhenAttacked: false});
		this.shardWaypoints = [[], [], [], []];
	}

	init() {
		let waypoints = this.directive.waypoints;
		let number = 0;
		if(waypoints && waypoints.length > 4) {
			number = NUMBER_SHARDS;
			for(var i=0; i<number; i++) {
				const shard = 'shard'+i;
				const numberPortals = Math.abs(MY_SHARD_ID - i);
				this.shardWaypoints[i] = _.slice(waypoints, 0, numberPortals);
			}
		}
		this.wishlist(number, Setups.scout);
	}

	run() {
		for(var i=0; i<this.scouts.length; i++) {
			const scout = this.scouts[i];
			const waypoints = this.shardWaypoints[i];
			// TODO: set target range in other shards, instead of hardcoding a walkable position
			scout.goTo(new RoomPosition(25, 15, scout.pos.roomName),
				{waypoints: waypoints});
		}
	}
}
