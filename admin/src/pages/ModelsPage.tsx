import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Glasses, LayoutGrid, List, Pencil, Plus } from 'lucide-react';
import { MAX_ZONES_PER_MODEL, type ZoneRole } from '@taitit/shared';
import { PageHeader } from '../components/PageHeader';
import { Button, EmptyState, Spinner, Swatch, Table, Tag, type Column } from '../components/ui';
import { ModelThumb } from '../components/ModelThumb';
import { listModels, modelKeys, type ModelRow } from '../lib/models';
import { readMessage } from '../lib/errors';
import { publicUrl } from '../lib/images';
import { listAllZones } from '../lib/zones';
import { listSwatches, swatchKeys, textureUrl, type SwatchRow } from '../lib/swatches';
import { swatchLabel } from '../lib/labels';

const ROLE_ORDER: ZoneRole[] = ['main', 'secondary', 'tips'];
const VIEW_KEY = 'taitit.admin.modelsView';

/** Grid or list, remembered in this browser (a convenience: missing storage just means grid). */
function initialView(): 'grid' | 'list' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function ModelsPage() {
  const navigate = useNavigate();
  const models = useQuery({ queryKey: modelKeys.all, queryFn: listModels });
  const zones = useQuery({ queryKey: modelKeys.allZones, queryFn: listAllZones });
  const swatches = useQuery({ queryKey: swatchKeys.all, queryFn: listSwatches });
  const [view, setView] = useState(initialView);
  const chooseView = (v: 'grid' | 'list') => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // storage unavailable: the choice lasts this visit only
    }
  };

  // Each model's default colors in part order (main, secondary front, tips), for the cards.
  const byId = new Map((swatches.data ?? []).map((sw) => [sw.id, sw]));
  const dots = (modelId: string): SwatchRow[] =>
    (zones.data ?? [])
      .filter((z) => z.model_id === modelId)
      .sort((a, b) => ROLE_ORDER.indexOf(a.role ?? 'tips') - ROLE_ORDER.indexOf(b.role ?? 'tips'))
      .map((z) => (z.default_swatch_id ? byId.get(z.default_swatch_id) : undefined))
      .filter((sw): sw is SwatchRow => !!sw);
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

  const toggle = (
    <div role="group" aria-label="View" className="flex rounded-full border border-line bg-surface p-1">
      {(
        [
          ['grid', 'Grid view', LayoutGrid],
          ['list', 'List view', List],
        ] as const
      ).map(([v, label, Icon]) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          aria-label={label}
          title={label}
          onClick={() => chooseView(v)}
          className={`rounded-full p-1.5 ${view === v ? 'bg-selected text-on-selected' : 'text-muted hover:text-ink'}`}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Models' }]}
        title="Models"
        note="Published models appear in the app in alphabetical order."
        actions={
          rows.length > 0 ? (
            <>
              {toggle}
              {newButton}
            </>
          ) : undefined
        }
      />
      {models.isPending ? (
        <Spinner />
      ) : models.isError && !models.data ? (
        <EmptyState
          title="Couldn't load the models"
          message={readMessage(models.error)}
          action={<Button onClick={() => void models.refetch()}>Try again</Button>}
        />
      ) : view === 'grid' && rows.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((m) => (
            <article
              key={m.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-selected-line hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                {m.published ? <Tag tone="success">Published</Tag> : <Tag>Draft</Tag>}
                <span className="text-xs text-muted">
                  {m.zones} / {MAX_ZONES_PER_MODEL} zones
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/models/${m.id}`)}
                aria-label={`Edit ${m.name}`}
                className="rounded-xl"
              >
                <ModelThumb model={m} className="aspect-[16/7] w-full" />
              </button>
              <div>
                <p className="font-semibold text-ink">{m.name}</p>
                <p className="text-xs text-muted">
                  {[m.category, m.size_ref].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex min-h-5 items-center gap-1.5">
                {dots(m.id).map((sw, i) => (
                  <Swatch
                    key={`${sw.id}-${i}`}
                    hex={sw.hex}
                    alpha={sw.kind === 'translucent' ? sw.alpha : null}
                    textureUrl={sw.texture_path ? textureUrl(sw) : null}
                    title={swatchLabel(sw)}
                    size={18}
                  />
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={() => navigate(`/models/${m.id}`)}
              >
                Edit
              </Button>
            </article>
          ))}
        </div>
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
