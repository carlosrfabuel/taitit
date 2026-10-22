import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button, Modal } from '../ui';
import { deleteModel, modelKeys, type ModelRow } from '../../lib/models';
import { listZones } from '../../lib/zones';
import { dbMessage } from '../../lib/errors';

export function DeleteModelButton({ model }: { model: ModelRow }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const remove = useMutation({
    mutationFn: async () => {
      // Read the layer and pattern paths first: after the delete the zone rows are gone.
      const zones = await listZones(model.id);
      await deleteModel(
        model,
        zones.flatMap((z) => [z.layer_path, z.pattern_path]),
      );
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: modelKeys.one(model.id) });
      void queryClient.invalidateQueries({ queryKey: modelKeys.all });
      navigate('/models', { replace: true });
    },
  });

  return (
    <>
      <Button
        variant="danger"
        icon={<Trash2 className="size-4" aria-hidden />}
        onClick={() => {
          remove.reset();
          setOpen(true);
        }}
      >
        Delete model
      </Button>
      <Modal
        open={open}
        title="Delete model"
        onClose={() => !remove.isPending && setOpen(false)}
        dismissible={!remove.isPending}
        footer={
          <>
            <Button variant="secondary" disabled={remove.isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>
            <strong>{model.name}</strong> will be deleted along with its zones and images. This can't be
            undone.
          </p>
          <p className="text-muted">
            Designs that customers have saved with this model will also be deleted. Orders already placed are
            kept with their summary.
          </p>
          {model.published && (
            <p className="text-muted">If you only want to hide it from the app, untick Published instead.</p>
          )}
          {remove.isError && (
            <p role="alert" className="text-danger">
              {dbMessage(remove.error)}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
