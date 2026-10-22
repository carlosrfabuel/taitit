import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Palette, Plus } from 'lucide-react';
import type { Material } from '@taitit/shared';
import { PageHeader } from '../components/PageHeader';
import { Button, EmptyState, Spinner, Swatch, Table, Tag, type Column } from '../components/ui';
import { SwatchDialog } from '../components/palettes/SwatchDialog';
import { listSwatches, swatchKeys, textureUrl, type SwatchRow } from '../lib/swatches';
import { reorder, saveOrder } from '../lib/models';
import { dbMessage, readMessage } from '../lib/errors';
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
    onError: (e) => setOrderError(`Couldn't save the order. ${dbMessage(e)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: swatchKeys.all }),
  });

  const columns: Column<SwatchRow>[] = [
    {
      key: 'order',
      header: 'Order',
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
            {arrow(-1, 'Move up', ChevronUp)}
            {arrow(1, 'Move down', ChevronDown)}
          </div>
        );
      },
    },
    {
      key: 'swatch',
      header: 'Swatch',
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
      header: 'Name',
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
    { key: 'ref', header: 'Reference', render: (row) => row.ref },
    {
      key: 'kind',
      header: 'Type',
      render: (row) =>
        row.kind === 'translucent' && row.alpha != null
          ? `${KIND_LABEL[row.kind]} · ${Math.round(row.alpha * 100)}%`
          : row.kind === 'havana' && !row.texture_path
            ? `${KIND_LABEL[row.kind]} · no texture`
            : KIND_LABEL[row.kind],
    },
    ...(tab === 'metal'
      ? [
          {
            key: 'finishes',
            header: 'Finishes',
            render: (row: SwatchRow) => row.finishes.map((f) => FINISH_LABEL[f]).join(' · ') || '—',
          },
        ]
      : []),
    {
      key: 'active',
      header: 'Status',
      render: (row) => (row.active ? <Tag tone="success">Active</Tag> : <Tag>Inactive</Tag>),
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Palettes' }]}
        title="Palettes"
        note="Colors the customer can choose in the app, in this order. Names are written in English."
        actions={
          <Button
            icon={<Plus className="size-4" aria-hidden />}
            disabled={!swatches.data}
            onClick={() => setEditing('new')}
          >
            New color
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
                tab === m
                  ? 'border-selected-line bg-selected text-on-selected'
                  : 'border-line bg-surface text-ink hover:bg-bg'
              }`}
            >
              {MATERIAL_LABEL[m]}{' '}
              <span className={tab === m ? 'text-on-selected/70' : 'text-muted'}>{count}</span>
            </button>
          );
        })}
      </div>
      {swatches.isPending ? (
        <Spinner />
      ) : swatches.isError && !swatches.data ? (
        <EmptyState
          title="Couldn't load the colors"
          message={readMessage(swatches.error)}
          action={<Button onClick={() => void swatches.refetch()}>Try again</Button>}
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
                title={`No ${MATERIAL_LABEL[tab].toLowerCase()} colors yet`}
                action={<Button onClick={() => setEditing('new')}>New color</Button>}
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
