import {getCutTiles} from '../algorithms/minCut';
import {Colony} from '../Colony';
import {log} from '../console/log';
import {Mem} from '../memory/Memory';
import {profile} from '../profiler/decorator';
import {derefCoords, minMax} from '../utilities/utils';
import { neighbor8, onRoomEdge } from './DynamicPlanner';
import {BUNKER_RADIUS, bunkerLayout, insideBunkerBounds, getRoomSpecificBunkerLayout} from './layouts/bunker';
import { dynamicLayout, evolutionChamberLayout } from './layouts/dynamic';
import {getAllStructureCoordsFromLayout, RoomPlanner, translatePositions} from './RoomPlanner';

export interface BarrierPlannerMemory {
	barrierLookup: { [roadCoordName: string]: boolean | undefined };
}

const memoryDefaults = {
	barrierLookup: {},
};

@profile
export class BarrierPlanner {

	roomPlanner: RoomPlanner;
	colony: Colony;
	memory: BarrierPlannerMemory;
	barrierPositions: RoomPosition[];

	static settings = {
		buildBarriersAtRCL: 1,
		padding           : 3, // allow this much space between structures and barriers (if possible)
		bunkerizeRCL      : 9
	};

	constructor(roomPlanner: RoomPlanner) {
		this.roomPlanner = roomPlanner;
		this.colony = roomPlanner.colony;
		this.memory = Mem.wrap(this.colony.memory, 'barrierPlanner', memoryDefaults);
		this.barrierPositions = [];
	}

	refresh(): void {
		this.memory = Mem.wrap(this.colony.memory, 'barrierPlanner', memoryDefaults);
		this.barrierPositions = [];
	}

	private computeBunkerBarrierPositions(bunkerPos: RoomPosition, upgradeSitePos: RoomPosition): RoomPosition[] {
		const result = this.computeEdgeBarrierPositions(bunkerPos.room);
		if(result.length > 0) return result;
		const rectArray = [];
		const padding = BarrierPlanner.settings.padding;
		if (bunkerPos) {
			const {x, y} = bunkerPos;
			const r = BUNKER_RADIUS - 1;
			let [x1, y1] = [Math.max(x - r - padding, 0), Math.max(y - r - padding, 0)];
			let [x2, y2] = [Math.min(x + r + padding, 49), Math.min(y + r + padding, 49)];
			// Make sure you don't leave open walls
			x1 = minMax(x1, 3, 50 - 3);
			x2 = minMax(x2, 3, 50 - 3);
			y1 = minMax(y1, 3, 50 - 3);
			y2 = minMax(y2, 3, 50 - 3);
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		// Get Min cut
		const barrierCoords = getCutTiles(this.colony.name, rectArray, false, 2, false);
		let positions = _.map(barrierCoords, coord => new RoomPosition(coord.x, coord.y, this.colony.name));
		positions = positions.concat(upgradeSitePos.availableNeighbors(true));
		return positions;
	}

	private computeEdgeBarrierPositions(room: Room | undefined): RoomPosition[]  {
		if (!room) {
			log.warning('No room in room position! (Why?)');
			return [];
		}
		const exitsDesc = Game.map.describeExits(room.name);
		let neighborCount = 0;
		for (const exitKey in exitsDesc) {
			neighborCount++
			// Only roll in edge barriers if it's a 'cave' room
			// TODO: or if all other exits are my owned room
			if(neighborCount > 1) return [];
		}
		const exits = room.find(FIND_EXIT);
		const terrain = room.getTerrain();
		function isEdge(coord: number) {
			return coord == 0 || coord == 49;
		}
		function deEdge(coord: number) {
			return coord < 25 ? coord +1 : coord -1;
		}
		const neighbors = 
		_.filter(
			_.unique(
				_.flatten(
					_.map(exits, exit => {
						const ret = [];
						if(isEdge(exit.x)) {
							for(let i=-1; i<=1; ++i) {
								ret.push(new RoomPosition(deEdge(exit.x), exit.y + i, exit.roomName));
							}
						} else {
							for(let i=-1; i<=1; ++i) {
								ret.push(new RoomPosition(exit.x + i, deEdge(exit.y), exit.roomName));
							}
						}
						return ret;
					})
				)
			), pos => terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL
		);
		const candidates = 
		_.filter(
			_.unique(
				_.flatten(
					_.map(neighbors, neighbor =>
						_.map(neighbor8, dpos => new RoomPosition(neighbor.x + dpos.x, neighbor.y + dpos.y, neighbor.roomName)),
					)
				)
			), pos => terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL && 
				!onRoomEdge(pos) &&
				neighbors.every(xpos => pos.x != xpos.x || pos.y != xpos.y)
		);
		return candidates;
	}

	private computeBarrierPositions(hatcheryPos: RoomPosition, commandCenterPos: RoomPosition,
									upgradeSitePos: RoomPosition): RoomPosition[] {
		const result = this.computeEdgeBarrierPositions(hatcheryPos.room);
		if(result.length > 0) return result;
		const rectArray = [];
		const padding = BarrierPlanner.settings.padding;
		if (hatcheryPos) {
			const {x, y} = hatcheryPos;
			const [x1, y1] = [Math.max(x - 5 - padding, 0), Math.max(y - 4 - padding, 0)];
			const [x2, y2] = [Math.min(x + 5 + padding, 49), Math.min(y + 5 + padding, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		if (commandCenterPos) {
			const {x, y} = commandCenterPos;
			const [x1, y1] = [Math.max(x - 3 - padding, 0), Math.max(y - 0 - padding, 0)];
			const [x2, y2] = [Math.min(x + 0 + padding, 49), Math.min(y + 5 + padding, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		if (upgradeSitePos) {
			const {x, y} = upgradeSitePos;
			const [x1, y1] = [Math.max(x - 1, 0), Math.max(y - 1, 0)];
			const [x2, y2] = [Math.min(x + 1, 49), Math.min(y + 1, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		// Get Min cut
		const barrierCoords = getCutTiles(this.colony.name, rectArray, true, 2, false);
		return _.map(barrierCoords, coord => new RoomPosition(coord.x, coord.y, this.colony.name));
	}

	init(): void {

	}

	/* Write everything to memory after roomPlanner is closed */
	finalize(): void {
		this.memory.barrierLookup = {};
		if (this.barrierPositions.length == 0) {
			if (this.roomPlanner.bunkerPos) {
				this.barrierPositions = this.computeBunkerBarrierPositions(this.roomPlanner.bunkerPos,
																		   this.colony.controller.pos);
			} else if (this.roomPlanner.storagePos && this.roomPlanner.hatcheryPos) {
				this.barrierPositions = this.computeBarrierPositions(this.roomPlanner.hatcheryPos,
																	 this.roomPlanner.storagePos,
																	 this.colony.controller.pos);
			} else {
				log.error(`Couldn't generate barrier plan for ${this.colony.name}!`);
			}
		}
		for (const pos of this.barrierPositions) {
			this.memory.barrierLookup[pos.coordName] = true;
		}
	}

	/* Quick lookup for if a barrier should be in this position. Barriers returning false won't be maintained. */
	barrierShouldBeHere(pos: RoomPosition): boolean {
		if (this.colony.layout == 'bunker') {
			if (this.colony.level >= BarrierPlanner.settings.bunkerizeRCL) {
				// Once you are high level, only maintain ramparts at bunker or controller
				return insideBunkerBounds(pos, this.colony) || pos.getRangeTo(this.colony.controller) == 1;
			} else {
				// Otherwise keep the normal plan up
				return !!this.memory.barrierLookup[pos.coordName] || pos.getRangeTo(this.colony.controller) == 1;
			}
		} else {
			return !!this.memory.barrierLookup[pos.coordName] || pos.getRangeTo(this.colony.controller) == 1;
		}
	}

	/* Create construction sites for any buildings that need to be built */
	private buildMissingRamparts(): void {
		// Max buildings that can be placed each tick
		let count = RoomPlanner.settings.maxSitesPerColony - this.colony.constructionSites.length;

		// Build missing ramparts
		const barrierPositions: RoomPosition[] = [];
		for (const coord of _.keys(this.memory.barrierLookup)) {
			barrierPositions.push(derefCoords(coord, this.colony.name));
		}

		// Add critical structures to barrier lookup
		const criticalStructures: Structure[] = _.compact([...this.colony.towers,
														   ...this.colony.spawns,
														   this.colony.storage!,
														   this.colony.terminal!]);
		for (const structure of criticalStructures) {
			barrierPositions.push(structure.pos);
		}

		for (const pos of barrierPositions) {
			if (count > 0  && !pos.lookForStructure(STRUCTURE_WALL)
			&& RoomPlanner.canBuild(STRUCTURE_RAMPART, pos) && this.barrierShouldBeHere(pos)) {
				const ret = pos.createConstructionSite(STRUCTURE_RAMPART);
				if (ret != OK) {
					log.warning(`${this.colony.name}: couldn't create rampart site at ${pos.print}. Result: ${ret}`);
				} else {
					count--;
				}
			}
		}
	}

	private buildMissingBunkerRamparts(): void {
		const bunkerPos = this.roomPlanner.bunkerPos;
		const evolutionChamberPos = this.roomPlanner.bunkerPos;
		if (!bunkerPos) return;
		let bunkerPositions;
		const layout = evolutionChamberPos ? dynamicLayout : getRoomSpecificBunkerLayout(this.colony.name);
		const bunkerCoords = getAllStructureCoordsFromLayout(layout, this.colony.level);
		bunkerCoords.push(layout.data.anchor); // add center bunker tile
		bunkerPositions = _.map(bunkerCoords, coord => new RoomPosition(coord.x, coord.y, this.colony.name));
		bunkerPositions = translatePositions(bunkerPositions, layout.data.anchor, bunkerPos);
		if (evolutionChamberPos) {
			bunkerPositions.concat(
				translatePositions(
					_.map(
						getAllStructureCoordsFromLayout(
							evolutionChamberLayout,
							this.colony.level,
						),
						coord => new RoomPosition(coord.x, coord.y, this.colony.name),
					),
					layout.data.anchor,
					evolutionChamberPos,
				)
			);
		}
		let count = RoomPlanner.settings.maxSitesPerColony - this.colony.constructionSites.length;
		for (const pos of bunkerPositions) {
			if (count > 0 && !pos.lookForStructure(STRUCTURE_RAMPART)
				&& pos.lookFor(LOOK_CONSTRUCTION_SITES).length == 0) {
				const ret = pos.createConstructionSite(STRUCTURE_RAMPART);
				if (ret != OK) {
					log.warning(`${this.colony.name}: couldn't create bunker rampart at ${pos.print}. Result: ${ret}`);
				} else {
					count--;
				}
			}
		}
	}

	run(): void {
		if (this.roomPlanner.active) {
			if (this.roomPlanner.bunkerPos) {
				this.barrierPositions = this.computeBunkerBarrierPositions(this.roomPlanner.bunkerPos,
																		   this.colony.controller.pos);
			} else if (this.roomPlanner.storagePos && this.roomPlanner.hatcheryPos) {
				this.barrierPositions = this.computeBarrierPositions(this.roomPlanner.hatcheryPos,
																	 this.roomPlanner.storagePos,
																	 this.colony.controller.pos);
			}
			this.visuals();
		} else {
			if (!this.roomPlanner.memory.relocating && this.colony.level >= BarrierPlanner.settings.buildBarriersAtRCL
				&& this.roomPlanner.shouldRecheck(2)) {
				this.buildMissingRamparts();
				if (this.colony.layout == 'bunker' && this.colony.level >= BarrierPlanner.settings.bunkerizeRCL) {
					this.buildMissingBunkerRamparts();
				}
			}
		}
	}

	visuals(): void {
		for (const pos of this.barrierPositions) {
			this.colony.room.visual.structure(pos.x, pos.y, STRUCTURE_RAMPART);
		}
	}

}
