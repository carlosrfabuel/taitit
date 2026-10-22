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
      New model
    </Button>
  );

  const rows = models.data ?? [];
  const columns: Column<ModelRow>[] = [
    {
      key: 'photo',
      header: 'Photo',
      className: 'w-28',
      // The catalog thumbnail (the frame in its default colors). The base image alone is nearly white:
      // its colored parts are blanked out for the layers drawn on top.
      render: (row) =>
        row.thumb_path || row.base_path ? (
          <img
            src={publicUrl((row.thumb_path ?? row.base_path)!)}
            alt=""
            loading="lazy"
            className="h-10 w-24 rounded bg-bg object-contain"
          />
        ) : (
          <span className="flex h-10 w-24 items-center justify-center rounded bg-bg text-xs text-muted">
            No photo
          </span>
        ),
    },
    {
      key: 'name',
      header: 'Name',
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
      header: 'Category',
      render: (row) => row.category || <span className="text-muted">—</span>,
    },
    {
      key: 'zones',
      header: 'Zones',
      render: (row) => (
        <span className={row.zones ? 'text-ink' : 'text-muted'}>
          {row.zones} / {MAX_ZONES_PER_MODEL}
        </span>
      ),
    },
    {
      key: 'published',
      header: 'Status',
      render: (row) => (row.published ? <Tag tone="success">Published</Tag> : <Tag>Draft</Tag>),
    },
  ];

  return (
    <>
      <PageHeader
        title="Models"
        note="Published models appear in the app in alphabetical order."
        actions={rows.length > 0 ? newButton : undefined}
      />
      {models.isPending ? (
        <Spinner />
      ) : models.isError && !models.data ? (
        <EmptyState
          title="Couldn't load the models"
          message={readMessage(models.error)}
          action={<Button onClick={() => void models.refetch()}>Try again</Button>}
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
                title="No models yet"
                message="Create the first model; you can then upload its image and its zones."
                action={newButton}
              />
            }
          />
        </>
      )}
    </>
  );
}
