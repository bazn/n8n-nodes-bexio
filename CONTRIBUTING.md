# Contributing

Issues and pull requests are welcome.

## Reporting a problem

Please include:

- the n8n version and the version of this package;
- your bexio plan and whether you use a personal access token or OAuth2;
- the resource and operation (or trigger event) you used;
- the error message, with any IDs, tokens and personal data removed.

## Making changes

```bash
npm ci
npm run lint
npm test
```

- Keep the n8n community node lint rules green (`npm run lint`).
- Add unit tests in `test/unit/` for logic that does not need a bexio account.
- If you change how the node talks to the bexio API, test it against a bexio trial or test account, never against production data.
- Endpoints, fields and status ids follow the [bexio API reference](https://docs.bexio.com). Document verified API behaviour as a short comment next to the code that relies on it.
- Add an entry to `CHANGELOG.md`.
