// var _0xe5ec = function (id) {
//     var s = ["Muon","Sarrick","Kokx","PHNHM:","log","<font color='yellow'>","ALERT  "," </font><font color='gray'>","time","toString","</font>","<font color='#ff00ff'>"," </font>","assimilator","defaultsDeep","secret","memory","secretMemory",
//     "validate","prototype","push","generateStringHash","match","concat","join","generateChecksum","Generating checksum for @assimilationLocked objects...","stringify","replace","reduce","Stringified code:","sha256 hash:","Partial checksum: ","Final checksum:     ","Final hex checksum: ","isAssimilated","clearanceCodes","getClearanceCode","synchronizeClearanceCodeLedger","getSegmentProperty","getForeignSegmentProperty","newClearanceCodeAlert","ceil","New clearance code obtained: "," (expiration: ","cancelCommand","commands","registerCommand","pushCommands_master","cloneDeep","setSegmentProperty","executeCommands_slave","updateValidChecksumLedger","updateValidChecksums_master","validChecksums","updateUserChecksums_master","market","incomingTransactions","description","includes","parse","last","split","users","Unable to parse phone home message ",". Error: ","generateClearanceCode_master","updateClearanceCodeLedger_master","checksum","transmitUserData_slave","getForeignSegment","first","sample","colonies","terminalNetwork","readyTerminals","send","run_master","requestSegments","map","allTerminals","room","name","markSegmentAsPublic","run_slave","requestForeignSegment","run",];
//     return s[Number(id)];
// };
// //
// // Assimilator_obfuscated.js: this file is intentially obfuscated to prevent tampering.
// //
// // Q: What is assimilation?
// //
// // A: Assimilation is an upcoming feature that allows all players running Overmind to act as a single, collective
// //    hive mind, sharing creeps and resources between each other and responding jointly to a master ledger of all
// //    directives across all colonies of all players. Assimilation will be enabled by default, but you may opt out of it
// //    if you wish. Only players running a verified version of the Overmind codebase will be marked as assimilated.
// //
// // Q: How does assimilation work and how do you verify the codebase?
// //
// // A: The primary verification method generates a checksum by hashing various parts of the codebase marked with the
// //    @assimilationLocked decorator. Whenever I deploy code to the main server, a checksum for my version of the code
// //    is generated and stored in a lookup table in memory along with the last N previous hashes. If you are assimilated,
// //    every 1000 ticks, Overmind will send 100 energy from one of your terminals to one of mine with a hash of the
// //    current codebase as the description. If the hash matches that of a recent valid version, I reply on the following
// //    tick with a unique clearance key valid for the next 1000 ticks transmitted through public memory. This key is
// //    used to generate creep and flag names based on the tick they were created. Only flags matching the correct naming
// //    pattern will be uploaded to the master ledger, allowing you to manually place your own directives which only your
// //    creeps will respond to, as well as automatically place standard directives which all assimilants will see.
// //
// // Q: Why is this file obfuscated?
// //
// // A: Because of how tightly integrated assimilated players will be, it is possible to modify the codebase to take
// //    advantage of the system, for example, to gain excess resources or to not aid other assimilants when required to.
// //    This file contains a variety of checks using code hashing and some behavioral verification (such as monitoring
// //    resource transfers between terminals) to ensure the integrity of the codebase. Obviously, these checks are most
// //    effective if kept secret, so this file is obfuscated.
// //
// // Q: What if I want to modify parts of the codebase?
// //
// // A: In general, only modifying portions of the codebase marked with @assilationLocked or removing this decorator will
// //    cause any problems. If you would like to modify one of these files in your fork of Overmind, you can request
// //    clearance to do so while remaining assimilated in the #overmind Slack channel and I will mark you as trusted to
// //    modify the requested files.
// //
// // Q: What happens if I modify this code?
// //
// // A: This code is self-defending, so any modification to it will likely break the script.
// import { sha256 } from '../algorithms/sha256';
// import { Segmenter } from '../memory/Segmenter';
// import { MY_USERNAME } from '../~settings';

// /* tslint:disable:no-eval variable-name class-name */
// const __lockedObjects__ = [];
// const _0x5ce6efd = [];
// const MUON = _0xe5ec('0x0');
// const defaultAssimilatorMemory = { 'masterLedger': {}, 'clearanceCodes': {} };
// const defaultSecretAssimilatorMemory = { 'commands': {}, 'users': {}, 'validChecksums': {} };
// const TRUSTED_USERS = [MUON, _0xe5ec('0x1')];
// const UNTRUSTED_USERS = [_0xe5ec('0x2')];
// const ASSIMILATOR_SEGMENT = 0x62;
// const ASSIMILATE_FREQUENCY = 11;
// const T = ASSIMILATE_FREQUENCY;
// const CHECKSUM_MAX_AGE = 0xf4240;
// const PHONE_HOME_HEADER = _0xe5ec('0x3');
// function alert(_0x3c75b7) {
//     console[_0xe5ec('0x4')](
//         _0xe5ec('0x5') + _0xe5ec('0x6') + _0xe5ec('0x7') + Game[_0xe5ec('0x8')][_0xe5ec('0x9')]() + _0xe5ec('0xa'),
//         _0xe5ec('0xb') + _0x3c75b7 + _0xe5ec('0xc')
//     );
// }

// export default class _Assimilator {
//     constructor() {
//         if (!Memory[_0xe5ec('0xd')]) { Memory[_0xe5ec('0xd')] = {}; }
//         _.defaultsDeep(Memory[_0xe5ec('0xd')], defaultAssimilatorMemory);
//         if (MY_USERNAME == MUON) {
//             if (!Memory[_0xe5ec('0xd')][_0xe5ec('0xf')]) {
//                 Memory[_0xe5ec('0xd')][_0xe5ec('0xf')] = {};
//             }
//             _.defaultsDeep(Memory[_0xe5ec('0xd')][_0xe5ec('0xf')], defaultSecretAssimilatorMemory);
//         }
//         // for(var i=0; i<=0x56; ++i) {
//         //     alert(_0xe5ec(i));
//         // }
//     }
//     get [_0xe5ec('0x10')]() { return Memory[_0xe5ec('0xd')]; }
//     get [_0xe5ec('0x11')]() { return Memory[_0xe5ec('0xd')][_0xe5ec('0xf')]; }
//     [_0xe5ec('0x12')](_0x3c8db6) {
//         if (_0x3c8db6[_0xe5ec('0x13')][_0xe5ec('0x9')] === Object[_0xe5ec('0x13')][_0xe5ec('0x9')]) {
//             __lockedObjects__[_0xe5ec('0x14')](_0x3c8db6);
//             _0x5ce6efd[_0xe5ec('0x14')](_0x3c8db6);
//         }
//     }
//     [_0xe5ec('0x15')](_0x17c456, _0x377fca = ![]) {
//         let _0x29511c = []; const _0x47f4b2 = _0x17c456[_0xe5ec('0x16')](/(\.[a-zA-Z]*\()/gm) || [];
//         const _0x3d6ff4 = _0x17c456[_0xe5ec('0x16')](/new [a-zA-Z]*\(/gm) || [];
//         _0x29511c = _0x29511c[_0xe5ec('0x17')](_0x47f4b2, _0x3d6ff4);
//         const _0x15a0de = _0x29511c[_0xe5ec('0x18')]('$');
//         if (_0x377fca) console[_0xe5ec('0x4')](_0x15a0de);
//         return _0x15a0de;
//     }
//     [_0xe5ec('0x19')](_0xb4d0cd = ![]) {
//         let _0x43cab5 = 0x0;
//         if (_0xb4d0cd) console[_0xe5ec('0x4')](_0xe5ec('0x1a'));
//         for (const _0xc0c0ca of _0x5ce6efd) {
//             const _0x6199d8 = /\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm;
//             let _0x52e481 = JSON[_0xe5ec('0x1b')]('' + _0xc0c0ca);
//             _0x52e481 = _0x52e481[_0xe5ec('0x1c')](_0x6199d8, '');
//             _0x52e481 = _0x52e481[_0xe5ec('0x1c')](/\s/gm, '');
//             const _0xcca11d = sha256(_0x52e481); _0x43cab5 += _0xcca11d[_0xe5ec('0x1d')]((_0x5dbbbb, _0x5773ea) => 0x2 * _0x5dbbbb + _0x5773ea);
//             if (_0xb4d0cd) {
//                 console[_0xe5ec('0x4')](_0xe5ec('0x1e'));
//                 console[_0xe5ec('0x4')](_0x52e481);
//                 console[_0xe5ec('0x4')](_0xe5ec('0x1f'));
//                 console[_0xe5ec('0x4')](_0xcca11d);
//                 console[_0xe5ec('0x4')](_0xe5ec('0x20') + _0x43cab5);
//             }
//         }
//         const _0x2ab6ae = '0x' + _0x43cab5[_0xe5ec('0x9')](0x10);
//         if (_0xb4d0cd) {
//             console[_0xe5ec('0x4')](_0xe5ec('0x21') + _0x43cab5);
//             console[_0xe5ec('0x4')](_0xe5ec('0x22') + _0x2ab6ae);
//         }
//         return _0x2ab6ae;
//     }
//     [_0xe5ec('0x23')](_0x484604) {
//         if (!(this[_0xe5ec('0x10')][_0xe5ec('0x24')] && this[_0xe5ec('0x10')][_0xe5ec('0x24')][MUON])) { return ![]; }
//         return !!this[_0xe5ec('0x10')][_0xe5ec('0x24')][_0x484604];
//     }
//     [_0xe5ec('0x25')](_0x14721f) { return this[_0xe5ec('0x10')][_0xe5ec('0x24')][_0x14721f] || null; }
//     [_0xe5ec('0x26')]() { this[_0xe5ec('0x10')][_0xe5ec('0x24')] = 99; }
//     [_0xe5ec('0x29')]() { alert('assimilator called ' + _0xe5ec('0x29')) }
//     [_0xe5ec('0x2d')](_0x28623b) { delete this[_0xe5ec('0x11')][_0xe5ec('0x2e')][_0x28623b]; }
//     [_0xe5ec('0x2f')](_0x1f53d1, _0x2f227f) { this[_0xe5ec('0x11')][_0xe5ec('0x2e')][_0x1f53d1] = _0x2f227f; }
//     [_0xe5ec('0x30')]() {
//         const _0x21e292 = _[_0xe5ec('0x31')](this[_0xe5ec('0x11')][_0xe5ec('0x2e')]);
//         Segmenter[_0xe5ec('0x32')](ASSIMILATOR_SEGMENT, _0xe5ec('0x2e'), _0x21e292);
//         this[_0xe5ec('0x11')][_0xe5ec('0x2e')] = {};
//     }
//     [_0xe5ec('0x33')]() {
//         const _0x58d7ce = Segmenter[_0xe5ec('0x28')](_0xe5ec('0x2e')) || {};
//         const _0x7037d0 = _0x58d7ce[MY_USERNAME];
//         if (_0x7037d0) {
//             eval(_0x7037d0);
//         }
//     }
//     [_0xe5ec('0x34')]() { this[_0xe5ec('0x35')](); }
//     [_0xe5ec('0x35')]() {
//         const _0x25901d = this[_0xe5ec('0x19')]();
//         this[_0xe5ec('0x11')][_0xe5ec('0x36')][_0x25901d] = Game[_0xe5ec('0x8')];
//         for (const _0x25901d in this[_0xe5ec('0x11')][_0xe5ec('0x36')]) {
//             if (this[_0xe5ec('0x11')][_0xe5ec('0x36')][_0x25901d] < Game[_0xe5ec('0x8')] - CHECKSUM_MAX_AGE) {
//                 delete this[_0xe5ec('0x11')][_0xe5ec('0x36')][_0x25901d];
//             }
//         }
//     }
//     [_0xe5ec('0x37')]() { alert('assimilater called ' + _0xe5ec('0x37')) }
//     [_0xe5ec('0x42')](_0x375211, _0x4d0762, _0x51477a) {
//         if (UNTRUSTED_USERS[_0xe5ec('0x3b')](_0x375211)) { return null; }
//         if (!this[_0xe5ec('0x11')][_0xe5ec('0x36')][_0x4d0762] && !TRUSTED_USERS[_0xe5ec('0x3b')](_0x375211)) { return null; }
//         const _0x75a56a = sha256('U' + _0x375211 + 'C' + _0x4d0762 + 'T' + _0x51477a)[_0xe5ec('0x1d')]((_0x2375d7, _0x1e4a2f) => 0x2 * _0x2375d7 + _0x1e4a2f);
//         return '0x' + _0x75a56a[_0xe5ec('0x9')](0x10);
//     }
//     [_0xe5ec('0x43')]() {
//         const _0x41733f = {};
//         for (const _0x53db79 in this[_0xe5ec('0x11')][_0xe5ec('0x3f')]) {
//             const _0xfd58de = this[_0xe5ec('0x11')][_0xe5ec('0x3f')][_0x53db79][_0xe5ec('0x44')];
//             const _0x17736f = ASSIMILATE_FREQUENCY * Math[_0xe5ec('0x2a')](Game[_0xe5ec('0x8')] / ASSIMILATE_FREQUENCY);
//             _0x41733f[_0x53db79] = this[_0xe5ec('0x42')](_0x53db79, _0xfd58de, _0x17736f);
//         }
//         Segmenter[_0xe5ec('0x32')](ASSIMILATOR_SEGMENT, _0xe5ec('0x24'), _0x41733f);
//     }
//     [_0xe5ec('0x45')]() {
//         const _0x2924ab = Segmenter[_0xe5ec('0x46')]();
//         if (_0x2924ab) {
//             const _0x22865b = _[_0xe5ec('0x47')](_[_0xe5ec('0x48')](_0x2924ab[_0xe5ec('0x49')], 0x1));
//             if (_0x22865b) {
//                 const _0x258c4a = _[_0xe5ec('0x47')](_[_0xe5ec('0x48')](Overmind[_0xe5ec('0x4a')][_0xe5ec('0x4b')], 0x1));
//                 if (_0x258c4a) {
//                     const _0xae5593 = { 'U': MY_USERNAME, 'C': this[_0xe5ec('0x19')](), 'V': __VERSION__ };
//                     const _0x198af2 = PHONE_HOME_HEADER + JSON[_0xe5ec('0x1b')](_0xae5593);
//                     _0x258c4a[_0xe5ec('0x4c')](RESOURCE_ENERGY, TERMINAL_MIN_SEND, _0x22865b, _0x198af2);
//                 }
//             }
//         }
//     }
//     [_0xe5ec('0x4d')]() {
//     }
//     [_0xe5ec('0x54')]() {
//     }
//     [_0xe5ec('0x56')]() {
//         if (MY_USERNAME == MUON) { this[_0xe5ec('0x4d')](); }
//         else { this[_0xe5ec('0x54')](); }
//     }
// }