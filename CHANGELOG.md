# Changelog

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
- Task trigger and Task → Get Many work without `order_by`, which bexio rejects with HTTP 500 for tasks; task changes are detected by poll time and content fingerprint (verified on a bexio sandbox)
- Supplier bill trigger verifies the sort order of bexio's answer instead of relying on an error for unsupported sort keys
