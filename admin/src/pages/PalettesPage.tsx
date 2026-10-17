import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Palette, Plus } from 'lucide-react';
import type { Material } from '@taitit/shared';
import { PageHeader } from '../components/PageHeader';
import { Button, EmptyState, Spinner, Swatch, Table, Tag, type Column } from '../components/ui';
import { SwatchDialog } from '../components/palettes/SwatchDialog';
import { listSwatches, swatchKeys, textureUrl, type SwatchRow } from '../lib/swatches';
import { reorder, saveOrder } from '../lib/models';
import { dbMessage } from '../lib/errors';
import { FINISH_LABEL, KIND_LABEL, MATERIAL_LABEL } from '../lib/labels';

const TABS: Material[] = ['metal', 'acetate'];

export function PalettesPage() {
  const queryClient = useQueryClient();
  const swatches = useQuery({ queryKey: swatchKeys.all, queryFn: listSwatches });
  const [tab, setTab] = useState<Material>('metal');
  const [editing, setEditing] = useState<SwatchRow | 'new' | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const all = swatches.data ?? [];
  const rows = all.filter((s) => s.material === tab).sort((a, b) => a.sort_order - b.sort_order);

  const move = useMutation({
    mutationFn: ({ before, after }: { before: SwatchRow[]; after: SwatchRow[] }) =>
      saveOrder('swatches', before, after),
    onMutate: async ({ after }) => {
      setOrderError(null);
      await queryClient.cancelQueries({ queryKey: swatchKeys.all });
      const byId = new Map(after.map((s) => [s.id, s]));
      queryClient.setQueryData<SwatchRow[]>(swatchKeys.all, (old) => old?.map((s) => byId.get(s.id) ?? s));
    },
    onError: (e) => setOrderError(`No se pudo guardar el orden. ${dbMessage(e)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: swatchKeys.all }),
  });

  const columns: Column<SwatchRow>[] = [
    {
      key: 'order',
      header: 'Orden',
      className: 'w-20',
      render: (row) => {
        const i = rows.indexOf(row);
        const arrow = (direction: -1 | 1, label: string, Icon: typeof ChevronUp) => (
          <button
            type="button"
            aria-label={`${label}: ${row.name}`}
            disabled={i + direction < 0 || i + direction >= rows.length}
            aria-disabled={move.isPending || undefined}
            onClick={(e) => {
              e.stopPropagation();
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
      key: 'swatch',
      header: 'Muestra',
      className: 'w-20',
      render: (row) => (
        <Swatch
          hex={row.hex}
          alpha={row.kind === 'translucent' ? row.alpha : null}
          textureUrl={row.kind === 'havana' ? textureUrl(row) : null}
          title={row.name}
        />
      ),
    },
    {
      key: 'name',
      header: 'Nombre',
      render: (row) => (
        <button
          type="button"
          className="font-semibold text-ink hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(row);
          }}
        >
          {row.name}
        </button>
      ),
    },
    { key: 'hex', header: 'HEX', render: (row) => <span className="font-mono text-xs">{row.hex}</span> },
    { key: 'ref', header: 'Referencia', render: (row) => row.ref },
    {
      key: 'kind',
      header: 'Tipo',
      render: (row) =>
        row.kind === 'translucent' && row.alpha != null
          ? `${KIND_LABEL[row.kind]} · ${Math.round(row.alpha * 100)} %`
          : row.kind === 'havana' && !row.texture_path
            ? `${KIND_LABEL[row.kind]} · sin textura`
            : KIND_LABEL[row.kind],
    },
    ...(tab === 'metal'
      ? [
          {
            key: 'finishes',
            header: 'Acabados',
            render: (row: SwatchRow) => row.finishes.map((f) => FINISH_LABEL[f]).join(' · ') || '—',
          },
        ]
      : []),
    {
      key: 'active',
      header: 'Estado',
      render: (row) => (row.active ? <Tag tone="success">Activo</Tag> : <Tag>Inactivo</Tag>),
    },
  ];

  return (
    <>
      <PageHeader
        title="Paletas"
        note="Colores que el cliente puede elegir en la app, en este orden. Los nombres se escriben en inglés."
        actions={
          <Button
            icon={<Plus className="size-4" aria-hidden />}
            disabled={!swatches.data}
            onClick={() => setEditing('new')}
          >
            Nuevo color
          </Button>
        }
      />
      <div role="tablist" aria-label="Material" className="mb-4 flex gap-2">
        {TABS.map((m) => {
          const count = all.filter((s) => s.material === m).length;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={tab === m}
              onClick={() => setTab(m)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                tab === m ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink hover:bg-bg'
              }`}
            >
              {MATERIAL_LABEL[m]} <span className={tab === m ? 'text-white/70' : 'text-muted'}>{count}</span>
            </button>
          );
        })}
      </div>
      {swatches.isPending ? (
        <Spinner />
      ) : swatches.isError ? (
        <EmptyState
          title="No se pudieron cargar los colores"
          message={dbMessage(swatches.error)}
          action={<Button onClick={() => void swatches.refetch()}>Reintentar</Button>}
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
            onRowClick={(r) => setEditing(r)}
            empty={
              <EmptyState
                icon={<Palette className="size-6" aria-hidden />}
                title={`Aún no hay colores de ${MATERIAL_LABEL[tab].toLowerCase()}`}
                action={<Button onClick={() => setEditing('new')}>Nuevo color</Button>}
              />
            }
          />
        </>
      )}
      {editing && swatches.data && (
        <SwatchDialog
          key={editing === 'new' ? `new-${tab}` : editing.id}
          swatch={editing === 'new' ? null : editing}
          material={tab}
          swatches={swatches.data}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
