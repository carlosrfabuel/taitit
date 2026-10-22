import { useId, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, Input, Spinner, Textarea } from '../components/ui';
import { BaseImageCard } from '../components/models/BaseImageCard';
import { ZonesCard } from '../components/models/ZonesCard';
import { PreviewCard } from '../components/models/PreviewCard';
import { DeleteModelButton } from '../components/models/DeleteModelButton';
import {
  MODEL_LIMITS,
  createModel,
  getModel,
  listModels,
  modelKeys,
  publishProblems,
  updateModel,
  validateModel,
  type FieldErrors,
  type ModelInput,
  type ModelRow,
} from '../lib/models';
import { dbMessage, problemLabel, readMessage, publishProblemsIn } from '../lib/errors';

const backLink = (
  <Link to="/models" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
    <ArrowLeft className="size-4" aria-hidden /> Models
  </Link>
);

// /models/new creates a model, /models/:id edits one.
export function ModelEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const model = useQuery({
    queryKey: modelKeys.one(id ?? 'new'),
    queryFn: () => getModel(id!),
    enabled: !isNew,
  });

  if (isNew) return <ModelForm key="new" model={null} />;
  if (model.isPending) return <Spinner />;
  // Only without data: a failed background refetch must not replace a form being edited.
  if (!model.data) {
    return (
      <>
        {backLink}
        <EmptyState
          title={model.isError ? "Couldn't load the model" : 'Model not found'}
          message={model.isError ? readMessage(model.error) : 'It may have been deleted.'}
          action={model.isError ? <Button onClick={() => void model.refetch()}>Try again</Button> : undefined}
        />
      </>
    );
  }
  // key: the form starts from the loaded values (and restarts if another model is opened).
  return <ModelForm key={model.data.id} model={model.data} />;
}

function ModelForm({ model }: { model: ModelRow | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formId = useId();
  const categoriesId = useId();
  const [values, setValues] = useState<ModelInput>({
    name: model?.name ?? '',
    category: model?.category ?? '',
    size_ref: model?.size_ref ?? '',
    description: model?.description ?? '',
    published: model?.published ?? false,
  });
  // Publish state as this form last opened or saved it: only an actual change here is written (see updateModel).
  const [savedPublished, setSavedPublished] = useState(model?.published ?? false);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Set when arriving from "create" (router state), replaced by "saved", cleared on any edit.
  const created = !!(useLocation().state as { created?: boolean } | null)?.created;
  const [notice, setNotice] = useState<string | null>(created ? 'Model created.' : null);

  // Existing categories as suggestions, so the same one isn't typed two ways.
  const all = useQuery({ queryKey: modelKeys.all, queryFn: listModels });
  const categories = [...new Set((all.data ?? []).map((m) => m.category).filter(Boolean))].sort();

  // The database's own publishing check (refreshed with every model change).
  const problems = useQuery({
    queryKey: modelKeys.problems(model?.id ?? 'new'),
    queryFn: () => publishProblems(model!.id),
    enabled: !!model,
  });
  const canPublish = problems.data?.length === 0;

  const save = useMutation({
    mutationFn: async (input: ModelInput) => {
      if (!model) return createModel(input);
      await updateModel(model.id, input, input.published !== savedPublished);
      return model.id;
    },
    onSuccess: (savedId, input) => {
      setSavedPublished(input.published);
      // Not awaited: the save is done once the database accepts it, even if this refresh is slow or fails.
      void queryClient.invalidateQueries({ queryKey: modelKeys.all });
      if (!model) navigate(`/models/${savedId}`, { replace: true, state: { created: true } });
      else setNotice('Changes saved.');
    },
  });

  const set = <K extends keyof ModelInput>(key: K, value: ModelInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setNotice(null);
    // Clears a shown error. Never while saving: reset() would drop isPending and allow a second submit.
    if (!save.isPending) save.reset();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    setNotice(null);
    const next = validateModel(values);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    save.mutate(values);
  };

  // Publishing refused by the database: list what is missing instead of a generic error.
  const refused =
    save.isError && values.published && !model?.published ? publishProblemsIn(save.error) : null;

  const publishCard = (
    <Card className="flex flex-col gap-3">
      <label
        className={`flex items-start gap-3 ${canPublish || values.published ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      >
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-brand"
          checked={values.published}
          // Unpublishing is always possible; publishing only when the database check passes.
          disabled={!canPublish && !values.published}
          onChange={(e) => set('published', e.target.checked)}
        />
        <span>
          <span className="block text-sm font-bold text-ink">Published</span>
          <span className="block text-sm text-muted">
            {!model
              ? 'Create the model first; then add its image and its zones.'
              : canPublish
                ? "Visible in the app's catalog."
                : 'It can be published once it is complete.'}
          </span>
        </span>
      </label>
      {model && problems.data && problems.data.length > 0 && (
        <div className="rounded-lg bg-bg p-3">
          <p className="text-sm font-bold text-ink">Still needed to publish:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted">
            {problems.data.map((p) => (
              <li key={p}>{problemLabel(p)}</li>
            ))}
          </ul>
        </div>
      )}
      {model && problems.isError && (
        <p className="text-sm text-danger">Couldn't check whether the model is complete.</p>
      )}
    </Card>
  );

  // Name, category, size, description and Published: the only things Save sends (the image and the
  // zones are saved as soon as they are uploaded).
  const details = (
    <form id={formId} onSubmit={submit} noValidate>
      <Card className="flex flex-col gap-4">
        {model && <h2 className="text-lg font-bold text-ink">Details</h2>}
        <Input
          label="Name"
          value={values.name}
          maxLength={MODEL_LIMITS.name}
          error={errors.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="PHILEAS"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Category"
            value={values.category}
            maxLength={MODEL_LIMITS.category}
            error={errors.category}
            hint="Filter in the app's catalog (in English)."
            list={categoriesId}
            onChange={(e) => set('category', e.target.value)}
            placeholder="Optical"
          />
          <Input
            label="Size"
            value={values.size_ref}
            maxLength={MODEL_LIMITS.sizeRef}
            error={errors.size_ref}
            onChange={(e) => set('size_ref', e.target.value)}
            placeholder="53-19-140"
          />
        </div>
        <datalist id={categoriesId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Textarea
          label="Description"
          value={values.description}
          maxLength={MODEL_LIMITS.description}
          error={errors.description}
          hint={`${values.description.length} / ${MODEL_LIMITS.description}`}
          onChange={(e) => set('description', e.target.value)}
        />
        {save.isError && (
          <p role="alert" className="text-sm text-danger">
            {refused
              ? `It can't be published yet: ${refused.map(problemLabel).join(' ')}`
              : (save.error as { code?: string }).code === 'not_found'
                ? 'This model no longer exists.'
                : dbMessage(save.error)}
          </p>
        )}
        {notice && !save.isPending && (
          <p role="status" className="text-sm text-success">
            {notice}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" form={formId} loading={save.isPending} className="flex-1">
            {model ? 'Save' : 'Create model'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/models')}>
            Cancel
          </Button>
        </div>
      </Card>
    </form>
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Models', to: '/models' }, { label: model ? model.name : 'New model' }]}
        title={model ? model.name : 'New model'}
        note={model ? undefined : 'The base image and zones are added after the model is created.'}
      />
      {model ? (
        // Existing model: the picture and its parts on the left; on the right, kept in view while
        // scrolling, publishing, the details with their Save, and Delete.
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <PreviewCard model={model} />
            <ZonesCard model={model} />
            <BaseImageCard model={model} />
          </div>
          <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
            {publishCard}
            {details}
            <p className="px-1 text-xs text-muted">
              The image and the zones are saved as soon as you upload them.
            </p>
            <div className="mt-4 border-t border-line pt-4">
              <DeleteModelButton model={model} />
            </div>
          </div>
        </div>
      ) : (
        // New model: only the details; the image and the zones come once it exists.
        <div className="flex max-w-2xl flex-col gap-4">
          {publishCard}
          {details}
        </div>
      )}
    </>
  );
}
