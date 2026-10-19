import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FINISH_LABEL, MATERIAL_LABEL, buildRenderPlan, tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { useCatalog, useSwatches } from '@/catalog/useCatalog';
import { parseSelection } from '@/designs/designs';
import {
  NOTES_MAX,
  ORDER_IMAGE_WIDTH,
  SHOP_REF_MAX,
  orderLines,
  uploadOrderImage,
  validateOrderInput,
} from '@/orders/orders';
import { RecolorView, renderPlanToJpeg } from '@/render/RecolorView';
import { AppText, Button, Card, EmptyState, Loader, Screen, Swatch, TextField, useToast } from '@/ui';

const { spacing, colors } = tokens;
const PAGE = spacing.xl;

// Order summary: everything that will be ordered, part by part, plus notes and the shop / customer
// reference. Opened from the customizer with the model and the chosen colors in the link
// (/order/summary?modelId=…&sel=…), so it survives a reload. Creating the order comes on Day 17.
export default function OrderSummaryScreen() {
  const { modelId, sel } = useLocalSearchParams<{ modelId?: string; sel?: string }>();
  const { session } = useAuth();
  const catalog = useCatalog();
  const swatches = useSwatches();

  if (!session)
    return (
      <Screen>
        <EmptyState
          icon="person-circle-outline"
          title="Sign in to order"
          message="Orders are sent from your account."
          actionLabel="Sign in"
          onAction={() => router.push('/sign-in')}
        />
      </Screen>
    );
  if (catalog.isPending || swatches.isPending) return <Loader message="Preparing your order…" />;
  if ((catalog.isError && !catalog.data) || (swatches.isError && !swatches.data))
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load the order"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            void catalog.refetch();
            void swatches.refetch();
          }}
        />
      </Screen>
    );
  const model = catalog.data?.find((m) => m.id === modelId);
  if (!model)
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Model not available"
          message="It may have been removed from the collection."
          actionLabel="Back to catalog"
          onAction={() => router.dismissTo('/')}
        />
      </Screen>
    );

  let selection;
  try {
    selection = parseSelection(sel ? JSON.parse(sel) : null);
  } catch {
    selection = parseSelection(null); // a broken link: the model's default colors
  }
  return <Summary key={`${model.id}:${sel}`} userId={session.user.id} model={model} selection={selection} />;
}

function Summary({
  userId,
  model,
  selection,
}: {
  userId: string;
  model: NonNullable<ReturnType<typeof useCatalog>['data']>[number];
  selection: ReturnType<typeof parseSelection>;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const swatches = useSwatches().data ?? [];
  const [notes, setNotes] = useState('');
  const [shopRef, setShopRef] = useState('');
  const [errors, setErrors] = useState<{ notes?: string; shopRef?: string }>({});
  const [busy, setBusy] = useState(false);
  // One key per order attempt: retries reuse it, so they can't create a second image (or, on Day 17,
  // a second order).
  const [attemptKey] = useState(() => randomUUID());

  const { lines, replaced, missing } = orderLines(model, swatches, selection);
  const picks = Object.fromEntries(lines.map((l) => [l.zoneId, { swatchId: l.swatchId, finish: l.finish }]));
  const plan = buildRenderPlan({
    baseUrl: model.plan.baseUrl,
    width: model.plan.width,
    height: model.plan.height,
    zones: model.zones,
    swatches,
    picks,
  });

  const confirm = async () => {
    if (busy) return;
    const input = validateOrderInput({ notes, shopRef });
    if ('errors' in input) return setErrors(input.errors);
    setBusy(true);
    try {
      const jpeg = await renderPlanToJpeg(plan, ORDER_IMAGE_WIDTH);
      await uploadOrderImage(userId, attemptKey, jpeg);
      // Day 17: create the order (orders + order_items, one transaction, same key) and go to "Order sent".
      toast('Order image ready. Sending the order comes in the next update.', 'success');
    } catch {
      toast("Couldn't prepare the order. Check your connection and try again.", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <RecolorView plan={plan} width={width - PAGE * 2} />
        <View>
          <AppText variant="title">{model.name}</AppText>
          {model.sizeRef ? <AppText variant="small">{model.sizeRef}</AppText> : null}
        </View>
        {replaced.length > 0 ? (
          <Card style={styles.notice}>
            <AppText variant="small">
              Some colors are no longer available and were replaced by the original ones:{' '}
              {replaced.join(', ')}. Check them before confirming.
            </AppText>
          </Card>
        ) : null}
        <Card style={styles.lines}>
          {lines.map((l, i) => (
            <View key={l.zoneId} style={[styles.line, i > 0 && styles.lineBorder]}>
              <Swatch
                hex={l.hex}
                alpha={l.alpha}
                texture={l.textureUrl}
                size={tokens.swatch.md}
                accessibilityLabel={l.swatchName}
              />
              <View style={styles.lineText}>
                <AppText variant="label">
                  {l.zoneName} · {MATERIAL_LABEL[l.material]}
                </AppText>
                <AppText>
                  {l.swatchName}
                  {l.finish ? ` · ${FINISH_LABEL[l.finish]}` : ''}
                </AppText>
                <AppText variant="small">Ref. {l.ref}</AppText>
              </View>
            </View>
          ))}
          {missing.map((name) => (
            <AppText key={name} variant="small" color={colors.danger}>
              {`${name}: no color available. This model can't be ordered right now.`}
            </AppText>
          ))}
        </Card>
        <TextField
          label="Shop / customer reference (optional)"
          value={shopRef}
          onChangeText={(t) => {
            setShopRef(t);
            setErrors((e) => ({ ...e, shopRef: undefined }));
          }}
          error={errors.shopRef}
          maxLength={SHOP_REF_MAX}
          placeholder="e.g. Optica Sol · Ana López"
        />
        <TextField
          label="Notes (optional)"
          value={notes}
          onChangeText={(t) => {
            setNotes(t);
            setErrors((e) => ({ ...e, notes: undefined }));
          }}
          error={errors.notes}
          maxLength={NOTES_MAX}
          multiline
          style={styles.notes}
          helper={`${Array.from(notes).length}/${NOTES_MAX}`}
        />
        <AppText variant="tiny" color={colors.muted}>
          Colors may vary slightly depending on your screen.
        </AppText>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Button
          title="Confirm order"
          fullWidth
          loading={busy}
          disabled={missing.length > 0 || lines.length === 0}
          onPress={confirm}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: PAGE, gap: spacing.lg },
  notice: { backgroundColor: colors.surfaceMuted },
  lines: { gap: 0, paddingVertical: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  lineBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  lineText: { flex: 1, gap: 2 },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
