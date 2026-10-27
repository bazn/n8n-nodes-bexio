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
	toBexioDate,
	toBexioDateTime,
	userIdOrMe,
} from '../GenericFunctions';

const PROJECT_REQUIRED = ['contact_id', 'name', 'pr_project_type_id', 'pr_state_id', 'user_id'];

export async function executeProject(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	const projectPath = () => `2.0/pr_project/${getId.call(this, 'projectId', itemIndex, 'project')}`;

	switch (operation) {
		case 'create': {
			const fields = buildBody.call(
				this,
				this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject,
				itemIndex,
				['startDate', 'endDate'],
			);
			return (await bexioApiRequest.call(this, 'POST', '2.0/pr_project', {
				name: this.getNodeParameter('name', itemIndex),
				contact_id: Number(this.getNodeParameter('contactId', itemIndex, '', { extractValue: true })),
				pr_state_id: Number(this.getNodeParameter('prStateId', itemIndex)),
				pr_project_type_id: Number(this.getNodeParameter('prProjectTypeId', itemIndex)),
				...fields,
				user_id: await userIdOrMe.call(this, fields.user_id),
			})) as IDataObject;
		}

		case 'get':
			return (await bexioApiRequest.call(this, 'GET', projectPath())) as IDataObject;

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			return listOrSearch.call(
				this,
				'2.0/pr_project',
				[
					...likeCondition('name', filters.name),
					...equalsCondition('contact_id', filters.contactId),
					...equalsCondition('pr_state_id', filters.prStateId),
					...searchConditions.call(this, itemIndex),
				],
				{ order_by: this.getNodeParameter('orderBy', itemIndex, 'id_asc') },
				limitFor.call(this, itemIndex),
			);
		}

		case 'update': {
			const updates = buildBody.call(
				this,
				this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject,
				itemIndex,
				['startDate', 'endDate'],
			);
			return editWithRequired.call(this, projectPath(), updates, PROJECT_REQUIRED);
		}

		case 'delete': {
			const id = getId.call(this, 'projectId', itemIndex, 'project');
			await bexioApiRequest.call(this, 'DELETE', `2.0/pr_project/${id}`);
			return { success: true, id };
		}

		case 'archive':
		case 'reactivate': {
			const path = projectPath();
			await bexioApiRequest.call(this, 'POST', `${path}/${operation}`);
			return (await bexioApiRequest.call(this, 'GET', path)) as IDataObject;
		}
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}

const TIMESHEET_REQUIRED = ['user_id', 'allowable_bill', 'client_service_id'];

/** Reads the tracked time (`duration` with date and HH:MM, or `range` with start and end). */
export function buildTracking(
	trackingType: string,
	values: { date?: unknown; duration?: unknown; start?: unknown; end?: unknown },
	timeZone: string,
): IDataObject {
	if (trackingType === 'range') {
		return {
			type: 'range',
			start: toBexioDateTime(values.start, timeZone),
			end: toBexioDateTime(values.end, timeZone),
		};
	}
	const duration = String(values.duration ?? '').trim();
	return {
		type: 'duration',
		date: toBexioDate(values.date),
		// accept "90" as minutes and "1:30" as hours:minutes
		duration: /^\d+$/.test(duration)
			? `${String(Math.floor(Number(duration) / 60)).padStart(2, '0')}:${String(Number(duration) % 60).padStart(2, '0')}`
			: duration.replace(/^(\d):/, '0$1:'),
	};
}

function trackingFromParameters(this: IExecuteFunctions, itemIndex: number): IDataObject {
	const trackingType = this.getNodeParameter('trackingType', itemIndex, 'duration') as string;
	const get = (name: string) => this.getNodeParameter(name, itemIndex, '');
	return buildTracking(
		trackingType,
		trackingType === 'range' ? { start: get('start'), end: get('end') } : { date: get('date'), duration: get('duration') },
		this.getTimezone(),
	);
}

export async function executeTimesheet(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	const timesheetPath = () => `2.0/timesheet/${getId.call(this, 'timesheetId', itemIndex, 'timesheet')}`;

	switch (operation) {
		case 'create': {
			const fields = buildBody.call(
				this,
				this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject,
				itemIndex,
			);
			return (await bexioApiRequest.call(this, 'POST', '2.0/timesheet', {
				client_service_id: Number(this.getNodeParameter('clientServiceId', itemIndex)),
				allowable_bill: this.getNodeParameter('allowableBill', itemIndex, true),
				tracking: trackingFromParameters.call(this, itemIndex),
				...fields,
				user_id: await userIdOrMe.call(this, fields.user_id),
			})) as IDataObject;
		}

		case 'get':
			return (await bexioApiRequest.call(this, 'GET', timesheetPath())) as IDataObject;

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			return listOrSearch.call(
				this,
				'2.0/timesheet',
				[
					...equalsCondition('client_service_id', filters.clientServiceId),
					...equalsCondition('contact_id', filters.contactId),
					...equalsCondition('pr_project_id', filters.prProjectId),
					...equalsCondition('status_id', filters.statusId),
					...equalsCondition('user_id', filters.userId),
					...searchConditions.call(this, itemIndex),
				],
				{ order_by: this.getNodeParameter('orderBy', itemIndex, 'date_asc') },
				limitFor.call(this, itemIndex),
			);
		}

		case 'update': {
			const path = timesheetPath();
			const updates = buildBody.call(
				this,
				this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject,
				itemIndex,
			);
			if (this.getNodeParameter('changeTracking', itemIndex, false)) {
				updates.tracking = trackingFromParameters.call(this, itemIndex);
			} else {
				// tracking is required by the edit endpoint; keep the current date and duration
				const current = (await bexioApiRequest.call(this, 'GET', path)) as IDataObject;
				updates.tracking = { type: 'duration', date: current.date, duration: current.duration };
			}
			return editWithRequired.call(this, path, updates, TIMESHEET_REQUIRED);
		}

		case 'delete': {
			const id = getId.call(this, 'timesheetId', itemIndex, 'timesheet');
			await bexioApiRequest.call(this, 'DELETE', `2.0/timesheet/${id}`);
			return { success: true, id };
		}
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}
