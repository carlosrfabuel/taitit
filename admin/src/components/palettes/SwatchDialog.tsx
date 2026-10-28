import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Finish, Material, SwatchKind } from '@taitit/shared';
import { Button, Input, Modal, Select, Swatch } from '../ui';
import { checkTexture } from '../../lib/images';
import {
  SWATCH_LIMITS,
  deleteSwatch,
  normalizeHex,
  saveSwatch,
  swatchKeys,
  textureUrl,
  validateSwatch,
  type SwatchErrors,
  type SwatchInput,
  type SwatchRow,
} from '../../lib/swatches';
import { modelKeys } from '../../lib/models';
import { dbMessage, publishProblemsIn } from '../../lib/errors';
import { FINISH_LABEL, KIND_LABEL, MATERIAL_LABEL } from '../../lib/labels';

type Props = {
  /** null = new color */
  swatch: SwatchRow | null;
  material: Material;
  swatches: SwatchRow[];
  onClose: () => void;
};

const ACETATE_KINDS: SwatchKind[] = ['solid', 'translucent', 'havana'];
// Matte first: the first finish is the one a new pick starts with (acetate default: matte).
const FINISHES: Finish[] = ['matte', 'gloss'];

/** A published model uses this color as a default: explain where to fix it. */
function messageFor(error: unknown) {
  const problems = publishProblemsIn(error as { message?: string });
  if (problems?.some((p) => p === 'default_color_inactive' || p === 'zone_without_default_color'))
    return "It's the default color of a zone in a published model. Change that default color in the model (or unpublish it) and try again.";
  return dbMessage(error as { message?: string });
}

export function SwatchDialog({ swatch, material, swatches, onClose }: Props) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<SwatchInput>({
    material: swatch?.material ?? material,
    name: swatch?.name ?? '',
    hex: swatch?.hex ?? '#',
    ref: swatch?.ref ?? '',
    kind: swatch?.kind ?? (material === 'metal' ? 'metal' : 'solid'),
    alpha: swatch?.alpha ?? null,
    finishes: swatch?.finishes ?? (material === 'acetate' ? FINISHES : []),
    active: swatch?.active ?? true,
  });
  const [errors, setErrors] = useState<SwatchErrors & { texture?: string }>({});
  const [texture, setTexture] = useState<{ file: File; url: string } | 'remove' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pick = useRef(0);

  useEffect(
    () => () => void (texture && texture !== 'remove' && URL.revokeObjectURL(texture.url)),
    [texture],
  );

  const isMetal = values.material === 'metal';
  const kind: SwatchKind = isMetal ? 'metal' : values.kind;
  const hex = normalizeHex(values.hex);
  const shownTexture =
    kind !== 'havana' || texture === 'remove'
      ? null
      : texture
        ? texture.url
        : swatch
          ? textureUrl(swatch)
          : null;

  const set = <K extends keyof SwatchInput>(key: K, value: SwatchInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    if (!save.isPending) save.reset();
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: swatchKeys.all });
    void queryClient.invalidateQueries({ queryKey: modelKeys.all }); // previews and zone lists show colors
  };

  const save = useMutation({
    mutationFn: () =>
      saveSwatch(
        swatch,
        { ...values, kind },
        texture === 'remove' ? 'remove' : (texture?.file ?? null),
        Math.max(0, ...swatches.filter((s) => s.material === values.material).map((s) => s.sort_order)) + 1,
      ),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteSwatch(swatch!),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  const busy = save.isPending || remove.isPending;
  const close = () => {
    if (!busy) onClose();
  };

  const pickTexture = async (file: File) => {
    const id = ++pick.current;
    // Picking a file means "use a texture": it cancels an earlier "Remove", so a bad file blocks saving.
    setTexture((t) => (t === 'remove' ? null : t));
    const checked = await checkTexture(file);
    if (id !== pick.current) return;
    if ('error' in checked) {
      setErrors((e) => ({ ...e, texture: checked.error }));
      return;
    }
    setErrors((e) => ({ ...e, texture: undefined }));
    setTexture({ file, url: URL.createObjectURL(file) });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: SwatchErrors & { texture?: string } = validateSwatch({ ...values, kind });
    const ref = values.ref.trim().toLowerCase();
    // Unique within the material: metal 2F and acetate 2F are different colors (database rule).
    if (
      !next.ref &&
      swatches.some(
        (s) => s.id !== swatch?.id && s.material === values.material && s.ref.toLowerCase() === ref,
      )
    )
      next.ref = 'A color of this material with that reference already exists.';
    // A texture error only counts while the color is tortoiseshell and that texture is being added.
    if (kind === 'havana' && texture !== 'remove' && errors.texture) next.texture = errors.texture;
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    save.mutate();
  };

  return (
    <Modal
      open
      title={swatch ? `Edit color: ${swatch.name}` : `New color (${MATERIAL_LABEL[values.material]})`}
      onClose={close}
      dismissible={!busy}
      footer={
        confirmDelete ? (
          <>
            <Button variant="secondary" disabled={remove.isPending} onClick={() => setConfirmDelete(false)}>
              No, go back
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Yes, delete
            </Button>
          </>
        ) : (
          <>
            {swatch && (
              <Button
                variant="danger"
                disabled={busy}
                className="mr-auto"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
            <Button variant="secondary" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form="swatch-form" loading={save.isPending}>
              {swatch ? 'Save color' : 'Add color'}
            </Button>
          </>
        )
      }
    >
      {confirmDelete ? (
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>
            Delete <strong>{swatch!.name}</strong> ({swatch!.ref})? This can't be undone.
          </p>
          <p className="text-muted">
            Zones that use it as their default color will be left without one, and it will disappear from
            saved designs. Orders already placed don't change. If you only want to hide it in the app,
            deactivate it.
          </p>
          {remove.isError && (
            <p role="alert" className="text-danger">
              {messageFor(remove.error)}
            </p>
          )}
        </div>
      ) : (
        <form id="swatch-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Swatch
              hex={/^#[0-9A-F]{6}$/.test(hex) ? hex : '#FFFFFF'}
              alpha={kind === 'translucent' ? values.alpha : null}
              textureUrl={shownTexture}
              title="Swatch"
              size={48}
            />
            <p className="text-sm text-muted">This is how the swatch will look in the app's palette.</p>
          </div>
          <Input
            label="Name"
            value={values.name}
            maxLength={SWATCH_LIMITS.name}
            error={errors.name}
            hint="Shown in the app, in English: e.g. Rose Gold."
            onChange={(e) => set('name', e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="HEX"
                  value={values.hex}
                  error={errors.hex}
                  maxLength={7}
                  onChange={(e) => set('hex', e.target.value)}
                  onBlur={() => set('hex', normalizeHex(values.hex))}
                />
              </div>
              <input
                type="color"
                aria-label="Pick color"
                value={/^#[0-9A-F]{6}$/.test(hex) ? hex.toLowerCase() : '#ffffff'}
                onChange={(e) => set('hex', e.target.value.toUpperCase())}
                className={`h-10 w-12 cursor-pointer rounded-lg border border-line bg-surface ${errors.hex ? 'mb-7' : ''}`}
              />
            </div>
            <Input
              label="Internal reference"
              value={values.ref}
              maxLength={SWATCH_LIMITS.ref}
              error={errors.ref}
              hint="Shown on orders."
              onChange={(e) => set('ref', e.target.value)}
            />
          </div>
          {!swatch && (
            <Select
              label="Material"
              value={values.material}
              hint="Can't be changed later."
              options={(['metal', 'acetate'] as Material[]).map((m) => ({
                value: m,
                label: MATERIAL_LABEL[m],
              }))}
              onChange={(e) => {
                const m = e.target.value as Material;
                setValues((v) => ({
                  ...v,
                  material: m,
                  kind: m === 'metal' ? 'metal' : 'solid',
                  finishes: m === 'acetate' ? FINISHES : [],
                }));
              }}
            />
          )}
          {!isMetal && (
            <>
              <Select
                label="Type"
                value={kind}
                options={ACETATE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                onChange={(e) => {
                  const k = e.target.value as SwatchKind;
                  set('kind', k);
                  setErrors((x) => ({ ...x, texture: undefined }));
                  if (k === 'translucent' && values.alpha == null) set('alpha', 0.55);
                }}
              />
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-bold text-ink">Available finishes</legend>
                <div className="flex gap-4">
                  {FINISHES.map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={values.finishes.includes(f)}
                        onChange={(e) =>
                          set(
                            'finishes',
                            e.target.checked
                              ? FINISHES.filter((x) => x === f || values.finishes.includes(x))
                              : values.finishes.filter((x) => x !== f),
                          )
                        }
                      />
                      {FINISH_LABEL[f]}
                    </label>
                  ))}
                </div>
                {errors.finishes && <p className="text-sm text-danger">{errors.finishes}</p>}
              </fieldset>
            </>
          )}
          {kind === 'translucent' && (
            <Input
              label="Opacity (%)"
              type="number"
              min={5}
              max={100}
              step={5}
              value={values.alpha == null ? '' : Math.round(values.alpha * 100)}
              error={errors.alpha}
              hint="100% = opaque. The lower it is, the more you can see through it."
              onChange={(e) => set('alpha', e.target.value === '' ? null : Number(e.target.value) / 100)}
            />
          )}
          {kind === 'havana' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ink">Tortoiseshell texture</span>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg border border-line bg-bg">
                  {shownTexture ? (
                    <img src={shownTexture} alt="Texture" className="size-full object-cover" />
                  ) : (
                    <span className="px-1 text-center text-xs text-muted">No texture (uses the HEX)</span>
                  )}
                </div>
                <label className="cursor-pointer text-sm font-semibold text-accent">
                  {shownTexture ? 'Change texture' : 'Upload texture'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="Texture file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void pickTexture(file);
                    }}
                  />
                </label>
                {shownTexture && (
                  <button
                    type="button"
                    className="text-sm font-semibold text-danger"
                    onClick={() => {
                      setTexture('remove');
                      setErrors((x) => ({ ...x, texture: undefined }));
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {errors.texture ? (
                <p role="alert" className="text-sm text-danger">
                  {errors.texture}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Photo of the acetate sample. JPG, PNG or WebP, up to 5 MB.
                </p>
              )}
            </div>
          )}
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-brand"
              checked={values.active}
              onChange={(e) => set('active', e.target.checked)}
            />
            <span>
              <span className="block text-sm font-bold text-ink">Active</span>
              <span className="block text-sm text-muted">Only active colors appear in the app.</span>
            </span>
          </label>
          {save.isError && (
            <p role="alert" className="text-sm text-danger">
              {messageFor(save.error)}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
