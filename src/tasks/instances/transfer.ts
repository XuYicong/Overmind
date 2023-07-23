import {EnergyStructure, isEnergyStructure, isStoreStructure, StoreStructure} from '../../declarations/typeGuards';
import {profile} from '../../profiler/decorator';
import {Task} from '../Task';


export type transferTargetType =
	EnergyStructure
	| StoreStructure
	| StructureLab
	| StructureNuker
	| StructurePowerSpawn
	| Creep;

export const transferTaskName = 'transfer';

@profile
export class TaskTransfer extends Task {

	public get target(): transferTargetType {
		return <transferTargetType>super.target;
	}

	data: {
		resourceType: ResourceConstant
		amount: number | undefined
	};

	constructor(target: transferTargetType,
				resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number, options = {} as TaskOptions) {
		super(transferTaskName, target, options);
		// Settings
		this.settings.oneShot = true;
		this.data.resourceType = resourceType;
		this.data.amount = amount;
	}

	isValidTask() {
		const amount = this.data.amount || 1;
		const resourcesInCarry = this.creep.carry[this.data.resourceType] || 0;
		return resourcesInCarry >= amount;
	}

	isValidTarget() {
		const amount = this.data.amount || 1;
		const target = this.target;
		if (target instanceof Creep || isStoreStructure(target)) {
			return _.sum(_.values(target.store)) <= target.store.getCapacity() - amount;
		} else if (isEnergyStructure(target) && this.data.resourceType == RESOURCE_ENERGY) {
			return target.energy <= target.energyCapacity - amount;
		} else {
			if (target instanceof StructureLab) {
				const type = target.mineralType;
				return (type == this.data.resourceType || !type) &&
					   target.store[type || RESOURCE_GHODIUM] <= target.store.getCapacity(type || RESOURCE_GHODIUM) - amount;
			} else if (target instanceof StructureNuker) {
				return this.data.resourceType == RESOURCE_GHODIUM &&
					   target.store[RESOURCE_GHODIUM] <= target.store.getCapacity(RESOURCE_GHODIUM) - amount;
			} else if (target instanceof StructurePowerSpawn) {
				return this.data.resourceType == RESOURCE_POWER &&
					   target.store[RESOURCE_POWER] <= target.store.getCapacity(RESOURCE_POWER) - amount;
			}
		}
		return false;
	}

	work() {
		return this.creep.transfer(this.target, this.data.resourceType, this.data.amount);
	}
}
