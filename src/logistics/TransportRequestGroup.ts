// A stripped-down version of the logistics network intended for local deliveries

import {log} from '../console/log';
import {blankPriorityQueue, Priority} from '../priorities/priorities';
import {profile} from '../profiler/decorator';

export type TransportRequestTarget = AnyStoreStructure;

export interface TransportRequest {
	target: TransportRequestTarget;
	amount: number;
	resourceType: ResourceConstant;
}

interface TransportRequestOptions {
	amount?: number;
	resourceType?: ResourceConstant;
}


/**
 * Transport request groups handle close-range prioritized resource requests, in contrast to the logistics network,
 * which handles longer-ranged requests
 */
@profile
export class TransportRequestGroup {

	supply: { [priority: number]: TransportRequest[] };
	withdraw: { [priority: number]: TransportRequest[] };
	supplyByID: { [id: string]: TransportRequest[] };
	withdrawByID: { [id: string]: TransportRequest[] };

	constructor() {
		this.refresh();
	}

	refresh(): void {
		this.supply = blankPriorityQueue();
		this.withdraw = blankPriorityQueue();
		this.supplyByID = {};
		this.withdrawByID = {};
	}

	get needsSupplying(): boolean {
		for (const priority in this.supply) {
			if (this.supply[priority].length > 0) {
				return true;
			}
		}
		return false;
	}

	get needsWithdrawing(): boolean {
		for (const priority in this.withdraw) {
			if (this.withdraw[priority].length > 0) {
				return true;
			}
		}
		return false;
	}

	popPrioritizedClosestRequest(pos: RoomPosition, type: 'supply' | 'withdraw',
								 filter?: ((requst: TransportRequest) => boolean)): TransportRequest | undefined {
		const requests = type == 'withdraw' ? this.withdraw : this.supply;
		for (const priority in requests) {
			const searchRequests = requests[priority];
			let searchTargets;
			if(filter) {
				searchTargets = _.map(
					_.filter(
						searchRequests,
						req => filter(req)
					),
					request => request.target
				);
			} else {
				searchTargets = _.map(searchRequests, request => request.target);
			}
			const target = pos.findClosestByRangeThenPath(searchTargets);
			if (target) {
				const id = _.findIndex(searchRequests, request => request.target.ref == target.ref);
				const ret = searchRequests[id];
				// Remove the returned value
				const last = searchRequests.pop()!;
				if(id < searchRequests.length) searchRequests[id] = last;
				return ret;
			}
		}
	}

	/**
	 * Request for resources to be deposited into this target
	 */
	requestInput(target: TransportRequestTarget, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
		if(target.targetedBy.length > 0) return; // If this target already been targeted, not enqueueing it again
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
		});
		if (opts.amount == undefined) {
			opts.amount = this.getInputAmount(target, opts.resourceType!);
		}
		// Register the request
		const req: TransportRequest = {
			target      : target,
			resourceType: opts.resourceType!,
			amount      : opts.amount!,
		};
		if (opts.amount > 0) {
			this.supply[priority].push(req);
			if (!this.supplyByID[target.ref]) this.supplyByID[target.ref] = [];
			this.supplyByID[target.ref].push(req);
		}
	}

	/**
	 * Request for resources to be withdrawn from this target
	 */
	requestOutput(target: TransportRequestTarget, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
		if(target.targetedBy.length > 0) return; // If this target already been targeted, not enqueueing it again
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
		});
		if (opts.amount == undefined) {
			opts.amount = this.getOutputAmount(target, opts.resourceType!);
		}
		// Register the request
		const req: TransportRequest = {
			target      : target,
			resourceType: opts.resourceType!,
			amount      : opts.amount!,
		};
		if (opts.amount > 0) {
			this.withdraw[priority].push(req);
			if (!this.withdrawByID[target.ref]) this.withdrawByID[target.ref] = [];
			this.withdrawByID[target.ref].push(req);
		}
	}

	// /* Makes a provide for every resourceType in a requestor object */
	// requestOutputAll(target: StoreStructure, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
	// 	for (let resourceType in target.store) {
	// 		let amount = target.store[<ResourceConstant>resourceType] || 0;
	// 		if (amount > 0) {
	// 			opts.resourceType = <ResourceConstant>resourceType;
	// 			this.requestOutput(target, priority, opts);
	// 		}
	// 	}
	// }

	private getInputAmount(target: TransportRequestTarget, resourceType: ResourceConstant): number {
		const freeCapacity = target.store.getFreeCapacity(resourceType);
		if (freeCapacity == null) {
			log.warning('Could not determine requestor amount!');
			return 0;
		}
		return freeCapacity;
	}

	private getOutputAmount(target: TransportRequestTarget, resourceType: ResourceConstant): number {
		const usedCapacity = target.store.getUsedCapacity(resourceType);
		if (usedCapacity == null) {
			log.warning('Could not determine provider amount!');
			return 0;
		}
		return usedCapacity;
	}

	/**
	 * Summarize the state of the transport request group to the console; useful for debugging.
	 */
	summarize(ignoreEnergy = false): void {
		console.log(`Supply requests ==========================`);
		for (const priority in this.supply) {
			if (this.supply[priority].length > 0) {
				console.log(`Priority: ${priority}`);
			}
			for (const request of this.supply[priority]) {
				if (ignoreEnergy && request.resourceType == RESOURCE_ENERGY) continue;
				console.log(`    targetID: ${request.target.ref}  amount: ${request.amount}  ` +
							`resourceType: ${request.resourceType}`);
			}
		}
		console.log(`Withdraw requests ========================`);
		for (const priority in this.withdraw) {
			if (this.withdraw[priority].length > 0) {
				console.log(`Priority: ${priority}`);
			}
			for (const request of this.withdraw[priority]) {
				if (ignoreEnergy && request.resourceType == RESOURCE_ENERGY) continue;
				console.log(`    targetID: ${request.target.ref}  amount: ${request.amount}  ` +
							`resourceType: ${request.resourceType}`);
			}
		}
	}
}
