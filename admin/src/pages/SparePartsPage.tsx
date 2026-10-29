import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Wrench } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ModelThumb } from '../components/ModelThumb';
import { SparePartPanel } from '../components/SparePartPanel';
import { listModels, modelKeys } from '../lib/models';
import { orderDayAndTime } from '../lib/orders';
import {
  SPARE_PARTS_LIMIT,
  filterSparePartRequests,
  listSparePartRequests,
  partSummary,
  sparePartKeys,
  sparePartPhotoUrls,
  type SparePartRow,
} from '../lib/spareParts';
import { Button, EmptyState, Input, Spinner, Table, type Column } from '../components/ui';
import { readMessage } from '../lib/errors';

// Spare part requests sent from the app, newest first. No status (Carlos): the warehouse or the area's
// sales rep contacts the optician. Clicking a row shows the request, with its photos, beside the list.
export function SparePartsPage() {
  const requests = useQuery({
    queryKey: sparePartKeys.all,
    queryFn: listSparePartRequests,
    refetchInterval: 60_000,
  });
  const rows = requests.data ?? [];
  const [query, setQuery] = useState('');
  const shown = filterSparePartRequests(rows, query);
  const models = useQuery({ queryKey: modelKeys.all, queryFn: listModels });
  const byId = new Map((models.data ?? []).map((m) => [m.id, m]));
  // Links to every listed request's photos in one call (private files, an hour).
  const paths = rows.flatMap((r) => r.photo_paths);
  const photos = useQuery({
    queryKey: sparePartKeys.photos(paths),
    queryFn: () => sparePartPhotoUrls(paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60_000,
  });
  // The request in the panel: the one clicked, else the first one shown; none once closed.
  const [picked, setPicked] = useState<string | null>(null);
  const [panelClosed, setPanelClosed] = useState(false);
  const selected = panelClosed ? null : (shown.find((r) => r.id === picked) ?? shown[0] ?? null);
  if (selected && selected.id !== picked) setPicked(selected.id);

  const columns: Column<SparePartRow>[] = [
    {
      key: 'number',
      header: 'No.',
      className: 'w-20',
      render: (r) => <span className="font-bold text-ink">#{r.number}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (r) => {
        const { day, time } = orderDayAndTime(r.created_at);
        return (
          <span className="flex flex-col whitespace-nowrap">
            <span>{day}</span>
            <span className="text-xs text-muted">{time}</span>
          </span>
        );
      },
    },
    {
      key: 'business',
      header: 'Optician',
      render: (r) => (
        <div className="flex max-w-56 flex-col">
          <span className="font-semibold text-ink">{r.business_name ?? r.customer_name ?? '—'}</span>
          <span className="truncate text-xs text-muted" title={r.customer_email ?? undefined}>
            {[r.city, r.customer_email].filter(Boolean).join(' · ')}
          </span>
        </div>
      ),
    },
    {
      key: 'model',
      header: 'Model',
      render: (r) => (
        <span className="flex items-center gap-3">
          <ModelThumb model={r.model_id ? byId.get(r.model_id) : undefined} className="h-9 w-16" />
          <span className="max-w-40 truncate" title={r.model_name}>
            {r.model_name}
          </span>
        </span>
      ),
    },
    { key: 'part', header: 'Part', render: (r) => partSummary(r.part, r.side) },
    {
      key: 'photo',
      header: 'Photos',
      render: (r) => {
        const url = photos.data?.get(r.photo_paths[0] ?? '');
        return (
          <span className="inline-flex size-10 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
            {url ? (
              <img
                src={url}
                alt={`First photo of request ${r.number}`}
                loading="lazy"
                className="size-full object-cover"
              />
            ) : photos.isPending ? null : (
              <span className="text-[10px] text-muted">—</span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Spare parts' }]}
        title="Spare parts"
        note="Requests sent from the app, newest first. Click one to see its photos and the optician's details."
      />
      {requests.isPending ? (
        <Spinner />
      ) : requests.isError && !requests.data ? (
        <EmptyState
          title="Couldn't load the requests"
          message={readMessage(requests.error)}
          action={<Button onClick={() => void requests.refetch()}>Try again</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Wrench className="size-6" aria-hidden />}
          title="No requests yet"
          message="Spare part requests that opticians send from the app will appear here."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search no., optician, email, city or model"
                aria-label="Search spare part requests"
                className="pl-9"
              />
            </div>
            {query.trim() && (
              <span className="text-sm text-muted">
                {shown.length} of {rows.length}
              </span>
            )}
          </div>
          <div
            className={
              selected
                ? 'grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_380px]'
                : ''
            }
          >
            <div className="min-w-0">
              <Table
                columns={columns}
                rows={shown}
                rowKey={(r) => r.id}
                selectedKey={selected?.id ?? null}
                onRowClick={(r) => {
                  setPicked(r.id);
                  setPanelClosed(false);
                }}
                empty={
                  <EmptyState
                    icon={<Search className="size-6" aria-hidden />}
                    title="No requests match"
                    message="Try another search."
                    action={
                      <Button variant="secondary" onClick={() => setQuery('')}>
                        View all
                      </Button>
                    }
                  />
                }
              />
              {rows.length === SPARE_PARTS_LIMIT && (
                <p className="mt-3 text-sm text-muted">
                  Showing the {SPARE_PARTS_LIMIT} most recent requests; the search includes only these.
                </p>
              )}
            </div>
            {selected && (
              <SparePartPanel
                key={selected.id}
                request={selected}
                photoUrls={photos.data}
                onClose={() => setPanelClosed(true)}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
