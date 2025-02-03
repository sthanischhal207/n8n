import {
	ApplicationError,
	type ICredentialDataDecryptedObject,
	type ICredentialType,
	type IHttpRequestOptions,
	type INodeProperties,
} from 'n8n-workflow';

import {
	getAuthorizationTokenUsingMasterKey,
	HeaderConstants,
} from '../nodes/Microsoft/CosmosDB/GenericFunctions';

export class MicrosoftCosmosDbSharedKeyApi implements ICredentialType {
	name = 'microsoftCosmosDbSharedKeyApi';

	displayName = 'Azure Cosmos DB API';

	documentationUrl = 'microsoftCosmosDb';

	properties: INodeProperties[] = [
		{
			displayName: 'Account',
			name: 'account',
			description: 'Account name',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Key',
			name: 'key',
			description: 'Account key',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
		{
			displayName: 'Database',
			name: 'database',
			description: 'Database name',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'hidden',
			default: '=https://{{ $self["account"] }}.documents.azure.com/dbs/{{ $self["database"] }}',
		},
	];

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		// Remove undefined query parameters?
		if (requestOptions.qs) {
			for (const [key, value] of Object.entries(requestOptions.qs)) {
				if (value === undefined) {
					delete requestOptions.qs[key];
				}
			}
		}

		// Add headers for date and version
		requestOptions.headers ??= {};
		const date = new Date().toUTCString().toLowerCase();
		requestOptions.headers = {
			...requestOptions.headers,
			'x-ms-date': date,
			'x-ms-version': '2018-12-31',
			'x-ms-partitionkey': '[]',
		};

		if (credentials.sessionToken) {
			requestOptions.headers['x-ms-session-token'] = credentials.sessionToken;
		}

		// This shouldn't be the full url
		// Refer to https://stackoverflow.com/questions/45645389/documentdb-rest-api-authorization-token-error

		const url = new URL(requestOptions.baseURL + requestOptions.url);
		const pathSegments = url.pathname.split('/').filter((segment) => segment);
		console.log('Filtered Path Segments:', pathSegments);

		let resourceType = '';
		let resourceId = '';

		if (pathSegments.includes('docs')) {
			const docsIndex = pathSegments.lastIndexOf('docs');
			resourceType = 'docs';
			resourceId = pathSegments.slice(0, docsIndex).join('/');
		} else if (pathSegments.includes('colls')) {
			const collsIndex = pathSegments.lastIndexOf('colls');
			resourceType = 'colls';
			resourceId = pathSegments.slice(0, collsIndex).join('/');
		} else if (pathSegments.includes('dbs')) {
			const dbsIndex = pathSegments.lastIndexOf('dbs');
			resourceType = 'dbs';
			resourceId = pathSegments.slice(0, dbsIndex + 2).join('/');
		} else {
			throw new ApplicationError('Unable to determine resourceType and resourceId from the URL.');
		}

		console.log('resourceId', resourceId);
		console.log('resourceType', resourceType);

		if (requestOptions.method) {
			const authToken = getAuthorizationTokenUsingMasterKey(
				requestOptions.method,
				resourceType,
				resourceId,
				date,
				credentials.key as string,
			);

			requestOptions.headers[HeaderConstants.AUTHORIZATION] = authToken;
		}

		console.log('Final requestOptions:', requestOptions);

		return requestOptions;
	}
}
