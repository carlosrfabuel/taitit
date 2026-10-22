import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw, Search, Trash2, Users, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, EmptyState, Input, Modal, Spinner, Table, Tag, type Column } from '../components/ui';
import {
  addressLine,
  deleteCustomerAccount,
  customerKeys,
  listCustomers,
  setAccountStatus,
  STATUS_LABEL,
  type AccountStatus,
  type CustomerRow,
} from '../lib/customers';
import { dbMessage, readMessage } from '../lib/errors';
import { fold } from '../lib/text';

const TABS: AccountStatus[] = ['pending', 'approved', 'rejected'];

/** The account's business, legal name, contact, emails, CIF or city contain the search. */
const matches = (c: CustomerRow, query: string) => {
  const q = fold(query.trim());
  return (
    !q ||
    [c.business_name, c.legal_name, c.full_name, c.email, c.contact_email, c.tax_id, c.city].some(
      (v) => v && fold(v).includes(q),
    )
  );
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Account approval (client decision 2026-10-19): new opticians can browse and save designs, but
// can only order once approved here. The database enforces it (create_order, order image upload).
export function CustomersPage() {
  const queryClient = useQueryClient();
  const customers = useQuery({ queryKey: customerKeys.all, queryFn: listCustomers, refetchInterval: 60_000 }); // like the badge
  const [tab, setTab] = useState<AccountStatus>('pending');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) => setAccountStatus(id, status),
    onMutate: () => setError(null),
    onError: (e) => setError(`Couldn't change the status. ${dbMessage(e)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });

  // Deleting an account on the customer's request (the public /account-deletion page offers it by email).
  const [toDelete, setToDelete] = useState<CustomerRow | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => deleteCustomerAccount(id),
    onSuccess: () => setToDelete(null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });

  const all = (customers.data ?? []).filter((c) => matches(c, query));
  const rows = all.filter((c) => c.status === tab);
  const count = (s: AccountStatus) => all.filter((c) => c.status === s).length;
  const busy = (id: string) => change.isPending && change.variables?.id === id;

  const action = (
    row: CustomerRow,
    status: AccountStatus,
    label: string,
    Icon: typeof Check,
    variant: 'primary' | 'secondary' | 'ghost',
  ) => (
    <Button
      size="sm"
      variant={variant}
      icon={<Icon className="size-4" aria-hidden />}
      disabled={change.isPending}
      loading={busy(row.id) && change.variables?.status === status}
      onClick={() => change.mutate({ id: row.id, status })}
      aria-label={`${label}: ${row.email ?? row.full_name ?? 'customer'}`}
    >
      {label}
    </Button>
  );

  const columns: Column<CustomerRow>[] = [
    {
      key: 'business',
      header: 'Optician',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{row.business_name || 'No company details'}</span>
          {row.legal_name && row.legal_name !== row.business_name && (
            <span className="text-xs text-muted">{row.legal_name}</span>
          )}
          {row.tax_id && <span className="text-xs text-muted">VAT number {row.tax_id}</span>}
          {row.labeling && <span className="text-xs text-muted">Name on the glasses: {row.labeling}</span>}
          {row.bank_account && <span className="text-xs text-muted">Account: {row.bank_account}</span>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (row) => (
        <div className="flex flex-col">
          <span>{row.full_name || '—'}</span>
          <span className="text-xs text-muted">{row.email ?? '—'}</span>
          {row.phone && <span className="text-xs text-muted">{row.phone}</span>}
          {row.contact_email && row.contact_email !== row.email && (
            <span className="text-xs text-muted">Contact: {row.contact_email}</span>
          )}
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Address',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm">
            {addressLine(row.address, row.postal_code, row.city, row.province) ?? '—'}
          </span>
          {row.delivery_address && (
            <span className="text-xs text-muted">
              Delivery:{' '}
              {addressLine(
                row.delivery_address,
                row.delivery_postal_code,
                row.delivery_city,
                row.delivery_province,
              )}
            </span>
          )}
          {row.commercial_address && (
            <span className="text-xs text-muted">
              Commercial:{' '}
              {addressLine(
                row.commercial_address,
                row.commercial_postal_code,
                row.commercial_city,
                row.commercial_province,
              )}
            </span>
          )}
        </div>
      ),
    },
    { key: 'created', header: 'Signed up', render: (row) => formatDate(row.created_at) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Tag
          tone={row.status === 'approved' ? 'success' : row.status === 'pending' ? 'attention' : 'neutral'}
        >
          {STATUS_LABEL[row.status]}
        </Tag>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-72',
      render: (row) => (
        <div className="flex justify-end gap-2">
          {row.status !== 'approved' && action(row, 'approved', 'Approve', Check, 'primary')}
          {row.status !== 'rejected' && action(row, 'rejected', 'Reject', X, 'secondary')}
          {row.status !== 'pending' && action(row, 'pending', 'Pending', RotateCcw, 'ghost')}
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="size-4" aria-hidden />}
            disabled={change.isPending || remove.isPending}
            onClick={() => {
              remove.reset();
              setToDelete(row);
            }}
            aria-label={`Delete account: ${row.email ?? row.full_name ?? 'customer'}`}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        note="Opticians sign up in the app and can only send orders once you approve them here. Until then they can browse the catalog and save designs."
      />
      <div className="relative mb-4 w-full max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search optician, contact, email, VAT number or city"
          aria-label="Search customers"
          className="pl-9"
        />
      </div>
      <div role="tablist" aria-label="Status" className="mb-4 flex gap-2">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === s
                ? 'border border-selected-line bg-selected text-on-selected'
                : 'border border-line bg-surface text-ink hover:bg-bg'
            }`}
          >
            {s === 'pending' ? 'Pending' : s === 'approved' ? 'Approved' : 'Rejected'} ({count(s)})
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}
      {customers.isPending ? (
        <Spinner />
      ) : customers.isError && !customers.data ? (
        <EmptyState
          title="Couldn't load the customers"
          message={readMessage(customers.error)}
          action={<Button onClick={() => void customers.refetch()}>Try again</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={<Users className="size-6" aria-hidden />}
              title={
                query.trim()
                  ? 'No accounts match'
                  : tab === 'pending'
                    ? 'No pending accounts'
                    : 'No accounts in this list'
              }
              message={
                query.trim()
                  ? 'Try another search or check the other tabs.'
                  : tab === 'pending'
                    ? 'New opticians will appear here when they sign up.'
                    : undefined
              }
            />
          }
        />
      )}
      <Modal
        open={!!toDelete}
        title="Delete account"
        onClose={() => !remove.isPending && setToDelete(null)}
        dismissible={!remove.isPending}
        footer={
          <>
            <Button variant="secondary" disabled={remove.isPending} onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => toDelete && remove.mutate(toDelete.id)}
            >
              Delete account
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Delete the account of{' '}
            <span className="font-semibold">
              {toDelete?.business_name || toDelete?.full_name || 'this customer'}
            </span>
            {toDelete?.email ? ` (${toDelete.email})` : ''}? Only do this if the customer has asked for it.
          </p>
          <p className="text-muted">
            This deletes the account, the company details and the saved designs. Their orders are kept, with
            the name and email they were sent with. This can't be undone.
          </p>
          {remove.isError && (
            <p role="alert" className="text-danger">
              Couldn't delete. {dbMessage(remove.error)}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
