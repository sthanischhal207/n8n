import { handlePagination } from '../GenericFunctions';

describe('GenericFunctions - handlePagination', () => {
	let mockContext: any;
	let mockMakeRoutingRequest: jest.Mock;
	let resultOptions: any;

	beforeEach(() => {
		mockMakeRoutingRequest = jest.fn();
		mockContext = {
			makeRoutingRequest: mockMakeRoutingRequest,
			getNodeParameter: jest.fn(),
		};

		resultOptions = {
			maxResults: 60,
			options: { body: {} },
		};
	});

	test('should aggregate results and handle pagination when returnAll is true', async () => {
		mockMakeRoutingRequest
			.mockResolvedValueOnce([
				{ id: 1 },
				{ id: 2 },
				{ headers: { 'x-ms-continuation': 'token-1' } },
			])
			.mockResolvedValueOnce([{ id: 3 }, { id: 4 }, { headers: {} }]);

		mockContext.getNodeParameter.mockImplementation((param: string) => {
			if (param === 'returnAll') return true;
			return undefined;
		});

		const result = await handlePagination.call(mockContext, resultOptions);

		expect(result).toEqual([
			{ json: { id: 1 } },
			{ json: { id: 2 } },
			{ json: { id: 3 } },
			{ json: { id: 4 } },
		]);

		expect(mockMakeRoutingRequest).toHaveBeenCalledTimes(2);
		expect(resultOptions.options.headers).toEqual({
			'x-ms-continuation': 'token-1',
		});
	});

	test('should stop pagination after reaching limit when returnAll is false', async () => {
		mockMakeRoutingRequest
			.mockResolvedValueOnce([
				{ id: 1 },
				{ id: 2 },
				{ headers: { 'x-ms-continuation': 'token-1' } },
			])
			.mockResolvedValueOnce([{ id: 3 }, { id: 4 }, { headers: {} }]);

		mockContext.getNodeParameter.mockImplementation((param: string) => {
			if (param === 'returnAll') return false;
			if (param === 'limit') return 3;
			return undefined;
		});

		const result = await handlePagination.call(mockContext, resultOptions);

		expect(result).toEqual([{ json: { id: 1 } }, { json: { id: 2 } }, { json: { id: 3 } }]);

		expect(mockMakeRoutingRequest).toHaveBeenCalledTimes(2);
	});

	test('should handle cases with no continuation token gracefully', async () => {
		mockMakeRoutingRequest.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

		mockContext.getNodeParameter.mockImplementation((param: string) => {
			if (param === 'returnAll') return true;
			return undefined;
		});

		const result = await handlePagination.call(mockContext, resultOptions);

		expect(result).toEqual([{ json: { id: 1 } }, { json: { id: 2 } }]);

		expect(mockMakeRoutingRequest).toHaveBeenCalledTimes(1);
	});

	test('should respect the limit even if fewer results are available', async () => {
		mockMakeRoutingRequest.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

		mockContext.getNodeParameter.mockImplementation((param: string) => {
			if (param === 'returnAll') return false;
			if (param === 'limit') return 5;
			return undefined;
		});

		const result = await handlePagination.call(mockContext, resultOptions);

		expect(result).toEqual([{ json: { id: 1 } }, { json: { id: 2 } }]);

		expect(mockMakeRoutingRequest).toHaveBeenCalledTimes(1);
	});

	test('should break the loop if no results are returned', async () => {
		mockMakeRoutingRequest.mockResolvedValueOnce([]);

		mockContext.getNodeParameter.mockImplementation((param: string) => {
			if (param === 'returnAll') return true;
			return undefined;
		});

		const result = await handlePagination.call(mockContext, resultOptions);

		expect(result).toEqual([]);
		expect(mockMakeRoutingRequest).toHaveBeenCalledTimes(1);
	});
});
