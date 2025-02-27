import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';

import { validateContainerFields } from '../GenericFunctions';

describe('validateContainerFields', () => {
	const mockContext = {
		getNodeParameter: jest.fn(),
		getCredentials: jest.fn(),
	} as unknown as IExecuteSingleFunctions;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should add manual throughput header when manualThroughput is provided', async () => {
		// Mocking getNodeParameter to simulate manualThroughput provided
		(mockContext.getNodeParameter as jest.Mock).mockImplementation((param) => {
			if (param === 'additionalFields') return { offerThroughput: 500 }; // Manual throughput value
			return '';
		});

		const requestOptions: IHttpRequestOptions = { headers: {}, url: '' };

		// Calling validateContainerFields function with the mock context
		const result = await validateContainerFields.call(mockContext, requestOptions);

		// Verifying that the manual throughput header is added correctly
		expect(result.headers).toHaveProperty('x-ms-offer-throughput', 500);
		expect(result.headers).not.toHaveProperty('x-ms-cosmos-offer-autopilot-setting');
	});

	it('should add autoscale throughput header when autoscaleThroughput is provided', async () => {
		// Mocking getNodeParameter to simulate autoscaleThroughput provided
		(mockContext.getNodeParameter as jest.Mock).mockImplementation((param) => {
			if (param === 'additionalFields') return { maxThroughput: 1000 }; // Autoscale throughput value
			return '';
		});

		const requestOptions: IHttpRequestOptions = { headers: {}, url: '' };

		// Calling validateContainerFields function with the mock context
		const result = await validateContainerFields.call(mockContext, requestOptions);

		// Verifying that the autoscale throughput header is added correctly
		expect(result.headers).toHaveProperty('x-ms-cosmos-offer-autopilot-setting', {
			maxThroughput: 1000,
		});
		expect(result.headers).not.toHaveProperty('x-ms-offer-throughput');
	});

	it('should not add throughput headers if neither manualThroughput nor autoscaleThroughput are provided', async () => {
		// Mocking getNodeParameter to simulate no throughput values
		(mockContext.getNodeParameter as jest.Mock).mockImplementation((param) => {
			if (param === 'additionalFields') return {}; // Neither throughput value
			return '';
		});

		const requestOptions: IHttpRequestOptions = { headers: {}, url: '' };

		// Calling validateContainerFields function with the mock context
		const result = await validateContainerFields.call(mockContext, requestOptions);

		// Verifying that no throughput headers are added
		expect(result.headers).not.toHaveProperty('x-ms-offer-throughput');
		expect(result.headers).not.toHaveProperty('x-ms-cosmos-offer-autopilot-setting');
	});
});
