import { log } from "console/log";
import { isZerg } from "declarations/typeGuards";
import { CROSSING_PORTAL, MoveOptions } from "movement/Movement";
import { profile } from "profiler/decorator";
import { getPosFromString, onPublicServer } from "utilities/utils";
import { Zerg, normalizeZerg } from "zerg/Zerg";

// The earliest packet to consider receiving, compared to latest received packet
// Receive window should be large enough to tolerate latency caused by cpu throtlle
// While small enough to ignore creeps dieing during portaling
const MAX_RECEIVE_WINDOW = 200;

const getInterShardMemory = function(shard: string): InterShardMemory | null {
    if(!InterShardMemory) return null;
    let raw: string|null;
    if(shard == Game.shard.name) {
        raw = InterShardMemory.getLocal();
    } else {
        raw = InterShardMemory.getRemote(shard);
    }
    if(raw == null) return null;
    return JSON.parse(raw);
}

const setInterShardMemory = function(data: InterShardMemory): void {
    if(!InterShardMemory) return;
    InterShardMemory.setLocal(JSON.stringify(data));
}
/**
 * This class contains methods for coordinating other shards
 */
@profile
export class Overshard implements IOvershard {

    private creeps: Zerg[];         // Creeps that belong to a non-existing colony
    private moveOptions: {
        [name:string]: MoveOptions; // Waypoints for each creep to follow
    };

    constructor() {
        this.creeps = [];
        this.moveOptions = {};
    }

    // When a creep crosses an inter shard portal, send its memory to the target shard
	static sendCreepMemory(creep: Creep, targetShard: string) {
		// Send creep memory to target shard
		let my = getInterShardMemory(Game.shard.name);
		if(my == null) {
			my = InterShardMemory;
		}

		_.defaultsDeep(my, {
			[targetShard]: {
				packets: {
					[Game.time]: {},
				},
				ack: 0
			}
		});
        log.info('Inter shard packet: Sending creep '+creep.name+' to '+targetShard+' with TTL: '+creep.ticksToLive);
        if((creep.ticksToLive || 0) < 9) {
            log.info('Creep is too old to be sent. Ignoring');
            return;
        }
		my[targetShard].packets[Game.time][creep.name] = creep.memory;
        const zerg= normalizeZerg(creep);
        if(isZerg(zerg)) {
            const overlord = zerg.overlord;
            if(overlord != null) {
                // Optimistically suppose the creep will die of age
                overlord.suspendFor(zerg.lifetime);
            }
        } else {
            log.warning('Inter shard packet: Creep to send is not zerg (Why?)');
        }
		setInterShardMemory(my);
	}

	
    // On the start of each tick, receive packets from other shards
	private receiveInterShardPackets(): void {
        // In sim environment or so, no inter shard things
        if(!onPublicServer()) return;
		let my = getInterShardMemory(Game.shard.name);
		if(my == null) {
			my = InterShardMemory;
		}
		for(let i = 0; i <= 3; i++) {
			const shard = 'shard' + i;
			if(shard == Game.shard.name) continue;
			const peer = getInterShardMemory(shard);
			if(peer == null || !peer[Game.shard.name]) continue;

			_.defaultsDeep(my, {
				[shard]: {
					packets: {},
					ack: 0
				}
			});

			// Remove all packets that have been received by peer
			for(const packetTick in my[shard].packets) {
				if(parseInt(packetTick, 10) < peer[Game.shard.name].ack) {
                    log.debug('Inter shard packet: Removing obsolete packets to '+shard+' of tick '+packetTick);
					delete my[shard].packets[packetTick];
				}
			}

			// Receive all peer packets
			let latestPeerTime = my[shard].ack -1;
            // Maintain a receive window to tolerate inter shard latency
            // Packets within [receiveWindow, ack) are handled each tick
            let receiveWindow = 0;
			for(const peerTick in peer[Game.shard.name].packets) {
				const peerPacketTick = parseInt(peerTick, 10);
				// If packet already received, ignore it
				if(peerPacketTick < my[shard].ack) continue;

				for(const creepName in peer[Game.shard.name].packets[peerTick]) {
					// Receive the packet containing creep memory
					const creep = Game.creeps[creepName];
					if(!creep) {
                        receiveWindow = receiveWindow ? Math.min(receiveWindow, peerPacketTick) : peerPacketTick;
                        // TODO: cases where the creep dies while portaling, instead of ignoring all creeps this tick
                        log.debug('Inter shard packet: postponing receiving packet of tick '+peerPacketTick+
                        ', because creep '+creepName+' not appear');
						break;
					}
					if(creep.memory && creep.memory[_MEM.SHARD]) {
						log.warning("Receiving inter shard creep: "+creep.name+
						    " should have empty memory, but got memory with move data "+JSON.stringify(creep.memory._go)+". Proceeding anyway");
                        this.creeps = this.creeps.filter(creep => creep.name != creepName);
					}
					creep.memory = peer[Game.shard.name].packets[peerTick][creepName];

                    // Place new creep into this.creeps
                    const zerg = new Zerg(creep);
                    log.debug('Received inter shard creep '+zerg.print+' of colony '+
                        zerg.memory[_MEM.SHARD]+' / '+zerg.memory[_MEM.COLONY]+' with TTL: '+zerg.ticksToLive);
                    if(creep.memory._go) {
                        this.creeps.push(zerg);
                        this.moveOptions[creepName] = {
                            waypoints: this.parseWayPoints(creep.memory._go.waypoints)
                        };
                    } else {
                        log.warning('Inter shard creep '+zerg.print+' has no move data. Cannot move');
                    }
				}
				latestPeerTime = Math.max(latestPeerTime, peerPacketTick);
			}

			// Update ACK
            const ack = latestPeerTime +1;
            if(receiveWindow && ack - receiveWindow > MAX_RECEIVE_WINDOW) {
                receiveWindow = ack - MAX_RECEIVE_WINDOW;
                log.warning("Packets from "+shard+" before "+receiveWindow+" are lost!");
            }
            // log.debug('Received packets from '+shard+': receiveWindow: '+receiveWindow+', ack: '+ack);
			my[shard].ack = receiveWindow ? receiveWindow : ack;
		}
		setInterShardMemory(my);
	}

    private parseWayPoints(waypoints: string[] | undefined): RoomPosition[] {
        return _.map(waypoints || [], waypoint => getPosFromString(waypoint)!)
    }

	/* Move creeps from other shards along their previous routes */
	private handleInterShardCreeps(): void {
		for(const creep of this.creeps) {
            if(!Overmind.zerg[creep.name] || !creep.memory._go) continue; // Creep is dead
            if(Overmind.colonies[creep.memory[_MEM.COLONY]||""]) continue; // Creep belongs to a colony
            const ret = creep.goTo(
                // TODO: dynamically determine target based on creep role
                new RoomPosition(25, 15, creep.pos.roomName),
                this.moveOptions[creep.name]
            );
            if(ret == CROSSING_PORTAL) {
                log.info('Creep '+ creep.print +' crossing portal');
            }else if(ret == ERR_TIRED) {
                log.info('Creep '+ creep.print +' is tired');
            }else if(ret != OK) {
                log.warning('Cannot move inter-shard creep '+creep.print+': error code: '+ret);
            }
        }
	}

    init() {
		this.receiveInterShardPackets();
    }

    run() {
		this.handleInterShardCreeps();
    }

    refresh() {
        _.forEach(this.creeps, creep => creep.refresh());
    }

    build() {
        // All creeps without a colony are inter-shard creeps
        this.creeps = _.map(
			_.filter(
				Game.creeps, creep => !!(creep.memory._go && !isZerg(normalizeZerg(creep)))
			), 
			creep => Overmind.zerg[creep.name] || new Zerg(creep)
		);
        log.debug('Overshard build phase: collected '+this.creeps.length+' inter shard creeps');

        // EDIT: We have shard visibility scout now
        // In case multiple creeps crossing shards, sacrifice one to keep shard visibility and avoid global reset
        // if((Game.shard.name.endsWith('0') || Game.shard.name.endsWith('1')) && 
        // this.creeps.length == _.keys(Game.creeps).length && this.creeps.length > 1 &&
        // !this.creeps.find(creep => creep.memory.role == 'scout')) {
        //     let sight = this.creeps.pop();
        //     // Ensure we're not sacrificing a pioneer
        //     if(sight!.memory.role == 'pioneer') {
        //         this.creeps.push(sight!);
        //         // Assuming no two other creeps appear at the same time
        //         sight = this.creeps.shift();
        //     }
        //     delete sight!.memory._go;
        // }

        // Assign move options
        for(const creep of this.creeps) {
            this.moveOptions[creep.name] = {
                waypoints: this.parseWayPoints(creep.memory._go!.waypoints)
            };
        }
    }
}