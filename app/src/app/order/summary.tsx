import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FINISH_LABEL, MATERIAL_LABEL, buildRenderPlan, tokens, type RenderPlan } from '@taitit/shared';
import { canOrder, useAuth } from '@/auth/AuthProvider';
import { addressLine, businessComplete } from '@/auth/business';
import { useCatalog, useSwatches } from '@/catalog/useCatalog';
import type { CatalogModel } from '@/catalog/catalog';
import {
  NOTES_MAX,
  ORDER_IMAGE_WIDTH,
  QUANTITY_MAX,
  lineImageKey,
  linesToSelection,
  orderErrorMessage,
  orderContentKey,
  orderKeys,
  orderLines,
  placeOrder,
  uploadOrderImage,
  validateOrderInput,
  type OrderLine,
} from '@/orders/orders';
import { orderKeyFor, orderPlaced } from '@/orders/pendingOrders';
import { useCart, type CartLine } from '@/orders/cart';
import { formSummary } from '@/orders/frameForm';
import { RecolorView, renderPlanToJpeg } from '@/render/RecolorView';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Loader,
  QuantityStepper,
  Screen,
  Swatch,
  TextField,
  useToast,
} from '@/ui';

const { spacing, colors, radius } = tokens;
const PAGE = spacing.xl;
const THUMB = 132;

// The order being put together: every frame added from the customizer ("Add to cart"), each with its
// colors and quantity, who orders it (the optician's details, copied into the order) and free-text
// notes. Send renders and uploads one image per frame, then creates the order with all of them (database
// function create_order_lines: one transaction) and opens the confirmation.
export default function OrderSummaryScreen() {
  const { session } = useAuth();
  const catalog = useCatalog();
  const swatches = useSwatches();
  const cart = useCart();

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
  if (cart.lines.length === 0)
    return (
      <Screen>
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          message="Choose a frame in the catalog, pick its colors and tap Add to cart."
          actionLabel="Browse the catalog"
          onAction={() => router.dismissTo('/')}
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
  return <Summary userId={session.user.id} models={catalog.data ?? []} />;
}

/** A frame of the order as it will be sent (null model: no longer in the catalog). */
type Frame = {
  line: CartLine;
  model: CatalogModel | null;
  parts: OrderLine[];
  replaced: string[];
  missing: string[];
  plan: RenderPlan | null;
};

function Summary({ userId, models }: { userId: string; models: CatalogModel[] }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const cart = useCart();
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ notes?: string }>({});
  const [busy, setBusy] = useState<string | null>(null);
  // Guards a second tap before the re-render (the button's own disabled state comes one frame later).
  const sending = useRef(false);
  const queryClient = useQueryClient();
  const swatchesQuery = useSwatches();
  const catalogQuery = useCatalog();
  // Refreshing the catalog after "colors changed": send waits until both are back.
  const refreshing = swatchesQuery.isFetching || catalogQuery.isFetching;
  const swatches = swatchesQuery.data ?? [];
  // Accounts wait for approval by TAITIT before they can order (the server checks it too).
  const { profile, profileFailed, reloadProfile } = useAuth();
  const approved = canOrder(profile);
  // Fresh account status and details each time the order is shown (approval may have happened).
  useFocusEffect(useCallback(() => reloadProfile(), [reloadProfile]));
  const hasBusiness = businessComplete(profile);

  const frames: Frame[] = cart.lines.map((line) => {
    const model = models.find((m) => m.id === line.modelId) ?? null;
    if (!model) return { line, model: null, parts: [], replaced: [], missing: [], plan: null };
    const { lines: parts, replaced, missing } = orderLines(model, swatches, line.selection);
    const picks = Object.fromEntries(
      parts.map((p) => [p.zoneId, { swatchId: p.swatchId, finish: p.finish }]),
    );
    const plan = buildRenderPlan({
      baseUrl: model.plan.baseUrl,
      width: model.plan.width,
      height: model.plan.height,
      zones: model.zones,
      swatches,
      picks,
    });
    return { line, model, parts, replaced, missing, plan };
  });
  const unavailable = frames.some((f) => !f.model || f.missing.length > 0 || f.parts.length === 0);
  const totalFrames = cart.frames;

  const confirm = async () => {
    if (sending.current) return;
    const input = validateOrderInput({ notes });
    if ('errors' in input) return setErrors(input.errors);
    sending.current = true;
    setBusy('Preparing your order…');
    // The key belongs to what is ordered (every frame as shown + notes): a retry of the same content,
    // even from a new screen or after a restart, gets the same key and so the same order and images.
    const content = orderContentKey(
      userId,
      frames.map((f) => ({
        modelId: f.model!.id,
        lines: f.parts,
        form: f.line.form,
        quantity: f.line.quantity,
      })),
      input.notes,
    );
    try {
      const key = await orderKeyFor(content);
      // 1. The images, one per frame, uploaded first (the order points to them).
      const imageKeys: string[] = [];
      for (const [i, f] of frames.entries()) {
        setBusy(
          frames.length > 1 ? `Preparing images ${i + 1} of ${frames.length}…` : 'Preparing your order…',
        );
        const imageKey = await lineImageKey(key, i);
        await uploadOrderImage(userId, imageKey, await renderPlanToJpeg(f.plan!, ORDER_IMAGE_WIDTH));
        imageKeys.push(imageKey);
      }
      // 2. The order with every frame, in one transaction.
      setBusy('Sending…');
      const order = await placeOrder({
        key,
        frames: frames.map((f, i) => ({
          modelId: f.model!.id,
          selection: linesToSelection(f.parts),
          form: f.line.form,
          quantity: f.line.quantity,
          imageKey: imageKeys[i]!,
        })),
        notes: input.notes,
      });
      await orderPlaced(content);
      cart.clear();
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      // An earlier attempt had already gone through (its answer was lost): say so, show that order.
      if (!order.created) toast('This order had already been sent.', 'info');
      // Replace: "back" from the confirmation must not return to an order that was already sent.
      router.replace({ pathname: '/order/done', params: { id: order.id, number: String(order.number) } });
    } catch (e) {
      toast(orderErrorMessage(e), 'error');
      const message = (e as { message?: string } | null)?.message ?? '';
      // Refused because of the account (approval changed, details missing): show its current state.
      if (/account_not_approved|business_details_missing|row-level security/.test(message)) reloadProfile();
      if (/order_colors_changed|order_model_unavailable/.test(message)) {
        // Show the current catalog (the order then flags what changed); send waits for it.
        void swatchesQuery.refetch();
        void catalogQuery.refetch();
      }
    } finally {
      sending.current = false;
      setBusy(null);
    }
  };

  // Why Send is off, said next to the button (the details are further up the page).
  const blockedReason = refreshing
    ? null
    : !profile
      ? profileFailed
        ? "Couldn't load your account."
        : null
      : !approved
        ? profile.status === 'rejected'
          ? 'Your account is not approved for orders.'
          : 'Waiting for TAITIT to approve your account.'
        : !hasBusiness
          ? 'Add your business details first.'
          : unavailable
            ? 'Remove the frames that are no longer available.'
            : null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="small" color={colors.muted}>
          {frames.length === 1
            ? 'One frame. Add more to send them together in this order.'
            : `${frames.length} different frames, ${totalFrames} in total, sent together in one order.`}
        </AppText>

        {frames.map((f, i) => {
          // Changing a frame's colors: back to the customizer with them ("Update frame").
          const edit = f.model
            ? () =>
                router.push({
                  pathname: '/customize/[modelId]',
                  params: { modelId: f.model!.id, lineId: f.line.id },
                })
            : undefined;
          return (
            <Card key={f.line.id} style={styles.frame}>
              <View style={styles.frameTop}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change the colors of frame ${i + 1}`}
                  disabled={!edit || !!busy}
                  onPress={edit}
                  style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}
                >
                  {f.plan ? <RecolorView plan={f.plan} width={THUMB} /> : null}
                </Pressable>
                <View style={styles.frameHead}>
                  <AppText variant="tiny" color={colors.muted}>
                    {`FRAME ${i + 1}`}
                  </AppText>
                  <AppText variant="subheading">{f.model?.name ?? 'Model no longer available'}</AppText>
                  <View style={styles.frameActions}>
                    {edit ? (
                      <Button
                        title="Edit"
                        variant="ghost"
                        size="sm"
                        icon="create-outline"
                        disabled={!!busy}
                        onPress={edit}
                        accessibilityLabel={`Change the colors of frame ${i + 1}, ${f.model!.name}`}
                      />
                    ) : null}
                    <Button
                      title="Remove"
                      variant="dangerGhost"
                      size="sm"
                      icon="trash-outline"
                      disabled={!!busy}
                      onPress={() => cart.remove(f.line.id)}
                      accessibilityLabel={`Remove frame ${i + 1}${f.model ? `, ${f.model.name}` : ''}`}
                    />
                  </View>
                </View>
              </View>
              {f.replaced.length > 0 ? (
                <AppText variant="small" color={colors.onHighlight} style={styles.inlineNotice}>
                  {`Some colors are no longer available and were replaced by the original ones: ${f.replaced.join(', ')}.`}
                </AppText>
              ) : null}
              {f.parts.map((p) => (
                <View key={p.zoneId} style={styles.part}>
                  <Swatch
                    hex={p.hex}
                    alpha={p.alpha}
                    texture={p.textureUrl}
                    size={tokens.swatch.sm}
                    accessibilityLabel={`Color ${p.ref}`}
                  />
                  <AppText variant="small" style={styles.partText}>
                    {`${p.zoneName} · ${MATERIAL_LABEL[p.material]}: Color ${p.ref}${p.finish ? ` · ${FINISH_LABEL[p.finish]}` : ''}`}
                  </AppText>
                </View>
              ))}
              {formSummary(f.line.form).length > 0 ? (
                <View style={styles.form}>
                  <AppText variant="tiny" color={colors.muted}>
                    CUSTOMIZING FORM
                  </AppText>
                  {formSummary(f.line.form).map((t) => (
                    <AppText key={t} variant="small">
                      {t}
                    </AppText>
                  ))}
                </View>
              ) : null}
              {!f.model ? (
                <AppText variant="small" color={colors.danger}>
                  This model was removed from the collection. Remove it to send the order.
                </AppText>
              ) : null}
              {f.missing.map((name) => (
                <AppText key={name} variant="small" color={colors.danger}>
                  {`${name}: no color available. Remove this frame to send the order.`}
                </AppText>
              ))}
              <QuantityStepper
                label="Frames"
                value={f.line.quantity}
                onChange={(q) => cart.setQuantity(f.line.id, q)}
                max={QUANTITY_MAX}
                disabled={!!busy}
              />
            </Card>
          );
        })}

        <Button
          title="Add another frame"
          variant="secondary"
          icon="add"
          fullWidth
          disabled={!!busy}
          onPress={() => router.dismissTo('/')}
        />

        {profileFailed && !profile ? (
          <Card style={styles.notice}>
            <AppText variant="small" color={colors.onHighlight}>
              {"Couldn't load your account. Check your connection."}
            </AppText>
            <Button
              title="Try again"
              variant="ghost"
              size="sm"
              onPress={reloadProfile}
              style={styles.editBusiness}
            />
          </Card>
        ) : null}
        {profile && !approved ? (
          <Card style={styles.notice}>
            <AppText variant="small" color={colors.onHighlight}>
              {profile.status === 'rejected'
                ? 'Your account has not been approved for orders. Please contact TAITIT.'
                : 'Your account is waiting for approval by TAITIT. You can send this order once it is approved.'}
            </AppText>
            <Button
              title="Check again"
              variant="ghost"
              size="sm"
              icon="refresh-outline"
              onPress={reloadProfile}
              style={styles.editBusiness}
            />
          </Card>
        ) : null}
        <Card style={styles.business}>
          <AppText variant="tiny">ORDERING AS</AppText>
          {profile?.business_name ? (
            <>
              <AppText variant="subheading">{profile.business_name}</AppText>
              <AppText variant="small">
                {[
                  profile.tax_id,
                  [profile.address, profile.postal_code, profile.city].filter(Boolean).join(', '),
                  profile.phone,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
              {profile.labeling ? (
                <AppText variant="small">Name on the glasses: {profile.labeling}</AppText>
              ) : null}
              <AppText variant="small">
                Delivery:{' '}
                {profile.delivery_address
                  ? addressLine(
                      profile.delivery_address,
                      profile.delivery_postal_code,
                      profile.delivery_city,
                      profile.delivery_province,
                    )
                  : addressLine(profile.address, profile.postal_code, profile.city, profile.province)}
              </AppText>
            </>
          ) : null}
          {profile && !hasBusiness ? (
            <AppText variant="small" color={tokens.colors.danger}>
              Add your business details (business name, tax ID, phone, address, postal code, city and the name
              on the glasses) to send orders.
            </AppText>
          ) : null}
          <Button
            title={hasBusiness ? 'Edit' : 'Add business details'}
            variant="ghost"
            size="sm"
            icon="create-outline"
            onPress={() => router.push('/business')}
            style={styles.editBusiness}
          />
        </Card>
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
        {busy ? (
          <AppText variant="small" align="center" style={styles.blocked}>
            {busy}
          </AppText>
        ) : blockedReason ? (
          <AppText variant="small" align="center" style={styles.blocked}>
            {blockedReason}
          </AppText>
        ) : null}
        <Button
          title={`Send order · ${totalFrames} ${totalFrames === 1 ? 'frame' : 'frames'}`}
          fullWidth
          loading={!!busy}
          disabled={unavailable || refreshing || !approved || !hasBusiness}
          onPress={confirm}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: PAGE, gap: spacing.lg },
  frame: { gap: spacing.md },
  frameTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: {
    width: THUMB,
    minHeight: THUMB * 0.45,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  frameHead: { flex: 1, gap: 2 },
  frameActions: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -spacing.sm },
  pressed: { opacity: 0.7 },
  part: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  partText: { flex: 1 },
  form: { gap: 2, paddingTop: spacing.xs },
  inlineNotice: { backgroundColor: colors.highlight, padding: spacing.sm, borderRadius: radius.sm },
  notice: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  blocked: { marginBottom: spacing.sm },
  business: { gap: 2 },
  editBusiness: { alignSelf: 'flex-start', marginTop: tokens.spacing.xs },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
