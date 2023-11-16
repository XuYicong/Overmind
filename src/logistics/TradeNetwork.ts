import { NotifierPriority } from 'directives/Notifier';
import { log } from '../console/log';
import { Mem } from '../memory/Memory';
import { profile } from '../profiler/decorator';
import { alignedNewline, bullet, leftArrow, rightArrow } from '../utilities/stringConstants';
import { maxBy, minBy, onPublicServer, printRoomName } from '../utilities/utils';

interface MarketCache {
	sell: { [resourceType: string]: { high: number, low: number } };
	buy: { [resourceType: string]: { high: number, low: number } };
	tick: number;
}

interface TraderMemory {
	cache: MarketCache;
	equalizeIndex: number;
}

interface TraderStats {
	credits: number;
	bought: {
		[resourceType: string]: {
			amount: number,
			credits: number,
		}
	};
	sold: {
		[resourceType: string]: {
			amount: number,
			credits: number,
		}
	};
}

const TraderMemoryDefaults: TraderMemory = {
	cache: {
		sell: {},
		buy: {},
		tick: 0,
	},
	equalizeIndex: 0
};

const TraderStatsDefaults: TraderStats = {
	credits: 0,
	bought: {},
	sold: {},
};

// Maximum prices I'm willing to pay to buy various resources - based on shard3 market data in October 2023
// (might not always be up to date)
export const maxMarketPrices: { [resourceType: string]: number } = {
	default: 5.0,
	[RESOURCE_HYDROGEN]: 20,
	[RESOURCE_OXYGEN]: 50,
	[RESOURCE_UTRIUM]: 60,
	[RESOURCE_LEMERGIUM]: 25,
	[RESOURCE_KEANIUM]: 15,
	[RESOURCE_ZYNTHIUM]: 50,
	[RESOURCE_CATALYST]: 50,
	[RESOURCE_ENERGY]: 12,
};
// TODO: decide by room owner instead of room name
export const hostileTraders = [
	'W6S39',	// OneWayIsWar
	'E4S49',	// OneWayIsWar
	'E1S44',	// OneWayIsWar
	'E46S51',	// OneWayIsWar
];

export const MAX_ENERGY_SELL_ORDERS = 5;
export const MAX_ENERGY_BUY_ORDERS = 5;


/**
 * The trade network controls resource acquisition and disposal on the player market.
 */
@profile
export class TraderJoe implements ITradeNetwork {

	static settings = {
		cache: {
			timeout: 25,
		},
		market: {
			reserveCredits: 114514,	// Always try to stay above this amount
			boostCredits: 1919810,	// You can buy boosts directly off market while above this amount
			energyCredits: 233333, 	// Can buy energy off market if above this amount
			orders: {
				timeout: 100000,	// Remove orders after this many ticks if remaining amount < cleanupAmount
				cleanupAmount: 10,		// RemainingAmount threshold to remove expiring orders
			}
		},
	};

	memory: TraderMemory;
	stats: TraderStats;
	private notifications: string[];

	constructor() {
		this.memory = Mem.wrap(Memory.Overmind, 'trader', TraderMemoryDefaults, true);
		this.stats = Mem.wrap(Memory.stats.persistent, 'trader', TraderStatsDefaults);
		this.notifications = [];
	}

	refresh() {
		this.memory = Mem.wrap(Memory.Overmind, 'trader', TraderMemoryDefaults, true);
		this.stats = Mem.wrap(Memory.stats.persistent, 'trader', TraderStatsDefaults);
		this.notifications = [];
	}

	private notify(msg: string, roomName = ""): void {
		if(roomName){
			this.notifications.push(bullet + msg + ';' + roomName);
		} else {
			this.notifications.push(bullet + msg);
		}
	}

	/**
	 * Builds a cache for market - this is very expensive; use infrequently
	 */
	private buildMarketCache(verbose = false, orderThreshold = 1000): void {
		this.invalidateMarketCache();
		// Do not cache this lot in memory if cpu is limited
		if(Game.cpu.limit < 5) return;
		const myActiveOrderIDs = _.map(_.filter(Game.market.orders, order => !!order.active), order => order.id);
		const allOrders = Game.market.getAllOrders(order => !myActiveOrderIDs.includes(order.id) &&
			order.amount >= orderThreshold); // don't include tiny orders
		const groupedBuyOrders = _.groupBy(_.filter(allOrders, o => o.type == ORDER_BUY), o => o.resourceType);
		const groupedSellOrders = _.groupBy(_.filter(allOrders, o => o.type == ORDER_SELL), o => o.resourceType);
		for (const resourceType in groupedBuyOrders) {
			// Store buy order with maximum price in cache
			const prices = _.map(groupedBuyOrders[resourceType], o => o.price);
			const high = _.max(prices)!;
			const low = _.min(prices)!;
			if (verbose) console.log(`${resourceType} BUY: high: ${high}  low: ${low}`);
			// this.memory.cache.buy[resourceType] = minBy(groupedBuyOrders[resourceType], (o:Order) => -1 * o.price);
			this.memory.cache.buy[resourceType] = { high: high, low: low };
		}
		for (const resourceType in groupedSellOrders) {
			// Store sell order with minimum price in cache
			const prices = _.map(groupedSellOrders[resourceType], o => o.price);
			const high = _.max(prices)!;
			const low = _.min(prices)!;
			if (verbose) console.log(`${resourceType} SELL: high: ${high}  low: ${low}`);
			// this.memory.cache.sell[resourceType] = minBy(groupedSellOrders[resourceType], (o:Order) => o.price);
			this.memory.cache.sell[resourceType] = { high: high, low: low };
		}
		this.memory.cache.tick = Game.time;
	}

	private invalidateMarketCache(): void {
		this.memory.cache = {
			sell: {},
			buy: {},
			tick: 0,
		};
	}

	/**
	 * Cost per unit including transfer price with energy converted to credits
	 */
	private effectivePrice(order: Order, terminal: StructureTerminal): number {
		if (order.roomName) {
			const transferCost = Game.market.calcTransactionCost(1000, order.roomName, terminal.room.name) / 1000;
			const energyToCreditMultiplier = 0.01; // this.cache.sell[RESOURCE_ENERGY] * 1.5;
			return order.price + transferCost * energyToCreditMultiplier;
		} else {
			return Infinity;
		}
	}

	/**
	 * Cost per unit for a buy order including transfer price with energy converted to credits
	 */
	private effectiveBuyPrice(order: Order, terminal: StructureTerminal): number {
		if (order.roomName) {
			const transferCost = Game.market.calcTransactionCost(1000, order.roomName, terminal.room.name) / 1000;
			const energyToCreditMultiplier = 0.01; // this.cache.sell[RESOURCE_ENERGY] * 1.5;
			return order.price - transferCost * energyToCreditMultiplier;
		} else {
			return Infinity;
		}
	}

	// private getBestOrder(mineralType: ResourceConstant, type: 'buy' | 'sell'): Order | undefined {
	// 	let cachedOrder = this.memory.cache[type][mineralType];
	// 	if (cachedOrder) {
	// 		let order = Game.market.getOrderById(cachedOrder.id);
	// 		if (order) {
	// 			// Update the order in memory
	// 			this.memory.cache[type][mineralType] = order;
	// 		}
	// 	}
	// }

	private cleanUpInactiveOrders() {
		// Clean up sell orders that have expired or orders belonging to rooms no longer owned
		const ordersToClean = _.filter(Game.market.orders, o =>!!(
			(o.type == ORDER_SELL && o.active == false && o.remainingAmount == 0)		// if order is expired, or
			|| (Game.time - o.created > TraderJoe.settings.market.orders.timeout		// order is old and almost done
				&& o.remainingAmount < TraderJoe.settings.market.orders.cleanupAmount)
			|| (o.roomName && !Overmind.colonies[o.roomName])));							// order placed from dead colony
		for (const order of ordersToClean) {
			Game.market.cancelOrder(order.id);
		}
	}

	/**
	 * Opportunistically sells resources when the buy price is higher than current market sell low price
	 */
	lookForGoodDeals(terminal: StructureTerminal, resource: ResourceConstant, margin = 1.25): void {
		if (Game.market.credits < TraderJoe.settings.market.reserveCredits) {
			return;
		}
		let amount = 5000;
		if (resource === RESOURCE_POWER) {
			amount = 100;
		}
		let ordersForMineral = Game.market.getAllOrders({ resourceType: resource, type: ORDER_BUY });
		ordersForMineral = _.filter(ordersForMineral, order => order.amount >= amount);
		if (ordersForMineral === undefined) {
			return;
		}
		const marketLow = this.memory.cache.sell[resource] ? this.memory.cache.sell[resource].low : undefined;
		if (marketLow == undefined) {
			return;
		}
		const order = maxBy(ordersForMineral, order => this.effectiveBuyPrice(order, terminal));
		if (order && order.price > marketLow * margin) {
			const amount = Math.min(order.amount, 10000);
			const cost = Game.market.calcTransactionCost(amount, terminal.room.name, order.roomName!);
			if (terminal.store[RESOURCE_ENERGY] > cost) {
				const response = Game.market.deal(order.id, amount, terminal.room.name);
				this.logTransaction(order, terminal.room.name, amount, response);
			}
		}
	}

	/**
	 * Buy a resource on the market
	 */
	buy(terminal: StructureTerminal, resource: ResourceConstant, amount: number): void {
		if (Game.market.credits < TraderJoe.settings.market.reserveCredits || terminal.cooldown > 0) {
			return;
		}
		amount = Math.max(amount, TERMINAL_MIN_SEND);
		if (terminal.store[RESOURCE_ENERGY] < 10000 || terminal.store.getUsedCapacity() < amount) {
			return;
		}
		let ordersForMineral = Game.market.getAllOrders({ resourceType: resource, type: ORDER_SELL });
		ordersForMineral = _.filter(ordersForMineral, order => order.amount >= amount);
		const bestOrder = minBy(ordersForMineral, (order: Order) => order.price);
		let maxPrice = maxMarketPrices[resource] || maxMarketPrices.default;
		if (!onPublicServer()) {
			maxPrice = Infinity; // don't care about price limits if on private server
		}
		if (bestOrder && bestOrder.price <= maxPrice) {
			const response = Game.market.deal(bestOrder.id, amount, terminal.room.name);
			this.logTransaction(bestOrder, terminal.room.name, amount, response);
		}
	}

	/**
	 * Sell a resource on the market, either through a sell order or directly
	 */
	sell(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
		maxOrdersOfType = Infinity): number | undefined {
		if (Game.market.credits < TraderJoe.settings.market.reserveCredits) {
			return this.sellDirectly(terminal, resource, amount);
		} else {
			this.maintainSellOrder(terminal, resource, amount, maxOrdersOfType);
		}
	}

	/**
	 * Sell resources directly to a buyer rather than making a sell order
	 */
	sellDirectly(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
		flexibleAmount = true): number | undefined {
		// If flexibleAmount is allowed, consider selling to orders which don't need the full amount
		const minAmount = flexibleAmount ? TERMINAL_MIN_SEND : amount;
		let ordersForMineral = Game.market.getAllOrders({ resourceType: resource, type: ORDER_BUY });
		ordersForMineral = _.filter(ordersForMineral, order => 
			order.amount >= minAmount && (!order.roomName || !hostileTraders.includes(order.roomName))
		);
		const order = maxBy(ordersForMineral, order => this.effectiveBuyPrice(order, terminal));
		if (order) {
			const sellAmount = Math.min(order.amount, amount);
			const cost = Game.market.calcTransactionCost(sellAmount, terminal.room.name, order.roomName!);
			if (terminal.store[RESOURCE_ENERGY] > cost) {
				const response = Game.market.deal(order.id, sellAmount, terminal.room.name);
				this.logTransaction(order, terminal.room.name, amount, response);
				return response;
			}
		}
	}

	/**
	 * Create or maintain a buy order
	 */
	maintainBuyOrder(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
		maxOrdersOfType = Infinity): void {
		this.maintainOrder(terminal, ORDER_BUY, resource, amount, maxOrdersOfType);
	}

	/**
	 * Create or maintain a sell order
	 */
	private maintainSellOrder(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
		maxOrdersOfType = Infinity): void {
			this.maintainOrder(terminal, ORDER_SELL, resource, amount, maxOrdersOfType);
	}

	/**
	 * Create or maintain an order, extending and repricing as needed
	 */
	private maintainOrder(terminal: StructureTerminal, type: ORDER_BUY | ORDER_SELL,
		resource: ResourceConstant, amount: number, maxOrdersOfType = Infinity): void {
		this.notify(`maintain ${type} order: ${amount} ${resource}`, terminal.room.name);
		// Cap the amount based on the maximum you can make a buy/sell order with
		amount = Math.min(amount, 8000);

		const marketLow = this.memory.cache.sell[resource] ? this.memory.cache.sell[resource].low : undefined;
		if (!marketLow) {
			return;
		}
		const marketHigh = this.memory.cache.buy[resource] ? this.memory.cache.buy[resource].high : undefined;
		if (!marketHigh) {
			return;
		}
		const maxPrice = maxMarketPrices[resource] || maxMarketPrices.default;
		if (marketHigh > maxPrice) {
			return;
		}
		// Compute the buy or sell price
		const price = +(type == ORDER_BUY ? marketHigh : marketLow
			.toFixed(3)); // market only allows for 3 decimal places of precision
		if (price == Infinity || price == 0) {
			log.warning(`TradeNetwork: sanity checks not passed to create ${type} order ${resource} in ` +
				`${printRoomName(terminal.room.name)}!`);
			return;
		}
		const existingOrder = _.find(Game.market.orders,
			o => o.type == type &&
				o.resourceType == resource &&
				o.roomName == terminal.room.name);

		// Maintain an existing order
		if (existingOrder) {
			const ratio = existingOrder.price / price;
			const tolerance = 0.03; // might need to tune this, we'll see
			const normalFluctuation = (1 + tolerance > ratio && ratio > 1 - tolerance);

			// Extend the order if you need to sell more of the resource
			if (amount > existingOrder.remainingAmount && normalFluctuation) {
				const addAmount = amount - existingOrder.remainingAmount;
				const ret = Game.market.extendOrder(existingOrder.id, addAmount);
				this.notify(`${terminal.room.print}: extending ${type} order for ${resource} by ${addAmount}.` +
					` Response: ${ret}`);
				return;
			}

			// Small chance of changing the price if it's not competitive; don't do too often or you are high risk
			if (!normalFluctuation && Math.random() < 1 / 2000) {
				const ret = Game.market.changeOrderPrice(existingOrder.id, price);
				this.notify(`${terminal.room.print}: changing ${type} order price for ${resource} from ` +
					`${existingOrder.price} to ${price}. Response: ${ret}`);
				return;
			}

			// No action needed
			return;
		}
		// Create a new order
		else {
			// Only place up to a certain amount of orders
			const existingOrdersForThis = _.filter(Game.market.orders, o => o.type == type && o.resourceType == resource);
			if (existingOrdersForThis.length > maxOrdersOfType) {
				this.notify(`${printRoomName(terminal.room.name)}: could not create ${type} order for ` +
					`${Math.round(amount)} ${resource} - too many existing!`);
				return;
			}

			// Create the order
			const params = {
				type: type,
				resourceType: resource,
				price: price,
				totalAmount: amount,
				roomName: terminal.room.name
			};
			const ret = Game.market.createOrder(params);
			let msg = '';
			if (type == ORDER_BUY) {
				msg += `${printRoomName(terminal.room.name)} creating buy order:  ` +
					`${Math.round(amount)} ${resource} at price ${price.toFixed(4)}`;
			} else {
				msg += `${printRoomName(terminal.room.name)} creating sell order: ` +
					`${Math.round(amount)} ${resource} at price ${price.toFixed(4)}`;
			}
			if (ret == OK) {
				this.notify('Xyct: order OK');
			} else {
				msg += ` ERROR: ${ret}`;
			}
			this.notify(msg);
			return;

		}

	}

	priceOf(mineralType: ResourceConstant): number {
		if (this.memory.cache.sell[mineralType]) {
			return this.memory.cache.sell[mineralType].low;
		} else {
			return Infinity;
		}
	}

	/**
	 * Pretty-prints transaction information in the console
	 */
	private logTransaction(order: Order, terminalRoomName: string, amount: number, response: number): void {
		const action = order.type == ORDER_SELL ? 'BOUGHT ' : 'SOLD   ';
		const cost = (order.price * amount).toFixed(2);
		const fee = order.roomName ? Game.market.calcTransactionCost(amount, order.roomName, terminalRoomName) : 0;
		const roomName = Game.rooms[terminalRoomName] ? Game.rooms[terminalRoomName].print : terminalRoomName;
		let msg: string;
		if (order.type == ORDER_SELL) {
			msg = `${roomName} ${leftArrow} ${amount} ${order.resourceType} ${leftArrow} ` +
				`${printRoomName(order.roomName!)} (result: ${response})`;
		} else {
			msg = `${roomName} ${rightArrow} ${amount} ${order.resourceType} ${rightArrow} ` +
				`${printRoomName(order.roomName!)} (result: ${response})`;
		}
		this.notify(msg);
	}

	/**
	 * Look through transactions happening on the previous tick and record stats
	 */
	private recordStats(): void {
		this.stats.credits = Game.market.credits;
		const time = Game.time - 1;
		// Incoming transactions
		for (const transaction of Game.market.incomingTransactions) {
			if (transaction.time < time) {
				break; // only look at things from last tick
			} else {
				if (transaction.order) {
					const resourceType = transaction.resourceType;
					const amount = transaction.amount;
					const price = transaction.order.price;
					if (!this.stats.bought[resourceType]) {
						this.stats.bought[resourceType] = { amount: 0, credits: 0 };
					}
					this.stats.bought[resourceType].amount += amount;
					this.stats.bought[resourceType].credits += amount * price;
				}
			}
		}
		// Outgoing transactions
		for (const transaction of Game.market.outgoingTransactions) {
			if (transaction.time < time) {
				break; // only look at things from last tick
			} else {
				if (transaction.order) {
					const resourceType = transaction.resourceType;
					const amount = transaction.amount;
					const price = transaction.order.price;
					if (!this.stats.sold[resourceType]) {
						this.stats.sold[resourceType] = { amount: 0, credits: 0 };
					}
					this.stats.sold[resourceType].amount += amount;
					this.stats.sold[resourceType].credits += amount * price;
				}
			}
		}
	}


	init(): void {
		if (Game.time - (this.memory.cache.tick || 0) > TraderJoe.settings.cache.timeout) {
			this.buildMarketCache();
		}
	}

	run(): void {
		if (Game.time % 10 == 0) {
			this.cleanUpInactiveOrders();
		}
		if (this.notifications.length > 0) {
			for(const notification of this.notifications) {
				if(notification.includes(';')) {
					Overmind.overseer.notifier.alert(`Trade network activity: ` + notification.split(';')[0],
						notification.split(';')[1], NotifierPriority.Low);
				} else {
					log.info(`Trade network activity: ` + alignedNewline + notification);
				}
			}
			// log.info(`Trade network activity: ` + alignedNewline + this.notifications.join(alignedNewline));
		}
		this.recordStats();
	}

}
