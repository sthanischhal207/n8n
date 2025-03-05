import type { IDataObject, IHttpRequestOptions, INodeListSearchItems } from 'n8n-workflow';

export interface IHttpRequestOptionsExtended extends IHttpRequestOptions {
	uri?: string;
}

export function formatResults(items: IDataObject[], filter?: string): INodeListSearchItems[] {
	return items
		.map(({ id }) => ({
			name: String(id).replace(/ /g, ''),
			value: String(id),
		}))
		.filter(({ name }) => !filter || name.includes(filter))
		.sort((a, b) => a.name.localeCompare(b.name));
}
