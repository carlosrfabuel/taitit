import { useState, type ReactNode } from 'react';
import { Heart, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  Swatch,
  Table,
  Textarea,
} from '../components/ui';
import { PageHeader } from '../components/PageHeader';

type Row = { number: string; model: string; zones: number };

const ROWS: Row[] = [
  { number: '#1001', model: 'PHILEAS', zones: 3 },
  { number: '#1002', model: 'KARL', zones: 2 },
  { number: '#1003', model: 'LOULOU', zones: 4 },
];

// Development-only gallery of the admin UI kit (route registered only in dev builds).
export function UiKitPage() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <PageHeader title="UI kit" note="Panel components (development only)." />

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<Plus className="size-4" />}>New model</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />}>
            Delete
          </Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            Save
          </Button>
          <Button size="sm" disabled>
            Disabled
          </Button>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Open modal
          </Button>
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Model name" placeholder="PHILEAS" />
          <Select
            label="Zone material"
            options={[
              { value: 'metal', label: 'Metal' },
              { value: 'acetate', label: 'Acetate' },
            ]}
          />
          <Input label="HEX code" defaultValue="#ZZZZZZ" error="Invalid format. Example: #1E1E22" />
          <Input label="Internal reference" placeholder="TM-01" hint="Shown on orders." />
          <div className="col-span-2">
            <Textarea label="Description" placeholder="Titanium front with acetate rims…" />
          </div>
        </div>
      </Section>

      <Section title="Swatches and states">
        <div className="flex items-center gap-3">
          <Swatch hex="#1E1E22" title="Black" />
          <Swatch hex="#4CFF5A" title="Neon green" />
          <Swatch hex="#E8434F" alpha={0.55} title="Translucent pink" />
          <Swatch hex="#F4F1EA" alpha={0.45} title="Crystal" />
          <Swatch hex="#C9A45C" title="Gold" />
        </div>
      </Section>

      <Section title="Table">
        <Table<Row>
          rowKey={(r) => r.number}
          rows={ROWS}
          onRowClick={() => setOpen(true)}
          columns={[
            { key: 'n', header: 'Order', render: (r) => <span className="font-semibold">{r.number}</span> },
            { key: 'm', header: 'Model', render: (r) => r.model },
            { key: 'z', header: 'Zones', render: (r) => r.zones },
          ]}
        />
      </Section>

      <Section title="Loading and empty">
        <Card>
          <Spinner />
        </Card>
        <Card>
          <EmptyState
            icon={<Heart className="size-6" />}
            title="No orders yet"
            message="When customers confirm a design, it will appear here."
            action={<Button variant="secondary">View models</Button>}
          />
        </Card>
      </Section>

      <Modal
        open={open}
        title="Change status"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Confirm</Button>
          </>
        }
      >
        <p className="text-sm text-muted">The customer will receive a notification with the new status.</p>
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
