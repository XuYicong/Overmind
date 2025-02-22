import {$} from '../caching/GlobalCache';
import {Colony} from '../Colony';
import {TerminalNetwork} from '../logistics/TerminalNetwork';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';
import {Mem} from '../memory/Memory';
import {CommandCenterOverlord} from '../overlords/core/manager';
import {Priority} from '../priorities/priorities';
import {profile} from '../profiler/decorator';
import {Abathur} from '../resources/Abathur';
import {Cartographer} from '../utilities/Cartographer';
import {Visualizer} from '../visuals/Visualizer';
import {HiveCluster} from './_HiveCluster';

export const MAX_OBSERVE_DISTANCE = 7;

interface CommandCenterMemory {
	idlePos?: ProtoPos;
}

/**
 * The command center groups the high-level structures at the core of the bunker together, including storage, terminal,
 * link, power spawn, factory, observer, and nuker.
 */
@profile
export class CommandCenter extends HiveCluster {

	memory: CommandCenterMemory;
	storage: StructureStorage;								// The colony storage, also the instantiation object
	link: StructureLink | undefined;						// Link closest to storage
	terminal: StructureTerminal | undefined;				// The colony terminal
	terminalNetwork: TerminalNetwork;						// Reference to Overmind.terminalNetwork
	towers: StructureTower[];								// Towers within range 3 of storage are part of cmdCenter
	extensions: StructureExtension[];						// Help fill some extra extensions at RCL8
	powerSpawn: StructurePowerSpawn | undefined;			// Colony Power Spawn
	nuker: StructureNuker | undefined;						// Colony nuker
	factory: StructureFactory | undefined;					// Colony factory
	observer: StructureObserver | undefined;				// Colony observer
	transportRequests: TransportRequestGroup;				// Box for energy requests

	private observeRoom: string | undefined;
	private _idlePos: RoomPosition;							// Cached idle position

	static settings = {
		enableIdleObservation: true,
		linksTransmitAt      : LINK_CAPACITY - 100,
		refillTowersBelow    : 750,
	};

	constructor(colony: Colony, storage: StructureStorage) {
		super(colony, storage, 'commandCenter');
		this.memory = Mem.wrap(this.colony.memory, 'commandCenter');
		// Register physical components
		this.storage = storage;
		this.terminal = colony.terminal;
		this.powerSpawn = colony.powerSpawn;
		this.nuker = colony.nuker;
		this.factory = colony.factory;
		this.observer = colony.observer;
		if (this.colony.bunker) {
			this.link = this.colony.bunker.anchor.findClosestByLimitedRange(colony.availableLinks, 1);
			this.colony.linkNetwork.claimLink(this.link);
			this.towers = this.colony.bunker.anchor.findInRange(colony.towers, 1);
			this.extensions = this.colony.bunker.anchor.findInRange(colony.extensions, 1);
		} else {
			this.link = this.pos.findClosestByLimitedRange(colony.availableLinks, 2);
			this.colony.linkNetwork.claimLink(this.link);
			this.towers = this.pos.findInRange(colony.towers, 3);
		}
		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetwork;
		this.transportRequests = new TransportRequestGroup(); // commandCenter always gets its own request group
		this.observeRoom = undefined;
	}

	refresh() {
		this.memory = Mem.wrap(this.colony.memory, 'commandCenter');
		$.refreshRoom(this);
		$.refresh(this, 'storage', 'terminal', 'powerSpawn', 'nuker', 'observer', 'link', 'towers', 'factory', 'extensions');
		this.transportRequests.refresh();
		this.observeRoom = undefined;
	}

	spawnMoarOverlords() {
		if (this.link || this.terminal) {
			this.overlord = new CommandCenterOverlord(this);
		}
	}

	// Idle position
	get idlePos(): RoomPosition {
		if (this.colony.bunker) {
			return this.colony.bunker.anchor;
		}
		if (!this.memory.idlePos || Game.time % 25 == 0) {
			this.memory.idlePos = this.findIdlePos();
		}
		return derefRoomPosition(this.memory.idlePos);
	}

	/* Find the best idle position */
	private findIdlePos(): RoomPosition {
		// Try to match as many other structures as possible
		const proximateStructures: Structure[] = _.compact([this.link!,
															this.terminal!,
															this.powerSpawn!,
															this.nuker!,
															this.factory!,
															...this.towers]);
		const numNearbyStructures = (pos: RoomPosition) =>
			_.filter(proximateStructures, s => s.pos.isNearTo(pos) && !s.pos.isEqualTo(pos)).length;
		return _.last(_.sortBy(this.storage.pos.neighbors, pos => numNearbyStructures(pos)))!;
	}

	/* Register a link transfer store if the link is sufficiently full */
	private registerLinkTransferRequests(): void {
		if (this.link) {
			if (this.link.store[RESOURCE_ENERGY] > CommandCenter.settings.linksTransmitAt) {
				this.colony.linkNetwork.requestTransmit(this.link);
			}
		}
	}

	private registerRequests(): void {

		// Supply requests:

		// If the link is empty and can send energy and something needs energy, fill it up
		if (this.link && this.link.store[RESOURCE_ENERGY] < 0.9 * this.link.store.getCapacity(RESOURCE_ENERGY) && this.link.cooldown <= 1) {
			if (this.colony.linkNetwork.receive.length > 0) { 	// If something wants energy
				this.transportRequests.requestInput(this.link, Priority.Critical);
			}
		}
		// Refill towers as needed with variable priority
		const refillTowers = _.filter(this.towers, tower => tower.store[RESOURCE_ENERGY] < CommandCenter.settings.refillTowersBelow);
		_.forEach(refillTowers, tower => this.transportRequests.requestInput(tower, Priority.High));
		const refillExtensions = _.filter(this.extensions, ext => ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
		_.forEach(refillExtensions, tower => this.transportRequests.requestInput(tower, Priority.Normal));

		// Refill core spawn (only applicable to bunker layouts)
		if (this.colony.bunker && this.colony.bunker.coreSpawn) {
			if (this.colony.bunker.coreSpawn.store[RESOURCE_ENERGY] < this.colony.bunker.coreSpawn.store.getCapacity(RESOURCE_ENERGY)) {
				this.transportRequests.requestInput(this.colony.bunker.coreSpawn, Priority.Normal);
			}
		}
		// Refill power spawn
		if (this.powerSpawn && this.powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) <= 0 && this.storage.store[RESOURCE_ENERGY] > 2.5e5) {
			this.transportRequests.requestInput(this.powerSpawn, Priority.NormalLow);
		}
		if (this.powerSpawn && this.powerSpawn.store.getUsedCapacity(RESOURCE_POWER) <= 0
			&& this.colony.assets[RESOURCE_POWER]) {
			this.transportRequests.requestInput(this.powerSpawn, Priority.NormalLow, {
				resourceType: RESOURCE_POWER, amount: Math.min(
					this.powerSpawn.store.getFreeCapacity(RESOURCE_POWER), 
					this.colony.assets[RESOURCE_POWER]
					)
				}
			);
		}
		// Refill nuker with low priority
		if (this.nuker) {
			if (this.nuker.store[RESOURCE_ENERGY] < this.nuker.store.getCapacity(RESOURCE_ENERGY) && this.storage.store[RESOURCE_ENERGY] > 300000) {
				this.transportRequests.requestInput(this.nuker, Priority.Low);
			}
			if (this.nuker.ghodium < this.nuker.ghodiumCapacity
				&& (this.colony.assets[RESOURCE_GHODIUM] || 0) >= 2 * Abathur.settings.maxBatchSize) {
				this.transportRequests.requestInput(this.nuker, Priority.Low, {resourceType: RESOURCE_GHODIUM});
			}
		}

		// Withdraw requests:

		// If the link has energy and nothing needs it, empty it
		if (this.link && this.link.store[RESOURCE_ENERGY] > 0) {
			if (this.colony.linkNetwork.receive.length == 0 || this.link.cooldown > 3) {
				this.transportRequests.requestOutput(this.link, Priority.High);
			}
		}
	}

	requestRoomObservation(roomName: string) {
		this.observeRoom = roomName;
	}

	private runObserver(): void {
		if (this.observer) {
			if (this.observeRoom) {
				this.observer.observeRoom(this.observeRoom);
			} else if (CommandCenter.settings.enableIdleObservation) {
				const dx = Game.time % MAX_OBSERVE_DISTANCE;
				const dy = Game.time % (MAX_OBSERVE_DISTANCE ** 2);
				const roomToObserve = Cartographer.findRelativeRoomName(this.pos.roomName, dx, dy);
				this.observer.observeRoom(roomToObserve);
			}
		}
	}

	private runPowerSpawn(): void {
		if (!this.powerSpawn) return;
		const store = this.powerSpawn.store;
		if (store.getUsedCapacity(RESOURCE_ENERGY) <= 0 || store.getUsedCapacity(RESOURCE_POWER) <= 0) return;
		this.powerSpawn.processPower();
	}

	// Initialization and operation ====================================================================================

	init(): void {
		this.registerLinkTransferRequests();
		this.registerRequests();
	}

	run(): void {
		this.runObserver();
		this.runPowerSpawn();
	}

	visuals(coord: Coord): Coord {
		let {x, y} = coord;
		const height = this.storage && this.terminal ? 2 : 1;
		const titleCoords = Visualizer.section(`${this.colony.name} Command Center`,
											 {x, y, roomName: this.room.name}, 9.5, height + .1);
		const boxX = titleCoords.x;
		y = titleCoords.y + 0.25;
		if (this.storage) {
			Visualizer.text('Storage', {x: boxX, y: y, roomName: this.room.name});
			Visualizer.barGraph(this.storage.store.getUsedCapacity() / this.storage.store.getCapacity(),
								{x: boxX + 4, y: y, roomName: this.room.name}, 5);
			y += 1;
		}
		if (this.terminal) {
			Visualizer.text('Terminal', {x: boxX, y: y, roomName: this.room.name});
			Visualizer.barGraph(this.terminal.store.getUsedCapacity() / this.terminal.store.getCapacity(),
								{x: boxX + 4, y: y, roomName: this.room.name}, 5);
			y += 1;
		}
		return {x: x, y: y + .25};
	}
}

