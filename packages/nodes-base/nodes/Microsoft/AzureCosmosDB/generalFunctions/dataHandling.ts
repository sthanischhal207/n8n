import { ApplicationError, NodeApiError, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';

import { fetchPartitionKeyField } from './dataFetching';

export async function validateQueryParameters(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const query = this.getNodeParameter('query', '') as string;
	const queryOptions = this.getNodeParameter('options', {}) as IDataObject;

	const parameterNames = query.match(/@\w+/g) ?? [];
	const parameterValues =
		(queryOptions?.queryParameters as string).split(',').map((param: string) => param.trim()) ?? [];

	if (parameterNames.length !== parameterValues.length) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: `Expected ${parameterNames.length} query parameters, but got ${parameterValues.length}.`,
				description:
					'Ensure that the number of query parameters matches the number of values provided.',
			},
		);
	}

	requestOptions.body = {
		...(requestOptions.body as IDataObject),
		parameters: parameterNames.map((name, index) => ({
			name,
			value: isNaN(Number(parameterValues[index]))
				? parameterValues[index]
				: Number(parameterValues[index]),
		})),
	};

	return requestOptions;
}

export function parseCustomProperties(this: IExecuteSingleFunctions): IDataObject {
	const customProperties = this.getNodeParameter('customProperties', {});

	if (
		customProperties &&
		(Object.keys(customProperties).length === 2 || Object.keys(customProperties).length === 0)
	) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'No custom property provided',
				description: 'Custom properties must contain at least one field to update',
			},
		);
	}

	try {
		return typeof customProperties === 'string' ? JSON.parse(customProperties) : customProperties;
	} catch {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Invalid item contents format',
				description: 'Item contents must be a valid JSON object.',
			},
		);
	}
}

export async function validatePartitionKey(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const operation = this.getNodeParameter('operation') as string;
	const customProperties = this.getNodeParameter('customProperties', {});

	const partitionKeyResult = await fetchPartitionKeyField.call(this);
	const partitionKeyField =
		partitionKeyResult.results.length > 0 ? partitionKeyResult.results[0].value : '';

	if (!partitionKeyField) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Partition key not found',
				description: 'Failed to determine the partition key for this collection.',
			},
		);
	}

	if (!(typeof partitionKeyField === 'string' || typeof partitionKeyField === 'number')) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Invalid partition key',
				description: `Partition key must be a string or number, but got ${typeof partitionKeyField}.`,
			},
		);
	}

	let parsedProperties: IDataObject;

	try {
		parsedProperties =
			typeof customProperties === 'string' ? JSON.parse(customProperties) : customProperties;
	} catch (error) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Invalid custom properties format',
				description: 'Custom properties must be a valid JSON object.',
			},
		);
	}
	let id;
	let partitionKeyValue;

	if (operation === 'create') {
		if (partitionKeyField === 'id') {
			partitionKeyValue = this.getNodeParameter('newId', '');
		} else {
			if (!Object.prototype.hasOwnProperty.call(parsedProperties, partitionKeyField)) {
				throw new NodeApiError(
					this.getNode(),
					{},
					{
						message: 'Partition key not found in custom properties',
						description: `Partition key "${partitionKeyField}" must be present and have a valid, non-empty value in custom properties.`,
					},
				);
			}
			partitionKeyValue = parsedProperties[partitionKeyField];
		}
	} else if (operation === 'update') {
		const additionalFields = this.getNodeParameter('additionalFields', {}) as IDataObject;
		partitionKeyValue = additionalFields.partitionKey;

		if (!partitionKeyValue && partitionKeyField !== 'id') {
			throw new NodeApiError(
				this.getNode(),
				{},
				{
					message: `Partition key "${partitionKeyField}" is required for update`,
					description: `Please provide a valid value for partition key "${partitionKeyField}".`,
				},
			);
		}

		if (partitionKeyField === 'id') {
			partitionKeyValue = (this.getNodeParameter('id', {}) as IDataObject).value as string;
		}

		let requestBody: IDataObject;
		if (typeof requestOptions.body === 'string') {
			try {
				requestBody = JSON.parse(requestOptions.body);
			} catch (error) {
				throw new NodeOperationError(this.getNode(), 'Failed to parse requestOptions.body');
			}
		} else {
			requestBody = (requestOptions.body as IDataObject) || {};
		}

		requestOptions.body = JSON.stringify({
			...requestBody,
			[partitionKeyField]: partitionKeyValue,
		});
	} else {
		if (partitionKeyField === 'id') {
			id = (this.getNodeParameter('id', {}) as IDataObject).value as string;
			if (!id) {
				throw new NodeApiError(
					this.getNode(),
					{},
					{
						message: 'Item is missing or invalid',
						description: "The item must have a valid value selected from 'Item'",
					},
				);
			}
			partitionKeyValue = id;
		} else {
			const additionalFields = this.getNodeParameter('additionalFields', {}) as IDataObject;
			partitionKeyValue = additionalFields.partitionKey;
		}
	}

	if (partitionKeyValue === undefined || partitionKeyValue === null || partitionKeyValue === '') {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Partition key value is missing or empty',
				description: `Provide a value for partition key "${partitionKeyField}" in "Partition Key" field.`,
			},
		);
	}

	requestOptions.headers = {
		...requestOptions.headers,
		'x-ms-documentdb-partitionkey': `["${partitionKeyValue}"]`,
	};

	return requestOptions;
}

export async function validateContainerFields(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const { offerThroughput: manualThroughput, maxThroughput: autoscaleThroughput } =
		this.getNodeParameter('additionalFields', {}) as IDataObject;

	if (manualThroughput && autoscaleThroughput) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Bad parameter',
				description: 'Please choose only one of Max RU/s (Autoscale) and Manual Throughput RU/s',
			},
		);
	}

	requestOptions.headers = {
		...requestOptions.headers,
		...(autoscaleThroughput && {
			'x-ms-cosmos-offer-autopilot-setting': { maxThroughput: autoscaleThroughput },
		}),
		...(manualThroughput && { 'x-ms-offer-throughput': manualThroughput }),
	};

	return requestOptions;
}

export async function formatCustomProperties(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const parsedProperties = parseCustomProperties.call(this);

	const operation = this.getNodeParameter('operation') as string;

	if (operation === 'update') {
		const itemId = (this.getNodeParameter('id', {}) as IDataObject).value as string;

		if (!itemId || typeof itemId !== 'string') {
			throw new NodeApiError(
				this.getNode(),
				{},
				{
					message: 'Missing or invalid "id" field for update operation.',
					description: 'The "id" must be provided separately when updating an item.',
				},
			);
		}

		parsedProperties.id = itemId;
	}

	if (!parsedProperties.id || typeof parsedProperties.id !== 'string') {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Missing or invalid "id" field.',
				description: 'The "customProperties" JSON must contain an "id" field as a string.',
			},
		);
	}

	if (/\s/.test(parsedProperties.id)) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Invalid ID format: IDs cannot contain spaces.',
				description: 'Use an underscore (_) or another separator instead.',
			},
		);
	}

	if (
		!requestOptions.body ||
		typeof requestOptions.body !== 'object' ||
		requestOptions.body === null
	) {
		requestOptions.body = {};
	}

	Object.assign(requestOptions.body, parsedProperties);

	return requestOptions;
}

export async function formatJSONFields(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const additionalFields = this.getNodeParameter('additionalFields', {}) as IDataObject;
	const rawPartitionKey = additionalFields.partitionKey as string | undefined;
	const indexingPolicy = additionalFields.indexingPolicy as string;

	const parseJSON = (
		jsonString: string | undefined,
		defaultValue: IDataObject = {},
	): IDataObject => {
		if (!jsonString) return defaultValue;
		try {
			return JSON.parse(jsonString);
		} catch {
			throw new NodeApiError(
				this.getNode(),
				{},
				{
					message: 'Invalid JSON format',
					description:
						'Please provide valid JSON objects for "Partition Key" or "Indexing Policy".',
				},
			);
		}
	};

	const defaultPartitionKey = { paths: ['/id'], kind: 'Hash', version: 2 };
	const parsedPartitionKey = parseJSON(rawPartitionKey, defaultPartitionKey);
	const parsedIndexPolicy = parseJSON(indexingPolicy);

	if (
		!requestOptions.body ||
		typeof requestOptions.body !== 'object' ||
		requestOptions.body === null
	) {
		requestOptions.body = {};
	}

	(requestOptions.body as IDataObject).partitionKey = parsedPartitionKey;
	if (Object.keys(parsedIndexPolicy).length > 0) {
		(requestOptions.body as IDataObject).indexingPolicy = parsedIndexPolicy;
	}

	return requestOptions;
}

export async function processResponseItems(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (!response || typeof response !== 'object' || !Array.isArray(items)) {
		throw new ApplicationError('Invalid response format from Cosmos DB.');
	}

	const extractedDocuments = items.flatMap((item) => {
		if (item.json && typeof item.json === 'object' && Array.isArray(item.json.Documents)) {
			return item.json.Documents.map((doc) => ({
				...doc,
			}));
		}
		return [];
	});

	return extractedDocuments.length ? extractedDocuments : [{ json: {} }];
}

export async function processResponseContainers(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (!response || typeof response !== 'object' || !Array.isArray(items)) {
		throw new ApplicationError('Invalid response format from Cosmos DB.');
	}

	const data = response.body as IDataObject;
	const documentCollections = (data.DocumentCollections as IDataObject[]) ?? [];

	return documentCollections.length > 0 ? documentCollections.map((doc) => ({ json: doc })) : [];
}

export async function simplifyData(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	_response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const simple = this.getNodeParameter('simple');
	if (!simple) {
		return items;
	}

	const simplifyFields = (data: IDataObject): IDataObject => {
		const simplifiedData = Object.keys(data)
			.filter((key) => !key.startsWith('_'))
			.reduce((acc, key) => {
				acc[key] = data[key];
				return acc;
			}, {} as IDataObject);

		return simplifiedData;
	};

	return items.map((item) => {
		const simplifiedData = simplifyFields(item.json || item);
		return { json: simplifiedData };
	});
}
