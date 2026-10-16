import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Finish, type Material } from '@taitit/shared';
import { FINISH_LABEL, MATERIAL_LABEL } from '../../lib/labels';
import { Button, Input, Modal, Select, Swatch } from '../ui';
import { checkLayer, publicUrl, type Size } from '../../lib/images';
import { modelKeys, type ModelRow } from '../../lib/models';
import { ZONE_NAME_MAX, saveZone, type ZoneRow } from '../../lib/zones';
import type { SwatchRow } from '../../lib/swatches';
import { dbMessage } from '../../lib/errors';
import { ZoneThumb } from './ZoneThumb';

type Props = {
  model: ModelRow;
  /** null = new zone */
  zone: ZoneRow | null;
  zones: ZoneRow[];
  swatches: SwatchRow[];
  onClose: () => void;
};

const MATERIALS: Material[] = ['metal', 'acetate'];

export function ZoneDialog({ model, zone, zones, swatches, onClose }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(zone?.name ?? '');
  const [material, setMaterial] = useState<Material>(zone?.material ?? 'acetate');
  const [swatchId, setSwatchId] = useState<string | null>(zone?.default_swatch_id ?? null);
  const [finish, setFinish] = useState<Finish | null>(zone?.default_finish ?? null);
  // Only the latest picked file counts (an earlier, slower check must not overwrite it).
  const pick = useRef(0);
  const [layer, setLayer] = useState<{ file: File; size: Size; url: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; layer?: string }>({});

  // Free the local preview of a picked layer.
  useEffect(() => () => void (layer && URL.revokeObjectURL(layer.url)), [layer]);

  // Active colors of this material; keep the current default visible even if it was deactivated.
  const options = swatches.filter(
    (s) => s.material === material && (s.active || s.id === zone?.default_swatch_id),
  );
  const swatch = swatches.find((s) => s.id === swatchId) ?? null;
  const finishes = swatch?.finishes ?? [];
  // What is shown is what is saved: a stored finish the color doesn't offer becomes its first one.
  const shownFinish = finishes.length ? (finish && finishes.includes(finish) ? finish : finishes[0]!) : null;

  const base: Size | null =
    model.base_width && model.base_height ? { width: model.base_width, height: model.base_height } : null;

  const save = useMutation({
    mutationFn: () =>
      saveZone(
        model.id,
        zone,
        { name, material, default_swatch_id: swatchId, default_finish: shownFinish },
        layer && { file: layer.file, size: layer.size },
        Math.max(-1, ...zones.map((z) => z.sort_order)) + 1,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: modelKeys.all });
      onClose();
    },
  });

  const pickLayer = async (file: File) => {
    const id = ++pick.current;
    setChecking(true);
    const checked = await checkLayer(file, base);
    if (id !== pick.current) return; // a newer file was picked meanwhile
    setChecking(false);
    if ('error' in checked) {
      setErrors((e) => ({ ...e, layer: checked.error }));
      return;
    }
    setErrors((e) => ({ ...e, layer: undefined }));
    setLayer({ file, size: checked.size, url: URL.createObjectURL(file) });
  };

  const pickSwatch = (id: string | null) => {
    setSwatchId(id);
    const s = swatches.find((x) => x.id === id);
    // Keep the chosen finish if the new color offers it, else its first one.
    setFinish(s?.finishes.length ? (s.finishes.includes(finish!) ? finish : s.finishes[0]!) : null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending || checking) return;
    const trimmed = name.trim();
    const duplicate = zones.some((z) => z.id !== zone?.id && z.name.toLowerCase() === trimmed.toLowerCase());
    const next = {
      name: !trimmed
        ? 'Introduce el nombre de la zona.'
        : trimmed.length > ZONE_NAME_MAX
          ? `Máximo ${ZONE_NAME_MAX} caracteres.`
          : duplicate
            ? 'Ya hay una zona con ese nombre en este modelo.'
            : undefined,
      layer: errors.layer,
    };
    setErrors(next);
    if (next.name || next.layer) return;
    save.mutate();
  };

  // While saving, the dialog stays open: closing would hide the result of a save that still happens.
  const close = () => {
    if (!save.isPending) onClose();
  };

  const currentLayer = layer?.url ?? (zone?.layer_path ? publicUrl(zone.layer_path) : null);

  return (
    <Modal
      open
      title={zone ? `Editar zona: ${zone.name}` : 'Nueva zona'}
      onClose={close}
      dismissible={!save.isPending}
      footer={
        <>
          <Button variant="secondary" disabled={save.isPending} onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" form="zone-form" loading={save.isPending} disabled={checking}>
            {zone ? 'Guardar zona' : 'Añadir zona'}
          </Button>
        </>
      }
    >
      <form id="zone-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input
          label="Nombre"
          value={name}
          maxLength={ZONE_NAME_MAX}
          error={errors.name}
          hint="Se muestra en la app, en inglés: p. ej. Front, Rims, Temples."
          onChange={(e) => {
            setName(e.target.value);
            setErrors((x) => ({ ...x, name: undefined }));
            if (!save.isPending) save.reset();
          }}
        />
        <Select
          label="Material"
          value={material}
          options={MATERIALS.map((m) => ({ value: m, label: MATERIAL_LABEL[m] }))}
          onChange={(e) => {
            const m = e.target.value as Material;
            setMaterial(m);
            if (swatch && swatch.material !== m) pickSwatch(null); // a default color must be of the zone's material
          }}
        />
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Select
              label="Color por defecto"
              value={swatchId ?? ''}
              hint={options.length ? undefined : 'No hay colores activos de este material (Paletas).'}
              options={[
                { value: '', label: '— Sin color —' },
                ...options.map((s) => ({
                  value: s.id,
                  label: `${s.name} · ${s.ref}${s.active ? '' : ' (inactivo)'}`,
                })),
              ]}
              onChange={(e) => pickSwatch(e.target.value || null)}
            />
          </div>
          {swatch && <Swatch hex={swatch.hex} alpha={swatch.alpha} title={swatch.name} size={40} />}
        </div>
        {finishes.length > 0 && (
          <Select
            label="Acabado por defecto"
            value={shownFinish!}
            options={finishes.map((f) => ({ value: f, label: FINISH_LABEL[f] }))}
            onChange={(e) => setFinish(e.target.value as Finish)}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink">Capa (PNG)</span>
          <div className="flex items-center gap-3">
            <ZoneThumb
              layerUrl={currentLayer}
              color={swatch?.hex ?? null}
              label="Forma de la zona"
              className="h-20 w-40"
            />
            <label className="cursor-pointer text-sm font-semibold text-accent">
              {checking ? 'Comprobando…' : currentLayer ? 'Cambiar capa' : 'Elegir capa'}
              <input
                type="file"
                accept="image/png"
                className="sr-only"
                aria-label="Archivo de la capa"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void pickLayer(file);
                }}
              />
            </label>
          </div>
          {errors.layer ? (
            <p role="alert" className="text-sm text-danger">
              {errors.layer}
            </p>
          ) : (
            <p className="text-sm text-muted">
              {base
                ? `Transparente salvo la zona, ${base.width} × ${base.height} px como la imagen base.`
                : 'Sube primero la imagen base del modelo.'}
            </p>
          )}
        </div>
        {save.isError && (
          <p role="alert" className="text-sm text-danger">
            {dbMessage(save.error)}
          </p>
        )}
      </form>
    </Modal>
  );
}
