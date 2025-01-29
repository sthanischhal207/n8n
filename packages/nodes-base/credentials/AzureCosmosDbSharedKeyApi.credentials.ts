import {
	ApplicationError,
	type ICredentialDataDecryptedObject,
	type ICredentialType,
	type IHttpRequestOptions,
	type INodeProperties,
} from 'n8n-workflow';

import { getAuthorizationTokenUsingMasterKey } from '../nodes/Microsoft/AzureCosmosDB/GenericFunctions';

export class AzureCosmosDbSharedKeyApi implements ICredentialType {
	name = 'azureCosmosDbSharedKeyApi';

	displayName = 'Azure Cosmos DB API';

	documentationUrl = 'azureCosmosDb';

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
		console.log('Authenticate invoked with requestOptions:', requestOptions);

		if (requestOptions.qs) {
			for (const [key, value] of Object.entries(requestOptions.qs)) {
				if (value === undefined) {
					delete requestOptions.qs[key];
				}
			}
		}

		requestOptions.headers ??= {};
		const date = new Date().toUTCString();
		requestOptions.headers = {
			...requestOptions.headers,
			'x-ms-date': date,
			'x-ms-version': '2018-12-31',
		};

		if (credentials.sessionToken) {
			requestOptions.headers['x-ms-session-token'] = credentials.sessionToken;
		}

		let resourceType = '';
		const resourceLink = requestOptions.url;

		if (resourceLink.includes('/colls')) {
			resourceType = 'colls';
		} else if (resourceLink.includes('/docs')) {
			resourceType = 'docs';
		} else if (resourceLink.includes('/dbs')) {
			resourceType = 'dbs';
		} else {
			throw new ApplicationError('Unable to determine resourceType');
		}

		if (requestOptions.method) {
			const authToken = getAuthorizationTokenUsingMasterKey(
				requestOptions.method,
				resourceType,
				resourceLink,
				date,
				credentials.key as string,
			);

			requestOptions.headers.Authorization = authToken;
		}

		console.log('Final requestOptions headers:', requestOptions.headers);

		return requestOptions;
	}
}
