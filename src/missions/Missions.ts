import { initializeMission } from "./initializer";

export class Missions {
    public static create(name: string, target: RoomPosition, waypoints: string[]) {
        return initializeMission({name: name, pos:target, waypoints:waypoints})
    }
}