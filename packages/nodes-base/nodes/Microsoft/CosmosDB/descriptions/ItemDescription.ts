import type { INodeProperties } from 'n8n-workflow';

import {
	formatCustomProperties,
	handlePagination,
	processResponseItems,
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
						//To-Do-do it based on the partition key of collection and only one
						headers: {
							'x-ms-documentdb-partitionkey': '=["{{$parameter["newId"]}}"]',
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
						//To-Do-do it based on the partition key of collection and only one
						headers: {
							'x-ms-documentdb-partitionkey': '=["{{$parameter["id"]}}"]',
						},
					},
					output: {
						postReceive: [
							{
								type: 'set',
								properties: {
									value: '={{ { "success": true } }}',
								},
							},
						],
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
						url: '=/colls/{{ $parameter["collId"]}}/docs/{{$parameter["id"]}}',
						headers: {
							//To-Do-do it based on the partition key of collection and only one
							'x-ms-documentdb-partitionkey': '=["{{$parameter["id"]}}"]',
							'x-ms-documentdb-is-upsert': 'True',
						},
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
						postReceive: [processResponseItems],
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
		displayName: 'Container ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the container you want to use',
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
				displayName: 'By ID',
				name: 'containerId',
				type: 'string',
				hint: 'Enter the container ID',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The container id must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersContainer',
			},
		],
	},
	{
		displayName: 'ID',
		name: 'newId',
		type: 'string',
		default: '',
		placeholder: 'e.g. AndersenFamily',
		description: "Item's ID",
		required: true,
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['create'],
			},
		},
		routing: {
			send: {
				type: 'body',
				property: 'id',
				value: '={{$value}}',
			},
		},
	},
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
	},
];

export const deleteFields: INodeProperties[] = [
	{
		displayName: 'Container ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the container you want to use',
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
				displayName: 'By ID',
				name: 'containerId',
				type: 'string',
				hint: 'Enter the container id',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The container name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersContainer',
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
				displayName: 'By ID',
				name: 'itemId',
				type: 'string',
				hint: 'Enter the item id',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The item id must follow the allowed pattern.',
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
		displayName: 'Container ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the container you want to use',
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
				displayName: 'By ID',
				name: 'containerId',
				type: 'string',
				hint: 'Enter the container id',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The container name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersContainer',
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
				displayName: 'By ID',
				name: 'itemId',
				type: 'string',
				hint: 'Enter the item id',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The item id must follow the allowed pattern.',
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
		displayName: 'Container ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the container you want to use',
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
				displayName: 'By ID',
				name: 'containerId',
				type: 'string',
				hint: 'Enter the container id',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The container name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersContainer',
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
		displayName: 'Container ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the container you want to use',
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
				displayName: 'By ID',
				name: 'containerId',
				type: 'string',
				hint: 'Enter the container id',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The container id must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersContainer',
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
		displayName: 'Container ID',
		name: 'collId',
		type: 'resourceLocator',
		required: true,
		default: {
			mode: 'list',
			value: '',
		},
		description: 'Select the container you want to use',
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
				displayName: 'By ID',
				name: 'containerId',
				type: 'string',
				hint: 'Enter the container id',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The container name must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. UsersContainer',
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
				displayName: 'By ID',
				name: 'itemId',
				type: 'string',
				hint: 'Enter the item id',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The item id must follow the allowed pattern.',
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
							{ name: 'Set', value: 'set' },
						],
						default: 'set',
					},
					{
						displayName: 'From',
						name: 'from',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								op: ['move'],
							},
						},
					},
					{
						displayName: 'Path',
						name: 'path',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								op: ['add', 'set', 'increment'],
							},
						},
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
