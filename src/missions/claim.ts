import { Tasks } from "tasks/Tasks";
import { Zerg } from "zerg/Zerg";
import { Mission } from "./Mission";
import { MoveOptions } from "movement/Movement";
import { Pathing } from "movement/Pathing";
import { log } from "console/log";

export const missionClaimName = "claim";
export class MissionClaim extends Mission {
    public run(claimer: Zerg) {
		if (claimer.room == this.room && !claimer.pos.isEdge) {
			claimer.task = Tasks.claim(this.room.controller!);
		} else {
			let option: MoveOptions = {ensurePath: true, avoidSK: true, repathOnceVisible: true};
			if (this.pos.roomName != claimer.pos.roomName) {
				option.waypoints = this.waypoints;
			}
			claimer.goTo(this.pos, option);
		}
    }
}