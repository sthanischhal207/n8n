import {
	NodeApiError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
} from 'n8n-workflow';

export async function handleErrorPostReceive(
	this: IExecuteSingleFunctions,
	data: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	console.log('Response ❌❌', response);
	console.log('Data ❌❌', data);

	if (String(response.statusCode).startsWith('4') || String(response.statusCode).startsWith('5')) {
		const responseBody = response.body as IDataObject;
		console.log('Got here ❌❌', responseBody);
		console.log('Code ❌❌', responseBody.code);

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

		console.log('Message', errorMessage, ' description', errorDescription);

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
