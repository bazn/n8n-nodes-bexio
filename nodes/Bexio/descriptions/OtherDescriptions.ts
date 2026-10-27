import type { INodeProperties } from 'n8n-workflow';

import { ARTICLE_TYPES } from '../constants';
import {
	additionalJsonField,
	contactField,
	locatorField,
	optionsField,
	orderByField,
	returnAllFields,
	searchConditionsField,
} from './shared';

// ---------------------------------------------------------------- Item (article)

const articleFields: INodeProperties[] = [
	optionsField('Expense Account', 'expenseAccountId', 'getAccounts'),
	optionsField('Currency', 'currencyId', 'getCurrencies'),
	{ displayName: 'Description', name: 'internDescription', type: 'string', typeOptions: { rows: 3 }, default: '' },
	{ displayName: 'Item Code', name: 'internCode', type: 'string', default: '', description: 'Internal item number' },
	{ displayName: 'Item Type', name: 'articleTypeId', type: 'options', options: ARTICLE_TYPES, default: 1 },
	{ displayName: 'Purchase Price', name: 'purchasePrice', type: 'number', typeOptions: { numberPrecision: 2 }, default: 0 },
	optionsField('Purchase Tax', 'taxExpenseId', 'getPurchaseTaxes'),
	{ displayName: 'Remarks', name: 'remarks', type: 'string', typeOptions: { rows: 3 }, default: '' },
	optionsField('Revenue Account', 'accountId', 'getAccounts'),
	{ displayName: 'Sale Price', name: 'salePrice', type: 'number', typeOptions: { numberPrecision: 2 }, default: 0 },
	optionsField('Sales Tax', 'taxIncomeId', 'getSalesTaxes'),
	{
		displayName: 'Stock Managed',
		name: 'isStock',
		type: 'boolean',
		default: false,
		description: 'Whether bexio tracks the stock of this item (needs the stock_edit scope)',
	},
	{ displayName: 'Stock Minimum', name: 'stockMinNr', type: 'number', default: 0 },
	{ displayName: 'Stock Quantity', name: 'stockNr', type: 'number', default: 0 },
	contactField({ displayName: 'Supplier', name: 'contactId' }),
	{ displayName: 'Supplier Item Code', name: 'delivererCode', type: 'string', default: '' },
	{ displayName: 'Supplier Item Name', name: 'delivererName', type: 'string', default: '' },
	optionsField('Unit', 'unitId', 'getUnits'),
	additionalJsonField,
];

export const articleDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['article'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create an item' },
			{ name: 'Delete', value: 'delete', action: 'Delete an item' },
			{ name: 'Get', value: 'get', action: 'Get an item' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many items' },
			{ name: 'Update', value: 'update', action: 'Update an item' },
		],
		default: 'getAll',
	},
	locatorField({
		displayName: 'Item',
		name: 'articleId',
		searchListMethod: 'searchArticles',
		required: true,
		displayOptions: { show: { resource: ['article'], operation: ['get', 'update', 'delete'] } },
	}),
	{
		displayName: 'Name',
		name: 'internName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['article'], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['article'], operation: ['create'] } },
		options: articleFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['article'], operation: ['update'] } },
		options: [{ displayName: 'Name', name: 'internName', type: 'string', default: '' }, ...articleFields],
	},
	...returnAllFields({ show: { resource: ['article'], operation: ['getAll'] } }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['article'], operation: ['getAll'] } },
		options: [
			{ displayName: 'Item Code', name: 'internCode', type: 'string', default: '', description: 'Item code contains this text' },
			{ displayName: 'Name', name: 'internName', type: 'string', default: '', description: 'Name contains this text' },
		],
	},
	searchConditionsField('article', { show: { resource: ['article'], operation: ['getAll'] } }),
	orderByField(['id', 'intern_name'], { show: { resource: ['article'], operation: ['getAll'] } }),
];

// ---------------------------------------------------------------- File (inbox)

export const fileDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['file'] } },
		options: [
			{ name: 'Delete', value: 'delete', action: 'Delete a file' },
			{ name: 'Download', value: 'download', action: 'Download a file' },
			{ name: 'Get', value: 'get', action: 'Get a file', description: 'Get the metadata of a file' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many files' },
			{ name: 'Upload', value: 'upload', action: 'Upload a file', description: 'Upload a file to the bexio inbox' },
		],
		default: 'upload',
	},
	{
		displayName: 'File ID',
		name: 'fileId',
		type: 'string',
		required: true,
		default: '',
		description: 'Numeric ID or UUID of the file',
		displayOptions: { show: { resource: ['file'], operation: ['get', 'download', 'delete'] } },
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the input binary field containing the file to upload',
		displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the output binary field to put the file in',
		displayOptions: { show: { resource: ['file'], operation: ['download'] } },
	},
	...returnAllFields({ show: { resource: ['file'], operation: ['getAll'] } }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['file'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Archived State',
				name: 'archivedState',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Archived', value: 'archived' },
					{ name: 'Not Archived', value: 'not_archived' },
				],
				default: 'not_archived',
			},
			{ displayName: 'Name', name: 'name', type: 'string', default: '', description: 'Name contains this text' },
		],
	},
];

// ---------------------------------------------------------------- User

export const userDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['user'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get a user' },
			{ name: 'Get Current', value: 'getCurrent', action: 'Get the current user', description: 'Get the user the credential belongs to' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many users' },
		],
		default: 'getCurrent',
	},
	optionsField('User', 'userId', 'getUsers', {
		required: true,
		displayOptions: { show: { resource: ['user'], operation: ['get'] } },
	}),
	...returnAllFields({ show: { resource: ['user'], operation: ['getAll'] } }),
];

// ---------------------------------------------------------------- API request

export const apiRequestDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['apiRequest'] } },
		options: [
			{
				name: 'Send',
				value: 'send',
				action: 'Send an API request',
				description: 'Call any bexio endpoint with the node credential',
			},
		],
		default: 'send',
	},
	{
		displayName: 'Method',
		name: 'method',
		type: 'options',
		options: ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'].map((method) => ({ name: method, value: method })),
		default: 'GET',
		displayOptions: { show: { resource: ['apiRequest'] } },
	},
	{
		displayName: 'Endpoint',
		name: 'endpoint',
		type: 'string',
		required: true,
		default: '',
		placeholder: '2.0/contact_relation',
		description: 'Path below https://api.bexio.com, including the API version',
		displayOptions: { show: { resource: ['apiRequest'] } },
	},
	{
		displayName: 'Query Parameters (JSON)',
		name: 'query',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['apiRequest'] } },
	},
	{
		displayName: 'Body (JSON)',
		name: 'body',
		type: 'json',
		default: '',
		description: 'Request body; an object or an array (e.g. search conditions)',
		displayOptions: { show: { resource: ['apiRequest'], method: ['PATCH', 'POST', 'PUT'] } },
	},
	{
		displayName: 'Split Array Responses Into Items',
		name: 'splitArray',
		type: 'boolean',
		default: true,
		description: 'Whether a response that is an array becomes one item per entry',
		displayOptions: { show: { resource: ['apiRequest'] } },
	},
];
