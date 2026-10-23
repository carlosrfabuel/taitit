import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Finish, type Material, type ZoneRole } from '@taitit/shared';
import {
  FINISH_LABEL,
  MATERIAL_LABEL,
  swatchLabel,
  ZONE_ROLE_APP_NAME,
  ZONE_ROLE_LABEL,
  ZONE_ROLE_MATERIAL,
} from '../../lib/labels';
import { Button, Input, Modal, Select, Swatch } from '../ui';
import { publicUrl } from '../../lib/images';
import { modelKeys } from '../../lib/models';
import { ZONE_NAME_MAX, saveZone, type ZoneRow } from '../../lib/zones';
import type { SwatchRow } from '../../lib/swatches';
import { dbMessage } from '../../lib/errors';
import { ZoneThumb } from './ZoneThumb';

type Props = {
  zone: ZoneRow;
  zones: ZoneRow[];
  swatches: SwatchRow[];
  onClose: () => void;
};

const MATERIALS: Material[] = ['metal', 'acetate'];
const ROLES: ZoneRole[] = ['main', 'secondary', 'tips'];

export function ZoneDialog({ zone, zones, swatches, onClose }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(zone.name ?? '');
  const [role, setRole] = useState<ZoneRole | null>(zone.role ?? null);
  const [material, setMaterial] = useState<Material>(zone.material ?? 'acetate');
  const [swatchId, setSwatchId] = useState<string | null>(zone.default_swatch_id ?? null);
  const [finish, setFinish] = useState<Finish | null>(zone.default_finish ?? null);
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Active colors of this material; keep the current default visible even if it was deactivated.
  const options = swatches.filter(
    (s) => s.material === material && (s.active || s.id === zone.default_swatch_id),
  );
  const swatch = swatches.find((s) => s.id === swatchId) ?? null;
  const finishes = swatch?.finishes ?? [];
  // What is shown is what is saved: a stored finish the color doesn't offer becomes its first one.
  const shownFinish = finishes.length ? (finish && finishes.includes(finish) ? finish : finishes[0]!) : null;

  const save = useMutation({
    mutationFn: () =>
      saveZone(zone.id, { name, role, material, default_swatch_id: swatchId, default_finish: shownFinish }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: modelKeys.all });
      onClose();
    },
  });

  // Material fixed by the role (main metal = metal, tips = acetate); a default color must follow it.
  const lockedMaterial = role ? (ZONE_ROLE_MATERIAL[role] ?? null) : null;
  const changeMaterial = (m: Material) => {
    setMaterial(m);
    if (swatch && swatch.material !== m) pickSwatch(null);
  };
  const pickRole = (r: ZoneRole | null) => {
    setRole(r);
    // The app name follows the role while it is empty or still a role's default name.
    const defaults = Object.values(ZONE_ROLE_APP_NAME);
    if (r && (!name.trim() || defaults.includes(name.trim()))) setName(ZONE_ROLE_APP_NAME[r]);
    const fixed = r ? ZONE_ROLE_MATERIAL[r] : undefined;
    if (fixed && fixed !== material) changeMaterial(fixed);
    setErrors((x) => ({ ...x, name: undefined }));
    if (!save.isPending) save.reset();
  };
  // Roles another zone of this model already has.
  const taken = new Set(zones.filter((z) => z.id !== zone.id && z.role).map((z) => z.role));

  const pickSwatch = (id: string | null) => {
    setSwatchId(id);
    const s = swatches.find((x) => x.id === id);
    // Keep the chosen finish if the new color offers it, else its first one.
    setFinish(s?.finishes.length ? (s.finishes.includes(finish!) ? finish : s.finishes[0]!) : null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    const trimmed = name.trim();
    const duplicate = zones.some((z) => z.id !== zone.id && z.name.toLowerCase() === trimmed.toLowerCase());
    const next = {
      name: !trimmed
        ? 'Enter the zone name.'
        : trimmed.length > ZONE_NAME_MAX
          ? `Maximum ${ZONE_NAME_MAX} characters.`
          : duplicate
            ? 'This model already has a zone with that name.'
            : undefined,
    };
    setErrors(next);
    if (next.name) return;
    save.mutate();
  };

  // While saving, the dialog stays open: closing would hide the result of a save that still happens.
  const close = () => {
    if (!save.isPending) onClose();
  };

  const currentLayer = zone.layer_path ? publicUrl(zone.layer_path) : null;

  return (
    <Modal
      open
      title={`Edit zone: ${zone.name}`}
      onClose={close}
      dismissible={!save.isPending}
      footer={
        <>
          <Button variant="secondary" disabled={save.isPending} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="zone-form" loading={save.isPending}>
            Save zone
          </Button>
        </>
      }
    >
      <form id="zone-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Select
          label="Zone"
          value={role ?? ''}
          hint="Main metal (with the temples), secondary front and tips: the 3 zones of every model."
          options={[
            { value: '', label: 'Unassigned' },
            ...ROLES.map((r) => ({
              value: r,
              label: taken.has(r) ? `${ZONE_ROLE_LABEL[r]} (already assigned)` : ZONE_ROLE_LABEL[r],
              disabled: taken.has(r),
            })),
          ]}
          onChange={(e) => pickRole((e.target.value || null) as ZoneRole | null)}
        />
        <Input
          label="Name"
          value={name}
          maxLength={ZONE_NAME_MAX}
          error={errors.name}
          hint="Shown in the app, in English: e.g. Main metal, Secondary front, Tips."
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
          disabled={!!lockedMaterial}
          hint={
            lockedMaterial
              ? `Always ${MATERIAL_LABEL[lockedMaterial].toLowerCase()} in this zone.`
              : undefined
          }
          onChange={(e) => changeMaterial(e.target.value as Material)}
        />
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Select
              label="Default color"
              value={swatchId ?? ''}
              hint={options.length ? undefined : 'There are no active colors of this material (Palettes).'}
              options={[
                { value: '', label: '— No color —' },
                ...options.map((s) => ({
                  value: s.id,
                  label: `${swatchLabel(s)}${s.active ? '' : ' (inactive)'}`,
                })),
              ]}
              onChange={(e) => pickSwatch(e.target.value || null)}
            />
          </div>
          {swatch && <Swatch hex={swatch.hex} alpha={swatch.alpha} title={swatch.name} size={40} />}
        </div>
        {finishes.length > 0 && (
          <Select
            label="Default finish"
            value={shownFinish!}
            options={finishes.map((f) => ({ value: f, label: FINISH_LABEL[f] }))}
            onChange={(e) => setFinish(e.target.value as Finish)}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink">Shape</span>
          <div className="flex items-center gap-3">
            <ZoneThumb
              layerUrl={currentLayer}
              color={swatch?.hex ?? null}
              label="Zone shape"
              className="h-20 w-40"
            />
          </div>
          <p className="text-sm text-muted">Made with the zone tool.</p>
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
