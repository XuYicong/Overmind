import { MoveOptions } from 'movement/Movement';
import {$} from '../../caching/GlobalCache';
import {ColonyStage} from '../../Colony';
import {log} from '../../console/log';
import {bodyCost, CreepSetup} from '../../creepSetups/CreepSetup';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveOutpost} from '../../directives/colony/outpost';
import {_HARVEST_MEM_DIRECTION, DirectiveHarvest} from '../../directives/resource/harvest';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../../utilities/Cartographer';
import {getPosFromString, getUsername, maxBy, minBy} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

export const StandardMinerSetupCost = bodyCost(Setups.drones.miners.standard.generateBody(Infinity));

const BUILD_OUTPUT_FREQUENCY = 53;
const SUICIDE_CHECK_FREQUENCY = 3;
const MINER_SUICIDE_THRESHOLD = 200;

/**
 * Spawns miners to harvest from remote, owned, or sourcekeeper energy deposits. Standard mining actions have been
 * heavily CPU-optimized
 */
@profile
export class MiningOverlord extends Overlord {

	directive: DirectiveHarvest;
	room: Room | undefined;
	source: Source | undefined;
	container: StructureContainer | undefined;
	link: StructureLink | undefined;
	constructionSiteContainer: ConstructionSite | undefined;
	constructionSiteLink: ConstructionSite | undefined;
	harvestPos: RoomPosition | undefined;
	miners: Zerg[];
	energyPerTick: number;
	miningPowerNeeded: number;
	mode: 'early' | 'SK' | 'link' | 'standard';
	setup: CreepSetup;
	minersNeeded: number;

	static settings = {
		minLinkDistance : 10,
		dropMineUntilRCL: 2,
	};

	constructor(directive: DirectiveHarvest, priority: number) {
		super(directive, 'mine', priority);
		this.directive = directive;
		this.priority += this.outpostIndex * OverlordPriority.remoteRoom.roomIncrement;
		this.miners = this.zerg(Roles.drone);
		// Populate structures
		this.populateStructures();
		// Compute energy output
		if (Cartographer.roomType(this.pos.roomName) == ROOMTYPE_SOURCEKEEPER) {
			this.energyPerTick = SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME;
		} else if (this.colony.level >= DirectiveOutpost.settings.canSpawnReserversAtRCL) {
			this.energyPerTick = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME;
		} else {
			this.energyPerTick = SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME;
		}
		this.miningPowerNeeded = Math.ceil(this.energyPerTick / HARVEST_POWER) + 1;
		// Decide operating mode
		if (Cartographer.roomType(this.pos.roomName) == ROOMTYPE_SOURCEKEEPER) {
			this.mode = 'SK';
			this.setup = Setups.drones.miners.sourceKeeper;
		} else if (this.colony.room.energyCapacityAvailable < StandardMinerSetupCost) {
			this.mode = 'early';
			this.setup = Setups.drones.miners.default;
		} else if (this.link) {
			this.mode = 'link';
			this.setup = Setups.drones.miners.default;
		} else {
			this.mode = 'standard';
			this.setup = Game.cpu.limit < 20 ? Setups.drones.miners.double : Setups.drones.miners.standard;
		}
		const miningPowerEach = this.setup.getBodyPotential(WORK, this.colony);
		this.minersNeeded = Math.min(Math.ceil(this.miningPowerNeeded / miningPowerEach),
									 this.pos.availableNeighbors(true).length);
		// Allow drop mining at low levels
		if (this.mode != 'early' && this.colony.level >= MiningOverlord.settings.dropMineUntilRCL) {
			this.refreshHarvestPos();
		}
	}

	get distance(): number {
		return this.directive.distance;
	}

	private populateStructures() {
		if (Game.rooms[this.pos.roomName]) {
			this.source = _.first(this.pos.lookFor(LOOK_SOURCES));
			// 为了建设 container 和 link
			// TODO: 精确传递 instead of finding
			if (this.directive.memory[_HARVEST_MEM_DIRECTION]) {
				const pos = this.pos.getPositionAtDirection(this.directive.memory[_HARVEST_MEM_DIRECTION]);
				this.container = pos.lookForStructure(STRUCTURE_CONTAINER) as StructureContainer | undefined;
				if (!this.container) {
					this.constructionSiteContainer = pos.lookFor(LOOK_CONSTRUCTION_SITES).find(
						s=>s.structureType == STRUCTURE_CONTAINER
					)
				}
			}
			// 节约 find 的 CPU
			if (this.pos.room?.controller?.my && this.pos.room.controller.level >= 6) {
				this.link = this.pos.findClosestByLimitedRange(this.colony.availableLinks, 2);
				if (!this.link) {
					this.constructionSiteLink = _.find(
						this.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2), 
						s=>s.structureType == STRUCTURE_LINK
					);
				}
			}
		}
	}

	refresh() {
		if (!this.room && Game.rooms[this.pos.roomName]) { // if you just gained vision of this room
			this.populateStructures();
		}
		super.refresh();
		$.refresh(this, 'source', 'container', 'link', 'constructionSiteContainer', 'constructionSiteLink');
	}

	private refreshHarvestPos(): void {
		if (this.container) {
			this.harvestPos = this.container.pos;
		} 
		// else if (this.link) {
		// 	this.harvestPos = _.find(this.link.pos.availableNeighbors(true),
		// 							 pos => pos.getRangeTo(this) == 1);
		// } 
		// principle: it is likely that miner pos or cached pos is near to link.
		// counter-example: miner somehow has a non-closest pos (before singled) and recorded
		if (!this.harvestPos) {
			this.harvestPos = _.find(this.miners, m=>m.pos.isNearTo(this.pos))?.pos;
		}
		// Sync memory
		if (this.harvestPos) {
			this.directive.memory[_HARVEST_MEM_DIRECTION] = this.pos.getDirectionTo(this.harvestPos);
		} else if (this.directive.memory[_HARVEST_MEM_DIRECTION]) {
			const pos = this.pos.getPositionAtDirection(this.directive.memory[_HARVEST_MEM_DIRECTION]);
			if (pos.isWalkable(false)) this.harvestPos = pos;
		}
	}

	/**
	 * Add or remove containers as needed to keep exactly one of contaner | link
	 */
	private addRemoveContainer(): void {
		if (this.room?.controller?.reservation && this.room?.controller?.reservation.username != getUsername()) {
			return;
		}
		// Create container if there is not already one being built and no link
		if (!this.container && !this.constructionSiteContainer && !this.constructionSiteLink && !this.link) {
			this.refreshHarvestPos();
			if (!this.harvestPos) return;
			const container = this.harvestPos.lookForStructure(STRUCTURE_CONTAINER) as StructureContainer | undefined;
			if (container) {
				log.info(`${this.print}: discovered harvest container at ${this.harvestPos.print}`);
				this.container = container;
				return;
			}
			log.info(`${this.print}: will build harvest container at ${this.harvestPos.print}`);
			const result = this.harvestPos.createConstructionSite(STRUCTURE_CONTAINER);
			if (result != OK) {
				log.error(`${this.print}: failed to build harvest container at ${this.harvestPos.print}. Result: ${result}`);
			}
			return;
		}
		// Destroy container if link is nearby
		if (this.container && (this.link || this.constructionSiteLink)) {
			// Exclude other containers
			if (this.colony.hatchery && this.container.pos.getRangeTo(this.colony.hatchery) > 2) {
				log.info(`${this.print}: container and link present; destroying container at ${this.container.pos.print}`);
				this.container.destroy();
			}
		}
		// Destroy container construction site if link construction site is present
		if (this.constructionSiteContainer && (this.link || this.constructionSiteLink)) {
			this.constructionSiteContainer.remove();
		}
	}

	private registerEnergyRequests(): void {
		if (this.container) {
			const transportCapacity = 200 * this.colony.level;
			const threshold = this.colony.stage > ColonyStage.Larva ? 0.8 : 0.5;
			if (_.sum(_.values(this.container.store)) > threshold * transportCapacity) {
				this.colony.logisticsNetwork.requestOutput(this.container, {
					resourceType: 'all',
					dAmountdt   : this.energyPerTick
				});
			}
		}
		if (this.link) {
			// If the link will be full with next deposit from the miner
			const minerCapacity = 150;
			if (this.link.energy + minerCapacity > this.link.energyCapacity) {
				this.colony.linkNetwork.requestTransmit(this.link);
			}
		}
	}

	init() {
		this.wishlist(this.minersNeeded, this.setup, {reassignIdle: true, prespawn: 0});
		this.registerEnergyRequests();
	}

	/**
	 * Suicide outdated miners when their replacements arrive
	 */
	private suicideOldMiners(): boolean {
		if (this.miners.length > this.minersNeeded && this.source) {
			// if you have multiple miners and the source is visible
			const targetPos = this.harvestPos || this.source.pos;
			const minersNearSource = _.filter(this.miners,
											miner => miner.pos.getRangeTo(targetPos) <= SUICIDE_CHECK_FREQUENCY);
			if (minersNearSource.length > this.minersNeeded) {
				// if you have more miners by the source than you need
				const oldestMiner = minBy(minersNearSource, miner => miner.ticksToLive || 9999);
				if (oldestMiner && (oldestMiner.ticksToLive || 9999) < MINER_SUICIDE_THRESHOLD) {
					// if the oldest miner will die sufficiently soon
					oldestMiner.suicide();
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Actions for handling link mining
	 */
	private linkMiningActions(miner: Zerg) {
		if (this.link) {
			if (miner.carry.energy > 0.9 * miner.carryCapacity) {
				if (!miner.pos.isNearTo(this.link)) {
					miner.goTo(this.link, {range: 1});
				} else {
					miner.transfer(this.link, RESOURCE_ENERGY);
					this.refreshHarvestPos();
				}
				return;
			}
		} else {
			log.warning(`Link miner ${miner.print} has no link!`);
		}

		// Approach mining site
		if (this.goToMiningSite(miner)) return;
		miner.harvest(this.source!);
	}

	/**
	 * Actions for handling mining at RCL high enough to spawn ideal miner body to saturate source
	 */
	private standardMiningActions(miner: Zerg) {

		// Approach mining site
		if (this.goToMiningSite(miner)) return;

		// Container mining
		if (this.container) {
			if (this.container.hits < this.container.hitsMax
				&& miner.carry.energy >= Math.min(miner.carryCapacity, REPAIR_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.repair(this.container);
			} else if (this.container.store.getFreeCapacity(RESOURCE_ENERGY)) {
				return miner.harvest(this.source!);
			}
		}

		// Build output site
		const site = this.constructionSiteLink || this.constructionSiteContainer;
		if (site) {
			if (miner.carry.energy >= Math.min(miner.carryCapacity, BUILD_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.build(site);
			} else {
				return miner.harvest(this.source!);
			}
		}

		// Drop mining
		miner.harvest(this.source!);
		if (miner.carry.energy > 0.8 * miner.carryCapacity) { // move over the drop when you're close to full
			const biggestDrop = maxBy(miner.pos.findInRange(miner.room.droppedEnergy, 1), drop => drop.amount);
			if (biggestDrop) {
				miner.goTo(biggestDrop);
			}
		}
		if (miner.carry.energy == miner.carryCapacity) { // drop when you are full
			miner.drop(RESOURCE_ENERGY);
		}
		return;
	}

	/**
	 * Move onto harvesting position or near to source (depending on early/standard mode)
	 */
	private goToMiningSite(miner: Zerg): boolean {
		let moveOptions: MoveOptions = {
			waypoints : this.room && this.room.name == miner.room.name ? undefined : this.directive.waypoints, 
			maxCost: 233,
		};

		if (this.harvestPos && this.miners.length <= 1) {
			if (!miner.pos.inRangeToPos(this.harvestPos, 0)) {
				moveOptions.range = 0;
				miner.goTo(this.harvestPos, moveOptions);
				return true;
			}
		} else {
			if (!miner.pos.inRangeToPos(this.pos, 1)) {
				moveOptions.range = 1;
				moveOptions.ignoreCreeps = false;
				miner.goTo(this, moveOptions);
				return true;
			} else {
				this.refreshHarvestPos();
			}
		}
		return false;
	}

	private handleMiner(miner: Zerg) {
		// Flee hostiles
		if(miner.pos.roomName == this.colony.name || !this.room || miner.pos.roomName == this.room.name) {
			if (miner.flee(miner.room.fleeDefaults, {dropEnergy: true})) {
				return;
			}
		} else { // Don't be afraid of NPCs during the route
			if (miner.flee(miner.room.playerHostiles, {dropEnergy: true})) {
				return;
			}
		}
		if (this.mode == 'link') {
			return this.linkMiningActions(miner);
		} else {
			return this.standardMiningActions(miner);
		}
	}

	run() {
		for (const miner of this.miners) {
			this.handleMiner(miner);
		}
		if (this.room && Game.time % BUILD_OUTPUT_FREQUENCY == this.pos.x) {
			this.addRemoveContainer();
		} else if (this.harvestPos && !this.container && !this.link && !this.constructionSiteContainer && !this.constructionSiteLink) {
			this.populateStructures();
		}
		if (Game.time % SUICIDE_CHECK_FREQUENCY == 0) {
			this.suicideOldMiners();
		}
	}
}
