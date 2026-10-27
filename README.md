<div align="center">

<img src="nodes/Bexio/bexio.svg" alt="bexio logo" width="96" height="96">

# bexio for n8n

**Automate bexio with n8n:** contacts, invoices, quotes, orders, supplier bills, expenses, items, projects, time tracking, tasks, notes and files, plus a trigger for new and changed records.

[![npm version](https://img.shields.io/npm/v/@bazulu1/n8n-nodes-bexio.svg)](https://www.npmjs.com/package/@bazulu1/n8n-nodes-bexio)
[![npm downloads](https://img.shields.io/npm/dm/@bazulu1/n8n-nodes-bexio.svg)](https://www.npmjs.com/package/@bazulu1/n8n-nodes-bexio)
[![CI](https://github.com/bazn/n8n-nodes-bexio/actions/workflows/ci.yml/badge.svg)](https://github.com/bazn/n8n-nodes-bexio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-EA4B71.svg)](https://docs.n8n.io/integrations/community-nodes/)

</div>

> [!NOTE]
> **This is not an official bexio project.** It is an independent community node, not affiliated with, endorsed by or supported by bexio AG. For problems with this node, please [open an issue](https://github.com/bazn/n8n-nodes-bexio/issues) here, not with bexio support.

---

## Highlights

- **Complete sales cycle:** create quotes, turn them into orders and invoices, issue, send by email, download as PDF and record payments.
- **Positions without JSON:** enter custom, item, text, subtotal, discount and page-break positions field by field, or pass a positions array from a previous node.
- **Purchase:** read and approve (book) supplier bills; record expenses with the receipt attached in one step.
- **Contacts and CRM:** companies and persons with groups and sectors, tasks and notes linked to contacts and projects.
- **Projects and time tracking:** projects with status, type, budget and billing type; timesheet entries by duration or time range.
- **A trigger for what matters:** new or changed contacts, invoices, quotes, orders and tasks, new supplier bills and expenses, filtered by status, contact type or user.
- **Comfortable to use:** users, taxes, units, accounts, currencies, bank accounts, templates and more are lists loaded live from your bexio account. Contacts, documents, items and projects are searchable.
- **Safe defaults:** an empty user means the user of the credential; updates send bexio's required fields automatically; rate limits (HTTP 429) are retried.
- **AI-agent ready:** every operation can be used as a tool by n8n AI agents.
- **Escape hatch:** the *API Request* resource calls any bexio endpoint with the node's credential.

## Contents

- [Installation](#installation)
- [Credentials](#credentials)
- [Bexio node](#bexio-node)
- [Bexio Trigger](#bexio-trigger)
- [Good to know](#good-to-know)
- [Development](#development)
- [Releasing](#releasing)
- [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [License](#license)

## Installation

**Self-hosted n8n (also in Docker)**

1. Open **Settings → Community Nodes → Install**.
2. Enter `@bazulu1/n8n-nodes-bexio`, confirm the notice and install.
3. Search for **Bexio** in the node panel.

In Docker the package lives in the persistent `~/.n8n/nodes` volume and survives restarts. Updates are offered on the same settings page.

<details>
<summary>Install without the UI (e.g. for queue-mode workers)</summary>

```bash
docker exec -it <n8n-container> sh -c "mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes && npm install @bazulu1/n8n-nodes-bexio"
docker restart <n8n-container>
```

</details>

> n8n Cloud only allows community nodes that n8n has verified. This package is currently meant for self-hosted n8n.

## Credentials

Choose the method under **Authentication** on the node.

| Credential | Fields |
|---|---|
| **Bexio API** *(quick start)* | **Personal access token** from [developer.bexio.com/pat](https://developer.bexio.com/pat) |
| **Bexio OAuth2 API** *(recommended for production)* | **Client ID** and **client secret** of an app created on [developer.bexio.com](https://developer.bexio.com), scopes |

- A **personal access token** has all default scopes and is **valid for 60 days**. Create a new one before it expires.
- For **OAuth2**, create an app on developer.bexio.com and add the *OAuth Redirect URL* shown in the n8n credential as *Allowed redirect URL*. The default scopes cover every resource of the node; remove the ones you do not need. `offline_access` keeps the connection alive after the bexio session ends.
- The API acts with the rights of the bexio user who created the token or connected the app.

## Bexio node

### Sales

| Resource | Operations |
|---|---|
| **Invoice** | Create, Get, Get Many, Update, Delete, Issue, Revert Issue, Cancel, Mark as Sent, Send, Copy, Get PDF, Add Payment, Get Payments |
| **Quote** | Create, Get, Get Many, Update, Delete, Issue, Revert Issue, Accept, Reject, Mark as Sent, Send, Copy, Get PDF, Create Order, Create Invoice |
| **Order** | Create, Get, Get Many, Update, Delete, Get PDF, Create Delivery, Create Invoice |
| **Item** | Create, Get, Get Many, Update, Delete |

- **Positions:** choose *Fields* to enter positions one by one (custom, item, text, subtotal, discount, page break), or *JSON* to pass an array as in the [bexio API reference](https://docs.bexio.com/#tag/Invoices/operation/v2CreateInvoice).
- **Get Many** filters by status, contact, document number, title, user, document date and *Updated Since*; free *Search Conditions* reach every searchable field.
- **Send** needs the placeholder `[Network Link]` in the message; bexio replaces it with the link to the document. *Attach PDF* adds the PDF to the email.
- **Get PDF** returns the PDF as binary data (field `data` by default), e.g. for an email or a file storage node.
- **State changes** (issue, cancel, accept, …) return the updated document, so the new status is visible.

### Purchase

| Resource | Operations |
|---|---|
| **Supplier Bill** | Get, Get Many, Update, Book, Revert to Draft, Duplicate |
| **Expense** | Create, Get, Get Many, Update, Delete, Book, Revert to Draft, Duplicate |

- **Approving supplier bills:** bexio has no separate approval state. *Book* moves a bill from draft to booked, which makes it payable; *Revert to Draft* undoes it. A typical approval flow: *Get Many* with status *Draft* → ask for approval → *Update* (e.g. set the booking account) → *Book*.
- **Update keeps everything else:** bexio replaces the whole bill or expense on update. The node reads the current record and changes only the fields you set. *Booking Account* on a bill sets the account of every position.
- **Receipts:** *Attach Receipt* uploads a binary file of the input item (e.g. a photo from Telegram or an email attachment) to the bexio inbox and attaches it to the expense.
- **Booking validations:** bexio checks the record when booking, e.g. a booking account (and for expenses a bank account) must be set, and the document number must be unique. Its error message names the missing field.
- Supplier bills and expenses are identified by a UUID, not a number.

### CRM and projects

| Resource | Operations |
|---|---|
| **Contact** | Create, Get, Get Many, Update, Delete (archive), Restore |
| **Project** | Create, Get, Get Many, Update, Delete, Archive, Reactivate |
| **Timesheet** | Create, Get, Get Many, Update, Delete |
| **Task** | Create, Get, Get Many, Update, Delete |
| **Note** | Create, Get, Get Many, Update, Delete |

- Contacts are **companies** or **persons**: *Name / Last Name* is the company name or the last name, *First Name / Company Addition* the first name or the name addition.
- Timesheets take a **duration** (`01:30`, `1:30` or minutes like `90`) on a date, or a **time range** with start and end.

### Other

| Resource | Operations |
|---|---|
| **File** | Upload (to the bexio inbox), Download, Get, Get Many, Delete |
| **User** | Get Current, Get, Get Many |
| **API Request** | Send any request to `https://api.bexio.com/…` with the node's credential |

## Bexio Trigger

Polls bexio and starts the workflow for each new or changed record. bexio has no webhooks, so every event is checked at the interval set on the trigger (*Poll Times*).

| Resource | Events | Filters |
|---|---|---|
| Contact | **Created**, **Created or Updated** | contact type, responsible user |
| Invoice, Quote, Order | **Created**, **Created or Updated** | status, responsible user |
| Supplier Bill | **Created** | status |
| Expense | **Created** | – |
| Task | **Created or Updated** | responsible user |

**Approval flows:** *Supplier Bill → Created* with status *Draft* starts a workflow for every new bill that still has to be booked. Approve it, then use *Book* on the Bexio node.

### How it works

The trigger keeps a **position** in the workflow's static data and only emits what lies beyond it. How "new" is decided depends on the resource:

| Resource and event | Detection | Request per poll |
|---|---|---|
| Contact, Invoice, Quote, Order → **Created** | id higher than the highest id seen | `POST …/search` with `id > last id`, oldest first |
| Contact, Invoice, Quote, Order → **Created or Updated** | `updated_at` at or after the last one seen | `POST …/search` with `updated_at >= last value`, sorted by `updated_at` |
| Task → **Created or Updated** | `updated_at` at or after the last one seen | as above, but tasks cannot be sorted by `updated_at`: the result is sorted locally |
| Expense → **Created** | `created_at` at or after the last one seen | `GET /4.0/expenses?created_at_start=…`, filtered by bexio |
| Supplier Bill → **Created** | `created_at` at or after the last one seen | `GET /4.0/purchase/bills` sorted by `created_at` descending, page by page until a known bill appears |

- **Starting point:** on activation nothing is emitted. Contacts, sales documents and tasks start at the newest existing record. Supplier bills and expenses (which have UUIDs instead of increasing ids) start at the current time of the n8n server.
- **No duplicates at the boundary:** records with exactly the same timestamp as the last poll are compared by id; ids already emitted at that timestamp are skipped. `updated_at` and `created_at` have second precision, so this matters when several records change within one second.
- **Changing resource or event** resets the position: the trigger starts again from "now" and does not catch up on what happened before.
- **Filters** are applied in the same request (status, contact type, user). A status filter checks the status **at the time of the poll**. A bill created as draft and booked before the next poll is therefore not emitted by *Status: Draft*.
- **At most 1000 records per poll.** For contacts and sales documents, if more change between two polls, the oldest 1000 are emitted and the rest follow in the next poll. For tasks, supplier bills and expenses the API offers no matching sort order, so more than 1000 new or changed records within one interval can be missed. Choose a shorter poll interval if that many are expected.
- **Supplier bill fallback:** the bexio API reference does not list which fields bills can be sorted by. If bexio rejects sorting by `created_at` (HTTP 400 or 422), the trigger remembers that and from then on reads all bills on each poll (narrowed by the status filter, at most 10,000) and compares `created_at` locally. This costs more requests on accounts with many bills; a status filter such as *Draft* keeps it small.
- **Tasks:** because tasks cannot be sorted by `updated_at`, the newest change is determined from the 1000 most recent tasks. Changes to much older tasks are still found by the `updated_at` search on later polls.
- **Times:** `updated_at` values are passed back to bexio exactly as bexio returned them, so no time zone conversion is involved. `created_at` of supplier bills and expenses is compared as an absolute time (with offset). A clock difference between n8n and bexio only matters for records created within that difference around the moment of activation.
- **Manual run** (*Fetch Test Event*): shows the records the active trigger has not delivered yet; if there are none, the newest record (supplier bills and expenses: the newest of the last 30 days). A manual run never moves the stored position.
- **Rate limits:** like the node, the trigger waits and retries when bexio answers HTTP 429.

## Good to know

- **Required fields on updates:** bexio's edit endpoints reject bodies without the resource's required fields. The node reads the current record and sends them along, so you only fill in what changes.
- **Users:** wherever a user can be chosen, an empty value means the user the credential belongs to.
- **Dates:** bexio works in Swiss local time. Timestamps with an offset are converted to the workflow's time zone (set it to *Europe/Zurich*); plain dates are sent as `YYYY-MM-DD`.
- **Additional Fields (JSON):** create and update forms accept further attributes in bexio's snake_case notation, e.g. `{"salutation_form": 1}`. They override the fields above.
- **Rate limits:** bexio limits requests per company and minute. The node waits for `RateLimit-Reset` and retries up to three times.
- **Delete contact** archives the contact. *Restore* brings it back; *Get* with *Show Archived* reads it.

## Development

Requires Node.js 24 or newer.

```bash
npm install
npm run dev        # starts n8n with the node loaded and rebuilds on changes
npm run lint       # n8n community node rules
npm test           # build + unit tests (no bexio account needed)
```

The code follows the structure of the n8n community node starter: `nodes/Bexio/descriptions` holds the UI definitions, `nodes/Bexio/actions` the operations per resource, `GenericFunctions.ts` the request, paging and search helpers, and `methods.ts` the dynamic lists.

## Releasing

1. Update [CHANGELOG.md](CHANGELOG.md).
2. `npm version <patch|minor|major>` and `git push --follow-tags`.
3. The *Publish* workflow stages the version on npm and creates a GitHub release; approve the staged version on npmjs.com.

## License

[MIT](LICENSE.md)

bexio and the bexio logo are trademarks of bexio AG. They are used only to identify the service this node connects to. This project is not an official bexio product and is not affiliated with or endorsed by bexio AG.
