import { Tasks } from "tasks/Tasks";
import { Zerg } from "zerg/Zerg";
import { Mission } from "./Mission";
import { MoveOptions } from "movement/Movement";
import { Pathing } from "movement/Pathing";
import { log } from "console/log";
import { CombatIntel } from "intel/CombatIntel";
import { BuildPriorities } from "priorities/priorities_structures";

export const missionStartupName = "startup"
export class MissionStartup extends Mission {
	private findStructureBlockingController(pioneer: Zerg): Structure | undefined {
		const blockingPos = Pathing.findBlockingPos(pioneer.pos, pioneer.room.controller!.pos,
													_.filter(pioneer.room.structures, s => !s.isWalkable));
		if (blockingPos) {
			const structure = blockingPos.lookFor(LOOK_STRUCTURES)[0];
			if (structure) {
				return structure;
			} else {
				log.error(`no structure at blocking pos ${blockingPos.print}! (Why?)`);
			}
		}
	}
    public run(pioneer: Zerg) {
		// if (pioneer.flee(pioneer.room.dangerousPlayerHostiles, {dropEnergy: false}, {fleeRange: 5})) {
		// 	return;
		// }
		// Build and recharge
		if (pioneer.carry.energy == 0) {
			pioneer.task = Tasks.recharge();
		} else if (pioneer.room == this.room && !pioneer.pos.isEdge) {
			// Remove any blocking structures preventing claimer from reaching controller
			if (!this.room.my && this.room.structures.length > 0) {
				const dismantleTarget = this.findStructureBlockingController(pioneer);
				if (dismantleTarget) {
					pioneer.task = Tasks.dismantle(dismantleTarget);
					return;
				}
			}
			// const dismantlePotential = _.sum(this.room!.hostiles, h => CombatIntel.getDismantlePotential(h));
			if (!this.room || !this.room.controller) {
				log.warning('not this room or not this room controller');
				return;
			}
			const danger = !this.room.controller.safeMode && 
                (this.room.dangerousPlayerHostiles.length > 0 || this.room.creeps.length > 7);
			const shouldUpgrade = this.room.controller.ticksToDowngrade < 9000 ||
				this.room.controller.progress >= this.room.controller.progressTotal ||
				(danger && this.room.controller.maxTicksToDowngrade - this.room.controller.ticksToDowngrade > 1000);
			const canUpgrade = !(this.room.controller.upgradeBlocked > 0);
            const sites = this.room.controller.safeMode ? this.room.constructionSites :
                _.filter(this.room.constructionSites, s => s.structureType == STRUCTURE_SPAWN);
			const canBuild = (sites.length > 0) && !danger;

			if (canUpgrade && shouldUpgrade) {
				// Save controller if it's about to downgrade 
				pioneer.task = Tasks.upgrade(this.room.controller);
			} else if (canBuild) {
                for (const priority of BuildPriorities) {
                    const buildSite = _.filter(sites,
                        s => s.structureType == priority)[0];
                    if (buildSite) {
                        pioneer.task = Tasks.build(buildSite);
                        break;
                    }
                }
			} else if (this.room.barriers.length > 0) {
				pioneer.task = Tasks.fortify(_.min(this.room.barriers, b => b.hits));
			} else if (canUpgrade) {
				// or if you have nothing else to do
				pioneer.task = Tasks.upgrade(this.room.controller);
			} else {
				// cases are: upgrade blocked and (danger or !spawnSite) and no barriers
				const rampartSite = this.room.constructionSites.find(s => s.structureType == STRUCTURE_RAMPART);
				if (rampartSite) {
					pioneer.task = Tasks.build(rampartSite);
				}
			}
		} else {
			// pioneer.task = Tasks.goTo(this.pos);
			let option: MoveOptions = {ensurePath: true, avoidSK: true,};
			if (this.pos.roomName != pioneer.pos.roomName) {
				option.waypoints = this.waypoints;
			}
			pioneer.goTo(this.pos, option);
		}
    } 
}