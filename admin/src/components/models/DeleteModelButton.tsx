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
      // Read the layer paths first: after the delete the zone rows are gone.
      const zones = await listZones(model.id);
      await deleteModel(
        model,
        zones.map((z) => z.layer_path),
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
        Eliminar modelo
      </Button>
      <Modal
        open={open}
        title="Eliminar modelo"
        onClose={() => !remove.isPending && setOpen(false)}
        dismissible={!remove.isPending}
        footer={
          <>
            <Button variant="secondary" disabled={remove.isPending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Eliminar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>
            Se eliminará <strong>{model.name}</strong> con sus zonas e imágenes. No se puede deshacer.
          </p>
          <p className="text-muted">
            Los diseños que los clientes hayan guardado con este modelo también se eliminarán. Los pedidos ya
            hechos se conservan con su resumen.
          </p>
          {model.published && (
            <p className="text-muted">Si solo quieres ocultarlo de la app, desmárcalo como publicado.</p>
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
