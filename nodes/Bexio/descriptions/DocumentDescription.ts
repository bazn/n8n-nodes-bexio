import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { DOCUMENT_TYPES, type DocumentKind, POSITION_TYPES, VAT_TYPES } from '../constants';
import {
	additionalJsonField,
	contactField,
	locatorField,
	optionsField,
	orderByField,
	projectField,
	returnAllFields,
	searchConditionsField,
	userField,
} from './shared';

/** Operations available for every sales document, plus the kind-specific ones. */
function operationOptions(kind: DocumentKind): INodePropertyOptions[] {
	const label = DOCUMENT_TYPES[kind].label.toLowerCase();
	const a = kind === 'order' ? 'an' : 'a';
	const options: INodePropertyOptions[] = [
		{ name: 'Create', value: 'create', action: `Create ${a} ${label}`, description: `Create ${a} ${label} with positions` },
		{ name: 'Delete', value: 'delete', action: `Delete ${a} ${label}` },
		{ name: 'Get', value: 'get', action: `Get ${a} ${label}`, description: `Get ${a} ${label} with its positions` },
		{ name: 'Get Many', value: 'getAll', action: `Get many ${label}s`, description: `List or search ${label}s` },
		{
			name: 'Get PDF',
			value: 'getPdf',
			action: `Get ${a} ${label} as PDF`,
			description: `Download the ${label} as PDF file (binary)`,
		},
		{ name: 'Update', value: 'update', action: `Update ${a} ${label}`, description: `Update the header data of ${a} ${label}` },
	];

	if (kind === 'invoice' || kind === 'quote') {
		options.push(
			{ name: 'Copy', value: 'copy', action: `Copy ${a} ${label}`, description: `Copy the ${label} for another contact` },
			{ name: 'Issue', value: 'issue', action: `Issue ${a} ${label}`, description: `Issue a draft ${label}` },
			{ name: 'Mark as Sent', value: 'markAsSent', action: `Mark ${a} ${label} as sent` },
			{
				name: 'Revert Issue',
				value: 'revertIssue',
				action: `Revert issue of ${a} ${label}`,
				description: `Set an issued ${label} back to draft`,
			},
			{ name: 'Send', value: 'send', action: `Send ${a} ${label}`, description: `Send the ${label} by email` },
		);
	}
	if (kind === 'invoice') {
		options.push(
			{ name: 'Add Payment', value: 'addPayment', action: 'Add a payment to an invoice' },
			{ name: 'Cancel', value: 'cancel', action: 'Cancel an invoice', description: 'Cancel an issued invoice' },
			{ name: 'Get Payments', value: 'getPayments', action: 'Get payments of an invoice' },
		);
	}
	if (kind === 'quote') {
		options.push(
			{ name: 'Accept', value: 'accept', action: 'Accept a quote', description: 'Accept a pending quote' },
			{ name: 'Create Invoice', value: 'createInvoice', action: 'Create an invoice from a quote' },
			{ name: 'Create Order', value: 'createOrder', action: 'Create an order from a quote' },
			{ name: 'Reject', value: 'reject', action: 'Reject a quote', description: 'Decline a pending quote' },
		);
	}
	if (kind === 'order') {
		options.push(
			{ name: 'Create Delivery', value: 'createDelivery', action: 'Create a delivery from an order' },
			{ name: 'Create Invoice', value: 'createInvoice', action: 'Create an invoice from an order' },
		);
	}
	return options.sort((left, right) => left.name.localeCompare(right.name));
}

/** Header fields of a document, shared by Create and Update. */
function documentFields(kind: DocumentKind): INodeProperties[] {
	const fields: INodeProperties[] = [
		{
			displayName: 'API Reference',
			name: 'apiReference',
			type: 'string',
			default: '',
			description: 'Reference only visible to the API, e.g. the ID in another system',
		},
		optionsField('Bank Account', 'bankAccountId', 'getBankAccounts'),
		contactField({ displayName: 'Contact Person', name: 'contactSubId', description: 'Contact person of the contact' }),
		{
			displayName: 'Contact Address (Manual)',
			name: 'contactAddressManual',
			type: 'string',
			typeOptions: { rows: 4 },
			default: '',
			description: "Overrides the contact's address on the document",
		},
		optionsField('Currency', 'currencyId', 'getCurrencies'),
		{
			displayName: 'Document Number',
			name: 'documentNr',
			type: 'string',
			default: '',
			description: 'Only allowed if automatic numbering is turned off in bexio',
		},
		{ displayName: 'Footer', name: 'footer', type: 'string', typeOptions: { rows: 4 }, default: '' },
		{ displayName: 'Header', name: 'header', type: 'string', typeOptions: { rows: 4 }, default: '' },
		optionsField('Language', 'languageId', 'getLanguages'),
		optionsField('Payment Type', 'paymentTypeId', 'getPaymentTypes'),
		projectField({ displayName: 'Project', name: 'prProjectId' }),
		{
			displayName: 'Show Position Taxes',
			name: 'showPositionTaxes',
			type: 'boolean',
			default: false,
			description: 'Whether the tax of every position is shown on the document',
		},
		{
			displayName: 'Taxes Are Net',
			name: 'mwstIsNet',
			type: 'boolean',
			default: true,
			description: 'Whether taxes are added to the total (only for "Including Taxes")',
		},
		optionsField('Template', 'templateSlug', 'getDocumentTemplates'),
		{ displayName: 'Title', name: 'title', type: 'string', default: '' },
		userField('userId', 'Responsible User'),
		{ displayName: 'Valid From', name: 'isValidFrom', type: 'dateTime', default: '', description: 'Document date' },
		{ displayName: 'VAT Type', name: 'mwstType', type: 'options', options: VAT_TYPES, default: 0 },
	];
	if (DOCUMENT_TYPES[kind].validUntilField) {
		fields.push({
			displayName: kind === 'invoice' ? 'Due Date' : 'Valid Until',
			name: 'validUntil',
			type: 'dateTime',
			default: '',
		});
	}
	if (kind === 'invoice') {
		fields.push({ displayName: 'Reference', name: 'reference', type: 'string', default: '' });
	}
	if (kind !== 'invoice') {
		fields.push(
			{
				displayName: 'Delivery Address',
				name: 'deliveryAddressType',
				type: 'options',
				options: [
					{ name: 'Use Invoice Address', value: 0 },
					{ name: 'Manual Address', value: 1 },
				],
				default: 0,
			},
			{
				displayName: 'Delivery Address (Manual)',
				name: 'deliveryAddressManual',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Used when Delivery Address is "Manual Address"',
			},
		);
	}
	return [...fields.sort((left, right) => left.displayName.localeCompare(right.displayName)), additionalJsonField];
}

function positionFields(kind: DocumentKind): INodeProperties[] {
	const show = (types: string[]) => ({ show: { type: types } });
	const priced = ['KbPositionCustom', 'KbPositionArticle'];
	const values: INodeProperties[] = [
		{ displayName: 'Type', name: 'type', type: 'options', options: POSITION_TYPES, default: 'KbPositionCustom' },
		{
			displayName: 'Item ID',
			name: 'articleId',
			type: 'string',
			default: '',
			description: 'ID of the item (see the Item resource)',
			displayOptions: show(['KbPositionArticle']),
		},
		{
			displayName: 'Text',
			name: 'text',
			type: 'string',
			typeOptions: { rows: 2 },
			default: '',
			displayOptions: show([...priced, 'KbPositionText', 'KbPositionSubtotal', 'KbPositionDiscount']),
		},
		{ displayName: 'Quantity', name: 'amount', type: 'number', typeOptions: { numberPrecision: 6 }, default: 1, displayOptions: show(priced) },
		{
			displayName: 'Unit Price',
			name: 'unitPrice',
			type: 'number',
			typeOptions: { numberPrecision: 6 },
			default: 0,
			displayOptions: show(priced),
		},
		{
			displayName: 'Tax Name or ID',
			name: 'taxId',
			type: 'options',
			description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			typeOptions: { loadOptionsMethod: 'getSalesTaxes' },
			default: '',
			displayOptions: show(priced),
		},
		{
			displayName: 'Unit Name or ID',
			name: 'unitId',
			type: 'options',
			description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			typeOptions: { loadOptionsMethod: 'getUnits' },
			default: '',
			displayOptions: show(priced),
		},
		{
			displayName: 'Account Name or ID',
			name: 'accountId',
			type: 'options',
			description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			typeOptions: { loadOptionsMethod: 'getAccounts' },
			default: '',
			displayOptions: show(priced),
		},
		{
			displayName: 'Discount (%)',
			name: 'discountInPercent',
			type: 'number',
			default: 0,
			displayOptions: show(priced),
		},
		{
			displayName: 'Discount Value',
			name: 'value',
			type: 'number',
			default: 0,
			displayOptions: show(['KbPositionDiscount']),
		},
		{
			displayName: 'Discount Is Percentage',
			name: 'isPercentual',
			type: 'boolean',
			default: true,
			description: 'Whether the discount value is a percentage instead of an amount',
			displayOptions: show(['KbPositionDiscount']),
		},
		{
			displayName: 'Show Position Number',
			name: 'showPosNr',
			type: 'boolean',
			default: false,
			description: 'Whether the text position gets a position number',
			displayOptions: show(['KbPositionText']),
		},
	];
	if (kind !== 'invoice') {
		values.push({
			displayName: 'Optional',
			name: 'isOptional',
			type: 'boolean',
			default: false,
			description: 'Whether the position is optional',
			displayOptions: show(priced),
		});
	}
	return values;
}

export function documentDescription(kind: DocumentKind): INodeProperties[] {
	const type = DOCUMENT_TYPES[kind];
	const resource = { resource: [kind] };
	const on = (...operations: string[]) => ({ show: { ...resource, operation: operations } });
	const label = type.label.toLowerCase();

	const properties: INodeProperties[] = [
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: resource },
			options: operationOptions(kind),
			default: 'getAll',
		},
		locatorField({
			displayName: type.label,
			name: 'documentId',
			searchListMethod: type.searchListMethod,
			required: true,
			displayOptions: {
				show: resource,
				hide: { operation: ['create', 'getAll'] },
			},
		}),

		// ------------------------------------------------ Create / Update
		contactField({ displayName: 'Contact', name: 'contactId', required: true, displayOptions: on('create', 'copy') }),
		{
			displayName: 'Positions Input',
			name: 'positionsInput',
			type: 'options',
			options: [
				{ name: 'Fields', value: 'fields', description: 'Enter the positions one by one' },
				{ name: 'JSON', value: 'json', description: 'Pass the positions array as JSON, e.g. from a previous node' },
			],
			default: 'fields',
			displayOptions: on('create'),
		},
		{
			displayName: 'Positions',
			name: 'positions',
			type: 'fixedCollection',
			typeOptions: { multipleValues: true, sortable: true },
			placeholder: 'Add Position',
			default: {},
			displayOptions: { show: { ...resource, operation: ['create'], positionsInput: ['fields'] } },
			options: [{ displayName: 'Position', name: 'position', values: positionFields(kind) }],
		},
		{
			displayName: 'Positions (JSON)',
			name: 'positionsJson',
			type: 'json',
			default:
				'[\n  {\n    "type": "KbPositionCustom",\n    "text": "Consulting",\n    "amount": "1",\n    "unit_price": "150.00",\n    "tax_id": 16\n  }\n]',
			description: 'Array of positions as in the bexio API reference',
			displayOptions: { show: { ...resource, operation: ['create'], positionsInput: ['json'] } },
		},
		{
			displayName: 'Additional Fields',
			name: 'additionalFields',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: on('create'),
			options: documentFields(kind),
		},
		{
			displayName: 'Update Fields',
			name: 'updateFields',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: on('update'),
			options: [
				contactField({ displayName: 'Contact', name: 'contactId' }),
				...documentFields(kind),
			],
		},

		// ------------------------------------------------ Get Many
		...returnAllFields(on('getAll')),
		{
			displayName: 'Filters',
			name: 'filters',
			type: 'collection',
			placeholder: 'Add Filter',
			default: {},
			displayOptions: on('getAll'),
			options: [
				contactField({ displayName: 'Contact', name: 'contactId' }),
				{ displayName: 'Document Number', name: 'documentNr', type: 'string', default: '' },
				{
					displayName: 'Status',
					name: 'statuses',
					type: 'multiOptions',
					options: type.statuses,
					default: [],
					description: `Only ${label}s with one of these statuses`,
				},
				{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'Title contains this text' },
				{
					displayName: 'Updated Since',
					name: 'updatedSince',
					type: 'dateTime',
					default: '',
					description: `Only ${label}s changed at or after this time`,
				},
				userField('userId', 'Responsible User', `Only ${label}s of this user`),
				{
					displayName: 'Valid From After',
					name: 'validFromAfter',
					type: 'dateTime',
					default: '',
					description: 'Only documents dated on or after this day',
				},
				{
					displayName: 'Valid From Before',
					name: 'validFromBefore',
					type: 'dateTime',
					default: '',
					description: 'Only documents dated on or before this day',
				},
			],
		},
		searchConditionsField(type.path, on('getAll')),
		orderByField(['id', 'updated_at', 'total'], on('getAll')),

		// ------------------------------------------------ Get PDF
		{
			displayName: 'Put Output File in Field',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			required: true,
			hint: 'The name of the output binary field to put the PDF in',
			displayOptions: on('getPdf'),
		},
	];

	if (kind === 'invoice' || kind === 'quote') {
		properties.push(
			{
				displayName: 'Recipient Email',
				name: 'recipientEmail',
				type: 'string',
				placeholder: 'name@email.com',
				required: true,
				default: '',
				displayOptions: on('send'),
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				required: true,
				default: '',
				displayOptions: on('send'),
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 5 },
				required: true,
				default: `Hello\n\nPlease find the ${label} here: [Network Link]\n\nKind regards`,
				hint: 'Must contain the placeholder [Network Link]',
				displayOptions: on('send'),
			},
			{
				displayName: 'Options',
				name: 'sendOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: on('send'),
				options: [
					{
						displayName: 'Attach PDF',
						name: 'attachPdf',
						type: 'boolean',
						default: false,
						description: `Whether to attach the ${label} as PDF to the email`,
					},
					{
						displayName: 'Mark as Open',
						name: 'markAsOpen',
						type: 'boolean',
						default: false,
						description: `Whether to set the ${label} to pending (issued) when sending`,
					},
				],
			},
			{
				displayName: 'Options',
				name: 'copyOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: on('copy'),
				options: [
					contactField({ displayName: 'Contact Person', name: 'contactSubId' }),
					{ displayName: 'Title', name: 'title', type: 'string', default: '' },
					{ displayName: 'Valid From', name: 'isValidFrom', type: 'dateTime', default: '' },
				],
			},
		);
	}

	if (kind === 'invoice') {
		properties.push(
			{
				displayName: 'Amount',
				name: 'paymentValue',
				type: 'number',
				typeOptions: { numberPrecision: 2 },
				required: true,
				default: 0,
				displayOptions: on('addPayment'),
			},
			{
				displayName: 'Options',
				name: 'paymentOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: on('addPayment'),
				options: [
					optionsField('Bank Account', 'bankAccountId', 'getBankAccounts'),
					{ displayName: 'Date', name: 'date', type: 'dateTime', default: '', description: 'Payment date. Empty means today.' },
				],
			},
		);
	}

	return properties;
}
