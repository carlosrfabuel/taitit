import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { useQueryClient } from '@tanstack/react-query';
import { tokens } from '@taitit/shared';
import { canOrder, useAuth } from '@/auth/AuthProvider';
import { businessComplete } from '@/auth/business';
import { useCatalog } from '@/catalog/useCatalog';
import { ModelImage } from '@/catalog/ModelImage';
import type { CatalogModel } from '@/catalog/catalog';
import {
  NOTE_MAX,
  PART_LABEL,
  PHOTOS_REQUIRED,
  SIDE_LABEL,
  preparePhoto,
  sendSparePartRequest,
  sparePartErrorMessage,
  sparePartKeys,
  type PreparedPhoto,
  type SparePart,
  type TempleSide,
} from '@/spareParts/spareParts';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Loader,
  Screen,
  Sheet,
  TextField,
  useReadingWidth,
  useToast,
} from '@/ui';

const { spacing, colors, radius } = tokens;
const PAGE = spacing.xl;
const SLOT_GAP = spacing.sm;
const PARTS: SparePart[] = ['front', 'temple'];
const SIDES: TempleSide[] = ['left', 'right', 'both'];

export default function SparePartScreen() {
  const { modelId } = useLocalSearchParams<{ modelId: string }>();
  const catalog = useCatalog();
  const model = catalog.data?.find((m) => m.id === modelId);
  if (catalog.isPending) return <Loader />;
  if (!model)
    return (
      <Screen>
        <EmptyState
          icon="glasses-outline"
          title="Model not available"
          message="This model is no longer in the catalog."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  return <RequestForm model={model} />;
}

function RequestForm({ model }: { model: CatalogModel }) {
  const { session, profile, profileFailed, reloadProfile } = useAuth();
  // Fresh account status and details each time the screen is shown (approval may have happened).
  useFocusEffect(useCallback(() => reloadProfile(), [reloadProfile]));
  const approved = canOrder(profile);
  const hasBusiness = businessComplete(profile);
  const toast = useToast();
  const queryClient = useQueryClient();
  const width = useReadingWidth();
  const contentWidth = width - PAGE * 2;
  const slot = Math.floor((contentWidth - SLOT_GAP * (PHOTOS_REQUIRED - 1)) / PHOTOS_REQUIRED);

  const [part, setPart] = useState<SparePart | null>(null);
  const [side, setSide] = useState<TempleSide | null>(null);
  const [photos, setPhotos] = useState<(PreparedPhoto | null)[]>(() => Array(PHOTOS_REQUIRED).fill(null));
  const [preparing, setPreparing] = useState<number | null>(null);
  const [note, setNote] = useState('');
  // The same key for every retry of this request: a lost answer never sends it twice.
  const [key] = useState(() => randomUUID());
  const [busy, setBusy] = useState(false);
  // The photo slot asking "camera or library" (phones; the web opens the file picker directly).
  const [choosing, setChoosing] = useState<number | null>(null);

  const ready = !!part && (part === 'front' || !!side) && photos.every(Boolean);

  const pick = async (index: number, source: 'camera' | 'library') => {
    setChoosing(null);
    if (Platform.OS !== 'web') {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast(
          source === 'camera'
            ? 'Allow TAITIT to use the camera in your phone settings.'
            : 'Allow TAITIT to use your photos in your phone settings.',
          'error',
        );
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    setPreparing(index);
    try {
      const photo = await preparePhoto(randomUUID(), asset.uri, asset.width, asset.height);
      setPhotos((ps) => ps.map((p, i) => (i === index ? photo : p)));
    } catch {
      toast("Couldn't use this photo. Try another one.", 'error');
    } finally {
      setPreparing(null);
    }
  };

  const addPhoto = (index: number) => {
    if (Platform.OS === 'web') void pick(index, 'library');
    else setChoosing(index);
  };

  const send = async () => {
    if (!session || !part || busy) return;
    setBusy(true);
    try {
      const sent = await sendSparePartRequest({
        userId: session.user.id,
        key,
        modelId: model.id,
        part,
        side,
        photos: photos.filter((p): p is PreparedPhoto => !!p),
        note,
      });
      await queryClient.invalidateQueries({ queryKey: sparePartKeys.all });
      toast(`Request #${sent.number} sent`, 'success');
      router.replace({ pathname: '/spare-parts/request/[id]', params: { id: sent.id } });
    } catch (e) {
      const message = (e as { message?: string } | null)?.message ?? '';
      if (/account_not_approved|business_details_missing/.test(message)) reloadProfile();
      toast(sparePartErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Why Send is off, said next to the button.
  const blockedReason = !profile
    ? profileFailed
      ? "Couldn't load your account."
      : null
    : !approved
      ? profile.status === 'rejected'
        ? 'Your account is not approved.'
        : 'Waiting for TAITIT to approve your account.'
      : !hasBusiness
        ? 'Add your business details first.'
        : !part
          ? 'Choose the part.'
          : part === 'temple' && !side
            ? 'Choose which temple.'
            : !photos.every(Boolean)
              ? `Add ${PHOTOS_REQUIRED} photos.`
              : null;

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {busy ? (
            <AppText variant="small" align="center">
              Sending…
            </AppText>
          ) : blockedReason ? (
            <AppText variant="small" align="center">
              {blockedReason}
            </AppText>
          ) : null}
          <Button
            title="Send request"
            fullWidth
            loading={busy}
            disabled={!ready || !approved || !hasBusiness || preparing !== null}
            onPress={send}
          />
        </View>
      }
    >
      <Stack.Screen options={{ title: model.name }} />
      <View style={styles.model}>
        <ModelImage model={model} width={Math.min(contentWidth, 420)} />
      </View>

      {profile && !approved ? (
        <Card style={styles.notice}>
          <AppText variant="small" color={colors.onHighlight}>
            {profile.status === 'rejected'
              ? 'Your account has not been approved. Please contact TAITIT.'
              : 'Your account is waiting for approval by TAITIT. You can send requests once it is approved.'}
          </AppText>
        </Card>
      ) : profile && !hasBusiness ? (
        <Card style={styles.notice}>
          <AppText variant="small" color={colors.onHighlight}>
            Add your business details so TAITIT can contact you about this part.
          </AppText>
          <Button
            title="Add business details"
            variant="ghost"
            size="sm"
            icon="create-outline"
            onPress={() => router.push('/business')}
            style={styles.noticeButton}
          />
        </Card>
      ) : null}

      <View style={styles.section}>
        <AppText variant="subheading">Which part?</AppText>
        <View style={styles.chips}>
          {PARTS.map((p) => (
            <Chip
              key={p}
              label={PART_LABEL[p]}
              selected={part === p}
              onPress={() => {
                setPart(p);
                if (p === 'front') setSide(null);
              }}
            />
          ))}
        </View>
      </View>

      {part === 'temple' ? (
        <View style={styles.section}>
          <AppText variant="subheading">Which temple?</AppText>
          <View style={styles.chips}>
            {SIDES.map((s) => (
              <Chip key={s} label={SIDE_LABEL[s]} selected={side === s} onPress={() => setSide(s)} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="subheading">Photos of the problem</AppText>
        <AppText variant="small" color={colors.muted}>
          {PHOTOS_REQUIRED} photos, from different angles.
        </AppText>
        <View style={styles.slots}>
          {photos.map((photo, i) => (
            <PhotoSlot
              key={i}
              index={i}
              size={slot}
              photo={photo}
              preparing={preparing === i}
              disabled={busy || (preparing !== null && preparing !== i)}
              onAdd={() => addPhoto(i)}
              onRemove={() => setPhotos((ps) => ps.map((p, j) => (j === i ? null : p)))}
            />
          ))}
        </View>
      </View>

      <TextField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        maxLength={NOTE_MAX}
        multiline
        style={styles.note}
        helper={`${Array.from(note).length}/${NOTE_MAX}`}
        placeholder="What happened? Anything TAITIT should know."
      />

      <Sheet visible={choosing !== null} title="Add photo" onClose={() => setChoosing(null)}>
        <Button
          title="Take photo"
          icon="camera-outline"
          fullWidth
          onPress={() => choosing !== null && void pick(choosing, 'camera')}
        />
        <Button
          title="Choose from library"
          icon="images-outline"
          variant="secondary"
          fullWidth
          onPress={() => choosing !== null && void pick(choosing, 'library')}
        />
        <Button title="Cancel" variant="ghost" fullWidth onPress={() => setChoosing(null)} />
      </Sheet>
    </Screen>
  );
}

function PhotoSlot({
  index,
  size,
  photo,
  preparing,
  disabled,
  onAdd,
  onRemove,
}: {
  index: number;
  size: number;
  photo: PreparedPhoto | null;
  preparing: boolean;
  disabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const box = { width: size, height: size };
  if (preparing)
    return (
      <View style={[styles.slot, box]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (photo)
    return (
      <View style={box}>
        <Image source={{ uri: photo.previewUri }} style={[styles.photo, box]} contentFit="cover" />
        <Pressable
          onPress={onRemove}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Remove photo ${index + 1}`}
          hitSlop={8}
          style={styles.remove}
        >
          <Icon name="close" size={16} color={colors.onPrimary} />
        </Pressable>
      </View>
    );
  return (
    <Pressable
      onPress={onAdd}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Add photo ${index + 1} of ${PHOTOS_REQUIRED}`}
      style={({ pressed }) => [styles.slot, styles.empty, box, pressed && styles.pressed]}
    >
      <Icon name="camera-outline" size={24} color={colors.muted} />
      <AppText variant="tiny" color={colors.muted}>
        Photo {index + 1}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  model: { alignItems: 'center' },
  notice: { backgroundColor: colors.highlight, borderColor: colors.highlight, gap: spacing.xs },
  noticeButton: { alignSelf: 'flex-start' },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slots: { flexDirection: 'row', gap: SLOT_GAP },
  slot: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border },
  pressed: { opacity: 0.7 },
  photo: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  remove: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  note: { minHeight: 96, textAlignVertical: 'top' },
  footer: { gap: spacing.sm },
});
