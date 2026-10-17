import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { buildRenderPlan, renderKey, type Finish, type RenderPick } from '@taitit/shared';
import { Button, Card, Select, Spinner } from '../ui';
import { publicUrl } from '../../lib/images';
import { modelKeys, type ModelRow } from '../../lib/models';
import { listZones } from '../../lib/zones';
import { listSwatches, swatchKeys, toRenderSwatch } from '../../lib/swatches';
import { drawPlan } from '../../lib/render';
import { saveThumbnail } from '../../lib/thumbnails';
import { FINISH_LABEL } from '../../lib/labels';

/**
 * Live recolor of the model with the same recipe as the app. Starts with each zone's default color;
 * the pickers below try other colors here only (nothing is saved).
 */
export function PreviewCard({ model }: { model: ModelRow }) {
  const zones = useQuery({ queryKey: modelKeys.zones(model.id), queryFn: () => listZones(model.id) });
  const swatches = useQuery({ queryKey: swatchKeys.all, queryFn: listSwatches });
  const [picks, setPicks] = useState<Record<string, RenderPick>>({});
  const [state, setState] = useState<'idle' | 'drawing' | 'error'>('idle');
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef(0);

  const size =
    model.base_width && model.base_height ? { width: model.base_width, height: model.base_height } : null;

  const { id: modelId, base_path, base_width, base_height, thumb_key } = model;
  const queryClient = useQueryClient();
  const savingThumb = useRef(false);
  useEffect(() => {
    if (!base_path || !base_width || !base_height || !zones.data || !swatches.data || !canvas.current) return;
    const plan = buildRenderPlan({
      baseUrl: publicUrl(base_path),
      width: base_width,
      height: base_height,
      zones: zones.data.map((z) => ({
        id: z.id,
        layerUrl: z.layer_path ? publicUrl(z.layer_path) : null,
        defaultSwatchId: z.default_swatch_id,
        defaultFinish: z.default_finish,
        sortOrder: z.sort_order,
      })),
      swatches: swatches.data.map(toRenderSwatch),
      picks,
    });
    const id = ++run.current; // only the latest render may update the state
    setState('drawing');
    const target = canvas.current;
    drawPlan(target, plan).then(
      () => {
        if (id !== run.current) return;
        setState('idle');
        // The default colors are also the catalog thumbnail: refresh it when what it shows changed.
        const key = renderKey(plan);
        if (Object.keys(picks).length === 0 && key !== thumb_key && !savingThumb.current) {
          savingThumb.current = true;
          saveThumbnail({ id: modelId }, target, key)
            .then(() => queryClient.invalidateQueries({ queryKey: modelKeys.all }))
            .catch(() => {}) // best effort: the app renders live while there is no current thumbnail
            .finally(() => (savingThumb.current = false));
        }
      },
      () => id === run.current && setState('error'),
    );
  }, [base_path, base_width, base_height, zones.data, swatches.data, picks, thumb_key, modelId, queryClient]);

  const zoneRows = zones.data ?? [];
  const all = swatches.data ?? [];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Vista previa</h2>
        {Object.keys(picks).length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw className="size-4" aria-hidden />}
            onClick={() => setPicks({})}
          >
            Colores por defecto
          </Button>
        )}
      </div>
      {!model.base_path || !size ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">
          Sube la imagen base para ver la vista previa.
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvas}
            role="img"
            aria-label={`Vista previa de ${model.name}`}
            className="h-auto w-full rounded-lg bg-bg"
            style={{ aspectRatio: `${size.width} / ${size.height}` }}
          />
          {state === 'drawing' && (
            <div className="absolute top-2 right-2">
              <Spinner label="" />
            </div>
          )}
        </div>
      )}
      {state === 'error' && (
        <p role="alert" className="text-sm text-danger">
          No se pudieron cargar las imágenes de la vista previa.
        </p>
      )}
      {(zones.isPending || swatches.isPending) && <Spinner />}
      {zoneRows.length > 0 && all.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {zoneRows.map((z) => {
            const pick = picks[z.id];
            const swatchId = pick?.swatchId ?? z.default_swatch_id ?? '';
            const swatch = all.find((s) => s.id === swatchId);
            const options = all.filter((s) => s.material === z.material && (s.active || s.id === swatchId));
            const finish = pick?.finish ?? z.default_finish;
            return (
              <div key={z.id} className="flex flex-col gap-2">
                <Select
                  label={`Probar color: ${z.name}`}
                  value={swatchId}
                  options={[
                    { value: '', label: '— Sin color —' },
                    ...options.map((s) => ({ value: s.id, label: `${s.name} · ${s.ref}` })),
                  ]}
                  onChange={(e) =>
                    setPicks((p) => ({ ...p, [z.id]: { swatchId: e.target.value || null, finish } }))
                  }
                />
                {swatch && swatch.finishes.length > 0 && (
                  <Select
                    label={`Acabado: ${z.name}`}
                    value={finish && swatch.finishes.includes(finish) ? finish : swatch.finishes[0]!}
                    options={swatch.finishes.map((f) => ({ value: f, label: FINISH_LABEL[f] }))}
                    onChange={(e) =>
                      setPicks((p) => ({ ...p, [z.id]: { swatchId, finish: e.target.value as Finish } }))
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted">Los colores que pruebes aquí no se guardan.</p>
    </Card>
  );
}
