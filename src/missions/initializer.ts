import { Mission } from "./Mission";
import { MissionClaim, missionClaimName } from "./claim";
import { MissionStartup, missionStartupName } from "./startup";

export function initializeMission(proto: ProtoMission): Mission | null {
    switch (proto.name) {
        case missionStartupName:
            return new MissionStartup(proto);
        case missionClaimName:
            return new MissionClaim(proto);
        default:
            return null;
    }
}