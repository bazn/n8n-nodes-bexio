import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class BexioApi implements ICredentialType {
	name = 'bexioApi';

	displayName = 'Bexio API';

	icon = {
		light: 'file:../nodes/Bexio/bexio.svg',
		dark: 'file:../nodes/Bexio/bexio.dark.svg',
	} as const;

	documentationUrl = 'https://docs.bexio.com/#section/Authentication/Personal-Access-Tokens-(PAT)';

	properties: INodeProperties[] = [
		{
			displayName: 'Personal Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Personal access token created on developer.bexio.com/pat. It has all default scopes and is valid for 60 days.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
				Accept: 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.bexio.com',
			url: '/3.0/users/me',
		},
	};
}
