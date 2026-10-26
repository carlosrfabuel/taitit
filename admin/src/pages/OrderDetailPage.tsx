import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileSpreadsheet, ImageDown, Printer } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, Spinner, Swatch, Table, type Column } from '../components/ui';
import { OrderLineImage } from '../components/OrderLineImage';
import {
  downloadOrderImages,
  downloadOrderSheet,
  formatOrderDate,
  framesLabel,
  getOrder,
  orderKeys,
  type OrderItemRow,
} from '../lib/orders';
import { addressLine } from '../lib/customers';
import { textureUrl } from '../lib/swatches';
import { readMessage } from '../lib/errors';
import { FINISH_LABEL, KIND_LABEL, MATERIAL_LABEL, swatchLabel } from '../lib/labels';

// One order, exactly as it was sent: each frame with its image, part sheet and quantity, the notes,
// and the optician's details at that moment. Downloads: the images and the Excel sheet (the same file
// the order email carries).
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const order = useQuery({ queryKey: orderKeys.one(id), queryFn: () => getOrder(id) });
  const o = order.data;
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const back = (
    <Link
      to="/orders"
      className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink print:hidden"
    >
      <ArrowLeft className="size-4" aria-hidden /> Orders
    </Link>
  );

  if (order.isPending) return <Spinner />;
  if (order.isError && !order.data)
    return (
      <EmptyState
        title="Couldn't load the order"
        message={readMessage(order.error)}
        action={<Button onClick={() => void order.refetch()}>Try again</Button>}
      />
    );
  if (!o)
    return (
      <>
        {back}
        <EmptyState title="Order not found" message="The link may not be correct." />
      </>
    );

  const several = o.order_lines.length > 1;
  const columns: Column<OrderItemRow>[] = [
    {
      key: 'zone',
      header: 'Part',
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
            title={swatchLabel({ name: i.swatch_name, ref: i.ref })}
            size={24}
          />
          {swatchLabel({ name: i.swatch_name, ref: i.ref })}
        </span>
      ),
    },
    { key: 'ref', header: 'Reference', render: (i) => <span className="font-mono text-xs">{i.ref}</span> },
    { key: 'finish', header: 'Finish', render: (i) => (i.finish ? FINISH_LABEL[i.finish] : '—') },
    {
      key: 'kind',
      header: 'Type',
      render: (i) =>
        i.kind === 'translucent' && i.alpha != null
          ? `${KIND_LABEL[i.kind]} · ${Math.round(i.alpha * 100)}%`
          : KIND_LABEL[i.kind],
    },
  ];

  const download = async (what: 'image' | 'sheet') => {
    setDownloadError(null);
    try {
      if (what === 'image') await downloadOrderImages(o);
      else downloadOrderSheet(o);
    } catch (e) {
      setDownloadError(`Couldn't download. ${readMessage(e as { message?: string })}`);
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
      <PageHeader
        crumbs={[{ label: 'Orders', to: '/orders' }, { label: `#${o.number}` }]}
        title={`Order #${o.number}`}
        note={`${formatOrderDate(o.created_at)} · ${several ? `${o.order_lines.length} different frames, ` : `${o.model_name} · `}${framesLabel(o.quantity)}`}
        actions={
          // Not printed: the printed page is the technical sheet itself.
          <div className="flex gap-2 print:hidden">
            <Button
              variant="secondary"
              icon={<Printer className="size-4" aria-hidden />}
              onClick={() => window.print()}
            >
              Print order sheet
            </Button>
            <Button
              variant="secondary"
              icon={<ImageDown className="size-4" aria-hidden />}
              disabled={!o.order_lines.some((l) => l.image_path)}
              onClick={() => void download('image')}
            >
              {several ? 'Download images' : 'Download image'}
            </Button>
            <Button
              icon={<FileSpreadsheet className="size-4" aria-hidden />}
              onClick={() => void download('sheet')}
            >
              Download Excel
            </Button>
          </div>
        }
      />
      {downloadError && (
        <p role="alert" className="mb-3 text-sm text-danger print:hidden">
          {downloadError}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {o.order_lines.map((line) => (
            <Card key={line.id} className="flex flex-col gap-4 break-inside-avoid">
              {several && (
                <h2 className="text-lg font-bold text-ink">
                  {line.line_no}. {line.model_name} · {framesLabel(line.quantity)}
                </h2>
              )}
              <OrderLineImage
                line={line}
                alt={
                  several
                    ? `Design of order ${o.number}, frame ${line.line_no}`
                    : `Design of order ${o.number}`
                }
              />
              <Table
                columns={columns}
                rows={line.order_items}
                rowKey={(i) => `${i.sort_order}-${i.zone_name}`}
              />
            </Card>
          ))}
          <Card>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Notes</h2>
            <p className="whitespace-pre-wrap text-ink">{o.notes || 'No notes.'}</p>
            {o.shop_ref && <p className="mt-2 text-sm text-muted">Reference: {o.shop_ref}</p>}
          </Card>
        </div>
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Optician</h2>
          <dl className="flex flex-col gap-3">
            {field('Commercial name', o.business_name)}
            {field('Company name', o.legal_name)}
            {field('VAT number', o.tax_id)}
            {field('Name on the glasses', o.labeling)}
            {field('Contact', o.customer_name)}
            {field('Email', o.customer_email)}
            {o.contact_email &&
              o.contact_email !== o.customer_email &&
              field('Contact email', o.contact_email)}
            {field('Phone', o.phone)}
            {field('Address', addressLine(o.address, o.postal_code, o.city, o.province))}
            {o.delivery_address &&
              field(
                'Delivery address',
                addressLine(o.delivery_address, o.delivery_postal_code, o.delivery_city, o.delivery_province),
              )}
            {o.commercial_address &&
              field(
                'Commercial address',
                addressLine(
                  o.commercial_address,
                  o.commercial_postal_code,
                  o.commercial_city,
                  o.commercial_province,
                ),
              )}
            {o.bank_account && field('Bank account', o.bank_account)}
          </dl>
          <p className="mt-4 text-xs text-muted">Details as of the time of the order.</p>
        </Card>
      </div>
    </>
  );
}
