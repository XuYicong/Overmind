var _0x9e16 = function (id) {
    var s = ["filter", "keys", "rooms", "sample", "length", "memory", "Overmind", "overseer", "shouldBuild", "expiration", "time", "cache", "colonies", "directives", "zerg", "overlords", "spawnGroups", "colonyMap", "terminalNetwork", "makeTerminalNetwork", "tradeNetwork", "expansionPlanner", "exceptions", "build", "debug", "Rebuilding Overmind object!", "registerColonies", "forEach", "spawnMoarOverlords", "registerDirectives", "refresh", "refreshColonies", "refreshDirectives", "try", "name", "Caught unhandled exception at ", " (identifier: ", "): \n", "stack", ": \n", "push", "handleExceptions", "warning", 
        "Exceptions present this tick! Rebuilding Overmind object in next tick.", "stats", "persistent", "lastErrorTick", "first", "throw", "Multiple exceptions caught this tick!", "map", "join", "controller", "level", "terminal", "groupBy", "outpostFlags", "suspend", "notifier", "alert", "Colony suspended", "High", "flags", "setPosition", "roomName", "pos", "Suppressing instantiation of colony ", "Caught unhandled exception instantiating colony ", "Caught unhandled exception refreshing colony ",
        "Flag [", " @ ", "print", "] does not match ", "a valid directive color code! (Refer to /src/directives/initializer.ts)", "Use removeErrantFlags() to remove flags which do not match a directive.", "init", "cpu", "getUsed", "log", "cpu.usage.", ".init", "run", "postRun", "visuals", "bucket", "newestVersion", "isVersionOutdated", "[!] Update available: ", " → ", "info", "CPU bucket is too low (", ") - skip rendering visuals.", "runRoomIntel_1", "defcon", "creeps", "signedByScreeps", "sign", "text", "toLowerCase", "includes", "overmind", "ᴏᴠᴇʀᴍɪɴᴅ", "undefined", "settings", "signature", "Invalid controller signatures detected:",
        "Signatures must contain the string \"Overmind\" or ", "Invalid controller signatures detected; won't run this tick!", "runRoomIntel_2", "isAssimilated", "color", "secondaryColor", "wrap", "versionUpdater", "slave_fetchVersion", "CheckFrequency", "CheckOnTick", "requestForeignSegment", "VersionSegment", "getForeignSegment", "version", "split", "master_pushVersion", "requestSegments", "markSegmentAsPublic", "setSegmentProperty", "generateUpdateMessage",
        "<a href=\"https://github.com/bencbartlett/Overmind/releases\">Download</a>", "<a href=\"https://github.com/bencbartlett/Overmind/blob/master/CHANGELOG.md\">Patch notes</a>",
        "头", "中上左", "中上右", "中下左", "中下中", "中下右 ", "底",
        "generateUpdateMessageSmall", "头", "上", "中上", "中左", "中右", "中下左", "中下右", "下",
        "displayUpdateMessage", "<font color='#ff00ff'>", "</font>", "sayUpdateMessage", "say", "Update me!", "notifyNewVersion", "notify",];
    return s[Number(id)];
};
//
// Overmind_obfuscated.js: this file is intentially obfuscated to prevent tampering.
//
// Q: What does this file do?
//
// A: The Overmind object is the top-level initializer of the AI and instantiates all colonies and directives. It is
//    also responsible for some high-level decision making. You can see the enumerated properties of the Overmind class
//    in IOvermind in declarations/index.d.ts. Since this file is sufficiently complex and is critical for the AI to be
//    able to run, it was a natural choice of location to put code which should be tamper-resistant.
//
var __decorate = this && this.__decorate || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1;
        i >= 0;
        i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Overshard } from './Overshard';
import { assimilationLocked } from './assimilation/decorator';
import { GameCache } from './caching/GameCache';
import { Colony, getAllColonies } from './Colony';
import { log } from './console/log';
import { AllContracts } from './contracts/contractsList';
import { DirectiveWrapper } from './directives/initializer';
import { NotifierPriority } from './directives/Notifier';
import { RoomIntel } from './intel/RoomIntel';
import { TerminalNetwork } from './logistics/TerminalNetwork';
import { TraderJoe } from './logistics/TradeNetwork';
import { Mem } from './memory/Memory';
// import { Segmenter } from './memory/Segmenter';
import { Overseer } from './Overseer';
import { profile } from './profiler/decorator';
import { Stats } from './stats/stats';
import { ExpansionPlanner } from './strategy/ExpansionPlanner';
import { alignedNewline } from './utilities/stringConstants';
import { asciiLogoSmall } from './visuals/logos';
import { Visualizer } from './visuals/Visualizer';
import { MUON, MY_USERNAME, NEW_OVERMIND_INTERVAL, PROFILER_COLONY_LIMIT, PROFILER_INCLUDE_COLONIES, USE_PROFILER, USE_TRY_CATCH } from './~settings';
// javascript-obfuscator:enable
const profilerRooms = {};
if (USE_PROFILER) {
    for (const name of PROFILER_INCLUDE_COLONIES) {
        profilerRooms[name] = !![];
    }
    const myRoomNames = _[_0x9e16('0x0')](_[_0x9e16('0x1')](Game.rooms), _0x15b99f => Game.rooms[_0x15b99f] && Game.rooms[_0x15b99f]['my']);
    for (const name of _[_0x9e16('0x3')](myRoomNames, PROFILER_COLONY_LIMIT - PROFILER_INCLUDE_COLONIES[_0x9e16('0x4')])) {
        profilerRooms[name] = !![];
    }
}
let _Overmind = class _Overmind {
    constructor() {
        this[_0x9e16('0x5')] = Memory[_0x9e16('0x6')];
        this.overseer = new Overseer();
        this.shouldBuild = !![];
        this[_0x9e16('0x9')] = Game.time + NEW_OVERMIND_INTERVAL;
        this.cache = new GameCache();
        this.overshard = new Overshard();
        this.colonies = {};
        this.directives = {};
        this.zerg = {};
        this.overlords = {};
        this.spawnGroups = {};
        this.colonyMap = {};
        this.terminalNetwork = this[_0x9e16('0x13')]();
        this[_0x9e16('0x14')] = new TraderJoe();
        this[_0x9e16('0x15')] = new ExpansionPlanner();
        this[_0x9e16('0x16')] = [];
    }
    build() {
        log[_0x9e16('0x18')](_0x9e16('0x19'));
        this.cache.build();
        this.registerColonies();
        _.forEach(this.colonies, colony => colony.spawnMoarOverlords());
        this.registerDirectives();
        _.forEach(this.directives, directive => directive.spawnMoarOverlords());
        this.overshard.build();
        this.shouldBuild = ![];
    }
    refresh() {
        this.shouldBuild = !![];
        this[_0x9e16('0x5')] = Memory[_0x9e16('0x6')];
        this[_0x9e16('0x16')] = [];
        this.cache.refresh();
        this.overshard.refresh();
        this.overseer.refresh();
        this.terminalNetwork.refresh();
        this[_0x9e16('0x14')].refresh();
        this[_0x9e16('0x15')].refresh();
        this[_0x9e16('0x1f')]();
        this[_0x9e16('0x20')]();
        for (const overlord in this.overlords) {
            this.overlords[overlord].refresh();
        }
        for (const spawnGroup in this.spawnGroups) {
            this.spawnGroups[spawnGroup].refresh();
        }
        this.shouldBuild = ![];
    }
    ["try"](callback, _0x1bda8b) {
        if (USE_TRY_CATCH) {
            try {
                callback();
            }
            catch (exception) {
                if (_0x1bda8b) {
                    exception[_0x9e16('0x22')] = _0x9e16('0x23') + ('' + callback) + _0x9e16('0x24') + _0x1bda8b + _0x9e16('0x25') + exception[_0x9e16('0x22')] + '\x0a' + exception[_0x9e16('0x26')];
                }
                else {
                    exception[_0x9e16('0x22')] = _0x9e16('0x23') + ('' + callback) + _0x9e16('0x27') + exception[_0x9e16('0x22')] + '\x0a' + exception[_0x9e16('0x26')];
                }
                this[_0x9e16('0x16')][_0x9e16('0x28')](exception);
                log.info(exception.stack);
            }
        }
        else {
            callback();
        }
    }
    [_0x9e16('0x29')]() {
        if (this[_0x9e16('0x16')][_0x9e16('0x4')] == 0x0) {
            return;
        }
        else {
            log[_0x9e16('0x2a')](_0x9e16('0x2b'));
            Memory[_0x9e16('0x2c')][_0x9e16('0x2d')][_0x9e16('0x2e')] = Game.time;
            this.shouldBuild = !![];
            this[_0x9e16('0x9')] = Game.time;
            if (this[_0x9e16('0x16')][_0x9e16('0x4')] == 0x1) {
                throw _[_0x9e16('0x2f')](this[_0x9e16('0x16')]);
            }
            else {
                for (const _0x2343dd of this[_0x9e16('0x16')]) {
                    log[_0x9e16('0x30')](_0x2343dd);
                }
                const _0x35c82d = new Error(_0x9e16('0x31'));
                _0x35c82d[_0x9e16('0x26')] = _[_0x9e16('0x32')](this[_0x9e16('0x16')], _0x5473ed => _0x5473ed[_0x9e16('0x22')])[_0x9e16('0x33')]('\x0a');
                throw _0x35c82d;
            }
        }
    }
    [_0x9e16('0x13')]() {
        const terminals = [];
        for (const roomName in Game.rooms) {
            if (USE_PROFILER && !profilerRooms[roomName]) continue;
            const room = Game.rooms[roomName];
            if (room['my'] && room[_0x9e16('0x34')][_0x9e16('0x35')] >= 0x6 && room[_0x9e16('0x36')] && room[_0x9e16('0x36')]['my']) {
                terminals[_0x9e16('0x28')](room[_0x9e16('0x36')]);
            }
        }
        return new TerminalNetwork(terminals);
    }
    registerColonies() {
        const outposts = {};
        this.colonyMap = {};
        const _0x25b837 = _[_0x9e16('0x37')](this.cache[_0x9e16('0x38')], _0x4864bd => _0x4864bd[_0x9e16('0x5')]['C']);
        for (const ownedRoom in Game.rooms) {
            if (Game.rooms[ownedRoom]['my']) {
                const colony = Memory.colonies[ownedRoom];
                if (colony && colony[_0x9e16('0x39')]) {
                    this.overseer[_0x9e16('0x3a')][_0x9e16('0x3b')](_0x9e16('0x3c'), ownedRoom, NotifierPriority[_0x9e16('0x3d')]);
                    continue;
                }
                if (Game.rooms[ownedRoom][_0x9e16('0x3e')]) {
                    outposts[ownedRoom] = _[_0x9e16('0x32')](
                        _0x25b837[ownedRoom],
                        _0x2cf1b0 => _0x2cf1b0[_0x9e16('0x5')][_0x9e16('0x3f')] ?
                            derefRoomPosition(_0x2cf1b0[_0x9e16('0x5')][_0x9e16('0x3f')])[_0x9e16('0x40')] :
                            _0x2cf1b0[_0x9e16('0x41')][_0x9e16('0x40')]
                    );
                }
                this.colonyMap[ownedRoom] = ownedRoom;
            }
        }
        for (const colonyName in outposts) {
            for (const outpost of outposts[colonyName]) {
                this.colonyMap[outpost] = colonyName;
            }
        }
        let colonyId = 0x0;
        for (const colonyName in outposts) {
            if (USE_PROFILER && !profilerRooms[colonyName]) {
                if (Game.time % 0x14 == 0x0) {
                    log[_0x9e16('0x3b')](_0x9e16('0x42') + colonyName + '.');
                }
                continue;
            }
            try {
                this.colonies[colonyName] = new Colony(colonyId, colonyName, outposts[colonyName]);
            }
            catch (exception) {
                exception[_0x9e16('0x22')] = _0x9e16('0x43') + colonyName + _0x9e16('0x27') + exception[_0x9e16('0x22')];
                this[_0x9e16('0x16')][_0x9e16('0x28')](exception);
            }
            colonyId++;
        }
    }
    [_0x9e16('0x1f')]() {
        for (const colony in this.colonies) {
            try {
                this.colonies[colony].refresh();
            }
            catch (_0x2b1bf4) {
                _0x2b1bf4[_0x9e16('0x22')] = _0x9e16('0x44') + colony + _0x9e16('0x27') + _0x2b1bf4[_0x9e16('0x22')];
                this[_0x9e16('0x16')][_0x9e16('0x28')](_0x2b1bf4);
            }
        }
    }
    registerDirectives(_0x7bd91 = ![]) {
        for (const _0x4d31b6 in Game[_0x9e16('0x3e')]) {
            if (this.directives[_0x4d31b6]) {
                continue;
            }
            const _0x53d7dd = Game[_0x9e16('0x3e')][_0x4d31b6][_0x9e16('0x5')]['C'];
            if (_0x53d7dd) {
                if (USE_PROFILER && !profilerRooms[_0x53d7dd]) {
                    continue;
                }
                const _0x51f1bf = Memory.colonies[_0x53d7dd];
                if (_0x51f1bf && _0x51f1bf[_0x9e16('0x39')]) {
                    continue;
                }
            }
            const _0x5cd134 = DirectiveWrapper(Game[_0x9e16('0x3e')][_0x4d31b6]);
            const _0x2a3fe2 = !!this.directives[_0x4d31b6];
            if (_0x5cd134 && _0x2a3fe2 && _0x7bd91) {
                _0x5cd134.spawnMoarOverlords();
            }
            if (!_0x5cd134 && Game.time % 0xa == 0x0) {
                log[_0x9e16('0x3b')](_0x9e16('0x45') + _0x4d31b6 + _0x9e16('0x46') + Game[_0x9e16('0x3e')][_0x4d31b6][_0x9e16('0x41')][_0x9e16('0x47')] + _0x9e16('0x48') + _0x9e16('0x49') + alignedNewline + _0x9e16('0x4a'));
            }
        }
    }
    [_0x9e16('0x20')]() {
        for (const _0x43ebde in this.directives) {
            this.directives[_0x43ebde].refresh();
        }
        this.registerDirectives(!![]);
    }
    ["init"]() {
        this["try"](() => this[_0x9e16('0x14')]["init"]());
        this.overseer["init"]();
        this["try"](() => this.terminalNetwork["init"]());
        for (const _0x24fb7d in this.colonies) {
            const _0x10bc23 = Game[_0x9e16('0x4c')][_0x9e16('0x4d')]();
            this["try"](() => this.colonies[_0x24fb7d]["init"](), _0x24fb7d);
            Stats[_0x9e16('0x4e')](_0x9e16('0x4f') + _0x24fb7d + _0x9e16('0x50'), Game[_0x9e16('0x4c')][_0x9e16('0x4d')]() - _0x10bc23);
        }
        for (const _0x4d32b3 in this.spawnGroups) {
            this["try"](() => this.spawnGroups[_0x4d32b3]["init"](), _0x4d32b3);
        }
        this["try"](() => this[_0x9e16('0x15')]["init"]());
        this["try"](() => this.overshard.init());
    }
    ["run"]() {
        if (Game.time % 0x3 == 0x0) {
            IntelManagement["run"]();
        }
        for (const _0x271ad2 in this.spawnGroups) {
            this["try"](() => this.spawnGroups[_0x271ad2]["run"](), _0x271ad2);
        }
        this.overseer["run"]();
        for (const _0x339ce6 in this.colonies) {
            this["try"](() => this.colonies[_0x339ce6]["run"](), _0x339ce6);
        }
        if (MY_USERNAME == MUON) {
            for (const contract of AllContracts) {
                this["try"](() => contract["run"]());
            }
        }
        this["try"](() => this.terminalNetwork["run"]());
        this["try"](() => this[_0x9e16('0x14')]["run"]());
        this["try"](() => this[_0x9e16('0x15')]["run"]());
        this["try"](() => RoomIntel["run"]());
        this["try"](() => this.overshard.run());
        // this["try"](() => Assimilator["run"]());
    }
    [_0x9e16('0x52')]() {
        this["try"](() => VersionUpdater["run"]());
        // this["try"](() => Segmenter["run"]());
        this[_0x9e16('0x29')]();
    }
    [_0x9e16('0x53')]() {
        if (Game[_0x9e16('0x4c')][_0x9e16('0x54')] > 0x2328) {
            Visualizer[_0x9e16('0x53')]();
            if (VersionUpdater[_0x9e16('0x5')][_0x9e16('0x55')]) {
                const _0x458fea = VersionUpdater[_0x9e16('0x5')][_0x9e16('0x55')];
                if (VersionUpdater[_0x9e16('0x56')](_0x458fea)) {
                    this.overseer[_0x9e16('0x3a')][_0x9e16('0x3b')](_0x9e16('0x57') + __VERSION__ + _0x9e16('0x58') + _0x458fea, undefined, -0x1);
                }
            }
            this.overseer[_0x9e16('0x53')]();
            for (const _0x64d8ea in this.colonies) {
                this.colonies[_0x64d8ea][_0x9e16('0x53')]();
            }
        }
        else {
            if (Game.time % 50 == 0x0) {
                log[_0x9e16('0x59')](_0x9e16('0x5a') + Game[_0x9e16('0x4c')][_0x9e16('0x54')] + _0x9e16('0x5b'));
            }
        }
    }
};
_Overmind = __decorate([profile, assimilationLocked], _Overmind);
export default _Overmind;
class IntelManagement {
    static [_0x9e16('0x5c')]() {
        const _0x3ee848 = [];
        const allColonies = getAllColonies();
        if (allColonies[_0x9e16('0x4')] == 0x0) return;
        for (const _0x408b57 of allColonies) {
            if (_0x408b57[_0x9e16('0x5d')] > 0x0 || _0x408b57[_0x9e16('0x5e')][_0x9e16('0x4')] == 0x0) {
                continue;
            }
            const _0x4e5e12 = _0x408b57[_0x9e16('0x34')];
            if (_0x4e5e12[_0x9e16('0x5f')] || _0x4e5e12[_0x9e16('0x35')] < 0x4) {
                continue;
            }
            let _0x180b13 = ![];
            if (_0x4e5e12[_0x9e16('0x60')]) {
                const _0x2846ef = _0x4e5e12[_0x9e16('0x60')][_0x9e16('0x61')];
                if (_0x2846ef[_0x9e16('0x62')]()[_0x9e16('0x63')](_0x9e16('0x64')) || _0x2846ef[_0x9e16('0x63')](_0x9e16('0x65'))) {
                    _0x180b13 = !![];
                }
            }
            if (!_0x180b13) {
                _0x3ee848[_0x9e16('0x28')](_0x4e5e12[_0x9e16('0x60')] ? _0x4e5e12[_0x9e16('0x60')][_0x9e16('0x61')] : _0x9e16('0x66'));
            }
        }
        _[_0x9e16('0x1')](Overmind.colonies)
    }
    static [_0x9e16('0x6c')]() {
        // if (!Assimilator[_0x9e16('0x6d')](MY_USERNAME)) {
        //     const _0x5a2622 = [[COLOR_RED, COLOR_RED]];
        //     for (const _0x2c0dbd in Game[_0x9e16('0x3e')]) {
        //         const _0x3a00ca = Game[_0x9e16('0x3e')][_0x2c0dbd];
        //         const _0x1c0b76 = [_0x3a00ca[_0x9e16('0x6e')], _0x3a00ca[_0x9e16('0x6f')]];
        //         if (_0x5a2622[_0x9e16('0x63')](_0x1c0b76)) { }
        //     }
        // }
    }
    static ["run"]() {
        this[_0x9e16('0x5c')]();
        if (Game.time % (0x3 * 0x1f) == 0x0) {
            this[_0x9e16('0x6c')]();
        }
    }
}
class VersionUpdater {
    static get [_0x9e16('0x5')]() {
        return Mem[_0x9e16('0x70')](Memory[_0x9e16('0x6')], _0x9e16('0x71'), {
            'versions': {}
            , 'newestVersion': undefined
        }
        );
    }
    static [_0x9e16('0x72')]() {
        // if (Game.time % this.CheckFrequency == this.CheckOnTick - 0x1) {
        //     Segmenter[_0x9e16('0x75')](MUON, this[_0x9e16('0x76')]);
        // }
        // else if (Game.time % this.CheckFrequency == this.CheckOnTick) {
        //     const _0x25ce0d = Segmenter[_0x9e16('0x77')]();
        //     if (_0x25ce0d) {
        //         return _0x25ce0d[_0x9e16('0x78')];
        //     }
        // }
    }
    static [_0x9e16('0x56')](_0xaa5430) {
        const [_0x2ae244, _0x5391fd, _0x24c5a1] = _[_0x9e16('0x32')](__VERSION__[_0x9e16('0x79')]('.'), _0x2ae98a => parseInt(_0x2ae98a, 0xa));
        const [_0x34116f, _0x2e335f, _0xc5c749] = _[_0x9e16('0x32')](_0xaa5430[_0x9e16('0x79')]('.'), _0x129f43 => parseInt(_0x129f43, 0xa));
        return _0x34116f > _0x2ae244 || _0x2e335f > _0x5391fd || _0xc5c749 > _0x24c5a1;
    }
    static [_0x9e16('0x7a')]() {
        // if (Game.time % this.CheckFrequency == this.CheckOnTick - 0x2) {
        //     Segmenter[_0x9e16('0x7b')](this[_0x9e16('0x76')]);
        // }
        // else if (Game.time % this.CheckFrequency == this.CheckOnTick - 0x1) {
        //     Segmenter[_0x9e16('0x7c')](this[_0x9e16('0x76')]);
        //     Segmenter[_0x9e16('0x7d')](this[_0x9e16('0x76')], _0x9e16('0x78'), __VERSION__);
        // }
    }
    static [_0x9e16('0x7e')](_0x504723, _0x19a7e9) {
        let _0x5d0856 = '\x0a';
        for (const _0x425873 of asciiLogoSmall) {
            _0x5d0856 += _0x425873 + '\x0a';
        }
        const _0x52d706 = _0x9e16('0x7f');
        const _0x2227a9 = _0x9e16('0x80');
        const _0x23de82 = _0x9e16('0x81') + (_0x9e16('0x82') + _0x504723 + _0x9e16('0x58') + _0x19a7e9 + _0x9e16('0x83')) + (_0x9e16('0x84') + _0x52d706 + _0x9e16('0x85') + _0x2227a9 + _0x9e16('0x86')) + _0x9e16('0x87');
        return _0x5d0856 + _0x23de82;
    }
    static [_0x9e16('0x88')](_0x3af0f4, _0x492f50) {
        const _0x207d2f = _0x9e16('0x7f');
        const _0x5e5126 = _0x9e16('0x80');
        const _0x64ac05 = _0x9e16('0x89') + _0x9e16('0x8a') + _0x9e16('0x8b') + (_0x9e16('0x8c') + _0x3af0f4 + _0x9e16('0x58') + _0x492f50 + _0x9e16('0x8d')) + (_0x9e16('0x8e') + _0x207d2f + _0x9e16('0x85') + _0x5e5126 + _0x9e16('0x8f')) + _0x9e16('0x90');
        return '\x0a' + _0x64ac05;
    }
    static [_0x9e16('0x91')](_0x4ee7ac) {
        const _0x44c6f2 = this[_0x9e16('0x7e')](__VERSION__, _0x4ee7ac);
        console[_0x9e16('0x4e')](_0x9e16('0x92') + _0x44c6f2 + _0x9e16('0x93'));
    }
    static [_0x9e16('0x94')](_0xef121e) {
        for (const _0x15d424 in Game[_0x9e16('0x5e')]) {
            const _0x3c552a = Game[_0x9e16('0x5e')][_0x15d424];
            _0x3c552a[_0x9e16('0x95')](_0x9e16('0x96'), !![]);
        }
    }
    static [_0x9e16('0x97')](_0x57ca27) {
        const _0x458837 = this[_0x9e16('0x88')](__VERSION__, _0x57ca27);
        Game[_0x9e16('0x98')](_0x9e16('0x92') + _0x458837 + _0x9e16('0x93'));
    }
    static ["run"]() {
        if (MY_USERNAME == MUON) {
            this[_0x9e16('0x7a')]();
        }
        const _0x299af9 = this[_0x9e16('0x72')]();
        if (_0x299af9) {
            this[_0x9e16('0x5')][_0x9e16('0x55')] = _0x299af9;
        }
        const _0x2cb767 = this[_0x9e16('0x5')][_0x9e16('0x55')];
        if (_0x2cb767 && this[_0x9e16('0x56')](_0x2cb767)) {
            if (Game.time % 0xa == 0x0) {
                this[_0x9e16('0x91')](_0x2cb767);
                this[_0x9e16('0x94')](_0x2cb767);
            }
            if (Game.time % 0x2710 == 0x0) {
                this[_0x9e16('0x97')](_0x2cb767);
            }
        }
    }
}
VersionUpdater.CheckFrequency = 0x3f3f3f3f;
VersionUpdater.CheckOnTick = 0x5b;
VersionUpdater[_0x9e16('0x76')] = 0x63;
