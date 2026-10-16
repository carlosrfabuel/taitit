import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Glasses, Plus } from 'lucide-react';
import { MAX_ZONES_PER_MODEL } from '@taitit/shared';
import { PageHeader } from '../components/PageHeader';
import { Button, EmptyState, Spinner, Table, Tag, type Column } from '../components/ui';
import { listModels, modelKeys, reorder, saveOrder, type ModelRow } from '../lib/models';
import { dbMessage } from '../lib/errors';
import { publicUrl } from '../lib/images';

export function ModelsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const models = useQuery({ queryKey: modelKeys.all, queryFn: listModels });
  const [orderError, setOrderError] = useState<string | null>(null);

  const move = useMutation({
    mutationFn: ({ before, after }: { before: ModelRow[]; after: ModelRow[] }) =>
      saveOrder('models', before, after),
    // Optimistic: the row moves at once; on failure the list goes back to what the database has.
    onMutate: async ({ after }) => {
      setOrderError(null);
      await queryClient.cancelQueries({ queryKey: modelKeys.all }); // a refetch in flight would undo the move
      queryClient.setQueryData(modelKeys.all, after);
    },
    onError: (error) => setOrderError(`No se pudo guardar el orden. ${dbMessage(error)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: modelKeys.all }),
  });

  const newButton = (
    <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => navigate('/models/new')}>
      Nuevo modelo
    </Button>
  );

  const rows = models.data ?? [];
  const columns: Column<ModelRow>[] = [
    {
      key: 'order',
      header: 'Orden',
      className: 'w-24',
      render: (row) => {
        const i = rows.indexOf(row);
        const arrow = (direction: -1 | 1, label: string, Icon: typeof ChevronUp) => (
          <button
            type="button"
            aria-label={`${label}: ${row.name}`}
            disabled={i + direction < 0 || i + direction >= rows.length}
            // aria-disabled while saving (not disabled), so keyboard focus stays on the button.
            aria-disabled={move.isPending || undefined}
            onClick={(e) => {
              e.stopPropagation(); // don't open the model
              if (move.isPending) return;
              move.mutate({ before: rows, after: reorder(rows, i, direction) });
            }}
            className="rounded p-1 text-muted hover:bg-bg hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent aria-disabled:opacity-50"
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
        return (
          <div className="flex items-center gap-0.5">
            {arrow(-1, 'Subir', ChevronUp)}
            {arrow(1, 'Bajar', ChevronDown)}
          </div>
        );
      },
    },
    {
      key: 'photo',
      header: 'Foto',
      className: 'w-28',
      render: (row) =>
        row.base_path ? (
          <img
            src={publicUrl(row.base_path)}
            alt=""
            loading="lazy"
            className="h-10 w-24 rounded bg-bg object-contain"
          />
        ) : (
          <span className="flex h-10 w-24 items-center justify-center rounded bg-bg text-xs text-muted">
            Sin foto
          </span>
        ),
    },
    {
      key: 'name',
      header: 'Nombre',
      render: (row) => (
        <div>
          {/* A real link too, so the row can be opened with the keyboard. */}
          <Link
            to={`/models/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-ink hover:underline"
          >
            {row.name}
          </Link>
          {row.size_ref && <p className="text-xs text-muted">{row.size_ref}</p>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categoría',
      render: (row) => row.category || <span className="text-muted">—</span>,
    },
    {
      key: 'zones',
      header: 'Zonas',
      render: (row) => (
        <span className={row.zones ? 'text-ink' : 'text-muted'}>
          {row.zones} / {MAX_ZONES_PER_MODEL}
        </span>
      ),
    },
    {
      key: 'published',
      header: 'Estado',
      render: (row) => (row.published ? <Tag tone="success">Publicado</Tag> : <Tag>Borrador</Tag>),
    },
  ];

  return (
    <>
      <PageHeader
        title="Modelos"
        note="Los modelos publicados aparecen en la app en este orden."
        actions={rows.length > 0 ? newButton : undefined}
      />
      {models.isPending ? (
        <Spinner />
      ) : models.isError ? (
        <EmptyState
          title="No se pudieron cargar los modelos"
          message={dbMessage(models.error)}
          action={<Button onClick={() => void models.refetch()}>Reintentar</Button>}
        />
      ) : (
        <>
          {orderError && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {orderError}
            </p>
          )}
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/models/${r.id}`)}
            empty={
              <EmptyState
                icon={<Glasses className="size-6" aria-hidden />}
                title="Aún no hay modelos"
                message="Crea el primer modelo; después podrás subir su imagen y sus zonas."
                action={newButton}
              />
            }
          />
        </>
      )}
    </>
  );
}
