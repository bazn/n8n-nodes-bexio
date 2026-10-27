import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DOCUMENT_TYPES, type DocumentKind } from '../constants';
import {
	bexioApiRequest,
	buildBody,
	equalsCondition,
	getId,
	likeCondition,
	limitFor,
	listOrSearch,
	parseIdList,
	parseJsonArrayParameter,
	searchConditions,
	toBexioDate,
	toBexioDateTime,
	userIdOrMe,
} from '../GenericFunctions';

const NETWORK_LINK = '[Network Link]';

/** Keys of a position that bexio expects as strings (decimals with up to 6 places). */
const DECIMAL_KEYS = new Set(['amount', 'unit_price', 'discount_in_percent', 'value']);

/** Fields each position type accepts, so leftover values of other types are not sent. */
const POSITION_KEYS: Record<string, string[]> = {
	KbPositionCustom: ['text', 'amount', 'unit_price', 'tax_id', 'unit_id', 'account_id', 'discount_in_percent', 'is_optional'],
	KbPositionArticle: [
		'article_id',
		'text',
		'amount',
		'unit_price',
		'tax_id',
		'unit_id',
		'account_id',
		'discount_in_percent',
		'is_optional',
	],
	KbPositionText: ['text', 'show_pos_nr'],
	KbPositionSubtotal: ['text'],
	KbPositionPagebreak: [],
	KbPositionDiscount: ['text', 'value', 'is_percentual'],
};

const POSITION_FIELD_NAMES: Record<string, string> = {
	articleId: 'article_id',
	unitPrice: 'unit_price',
	taxId: 'tax_id',
	unitId: 'unit_id',
	accountId: 'account_id',
	discountInPercent: 'discount_in_percent',
	isOptional: 'is_optional',
	isPercentual: 'is_percentual',
	showPosNr: 'show_pos_nr',
};

/** Maps a position entered in the node's fixed collection to the bexio format. */
export function toBexioPosition(position: IDataObject): IDataObject {
	const type = String(position.type ?? 'KbPositionCustom');
	const allowed = POSITION_KEYS[type] ?? [];
	const result: IDataObject = { type };
	for (const [key, value] of Object.entries(position)) {
		const apiKey = POSITION_FIELD_NAMES[key] ?? key;
		if (!allowed.includes(apiKey) || value === '' || value === undefined || value === null) continue;
		if (apiKey === 'discount_in_percent' && Number(value) === 0) continue;
		result[apiKey] = DECIMAL_KEYS.has(apiKey) ? String(value) : value;
	}
	if (type === 'KbPositionPagebreak') result.pagebreak = true;
	return result;
}

function getPositions(this: IExecuteFunctions, itemIndex: number): IDataObject[] {
	if (this.getNodeParameter('positionsInput', itemIndex, 'fields') === 'json') {
		return parseJsonArrayParameter.call(this, this.getNodeParameter('positionsJson', itemIndex), 'Positions (JSON)', itemIndex);
	}
	const positions = this.getNodeParameter('positions', itemIndex, {}) as { position?: IDataObject[] };
	return (positions.position ?? []).map(toBexioPosition);
}

/** Builds the header fields of a document; "Valid Until" maps to the field name of the document type. */
function documentBody(this: IExecuteFunctions, kind: DocumentKind, fields: IDataObject, itemIndex: number): IDataObject {
	const { validUntil, ...rest } = fields;
	const body = buildBody.call(this, rest, itemIndex, ['isValidFrom']);
	const validUntilField = DOCUMENT_TYPES[kind].validUntilField;
	if (validUntilField && validUntil) body[validUntilField] = toBexioDate(validUntil);
	return body;
}

export async function executeDocument(
	this: IExecuteFunctions,
	kind: DocumentKind,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[] | INodeExecutionData> {
	const type = DOCUMENT_TYPES[kind];
	const base = `2.0/${type.path}`;
	const documentPath = () => `${base}/${getId.call(this, 'documentId', itemIndex, type.label.toLowerCase())}`;

	switch (operation) {
		case 'create': {
			const fields = documentBody.call(
				this,
				kind,
				this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject,
				itemIndex,
			);
			return (await bexioApiRequest.call(this, 'POST', base, {
				...fields,
				contact_id: Number(this.getNodeParameter('contactId', itemIndex, '', { extractValue: true })),
				user_id: await userIdOrMe.call(this, fields.user_id),
				positions: getPositions.call(this, itemIndex),
			})) as IDataObject;
		}

		case 'get':
			return (await bexioApiRequest.call(this, 'GET', documentPath())) as IDataObject;

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			const statuses = parseIdList(filters.statuses);
			return listOrSearch.call(
				this,
				base,
				[
					...(statuses.length ? [{ field: 'kb_item_status_id', value: statuses, criteria: 'in' }] : []),
					...equalsCondition('contact_id', filters.contactId),
					...equalsCondition('document_nr', filters.documentNr),
					...equalsCondition('user_id', filters.userId),
					...likeCondition('title', filters.title),
					...(filters.updatedSince
						? [{ field: 'updated_at', value: toBexioDateTime(filters.updatedSince, this.getTimezone()), criteria: '>=' }]
						: []),
					...(filters.validFromAfter
						? [{ field: 'is_valid_from', value: toBexioDate(filters.validFromAfter), criteria: '>=' }]
						: []),
					...(filters.validFromBefore
						? [{ field: 'is_valid_from', value: toBexioDate(filters.validFromBefore), criteria: '<=' }]
						: []),
					...searchConditions.call(this, itemIndex),
				],
				{ order_by: this.getNodeParameter('orderBy', itemIndex, 'id_asc') },
				limitFor.call(this, itemIndex),
			);
		}

		case 'update': {
			const updates = documentBody.call(
				this,
				kind,
				this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject,
				itemIndex,
			);
			return (await bexioApiRequest.call(this, 'POST', documentPath(), updates)) as IDataObject;
		}

		case 'delete': {
			const path = documentPath();
			await bexioApiRequest.call(this, 'DELETE', path);
			return { success: true, id: Number(path.split('/').pop()) };
		}

		case 'getPdf': {
			const pdf = (await bexioApiRequest.call(this, 'GET', `${documentPath()}/pdf`)) as {
				name: string;
				mime?: string;
				content: string;
				size?: number;
			};
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
			const binary = await this.helpers.prepareBinaryData(
				Buffer.from(pdf.content, 'base64'),
				pdf.name,
				pdf.mime ?? 'application/pdf',
			);
			return {
				json: { name: pdf.name, size: pdf.size, mime: pdf.mime },
				binary: { [binaryPropertyName]: binary },
			};
		}

		case 'send': {
			const message = this.getNodeParameter('message', itemIndex) as string;
			if (!message.includes(NETWORK_LINK)) {
				throw new NodeOperationError(this.getNode(), `The message must contain the placeholder ${NETWORK_LINK}`, {
					itemIndex,
					description: 'bexio replaces it with the link to the document',
				});
			}
			const options = this.getNodeParameter('sendOptions', itemIndex, {}) as IDataObject;
			return (await bexioApiRequest.call(this, 'POST', `${documentPath()}/send`, {
				recipient_email: this.getNodeParameter('recipientEmail', itemIndex),
				subject: this.getNodeParameter('subject', itemIndex),
				message,
				...(options.markAsOpen !== undefined && { mark_as_open: options.markAsOpen }),
				...(options.attachPdf !== undefined && { attach_pdf: options.attachPdf }),
			})) as IDataObject;
		}

		case 'copy': {
			const options = buildBody.call(
				this,
				this.getNodeParameter('copyOptions', itemIndex, {}) as IDataObject,
				itemIndex,
				['isValidFrom'],
			);
			return (await bexioApiRequest.call(this, 'POST', `${documentPath()}/copy`, {
				contact_id: Number(this.getNodeParameter('contactId', itemIndex, '', { extractValue: true })),
				...options,
			})) as IDataObject;
		}

		case 'addPayment': {
			const options = this.getNodeParameter('paymentOptions', itemIndex, {}) as IDataObject;
			return (await bexioApiRequest.call(this, 'POST', `${documentPath()}/payment`, {
				value: String(this.getNodeParameter('paymentValue', itemIndex)),
				date: toBexioDate(options.date) ?? new Date().toISOString().slice(0, 10),
				...(options.bankAccountId ? { bank_account_id: Number(options.bankAccountId) } : {}),
			})) as IDataObject;
		}

		case 'getPayments':
			return (await bexioApiRequest.call(this, 'GET', `${documentPath()}/payment`)) as IDataObject[];
	}

	// State transitions without a body: issue, revert issue, cancel, mark as sent, accept, reject, and
	// converting documents (quote → order / invoice, order → delivery / invoice).
	const actions: Record<string, string> = {
		issue: 'issue',
		revertIssue: kind === 'quote' ? 'revertIssue' : 'revert_issue',
		cancel: 'cancel',
		markAsSent: 'mark_as_sent',
		accept: 'accept',
		reject: 'reject',
		createInvoice: 'invoice',
		createOrder: 'order',
		createDelivery: 'delivery',
	};
	const action = actions[operation];
	if (action) {
		const path = documentPath();
		const response = (await bexioApiRequest.call(this, 'POST', `${path}/${action}`)) as IDataObject | undefined;
		if (operation.startsWith('create')) return response ?? {};
		// State changes answer `{ success: true }`; return the document so the new status is visible.
		return (await bexioApiRequest.call(this, 'GET', path)) as IDataObject;
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}
