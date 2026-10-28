import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	bexioApiRequest,
	bexioApiRequestAllItems,
	buildBody,
	getId,
	likeCondition,
	limitFor,
	listOrSearch,
	parseJsonParameter,
	searchConditions,
} from '../GenericFunctions';

// ---------------------------------------------------------------- Item (article)

export async function executeArticle(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	const articlePath = () => `2.0/article/${getId.call(this, 'articleId', itemIndex, 'item')}`;

	switch (operation) {
		case 'create': {
			const fields = buildBody.call(
				this,
				this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject,
				itemIndex,
			);
			return (await bexioApiRequest.call(this, 'POST', '2.0/article', {
				intern_name: this.getNodeParameter('internName', itemIndex),
				article_type_id: 1,
				...fields,
			})) as IDataObject;
		}

		case 'get':
			return (await bexioApiRequest.call(this, 'GET', articlePath())) as IDataObject;

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			return listOrSearch.call(
				this,
				'2.0/article',
				[
					...likeCondition('intern_name', filters.internName),
					...likeCondition('intern_code', filters.internCode),
					...searchConditions.call(this, itemIndex),
				],
				{ order_by: this.getNodeParameter('orderBy', itemIndex, 'id_asc') },
				limitFor.call(this, itemIndex),
			);
		}

		case 'update': {
			const updates = buildBody.call(
				this,
				this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject,
				itemIndex,
			);
			return (await bexioApiRequest.call(this, 'POST', articlePath(), updates)) as IDataObject;
		}

		case 'delete': {
			const id = getId.call(this, 'articleId', itemIndex, 'item');
			await bexioApiRequest.call(this, 'DELETE', `2.0/article/${id}`);
			return { success: true, id };
		}
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}

// ---------------------------------------------------------------- File (inbox)

/** Uploads a binary field of the input item to the bexio inbox and returns the created file(s). */
export async function uploadInboxFile(
	this: IExecuteFunctions,
	itemIndex: number,
	binaryPropertyName: string,
): Promise<IDataObject[]> {
	const binary = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
	const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	const form = new FormData();
	form.append(
		'file',
		new Blob([new Uint8Array(buffer)], { type: binary.mimeType }),
		binary.fileName ?? `upload.${binary.fileExtension ?? 'bin'}`,
	);
	const response = (await bexioApiRequest.call(this, 'POST', '3.0/files', undefined, {}, { body: form })) as
		| IDataObject[]
		| IDataObject
		| string;
	const parsed = typeof response === 'string' ? (JSON.parse(response) as IDataObject[] | IDataObject) : response;
	return Array.isArray(parsed) ? parsed : [parsed];
}

export async function executeFile(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[] | INodeExecutionData> {
	const fileId = () => encodeURIComponent(String(this.getNodeParameter('fileId', itemIndex)).trim());

	switch (operation) {
		case 'upload':
			return uploadInboxFile.call(this, itemIndex, this.getNodeParameter('binaryPropertyName', itemIndex) as string);

		case 'get':
			return (await bexioApiRequest.call(this, 'GET', `3.0/files/${fileId()}`)) as IDataObject;

		case 'download': {
			const id = fileId();
			const metadata = (await bexioApiRequest.call(this, 'GET', `3.0/files/${id}`)) as IDataObject;
			const content = (await bexioApiRequest.call(this, 'GET', `3.0/files/${id}/download`, undefined, {}, {
				encoding: 'arraybuffer',
				json: false,
				headers: { Accept: '*/*' },
			})) as ArrayBuffer;
			const extension = metadata.extension ? `.${String(metadata.extension)}` : '';
			const name = String(metadata.name ?? id);
			const fileName = extension && !name.endsWith(extension) ? `${name}${extension}` : name;
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
			return {
				json: metadata,
				binary: {
					[binaryPropertyName]: await this.helpers.prepareBinaryData(
						Buffer.from(content),
						fileName,
						metadata.mime_type as string | undefined,
					),
				},
			};
		}

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			const qs: IDataObject = { archived_state: filters.archivedState ?? 'not_archived' };
			return listOrSearch.call(this, '3.0/files', likeCondition('name', filters.name), qs, limitFor.call(this, itemIndex));
		}

		case 'delete': {
			const id = fileId();
			await bexioApiRequest.call(this, 'DELETE', `3.0/files/${id}`);
			return { success: true, id };
		}
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}

// ---------------------------------------------------------------- User

export async function executeUser(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	switch (operation) {
		case 'getCurrent':
			return (await bexioApiRequest.call(this, 'GET', '3.0/users/me')) as IDataObject;
		case 'get':
			return (await bexioApiRequest.call(
				this,
				'GET',
				`3.0/users/${encodeURIComponent(String(this.getNodeParameter('userId', itemIndex)))}`,
			)) as IDataObject;
		case 'getAll':
			return bexioApiRequestAllItems.call(this, 'GET', '3.0/users', undefined, {}, limitFor.call(this, itemIndex));
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}

// ---------------------------------------------------------------- API request

export async function executeApiRequest(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject | IDataObject[]> {
	const method = this.getNodeParameter('method', itemIndex) as IHttpRequestMethods;
	const endpoint = (this.getNodeParameter('endpoint', itemIndex) as string).trim();
	if (/^https?:\/\//i.test(endpoint) && !endpoint.startsWith('https://api.bexio.com/')) {
		throw new NodeOperationError(this.getNode(), 'The endpoint must be a path below https://api.bexio.com', {
			itemIndex,
		});
	}
	const qs = parseJsonParameter.call(this, this.getNodeParameter('query', itemIndex, '{}'), 'Query Parameters', itemIndex);

	let body: IDataObject | IDataObject[] | undefined;
	if (['PATCH', 'POST', 'PUT'].includes(method)) {
		const raw = this.getNodeParameter('body', itemIndex, '') as unknown;
		if (typeof raw === 'object' && raw !== null) {
			body = raw as IDataObject | IDataObject[];
		} else if (typeof raw === 'string' && raw.trim() !== '') {
			try {
				body = JSON.parse(raw) as IDataObject | IDataObject[];
			} catch {
				throw new NodeOperationError(this.getNode(), '"Body" must be valid JSON', { itemIndex });
			}
		}
	}

	const response = (await bexioApiRequest.call(this, method, endpoint, body, qs)) as unknown;
	if (Array.isArray(response)) {
		// n8n turns a returned array into items, so an unsplit array has to be wrapped
		return this.getNodeParameter('splitArray', itemIndex, true) ? (response as IDataObject[]) : { data: response as IDataObject[] };
	}
	if (response && typeof response === 'object') return response as IDataObject;
	return { response: response ?? null } as IDataObject;
}
