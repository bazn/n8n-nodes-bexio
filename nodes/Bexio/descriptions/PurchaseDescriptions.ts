import type { INodeProperties } from 'n8n-workflow';

import { additionalJsonField, contactField, optionsField, returnAllFields, uuidLocatorField } from './shared';

const sortOrderField: INodeProperties = {
	displayName: 'Sort Order',
	name: 'order',
	type: 'options',
	options: [
		{ name: 'Ascending', value: 'asc' },
		{ name: 'Descending', value: 'desc' },
	],
	default: 'asc',
};

// ---------------------------------------------------------------- Supplier bill

export const billDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['bill'] } },
		options: [
			{
				name: 'Book',
				value: 'book',
				action: 'Book a supplier bill',
				description: 'Approve a draft bill: set it to booked so it can be paid',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				action: 'Duplicate a supplier bill',
				description: 'Create a draft copy of the bill',
			},
			{ name: 'Get', value: 'get', action: 'Get a supplier bill', description: 'Get a bill with its positions' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many supplier bills' },
			{
				name: 'Revert to Draft',
				value: 'revertToDraft',
				action: 'Revert a supplier bill to draft',
				description: 'Set a booked bill back to draft',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a supplier bill',
				description: 'Change fields of a bill; all other values are kept',
			},
		],
		default: 'getAll',
	},
	uuidLocatorField({
		displayName: 'Supplier Bill',
		name: 'billId',
		searchListMethod: 'searchBills',
		required: true,
		displayOptions: { show: { resource: ['bill'], operation: ['get', 'update', 'book', 'revertToDraft', 'duplicate'] } },
	}),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['bill'], operation: ['update'] } },
		options: [
			{ displayName: 'Bill Date', name: 'billDate', type: 'dateTime', default: '' },
			{
				displayName: 'Booking Account Name or ID',
				name: 'bookingAccountId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAccounts' },
				default: '',
				description:
					'Booking account set on every position. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Document Number',
				name: 'documentNo',
				type: 'string',
				default: '',
				description: 'Must be unique among booked bills',
			},
			{ displayName: 'Due Date', name: 'dueDate', type: 'dateTime', default: '' },
			{ displayName: 'Title', name: 'title', type: 'string', default: '' },
			{ displayName: 'Vendor Reference', name: 'vendorRef', type: 'string', default: '', description: "The supplier's reference, e.g. their invoice number" },
			{
				...additionalJsonField,
				description:
					'Further attributes as in the bexio API reference, e.g. {"payment": {…}} or {"line_items": […]}. Top-level keys replace the current values.',
			},
		],
	},
	...returnAllFields({ show: { resource: ['bill'], operation: ['getAll'] } }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['bill'], operation: ['getAll'] } },
		options: [
			{ displayName: 'Bill Date From', name: 'billDateStart', type: 'dateTime', default: '' },
			{ displayName: 'Bill Date To', name: 'billDateEnd', type: 'dateTime', default: '' },
			{ displayName: 'Currency Code', name: 'currencyCode', type: 'string', default: '', placeholder: 'CHF' },
			{ displayName: 'Document Number', name: 'documentNo', type: 'string', default: '', description: 'Document number contains this text' },
			{ displayName: 'Due Date From', name: 'dueDateStart', type: 'dateTime', default: '' },
			{ displayName: 'Due Date To', name: 'dueDateEnd', type: 'dateTime', default: '' },
			{ displayName: 'Gross Amount Max', name: 'grossMax', type: 'number', default: 0 },
			{ displayName: 'Gross Amount Min', name: 'grossMin', type: 'number', default: 0 },
			{
				displayName: 'Search Term',
				name: 'searchTerm',
				type: 'string',
				default: '',
				description: 'Searches supplier, vendor reference, currency, document number and title (at least 3 characters)',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Draft', value: 'DRAFTS', description: 'Not booked yet (waiting for approval)' },
					{ name: 'Open', value: 'TODO', description: 'Booked but not fully paid' },
					{ name: 'Overdue', value: 'OVERDUE' },
					{ name: 'Paid', value: 'PAID' },
				],
				default: 'DRAFTS',
			},
			contactField({ displayName: 'Supplier', name: 'supplierId' }),
			{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'Title contains this text' },
			{ displayName: 'Vendor Reference', name: 'vendorRef', type: 'string', default: '', description: 'Vendor reference contains this text' },
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['bill'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Sort By',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Bill Date', value: 'bill_date' },
					{ name: 'Document Number', value: 'document_no' },
					{ name: 'Due Date', value: 'due_date' },
				],
				default: 'bill_date',
			},
			sortOrderField,
		],
	},
];

// ---------------------------------------------------------------- Expense

const expenseFields: INodeProperties[] = [
	optionsField('Bank Account', 'bankAccountId', 'getBankAccounts', { hint: 'Account the expense was paid from; required for booking' }),
	{
		displayName: 'Base Currency Amount',
		name: 'baseCurrencyAmount',
		type: 'number',
		typeOptions: { numberPrecision: 2 },
		default: 0,
		description: 'Amount in the base currency; required when the currency differs from it',
	},
	optionsField('Booking Account', 'bookingAccountId', 'getAccounts', { hint: 'Expense account; required for booking' }),
	{
		displayName: 'Document Number',
		name: 'documentNo',
		type: 'string',
		default: '',
		description: 'Must be unique among booked expenses',
	},
	{
		displayName: 'Exchange Rate',
		name: 'exchangeRate',
		type: 'number',
		typeOptions: { numberPrecision: 6 },
		default: 0,
		description: 'Required when the currency differs from the base currency',
	},
	contactField({ displayName: 'Supplier', name: 'supplierId' }),
	optionsField('Tax', 'taxId', 'getPurchaseTaxes'),
	{ displayName: 'Title', name: 'title', type: 'string', default: '' },
	{
		...additionalJsonField,
		description:
			'Further attributes as in the bexio API reference, e.g. {"address": {"lastname_company": "Muster AG", "type": "COMPANY"}}',
	},
];

const receiptFields = (operation: string): INodeProperties[] => [
	{
		displayName: 'Attach Receipt',
		name: 'attachReceipt',
		type: 'boolean',
		default: false,
		description: 'Whether to upload a file from the input (e.g. a scanned receipt) and attach it',
		displayOptions: { show: { resource: ['expense'], operation: [operation] } },
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the input binary field containing the receipt',
		displayOptions: { show: { resource: ['expense'], operation: [operation], attachReceipt: [true] } },
	},
];

export const expenseDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['expense'] } },
		options: [
			{
				name: 'Book',
				value: 'book',
				action: 'Book an expense',
				description: 'Set a draft expense to done (booked)',
			},
			{ name: 'Create', value: 'create', action: 'Create an expense', description: 'Create an expense, optionally with a receipt' },
			{ name: 'Delete', value: 'delete', action: 'Delete an expense' },
			{ name: 'Duplicate', value: 'duplicate', action: 'Duplicate an expense', description: 'Create a draft copy of the expense' },
			{ name: 'Get', value: 'get', action: 'Get an expense' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many expenses' },
			{
				name: 'Revert to Draft',
				value: 'revertToDraft',
				action: 'Revert an expense to draft',
				description: 'Set a booked expense back to draft',
			},
			{ name: 'Update', value: 'update', action: 'Update an expense', description: 'Change fields; all other values are kept' },
		],
		default: 'create',
	},
	uuidLocatorField({
		displayName: 'Expense',
		name: 'expenseId',
		searchListMethod: 'searchExpenses',
		required: true,
		displayOptions: {
			show: { resource: ['expense'], operation: ['get', 'update', 'delete', 'book', 'revertToDraft', 'duplicate'] },
		},
	}),
	{
		displayName: 'Paid On',
		name: 'paidOn',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['expense'], operation: ['create'] } },
	},
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'number',
		typeOptions: { numberPrecision: 2 },
		required: true,
		default: 0,
		description: 'Gross amount paid',
		displayOptions: { show: { resource: ['expense'], operation: ['create'] } },
	},
	{
		displayName: 'Currency Name or ID',
		name: 'currencyCode',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getCurrencyCodes' },
		required: true,
		default: 'CHF',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		hint: 'ISO currency code, e.g. CHF or EUR',
		displayOptions: { show: { resource: ['expense'], operation: ['create'] } },
	},
	...receiptFields('create'),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['expense'], operation: ['create'] } },
		options: expenseFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['expense'], operation: ['update'] } },
		options: [
			{ displayName: 'Amount', name: 'amount', type: 'number', typeOptions: { numberPrecision: 2 }, default: 0 },
			{ displayName: 'Currency Code', name: 'currencyCode', type: 'string', default: '', placeholder: 'CHF' },
			{ displayName: 'Paid On', name: 'paidOn', type: 'dateTime', default: '' },
			...expenseFields,
		],
	},
	...receiptFields('update'),
	...returnAllFields({ show: { resource: ['expense'], operation: ['getAll'] } }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['expense'], operation: ['getAll'] } },
		options: [
			{ displayName: 'Created After', name: 'createdAtStart', type: 'dateTime', default: '' },
			{ displayName: 'Created Before', name: 'createdAtEnd', type: 'dateTime', default: '' },
			{ displayName: 'Currency Code', name: 'currencyCode', type: 'string', default: '', placeholder: 'CHF' },
			{ displayName: 'Document Number', name: 'documentNo', type: 'string', default: '', description: 'Document number contains this text' },
			{ displayName: 'Gross Amount Max', name: 'grossMax', type: 'number', default: 0 },
			{ displayName: 'Gross Amount Min', name: 'grossMin', type: 'number', default: 0 },
			{ displayName: 'Paid On From', name: 'paidOnStart', type: 'dateTime', default: '' },
			{ displayName: 'Paid On To', name: 'paidOnEnd', type: 'dateTime', default: '' },
			contactField({ displayName: 'Supplier', name: 'supplierId' }),
			{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'Title contains this text' },
			{ displayName: 'Vendor', name: 'vendor', type: 'string', default: '', description: 'Supplier name contains this text' },
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['expense'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Sort By',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Created At', value: 'created_at' },
					{ name: 'Document Number', value: 'document_no' },
					{ name: 'Paid On', value: 'paid_on' },
				],
				default: 'paid_on',
			},
			sortOrderField,
		],
	},
];
