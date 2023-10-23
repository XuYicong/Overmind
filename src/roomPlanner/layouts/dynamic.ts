import { StructureLayout } from "roomPlanner/RoomPlanner";

export const evolutionChamberLayout: StructureLayout = {
	data: {
		anchor: {'x': 25, 'y': 25}
	},
	6   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '6',
		'buildings': {
			'lab'      : {
				'pos': [{ 'x': 27, 'y': 25 },{ 'x': 27, 'y': 24 },{ 'x': 26, 'y': 24 },]
			},
		}
	},
	7   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '7',
		'buildings': {
			'lab'      : {
				'pos': [{ 'x': 27, 'y': 25 },{ 'x': 27, 'y': 24 },{ 'x': 26, 'y': 24 },
                    { 'x': 24, 'y': 24 },{ 'x': 25, 'y': 25 },{ 'x': 26, 'y': 26 },]
			},
		}
	},
	8   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '8',
		'buildings': {
			'lab'      : {
				'pos': [{ 'x': 27, 'y': 25 },{ 'x': 27, 'y': 24 },{ 'x': 26, 'y': 24 },
                    { 'x': 24, 'y': 24 },{ 'x': 25, 'y': 25 },{ 'x': 26, 'y': 26 },
                    { 'x': 27, 'y': 27 },{ 'x': 24, 'y': 27 },{ 'x': 25, 'y': 27 },{ 'x': 24, 'y': 26 },]
			},
        }
	}
};

export const dynamicLayout: StructureLayout = {
	data: {
		anchor: {'x': 25, 'y': 25}
	},
	1   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '1',
		'buildings': {
			'spawn': {'pos': [{'x': 26, 'y': 24}]}
		}
	},
	2   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '2',
		'buildings': {
			// 'extension': {
			// 	'pos': [{'x': 27, 'y': 27}, {'x': 23, 'y': 27}, {'x': 27, 'y': 23}, 
            //     {'x': 23, 'y': 23}]
			// },
			'spawn': {'pos': [{'x': 26, 'y': 24}]},
			'container': {'pos': [{'x': 26, 'y': 27}]}
		}
	},
	3   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '3',
		'buildings': {
			'tower'    : {'pos': [{'x': 25, 'y': 26}]},
			// 'extension': {
			// 	'pos': [{'x': 27, 'y': 27}, {'x': 23, 'y': 27}, {'x': 27, 'y': 23}, 
            //     {'x': 23, 'y': 23}]
			// },
			'spawn': {'pos': [{'x': 26, 'y': 24}]},
			'container': {'pos': [{'x': 26, 'y': 27}]}
		}
	},
	4   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '4',
		'buildings': {
			'storage'   : {'pos': [{'x': 24, 'y': 25}]},
			'terminal'  : {'pos': []},
			'nuker'     : {'pos': []},
			'tower'     : {'pos': [{'x': 25, 'y': 26}]},
			'powerSpawn': {'pos': []},
			'link'      : {'pos': []},
			'road'      : {
				'pos': [{ 'x': 25, 'y': 27 },{ 'x': 26, 'y': 27 },{ 'x': 27, 'y': 26 },
						{ 'x': 25, 'y': 23 },{ 'x': 26, 'y': 23 },{ 'x': 27, 'y': 24 },{ 'x': 27, 'y': 25 },
						{ 'x': 24, 'y': 27 },{ 'x': 23, 'y': 26 },
						{ 'x': 24, 'y': 23 },{ 'x': 23, 'y': 24 },{ 'x': 23, 'y': 25 },]
			},
			'observer'  : {'pos': []},
			'lab'       : {'pos': []},
			// 'extension' : {
			// 	'pos': [{'x': 27, 'y': 27}, {'x': 23, 'y': 27}, {'x': 27, 'y': 23}, 
            //     {'x': 23, 'y': 23}]
			// },
			'spawn': {'pos': [{'x': 26, 'y': 24}]},
			'container': {'pos': [{'x': 26, 'y': 27}]}
		}
	},
	5   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '5',
		'buildings': {
			'storage'   : {'pos': [{'x': 24, 'y': 25}]},
			'terminal'  : {'pos': []},
			'nuker'     : {'pos': []},
			'tower'     : {'pos': [{'x': 25, 'y': 26}]},
			'powerSpawn': {'pos': []},
			'link'      : {'pos': [{'x': 26, 'y': 26}]},
			'road'      : {
				'pos': [{ 'x': 25, 'y': 27 },{ 'x': 26, 'y': 27 },{ 'x': 27, 'y': 26 },
						{ 'x': 25, 'y': 23 },{ 'x': 26, 'y': 23 },{ 'x': 27, 'y': 24 },{ 'x': 27, 'y': 25 },
						{ 'x': 24, 'y': 27 },{ 'x': 23, 'y': 26 },
						{ 'x': 24, 'y': 23 },{ 'x': 23, 'y': 24 },{ 'x': 23, 'y': 25 },]
			},
			'observer'  : {'pos': []},
			'lab'       : {'pos': []},
			// 'extension' : {
			// 	'pos': [{'x': 27, 'y': 27}, {'x': 23, 'y': 27}, {'x': 27, 'y': 23}, 
            //     {'x': 23, 'y': 23}]
			// },
			'spawn': {'pos': [{'x': 26, 'y': 24}]},
			// 'container': {'pos': [{'x': 26, 'y': 27}]}
		}
	},
	6   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '6',
		'buildings': {
			'storage'   : {'pos': [{'x': 24, 'y': 25}]},
			'terminal'  : {'pos': [{'x': 26, 'y': 25}]},
			'nuker'     : {'pos': []},
			'tower'     : {'pos': [{'x': 25, 'y': 26}]},
			'powerSpawn': {'pos': []},
			'link'      : {'pos': [{'x': 26, 'y': 26}]},
			'road'      : {
				'pos': [{ 'x': 25, 'y': 27 },{ 'x': 26, 'y': 27 },{ 'x': 27, 'y': 26 },
						{ 'x': 25, 'y': 23 },{ 'x': 26, 'y': 23 },{ 'x': 27, 'y': 24 },{ 'x': 27, 'y': 25 },
						{ 'x': 24, 'y': 27 },{ 'x': 23, 'y': 26 },
						{ 'x': 24, 'y': 23 },{ 'x': 23, 'y': 24 },{ 'x': 23, 'y': 25 },]
			},
			'observer'  : {'pos': []},
			// 'extension' : {
			// 	'pos': [{'x': 27, 'y': 27}, {'x': 23, 'y': 27}, {'x': 27, 'y': 23}, 
            //     {'x': 23, 'y': 23}]
			// },
			'spawn': {'pos': [{'x': 26, 'y': 24}]},
			// 'container': {'pos': [{'x': 26, 'y': 27}]}
		}
	},
	7   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '7',
		'buildings': {
			'storage'   : {'pos': [{'x': 24, 'y': 25}]},
			'terminal'  : {'pos': [{'x': 26, 'y': 25}]},
			'factory'	: {'pos': [{'x': 24, 'y': 24}]},
			'tower'     : {'pos': [{'x': 25, 'y': 26}]},
			'powerSpawn': {'pos': []},
			'link'      : {'pos': [{'x': 26, 'y': 26}]},
			'road'      : {
				'pos': [{ 'x': 25, 'y': 27 },{ 'x': 26, 'y': 27 },{ 'x': 27, 'y': 26 },
						{ 'x': 25, 'y': 23 },{ 'x': 26, 'y': 23 },{ 'x': 27, 'y': 24 },{ 'x': 27, 'y': 25 },
						{ 'x': 24, 'y': 27 },{ 'x': 23, 'y': 26 },
						{ 'x': 24, 'y': 23 },{ 'x': 23, 'y': 24 },{ 'x': 23, 'y': 25 },]
			},
			// 'extension' : {
			// 	'pos': [{'x': 27, 'y': 27}, {'x': 23, 'y': 27}, {'x': 27, 'y': 23}, 
            //     {'x': 23, 'y': 23}]
			// },
			'spawn': {'pos': [{'x': 26, 'y': 24}]},
			// 'container' : {'pos': [{'x': 27, 'y': 26}, {'x': 26, 'y': 27}]}
		}
	},
	8   : {
		'name'     : 'bunkerCore',
		'shard'    : 'shard2',
		'rcl'      : '8',
		'buildings': {
			'storage'   : {'pos': [{'x': 24, 'y': 25}]},
			'terminal'  : {'pos': [{'x': 26, 'y': 25}]},
			'factory'	: {'pos': [{'x': 24, 'y': 24}]},
			'nuker'		: {'pos': [{'x': 25, 'y': 24}]},
			'tower'     : {
				'pos': [{'x': 25, 'y': 26}]
			},
			'powerSpawn': {'pos': [{'x': 24, 'y': 26}]},
			'link'      : {'pos': [{'x': 26, 'y': 26}]},
			'road'      : {
				'pos': [{ 'x': 25, 'y': 27 },{ 'x': 26, 'y': 27 },{ 'x': 27, 'y': 26 },
						{ 'x': 25, 'y': 23 },{ 'x': 26, 'y': 23 },{ 'x': 27, 'y': 24 },{ 'x': 27, 'y': 25 },
						{ 'x': 24, 'y': 27 },{ 'x': 23, 'y': 26 },
						{ 'x': 24, 'y': 23 },{ 'x': 23, 'y': 24 },{ 'x': 23, 'y': 25 },]
			},
			// 'extension' : {
			// 	'pos': [{'x': 27, 'y': 27}, {'x': 23, 'y': 27}, {'x': 27, 'y': 23}, 
            //     {'x': 23, 'y': 23}]
			// },
			'spawn': {'pos': [{'x': 26, 'y': 24}]},
			// 'container' : {'pos': [{'x': 27, 'y': 26}, {'x': 26, 'y': 27}]}
		}
	}
};