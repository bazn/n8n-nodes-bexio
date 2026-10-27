import type {
	IDataObject,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

import { CONTACT_TYPES, DOCUMENT_KINDS, DOCUMENT_TYPES } from '../Bexio/constants';
import { authenticationProperty, bexioCredentials, userField } from '../Bexio/descriptions/shared';
import {
	bexioApiRequest,
	bexioApiRequestAllPages,
	buildSearch,
	equalsCondition,
	parseIdList,
	type SearchCondition,
	statusOf,
} from '../Bexio/GenericFunctions';
import { listSearch, loadOptions } from '../Bexio/methods';

interface PollState {
	/** Highest id seen ("new" events). */
	lastId?: number;
	/** Newest `updated_at` seen ("created or updated" events), as bexio returns it. */
	lastTimestamp?: string;
	/** Ids already emitted at `lastTimestamp`, to avoid duplicates on the `>=` boundary. */
	lastIds?: number[];
	/** Resource and event the state belongs to; switching either restarts from "now". */
	key?: string;
	/** Newest `created_at` seen for supplier bills and expenses (milliseconds). */
	lastCreatedAt?: number;
	/** UUIDs already emitted at `lastCreatedAt`. */
	lastUuids?: string[];
	/** Set once bexio rejected sorting supplier bills by `created_at`; the trigger then scans all bills. */
	billSortUnsupported?: boolean;
}

/** Resources served by the v4 API (UUIDs, `page` paging, no search endpoint). */
const V4_RESOURCES = ['bill', 'expense'];

interface WatchSpec {
	endpoint: string;
	/** Whether the search endpoint accepts `id` as field and `updated_at` as sort key. */
	searchById: boolean;
	sortByUpdatedAt: boolean;
}

const WATCHED: Record<string, WatchSpec> = {
	contact: { endpoint: '2.0/contact', searchById: true, sortByUpdatedAt: true },
	...Object.fromEntries(
		DOCUMENT_KINDS.map((kind) => [
			kind,
			{ endpoint: `2.0/${DOCUMENT_TYPES[kind].path}`, searchById: true, sortByUpdatedAt: true },
		]),
	),
	task: { endpoint: '2.0/task', searchById: false, sortByUpdatedAt: false },
};

const MAX_ITEMS_PER_POLL = 1000;

const documentStatusFilters: INodeProperties[] = DOCUMENT_KINDS.map((kind) => ({
	displayName: 'Status',
	name: 'statuses',
	type: 'multiOptions',
	options: DOCUMENT_TYPES[kind].statuses,
	default: [],
	description: 'Only documents that have one of these statuses now',
	displayOptions: { show: { '/resource': [kind] } },
}));

export class BexioTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bexio Trigger',
		name: 'bexioTrigger',
		icon: { light: 'file:../Bexio/bexio.svg', dark: 'file:../Bexio/bexio.dark.svg' },
		group: ['trigger'],
		version: [1],
		subtitle: '={{$parameter["event"] + ": " + $parameter["resource"]}}',
		description:
			'Starts the workflow when contacts, invoices, quotes, orders, supplier bills, expenses or tasks are created or changed in bexio',
		defaults: {
			name: 'Bexio Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: bexioCredentials,
		properties: [
			authenticationProperty,
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Contact', value: 'contact' },
					{ name: 'Expense', value: 'expense' },
					{ name: 'Invoice', value: 'invoice' },
					{ name: 'Order', value: 'order' },
					{ name: 'Quote', value: 'quote' },
					{ name: 'Supplier Bill', value: 'bill' },
					{ name: 'Task', value: 'task' },
				],
				default: 'invoice',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Created', value: 'created', description: 'A new record was created' },
					{ name: 'Created or Updated', value: 'updated', description: 'A record was created or changed' },
				],
				default: 'created',
				displayOptions: { hide: { resource: ['task', ...V4_RESOURCES] } },
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Created or Updated', value: 'updated', description: 'A task was created or changed' }],
				default: 'updated',
				displayOptions: { show: { resource: ['task'] } },
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Created', value: 'created', description: 'A new record was created' }],
				default: 'created',
				displayOptions: { show: { resource: V4_RESOURCES } },
			},
			{
				displayName: 'Filters',
				name: 'billFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { resource: ['bill'] } },
				options: [
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						options: [
							{ name: 'Draft', value: 'DRAFTS', description: 'Only bills that still need to be booked (approved)' },
							{ name: 'Open', value: 'TODO', description: 'Booked but not fully paid' },
							{ name: 'Overdue', value: 'OVERDUE' },
							{ name: 'Paid', value: 'PAID' },
						],
						default: 'DRAFTS',
						description: 'Only bills that have this status when the trigger checks',
					},
				],
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { hide: { resource: V4_RESOURCES } },
				options: [
					{
						displayName: 'Contact Type',
						name: 'contactTypeId',
						type: 'options',
						options: CONTACT_TYPES,
						default: 1,
						displayOptions: { show: { '/resource': ['contact'] } },
					},
					...documentStatusFilters,
					userField('userId', 'Responsible User', 'Only records of this user'),
				],
			},
		],
	};

	methods = { listSearch, loadOptions };

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const resource = this.getNodeParameter('resource') as string;
		if (V4_RESOURCES.includes(resource)) return pollCreatedV4.call(this, resource);
		const event = this.getNodeParameter('event') as string;
		const spec = WATCHED[resource];
		const byId = event === 'created' && spec.searchById;
		const conditions = filterConditions(this.getNodeParameter('filters', {}) as IDataObject, resource);
		const state = this.getWorkflowStaticData('node') as PollState;
		const key = `${resource}:${event}`;
		const hasPosition = state.key === key && (byId ? state.lastId !== undefined : state.lastTimestamp !== undefined);

		if (this.getMode() === 'manual') {
			// A manual run never moves the stored position: it shows what the active trigger has not
			// delivered yet, or else the newest record as sample.
			if (hasPosition) {
				const pending = byId
					? await fetchNewById.call(this, spec, conditions, state.lastId as number)
					: (await fetchUpdatedSince.call(this, spec, conditions, state)).fresh;
				if (pending.length) return [this.helpers.returnJsonArray(pending)];
			}
			const newest = await fetchNewest.call(this, spec, conditions, byId);
			return newest ? [this.helpers.returnJsonArray([newest])] : null;
		}

		if (!hasPosition) {
			// First activation: start from the newest existing record instead of emitting the whole history.
			const newest = await fetchNewest.call(this, spec, conditions, byId);
			state.key = key;
			if (byId) {
				state.lastId = (newest?.id as number | undefined) ?? 0;
			} else {
				state.lastTimestamp = (newest?.updated_at as string | undefined) ?? '1900-01-01 00:00:00';
				state.lastIds = newest ? [newest.id as number] : [];
			}
			return null;
		}

		if (byId) {
			const rows = await fetchNewById.call(this, spec, conditions, state.lastId as number);
			if (!rows.length) return null;
			state.lastId = Math.max(state.lastId as number, ...rows.map((row) => row.id as number));
			return [this.helpers.returnJsonArray(rows)];
		}

		const { rows, fresh } = await fetchUpdatedSince.call(this, spec, conditions, state);
		if (rows.length) {
			const newest = rows[rows.length - 1].updated_at as string;
			const idsAtNewest = rows.filter((row) => row.updated_at === newest).map((row) => row.id as number);
			state.lastIds = newest === state.lastTimestamp ? [...(state.lastIds ?? []), ...idsAtNewest] : idsAtNewest;
			state.lastTimestamp = newest;
		}
		return fresh.length ? [this.helpers.returnJsonArray(fresh)] : null;
	}
}

export function filterConditions(filters: IDataObject, resource: string): SearchCondition[] {
	const statuses = parseIdList(filters.statuses);
	return [
		...(resource === 'contact' ? equalsCondition('contact_type_id', filters.contactTypeId) : []),
		...((DOCUMENT_KINDS as string[]).includes(resource) && statuses.length
			? [{ field: 'kb_item_status_id', value: statuses, criteria: 'in' }]
			: []),
		...equalsCondition('user_id', filters.userId),
	];
}

/** Orders `updated_at` values; bexio returns `YYYY-MM-DD HH:MM:SS` (or ISO), both sort as text once normalized. */
export function timestampKey(value: unknown): string {
	return String(value ?? '').replace('T', ' ').slice(0, 19);
}

async function search(
	this: IPollFunctions,
	spec: WatchSpec,
	conditions: SearchCondition[],
	qs: IDataObject,
): Promise<IDataObject[]> {
	const body = buildSearch(conditions);
	if (body.length === 0) {
		return (await bexioApiRequest.call(this, 'GET', spec.endpoint, undefined, qs)) as IDataObject[];
	}
	return (await bexioApiRequest.call(this, 'POST', `${spec.endpoint}/search`, body, qs)) as IDataObject[];
}

async function fetchNewest(
	this: IPollFunctions,
	spec: WatchSpec,
	conditions: SearchCondition[],
	byId: boolean,
): Promise<IDataObject | undefined> {
	if (byId || spec.sortByUpdatedAt) {
		const rows = await search.call(this, spec, conditions, {
			order_by: byId ? 'id_desc' : 'updated_at_desc',
			limit: 1,
		});
		return rows[0];
	}
	// tasks cannot be sorted by updated_at: take the newest change of the most recent tasks
	const rows = await search.call(this, spec, conditions, { order_by: 'id_desc', limit: MAX_ITEMS_PER_POLL });
	return rows.sort((left, right) => timestampKey(right.updated_at).localeCompare(timestampKey(left.updated_at)))[0];
}

async function fetchNewById(
	this: IPollFunctions,
	spec: WatchSpec,
	conditions: SearchCondition[],
	lastId: number,
): Promise<IDataObject[]> {
	return search.call(this, spec, [...conditions, { field: 'id', value: String(lastId), criteria: '>' }], {
		order_by: 'id_asc',
		limit: MAX_ITEMS_PER_POLL,
	});
}

/** Rows changed at or after the stored timestamp; `fresh` excludes the ones already emitted at that exact time. */
async function fetchUpdatedSince(
	this: IPollFunctions,
	spec: WatchSpec,
	conditions: SearchCondition[],
	state: PollState,
): Promise<{ rows: IDataObject[]; fresh: IDataObject[] }> {
	const rows = await search.call(
		this,
		spec,
		[...conditions, { field: 'updated_at', value: state.lastTimestamp as string, criteria: '>=' }],
		{ order_by: spec.sortByUpdatedAt ? 'updated_at_asc' : 'id_asc', limit: MAX_ITEMS_PER_POLL },
	);
	rows.sort((left, right) => timestampKey(left.updated_at).localeCompare(timestampKey(right.updated_at)));
	const seen = new Set(state.lastIds ?? []);
	const fresh = rows.filter((row) => !(row.updated_at === state.lastTimestamp && seen.has(row.id as number)));
	return { rows, fresh };
}

// ---------------------------------------------------------------- Supplier bills and expenses (v4)

/** `created_at` as milliseconds; bexio may answer offsets without colon (`+0000`). */
export function createdAtMs(value: unknown): number {
	const text = String(value ?? '').trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
	const ms = Date.parse(text);
	return Number.isNaN(ms) ? 0 : ms;
}

/** Date-time in the format of the v4 filters (`2020-01-24T13:08:01+0000`). */
export function v4DateTime(ms: number): string {
	return new Date(ms).toISOString().replace(/\.\d{3}Z$/, '+0000');
}

/** Rows created at or after `sinceMs`, oldest first. */
async function fetchCreatedSince(this: IPollFunctions, resource: string, sinceMs: number): Promise<IDataObject[]> {
	let rows: IDataObject[];
	if (resource === 'expense') {
		rows = await bexioApiRequestAllPages.call(this, '4.0/expenses', { created_at_start: v4DateTime(sinceMs) }, MAX_ITEMS_PER_POLL);
	} else {
		rows = await fetchBillsSince.call(this, sinceMs);
	}
	return rows
		.filter((row) => createdAtMs(row.created_at) >= sinceMs)
		.sort((left, right) => createdAtMs(left.created_at) - createdAtMs(right.created_at));
}

/**
 * Supplier bills have no `created_at` filter. They are read newest first until an older one appears;
 * if bexio rejects that sort key, every bill is read once per poll and filtered locally.
 */
async function fetchBillsSince(this: IPollFunctions, sinceMs: number): Promise<IDataObject[]> {
	const state = this.getWorkflowStaticData('node') as PollState;
	const filters = this.getNodeParameter('billFilters', {}) as IDataObject;
	const qs: IDataObject = filters.status ? { status: filters.status } : {};

	if (!state.billSortUnsupported) {
		const rows: IDataObject[] = [];
		try {
			for (let page = 1; rows.length < MAX_ITEMS_PER_POLL; page++) {
				const response = (await bexioApiRequest.call(this, 'GET', '4.0/purchase/bills', undefined, {
					...qs,
					sort: 'created_at',
					order: 'desc',
					limit: 100,
					page,
				})) as { data?: IDataObject[]; paging?: { page_count?: number } };
				const data = response.data ?? [];
				rows.push(...data);
				const reachedKnown = data.some((row) => createdAtMs(row.created_at) < sinceMs);
				if (reachedKnown || data.length === 0 || page >= (response.paging?.page_count ?? page)) break;
			}
			return rows;
		} catch (error) {
			const status = statusOf(error);
			if (status !== 400 && status !== 422) {
				const apiError = error as NodeApiError;
				throw new NodeApiError(this.getNode(), apiError.errorResponse ?? (error as JsonObject), {
					message: apiError.message,
					description: apiError.description ?? undefined,
					httpCode: apiError.httpCode ?? undefined,
				});
			}
			state.billSortUnsupported = true;
		}
	}
	return bexioApiRequestAllPages.call(this, '4.0/purchase/bills', qs, 10 * MAX_ITEMS_PER_POLL);
}

/** Supplier bills and expenses are identified by UUIDs, so "new" is decided by `created_at`. */
async function pollCreatedV4(this: IPollFunctions, resource: string): Promise<INodeExecutionData[][] | null> {
	const state = this.getWorkflowStaticData('node') as PollState;
	const key = `${resource}:created`;
	const hasPosition = state.key === key && state.lastCreatedAt !== undefined;
	const fresh = (rows: IDataObject[]) => {
		const seen = new Set(state.lastUuids ?? []);
		return rows.filter(
			(row) => !(createdAtMs(row.created_at) === state.lastCreatedAt && seen.has(String(row.id))),
		);
	};

	if (this.getMode() === 'manual') {
		// Never moves the position: shows what the active trigger has not delivered yet, else the newest record.
		if (hasPosition) {
			const pending = fresh(await fetchCreatedSince.call(this, resource, state.lastCreatedAt as number));
			if (pending.length) return [this.helpers.returnJsonArray(pending)];
		}
		const recent = await fetchCreatedSince.call(this, resource, Date.now() - 30 * 24 * 3600_000);
		return recent.length ? [this.helpers.returnJsonArray([recent[recent.length - 1]])] : null;
	}

	if (!hasPosition) {
		// First activation: start now instead of emitting the history.
		state.key = key;
		state.lastCreatedAt = Date.now();
		state.lastUuids = [];
		return null;
	}

	const rows = await fetchCreatedSince.call(this, resource, state.lastCreatedAt as number);
	const result = fresh(rows);
	if (rows.length) {
		const newest = createdAtMs(rows[rows.length - 1].created_at);
		const idsAtNewest = rows.filter((row) => createdAtMs(row.created_at) === newest).map((row) => String(row.id));
		state.lastUuids = newest === state.lastCreatedAt ? [...(state.lastUuids ?? []), ...idsAtNewest] : idsAtNewest;
		state.lastCreatedAt = newest;
	}
	return result.length ? [this.helpers.returnJsonArray(result)] : null;
}
