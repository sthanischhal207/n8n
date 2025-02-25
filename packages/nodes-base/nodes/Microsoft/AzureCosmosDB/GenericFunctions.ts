import * as crypto from 'crypto';
import type {
	DeclarativeRestApiSettings,
	IDataObject,
	IExecutePaginationFunctions,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { ApplicationError, NodeApiError } from 'n8n-workflow';

export const HeaderConstants = {
	AUTHORIZATION: 'Authorization',
};

export function getAuthorizationTokenUsingMasterKey(
	verb: string,
	resourceType: string,
	resourceId: string,
	masterKey: string,
): string {
	const date = new Date().toUTCString().toLowerCase();

	const key = Buffer.from(masterKey, 'base64');
	const payload = `${verb.toLowerCase()}\n${resourceType.toLowerCase()}\n${resourceId}\n${date.toLowerCase()}\n\n`;
	const hmacSha256 = crypto.createHmac('sha256', key);
	const signature = hmacSha256.update(payload, 'utf8').digest('base64');

	return `type=master&ver=1.0&sig=${signature}`;
}

export async function makeAzureCosmosDbRequest(
	this: ILoadOptionsFunctions,
	opts: IHttpRequestOptions,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('microsoftAzureCosmosDbSharedKeyApi');
	const databaseAccount = credentials?.account;

	if (!databaseAccount) {
		throw new ApplicationError('Database account not found in credentials!', { level: 'error' });
	}

	const requestOptions: IHttpRequestOptions = {
		...opts,
		baseURL: `${credentials.baseUrl}`,
		headers: {
			...opts.headers,
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		json: true,
	};

	const errorMapping: Record<number, Record<string, string>> = {
		401: {
			'The security token included in the request is invalid.':
				'The Cosmos DB credentials are not valid!',
			'The request signature we calculated does not match the signature you provided':
				'The Cosmos DB credentials are not valid!',
		},
		403: {
			'The security token included in the request is invalid.':
				'The Cosmos DB credentials are not valid!',
			'The request signature we calculated does not match the signature you provided':
				'The Cosmos DB credentials are not valid!',
		},
		404: {
			'The specified resource does not exist.': 'The requested resource was not found!',
		},
	};

	try {
		return (await this.helpers.requestWithAuthentication.call(
			this,
			'microsoftAzureCosmosDbSharedKeyApi',
			requestOptions,
		)) as IDataObject;
	} catch (error) {
		const statusCode = (error.statusCode || error.cause?.statusCode) as number;
		let errorMessage = (error.response?.body?.message ||
			error.response?.body?.Message ||
			error.message) as string;

		if (statusCode in errorMapping && errorMessage in errorMapping[statusCode]) {
			throw new ApplicationError(errorMapping[statusCode][errorMessage], {
				level: 'error',
			});
		}

		if (error.cause?.error) {
			try {
				errorMessage = error.cause?.error?.message as string;
			} catch (ex) {
				throw new ApplicationError(
					`Failed to extract error details: ${ex.message || 'Unknown error'}`,
					{ level: 'error' },
				);
			}
		}

		throw new ApplicationError(`Cosmos DB error response [${statusCode}]: ${errorMessage}`, {
			level: 'error',
		});
	}
}

export async function fetchPartitionKeyField(
	this: ILoadOptionsFunctions,
): Promise<INodeListSearchResult> {
	const { value: collId } = this.getNodeParameter('collId', {}) as { value?: string };

	if (!collId) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Container is required to determine the partition key.',
				description: 'Please provide a value for the "Container" field.',
			},
		);
	}

	const responseData = (await makeAzureCosmosDbRequest.call(this, {
		method: 'GET',
		url: `/colls/${collId}`,
	})) as { partitionKey?: { paths?: string[] } };

	const partitionKeyField = responseData.partitionKey?.paths?.[0]?.replace('/', '');

	return {
		results: partitionKeyField ? [{ name: partitionKeyField, value: partitionKeyField }] : [],
	};
}

export async function validateQueryParameters(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const query = this.getNodeParameter('query', '') as string;
	const { queryOptions } = this.getNodeParameter('options', {}) as {
		queryOptions?: { queryParameters?: string };
	};

	const parameterNames = query.match(/@\w+/g) ?? [];
	const parameterValues =
		queryOptions?.queryParameters?.split(',').map((param) => param.trim()) ?? [];

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

function parseCustomProperties(this: IExecuteSingleFunctions): Record<string, unknown> {
	const customProperties = this.getNodeParameter('customProperties', {});

	if (!customProperties) return {};

	try {
		return typeof customProperties === 'string' ? JSON.parse(customProperties) : customProperties;
	} catch {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Invalid custom properties format',
				description: 'Custom properties must be a valid JSON object.',
			},
		);
	}
}

export async function validatePartitionKey(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const operation = this.getNodeParameter('operation') as string;

	const partitionKeyResult = await fetchPartitionKeyField.call(
		this as unknown as ILoadOptionsFunctions,
	);
	const partitionKeyField = partitionKeyResult.results?.[0]?.value ?? '';

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

	if (typeof partitionKeyField !== 'string' && typeof partitionKeyField !== 'number') {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Invalid partition key',
				description: `Partition key must be a string or number, but got ${typeof partitionKeyField}.`,
			},
		);
	}

	const parsedProperties = parseCustomProperties.call(this);

	const idParam = this.getNodeParameter('id', {}) as { mode: string; value: string };
	const partitionKeyValue: string | undefined =
		operation === 'create'
			? (parsedProperties[partitionKeyField as keyof typeof parsedProperties] as string)
			: idParam.value;

	if (!partitionKeyValue) {
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

export async function handlePagination(
	this: IExecutePaginationFunctions,
	resultOptions: DeclarativeRestApiSettings.ResultOptions,
): Promise<INodeExecutionData[]> {
	const aggregatedResult: IDataObject[] = [];
	let nextPageToken: string | undefined;
	const returnAll = this.getNodeParameter('returnAll') as boolean;
	let limit = 60;

	if (!returnAll) {
		limit = this.getNodeParameter('limit') as number;
		resultOptions.maxResults = limit;
	}

	resultOptions.paginate = true;

	do {
		if (nextPageToken) {
			resultOptions.options.headers = resultOptions.options.headers ?? {};
			resultOptions.options.headers['x-ms-continuation'] = nextPageToken;
		}

		const responseData = await this.makeRoutingRequest(resultOptions);

		if (Array.isArray(responseData)) {
			for (const responsePage of responseData) {
				aggregatedResult.push(responsePage);

				if (!returnAll && aggregatedResult.length >= limit) {
					return aggregatedResult.slice(0, limit).map((result) => ({ json: result }));
				}
			}
		}

		if (responseData.length > 0) {
			const lastItem = responseData[responseData.length - 1];

			if ('headers' in lastItem) {
				const headers = (lastItem as unknown as { headers: { [key: string]: string } }).headers;

				if (headers) {
					nextPageToken = headers['x-ms-continuation'] as string | undefined;
				}
			}
		}

		if (!nextPageToken) {
			break;
		}
	} while (nextPageToken);

	return aggregatedResult.map((result) => ({ json: result }));
}

export async function handleErrorPostReceive(
	this: IExecuteSingleFunctions,
	data: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (String(response.statusCode).startsWith('4') || String(response.statusCode).startsWith('5')) {
		const responseBody = response.body as IDataObject;

		let errorMessage;
		let errorDescription;

		if (typeof responseBody === 'object' && responseBody !== null) {
			if (typeof responseBody.code === 'string') {
				errorMessage = responseBody.code;
			}
			if (typeof responseBody.message === 'string') {
				const match = responseBody.message.match(/"Errors":\["(.*?)"\]/);
				errorDescription = match ? match[1] : 'An unexpected error was encountered.';
			}
		}

		if (errorDescription?.includes('Too many partition key paths')) {
			errorMessage = 'Partition key error';
		} else {
		}

		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: errorMessage,
				description: errorDescription,
			},
		);
	}
	return data;
}

async function fetchData(
	this: ILoadOptionsFunctions,
	url: string,
	key: 'DocumentCollections' | 'Documents',
): Promise<IDataObject[]> {
	const opts: IHttpRequestOptions = { method: 'GET', url };
	const responseData = (await makeAzureCosmosDbRequest.call(this, opts)) as IDataObject;

	const data = responseData[key];
	return Array.isArray(data) ? data : [];
}

function formatResults(items: IDataObject[], filter?: string): INodeListSearchItems[] {
	return items
		.map(({ id }) => ({
			name: String(id).replace(/ /g, ''),
			value: String(id),
		}))
		.filter(({ name }) => !filter || name.includes(filter))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchContainers(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const collections = await fetchData.call(this, '/colls', 'DocumentCollections');
	return { results: formatResults(collections, filter) };
}

export async function searchItems(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const collection = this.getNodeParameter('collId') as { mode: string; value: string };

	if (!collection?.value) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Container is required',
				description: 'Please provide a value for container in "Container" field',
			},
		);
	}

	const items = await fetchData.call(this, `/colls/${collection.value}/docs`, 'Documents');
	return { results: formatResults(items, filter) };
}

export async function presendLimitField(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const returnAll = this.getNodeParameter('returnAll');
	const limit = !returnAll ? this.getNodeParameter('limit') : undefined;

	if (!returnAll && !limit) {
		throw new NodeApiError(
			this.getNode(),
			{},
			{
				message: 'Limit value not found',
				description:
					'Please provide a value for "Limit" or set "Return All" to true to return all results',
			},
		);
	}

	if (limit) {
		requestOptions.headers = {
			...requestOptions.headers,
			'x-ms-max-item-count': limit,
		};
	}

	return requestOptions;
}

export async function formatCustomProperties(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const parsedProperties = parseCustomProperties.call(this);

	const operation = this.getNodeParameter('operation') as string;

	if (operation === 'update') {
		const itemIdRaw = this.getNodeParameter('id') as { mode: string; value: string };
		const itemId = itemIdRaw.value;

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

	if (/\s/.test(parsedProperties.id as string)) {
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

	Object.assign(requestOptions.body as Record<string, unknown>, parsedProperties);

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
		defaultValue: Record<string, unknown> = {},
	): Record<string, unknown> => {
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

	(requestOptions.body as Record<string, unknown>).partitionKey = parsedPartitionKey;
	if (Object.keys(parsedIndexPolicy).length > 0) {
		(requestOptions.body as Record<string, unknown>).indexingPolicy = parsedIndexPolicy;
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

	const data = response.body as { DocumentCollections: IDataObject[] };
	const documentCollections = data.DocumentCollections || [];

	return documentCollections.length > 0 ? documentCollections.map((doc) => ({ json: doc })) : [];
}

export async function simplifyData(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	_response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const simple = this.getNodeParameter('simple') as boolean;
	const resource = this.getNodeParameter('resource');

	if (!simple) {
		return items;
	}

	const simplifyFields = (data: IDataObject): IDataObject => {
		const commonFields = {
			_rid: undefined,
			_ts: undefined,
			_self: undefined,
			_etag: undefined,
		};

		const containerFields = {
			_docs: undefined,
			_sprocs: undefined,
			_triggers: undefined,
			_udfs: undefined,
			_conflicts: undefined,
		};

		const itemFields = {
			_attachments: undefined,
		};

		const fieldsToRemove =
			resource === 'container'
				? { ...commonFields, ...containerFields }
				: { ...commonFields, ...itemFields };

		const simplifiedData = Object.keys(data)
			.filter((key) => !(key in fieldsToRemove))
			.reduce((acc, key) => {
				acc[key] = data[key];
				return acc;
			}, {} as IDataObject);

		return simplifiedData;
	};

	return items.map((item) => {
		const simplifiedData = simplifyFields(item.json || item);
		if (items.length === 1) return { json: simplifiedData } as INodeExecutionData;
		return { ...simplifiedData } as INodeExecutionData;
	});
}
