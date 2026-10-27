import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	bexioApiRequest,
	buildBody,
	editWithRequired,
	equalsCondition,
	getId,
	likeCondition,
	limitFor,
	listOrSearch,
	searchConditions,
	toBexioDateTime,
	userIdOrMe,
} from '../GenericFunctions';

/** Converts the date-time fields of a task or note body to bexio's `YYYY-MM-DD HH:MM:SS`. */
function withDateTimes(this: IExecuteFunctions, body: IDataObject, keys: string[]): IDataObject {
	const timeZone = this.getTimezone();
	for (const key of keys) {
		if (body[key] !== undefined) body[key] = toBexioDateTime(body[key], timeZone);
	}
	return body;
}

export async function executeTask(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	const taskPath = () => `2.0/task/${getId.call(this, 'taskId', itemIndex, 'task')}`;
	const fieldsOf = (name: string) =>
		withDateTimes.call(
			this,
			buildBody.call(this, this.getNodeParameter(name, itemIndex, {}) as IDataObject, itemIndex),
			['finish_date'],
		);

	switch (operation) {
		case 'create': {
			const fields = fieldsOf('additionalFields');
			return (await bexioApiRequest.call(this, 'POST', '2.0/task', {
				subject: this.getNodeParameter('subject', itemIndex),
				...fields,
				user_id: await userIdOrMe.call(this, fields.user_id),
			})) as IDataObject;
		}

		case 'get':
			return (await bexioApiRequest.call(this, 'GET', taskPath())) as IDataObject;

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			return listOrSearch.call(
				this,
				'2.0/task',
				[
					...likeCondition('subject', filters.subject),
					...equalsCondition('contact_id', filters.contactId),
					...equalsCondition('todo_status_id', filters.todoStatusId),
					...equalsCondition('user_id', filters.userId),
					...(filters.updatedSince
						? [{ field: 'updated_at', value: toBexioDateTime(filters.updatedSince, this.getTimezone()), criteria: '>=' }]
						: []),
					...searchConditions.call(this, itemIndex),
				],
				// any order_by on tasks makes bexio answer HTTP 500 (verified on a sandbox)
				{},
				limitFor.call(this, itemIndex),
			);
		}

		case 'update':
			return editWithRequired.call(this, taskPath(), fieldsOf('updateFields'), ['user_id', 'subject']);

		case 'delete': {
			const id = getId.call(this, 'taskId', itemIndex, 'task');
			await bexioApiRequest.call(this, 'DELETE', `2.0/task/${id}`);
			return { success: true, id };
		}
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}

export async function executeNote(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	const notePath = () => `2.0/note/${getId.call(this, 'noteId', itemIndex, 'note')}`;
	const fieldsOf = (name: string) =>
		withDateTimes.call(
			this,
			buildBody.call(this, this.getNodeParameter(name, itemIndex, {}) as IDataObject, itemIndex),
			['event_start'],
		);

	switch (operation) {
		case 'create': {
			const fields = fieldsOf('additionalFields');
			const eventStart = this.getNodeParameter('eventStart', itemIndex, '') as string;
			return (await bexioApiRequest.call(this, 'POST', '2.0/note', {
				subject: this.getNodeParameter('subject', itemIndex),
				event_start: toBexioDateTime(eventStart || new Date().toISOString(), this.getTimezone()),
				...fields,
				user_id: await userIdOrMe.call(this, fields.user_id),
			})) as IDataObject;
		}

		case 'get':
			return (await bexioApiRequest.call(this, 'GET', notePath())) as IDataObject;

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			return listOrSearch.call(
				this,
				'2.0/note',
				[
					...likeCondition('subject', filters.subject),
					...equalsCondition('contact_id', filters.contactId),
					...equalsCondition('user_id', filters.userId),
					...searchConditions.call(this, itemIndex),
				],
				{},
				limitFor.call(this, itemIndex),
			);
		}

		case 'update':
			return editWithRequired.call(this, notePath(), fieldsOf('updateFields'), ['user_id', 'subject', 'event_start']);

		case 'delete': {
			const id = getId.call(this, 'noteId', itemIndex, 'note');
			await bexioApiRequest.call(this, 'DELETE', `2.0/note/${id}`);
			return { success: true, id };
		}
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}
