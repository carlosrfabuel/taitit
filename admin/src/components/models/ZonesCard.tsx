import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FINISH_LABEL, MATERIAL_LABEL, swatchLabel, ZONE_ROLE_LABEL } from '../../lib/labels';
import { Button, Card, Spinner, Swatch } from '../ui';
import { publicUrl } from '../../lib/images';
import { modelKeys, reorder, saveOrder, type ModelRow } from '../../lib/models';
import { listZones, type ZoneRow } from '../../lib/zones';
import { listSwatches, swatchKeys } from '../../lib/swatches';
import { dbMessage } from '../../lib/errors';
import { ZoneDialog } from './ZoneDialog';
import { ZoneThumb } from './ZoneThumb';

export function ZonesCard({ model }: { model: ModelRow }) {
  const queryClient = useQueryClient();
  const zonesKey = modelKeys.zones(model.id);
  const zones = useQuery({ queryKey: zonesKey, queryFn: () => listZones(model.id) });
  const swatches = useQuery({ queryKey: swatchKeys.all, queryFn: listSwatches });
  const [editing, setEditing] = useState<ZoneRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: modelKeys.all });

  const move = useMutation({
    mutationFn: ({ before, after }: { before: ZoneRow[]; after: ZoneRow[] }) =>
      saveOrder('model_zones', before, after),
    onMutate: async ({ after }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: zonesKey });
      queryClient.setQueryData(zonesKey, after);
    },
    onError: (e) => setError(`Couldn't save the order. ${dbMessage(e)}`),
    onSettled: refresh,
  });

  const rows = zones.data ?? [];
  const swatchById = new Map((swatches.data ?? []).map((s) => [s.id, s]));

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-ink">
        Zones <span className="text-sm font-semibold text-muted">{rows.length}</span>
      </h2>
      {/* The zones' shapes are made and uploaded with the zone tool (tools/zones), not here (2026-10-23);
          here: their order in the app and their default colors. */}
      <p className="text-sm text-muted">
        Parts whose color the customer can change, in the order they appear in the app. Their shapes are made
        with the zone tool.
      </p>

      {zones.isPending || swatches.isPending ? (
        <Spinner />
      ) : zones.isError || swatches.isError ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-danger">Couldn't load the zones.</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void zones.refetch();
              void swatches.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">
          No zones yet
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((zone, i) => {
            const swatch = zone.default_swatch_id ? swatchById.get(zone.default_swatch_id) : undefined;
            const sizeMismatch =
              !!zone.layer_path &&
              (zone.layer_width !== model.base_width || zone.layer_height !== model.base_height);
            const arrow = (direction: -1 | 1, label: string, Icon: typeof ChevronUp) => (
              <button
                type="button"
                aria-label={`${label}: ${zone.name}`}
                disabled={i + direction < 0 || i + direction >= rows.length}
                aria-disabled={move.isPending || undefined}
                onClick={() => {
                  if (move.isPending) return;
                  move.mutate({ before: rows, after: reorder(rows, i, direction) });
                }}
                className="rounded p-1 text-muted hover:bg-bg hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent aria-disabled:opacity-50"
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
            return (
              <li key={zone.id} className="flex items-center gap-3 py-3">
                <div className="flex flex-col">
                  {arrow(-1, 'Move zone up', ChevronUp)}
                  {arrow(1, 'Move zone down', ChevronDown)}
                </div>
                <ZoneThumb
                  layerUrl={zone.layer_path ? publicUrl(zone.layer_path) : null}
                  color={swatch?.hex ?? null}
                  label={`Shape of zone ${zone.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {zone.name}
                    {zone.role ? (
                      <span className="ml-2 rounded-full bg-selected px-2 py-0.5 text-xs font-semibold text-on-selected">
                        {ZONE_ROLE_LABEL[zone.role]}
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-highlight px-2 py-0.5 text-xs font-semibold text-on-highlight">
                        No zone assigned
                      </span>
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                    {MATERIAL_LABEL[zone.material]} ·{' '}
                    {swatch ? (
                      <>
                        <Swatch hex={swatch.hex} alpha={swatch.alpha} title={swatch.name} size={16} />
                        {swatchLabel(swatch)}
                        {zone.default_finish && ` · ${FINISH_LABEL[zone.default_finish]}`}
                        {!swatch.active && ' (inactive color)'}
                      </>
                    ) : (
                      <span className="text-danger">no default color</span>
                    )}
                  </p>
                  {zone.pattern_hex && (
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      {zone.pattern_own ? (
                        <>
                          Tortoiseshell from the photo · average color
                          <Swatch hex={zone.pattern_hex} title={zone.pattern_hex} size={16} />
                          {zone.pattern_hex} (a havana of this color looks as in the photo)
                        </>
                      ) : (
                        "TAITIT's real tortoiseshell for havana colors"
                      )}
                    </p>
                  )}
                  {!zone.layer_path && <p className="text-sm text-danger">The layer is missing.</p>}
                  {sizeMismatch && (
                    <p className="text-sm text-danger">
                      The layer is {zone.layer_width} × {zone.layer_height} px and the base image is{' '}
                      {model.base_width} × {model.base_height} px.
                    </p>
                  )}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEditing(zone)}>
                  Edit
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {editing && zones.data && swatches.data && (
        <ZoneDialog
          key={editing.id}
          zone={editing}
          zones={zones.data}
          swatches={swatches.data}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
