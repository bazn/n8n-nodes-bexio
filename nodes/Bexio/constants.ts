import type { INodePropertyOptions } from 'n8n-workflow';

export type DocumentKind = 'invoice' | 'quote' | 'order';

export interface DocumentType {
	label: string;
	/** API path below `/2.0/`. */
	path: string;
	/** Name of the "valid until" field: invoices use `is_valid_to`, quotes `is_valid_until`, orders have none. */
	validUntilField?: string;
	statuses: INodePropertyOptions[];
	/** List search method for the document locator. */
	searchListMethod: string;
}

/** Sales documents ("kb" = Kundenbeleg) share one API shape. Status ids are from the bexio API reference. */
export const DOCUMENT_TYPES: Record<DocumentKind, DocumentType> = {
	invoice: {
		label: 'Invoice',
		path: 'kb_invoice',
		validUntilField: 'is_valid_to',
		searchListMethod: 'searchInvoices',
		statuses: [
			{ name: 'Draft', value: 7 },
			{ name: 'Pending', value: 8 },
			{ name: 'Paid', value: 9 },
			{ name: 'Partial', value: 16 },
			{ name: 'Canceled', value: 19 },
			{ name: 'Unpaid', value: 31 },
		],
	},
	quote: {
		label: 'Quote',
		path: 'kb_offer',
		validUntilField: 'is_valid_until',
		searchListMethod: 'searchQuotes',
		statuses: [
			{ name: 'Draft', value: 1 },
			{ name: 'Pending', value: 2 },
			{ name: 'Confirmed', value: 3 },
			{ name: 'Declined', value: 4 },
		],
	},
	order: {
		label: 'Order',
		path: 'kb_order',
		searchListMethod: 'searchOrders',
		statuses: [
			{ name: 'Pending', value: 5 },
			{ name: 'Done', value: 6 },
			{ name: 'Partial', value: 15 },
			{ name: 'Canceled', value: 21 },
		],
	},
};

export const DOCUMENT_KINDS = Object.keys(DOCUMENT_TYPES) as DocumentKind[];

export const STATUS_NAME_BY_ID: Record<number, string> = Object.fromEntries(
	DOCUMENT_KINDS.flatMap((kind) =>
		DOCUMENT_TYPES[kind].statuses.map((status) => [status.value as number, status.name]),
	),
);

export const CONTACT_TYPES: INodePropertyOptions[] = [
	{ name: 'Company', value: 1 },
	{ name: 'Person', value: 2 },
];

export const ARTICLE_TYPES: INodePropertyOptions[] = [
	{ name: 'Physical Product', value: 1 },
	{ name: 'Service', value: 2 },
];

export const VAT_TYPES: INodePropertyOptions[] = [
	{ name: 'Including Taxes', value: 0 },
	{ name: 'Excluding Taxes', value: 1 },
	{ name: 'Exempt From Taxes', value: 2 },
];

export const PROJECT_INVOICE_TYPES: INodePropertyOptions[] = [
	{ name: 'Hourly Rate per Business Activity', value: 1 },
	{ name: 'Hourly Rate per Employee', value: 2 },
	{ name: 'Hourly Rate for Project', value: 3 },
	{ name: 'Fixed Price', value: 4 },
];

export const PROJECT_BUDGET_TYPES: INodePropertyOptions[] = [
	{ name: 'Total Budgeted Costs', value: 1 },
	{ name: 'Total Budgeted Hours', value: 2 },
	{ name: 'Budget per Business Activity', value: 3 },
	{ name: 'Budget per Employee', value: 4 },
];

export const SEARCH_CRITERIA: INodePropertyOptions[] = [
	{ name: 'Contains', value: 'like' },
	{ name: 'Does Not Contain', value: 'not_like' },
	{ name: 'Equals', value: '=' },
	{ name: 'Greater or Equal', value: '>=' },
	{ name: 'Greater Than', value: '>' },
	{ name: 'In List', value: 'in', description: 'Comma-separated values' },
	{ name: 'Is Empty', value: 'is_null' },
	{ name: 'Is Not Empty', value: 'not_null' },
	{ name: 'Less or Equal', value: '<=' },
	{ name: 'Less Than', value: '<' },
	{ name: 'Not Equal', value: '!=' },
	{ name: 'Not in List', value: 'not_in', description: 'Comma-separated values' },
];

/** Searchable fields per endpoint, from the bexio API reference. */
export const SEARCH_FIELDS: Record<string, string[]> = {
	contact: [
		'id',
		'name_1',
		'name_2',
		'nr',
		'address',
		'mail',
		'mail_second',
		'postcode',
		'city',
		'country_id',
		'contact_group_ids',
		'contact_type_id',
		'updated_at',
		'user_id',
		'phone_fixed',
		'phone_mobile',
		'fax',
	],
	kb_invoice: [
		'id',
		'kb_item_status_id',
		'document_nr',
		'title',
		'api_reference',
		'contact_id',
		'contact_sub_id',
		'user_id',
		'currency_id',
		'total_gross',
		'total_net',
		'total',
		'is_valid_from',
		'is_valid_to',
		'updated_at',
	],
	kb_offer: [
		'id',
		'kb_item_status_id',
		'document_nr',
		'title',
		'contact_id',
		'contact_sub_id',
		'user_id',
		'currency_id',
		'total_gross',
		'total_net',
		'total',
		'is_valid_from',
		'is_valid_until',
		'updated_at',
	],
	kb_order: [
		'id',
		'kb_item_status_id',
		'document_nr',
		'title',
		'contact_id',
		'contact_sub_id',
		'user_id',
		'currency_id',
		'total_gross',
		'total_net',
		'total',
		'is_valid_from',
		'is_valid_to',
		'updated_at',
	],
	article: ['intern_name', 'intern_code'],
	pr_project: ['name', 'contact_id', 'pr_state_id'],
	timesheet: ['id', 'client_service_id', 'contact_id', 'user_id', 'pr_project_id', 'status_id'],
	task: ['subject', 'updated_at', 'user_id', 'contact_id', 'todo_status_id', 'module_id', 'entry_id'],
	note: ['event_start', 'contact_id', 'user_id', 'subject', 'module_id', 'entry_id'],
};

export const POSITION_TYPES: INodePropertyOptions[] = [
	{ name: 'Custom', value: 'KbPositionCustom', description: 'Free text position with quantity and price' },
	{ name: 'Discount', value: 'KbPositionDiscount' },
	{ name: 'Item', value: 'KbPositionArticle', description: 'Position based on an item (product or service)' },
	{ name: 'Page Break', value: 'KbPositionPagebreak' },
	{ name: 'Subtotal', value: 'KbPositionSubtotal' },
	{ name: 'Text', value: 'KbPositionText' },
];
