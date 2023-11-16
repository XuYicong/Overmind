import { MoveOptions } from 'movement/Movement';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveColonize} from '../../directives/colony/colonize';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';
import { CombatIntel } from 'intel/CombatIntel';
import { Mission } from 'missions/Mission';
import { MissionStartup, missionStartupName } from 'missions/startup';
import { Missions } from 'missions/Missions';

/**
 * Spawn pioneers - early workers which help to build a spawn in a new colony, then get converted to workers or drones
 */
@profile
export class PioneerOverlord extends Overlord {

	directive: DirectiveColonize;
	pioneers: Zerg[];
	spawnSite: ConstructionSite | undefined;

	constructor(directive: DirectiveColonize, priority = OverlordPriority.colonization.pioneer) {
		super(directive, 'pioneer', priority);
		this.directive = directive;
		this.pioneers = this.zerg(Roles.pioneer);
		this.spawnSite = this.room ? _.filter(this.room.constructionSites,
											  s => s.structureType == STRUCTURE_SPAWN)[0] : undefined;
	}

	refresh() {
		super.refresh();
		this.spawnSite = this.room ? _.filter(this.room.constructionSites,
											  s => s.structureType == STRUCTURE_SPAWN)[0] : undefined;
	}

	init() {
		if(this.directive.waypoints && this.directive.waypoints.length > 4) {
			// We are crossing shards to reach the room. Reduce shards CPU use by sending less
			this.wishlist(3, Setups.pioneer);
		} else {
			this.wishlist(4, Setups.pioneer, {reassignIdle:true});
		}
	}

	private handlePioneer(pioneer: Zerg): void {
		let target = this.pos;
		let waypointsString = this.directive.memory.waypoints;
		if (this.pos.roomName[this.pos.roomName.length -1] == '0' || this.pos.roomName[2] == '0' || this.pos.roomName[1] == '0') {
			target = this.directive.waypoints![this.directive.waypoints!.length -1];
			waypointsString = waypointsString?.slice(0, -1);
		}
		pioneer.mission = Missions.create(missionStartupName, target, waypointsString || []);
	}

	run() {
		this.autoRun(this.pioneers, pioneer => this.handlePioneer(pioneer));
	}
}

