import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	bexioApiRequest,
	bexioApiRequestAllPages,
	limitFor,
	parseJsonParameter,
	pickKeys,
	resolveLocatorValue,
	toBexioDate,
} from '../GenericFunctions';
import { uploadInboxFile } from './other';

/** Attributes the bill PUT endpoint accepts; it replaces the whole bill, so they are all sent back. */
const BILL_KEYS = [
	'document_no',
	'title',
	'supplier_id',
	'vendor_ref',
	'amount_man',
	'amount_calc',
	'manual_amount',
	'contact_partner_id',
	'bill_date',
	'due_date',
	'currency_code',
	'exchange_rate',
	'item_net',
	'split_into_line_items',
	'base_currency_amount',
	'attachment_ids',
	'address',
	'line_items',
	'discounts',
	'payment',
];
const BILL_LINE_ITEM_KEYS = ['id', 'position', 'title', 'tax_id', 'amount', 'booking_account_id'];
const BILL_DISCOUNT_KEYS = ['id', 'position', 'amount'];

const EXPENSE_KEYS = [
	'paid_on',
	'currency_code',
	'exchange_rate',
	'supplier_id',
	'document_no',
	'title',
	'bank_account_id',
	'booking_account_id',
	'amount',
	'tax_id',
	'base_currency_amount',
	'attachment_ids',
	'address',
];

/** Turns a bill as returned by GET into a valid PUT body (drops calculated and read-only fields). */
export function billToUpdateBody(bill: IDataObject): IDataObject {
	const body = pickKeys(bill, BILL_KEYS);
	body.line_items = ((bill.line_items as IDataObject[] | undefined) ?? []).map((item) => pickKeys(item, BILL_LINE_ITEM_KEYS));
	body.discounts = ((bill.discounts as IDataObject[] | undefined) ?? []).map((item) => pickKeys(item, BILL_DISCOUNT_KEYS));
	body.attachment_ids = (bill.attachment_ids as string[] | undefined) ?? [];
	return body;
}

/** Turns an expense as returned by GET into a valid PUT body. */
export function expenseToUpdateBody(expense: IDataObject): IDataObject {
	const body = pickKeys(expense, EXPENSE_KEYS);
	body.attachment_ids = (expense.attachment_ids as string[] | undefined) ?? [];
	return body;
}

/** Maps the node's simple fields to v4 attributes (snake_case, dates as YYYY-MM-DD, locators resolved). */
export function v4Fields(fields: IDataObject, dateFields: string[]): IDataObject {
	const result: IDataObject = {};
	for (const [key, raw] of Object.entries(fields)) {
		if (key === 'additionalJson') continue;
		let value: unknown = typeof raw === 'number' || typeof raw === 'boolean' ? raw : resolveLocatorValue(raw);
		if (value === undefined) continue;
		if (dateFields.includes(key)) value = toBexioDate(value);
		const apiKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
		const numeric = /_id$/.test(apiKey) && apiKey !== 'project_id';
		result[apiKey] = numeric ? Number(value) : (value as IDataObject[keyof IDataObject]);
	}
	return result;
}

/** v4 list filters: dates as YYYY-MM-DD, empty and zero amounts dropped. */
export function v4Query(filters: IDataObject, dateFields: string[], dateTimeFields: string[] = []): IDataObject {
	const qs: IDataObject = {};
	for (const [key, raw] of Object.entries(filters)) {
		let value = typeof raw === 'object' && raw !== null ? resolveLocatorValue(raw) : raw;
		if (value === undefined || value === null || value === '' || value === 0) continue;
		if (dateFields.includes(key)) value = toBexioDate(value);
		if (dateTimeFields.includes(key)) value = new Date(String(value)).toISOString().replace(/\.\d{3}Z$/, '+0000');
		qs[key.replace(/([A-Z])/g, '_$1').toLowerCase()] = value as IDataObject[keyof IDataObject];
	}
	return qs;
}

function sortQuery(options: IDataObject): IDataObject {
	return options.sort ? { sort: options.sort, order: options.order ?? 'asc' } : {};
}

// ---------------------------------------------------------------- Supplier bill

export async function executeBill(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	const billPath = () =>
		`4.0/purchase/bills/${encodeURIComponent(String(this.getNodeParameter('billId', itemIndex, '', { extractValue: true })).trim())}`;

	switch (operation) {
		case 'get':
			return (await bexioApiRequest.call(this, 'GET', billPath())) as IDataObject;

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
			if (filters.searchTerm !== undefined && String(filters.searchTerm).trim().length > 0 && String(filters.searchTerm).trim().length < 3) {
				throw new NodeOperationError(this.getNode(), 'The search term needs at least 3 characters', { itemIndex });
			}
			return bexioApiRequestAllPages.call(
				this,
				'4.0/purchase/bills',
				{
					...v4Query(filters, ['billDateStart', 'billDateEnd', 'dueDateStart', 'dueDateEnd']),
					...sortQuery(options),
				},
				limitFor.call(this, itemIndex),
			);
		}

		case 'update': {
			const path = billPath();
			const fields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
			const { bookingAccountId, ...simple } = fields;
			const current = (await bexioApiRequest.call(this, 'GET', path)) as IDataObject;
			const body = { ...billToUpdateBody(current), ...v4Fields(simple, ['billDate', 'dueDate']) };
			if (bookingAccountId) {
				body.line_items = (body.line_items as IDataObject[]).map((item) => ({
					...item,
					booking_account_id: Number(bookingAccountId),
				}));
			}
			Object.assign(body, parseJsonParameter.call(this, fields.additionalJson, 'Additional Fields (JSON)', itemIndex));
			return (await bexioApiRequest.call(this, 'PUT', path, body)) as IDataObject;
		}

		case 'book':
		case 'revertToDraft': {
			// bexio has no separate approval state: booking moves a bill from DRAFT to BOOKED (payable).
			const path = billPath();
			await bexioApiRequest.call(this, 'PUT', `${path}/bookings/${operation === 'book' ? 'BOOKED' : 'DRAFT'}`);
			return (await bexioApiRequest.call(this, 'GET', path)) as IDataObject;
		}

		case 'duplicate':
			return (await bexioApiRequest.call(this, 'POST', `${billPath()}/actions`, { action: 'DUPLICATE' })) as IDataObject;
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}

// ---------------------------------------------------------------- Expense

/** Uploads the receipt of the input item when "Attach Receipt" is on and returns its file id. */
async function uploadReceipt(this: IExecuteFunctions, itemIndex: number): Promise<string | undefined> {
	if (!this.getNodeParameter('attachReceipt', itemIndex, false)) return undefined;
	const files = await uploadInboxFile.call(this, itemIndex, this.getNodeParameter('binaryPropertyName', itemIndex) as string);
	const file = files[0];
	if (!file?.uuid) {
		throw new NodeOperationError(this.getNode(), 'bexio did not return an ID for the uploaded receipt', { itemIndex });
	}
	return String(file.uuid);
}

export async function executeExpense(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	const expensePath = () =>
		`4.0/expenses/${encodeURIComponent(String(this.getNodeParameter('expenseId', itemIndex, '', { extractValue: true })).trim())}`;

	switch (operation) {
		case 'create': {
			const fields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
			const receipt = await uploadReceipt.call(this, itemIndex);
			return (await bexioApiRequest.call(this, 'POST', '4.0/expenses', {
				paid_on: toBexioDate(this.getNodeParameter('paidOn', itemIndex)),
				amount: this.getNodeParameter('amount', itemIndex),
				currency_code: this.getNodeParameter('currencyCode', itemIndex),
				attachment_ids: receipt ? [receipt] : [],
				...v4Fields(fields, []),
				...parseJsonParameter.call(this, fields.additionalJson, 'Additional Fields (JSON)', itemIndex),
			})) as IDataObject;
		}

		case 'get':
			return (await bexioApiRequest.call(this, 'GET', expensePath())) as IDataObject;

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
			return bexioApiRequestAllPages.call(
				this,
				'4.0/expenses',
				{
					...v4Query(filters, ['paidOnStart', 'paidOnEnd'], ['createdAtStart', 'createdAtEnd']),
					...sortQuery(options),
				},
				limitFor.call(this, itemIndex),
			);
		}

		case 'update': {
			const path = expensePath();
			const fields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
			const current = (await bexioApiRequest.call(this, 'GET', path)) as IDataObject;
			const body = { ...expenseToUpdateBody(current), ...v4Fields(fields, ['paidOn']) };
			const receipt = await uploadReceipt.call(this, itemIndex);
			if (receipt) body.attachment_ids = [...(body.attachment_ids as string[]), receipt];
			Object.assign(body, parseJsonParameter.call(this, fields.additionalJson, 'Additional Fields (JSON)', itemIndex));
			return (await bexioApiRequest.call(this, 'PUT', path, body)) as IDataObject;
		}

		case 'delete': {
			const path = expensePath();
			await bexioApiRequest.call(this, 'DELETE', path);
			return { success: true, id: decodeURIComponent(path.split('/').pop() as string) };
		}

		case 'book':
		case 'revertToDraft': {
			const path = expensePath();
			await bexioApiRequest.call(this, 'PUT', `${path}/bookings/${operation === 'book' ? 'DONE' : 'DRAFT'}`);
			return (await bexioApiRequest.call(this, 'GET', path)) as IDataObject;
		}

		case 'duplicate':
			return (await bexioApiRequest.call(this, 'POST', `${expensePath()}/actions`, { action: 'DUPLICATE' })) as IDataObject;
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}
