// Unit tests for pure helpers. Run with `npm test` (builds first, then uses node:test against dist/).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const dist = path.join(__dirname, '..', '..', 'dist', 'nodes');
const g = require(path.join(dist, 'Bexio', 'GenericFunctions.js'));
const { toBexioPosition } = require(path.join(dist, 'Bexio', 'actions', 'document.js'));
const { buildTracking } = require(path.join(dist, 'Bexio', 'actions', 'project.js'));
const { filterConditions, timestampKey } = require(path.join(dist, 'BexioTrigger', 'BexioTrigger.node.js'));
const { Bexio } = require(path.join(dist, 'Bexio', 'Bexio.node.js'));
const { BexioTrigger } = require(path.join(dist, 'BexioTrigger', 'BexioTrigger.node.js'));

test('snakeCase converts parameter names to bexio attribute names', () => {
	assert.equal(g.snakeCase('phoneFixedSecond'), 'phone_fixed_second');
	assert.equal(g.snakeCase('name1'), 'name_1');
	assert.equal(g.snakeCase('prProjectId'), 'pr_project_id');
	assert.equal(g.snakeCase('mail'), 'mail');
});

test('toBexioBody drops empty values, resolves locators and formats dates', () => {
	assert.deepEqual(
		g.toBexioBody(
			{
				name1: 'Muster AG',
				name2: '',
				contactSubId: { __rl: true, mode: 'list', value: '42' },
				birthday: '1990-05-17T00:00:00.000+02:00',
				remarks: undefined,
			},
			['birthday'],
		),
		{ name_1: 'Muster AG', contact_sub_id: '42', birthday: '1990-05-17' },
	);
});

test('buildSearch normalizes conditions and drops empty ones', () => {
	assert.deepEqual(
		g.buildSearch([
			{ field: 'name_1', value: 'Meyer' },
			{ field: 'nr', value: 10, criteria: '>' },
			{ field: 'kb_item_status_id', value: '7, 8', criteria: 'in' },
			{ field: 'mail', value: '', criteria: 'like' },
			{ field: 'city', value: undefined, criteria: 'is_null' },
			{ field: ' ', value: 'x' },
		]),
		[
			{ field: 'name_1', value: 'Meyer', criteria: 'like' },
			{ field: 'nr', value: '10', criteria: '>' },
			{ field: 'kb_item_status_id', value: ['7', '8'], criteria: 'in' },
			{ field: 'city', value: '', criteria: 'is_null' },
		],
	);
});

test('equalsCondition and likeCondition skip empty filters', () => {
	assert.deepEqual(g.equalsCondition('contact_id', { __rl: true, mode: 'list', value: '' }), []);
	assert.deepEqual(g.equalsCondition('contact_id', { __rl: true, mode: 'id', value: '5' }), [
		{ field: 'contact_id', value: '5', criteria: '=' },
	]);
	assert.deepEqual(g.likeCondition('title', ''), []);
	assert.deepEqual(g.likeCondition('title', 'Web'), [{ field: 'title', value: 'Web', criteria: 'like' }]);
});

test('toBexioDateTime passes wall-clock values and converts offsets to the time zone', () => {
	assert.equal(g.toBexioDateTime('2026-11-03T14:30:00', 'Europe/Zurich'), '2026-11-03 14:30:00');
	assert.equal(g.toBexioDateTime('2026-11-03T13:30:00Z', 'Europe/Zurich'), '2026-11-03 14:30:00');
	assert.equal(g.toBexioDateTime('2026-07-01T12:00:00Z', 'Europe/Zurich'), '2026-07-01 14:00:00');
	assert.equal(g.toBexioDateTime('2026-11-03T14:30:00.000+01:00', 'Europe/Zurich'), '2026-11-03 14:30:00');
	assert.equal(g.toBexioDateTime('', 'Europe/Zurich'), undefined);
	assert.equal(g.toBexioDate('2026-11-03T14:30:00+01:00'), '2026-11-03');
});

test('extractBexioMessage reads message and validation errors', () => {
	assert.equal(
		g.extractBexioMessage({ response: { body: { error_code: 422, message: 'Invalid', errors: ['name_1 missing'] } } }),
		'Invalid (name_1 missing)',
	);
	assert.equal(
		g.extractBexioMessage({ cause: { response: { data: { message: 'Not found' } } } }),
		'Not found',
	);
	assert.equal(g.extractBexioMessage({ response: { body: 'oops' } }), undefined);
});

test('rate limit wait uses RateLimit-Reset and is capped', () => {
	assert.equal(g.rateLimitWaitMs({ response: { headers: { 'ratelimit-reset': '3' } } }, 0), 3000);
	assert.equal(g.rateLimitWaitMs({ response: { headers: {} } }, 2), 4000);
	assert.equal(g.rateLimitWaitMs({ response: { headers: { 'ratelimit-reset': '600' } } }, 0), 60000);
	assert.equal(g.statusOf({ httpCode: '429' }), 429);
});

test('resolveLocatorValue and parseIdList', () => {
	assert.equal(g.resolveLocatorValue({ __rl: true, mode: 'list', value: 'abc' }), 'abc');
	assert.equal(g.resolveLocatorValue({ __rl: true, mode: 'list', value: '' }), undefined);
	assert.equal(g.resolveLocatorValue('xyz'), 'xyz');
	assert.deepEqual(g.parseIdList(' 1, 2 ,,3 '), ['1', '2', '3']);
	assert.deepEqual(g.parseIdList([7, 8]), ['7', '8']);
});

test('toBexioPosition keeps only the fields of the position type', () => {
	assert.deepEqual(
		toBexioPosition({
			type: 'KbPositionCustom',
			text: 'Consulting',
			amount: 2,
			unitPrice: 150,
			taxId: 16,
			unitId: '',
			discountInPercent: 0,
			value: 5,
			showPosNr: true,
		}),
		{ type: 'KbPositionCustom', text: 'Consulting', amount: '2', unit_price: '150', tax_id: 16 },
	);
	assert.deepEqual(toBexioPosition({ type: 'KbPositionDiscount', text: 'Rabatt', value: 10, isPercentual: true, amount: 1 }), {
		type: 'KbPositionDiscount',
		text: 'Rabatt',
		value: '10',
		is_percentual: true,
	});
	assert.deepEqual(toBexioPosition({ type: 'KbPositionPagebreak', text: 'x' }), {
		type: 'KbPositionPagebreak',
		pagebreak: true,
	});
});

test('buildTracking accepts HH:MM, H:MM and minutes', () => {
	assert.deepEqual(buildTracking('duration', { date: '2026-11-03T00:00:00', duration: '1:30' }, 'Europe/Zurich'), {
		type: 'duration',
		date: '2026-11-03',
		duration: '01:30',
	});
	assert.equal(buildTracking('duration', { date: '2026-11-03', duration: '95' }, 'Europe/Zurich').duration, '01:35');
	assert.deepEqual(
		buildTracking('range', { start: '2026-11-03T08:00:00Z', end: '2026-11-03T09:15:00Z' }, 'Europe/Zurich'),
		{ type: 'range', start: '2026-11-03 09:00:00', end: '2026-11-03 10:15:00' },
	);
});

test('trigger filters and timestamps', () => {
	assert.deepEqual(filterConditions({ statuses: [8, 31], userId: '' }, 'invoice'), [
		{ field: 'kb_item_status_id', value: ['8', '31'], criteria: 'in' },
	]);
	assert.deepEqual(filterConditions({ contactTypeId: 2, statuses: [8] }, 'contact'), [
		{ field: 'contact_type_id', value: '2', criteria: '=' },
	]);
	assert.equal(timestampKey('2026-11-03T14:30:00+01:00'), '2026-11-03 14:30:00');
	assert.equal(timestampKey('2026-11-03 14:30:00'), '2026-11-03 14:30:00');
});

/** Collects every loadOptionsMethod / searchListMethod referenced in a node description. */
function referencedMethods(properties, found = { loadOptions: new Set(), listSearch: new Set() }) {
	for (const property of properties) {
		if (property.typeOptions?.loadOptionsMethod) found.loadOptions.add(property.typeOptions.loadOptionsMethod);
		for (const mode of property.modes ?? []) {
			if (mode.typeOptions?.searchListMethod) found.listSearch.add(mode.typeOptions.searchListMethod);
		}
		for (const option of property.options ?? []) {
			if (option.values) referencedMethods(option.values, found);
			else if (option.displayName) referencedMethods([option], found);
		}
	}
	return found;
}

for (const NodeClass of [Bexio, BexioTrigger]) {
	test(`${NodeClass.name}: every referenced method exists`, () => {
		const node = new NodeClass();
		const { loadOptions, listSearch } = referencedMethods(node.description.properties);
		for (const name of loadOptions) assert.equal(typeof node.methods.loadOptions[name], 'function', name);
		for (const name of listSearch) assert.equal(typeof node.methods.listSearch[name], 'function', name);
	});
}

test('every resource of the node has operations', () => {
	const { properties } = new Bexio().description;
	const resources = properties.find((property) => property.name === 'resource').options.map((option) => option.value);
	for (const resource of resources) {
		const operations = properties.filter(
			(property) => property.name === 'operation' && property.displayOptions?.show?.resource?.includes(resource),
		);
		assert.equal(operations.length, 1, resource);
		const values = operations[0].options.map((option) => option.value);
		assert.equal(new Set(values).size, values.length, `duplicate operation in ${resource}`);
	}
});

const purchase = require(path.join(dist, 'Bexio', 'actions', 'purchase.js'));

test('billToUpdateBody keeps only writable attributes of a bill', () => {
	const body = purchase.billToUpdateBody({
		id: 'b1',
		status: 'DRAFT',
		document_no: 'LR-1',
		supplier_id: 5,
		pending_amount: 100,
		overdue: false,
		payment: null,
		address: { lastname_company: 'Muster AG', type: 'COMPANY' },
		line_items: [{ id: 'l1', position: 0, amount: 100, tax_id: 3, tax_calc: 7.7, booking_account_id: 4200 }],
		discounts: [{ id: 'd1', position: 0, amount: 5 }],
	});
	assert.deepEqual(body, {
		document_no: 'LR-1',
		supplier_id: 5,
		address: { lastname_company: 'Muster AG', type: 'COMPANY' },
		line_items: [{ id: 'l1', position: 0, amount: 100, tax_id: 3, booking_account_id: 4200 }],
		discounts: [{ id: 'd1', position: 0, amount: 5 }],
		attachment_ids: [],
	});
});

test('expenseToUpdateBody drops calculated and linked fields', () => {
	assert.deepEqual(
		purchase.expenseToUpdateBody({
			id: 'e1',
			status: 'DRAFT',
			paid_on: '2026-10-01',
			amount: 42.5,
			currency_code: 'CHF',
			tax_calc: 3.1,
			invoice_id: 'x',
			attachment_ids: ['f1'],
		}),
		{ paid_on: '2026-10-01', amount: 42.5, currency_code: 'CHF', attachment_ids: ['f1'] },
	);
});

test('v4Fields maps names, dates, ids and keeps numbers', () => {
	assert.deepEqual(
		purchase.v4Fields(
			{
				paidOn: '2026-10-01T00:00:00.000+02:00',
				amount: 12.5,
				supplierId: { __rl: true, mode: 'list', value: '7' },
				bookingAccountId: '4200',
				title: '',
				additionalJson: '{}',
			},
			['paidOn'],
		),
		{ paid_on: '2026-10-01', amount: 12.5, supplier_id: 7, booking_account_id: 4200 },
	);
});

test('v4Query drops empty filters and formats dates', () => {
	assert.deepEqual(
		purchase.v4Query(
			{ billDateStart: '2026-10-01T00:00:00', grossMin: 0, status: 'DRAFTS', supplierId: { __rl: true, mode: 'id', value: '9' } },
			['billDateStart'],
		),
		{ bill_date_start: '2026-10-01', status: 'DRAFTS', supplier_id: '9' },
	);
	assert.deepEqual(purchase.v4Query({ createdAtStart: '2026-10-01T12:00:00Z' }, [], ['createdAtStart']), {
		created_at_start: '2026-10-01T12:00:00+0000',
	});
});

/** Minimal execution context that answers requests from a list of canned responses. */
function fakeContext(responses) {
	const requests = [];
	return {
		requests,
		getNode: () => ({ name: 'Bexio' }),
		getInputData: () => [{ json: {} }],
		getNodeParameter: (_name, _index, fallback) => fallback,
		helpers: {
			httpRequestWithAuthentication: async (_credential, options) => {
				requests.push(options);
				return responses.shift();
			},
		},
	};
}

test('bexioApiRequestAllPages follows page_count and honours the limit', async () => {
	const all = fakeContext([
		{ data: [{ id: 'a' }, { id: 'b' }], paging: { page: 1, page_count: 2 } },
		{ data: [{ id: 'c' }], paging: { page: 2, page_count: 2 } },
	]);
	const rows = await g.bexioApiRequestAllPages.call(all, '4.0/expenses', { title: 'x' });
	assert.deepEqual(rows.map((row) => row.id), ['a', 'b', 'c']);
	assert.deepEqual(all.requests.map((request) => request.qs.page), [1, 2]);
	assert.equal(all.requests[0].qs.limit, 500);
	assert.equal(all.requests[0].url, 'https://api.bexio.com/4.0/expenses');

	const limited = fakeContext([{ data: [{ id: 'a' }, { id: 'b' }], paging: { page: 1, page_count: 5 } }]);
	const firstTwo = await g.bexioApiRequestAllPages.call(limited, '4.0/purchase/bills', {}, 2);
	assert.deepEqual(firstTwo.map((row) => row.id), ['a', 'b']);
	assert.equal(limited.requests.length, 1);
});

test('bexioApiRequestAllItems pages v2 lists by offset', async () => {
	const fullPage = Array.from({ length: 2000 }, (_, index) => ({ id: index + 1 }));
	const context = fakeContext([fullPage, [{ id: 2001 }]]);
	const rows = await g.bexioApiRequestAllItems.call(context, 'GET', '2.0/contact');
	assert.equal(rows.length, 2001);
	assert.deepEqual(context.requests.map((request) => [request.qs.limit, request.qs.offset]), [
		[2000, 0],
		[2000, 2000],
	]);

	// a page shorter than the page size is the last one
	const short = fakeContext([[{ id: 1 }, { id: 2 }]]);
	assert.equal((await g.bexioApiRequestAllItems.call(short, 'GET', '2.0/contact', undefined, {}, 3)).length, 2);
	assert.equal(short.requests.length, 1);
});

const trigger = require(path.join(dist, 'BexioTrigger', 'BexioTrigger.node.js'));

test('created_at parsing and v4 date-time format', () => {
	assert.equal(trigger.createdAtMs('2026-10-27T08:00:00+0000'), Date.UTC(2026, 9, 27, 8));
	assert.equal(trigger.createdAtMs('2026-10-27T09:00:00+01:00'), Date.UTC(2026, 9, 27, 8));
	assert.equal(trigger.createdAtMs(undefined), 0);
	assert.equal(trigger.v4DateTime(Date.UTC(2026, 9, 27, 8)), '2026-10-27T08:00:00+0000');
});

/** Poll context with static data, parameters and a request handler `respond(options)`. */
function pollContext(parameters, respond, mode = 'trigger') {
	const staticData = {};
	const requests = [];
	return {
		staticData,
		requests,
		getNode: () => ({ name: 'Bexio Trigger', type: 'bexioTrigger', typeVersion: 1, parameters: {} }),
		getMode: () => mode,
		getWorkflowStaticData: () => staticData,
		getNodeParameter: (name, fallback) => (name in parameters ? parameters[name] : fallback),
		helpers: {
			returnJsonArray: (rows) => rows.map((json) => ({ json })),
			httpRequestWithAuthentication: async (_credential, options) => {
				requests.push(options);
				return respond(options);
			},
		},
	};
}

const at = (iso) => `${iso}+0000`;

test('expense trigger starts at activation, then emits new expenses once', async () => {
	let data = [];
	const context = pollContext({ resource: 'expense' }, () => ({ data, paging: { page: 1, page_count: 1 } }));
	const node = new trigger.BexioTrigger();

	assert.equal(await node.poll.call(context), null);
	const start = context.staticData.lastCreatedAt;
	assert.equal(context.requests.length, 0);

	const t1 = new Date(start + 60_000).toISOString().slice(0, 19);
	data = [
		{ id: 'e2', created_at: at(t1) },
		{ id: 'e1', created_at: at(new Date(start - 60_000).toISOString().slice(0, 19)) },
	];
	const first = await node.poll.call(context);
	assert.deepEqual(first[0].map((item) => item.json.id), ['e2']);
	assert.equal(context.requests[0].qs.created_at_start, trigger.v4DateTime(start));

	// same second again plus one more: only the new one comes out
	data = [{ id: 'e2', created_at: at(t1) }, { id: 'e3', created_at: at(t1) }];
	const second = await node.poll.call(context);
	assert.deepEqual(second[0].map((item) => item.json.id), ['e3']);
	assert.equal(await node.poll.call(context), null);
});

test('supplier bill trigger reads newest first and stops at known bills', async () => {
	const base = Date.UTC(2026, 9, 27, 8);
	const iso = (offsetMin) => at(new Date(base + offsetMin * 60_000).toISOString().slice(0, 19));
	const context = pollContext({ resource: 'bill', billFilters: { status: 'DRAFTS' } }, (options) => ({
		data:
			options.qs.page === 1
				? [
						{ id: 'b3', created_at: iso(10) },
						{ id: 'b2', created_at: iso(5) },
					]
				: [{ id: 'b1', created_at: iso(-5) }],
		paging: { page: options.qs.page, page_count: 3 },
	}));
	context.staticData.key = 'bill:created';
	context.staticData.lastCreatedAt = base;
	context.staticData.lastUuids = [];

	const result = await new trigger.BexioTrigger().poll.call(context);
	assert.deepEqual(result[0].map((item) => item.json.id), ['b2', 'b3']);
	assert.deepEqual(context.requests.map((request) => request.qs.page), [1, 2]);
	assert.equal(context.requests[0].qs.sort, 'created_at');
	assert.equal(context.requests[0].qs.status, 'DRAFTS');
	assert.equal(context.staticData.lastCreatedAt, base + 10 * 60_000);
});

test('supplier bill trigger falls back to a full scan when sorting is rejected', async () => {
	const base = Date.UTC(2026, 9, 27, 8);
	const context = pollContext({ resource: 'bill' }, (options) => {
		if (options.qs.sort) {
			const error = new Error('Request failed with status code 422');
			error.httpCode = '422';
			throw error;
		}
		return {
			data: [
				{ id: 'old', created_at: at(new Date(base - 60_000).toISOString().slice(0, 19)) },
				{ id: 'new', created_at: at(new Date(base + 60_000).toISOString().slice(0, 19)) },
			],
			paging: { page: 1, page_count: 1 },
		};
	});
	Object.assign(context.staticData, { key: 'bill:created', lastCreatedAt: base, lastUuids: [] });

	const result = await new trigger.BexioTrigger().poll.call(context);
	assert.deepEqual(result[0].map((item) => item.json.id), ['new']);
	assert.equal(context.staticData.billSortUnsupported, true);

	// later polls skip the rejected sort right away
	context.requests.length = 0;
	await new trigger.BexioTrigger().poll.call(context);
	assert.equal(context.requests.length, 1);
	assert.equal(context.requests[0].qs.sort, undefined);
});

test('supplier bill trigger detects an ignored sort order and scans all bills', async () => {
	const base = Date.UTC(2026, 9, 27, 8);
	const iso = (offsetMin) => at(new Date(base + offsetMin * 60_000).toISOString().slice(0, 19));
	// bexio answers 200 but ascending: the oldest bill comes first
	const unsorted = { data: [{ id: 'old', created_at: iso(-5) }, { id: 'new', created_at: iso(5) }], paging: { page: 1, page_count: 1 } };
	const context = pollContext({ resource: 'bill' }, () => unsorted);
	Object.assign(context.staticData, { key: 'bill:created', lastCreatedAt: base, lastUuids: [] });

	const result = await new trigger.BexioTrigger().poll.call(context);
	assert.deepEqual(result[0].map((item) => item.json.id), ['new']);
	assert.equal(context.staticData.billSortUnsupported, true);
	assert.equal(context.requests.length, 2);
	assert.equal(context.requests[1].qs.sort, undefined);

	assert.equal(trigger.isNewestFirst([{ created_at: iso(5) }, { created_at: iso(5) }, { created_at: iso(-1) }]), true);
	assert.equal(trigger.isNewestFirst([{ created_at: iso(-1) }, { created_at: iso(5) }]), false);
});

test('task fingerprints change with the content only', () => {
	const task = { id: 1, subject: 'test', info: 'a' };
	assert.equal(trigger.taskFingerprint(task), trigger.taskFingerprint({ info: 'a', id: 1, subject: 'test' }));
	assert.notEqual(trigger.taskFingerprint(task), trigger.taskFingerprint({ ...task, info: 'b' }));
});

test('task trigger never sends order_by and emits each change once', async () => {
	let tasks = [{ id: 1, subject: 'test', info: 'a' }, { id: 2, subject: 'other', info: 'x' }];
	const context = pollContext({ resource: 'task', event: 'updated' }, () => tasks);
	const node = new trigger.BexioTrigger();

	assert.equal(await node.poll.call(context), null); // activation remembers existing tasks
	assert.equal(await node.poll.call(context), null);
	tasks = [{ id: 1, subject: 'test', info: 'b' }, { id: 2, subject: 'other', info: 'x' }, { id: 3, subject: 'new', info: '' }];
	assert.deepEqual((await node.poll.call(context))[0].map((item) => item.json.id), [1, 3]);
	assert.equal(await node.poll.call(context), null);

	for (const request of context.requests) {
		assert.equal(request.qs.order_by, undefined);
		assert.equal(request.url, 'https://api.bexio.com/2.0/task/search');
		assert.match(request.body.at(-1).value, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
		assert.equal(request.body.at(-1).field, 'updated_at');
	}
});
