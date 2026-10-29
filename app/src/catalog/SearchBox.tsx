import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText, Icon, webNoOutline } from '@/ui';
import { fonts } from '@/ui/fonts';

const { spacing, colors, radius, touch } = tokens;

/**
 * Search, in the free top of the right column (the staggered grid leaves it open). Tapped, the same pill
 * becomes the search field (focus and keyboard); its × clears and closes it. The catalog and Spare parts.
 */
export function SearchBox({
  height,
  open,
  query,
  onChange,
  onOpen,
  onClose,
  persistent = false,
}: {
  height: number;
  open: boolean;
  query: string;
  onChange: (q: string) => void;
  onOpen: () => void;
  onClose: () => void;
  /** Always open (computer's toolbar): no focus on load, the × only clears what was typed. */
  persistent?: boolean;
}) {
  const size = { height: Math.max(touch.minSize, height) };
  const icon = (
    <View style={styles.searchIcon}>
      <Icon name="search" size={18} color={colors.text} />
    </View>
  );
  if (!open)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search models"
        onPress={onOpen}
        style={({ pressed }) => [styles.searchPill, size, pressed && styles.pressed]}
      >
        {icon}
        <AppText variant="subheading">Search</AppText>
      </Pressable>
    );
  return (
    <View style={[styles.searchPill, styles.searchOpen, size]}>
      {icon}
      <TextInput
        value={query}
        onChangeText={onChange}
        placeholder="Search"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Search models"
        autoFocus={!persistent}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
      />
      {!persistent || query ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={persistent ? 'Clear search' : 'Close search'}
          onPress={onClose}
          hitSlop={10}
        >
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchPill: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  searchOpen: { gap: spacing.sm, paddingRight: spacing.md, borderWidth: 1.5, borderColor: colors.focus },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: fonts.headingMedium,
    fontSize: 17,
    color: colors.text,
    ...webNoOutline,
  },
  searchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.selected,
  },
  pressed: { opacity: 0.8 },
});
