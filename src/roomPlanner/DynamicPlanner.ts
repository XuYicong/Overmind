import { profile } from "profiler/decorator";
import { RoomPlanner, StructureMap } from "./RoomPlanner";
import { dynamicLayout, evolutionChamberLayout } from "./layouts/dynamic";
import { bunkerLayout } from "./layouts/bunker";
import { log } from "console/log";
import { Visualizer } from "visuals/Visualizer";

// Order critical
const nextPos: {x:number, y:number}[] = [
    {
        x: -1, y: -1
    },{
        x: -1, y: 1
    },{
        x: 1, y: 1
    },{
        x: 1, y: -1
    }];

// Must be ordered
export const neighbor8: {x:number, y:number}[] = [
    {
        x: 0, y: -1
    },{
        x: -1, y: -1
    },{
        x: -1, y: 0
    },{
        x: -1, y: 1
    },{
        x: 0, y: 1
    },{
        x: 1, y: 1
    },{
        x: 1, y: 0
    },{
        x: 1, y: -1
    }];

// 抄抄63
const CONTROLLER_STRUCTURES: {[structure: string]: {[level:number]: number}} = {
    "spawn": {0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3},
    "extension": {0: 0, 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60},
    "link": {1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 3, 7: 4, 8: 6},
    "road": {0: 2500, 1: 2500, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500},
    "constructedWall": {1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500},
    "rampart": {1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500},
    "storage": {1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1},
    "tower": {1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 6},
    "observer": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1},
    "powerSpawn": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1},
    "extractor": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1},
    "terminal": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1},
    "lab": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10},
    "container": {0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5},
    "nuker": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1},
    "factory": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1}
}

export function onRoomEdge(pos: {x: number, y:number}, range = 0) {
    return pos.x<=range || pos.y<=range || pos.x>=49-range || pos.y>=49-range;
}

@profile
export class DynamicPlanner {

    static getStaticStructureMap(room: Room, anchor: { x: number, y: number }, 
        evolutionChamberAnchor: { x: number, y: number }, level = 8): StructureMap {
        return _.defaultsDeep(
            RoomPlanner.getStructureMapAt(room.name, dynamicLayout, anchor, level),
            RoomPlanner.getStructureMapAt(room.name, evolutionChamberLayout, evolutionChamberAnchor, level)
        );
    }

    static getStructureMapForBunkerAt(room: Room, anchor: { x: number, y: number }, 
                            evolutionChamberAnchor: { x: number, y: number }, level = 8): StructureMap {
        const structureMap = this.getStaticStructureMap(room, anchor, evolutionChamberAnchor, level);
        let rightest: RoomPosition = structureMap['spawn'][0];
        const countExistingStructures: {[type: string]: number} = {};
        const hasNonWalkableStructurs: {[pos :number]: boolean} = {};
        const hasRampart: {[pos :number]: boolean} = {};
        const typesConcerned = ["extension", "spawn", "tower"];
        const posNumber = (pos: {x: number, y:number}) => {
            return pos.y * 64 + pos.x;
        };
        const core = RoomPlanner.getStructureMapAt(room.name, dynamicLayout, anchor, 8);
        const evolutionCore = RoomPlanner.getStructureMapAt(room.name, evolutionChamberLayout, evolutionChamberAnchor, 8);
        const iterate = (structure: Structure | ConstructionSite) => {
            switch(structure.structureType) {
                case 'rampart':
                    hasRampart[posNumber(structure.pos)] = true;
                case 'road':
                    // Road and rampart are regarded walkable
                    break;
                case "extension":
                case "spawn":
                case "observer":
                    if(structure.pos.x > rightest.x) {
                        rightest = structure.pos;
                    }
                case "tower":
                    if(countExistingStructures[structure.structureType]) countExistingStructures[structure.structureType]++;
                    else countExistingStructures[structure.structureType] = 1;

                default:
                    hasNonWalkableStructurs[posNumber(structure.pos)] = true;
                    break;
            }
        }
        // Mark positions as non walkable
        for(const id in core) {
            const poss = core[id];
            for(const pos of poss) {
                hasNonWalkableStructurs[posNumber(pos)] = true;
            }
        }
        for(const id in evolutionCore) {
            const poss = evolutionCore[id];
            for(const pos of poss) {
                hasNonWalkableStructurs[posNumber(pos)] = true;
            }
        }
        for(const structure of room.structures) {
            iterate(structure);
        }
        for(const site of room.constructionSites) {
            iterate(site);
        }
        // Calculate number of structures of each type to be built
        const numberToBuild: {[type: string]: number} = {};
        for (const structureType of typesConcerned) {
            let totalNumber = CONTROLLER_STRUCTURES[structureType][level];
            // 由 dynamic 管理的 structure，不应该出现在 structureMap 中
            if (countExistingStructures[structureType]) {
                totalNumber -= countExistingStructures[structureType];
            }
            // else if (structureMap[structureType]) {
            //     totalNumber -= structureMap[structureType].length;
            // }
            numberToBuild[structureType] = totalNumber;
            // log.info(structureType +": "+ numberToBuild[structureType]);
        }
        // Walk along structure cluster edge to look for new pos
        let cur: {x:number, y:number} = rightest;
        const terrain = room.getTerrain();
        const validPos = function *(nxtPos) {
            let centerDirection = 0;
            // Try at most 100 positions for now
            for(let i=0; i<100; i++) {
                // Currently walking on cur
                // log.info('看看 ('+cur.x+', '+cur.y);
                // Rotate around the target position
                let directionGot: boolean = false;
                for(let j=0; j<4; j++) {
                    // Start from center direction
                    const curDirection = (centerDirection+j)%4;
                    const dPos = nxtPos[curDirection];
                    const candidatePos = new RoomPosition(cur.x + dPos.x, cur.y + dPos.y, room.name);
                    // Walk on the edge of non walkable structures cluster
                    if(hasNonWalkableStructurs[posNumber(candidatePos)] || onRoomEdge(candidatePos, 1)) {
                        continue;
                    }

                    // For invalid conditions, if continue before this, the search would treat it as part of the cluster
                    // if continue after this, the search would consider it a cluster edge
                    if(!directionGot){
                        // Go vertical to center direction if on edge, or turn back to find the center if off edge
                        centerDirection = (curDirection+3)%4;
                        directionGot = true;
                    }

                    // Natural walls are also not constructable on
                    if(terrain.get(candidatePos.x, candidatePos.y) == TERRAIN_MASK_WALL) continue;
                    // For all walkable pos(non walkable structures and terrain walls) of 8 neighbors,
                    // Check for two break points in nearTo graph
                    // Check whether this pos cut the road
                    const walkableNeighbors = _.filter(
                        _.map(
                            neighbor8, 
                            dpos => new RoomPosition(candidatePos.x + dpos.x, candidatePos.y + dpos.y, candidatePos.roomName)
                        ), 
                        pos => 
                            !hasNonWalkableStructurs[posNumber(pos)] && (
                            // Look for mineral and energy. Mark as walkable.
                            pos.lookFor(LOOK_MINERALS).length > 0 || pos.lookFor(LOOK_ENERGY).length > 0 ||
                            terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL)
                    );
                    const len = walkableNeighbors.length;
                    if(len <= 0) {
                        // a 回 shape terrain, marking it non walkable tho
                        hasNonWalkableStructurs[posNumber(candidatePos)] = true;
                        continue;
                    }
                    let breakPointCount = 0;
                    for(let k=0; k<len; k++) {
                        if(hasRampart[posNumber(walkableNeighbors[k])]) {
                            breakPointCount = 9;
                        } else if(!walkableNeighbors[k].isNearTo(walkableNeighbors[(k+1)%len])) {
                            breakPointCount++;
                        } 
                        if(breakPointCount >= 2) break;
                    }
                    if(breakPointCount >= 2) continue;
                    
                    // We have chosen a build pos successfully
                    yield candidatePos;
                    // Do not access this same pos again
                    hasNonWalkableStructurs[posNumber(candidatePos)] = true;
                    break;
                }
                // Bounces against the wall if at edge
                for(let bounce=0; bounce<4; ++bounce) {
                    centerDirection += bounce;
                    centerDirection %= 4;
                    // If not got direction (we got into a dead end), keep on original direction
                    let nextDPos = nxtPos[(centerDirection+1)%4];
                    cur = {x: cur.x + nextDPos.x, y: cur.y + nextDPos.y};
                    if(!onRoomEdge(cur)) break;
                }
            }
        }(nextPos.reverse());
        for(const structureType in numberToBuild) {
            let targetNumber = numberToBuild[structureType];
            log.info(structureType+' amount '+targetNumber);
            // Exhaust all structures to be built
            while(targetNumber > 0) {
                const {value, done} = validPos.next();
                if(done) {
                    log.alert('Exhausted many valid positions without finding all construction pos. '+
                            '在结构的边缘没有找到空位。怎么回事？这个房间太窄了吗？');
                    break;
                }
                // Add the found position to structure map
                if(structureMap[structureType]) {
                    structureMap[structureType].push(value);
                } else {
                    structureMap[structureType] = [value];
                }
                targetNumber--;
            }
        }

        Visualizer.drawStructureMap(structureMap);
        return structureMap;
    }
}