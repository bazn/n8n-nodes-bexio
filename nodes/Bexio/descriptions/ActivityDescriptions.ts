import type { INodeProperties } from 'n8n-workflow';

import {
	additionalJsonField,
	contactField,
	optionsField,
	projectField,
	returnAllFields,
	searchConditionsField,
	userField,
} from './shared';

// ---------------------------------------------------------------- Task

const taskFields: INodeProperties[] = [
	contactField({ displayName: 'Contact', name: 'contactId' }),
	contactField({ displayName: 'Contact Person', name: 'subContactId' }),
	{ displayName: 'Due Date', name: 'finishDate', type: 'dateTime', default: '' },
	{ displayName: 'Info', name: 'info', type: 'string', typeOptions: { rows: 3 }, default: '' },
	optionsField('Priority', 'todoPriorityId', 'getTodoPriorities'),
	projectField({ displayName: 'Project', name: 'prProjectId' }),
	optionsField('Status', 'todoStatusId', 'getTodoStatuses'),
	userField('userId', 'Responsible User'),
	additionalJsonField,
];

export const taskDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['task'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a task' },
			{ name: 'Delete', value: 'delete', action: 'Delete a task' },
			{ name: 'Get', value: 'get', action: 'Get a task' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many tasks' },
			{ name: 'Update', value: 'update', action: 'Update a task' },
		],
		default: 'create',
	},
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['task'], operation: ['get', 'update', 'delete'] } },
	},
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
		options: taskFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['task'], operation: ['update'] } },
		options: [{ displayName: 'Subject', name: 'subject', type: 'string', default: '' }, ...taskFields],
	},
	...returnAllFields({ show: { resource: ['task'], operation: ['getAll'] } }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['task'], operation: ['getAll'] } },
		options: [
			contactField({ displayName: 'Contact', name: 'contactId' }),
			optionsField('Status', 'todoStatusId', 'getTodoStatuses'),
			{ displayName: 'Subject', name: 'subject', type: 'string', default: '', description: 'Subject contains this text' },
			{
				displayName: 'Updated Since',
				name: 'updatedSince',
				type: 'dateTime',
				default: '',
				description: 'Only tasks changed at or after this time',
			},
			userField('userId', 'Responsible User', 'Only tasks of this user'),
		],
	},
	searchConditionsField('task', { show: { resource: ['task'], operation: ['getAll'] } }),
];

// ---------------------------------------------------------------- Note

const noteFields: INodeProperties[] = [
	contactField({ displayName: 'Contact', name: 'contactId' }),
	{ displayName: 'Info', name: 'info', type: 'string', typeOptions: { rows: 4 }, default: '' },
	projectField({ displayName: 'Project', name: 'prProjectId' }),
	userField('userId', 'User'),
	additionalJsonField,
];

export const noteDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['note'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a note' },
			{ name: 'Delete', value: 'delete', action: 'Delete a note' },
			{ name: 'Get', value: 'get', action: 'Get a note' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many notes' },
			{ name: 'Update', value: 'update', action: 'Update a note' },
		],
		default: 'create',
	},
	{
		displayName: 'Note ID',
		name: 'noteId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['note'], operation: ['get', 'update', 'delete'] } },
	},
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['note'], operation: ['create'] } },
	},
	{
		displayName: 'Date',
		name: 'eventStart',
		type: 'dateTime',
		default: '',
		description: 'Date and time of the note. Empty means now.',
		displayOptions: { show: { resource: ['note'], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['note'], operation: ['create'] } },
		options: noteFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['note'], operation: ['update'] } },
		options: [
			{ displayName: 'Date', name: 'eventStart', type: 'dateTime', default: '' },
			{ displayName: 'Subject', name: 'subject', type: 'string', default: '' },
			...noteFields,
		],
	},
	...returnAllFields({ show: { resource: ['note'], operation: ['getAll'] } }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['note'], operation: ['getAll'] } },
		options: [
			contactField({ displayName: 'Contact', name: 'contactId' }),
			{ displayName: 'Subject', name: 'subject', type: 'string', default: '', description: 'Subject contains this text' },
			userField('userId', 'User', 'Only notes of this user'),
		],
	},
	searchConditionsField('note', { show: { resource: ['note'], operation: ['getAll'] } }),
];
