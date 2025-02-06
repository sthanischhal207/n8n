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
import { ApplicationError } from 'n8n-workflow';

export const HeaderConstants = {
	// Required
	AUTHORIZATION: 'Authorization',
	CONTENT_TYPE: 'Content-Type',
	X_MS_DATE: 'x-ms-date',
	X_MS_VERSION: 'x-ms-version',

	//Required - for session consistency only
	X_MS_SESSION_TOKEN: 'x-ms-session-token',

	// Optional
	IF_MATCH: 'If-Match',
	IF_NONE_MATCH: 'If-None-Match',
	IF_MODIFIED_SINCE: 'If-Modified-Since',
	USER_AGENT: 'User-Agent',
	X_MS_ACTIVITY_ID: 'x-ms-activity-id',
	X_MS_CONSISTENCY_LEVEL: 'x-ms-consistency-level',
	X_MS_CONTINUATION: 'x-ms-continuation',
	X_MS_MAX_ITEM_COUNT: 'x-ms-max-item-count',
	X_MS_DOCUMENTDB_PARTITIONKEY: 'x-ms-documentdb-partitionkey',
	X_MS_DOCUMENTDB_ISQUERY: 'x-ms-documentdb-isquery',
	X_MS_DOCUMENTDB_QUERY_ENABLECROSSPARTITION: 'x-ms-documentdb-query-enablecrosspartition',
	A_IM: 'A-IM',
	X_MS_DOCUMENTDB_PARTITIONKEYRANGEID: 'x-ms-documentdb-partitionkeyrangeid',
	X_MS_COSMOS_ALLOW_TENTATIVE_WRITES: 'x-ms-cosmos-allow-tentative-writes',

	PREFIX_FOR_STORAGE: 'x-ms-',
};

export function getAuthorizationTokenUsingMasterKey(
	verb: string,
	resourceType: string,
	resourceId: string,
	date: string,
	masterKey: string,
): string {
	const key = Buffer.from(masterKey, 'base64');
	const payload =
		`${verb.toLowerCase()}\n` +
		`${resourceType.toLowerCase()}\n` +
		`${resourceId}\n` +
		`${date.toLowerCase()}\n` +
		'\n';

	const hmacSha256 = crypto.createHmac('sha256', key);
	const signature = hmacSha256.update(payload, 'utf8').digest('base64');

	return `type=master&ver=1.0&sig=${signature}`;
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

		//TO-DO-check-if-works
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

		let errorMessage = 'Unknown error occurred';

		if (typeof responseBody.message === 'string') {
			try {
				const jsonMatch = responseBody.message.match(/Message: (\{.*\})/);

				if (jsonMatch && jsonMatch[1]) {
					const parsedMessage = JSON.parse(jsonMatch[1]);

					if (
						parsedMessage.Errors &&
						Array.isArray(parsedMessage.Errors) &&
						parsedMessage.Errors.length > 0
					) {
						errorMessage = parsedMessage.Errors[0].split(' Learn more:')[0].trim();
					}
				}
			} catch (error) {
				errorMessage = 'Failed to extract error message';
			}
		}

		throw new ApplicationError(errorMessage);
	}
	return data;
}

export async function microsoftCosmosDbRequest(
	this: ILoadOptionsFunctions,
	opts: IHttpRequestOptions,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('microsoftCosmosDbSharedKeyApi');
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
		console.log('Final Request Options before Request:', requestOptions);

		return (await this.helpers.requestWithAuthentication.call(
			this,
			'microsoftCosmosDbSharedKeyApi',
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

export async function searchCollections(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const opts: IHttpRequestOptions = {
		method: 'GET',
		url: '/colls',
	};

	const responseData: IDataObject = await microsoftCosmosDbRequest.call(this, opts);

	const responseBody = responseData as {
		DocumentCollections: IDataObject[];
	};
	const collections = responseBody.DocumentCollections;

	if (!collections) {
		return { results: [] };
	}

	const results: INodeListSearchItems[] = collections
		.map((collection) => {
			return {
				name: String(collection.id),
				value: String(collection.id),
			};
		})
		.filter((collection) => !filter || collection.name.includes(filter))
		.sort((a, b) => a.name.localeCompare(b.name));

	return {
		results,
	};
}

export async function searchItems(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const collection = this.getNodeParameter('collId') as { mode: string; value: string };

	if (!collection?.value) {
		throw new ApplicationError('Collection ID is required.');
	}
	const opts: IHttpRequestOptions = {
		method: 'GET',
		url: `/colls/${collection.value}/docs`,
	};

	const responseData: IDataObject = await microsoftCosmosDbRequest.call(this, opts);

	const responseBody = responseData as {
		Documents: IDataObject[];
	};
	const items = responseBody.Documents;

	if (!items) {
		return { results: [] };
	}

	const results: INodeListSearchItems[] = items
		.map((item) => {
			const idWithoutSpaces = String(item.id).replace(/ /g, '');
			return {
				name: String(idWithoutSpaces),
				value: String(item.id),
			};
		})
		.filter((item) => !filter || item.name.includes(filter))
		.sort((a, b) => a.name.localeCompare(b.name));

	return {
		results,
	};
}

export async function validateQueryParameters(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const params = this.getNodeParameter('parameters', {}) as {
		parameters: Array<{ name: string; value: string }>;
	};

	if (!params || !Array.isArray(params.parameters)) {
		throw new ApplicationError(
			'The "parameters" field cannot be empty. Please add at least one parameter.',
		);
	}

	const parameters = params.parameters;

	for (const parameter of parameters) {
		if (!parameter.name || parameter.name.trim() === '') {
			throw new ApplicationError('Each parameter must have a non-empty "name".');
		}

		if (!parameter.value) {
			throw new ApplicationError(`The parameter "${parameter.name}" must have a valid "value".`);
		}
	}

	return requestOptions;
}

export async function validateOperations(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const rawOperations = this.getNodeParameter('operations', []) as IDataObject;

	if (!rawOperations || !Array.isArray(rawOperations.operations)) {
		throw new ApplicationError('The "operations" field must contain at least one operation.');
	}

	const operations = rawOperations.operations as Array<{
		op: string;
		path?: { mode: string; value: string };
		toPath?: { mode: string; value: string };
		from?: { mode: string; value: string };
		value?: string | number;
	}>;

	const transformedOperations = operations.map((operation) => {
		if (
			operation.op !== 'move' &&
			(!operation.path?.value ||
				typeof operation.path.value !== 'string' ||
				operation.path.value.trim() === '')
		) {
			throw new ApplicationError('Each operation must have a valid "path".');
		}

		if (
			['set', 'replace', 'add', 'incr'].includes(operation.op) &&
			(operation.value === undefined || operation.value === null)
		) {
			throw new ApplicationError(`The "${operation.op}" operation must include a valid "value".`);
		}

		if (operation.op === 'move') {
			if (
				!operation.from?.value ||
				typeof operation.from.value !== 'string' ||
				operation.from.value.trim() === ''
			) {
				throw new ApplicationError('The "move" operation must have a valid "from" path.');
			}

			if (
				!operation.toPath?.value ||
				typeof operation.toPath.value !== 'string' ||
				operation.toPath.value.trim() === ''
			) {
				throw new ApplicationError('The "move" operation must have a valid "toPath".');
			}
		}

		if (operation.op === 'incr' && isNaN(Number(operation.value))) {
			throw new ApplicationError('The "increment" operation must have a numeric value.');
		}

		return {
			op: operation.op,
			path: operation.op === 'move' ? operation.toPath?.value : operation.path?.value,
			...(operation.from ? { from: operation.from.value } : {}),
			...(operation.op === 'incr'
				? { value: Number(operation.value) }
				: { value: isNaN(Number(operation.value)) ? operation.value : Number(operation.value) }),
		};
	});

	requestOptions.body = transformedOperations;

	return requestOptions;
}

export async function formatCustomProperties(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const rawCustomProperties = this.getNodeParameter('customProperties', '{}') as string;
	const newId = this.getNodeParameter('newId') as string;

	if (/\s/.test(newId)) {
		throw new ApplicationError(
			'Invalid ID: IDs cannot contain spaces. Use an underscore (_) or another separator instead.',
		);
	}

	let parsedProperties: Record<string, unknown>;
	try {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		parsedProperties = JSON.parse(rawCustomProperties);
	} catch (error) {
		throw new ApplicationError(
			'Invalid JSON format in "Custom Properties". Please provide a valid JSON object.',
		);
	}

	if (
		typeof parsedProperties !== 'object' ||
		parsedProperties === null ||
		Array.isArray(parsedProperties)
	) {
		throw new ApplicationError('The "Custom Properties" field must be a valid JSON object.');
	}

	if (
		!requestOptions.body ||
		typeof requestOptions.body !== 'object' ||
		requestOptions.body === null
	) {
		requestOptions.body = {};
	}

	Object.assign(requestOptions.body as Record<string, unknown>, { id: newId }, parsedProperties);

	return requestOptions;
}

export async function formatJSONFields(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const rawPartitionKey = this.getNodeParameter('partitionKey', '{}') as string;
	const additionalFields = this.getNodeParameter('additionalFields', {}) as IDataObject;
	const indexingPolicy = additionalFields.indexingPolicy as string;

	let parsedPartitionKey: Record<string, unknown>;
	let parsedIndexPolicy: Record<string, unknown> | undefined;

	try {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		parsedPartitionKey = JSON.parse(rawPartitionKey);

		if (indexingPolicy) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			parsedIndexPolicy = JSON.parse(indexingPolicy);
		}
	} catch (error) {
		throw new ApplicationError(
			'Invalid JSON format in either "Partition Key" or "Indexing Policy". Please provide valid JSON objects.',
		);
	}

	if (
		!requestOptions.body ||
		typeof requestOptions.body !== 'object' ||
		requestOptions.body === null
	) {
		requestOptions.body = {};
	}

	(requestOptions.body as Record<string, unknown>).partitionKey = parsedPartitionKey;

	if (parsedIndexPolicy) {
		(requestOptions.body as Record<string, unknown>).indexingPolicy = parsedIndexPolicy;
	}

	return requestOptions;
}

export async function validateFields(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const additionalFields = this.getNodeParameter('additionalFields', {}) as IDataObject;
	const indexingPolicy = additionalFields.indexingPolicy;
	const manualThroughput = additionalFields.offerThroughput;
	const autoscaleThroughput = additionalFields.maxThroughput;

	if (manualThroughput && autoscaleThroughput) {
		throw new ApplicationError(
			'You cannot set both "Max RU/s (Autoscale)" and "Max RU/s (Manual Throughput)". Please choose only one.',
		);
	}
	if (autoscaleThroughput && requestOptions?.qs) {
		requestOptions.qs['x-ms-cosmos-offer-autopilot-settings'] = {
			maxThroughput: autoscaleThroughput,
		};
	}

	if (!indexingPolicy || Object.keys(indexingPolicy).length === 0) {
		throw new ApplicationError(
			'Invalid Indexing Policy: Please provide a valid indexingPolicy JSON.',
		);
	}

	return requestOptions;
}

export async function processResponseItems(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<any> {
	if (!response || typeof response !== 'object' || !Array.isArray(items)) {
		throw new ApplicationError('Invalid response format from Cosmos DB.');
	}

	const extractedDocuments: IDataObject[] = items.flatMap((item) => {
		if (
			item.json &&
			typeof item.json === 'object' &&
			'Documents' in item.json &&
			Array.isArray(item.json.Documents)
		) {
			return item.json.Documents as IDataObject[];
		}

		return [];
	});

	return extractedDocuments;
}

export async function processResponseContainers(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<any> {
	if (!response || typeof response !== 'object' || !Array.isArray(items)) {
		throw new ApplicationError('Invalid response format from Cosmos DB.');
	}

	const data = response.body as { DocumentCollections: IDataObject[] };

	if (data.DocumentCollections.length > 0) {
		return data.DocumentCollections.map((doc) => ({ json: doc }));
	}

	return [];
}

function extractFieldPaths(obj: any, prefix = ''): string[] {
	let paths: string[] = [];

	Object.entries(obj).forEach(([key, value]) => {
		if (key.startsWith('_') || key === 'id') {
			return;
		}
		const newPath = prefix ? `${prefix}/${key}` : `/${key}`;
		if (Array.isArray(value) && value.length > 0) {
			value.forEach((item, index) => {
				if (typeof item === 'object' && item !== null) {
					paths = paths.concat(extractFieldPaths(item, `${newPath}/${index}`));
				} else {
					paths.push(`${newPath}/${index}`);
				}
			});
		} else if (typeof value === 'object' && value !== null) {
			paths = paths.concat(extractFieldPaths(value, newPath));
		} else {
			paths.push(newPath);
		}
	});

	return paths;
}

export async function searchItemById(
	this: ILoadOptionsFunctions,
	itemId: string,
): Promise<IDataObject | null> {
	const collection = this.getNodeParameter('collId') as { mode: string; value: string };

	if (!collection?.value) {
		throw new ApplicationError('Collection ID is required.');
	}

	if (!itemId) {
		throw new ApplicationError('Item ID is required.');
	}

	const opts: IHttpRequestOptions = {
		method: 'GET',
		url: `/colls/${collection.value}/docs/${itemId}`,
		headers: {
			'x-ms-documentdb-partitionkey': `["${itemId}"]`,
		},
	};

	const responseData: IDataObject = await microsoftCosmosDbRequest.call(this, opts);

	if (!responseData) {
		return null;
	}

	return responseData;
}

export async function getDynamicFields(
	this: ILoadOptionsFunctions,
): Promise<INodeListSearchResult> {
	const itemId = this.getNodeParameter('id', '') as { mode: string; value: string };

	if (!itemId) {
		throw new ApplicationError('Item ID is required to fetch fields.');
	}

	const itemData = await searchItemById.call(this, itemId.value);

	if (!itemData) {
		throw new ApplicationError(`Item with ID "${itemId.value}" not found.`);
	}

	const fieldPaths = extractFieldPaths(itemData);

	return {
		results: fieldPaths.map((path) => ({
			name: path,
			value: path,
		})),
	};
}
