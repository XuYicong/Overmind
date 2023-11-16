import { OverlordPriority } from 'priorities/priorities_overlords';
import {Colony} from '../../Colony';
import {log} from '../../console/log';
import {Roles} from '../../creepSetups/setups';
import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {PioneerOverlord} from '../../overlords/colonization/pioneer';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';
import { ShardVisibilityScoutOverlord } from 'overlords/scouting/shardVisibility';
import { OutpostDefenseOverlord } from 'overlords/defense/outpostDefense';


/**
 * Claims a new room and builds a spawn but does not incubate. Removes when spawn is constructed.
 */
@profile
export class DirectiveColonize extends Directive {

	static directiveName = 'colonize';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_GREY;

	static requiredRCL = 3;

	toColonize: Colony | undefined;
	overlords: {
		claim: ClaimingOverlord;
		pioneer: PioneerOverlord;
		shardVisibility: ShardVisibilityScoutOverlord;
		defends: OutpostDefenseOverlord;
	};

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectiveColonize.requiredRCL
							  && colony.name != Directive.getPos(flag).roomName && colony.spawns.length > 0);
		// Register incubation status
		this.toColonize = this.room ? Overmind.colonies[Overmind.colonyMap[this.room.name]] : undefined;
		// 对于开房目标，如果目标位置在过道，则进行转义。取waypoints末尾位置为目标位置。
		if (this.pos.roomName[this.pos.roomName.length -1] == '0' || this.pos.roomName[2] == '0' || this.pos.roomName[1] == '0') {
			if (this.waypoints && this.waypoints.length > 0) {
				// refresh会刷新这个值，设在这里没用
				// TODO: 根据跨shard flag来建立directive; 
				// this.pos = this.waypoints.pop()!;
			} else {
				log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; ` +
							`removing directive!`);
				this.remove(true);
			}
		}
	}

	spawnMoarOverlords() {
		// TODO: on occupation, burst defense when energy sufficient
		if (this.colony.storage && this.colony.assets[RESOURCE_ENERGY] < 9e4) return;
		let safeModeBonus = 0;
		if (this.room?.controller?.safeMode) safeModeBonus = OverlordPriority.colonization.safeModeBonus;
		this.overlords.claim = new ClaimingOverlord(this, 
			OverlordPriority.colonization.claim - safeModeBonus, 
			Game.shard.name == "shard3" ? () => {
				if(this.waypoints && this.waypoints.length > 4) {
					// We are crossing shards. To save CPU, wait for pioneers to go first
					const pioneerOverlord = this.overlords.pioneer;
					// Wait for pioneers to leave this shard
					if(!pioneerOverlord.isSuspended) return false;
					const pioneerSuspendTime = Overmind.overseer.remainingSuspendTime(pioneerOverlord);
					// TODO: Calculate shard crossing time instead of hardcoding
					if(pioneerSuspendTime < 700) {
						return true;
					}
					return false;
				}
				return true
			} : undefined);
		this.overlords.pioneer = new PioneerOverlord(this, OverlordPriority.colonization.pioneer - safeModeBonus);
		this.overlords.shardVisibility = new ShardVisibilityScoutOverlord(this);
		if (this.room) { // 若房被打，必定有视野。若简单开房或跨shard，必定没视野。
			this.overlords.defends = new OutpostDefenseOverlord(this, OverlordPriority.colonization.claim -1 - safeModeBonus);
		}
	}

	init() {
		this.alert(`Colonization in progress`);
	}

	run(verbose = false) {
		if (this.toColonize && this.toColonize.spawns.length > 0) {
			// Reassign all pioneers to be miners and workers
			const miningOverlords = _.map(this.toColonize.miningSites, site => site.overlords.mine);
			for (const pioneer of this.overlords.pioneer.pioneers) {
				const miningOverlord = miningOverlords.shift();
				if (miningOverlord) {
					if (verbose) {
						log.debug(`Reassigning: ${pioneer.print} to mine: ${miningOverlord.print}`);
					}
					pioneer.reassign(miningOverlord, Roles.drone);
				} else {
					if (verbose) {
						log.debug(`Reassigning: ${pioneer.print} to work: ${this.toColonize.overlords.work.print}`);
					}
					pioneer.reassign(this.toColonize.overlords.work, Roles.worker);
				}
			}
			// Remove the directive
			this.remove();
		}
		if (Game.time % 10 == 2 && this.room && !!this.room.owner && this.room.owner != MY_USERNAME) {
			log.notify(`Removing Colonize directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove();
		}
	}
}
