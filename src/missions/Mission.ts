//TODO: 一个mission包含多个任务，作用类似于overlord，但不依赖于colony等上下文。
//mission可用于爬的跨shard运行。一般情况下，一个overlord将爬赋予一个mission后便不再动了。
//除非这个mission完成或进行不下去，overlord可能会给它一个新的mission。

import { Overshard } from "Overshard";
import { Tasks } from "tasks/Tasks";
import { Zerg } from "zerg/Zerg";

//mission与overlord的权责边界在于，mission的执行不依赖colony和directive的信息。而overlord则有依赖。
//mission与task的区别在于，task只是到某个position做某个事，而mission通常是更广泛的目标，需要多个、多种task的循环、条件执行来完成。

//为了提高代码复用，减少系统复杂度，希望把多样的爬爬行为归纳为少量的task和少量的mission。
//同时尽量减少对colony等对象的数据依赖

export class Mission {
    name: string;
    pos: RoomPosition;
    waypoints: RoomPosition[];
    proto: ProtoMission;

    constructor(data: ProtoMission) {
        this.name = data.name;
        this.proto = data;
        this.waypoints = Overshard.parseWayPoints(data.waypoints);
        this.pos = derefRoomPosition(data.pos);
    }

    get room(): Room | undefined {
        return this.pos.room;
    }

    public run(zerg: Zerg) {
        zerg.task = Tasks.goToRoom(this.pos.roomName);
    } 
}