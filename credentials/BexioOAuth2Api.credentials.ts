import type { ICredentialType, INodeProperties } from 'n8n-workflow';

/** Scopes needed for every resource of the node. Read access is implied by the matching edit scope. */
const DEFAULT_SCOPES = [
	'openid',
	'profile',
	'email',
	'offline_access',
	'company_profile',
	'contact_edit',
	'kb_invoice_edit',
	'kb_offer_edit',
	'kb_order_edit',
	'kb_delivery_edit',
	'article_edit',
	'project_edit',
	'monitoring_edit',
	'task_edit',
	'note_edit',
	'file',
	'bank_account_show',
	'accounting',
	'kb_bill_show',
	'kb_expense_show',
].join(' ');

export class BexioOAuth2Api implements ICredentialType {
	name = 'bexioOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Bexio OAuth2 API';

	icon = {
		light: 'file:../nodes/Bexio/bexio.svg',
		dark: 'file:../nodes/Bexio/bexio.dark.svg',
	} as const;

	documentationUrl = 'https://docs.bexio.com/#section/Authentication/Authorization-Code-Flow';

	properties: INodeProperties[] = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/token',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'string',
			default: DEFAULT_SCOPES,
			description:
				'Space-separated scopes requested from bexio. Remove the scopes your workflows do not need.',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	];
}
