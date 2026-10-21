import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Glasses, Plus } from 'lucide-react';
import { MAX_ZONES_PER_MODEL } from '@taitit/shared';
import { PageHeader } from '../components/PageHeader';
import { Button, EmptyState, Spinner, Table, Tag, type Column } from '../components/ui';
import { listModels, modelKeys, type ModelRow } from '../lib/models';
import { readMessage } from '../lib/errors';
import { publicUrl } from '../lib/images';

export function ModelsPage() {
  const navigate = useNavigate();
  const models = useQuery({ queryKey: modelKeys.all, queryFn: listModels });
  const newButton = (
    <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => navigate('/models/new')}>
      Nuevo modelo
    </Button>
  );

  const rows = models.data ?? [];
  const columns: Column<ModelRow>[] = [
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
        note="Los modelos publicados aparecen en la app por orden alfabético."
        actions={rows.length > 0 ? newButton : undefined}
      />
      {models.isPending ? (
        <Spinner />
      ) : models.isError && !models.data ? (
        <EmptyState
          title="No se pudieron cargar los modelos"
          message={readMessage(models.error)}
          action={<Button onClick={() => void models.refetch()}>Reintentar</Button>}
        />
      ) : (
        <>
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
