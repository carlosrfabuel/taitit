import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw, Trash2, Users, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, EmptyState, Modal, Spinner, Table, Tag, type Column } from '../components/ui';
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

const TABS: AccountStatus[] = ['pending', 'approved', 'rejected'];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

// Account approval (client decision 2026-10-19): new opticians can browse and save designs, but
// can only order once approved here. The database enforces it (create_order, order image upload).
export function CustomersPage() {
  const queryClient = useQueryClient();
  const customers = useQuery({ queryKey: customerKeys.all, queryFn: listCustomers, refetchInterval: 60_000 }); // like the badge
  const [tab, setTab] = useState<AccountStatus>('pending');
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) => setAccountStatus(id, status),
    onMutate: () => setError(null),
    onError: (e) => setError(`No se pudo cambiar el estado. ${dbMessage(e)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });

  // Deleting an account on the customer's request (the public /account-deletion page offers it by email).
  const [toDelete, setToDelete] = useState<CustomerRow | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => deleteCustomerAccount(id),
    onSuccess: () => setToDelete(null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });

  const all = customers.data ?? [];
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
      aria-label={`${label}: ${row.email ?? row.full_name ?? 'cliente'}`}
    >
      {label}
    </Button>
  );

  const columns: Column<CustomerRow>[] = [
    {
      key: 'business',
      header: 'Óptica',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{row.business_name || 'Sin datos de empresa'}</span>
          {row.legal_name && row.legal_name !== row.business_name && (
            <span className="text-xs text-muted">{row.legal_name}</span>
          )}
          {row.tax_id && <span className="text-xs text-muted">CIF/NIF {row.tax_id}</span>}
          {row.labeling && <span className="text-xs text-muted">Nombre en las gafas: {row.labeling}</span>}
          {row.bank_account && <span className="text-xs text-muted">Cuenta: {row.bank_account}</span>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contacto',
      render: (row) => (
        <div className="flex flex-col">
          <span>{row.full_name || '—'}</span>
          <span className="text-xs text-muted">{row.email ?? '—'}</span>
          {row.phone && <span className="text-xs text-muted">{row.phone}</span>}
          {row.contact_email && row.contact_email !== row.email && (
            <span className="text-xs text-muted">Contacto: {row.contact_email}</span>
          )}
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Dirección',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm">
            {addressLine(row.address, row.postal_code, row.city, row.province) ?? '—'}
          </span>
          {row.delivery_address && (
            <span className="text-xs text-muted">
              Entrega:{' '}
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
              Comercial:{' '}
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
    { key: 'created', header: 'Registro', render: (row) => formatDate(row.created_at) },
    {
      key: 'status',
      header: 'Estado',
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
          {row.status !== 'approved' && action(row, 'approved', 'Aprobar', Check, 'primary')}
          {row.status !== 'rejected' && action(row, 'rejected', 'Rechazar', X, 'secondary')}
          {row.status !== 'pending' && action(row, 'pending', 'Pendiente', RotateCcw, 'ghost')}
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="size-4" aria-hidden />}
            disabled={change.isPending || remove.isPending}
            onClick={() => {
              remove.reset();
              setToDelete(row);
            }}
            aria-label={`Eliminar cuenta: ${row.email ?? row.full_name ?? 'cliente'}`}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Clientes"
        note="Las ópticas se registran en la app y solo pueden enviar pedidos cuando las apruebas aquí. Mientras tanto pueden ver el catálogo y guardar diseños."
      />
      <div role="tablist" aria-label="Estado" className="mb-4 flex gap-2">
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
            {s === 'pending' ? 'Pendientes' : s === 'approved' ? 'Aprobados' : 'Rechazados'} ({count(s)})
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
          title="No se pudieron cargar los clientes"
          message={readMessage(customers.error)}
          action={<Button onClick={() => void customers.refetch()}>Reintentar</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={<Users className="size-6" aria-hidden />}
              title={tab === 'pending' ? 'No hay cuentas pendientes' : 'No hay cuentas en esta lista'}
              message={tab === 'pending' ? 'Las nuevas ópticas aparecerán aquí al registrarse.' : undefined}
            />
          }
        />
      )}
      <Modal
        open={!!toDelete}
        title="Eliminar cuenta"
        onClose={() => !remove.isPending && setToDelete(null)}
        dismissible={!remove.isPending}
        footer={
          <>
            <Button variant="secondary" disabled={remove.isPending} onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => toDelete && remove.mutate(toDelete.id)}
            >
              Eliminar cuenta
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            ¿Eliminar la cuenta de{' '}
            <span className="font-semibold">
              {toDelete?.business_name || toDelete?.full_name || 'este cliente'}
            </span>
            {toDelete?.email ? ` (${toDelete.email})` : ''}? Hazlo solo si el cliente lo ha pedido.
          </p>
          <p className="text-muted">
            Se borran la cuenta, los datos de empresa y los diseños guardados. Sus pedidos se conservan, con
            el nombre y el email con los que se enviaron. No se puede deshacer.
          </p>
          {remove.isError && (
            <p role="alert" className="text-danger">
              No se pudo eliminar. {dbMessage(remove.error)}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
