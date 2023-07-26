import {hasGeneralPurposeStore} from '../../declarations/typeGuards';
import {HaulingOverlord} from '../../overlords/situational/hauler';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {log} from '../../console/log';
import { ShardVisibilityScoutOverlord } from 'overlords/scouting/shardVisibility';

interface DirectiveHaulMemory extends FlagMemory {
	totalResources?: number;
}


/**
 * Hauling directive: spawns hauler creeps to move large amounts of resourecs from a location (e.g. draining a storage)
 */
@profile
export class DirectiveHaul extends Directive {

	static directiveName = 'haul';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_BLUE;
	private _store: StoreDefinition | { [resourceType: string]: number };
	private _drops: { [resourceType: string]: Resource[] };

	memory: DirectiveHaulMemory;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.haul = new HaulingOverlord(this);
		this.overlords.shardVisibility = new ShardVisibilityScoutOverlord(this);
	}

	get targetedBy(): string[] {
		return Overmind.cache.targets[this.ref];
	}

	get drops(): { [resourceType: string]: Resource[] } {
		if (!this.pos.isVisible) {
			return {};
		}
		if (!this._drops) {
			const drops = (this.pos.lookFor(LOOK_RESOURCES) || []) as Resource[];
			this._drops = _.groupBy(drops, drop => drop.resourceType);
		}
		return this._drops;
	}

	get hasDrops(): boolean {
		return _.keys(this.drops).length > 0;
	}

	get storeStructure(): StructureStorage | StructureTerminal | StructureNuker | StructureContainer 
									| Ruin | Tombstone |StructureExtension | StructureFactory | undefined {
		if (this.pos.isVisible) {
			return <Ruin>this.pos.lookFor(LOOK_RUINS).filter(ruin => ruin.store.getUsedCapacity() > 0)[0] ||
					<Tombstone>this.pos.lookFor(LOOK_TOMBSTONES).filter(tomb => tomb.store.getUsedCapacity() > 0)[0] ||
					<StructureStorage>this.pos.lookForStructure(STRUCTURE_STORAGE) ||
				   <StructureTerminal>this.pos.lookForStructure(STRUCTURE_TERMINAL) ||
				   <StructureNuker>this.pos.lookForStructure(STRUCTURE_NUKER) ||
				   <StructureContainer>this.pos.lookForStructure(STRUCTURE_CONTAINER) ||
				   <StructureFactory>this.pos.lookForStructure(STRUCTURE_FACTORY) ||
				   <StructureExtension>this.pos.lookForStructure(STRUCTURE_EXTENSION);
		}
		return undefined;
	}

	get store(): StoreDefinition | { [resourceType: string]: number } {
		if (!this._store) {
			// Merge the "storage" of drops with the store of structure
			let store: StoreDefinition | { [resourceType: string]: number };
			if (this.storeStructure) {
				store = this.storeStructure.store;
			} else {
				store = {energy: 0};
				// log.info('store target with specific type not found');
			}
			// Merge with drops
			for (const resourceType of _.keys(this.drops)) {
				const typeConstant = <ResourceConstant>resourceType;
				const totalResourceAmount = _.sum(this.drops[resourceType], drop => drop.amount);
				if (store[typeConstant]) {
					store[typeConstant] += totalResourceAmount;
				} else {
					store[typeConstant] = totalResourceAmount;
				}
			}
			this._store = store;
		}
		return this._store;
	}

	/**
	 * Total amount of resources remaining to be transported; cached into memory in case room loses visibility
	 */
	get totalResources(): number {
		if (this.pos.isVisible) {
			this.memory.totalResources = _.sum(_.values(this.store)); // update total amount remaining
		} else {
			if (this.memory.totalResources == undefined) {
				return 1000; // pick some non-zero number so that haulers will spawn
			}
		}
		return this.memory.totalResources;
	}

	init(): void {
		this.alert(`Haul directive active - ${this.totalResources}`);
	}

	run(): void {
		// if neither haulers nor target has resource, end the directive
		if (this.totalResources > 0) {
			return;
		}
		for (const hauler of (this.overlords.haul as HaulingOverlord).haulers) {
			if(hauler.carry.getUsedCapacity() > 0) return;
		}
		// Or if there are creeps in other shards
		if(this.overlords.haul.isSuspended) return;
		this.remove();
	}

}

