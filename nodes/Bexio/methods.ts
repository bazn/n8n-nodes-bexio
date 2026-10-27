import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';

import { DOCUMENT_TYPES, type DocumentKind, STATUS_NAME_BY_ID } from './constants';
import { bexioApiRequest, bexioApiRequestAllItems } from './GenericFunctions';

const LIST_PAGE_SIZE = 50;

/** Loads a lookup list and turns it into sorted options. */
async function lookup(
	this: ILoadOptionsFunctions,
	endpoint: string,
	name: (row: IDataObject) => string,
	qs: IDataObject = {},
	value: (row: IDataObject) => string | number = (row) => row.id as number,
	paged = true,
): Promise<INodePropertyOptions[]> {
	const rows = paged
		? await bexioApiRequestAllItems.call(this, 'GET', endpoint, undefined, qs)
		: ((await bexioApiRequest.call(this, 'GET', endpoint, undefined, qs)) as IDataObject[]);
	return rows
		.map((row) => ({ name: name(row), value: value(row) }))
		.sort((left, right) => left.name.localeCompare(right.name));
}

const byName = (row: IDataObject) => String(row.name ?? row.id);

function taxName(row: IDataObject): string {
	return String(row.display_name ?? row.name ?? row.code ?? row.id);
}

export const loadOptions = {
	async getUsers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return lookup.call(this, '3.0/users', (row) =>
			[`${row.firstname ?? ''} ${row.lastname ?? ''}`.trim(), row.email ? `(${row.email})` : '']
				.filter(Boolean)
				.join(' ') || String(row.id),
		);
	},
	async getContactGroups(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/contact_group', byName);
	},
	async getContactSectors(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/contact_branch', byName);
	},
	async getCountries(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/country', (row) => `${row.name} (${row.iso3166_alpha2 ?? row.name_short ?? ''})`);
	},
	async getLanguages(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/language', byName);
	},
	async getSalutations(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/salutation', byName);
	},
	async getTitles(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/title', byName);
	},
	async getCurrencies(this: ILoadOptionsFunctions) {
		return lookup.call(this, '3.0/currencies', byName);
	},
	async getSalesTaxes(this: ILoadOptionsFunctions) {
		return lookup.call(this, '3.0/taxes', taxName, { scope: 'active', types: 'sales_tax' });
	},
	async getPurchaseTaxes(this: ILoadOptionsFunctions) {
		return lookup.call(this, '3.0/taxes', taxName, { scope: 'active', types: 'pre_tax' });
	},
	async getUnits(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/unit', byName);
	},
	async getAccounts(this: ILoadOptionsFunctions) {
		const rows = await bexioApiRequestAllItems.call(this, 'GET', '2.0/accounts');
		return rows
			.filter((row) => row.is_active !== false)
			.map((row) => ({ name: `${row.account_no} ${row.name}`, value: row.id as number }))
			.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
	},
	async getBankAccounts(this: ILoadOptionsFunctions) {
		return lookup.call(this, '3.0/banking/accounts', (row) =>
			row.iban_nr ? `${row.name} (${row.iban_nr})` : String(row.name ?? row.id),
		);
	},
	async getPaymentTypes(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/payment_type', byName);
	},
	async getProjectStates(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/pr_project_state', byName, {}, undefined, false);
	},
	async getProjectTypes(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/pr_project_type', byName, {}, undefined, false);
	},
	async getBusinessActivities(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/client_service', byName);
	},
	async getTimesheetStatuses(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/timesheet_status', byName);
	},
	async getTodoStatuses(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/todo_status', byName);
	},
	async getTodoPriorities(this: ILoadOptionsFunctions) {
		return lookup.call(this, '2.0/todo_priority', byName);
	},
	async getCurrencyCodes(this: ILoadOptionsFunctions) {
		return lookup.call(this, '3.0/currencies', byName, {}, byName);
	},
	async getDocumentTemplates(this: ILoadOptionsFunctions) {
		return lookup.call(
			this,
			'3.0/document_templates',
			(row) => `${row.name}${row.is_default ? ' (default)' : ''}`,
			{},
			(row) => row.template_slug as string,
			false,
		);
	},
};

interface ListSearchSpec {
	endpoint: string;
	/** Search fields matched with "contains" against the user's text (each one is tried in turn). */
	fields: string[];
	name: (row: IDataObject) => string;
	orderBy?: string;
	url?: (row: IDataObject) => string;
}

/**
 * Searchable list for resource locators. bexio combines search conditions with AND, so each search
 * field is queried separately and the results are merged.
 */
async function listSearchRows(
	this: ILoadOptionsFunctions,
	spec: ListSearchSpec,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const offset = paginationToken ? Number(paginationToken) : 0;
	const qs: IDataObject = { limit: LIST_PAGE_SIZE, offset, ...(spec.orderBy && { order_by: spec.orderBy }) };
	let rows: IDataObject[];
	let more: boolean;
	if (filter) {
		const seen = new Map<number, IDataObject>();
		for (const field of spec.fields) {
			const found = (await bexioApiRequest.call(
				this,
				'POST',
				`${spec.endpoint}/search`,
				[{ field, value: filter, criteria: 'like' }],
				{ ...qs, offset: 0 },
			)) as IDataObject[];
			for (const row of found) seen.set(row.id as number, row);
		}
		rows = [...seen.values()];
		more = false;
	} else {
		rows = (await bexioApiRequest.call(this, 'GET', spec.endpoint, undefined, qs)) as IDataObject[];
		more = rows.length === LIST_PAGE_SIZE;
	}
	return {
		results: rows.map((row) => ({ name: spec.name(row), value: String(row.id), url: spec.url?.(row) })),
		paginationToken: more ? String(offset + LIST_PAGE_SIZE) : undefined,
	};
}

function contactName(row: IDataObject): string {
	const name = row.contact_type_id === 2 ? `${row.name_2 ?? ''} ${row.name_1 ?? ''}`.trim() : String(row.name_1 ?? '');
	const place = [row.postcode, row.city].filter(Boolean).join(' ');
	return `${row.nr ? `${row.nr} · ` : ''}${name}${place ? ` (${place})` : ''}`;
}

function documentSearch(kind: DocumentKind) {
	return async function (this: ILoadOptionsFunctions, filter?: string, paginationToken?: string) {
		return listSearchRows.call(
			this,
			{
				endpoint: `2.0/${DOCUMENT_TYPES[kind].path}`,
				fields: ['document_nr', 'title'],
				orderBy: 'id_desc',
				name: (row) =>
					[row.document_nr, row.title, STATUS_NAME_BY_ID[row.kb_item_status_id as number]]
						.filter(Boolean)
						.join(' · ') || String(row.id),
			},
			filter,
			paginationToken,
		);
	};
}

/** Searchable list for v4 records (supplier bills, expenses), which page with `page` and answer `{ data, paging }`. */
async function listSearchV4(
	this: ILoadOptionsFunctions,
	endpoint: string,
	searchQuery: (filter: string) => IDataObject,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = paginationToken ? Number(paginationToken) : 1;
	const response = (await bexioApiRequest.call(this, 'GET', endpoint, undefined, {
		limit: LIST_PAGE_SIZE,
		page,
		...(filter ? searchQuery(filter) : {}),
	})) as { data?: IDataObject[]; paging?: { page_count?: number } };
	const rows = response.data ?? [];
	return {
		results: rows.map((row) => ({
			name:
				[row.document_no, row.vendor ?? row.lastname_company, row.title, row.status].filter(Boolean).join(' · ') ||
				String(row.id),
			value: String(row.id),
		})),
		paginationToken: page < (response.paging?.page_count ?? page) ? String(page + 1) : undefined,
	};
}

export const listSearch = {
	async searchBills(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string) {
		// search_term needs at least 3 characters; shorter input searches the document number only
		return listSearchV4.call(
			this,
			'4.0/purchase/bills',
			(text) => (text.length >= 3 ? { search_term: text } : { document_no: text }),
			filter,
			paginationToken,
		);
	},
	async searchExpenses(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string) {
		return listSearchV4.call(this, '4.0/expenses', (text) => ({ vendor: text }), filter, paginationToken);
	},
	async searchContacts(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string) {
		return listSearchRows.call(
			this,
			{ endpoint: '2.0/contact', fields: ['name_1', 'name_2', 'nr', 'mail'], orderBy: 'name_1', name: contactName },
			filter,
			paginationToken,
		);
	},
	searchInvoices: documentSearch('invoice'),
	searchQuotes: documentSearch('quote'),
	searchOrders: documentSearch('order'),
	async searchArticles(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string) {
		return listSearchRows.call(
			this,
			{
				endpoint: '2.0/article',
				fields: ['intern_name', 'intern_code'],
				orderBy: 'intern_name',
				name: (row) => [row.intern_code, row.intern_name].filter(Boolean).join(' · ') || String(row.id),
			},
			filter,
			paginationToken,
		);
	},
	async searchProjects(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string) {
		return listSearchRows.call(
			this,
			{
				endpoint: '2.0/pr_project',
				fields: ['name'],
				orderBy: 'name',
				name: (row) => [row.nr, row.name].filter(Boolean).join(' · ') || String(row.id),
			},
			filter,
			paginationToken,
		);
	},
};
