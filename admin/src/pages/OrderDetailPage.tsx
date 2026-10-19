import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileSpreadsheet, ImageDown, Printer } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, Spinner, Swatch, Table, type Column } from '../components/ui';
import {
  downloadOrderImage,
  downloadOrderSheet,
  formatOrderDate,
  getOrder,
  orderImageUrl,
  orderKeys,
  type OrderItemRow,
} from '../lib/orders';
import { textureUrl } from '../lib/swatches';
import { dbMessage } from '../lib/errors';
import { FINISH_LABEL, KIND_LABEL, MATERIAL_LABEL } from '../lib/labels';

// One order, exactly as it was sent: image, part sheet, notes, and the optician's details at that
// moment. Downloads: the image and the Excel sheet (the same file the order email carries).
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const order = useQuery({ queryKey: orderKeys.one(id), queryFn: () => getOrder(id) });
  const o = order.data;
  const image = useQuery({
    queryKey: ['orders', id, 'image', o?.image_path],
    queryFn: () => orderImageUrl(o!.image_path!),
    enabled: !!o?.image_path,
    staleTime: 30 * 60_000, // the link lasts an hour
  });
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const back = (
    <Link
      to="/orders"
      className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink print:hidden"
    >
      <ArrowLeft className="size-4" aria-hidden /> Pedidos
    </Link>
  );

  if (order.isPending) return <Spinner />;
  if (order.isError)
    return (
      <EmptyState
        title="No se pudo cargar el pedido"
        message={dbMessage(order.error)}
        action={<Button onClick={() => void order.refetch()}>Reintentar</Button>}
      />
    );
  if (!o)
    return (
      <>
        {back}
        <EmptyState title="Pedido no encontrado" message="Puede que el enlace no sea correcto." />
      </>
    );

  const columns: Column<OrderItemRow>[] = [
    {
      key: 'zone',
      header: 'Pieza',
      render: (i) => <span className="font-semibold text-ink">{i.zone_name}</span>,
    },
    { key: 'material', header: 'Material', render: (i) => MATERIAL_LABEL[i.material] },
    {
      key: 'color',
      header: 'Color',
      render: (i) => (
        <span className="flex items-center gap-2">
          <Swatch
            hex={i.hex}
            alpha={i.kind === 'translucent' ? i.alpha : null}
            textureUrl={i.texture_path ? textureUrl(i) : null}
            title={i.swatch_name}
            size={24}
          />
          {i.swatch_name}
        </span>
      ),
    },
    { key: 'ref', header: 'Referencia', render: (i) => <span className="font-mono text-xs">{i.ref}</span> },
    { key: 'finish', header: 'Acabado', render: (i) => (i.finish ? FINISH_LABEL[i.finish] : '—') },
    {
      key: 'kind',
      header: 'Tipo',
      render: (i) =>
        i.kind === 'translucent' && i.alpha != null
          ? `${KIND_LABEL[i.kind]} · ${Math.round(i.alpha * 100)} %`
          : KIND_LABEL[i.kind],
    },
  ];

  const download = async (what: 'image' | 'sheet') => {
    setDownloadError(null);
    try {
      if (what === 'image') await downloadOrderImage(o);
      else downloadOrderSheet(o);
    } catch (e) {
      setDownloadError(`No se pudo descargar. ${dbMessage(e as never)}`);
    }
  };

  const field = (label: string, value: string | null | undefined) =>
    value ? (
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
        <dd className="text-ink">{value}</dd>
      </div>
    ) : null;

  return (
    <>
      {back}
      <PageHeader
        title={`Pedido #${o.number}`}
        note={`${formatOrderDate(o.created_at)} · ${o.model_name}`}
        actions={
          // Not printed: the printed page is the technical sheet itself.
          <div className="flex gap-2 print:hidden">
            <Button
              variant="secondary"
              icon={<Printer className="size-4" aria-hidden />}
              onClick={() => window.print()}
            >
              Imprimir ficha
            </Button>
            <Button
              variant="secondary"
              icon={<ImageDown className="size-4" aria-hidden />}
              disabled={!o.image_path}
              onClick={() => void download('image')}
            >
              Descargar imagen
            </Button>
            <Button
              icon={<FileSpreadsheet className="size-4" aria-hidden />}
              onClick={() => void download('sheet')}
            >
              Descargar Excel
            </Button>
          </div>
        }
      />
      {downloadError && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {downloadError}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            {image.data ? (
              <img
                src={image.data}
                alt={`Diseño del pedido ${o.number}`}
                className="h-auto w-full rounded-lg"
              />
            ) : image.isError ? (
              <p className="text-sm text-danger">No se pudo cargar la imagen.</p>
            ) : o.image_path ? (
              <Spinner label="Cargando imagen…" />
            ) : (
              <p className="text-sm text-muted">Este pedido no tiene imagen.</p>
            )}
          </Card>
          <Table columns={columns} rows={o.order_items} rowKey={(i) => `${i.sort_order}-${i.zone_name}`} />
          <Card>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Notas</h2>
            <p className="whitespace-pre-wrap text-ink">{o.notes || 'Sin notas.'}</p>
            {o.shop_ref && <p className="mt-2 text-sm text-muted">Referencia: {o.shop_ref}</p>}
          </Card>
        </div>
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Óptica</h2>
          <dl className="flex flex-col gap-3">
            {field('Nombre comercial', o.business_name)}
            {field('Razón social', o.legal_name)}
            {field('CIF/NIF', o.tax_id)}
            {field('Contacto', o.customer_name)}
            {field('Email', o.customer_email)}
            {field('Teléfono', o.phone)}
            {field(
              'Dirección',
              [o.address, [o.postal_code, o.city].filter(Boolean).join(' '), o.province]
                .filter(Boolean)
                .join(', '),
            )}
          </dl>
          <p className="mt-4 text-xs text-muted">Datos en el momento del pedido.</p>
        </Card>
      </div>
    </>
  );
}
