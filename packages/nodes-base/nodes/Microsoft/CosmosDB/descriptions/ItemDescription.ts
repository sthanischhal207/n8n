import type { INodeProperties } from 'n8n-workflow';

import {
	formatCustomProperties,
	handlePagination,
	validateOperations,
	validateQueryParameters,
} from '../GenericFunctions';

export const itemOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['item'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new item',
				routing: {
					send: {
						preSend: [formatCustomProperties],
					},
					request: {
						ignoreHttpStatusErrors: true,
						method: 'POST',
						url: '=/colls/{{ $parameter["collId"] }}/docs',
						headers: {
							// 'x-ms-partitionkey': '=["{{$parameter["newId"]}}"]',
							// 'x-ms-documentdb-partitionkey': '=["{{$parameter["newId"]}}"]',
							'x-ms-documentdb-is-upsert': 'True',
						},
					},
				},
				action: 'Create item',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an existing item',
				routing: {
					request: {
						ignoreHttpStatusErrors: true,
						method: 'DELETE',
						url: '=/colls/{{ $parameter["collId"] }}/docs/{{ $parameter["id"] }}',
					},
				},
				action: 'Delete item',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve an item',
				routing: {
					request: {
						ignoreHttpStatusErrors: true,
						method: 'GET',
						url: '=/colls/{{ $parameter["collId"] }}/docs/{{ $parameter["id"] }}',
					},
				},
				action: 'Get item',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of items',
				routing: {
					send: {
						paginate: true,
					},
					operations: {
						pagination: handlePagination,
					},
					request: {
						ignoreHttpStatusErrors: true,
						method: 'GET',
						url: '=/colls/{{ $parameter["collId"] }}/docs',
					},
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
									property: 'json',
								},
							},
						],
					},
				},
				action: 'Get many items',
			},
			{
				name: 'Query',
				value: 'query',
				description: 'Query items',
				routing: {
					send: {
						preSend: [validateQueryParameters],
					},
					request: {
						ignoreHttpStatusErrors: true,
						method: 'POST',
						url: '=/colls/{{ $parameter["collId"] }}/docs',
						headers: {
							'Content-Type': 'application/query+json',
							'x-ms-documentdb-isquery': 'True',
						},
					},
				},
				action: 'Query items',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an existing item',
				routing: {
					send: {
						preSend: [validateOperations],
					},
					request: {
						ignoreHttpStatusErrors: true,
						method: 'PATCH',
						url: '=/colls/{{ $parameter["collId"] }}/docs/{{ $parameter["id"] }}',
						headers: {
							'Content-Type': 'application/json-patch+json',
							'x-ms-partitionkey': '=["{{$parameter["id"]}}"]',
							'x-ms-documentdb-partitionkey': '=["{{$parameter["id"]}}"]',
						},
					},
				},
				action: 'Update item',
			},
		],
		default: 'getAll',
	},
];

export const createFields: INodeProperties[] = [
	{
		displayName: 'Collection ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the collection you want to use',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['create'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchCollections',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'collectionName',
				type: 'string',
				hint: 'Enter the collection name',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The collection name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersCollection',
			},
		],
	},
	// {
	// 	displayName: 'ID',
	// 	name: 'newId',
	// 	type: 'string',
	// 	default: '',
	// 	placeholder: 'e.g. AndersenFamily',
	// 	description: "Item's ID",
	// 	required: true,
	// 	displayOptions: {
	// 		show: {
	// 			resource: ['item'],
	// 			operation: ['create'],
	// 		},
	// 	},
	// 	routing: {
	// 		send: {
	// 			type: 'body',
	// 			property: 'id',
	// 			value: '={{$value}}',
	// 		},
	// 	},
	// },
	{
		displayName: 'Custom Properties',
		name: 'customProperties',
		type: 'json',
		default: '{}',
		placeholder: '{ "LastName": "Andersen", "Address": { "State": "WA", "City": "Seattle" } }',
		description: 'User-defined JSON object representing the document properties',
		required: true,
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['create'],
			},
		},
		//To-Do-add preSend function
		routing: {
			send: {
				type: 'body',
				value: '={{$value}}',
			},
		},
	},
];

export const deleteFields: INodeProperties[] = [
	{
		displayName: 'Collection ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the collection you want to use',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['delete'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchCollections',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'collectionName',
				type: 'string',
				hint: 'Enter the collection name',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The collection name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersCollection',
			},
		],
	},
	{
		displayName: 'Item',
		name: 'id',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: "Select the item's ID",
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['delete'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchItems',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'itemName',
				type: 'string',
				hint: 'Enter the item name',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The item name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. AndersenFamily',
			},
		],
	},
];

export const getFields: INodeProperties[] = [
	{
		displayName: 'Collection ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the collection you want to use',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['get'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchCollections',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'collectionName',
				type: 'string',
				hint: 'Enter the collection name',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The collection name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersCollection',
			},
		],
	},
	{
		displayName: 'Item',
		name: 'id',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: "Select the item's ID",
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['get'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchItems',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'itemName',
				type: 'string',
				hint: 'Enter the item name',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The item name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. AndersenFamily',
			},
		],
	},
];

export const getAllFields: INodeProperties[] = [
	{
		displayName: 'Collection ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the collection you want to use',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['getAll'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchCollections',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'collectionName',
				type: 'string',
				hint: 'Enter the collection name',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The collection name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersCollection',
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['getAll'],
			},
		},
		type: 'boolean',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		routing: {
			send: {
				property: 'x-ms-max-item-count',
				type: 'query',
				value: '={{ $value }}',
			},
		},
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		validateType: 'number',
	},
];

export const queryFields: INodeProperties[] = [
	{
		displayName: 'Collection ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the collection you want to use',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['query'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchCollections',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'collectionName',
				type: 'string',
				hint: 'Enter the collection name',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The collection name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersCollection',
			},
		],
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['query'],
			},
		},
		placeholder: 'SELECT * FROM c WHERE c.name = @name',
		routing: {
			send: {
				type: 'body',
				property: 'query',
				value: '={{$value}}',
			},
		},
	},
	{
		displayName: 'Parameters',
		name: 'parameters',
		type: 'fixedCollection',
		required: true,
		default: [],
		placeholder: 'Add Parameter',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['query'],
			},
		},
		options: [
			{
				name: 'parameters',
				displayName: 'Parameter',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						placeholder: 'e.g., @name',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						placeholder: 'e.g., John',
					},
				],
			},
		],
		routing: {
			send: {
				type: 'body',
				property: 'parameters',
				value:
					'={{$parameter["parameters"] && $parameter["parameters"].parameters ? $parameter["parameters"].parameters : []}}',
			},
		},
	},
];

export const updateFields: INodeProperties[] = [
	{
		displayName: 'Collection ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the collection you want to use',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['update'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchCollections',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'collectionName',
				type: 'string',
				hint: 'Enter the collection name',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The collection name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersCollection',
			},
		],
	},
	{
		displayName: 'Item',
		name: 'id',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: "Select the item's ID",
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['update'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchItems',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'itemName',
				type: 'string',
				hint: 'Enter the item name',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The item name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. AndersenFamily',
			},
		],
	},
	{
		displayName: 'Operations',
		name: 'operations',
		type: 'fixedCollection',
		placeholder: 'Add Operation',
		description: 'Patch operations to apply to the document',
		required: true,
		default: [],
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['update'],
			},
		},
		options: [
			{
				name: 'operations',
				displayName: 'Operation',
				values: [
					{
						displayName: 'Operation',
						name: 'op',
						type: 'options',
						options: [
							{ name: 'Add', value: 'add' },
							{ name: 'Increment', value: 'increment' },
							{ name: 'Move', value: 'move' },
							{ name: 'Remove', value: 'remove' },
							{ name: 'Replace', value: 'replace' },
							{ name: 'Set', value: 'set' },
						],
						default: 'set',
					},
					{
						displayName: 'Path',
						name: 'path',
						type: 'string',
						default: '',
						placeholder: '/Parents/0/FamilyName',
						description: 'The path to the document field to be updated',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'The value to set (if applicable)',
					},
				],
			},
		],
		routing: {
			send: {
				type: 'body',
				property: 'operations',
				value: '={{ $parameter["operations"].operations }}',
			},
		},
	},
];

export const itemFields: INodeProperties[] = [
	...createFields,
	...deleteFields,
	...getFields,
	...getAllFields,
	...queryFields,
	...updateFields,
];
