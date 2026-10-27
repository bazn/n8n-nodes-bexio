# Changelog

## 0.1.1

- **Fix:** the trigger for tasks and Task → Get Many failed with HTTP 500. bexio rejects any `order_by` on tasks and returns no `updated_at` for them (verified on a bexio sandbox). Task changes are now detected by poll time and a content fingerprint; Get Many no longer sorts tasks.
- **Fix:** the supplier bill trigger checks that bexio really returns bills newest first. bexio accepts unknown sort fields with HTTP 200, so the previous fallback could not detect them and new bills could be missed.

## 0.1.0

- First version
- Node *Bexio* with the resources Contact, Invoice, Quote, Order, Supplier Bill, Expense, Item, Project, Timesheet, Task, Note, File, User and API Request
- Supplier bills: get, list with filters, update, book (approve), revert to draft, duplicate
- Expenses: create with receipt upload, get, list with filters, update, delete, book, revert to draft, duplicate
- Invoices, quotes and orders: positions as fields or JSON, issue, send, PDF download, payments, converting quotes into orders and invoices
- Node *Bexio Trigger*: new or changed contacts, invoices, quotes, orders and tasks; new supplier bills (with status filter) and expenses
- Credentials *Bexio API* (personal access token) and *Bexio OAuth2 API*
- Rate-limited requests (HTTP 429) are retried
- Node and credential icons use the official bexio logo
