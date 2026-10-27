import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { executeNote, executeTask } from './actions/activity';
import { executeContact } from './actions/contact';
import { executeDocument } from './actions/document';
import { executeApiRequest, executeArticle, executeFile, executeUser } from './actions/other';
import { executeProject, executeTimesheet } from './actions/project';
import { executeBill, executeExpense } from './actions/purchase';
import { DOCUMENT_KINDS, type DocumentKind } from './constants';
import { noteDescription, taskDescription } from './descriptions/ActivityDescriptions';
import { contactDescription } from './descriptions/ContactDescription';
import { documentDescription } from './descriptions/DocumentDescription';
import {
	apiRequestDescription,
	articleDescription,
	fileDescription,
	userDescription,
} from './descriptions/OtherDescriptions';
import { projectDescription, timesheetDescription } from './descriptions/ProjectDescriptions';
import { billDescription, expenseDescription } from './descriptions/PurchaseDescriptions';
import { authenticationProperty, bexioCredentials } from './descriptions/shared';
import { listSearch, loadOptions } from './methods';

export class Bexio implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bexio',
		name: 'bexio',
		icon: { light: 'file:bexio.svg', dark: 'file:bexio.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Work with contacts, invoices, quotes, orders, supplier bills, expenses, items, projects, timesheets, tasks, notes and files in bexio',
		defaults: {
			name: 'Bexio',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
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
					{
						name: 'API Request',
						value: 'apiRequest',
						description: 'Call any bexio endpoint with this credential',
					},
					{ name: 'Contact', value: 'contact', description: 'Companies and persons' },
					{ name: 'Expense', value: 'expense', description: 'Expenses paid directly, e.g. with receipts' },
					{ name: 'File', value: 'file', description: 'Files in the bexio inbox' },
					{ name: 'Invoice', value: 'invoice' },
					{ name: 'Item', value: 'article', description: 'Products and services' },
					{ name: 'Note', value: 'note', description: 'Notes on contacts and projects' },
					{ name: 'Order', value: 'order' },
					{ name: 'Project', value: 'project' },
					{ name: 'Quote', value: 'quote' },
					{ name: 'Supplier Bill', value: 'bill', description: 'Bills from suppliers (purchase)' },
					{ name: 'Task', value: 'task' },
					{ name: 'Timesheet', value: 'timesheet', description: 'Time tracking entries' },
					{ name: 'User', value: 'user' },
				],
				default: 'contact',
			},
			...contactDescription,
			...DOCUMENT_KINDS.flatMap((kind) => documentDescription(kind)),
			...articleDescription,
			...projectDescription,
			...timesheetDescription,
			...billDescription,
			...expenseDescription,
			...taskDescription,
			...noteDescription,
			...fileDescription,
			...userDescription,
			...apiRequestDescription,
		],
	};

	methods = { listSearch, loadOptions };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				let result: IDataObject | IDataObject[] | INodeExecutionData;
				if ((DOCUMENT_KINDS as string[]).includes(resource)) {
					result = await executeDocument.call(this, resource as DocumentKind, operation, itemIndex);
				} else if (resource === 'contact') {
					result = await executeContact.call(this, operation, itemIndex);
				} else if (resource === 'article') {
					result = await executeArticle.call(this, operation, itemIndex);
				} else if (resource === 'project') {
					result = await executeProject.call(this, operation, itemIndex);
				} else if (resource === 'timesheet') {
					result = await executeTimesheet.call(this, operation, itemIndex);
				} else if (resource === 'task') {
					result = await executeTask.call(this, operation, itemIndex);
				} else if (resource === 'note') {
					result = await executeNote.call(this, operation, itemIndex);
				} else if (resource === 'bill') {
					result = await executeBill.call(this, operation, itemIndex);
				} else if (resource === 'expense') {
					result = await executeExpense.call(this, operation, itemIndex);
				} else if (resource === 'file') {
					result = await executeFile.call(this, operation, itemIndex);
				} else if (resource === 'user') {
					result = await executeUser.call(this, operation, itemIndex);
				} else if (resource === 'apiRequest') {
					result = await executeApiRequest.call(this, itemIndex);
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource "${resource}"`, { itemIndex });
				}

				// PDFs and downloaded files come back as complete items with binary data
				if (!Array.isArray(result) && 'binary' in result && 'json' in result) {
					returnData.push({ ...(result as INodeExecutionData), pairedItem: { item: itemIndex } });
					continue;
				}

				returnData.push(
					...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(result as IDataObject | IDataObject[]), {
						itemData: { item: itemIndex },
					}),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
					continue;
				}
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error.errorResponse ?? (error as unknown as JsonObject), {
						message: error.message,
						description: error.description ?? undefined,
						httpCode: error.httpCode ?? undefined,
						itemIndex,
					});
				}
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error.message, {
						description: error.description ?? undefined,
						itemIndex,
					});
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
