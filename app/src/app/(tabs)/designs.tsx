import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { buildRenderPlan, tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { useCatalog, useSwatches } from '@/catalog/useCatalog';
import type { CatalogModel, CatalogSwatch } from '@/catalog/catalog';
import { copyName, restorePicks, type Design } from '@/designs/designs';
import { useDesignMutations, useDesigns } from '@/designs/useDesigns';
import { NameSheet } from '@/designs/NameSheet';
import { RecolorView } from '@/render/RecolorView';
import { AppText, Button, Card, EmptyState, Icon, Screen, Sheet, Skeleton, useToast } from '@/ui';

const { spacing, colors, radius } = tokens;
const PAGE = spacing.xl;
const CARD_PAD = spacing.lg;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

export default function DesignsScreen() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const designs = useDesigns();
  const catalog = useCatalog();
  const swatches = useSwatches();
  const { create, update, remove } = useDesignMutations();
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<Design | null>(null);
  const [renaming, setRenaming] = useState<Design | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const imageWidth = width - PAGE * 2 - CARD_PAD * 2;

  if (!session)
    return (
      <Screen>
        <Card>
          <EmptyState
            icon="heart-outline"
            title="Save your designs"
            message="Sign in to keep the designs you create and open them on any device."
            actionLabel="Sign in"
            onAction={() => router.push('/sign-in')}
          />
        </Card>
      </Screen>
    );

  if (designs.isPending || catalog.isPending || swatches.isPending)
    return (
      <View style={styles.list}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.skeletonCard}>
            <Skeleton height={(imageWidth * 556) / 1600} radius={radius.md} />
            <Skeleton width="45%" height={18} />
            <Skeleton width="30%" height={12} />
          </View>
        ))}
      </View>
    );

  if (
    (designs.isError && !designs.data) ||
    (catalog.isError && !catalog.data) ||
    (swatches.isError && !swatches.data)
  )
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your designs"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            void designs.refetch();
            void catalog.refetch();
            void swatches.refetch();
          }}
        />
      </Screen>
    );

  const list = designs.data ?? [];
  const models = new Map((catalog.data ?? []).map((m) => [m.id, m]));
  const palette = swatches.data ?? [];

  const open = (d: Design) => {
    if (!models.has(d.modelId)) return toast('This model is no longer available', 'error');
    router.push({ pathname: '/customize/[modelId]', params: { modelId: d.modelId, designId: d.id } });
  };
  const duplicate = async (d: Design) => {
    try {
      await create.mutateAsync({ modelId: d.modelId, name: copyName(d.name), selection: d.selection });
      toast('Design duplicated', 'success');
    } catch {
      toast("Couldn't duplicate. Check your connection and try again.", 'error');
    }
  };
  const confirmDelete = (d: Design) =>
    Alert.alert('Delete design?', `"${d.name}" will be deleted. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(d.id, {
            onSuccess: () => toast('Design deleted'),
            onError: () => toast("Couldn't delete. Check your connection and try again.", 'error'),
          }),
      },
    ]);
  const rename = async (name: string) => {
    if (!renaming) return;
    try {
      await update.mutateAsync({ id: renaming.id, name });
      toast('Design renamed', 'success');
    } catch {
      return "Couldn't rename. Check your connection and try again.";
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([designs.refetch(), catalog.refetch(), swatches.refetch()]);
    setRefreshing(false);
  };
  // Menu actions run after the menu has closed (one sheet at a time).
  const fromMenu = (action: (d: Design) => void) => () => {
    const d = menuFor;
    setMenuFor(null);
    if (d) setTimeout(() => action(d), 250);
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={list}
        keyExtractor={(d) => d.id}
        contentContainerStyle={[styles.list, list.length === 0 && styles.grow]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        windowSize={5}
        ListEmptyComponent={
          <View style={styles.center}>
            <EmptyState
              icon="heart-outline"
              title="No designs yet"
              message="Customize a model and save it to find it here."
              actionLabel="Go to catalog"
              onAction={() => router.navigate('/')}
            />
          </View>
        }
        renderItem={({ item }) => (
          <DesignCard
            design={item}
            model={models.get(item.modelId)}
            swatches={palette}
            imageWidth={imageWidth}
            onOpen={() => open(item)}
            onMenu={() => setMenuFor(item)}
          />
        )}
      />
      <Sheet visible={!!menuFor} title={menuFor?.name} onClose={() => setMenuFor(null)}>
        <View style={styles.menu}>
          {menuFor && models.has(menuFor.modelId) ? (
            <Button title="Open" icon="color-palette-outline" variant="ghost" onPress={fromMenu(open)} />
          ) : null}
          <Button title="Rename" icon="create-outline" variant="ghost" onPress={fromMenu(setRenaming)} />
          <Button title="Duplicate" icon="copy-outline" variant="ghost" onPress={fromMenu(duplicate)} />
          <Button title="Delete" icon="trash-outline" variant="danger" onPress={fromMenu(confirmDelete)} />
        </View>
      </Sheet>
      <NameSheet
        visible={!!renaming}
        title="Rename design"
        initialName={renaming?.name ?? ''}
        submitLabel="Rename"
        onSubmit={rename}
        onClose={() => setRenaming(null)}
      />
    </View>
  );
}

function DesignCard({
  design,
  model,
  swatches,
  imageWidth,
  onOpen,
  onMenu,
}: {
  design: Design;
  model: CatalogModel | undefined;
  swatches: CatalogSwatch[];
  imageWidth: number;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const restored = model ? restorePicks(model.zones, swatches, design.selection) : null;
  return (
    <Card onPress={onOpen} accessibilityLabel={`Open ${design.name}`} style={styles.card}>
      {model && restored ? (
        <RecolorView
          width={imageWidth}
          plan={buildRenderPlan({
            baseUrl: model.plan.baseUrl,
            width: model.plan.width,
            height: model.plan.height,
            zones: model.zones,
            swatches,
            picks: restored.picks,
          })}
        />
      ) : (
        <View style={[styles.unavailable, { width: imageWidth, height: (imageWidth * 556) / 1600 }]}>
          <Icon name="eye-off-outline" color={colors.muted} />
          <AppText variant="small">This model is no longer available</AppText>
        </View>
      )}
      <View style={styles.row}>
        <View style={styles.info}>
          <AppText variant="subheading" numberOfLines={1}>
            {design.name}
          </AppText>
          <AppText variant="small">
            {model?.name ?? 'Unavailable model'} · {formatDate(design.updatedAt)}
          </AppText>
          {restored && restored.replaced.length > 0 ? (
            <AppText variant="tiny" color={colors.muted}>
              Some colors are no longer available
            </AppText>
          ) : null}
        </View>
        <Pressable
          onPress={onMenu}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${design.name}`}
          style={styles.more}
        >
          <Icon name="ellipsis-horizontal" />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: PAGE, gap: spacing.lg },
  grow: { flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center' },
  skeletonCard: {
    gap: spacing.sm,
    padding: CARD_PAD,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: { gap: spacing.md },
  unavailable: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  more: { padding: spacing.sm },
  menu: { gap: spacing.xs },
});
