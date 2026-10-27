import type { INodeProperties } from 'n8n-workflow';

import { PROJECT_BUDGET_TYPES, PROJECT_INVOICE_TYPES } from '../constants';
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

// ---------------------------------------------------------------- Project

const projectFields: INodeProperties[] = [
	{
		displayName: 'Budget Amount',
		name: 'prBudgetTypeAmount',
		type: 'number',
		default: 0,
		description: 'Requires a budget type',
	},
	{ displayName: 'Budget Type', name: 'prBudgetTypeId', type: 'options', options: PROJECT_BUDGET_TYPES, default: 1 },
	{ displayName: 'Comment', name: 'comment', type: 'string', typeOptions: { rows: 3 }, default: '' },
	contactField({ displayName: 'Contact Person', name: 'contactSubId' }),
	{
		displayName: 'Document Number',
		name: 'documentNr',
		type: 'string',
		default: '',
		description: 'Only allowed if automatic numbering is turned off in bexio',
	},
	{ displayName: 'End Date', name: 'endDate', type: 'dateTime', default: '' },
	{
		displayName: 'Invoice Amount',
		name: 'prInvoiceTypeAmount',
		type: 'number',
		default: 0,
		description: 'Hourly rate or fixed price, depending on the invoice type',
	},
	{ displayName: 'Invoice Type', name: 'prInvoiceTypeId', type: 'options', options: PROJECT_INVOICE_TYPES, default: 1 },
	userField('userId', 'Responsible User'),
	{ displayName: 'Start Date', name: 'startDate', type: 'dateTime', default: '' },
	additionalJsonField,
];

export const projectDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['project'] } },
		options: [
			{ name: 'Archive', value: 'archive', action: 'Archive a project' },
			{ name: 'Create', value: 'create', action: 'Create a project' },
			{ name: 'Delete', value: 'delete', action: 'Delete a project' },
			{ name: 'Get', value: 'get', action: 'Get a project' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many projects', description: 'List or search projects' },
			{ name: 'Reactivate', value: 'reactivate', action: 'Reactivate a project', description: 'Reactivate an archived project' },
			{ name: 'Update', value: 'update', action: 'Update a project' },
		],
		default: 'getAll',
	},
	projectField({
		displayName: 'Project',
		name: 'projectId',
		required: true,
		displayOptions: { show: { resource: ['project'], operation: ['get', 'update', 'delete', 'archive', 'reactivate'] } },
	}),
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['project'], operation: ['create'] } },
	},
	contactField({
		displayName: 'Contact',
		name: 'contactId',
		required: true,
		displayOptions: { show: { resource: ['project'], operation: ['create'] } },
	}),
	optionsField('Status', 'prStateId', 'getProjectStates', {
		required: true,
		displayOptions: { show: { resource: ['project'], operation: ['create'] } },
	}),
	optionsField('Project Type', 'prProjectTypeId', 'getProjectTypes', {
		required: true,
		displayOptions: { show: { resource: ['project'], operation: ['create'] } },
	}),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['project'], operation: ['create'] } },
		options: projectFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['project'], operation: ['update'] } },
		options: [
			contactField({ displayName: 'Contact', name: 'contactId' }),
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			optionsField('Project Type', 'prProjectTypeId', 'getProjectTypes'),
			optionsField('Status', 'prStateId', 'getProjectStates'),
			...projectFields,
		],
	},
	...returnAllFields({ show: { resource: ['project'], operation: ['getAll'] } }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['project'], operation: ['getAll'] } },
		options: [
			contactField({ displayName: 'Contact', name: 'contactId' }),
			{ displayName: 'Name', name: 'name', type: 'string', default: '', description: 'Name contains this text' },
			optionsField('Status', 'prStateId', 'getProjectStates'),
		],
	},
	searchConditionsField('pr_project', { show: { resource: ['project'], operation: ['getAll'] } }),
	orderByField(['id', 'name'], { show: { resource: ['project'], operation: ['getAll'] } }),
];

// ---------------------------------------------------------------- Timesheet

const trackingFields = (required: boolean): INodeProperties[] => [
	{
		displayName: 'Tracking',
		name: 'trackingType',
		type: 'options',
		options: [
			{ name: 'Duration', value: 'duration', description: 'A date and a duration' },
			{ name: 'Time Range', value: 'range', description: 'A start and an end time' },
		],
		default: 'duration',
	},
	{
		displayName: 'Date',
		name: 'date',
		type: 'dateTime',
		required,
		default: '',
		displayOptions: { show: { trackingType: ['duration'] } },
	},
	{
		displayName: 'Duration',
		name: 'duration',
		type: 'string',
		required,
		default: '',
		placeholder: '01:30',
		description: 'Duration as HH:MM',
		displayOptions: { show: { trackingType: ['duration'] } },
	},
	{
		displayName: 'Start',
		name: 'start',
		type: 'dateTime',
		required,
		default: '',
		displayOptions: { show: { trackingType: ['range'] } },
	},
	{
		displayName: 'End',
		name: 'end',
		type: 'dateTime',
		required,
		default: '',
		displayOptions: { show: { trackingType: ['range'] } },
	},
];

const timesheetFields: INodeProperties[] = [
	contactField({ displayName: 'Contact', name: 'contactId' }),
	contactField({ displayName: 'Contact Person', name: 'subContactId' }),
	{
		displayName: 'Estimated Time',
		name: 'estimatedTime',
		type: 'string',
		default: '',
		placeholder: '02:00',
		description: 'Estimated time as HH:MM',
	},
	projectField({ displayName: 'Project', name: 'prProjectId' }),
	optionsField('Status', 'statusId', 'getTimesheetStatuses'),
	{ displayName: 'Text', name: 'text', type: 'string', typeOptions: { rows: 3 }, default: '' },
	userField('userId', 'User'),
	additionalJsonField,
];

export const timesheetDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['timesheet'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a timesheet entry' },
			{ name: 'Delete', value: 'delete', action: 'Delete a timesheet entry' },
			{ name: 'Get', value: 'get', action: 'Get a timesheet entry' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many timesheet entries' },
			{ name: 'Update', value: 'update', action: 'Update a timesheet entry' },
		],
		default: 'create',
	},
	{
		displayName: 'Timesheet ID',
		name: 'timesheetId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['timesheet'], operation: ['get', 'update', 'delete'] } },
	},
	optionsField('Business Activity', 'clientServiceId', 'getBusinessActivities', {
		required: true,
		displayOptions: { show: { resource: ['timesheet'], operation: ['create'] } },
	}),
	...trackingFields(true).map((field) => ({
		...field,
		displayOptions: {
			show: { resource: ['timesheet'], operation: ['create'], ...(field.displayOptions?.show ?? {}) },
		},
	})),
	{
		displayName: 'Billable',
		name: 'allowableBill',
		type: 'boolean',
		default: true,
		description: 'Whether the time can be billed',
		displayOptions: { show: { resource: ['timesheet'], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['timesheet'], operation: ['create'] } },
		options: timesheetFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['timesheet'], operation: ['update'] } },
		options: [
			{ displayName: 'Billable', name: 'allowableBill', type: 'boolean', default: true },
			optionsField('Business Activity', 'clientServiceId', 'getBusinessActivities'),
			...timesheetFields,
		],
	},
	{
		displayName: 'Change Tracked Time',
		name: 'changeTracking',
		type: 'boolean',
		default: false,
		description: 'Whether to replace the tracked time',
		displayOptions: { show: { resource: ['timesheet'], operation: ['update'] } },
	},
	...trackingFields(true).map((field) => ({
		...field,
		displayOptions: {
			show: {
				resource: ['timesheet'],
				operation: ['update'],
				changeTracking: [true],
				...(field.displayOptions?.show ?? {}),
			},
		},
	})),
	...returnAllFields({ show: { resource: ['timesheet'], operation: ['getAll'] } }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['timesheet'], operation: ['getAll'] } },
		options: [
			optionsField('Business Activity', 'clientServiceId', 'getBusinessActivities'),
			contactField({ displayName: 'Contact', name: 'contactId' }),
			locatorField({ displayName: 'Project', name: 'prProjectId', searchListMethod: 'searchProjects' }),
			optionsField('Status', 'statusId', 'getTimesheetStatuses'),
			userField('userId', 'User', 'Only entries of this user'),
		],
	},
	searchConditionsField('timesheet', { show: { resource: ['timesheet'], operation: ['getAll'] } }),
	orderByField(['date', 'id'], { show: { resource: ['timesheet'], operation: ['getAll'] } }),
];
