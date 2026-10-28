import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeParameterResourceLocator,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

export type BexioContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

export const BASE_URL = 'https://api.bexio.com';

/** bexio enforces a maximum of 2000 rows per page (default 500). */
export const MAX_PAGE_SIZE = 2000;

export const TOKEN_CREDENTIAL = 'bexioApi';
export const OAUTH2_CREDENTIAL = 'bexioOAuth2Api';

/** Credential type chosen in the node's "Authentication" parameter (access token unless OAuth2 is selected). */
export function bexioCredentialType(context: BexioContext): string {
	let authentication: unknown;
	try {
		authentication =
			'getInputData' in context
				? (context as IExecuteFunctions).getNodeParameter('authentication', 0, 'accessToken')
				: (context as ILoadOptionsFunctions | IPollFunctions).getNodeParameter('authentication', 'accessToken');
	} catch {
		authentication = 'accessToken';
	}
	return authentication === 'oAuth2' ? OAUTH2_CREDENTIAL : TOKEN_CREDENTIAL;
}

/** bexio answers 429 when the per-minute limit of the company is reached. */
const RATE_LIMIT_STATUS = 429;
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RATE_LIMIT_WAIT_MS = 60_000;

interface ErrorLike {
	httpCode?: string;
	response?: { status?: number; headers?: IDataObject; body?: unknown; data?: unknown };
	cause?: { response?: { status?: number; headers?: IDataObject; data?: unknown } };
}

export function statusOf(error: unknown): number | undefined {
	const candidate = error as ErrorLike;
	const status = candidate.httpCode ?? candidate.response?.status ?? candidate.cause?.response?.status;
	return status === undefined ? undefined : Number(status);
}

/** Wait time before retrying a rate-limited request, from the `RateLimit-Reset` header (seconds). */
export function rateLimitWaitMs(error: unknown, attempt: number): number {
	const candidate = error as ErrorLike;
	const headers = candidate.response?.headers ?? candidate.cause?.response?.headers ?? {};
	const reset = Number(headers['ratelimit-reset'] ?? headers['RateLimit-Reset']);
	const ms = Number.isFinite(reset) && reset > 0 ? reset * 1000 : 2 ** attempt * 1000;
	return Math.min(ms, MAX_RATE_LIMIT_WAIT_MS);
}

/** Builds a readable message from bexio's error body `{ error_code, message, errors }`. */
export function extractBexioMessage(error: unknown): string | undefined {
	const candidate = error as ErrorLike;
	const body = candidate.response?.body ?? candidate.response?.data ?? candidate.cause?.response?.data;
	if (!body || typeof body !== 'object') return undefined;
	const { message, errors } = body as { message?: unknown; errors?: unknown };
	if (message === undefined) return undefined;
	const details = Array.isArray(errors)
		? errors.map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
		: errors && typeof errors === 'object'
			? Object.entries(errors as IDataObject).map(([field, value]) => `${field}: ${JSON.stringify(value)}`)
			: [];
	return details.length ? `${String(message)} (${details.join('; ')})` : String(message);
}

/**
 * Request with the bexio credential. `endpoint` may be absolute or relative to https://api.bexio.com
 * and includes the API version (e.g. `2.0/contact`). Rate-limited requests are retried.
 */
export async function bexioApiRequest(
	this: BexioContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject | IDataObject[],
	qs: IDataObject = {},
	extra: Partial<IHttpRequestOptions> = {},
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method,
		url: /^https?:\/\//i.test(endpoint) ? endpoint : `${BASE_URL}/${endpoint.replace(/^\/+/, '')}`,
		qs,
		json: true,
		headers: { Accept: 'application/json' },
		...extra,
	};
	if (body !== undefined) {
		options.body = body;
	}

	const credentialType = bexioCredentialType(this);
	for (let attempt = 0; ; attempt++) {
		try {
			return await this.helpers.httpRequestWithAuthentication.call(this, credentialType, options);
		} catch (error) {
			if (statusOf(error) === RATE_LIMIT_STATUS && attempt < MAX_RATE_LIMIT_RETRIES) {
				await sleep(rateLimitWaitMs(error, attempt));
				continue;
			}
			throw new NodeApiError(this.getNode(), error as JsonObject, { message: extractBexioMessage(error) });
		}
	}
}

/**
 * Pages through a v2/v3 list or search endpoint with `limit`/`offset`.
 * Pass `limit` to stop after that many rows, or omit it to fetch every page.
 */
export async function bexioApiRequestAllItems(
	this: BexioContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject | IDataObject[],
	qs: IDataObject = {},
	limit?: number,
): Promise<IDataObject[]> {
	const pageSize = limit ? Math.min(limit, MAX_PAGE_SIZE) : MAX_PAGE_SIZE;
	const results: IDataObject[] = [];
	for (let offset = 0; ; offset += pageSize) {
		const rows = (await bexioApiRequest.call(this, method, endpoint, body, {
			...qs,
			limit: pageSize,
			offset,
		})) as IDataObject[];
		results.push(...rows);
		if (rows.length < pageSize || (limit !== undefined && results.length >= limit)) break;
	}
	return limit !== undefined ? results.slice(0, limit) : results;
}

/** v4 endpoints (purchase, expenses) allow at most 500 rows per page. */
export const MAX_V4_PAGE_SIZE = 500;

/**
 * Pages through a v4 list endpoint, which uses 1-based `page`/`limit` and answers `{ data, paging }`.
 * Pass `limit` to stop after that many rows, or omit it to fetch every page.
 */
export async function bexioApiRequestAllPages(
	this: BexioContext,
	endpoint: string,
	qs: IDataObject = {},
	limit?: number,
): Promise<IDataObject[]> {
	const pageSize = limit ? Math.min(limit, MAX_V4_PAGE_SIZE) : MAX_V4_PAGE_SIZE;
	const results: IDataObject[] = [];
	for (let page = 1; ; page++) {
		const response = (await bexioApiRequest.call(this, 'GET', endpoint, undefined, {
			...qs,
			limit: pageSize,
			page,
		})) as { data?: IDataObject[]; paging?: { page_count?: number } };
		const rows = response.data ?? [];
		results.push(...rows);
		const pageCount = response.paging?.page_count ?? page;
		if (rows.length === 0 || page >= pageCount || (limit !== undefined && results.length >= limit)) break;
	}
	return limit !== undefined ? results.slice(0, limit) : results;
}

/** Copies only the given keys (that are set) from a record, e.g. to build a v4 PUT body from a GET response. */
export function pickKeys(record: IDataObject, keys: string[]): IDataObject {
	return Object.fromEntries(keys.filter((key) => record[key] !== undefined && record[key] !== null).map((key) => [key, record[key]]));
}

export interface SearchCondition {
	field: string;
	value: unknown;
	criteria?: string;
}

/** Criteria whose value is an array, and criteria that take no value at all. */
const LIST_CRITERIA = new Set(['in', 'not_in']);
const VALUELESS_CRITERIA = new Set(['is_null', 'not_null']);

/** Normalizes search conditions for the `…/search` endpoints; empty values are dropped. */
export function buildSearch(conditions: SearchCondition[]): IDataObject[] {
	return conditions
		.filter((condition) => condition.field && condition.field.trim() !== '')
		.filter(
			(condition) =>
				VALUELESS_CRITERIA.has(condition.criteria ?? '') ||
				(condition.value !== undefined && condition.value !== null && condition.value !== ''),
		)
		.map((condition) => {
			const criteria = condition.criteria || 'like';
			let value: unknown = condition.value;
			if (LIST_CRITERIA.has(criteria)) {
				value = parseIdList(value);
			} else if (VALUELESS_CRITERIA.has(criteria)) {
				value = '';
			} else if (typeof value !== 'string') {
				value = String(value);
			}
			return { field: condition.field.trim(), value, criteria } as IDataObject;
		});
}

/** Lists rows, using the search endpoint when there are conditions and the plain list endpoint otherwise. */
export async function listOrSearch(
	this: BexioContext,
	endpoint: string,
	conditions: SearchCondition[],
	qs: IDataObject = {},
	limit?: number,
): Promise<IDataObject[]> {
	const search = buildSearch(conditions);
	if (search.length === 0) {
		return bexioApiRequestAllItems.call(this, 'GET', endpoint, undefined, qs, limit);
	}
	return bexioApiRequestAllItems.call(this, 'POST', `${endpoint}/search`, search, qs, limit);
}

/** `phoneFixedSecond` → `phone_fixed_second`, `name1` → `name_1`. */
export function snakeCase(key: string): string {
	return key
		.replace(/([A-Z])/g, '_$1')
		.replace(/(\d+)/g, '_$1')
		.replace(/^_/, '')
		.toLowerCase();
}

/**
 * Converts node parameters to a bexio body: keys become snake_case, empty strings are dropped,
 * resource locators are resolved and dates are formatted.
 */
export function toBexioBody(fields: IDataObject, dateFields: string[] = []): IDataObject {
	const body: IDataObject = {};
	for (const [key, raw] of Object.entries(fields)) {
		let value: unknown = raw;
		if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in (value as IDataObject)) {
			value = resolveLocatorValue(value);
		}
		if (value === undefined || value === null || value === '') continue;
		if (dateFields.includes(key)) value = toBexioDate(value);
		body[snakeCase(key)] = value as IDataObject[keyof IDataObject];
	}
	return body;
}

/** `2026-11-03T14:30:00+01:00` → `2026-11-03`. */
export function toBexioDate(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	return String(value).slice(0, 10);
}

/**
 * bexio stores timestamps as Swiss wall-clock time (`YYYY-MM-DD HH:MM:SS`). Values with an offset are
 * converted to the given time zone; values without one are taken as they are.
 */
export function toBexioDateTime(value: unknown, timeZone: string): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const text = String(value).trim();
	if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) return text.replace('T', ' ').slice(0, 19);
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) return text;
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23',
		})
			.formatToParts(date)
			.map((part) => [part.type, part.value]),
	);
	return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Reads a value that may be a plain string or a resource locator (e.g. inside a collection). */
export function resolveLocatorValue(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value === 'object' && 'value' in (value as IDataObject)) {
		const inner = (value as INodeParameterResourceLocator).value;
		return inner === undefined || inner === null || inner === '' ? undefined : String(inner);
	}
	return value === '' ? undefined : String(value);
}

/** Reads a resource locator parameter and returns its numeric bexio id. */
export function getId(this: IExecuteFunctions, parameterName: string, itemIndex: number, label = 'record'): number {
	const value = String(this.getNodeParameter(parameterName, itemIndex, '', { extractValue: true }) ?? '').trim();
	if (!/^\d+$/.test(value)) {
		throw new NodeOperationError(this.getNode(), `"${value}" is not a valid ${label} ID`, {
			itemIndex,
			description: 'bexio IDs are positive whole numbers',
		});
	}
	return Number(value);
}

export function parseIdList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String).filter((id) => id.trim() !== '');
	if (typeof value !== 'string' && typeof value !== 'number') return [];
	return String(value)
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id !== '');
}

export function parseJsonParameter(
	this: IExecuteFunctions,
	value: unknown,
	parameterName: string,
	itemIndex: number,
): IDataObject {
	if (value === undefined || value === null || value === '') return {};
	if (typeof value === 'object' && !Array.isArray(value)) return value as IDataObject;
	try {
		const parsed = JSON.parse(String(value)) as unknown;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as IDataObject;
	} catch {
		// handled below
	}
	throw new NodeOperationError(this.getNode(), `"${parameterName}" must be a JSON object`, { itemIndex });
}

export function parseJsonArrayParameter(
	this: IExecuteFunctions,
	value: unknown,
	parameterName: string,
	itemIndex: number,
): IDataObject[] {
	if (value === undefined || value === null || value === '') return [];
	if (Array.isArray(value)) return value as IDataObject[];
	try {
		const parsed = JSON.parse(String(value)) as unknown;
		if (Array.isArray(parsed)) return parsed as IDataObject[];
	} catch {
		// handled below
	}
	throw new NodeOperationError(this.getNode(), `"${parameterName}" must be a JSON array`, { itemIndex });
}

/** Returns the id of the user the credential belongs to (`/3.0/users/me`). */
export async function getCurrentUserId(this: BexioContext): Promise<number> {
	const me = (await bexioApiRequest.call(this, 'GET', '3.0/users/me')) as { id: number };
	return me.id;
}

/** Uses the given user id, or the signed-in user when none is set. */
export async function userIdOrMe(this: BexioContext, value: unknown): Promise<number> {
	const id = resolveLocatorValue(value);
	return id ? Number(id) : getCurrentUserId.call(this);
}

/**
 * Turns a "Additional Fields" / "Update Fields" collection into a request body. Multi-value fields are
 * joined with commas (as bexio expects for e.g. `contact_group_ids`); raw JSON fields win.
 */
export function buildBody(
	this: IExecuteFunctions,
	fields: IDataObject,
	itemIndex: number,
	dateFields: string[] = [],
): IDataObject {
	const { additionalJson, ...rest } = fields;
	const prepared: IDataObject = {};
	for (const [key, value] of Object.entries(rest)) {
		prepared[key] = Array.isArray(value) ? (value.length ? value.join(',') : undefined) : value;
	}
	return {
		...toBexioBody(prepared, dateFields),
		...parseJsonParameter.call(this, additionalJson, 'Additional Fields (JSON)', itemIndex),
	};
}

/**
 * bexio's v2 edit endpoints (POST `…/{id}`) reject bodies that lack the resource's required fields,
 * even for partial updates. The current values of those fields are read first and sent along.
 */
export async function editWithRequired(
	this: IExecuteFunctions,
	endpoint: string,
	updates: IDataObject,
	required: string[],
): Promise<IDataObject> {
	const missing = required.filter((key) => updates[key] === undefined);
	let body = updates;
	if (missing.length) {
		const current = (await bexioApiRequest.call(this, 'GET', endpoint)) as IDataObject;
		body = { ...Object.fromEntries(missing.map((key) => [key, current[key]])), ...updates };
	}
	return (await bexioApiRequest.call(this, 'POST', endpoint, body)) as IDataObject;
}

/** Search condition for a text filter (contains), or nothing when the filter is empty. */
export function likeCondition(field: string, value: unknown): SearchCondition[] {
	return value === undefined || value === null || value === '' ? [] : [{ field, value, criteria: 'like' }];
}

/** Search condition for an exact filter (also resolves resource locators), or nothing when empty. */
export function equalsCondition(field: string, value: unknown): SearchCondition[] {
	const resolved = resolveLocatorValue(value);
	return resolved === undefined ? [] : [{ field, value: resolved, criteria: '=' }];
}

/** Reads the "Search Conditions" fixed collection. */
export function searchConditions(this: IExecuteFunctions, itemIndex: number): SearchCondition[] {
	const raw = this.getNodeParameter('searchConditions', itemIndex, {}) as { condition?: SearchCondition[] };
	const conditions = raw.condition ?? [];
	if (conditions.some((condition) => !condition.field)) {
		throw new NodeOperationError(this.getNode(), 'Choose a field for every search condition', { itemIndex });
	}
	return conditions;
}

/** Returns the limit for Get Many operations, or undefined when all results are requested. */
export function limitFor(this: IExecuteFunctions, itemIndex: number): number | undefined {
	return this.getNodeParameter('returnAll', itemIndex) ? undefined : (this.getNodeParameter('limit', itemIndex) as number);
}
