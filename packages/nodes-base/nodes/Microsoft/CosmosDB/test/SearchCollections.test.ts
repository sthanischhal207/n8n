import type { ILoadOptionsFunctions } from 'n8n-workflow';

import { searchCollections } from '../GenericFunctions';

describe('GenericFunctions - searchCollections', () => {
	const mockRequestWithAuthentication = jest.fn();

	const mockContext = {
		helpers: {
			requestWithAuthentication: mockRequestWithAuthentication,
		},
		getNodeParameter: jest.fn(),
		getCredentials: jest.fn(),
	} as unknown as ILoadOptionsFunctions;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should make a GET request to fetch collections and return results', async () => {
		(mockContext.getCredentials as jest.Mock).mockResolvedValueOnce({ account: 'us-east-1' });

		mockRequestWithAuthentication.mockResolvedValueOnce({
			DocumentCollections: [{ id: 'Collection1' }, { id: 'Collection2' }],
		});

		const response = await searchCollections.call(mockContext);

		expect(mockRequestWithAuthentication).toHaveBeenCalledWith(
			'azureCosmosDbSharedKeyApi',
			expect.objectContaining({
				baseURL: 'https://us-east-1.documents.azure.com',
				method: 'GET',
				url: '/colls',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				json: true,
			}),
		);

		expect(response).toEqual({
			results: [
				{ name: 'Collection1', value: 'Collection1' },
				{ name: 'Collection2', value: 'Collection2' },
			],
		});
	});

	it('should filter collections by the provided filter string', async () => {
		(mockContext.getCredentials as jest.Mock).mockResolvedValueOnce({ account: 'us-east-1' });

		mockRequestWithAuthentication.mockResolvedValueOnce({
			DocumentCollections: [{ id: 'Test-Col-1' }, { id: 'Prod-Col-1' }],
		});

		const response = await searchCollections.call(mockContext, 'Test');

		expect(mockRequestWithAuthentication).toHaveBeenCalledWith(
			'azureCosmosDbSharedKeyApi',
			expect.objectContaining({
				baseURL: 'https://us-east-1.documents.azure.com',
				method: 'GET',
				url: '/colls',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				json: true,
			}),
		);

		expect(response).toEqual({
			results: [{ name: 'Test-Col-1', value: 'Test-Col-1' }],
		});
	});

	it('should sort collections alphabetically by name', async () => {
		(mockContext.getCredentials as jest.Mock).mockResolvedValueOnce({ account: 'us-east-1' });
		(mockContext.getNodeParameter as jest.Mock).mockReturnValueOnce('db-id-1');

		mockRequestWithAuthentication.mockResolvedValueOnce({
			DocumentCollections: [{ id: 'z-col' }, { id: 'a-col' }, { id: 'm-col' }],
		});

		const response = await searchCollections.call(mockContext);

		expect(response).toEqual({
			results: [
				{ name: 'a-col', value: 'a-col' },
				{ name: 'm-col', value: 'm-col' },
				{ name: 'z-col', value: 'z-col' },
			],
		});
	});

	it('should handle empty results when no collections are returned', async () => {
		(mockContext.getCredentials as jest.Mock).mockResolvedValueOnce({ account: 'us-east-1' });
		(mockContext.getNodeParameter as jest.Mock).mockReturnValueOnce('db-id-1');

		mockRequestWithAuthentication.mockResolvedValueOnce({
			DocumentCollections: [],
		});

		const response = await searchCollections.call(mockContext);

		expect(response).toEqual({ results: [] });
	});

	it('should handle missing Collections property', async () => {
		(mockContext.getCredentials as jest.Mock).mockResolvedValueOnce({ account: 'us-east-1' });
		(mockContext.getNodeParameter as jest.Mock).mockReturnValueOnce('db-id-1');

		mockRequestWithAuthentication.mockResolvedValueOnce({
			unexpectedkey: 'value',
		});
		const response = await searchCollections.call(mockContext);

		expect(response).toEqual({ results: [] });
	});
});
