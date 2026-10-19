import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw, Users, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, EmptyState, Spinner, Table, Tag, type Column } from '../components/ui';
import {
  customerKeys,
  listCustomers,
  setAccountStatus,
  STATUS_LABEL,
  type AccountStatus,
  type CustomerRow,
} from '../lib/customers';
import { dbMessage } from '../lib/errors';

const TABS: AccountStatus[] = ['pending', 'approved', 'rejected'];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

// Account approval (client decision 2026-10-19): new opticians can browse and save designs, but
// can only order once approved here. The database enforces it (create_order, order image upload).
export function CustomersPage() {
  const queryClient = useQueryClient();
  const customers = useQuery({ queryKey: customerKeys.all, queryFn: listCustomers });
  const [tab, setTab] = useState<AccountStatus>('pending');
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) => setAccountStatus(id, status),
    onMutate: () => setError(null),
    onError: (e) => setError(`No se pudo cambiar el estado. ${dbMessage(e)}`),
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
      key: 'name',
      header: 'Nombre',
      render: (row) => <span className="font-semibold text-ink">{row.full_name || '—'}</span>,
    },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    { key: 'created', header: 'Registro', render: (row) => formatDate(row.created_at) },
    {
      key: 'status',
      header: 'Estado',
      render: (row) =>
        row.status === 'approved' ? (
          <Tag tone="success">{STATUS_LABEL[row.status]}</Tag>
        ) : (
          <Tag>{STATUS_LABEL[row.status]}</Tag>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-64',
      render: (row) => (
        <div className="flex justify-end gap-2">
          {row.status !== 'approved' && action(row, 'approved', 'Aprobar', Check, 'primary')}
          {row.status !== 'rejected' && action(row, 'rejected', 'Rechazar', X, 'secondary')}
          {row.status !== 'pending' && action(row, 'pending', 'Pendiente', RotateCcw, 'ghost')}
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
              tab === s ? 'bg-brand text-white' : 'border border-line bg-surface text-ink hover:bg-bg'
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
      ) : customers.isError ? (
        <EmptyState
          title="No se pudieron cargar los clientes"
          message={dbMessage(customers.error)}
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
    </>
  );
}
