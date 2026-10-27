import type { IDisplayOptions, INodeCredentialDescription, INodeProperties } from 'n8n-workflow';

import { SEARCH_CRITERIA, SEARCH_FIELDS } from '../constants';

const ID_REGEX = '^[0-9]+$';

export const LOAD_OPTIONS_DESCRIPTION =
	'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>';

interface LocatorOptions {
	displayName: string;
	name: string;
	searchListMethod: string;
	description?: string;
	required?: boolean;
	displayOptions?: IDisplayOptions;
	placeholder?: string;
}

/** Resource locator for a bexio record: pick from a searchable list or enter its numeric ID. */
export function locatorField(options: LocatorOptions): INodeProperties {
	return {
		displayName: options.displayName,
		name: options.name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: options.required,
		description: options.description,
		displayOptions: options.displayOptions,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: options.searchListMethod, searchable: true },
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: options.placeholder ?? '123',
				validation: [{ type: 'regex', properties: { regex: ID_REGEX, errorMessage: 'Not a valid ID (whole number)' } }],
			},
		],
	};
}

const UUID_REGEX = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

/** Resource locator for v4 records (supplier bills, expenses), which are identified by a UUID. */
export function uuidLocatorField(options: LocatorOptions): INodeProperties {
	return {
		...locatorField(options),
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: options.searchListMethod, searchable: true },
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: '00000000-0000-0000-0000-000000000000',
				validation: [{ type: 'regex', properties: { regex: UUID_REGEX, errorMessage: 'Not a valid ID (UUID)' } }],
			},
		],
	};
}

export function contactField(options: Omit<LocatorOptions, 'searchListMethod'>): INodeProperties {
	return locatorField({ ...options, searchListMethod: 'searchContacts' });
}

export function projectField(options: Omit<LocatorOptions, 'searchListMethod'>): INodeProperties {
	return locatorField({ ...options, searchListMethod: 'searchProjects' });
}

/** Options field backed by a load options method, named "… Name or ID" as n8n requires. */
export function optionsField(
	displayName: string,
	name: string,
	loadOptionsMethod: string,
	extra: Partial<INodeProperties> = {},
): INodeProperties {
	return {
		displayName: `${displayName} Name or ID`,
		name,
		type: 'options',
		typeOptions: { loadOptionsMethod },
		default: '',
		description: LOAD_OPTIONS_DESCRIPTION,
		...extra,
	} as INodeProperties;
}

/** User field; empty means the user the credential belongs to. */
export function userField(name = 'userId', displayName = 'User', hint = 'Empty means the user the credential belongs to'): INodeProperties {
	return optionsField(displayName, name, 'getUsers', { hint });
}

export function returnAllFields(displayOptions: IDisplayOptions): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions,
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: {
				...displayOptions,
				show: { ...displayOptions.show, returnAll: [false] },
			},
		},
	];
}

/** Free search conditions for the `…/search` endpoints, combined with AND. */
export function searchConditionsField(endpoint: string, displayOptions: IDisplayOptions): INodeProperties {
	return {
		displayName: 'Search Conditions',
		name: 'searchConditions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Condition',
		default: {},
		description: 'Conditions combined with AND, in addition to the filters',
		displayOptions,
		options: [
			{
				displayName: 'Condition',
				name: 'condition',
				values: [
					// the first searchable field differs per endpoint, so the default cannot be a literal
					// eslint-disable-next-line n8n-nodes-base/node-param-default-missing
					{
						displayName: 'Field',
						name: 'field',
						type: 'options',
						options: SEARCH_FIELDS[endpoint].map((field) => ({ name: field, value: field })),
						default: SEARCH_FIELDS[endpoint][0],
					},
					{
						displayName: 'Criteria',
						name: 'criteria',
						type: 'options',
						options: SEARCH_CRITERIA,
						default: '=',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Dates as YYYY-MM-DD, timestamps as YYYY-MM-DD HH:MM:SS',
					},
				],
			},
		],
	};
}

export function orderByField(fields: string[], displayOptions: IDisplayOptions): INodeProperties {
	return {
		displayName: 'Sort',
		name: 'orderBy',
		type: 'options',
		options: fields.flatMap((field) => [
			{ name: `${field} Ascending`, value: `${field}_asc` },
			{ name: `${field} Descending`, value: `${field}_desc` },
		]),
		default: `${fields[0]}_asc`,
		displayOptions,
	};
}

/** Request body as raw JSON, merged over the fields (for attributes the node does not offer). */
export const additionalJsonField: INodeProperties = {
	displayName: 'Additional Fields (JSON)',
	name: 'additionalJson',
	type: 'json',
	default: '{}',
	description:
		'Further API attributes in snake_case as in the bexio API reference, e.g. {"salutation_form": 1}. They override the fields above.',
};

export const authenticationProperty: INodeProperties = {
	displayName: 'Authentication',
	name: 'authentication',
	type: 'options',
	options: [
		{ name: 'Personal Access Token', value: 'accessToken' },
		{ name: 'OAuth2', value: 'oAuth2' },
	],
	default: 'accessToken',
};

export const bexioCredentials: INodeCredentialDescription[] = [
	{ name: 'bexioApi', required: true, displayOptions: { show: { authentication: ['accessToken'] } } },
	{ name: 'bexioOAuth2Api', required: true, displayOptions: { show: { authentication: ['oAuth2'] } } },
];
