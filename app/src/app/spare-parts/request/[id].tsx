import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { tokens } from '@taitit/shared';
import { formatOrderDate } from '@/orders/orders';
import { partSummary } from '@/spareParts/spareParts';
import { useSparePartRequest } from '@/spareParts/useSpareParts';
import { SparePartsSignIn } from '@/spareParts/SparePartsSignIn';
import { useAuth } from '@/auth/AuthProvider';
import { AppText, Card, EmptyState, Icon, Loader, Screen, useDesktop, useReadingWidth } from '@/ui';

const { spacing, colors, radius } = tokens;

/** A sent request: what was asked for and its 3 photos, large. TAITIT contacts the optician. */
export default function SparePartRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useSparePartRequest(id);
  const width = useReadingWidth() - spacing.xl * 2;
  const desktop = useDesktop();
  const { session } = useAuth();

  // Opened by its address while signed out (the request is never loaded for guests).
  if (!session) return <SparePartsSignIn />;
  if (request.isPending) return <Loader />;
  if (!request.data)
    return (
      <Screen>
        <EmptyState
          icon={request.isError ? 'cloud-offline-outline' : 'document-text-outline'}
          title={request.isError ? "Couldn't load the request" : 'Request not found'}
          message={
            request.isError ? 'Check your connection and try again.' : 'It may belong to another account.'
          }
          actionLabel={request.isError ? 'Try again' : 'Back'}
          onAction={() => (request.isError ? void request.refetch() : router.back())}
        />
      </Screen>
    );

  const r = request.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: `Request #${r.number}` }} />
      <View style={styles.head}>
        <AppText variant="heading">{r.modelName}</AppText>
        <AppText variant="small">
          {partSummary(r.part, r.side)} · Sent {formatOrderDate(r.createdAt)}
        </AppText>
      </View>
      <Card style={styles.info}>
        <Icon name="information-circle-outline" size={20} color={colors.text} />
        <AppText variant="small" style={styles.infoText}>
          TAITIT has your request. The warehouse or your sales rep will contact you about it.
        </AppText>
      </Card>
      {r.note ? (
        <View style={styles.section}>
          <AppText variant="label">Note</AppText>
          <AppText>{r.note}</AppText>
        </View>
      ) : null}
      <View style={styles.section}>
        <AppText variant="label">Photos</AppText>
        {desktop ? (
          // Computer: the three side by side; each opens full size in a new tab.
          <View style={styles.thumbs}>
            {r.photoUrls.map((url, i) => (
              <Pressable
                key={r.photoPaths[i] ?? i}
                accessibilityRole="link"
                accessibilityLabel={`Photo ${i + 1}, open full size`}
                disabled={!url}
                onPress={() => url && void Linking.openURL(url)}
                style={(s) => [styles.thumb, (s as { hovered?: boolean }).hovered && styles.thumbHovered]}
              >
                {url ? (
                  <Image
                    source={{ uri: url, cacheKey: r.photoPaths[i] }}
                    style={styles.thumbImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <AppText variant="small" color={colors.muted}>
                    Photo {i + 1} could not be loaded.
                  </AppText>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          r.photoUrls.map((url, i) => (
            <Photo key={r.photoPaths[i] ?? i} url={url} cacheKey={r.photoPaths[i]} width={width} index={i} />
          ))
        )}
      </View>
    </Screen>
  );
}

function Photo({
  url,
  cacheKey,
  width,
  index,
}: {
  url: string | null;
  cacheKey?: string;
  width: number;
  index: number;
}) {
  // Width / height of the photo, read from the file once loaded (portrait or landscape).
  const [aspect, setAspect] = useState(4 / 3);
  if (!url)
    return (
      <View style={[styles.photo, styles.missing, { width, height: width / aspect }]}>
        <AppText variant="small" color={colors.muted}>
          Photo {index + 1} could not be loaded.
        </AppText>
      </View>
    );
  return (
    <Image
      source={{ uri: url, cacheKey }}
      style={[styles.photo, { width, height: width / aspect }]}
      contentFit="contain"
      cachePolicy="memory-disk"
      accessibilityLabel={`Photo ${index + 1}`}
      onLoad={(e) => e.source.width && e.source.height && setAspect(e.source.width / e.source.height)}
    />
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  info: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  infoText: { flex: 1 },
  section: { gap: spacing.sm },
  photo: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  missing: { alignItems: 'center', justifyContent: 'center' },
  thumbs: { flexDirection: 'row', gap: spacing.sm },
  thumb: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  thumbHovered: { opacity: 0.85 },
  thumbImage: { width: '100%', height: '100%' },
});
