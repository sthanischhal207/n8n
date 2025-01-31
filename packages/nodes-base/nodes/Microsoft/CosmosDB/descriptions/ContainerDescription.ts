import type { INodeProperties } from 'n8n-workflow';

export const containerOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['container'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a container',
				routing: {
					request: {
						ignoreHttpStatusErrors: true,
						method: 'POST',
						url: '/colls',
					},
				},
				action: 'Create container',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a container',
				routing: {
					request: {
						ignoreHttpStatusErrors: true,
						method: 'DELETE',
						url: '=/colls/{{ $parameter["collId"] }}',
					},
				},
				action: 'Delete container',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a container',
				routing: {
					request: {
						ignoreHttpStatusErrors: true,
						method: 'GET',
						url: '=/colls/{{ $parameter["collId"] }}',
					},
				},
				action: 'Get container',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of containers',
				routing: {
					request: {
						ignoreHttpStatusErrors: true,
						method: 'GET',
						url: '/colls',
					},
				},
				action: 'Get many containers',
			},
		],
		default: 'getAll',
	},
];

export const createFields: INodeProperties[] = [
	{
		displayName: 'ID',
		name: 'id',
		type: 'string',
		default: '',
		placeholder: 'e.g. AndersenFamily',
		description: "Container's ID",
		required: true,
		displayOptions: {
			show: {
				resource: ['container'],
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
		displayName: 'Partition Key',
		name: 'partitionKey',
		type: 'json',
		default: '{}',
		placeholder: '"paths": ["/AccountNumber"],"kind": "Hash", "Version": 2',
		description: 'User-defined JSON object representing the partition key',
		required: true,
		displayOptions: {
			show: {
				resource: ['container'],
				operation: ['create'],
			},
		},
		routing: {
			send: {
				type: 'body',
				property: 'partitionKey',
				value: '={{$value}}',
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		default: {},
		displayOptions: {
			show: {
				resource: ['container'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Indexing Policy',
				name: 'indexingPolicy',
				type: 'json',
				default: '{}',
				placeholder:
					'"automatic": true, "indexingMode": "Consistent", "includedPaths": [{ "path": "/*", "indexes": [{ "dataType": "String", "precision": -1, "kind": "Range" }]}]',
				description: 'This value is used to configure indexing policy',
				routing: {
					send: {
						type: 'body',
						property: 'indexingPolicy',
						value: '={{$value}}',
					},
				},
			},
			{
				displayName: 'Max RU/s (for Autoscale)',
				name: 'maxThroughput',
				type: 'number',
				default: 1000,
				description: 'The user specified autoscale max RU/s',
				displayOptions: {
					show: {
						offerThroughput: [undefined],
					},
				},
				routing: {
					send: {
						type: 'query',
						property: 'x-ms-cosmos-offer-autopilot-settings',
						value: '={{"{"maxThroughput": " + $value + "}"}',
					},
				},
			},
			{
				displayName: 'Max RU/s (for Manual Throughput)',
				name: 'offerThroughput',
				type: 'number',
				default: 400,
				description:
					'The user specified manual throughput (RU/s) for the collection expressed in units of 100 request units per second',
				displayOptions: {
					show: {
						maxThroughput: [undefined],
					},
				},
				routing: {
					send: {
						type: 'query',
						property: 'x-ms-offer-throughput',
						value: '={{$value}}',
					},
				},
			},
		],
		placeholder: 'Add Option',
		type: 'collection',
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
		description: 'Select the container you want to retrieve',
		displayOptions: {
			show: {
				resource: ['container'],
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
				hint: 'Enter the container ID',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The container ID must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. AndersenFamily',
			},
		],
	},
];

export const getAllFields: INodeProperties[] = [];

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
		description: 'Select the container you want to delete',
		displayOptions: {
			show: {
				resource: ['container'],
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
				hint: 'Enter the container ID',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[\\w+=,.@-]+$',
							errorMessage: 'The container ID must follow the allowed pattern.',
						},
					},
				],
				placeholder: 'e.g. AndersenFamily',
			},
		],
	},
];

export const containerFields: INodeProperties[] = [
	...createFields,
	...deleteFields,
	...getFields,
	...getAllFields,
];
