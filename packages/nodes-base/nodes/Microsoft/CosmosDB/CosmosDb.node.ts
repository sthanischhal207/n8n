import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import { containerFields, containerOperations } from './descriptions/ContainerDescription';
import { itemFields, itemOperations } from './descriptions/ItemDescription';
import { searchCollections } from './GenericFunctions';

export class AzureCosmosDb implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cosmos DB',
		name: 'cosmosDb',
		icon: {
			light: 'file:CosmosDB.svg',
			dark: 'file:CosmosDB.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Azure Cosmos DB API',
		defaults: {
			name: 'Azure Cosmos Db',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'microsoftCosmosDbSharedKeyApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['sharedKey'],
					},
				},
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'Shared Key',
						value: 'sharedKey',
					},
				],
				default: 'sharedKey',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Container',
						value: 'container',
					},
					{
						name: 'Item',
						value: 'item',
					},
				],
				default: 'container',
			},
			...itemOperations,
			...itemFields,
			...containerOperations,
			...containerFields,
		],
	};

	methods = {
		listSearch: {
			searchCollections,
		},
	};
}
