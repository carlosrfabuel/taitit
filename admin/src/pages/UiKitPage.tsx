import { useState, type ReactNode } from 'react';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { ORDER_STATUSES, type OrderStatus } from '@taitit/shared';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  StatusBadge,
  Swatch,
  Table,
  Textarea,
} from '../components/ui';
import { PageHeader } from '../components/PageHeader';

type Row = { number: string; model: string; status: OrderStatus };

const ROWS: Row[] = [
  { number: '#1001', model: 'PHILEAS', status: 'received' },
  { number: '#1002', model: 'KARL', status: 'in_production' },
  { number: '#1003', model: 'LOULOU', status: 'ready' },
];

// Development-only gallery of the admin UI kit (route registered only in dev builds).
export function UiKitPage() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <PageHeader title="UI kit" note="Componentes del panel (solo desarrollo)." />

      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<Plus className="size-4" />}>Nuevo modelo</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />}>
            Eliminar
          </Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            Guardar
          </Button>
          <Button size="sm" disabled>
            Desactivado
          </Button>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Abrir modal
          </Button>
        </div>
      </Section>

      <Section title="Campos">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre del modelo" placeholder="PHILEAS" />
          <Select
            label="Material de la zona"
            options={[
              { value: 'metal', label: 'Metal' },
              { value: 'acetate', label: 'Acetato' },
            ]}
          />
          <Input label="Código HEX" defaultValue="#ZZZZZZ" error="Formato no válido. Ejemplo: #1E1E22" />
          <Input label="Referencia interna" placeholder="TM-01" hint="Aparece en los pedidos." />
          <div className="col-span-2">
            <Textarea label="Descripción" placeholder="Frente de titanio con aros de acetato…" />
          </div>
        </div>
      </Section>

      <Section title="Muestras y estados">
        <div className="flex items-center gap-3">
          <Swatch hex="#1E1E22" title="Negro" />
          <Swatch hex="#4CFF5A" title="Verde neón" />
          <Swatch hex="#E8434F" alpha={0.55} title="Rosa translúcido" />
          <Swatch hex="#F4F1EA" alpha={0.45} title="Cristal" />
          <Swatch hex="#C9A45C" title="Oro" />
        </div>
        <div className="flex gap-2">
          {ORDER_STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Tabla">
        <Table<Row>
          rowKey={(r) => r.number}
          rows={ROWS}
          onRowClick={() => setOpen(true)}
          columns={[
            { key: 'n', header: 'Pedido', render: (r) => <span className="font-semibold">{r.number}</span> },
            { key: 'm', header: 'Modelo', render: (r) => r.model },
            { key: 's', header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      </Section>

      <Section title="Carga y vacío">
        <Card>
          <Spinner />
        </Card>
        <Card>
          <EmptyState
            icon={<Heart className="size-6" />}
            title="Sin pedidos todavía"
            message="Cuando los clientes confirmen un diseño, aparecerán aquí."
            action={<Button variant="secondary">Ver modelos</Button>}
          />
        </Card>
      </Section>

      <Modal
        open={open}
        title="Cambiar estado"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setOpen(false)}>Confirmar</Button>
          </>
        }
      >
        <p className="text-sm text-muted">El cliente recibirá una notificación con el nuevo estado.</p>
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{title}</h2>
      {children}
    </section>
  );
}
