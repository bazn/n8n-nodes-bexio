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

const CONTACT_REQUIRED = ['contact_type_id', 'name_1', 'user_id', 'owner_id'];

export async function executeContact(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	switch (operation) {
		case 'create': {
			const fields = buildBody.call(
				this,
				this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject,
				itemIndex,
				['birthday'],
			);
			const userId = await userIdOrMe.call(this, fields.user_id);
			return (await bexioApiRequest.call(this, 'POST', '2.0/contact', {
				contact_type_id: this.getNodeParameter('contactTypeId', itemIndex),
				name_1: this.getNodeParameter('name1', itemIndex),
				...fields,
				user_id: userId,
				owner_id: fields.owner_id ?? userId,
			})) as IDataObject;
		}

		case 'get': {
			const id = getId.call(this, 'contactId', itemIndex, 'contact');
			const showArchived = this.getNodeParameter('showArchived', itemIndex, false) as boolean;
			return (await bexioApiRequest.call(
				this,
				'GET',
				`2.0/contact/${id}`,
				undefined,
				showArchived ? { show_archived: true } : {},
			)) as IDataObject;
		}

		case 'getAll': {
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			const timeZone = this.getTimezone();
			const qs: IDataObject = { order_by: this.getNodeParameter('orderBy', itemIndex, 'id_asc') };
			if (filters.showArchived) qs.show_archived = true;
			return listOrSearch.call(
				this,
				'2.0/contact',
				[
					...likeCondition('name_1', filters.name),
					...likeCondition('mail', filters.mail),
					...likeCondition('city', filters.city),
					...likeCondition('postcode', filters.postcode),
					...equalsCondition('nr', filters.nr),
					...equalsCondition('contact_type_id', filters.contactTypeId),
					...likeCondition('contact_group_ids', filters.contactGroupId),
					...equalsCondition('user_id', filters.userId),
					...(filters.updatedSince
						? [{ field: 'updated_at', value: toBexioDateTime(filters.updatedSince, timeZone), criteria: '>=' }]
						: []),
					...searchConditions.call(this, itemIndex),
				],
				qs,
				limitFor.call(this, itemIndex),
			);
		}

		case 'update': {
			const id = getId.call(this, 'contactId', itemIndex, 'contact');
			const updates = buildBody.call(
				this,
				this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject,
				itemIndex,
				['birthday'],
			);
			return editWithRequired.call(this, `2.0/contact/${id}`, updates, CONTACT_REQUIRED);
		}

		case 'delete': {
			const id = getId.call(this, 'contactId', itemIndex, 'contact');
			await bexioApiRequest.call(this, 'DELETE', `2.0/contact/${id}`);
			return { success: true, id };
		}

		case 'restore': {
			const id = getId.call(this, 'contactId', itemIndex, 'contact');
			await bexioApiRequest.call(this, 'PATCH', `2.0/contact/${id}/restore`);
			return (await bexioApiRequest.call(this, 'GET', `2.0/contact/${id}`)) as IDataObject;
		}
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex });
}
