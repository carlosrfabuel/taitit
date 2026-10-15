import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ORDER_STATUSES, tokens } from '@taitit/shared';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  Screen,
  Skeleton,
  StatusBadge,
  Swatch,
  TextField,
  useToast,
} from '@/ui';

// Sample palette: solid, translucent and metal swatches (real colors come from the client's chart).
const SAMPLES = [
  { name: 'Negro', hex: '#1E1E22' },
  { name: 'Verde neón', hex: '#4CFF5A' },
  { name: 'Rosa translúcido', hex: '#E8434F', alpha: 0.55 },
  { name: 'Cristal', hex: '#F4F1EA', alpha: 0.45 },
  { name: 'Oro', hex: '#C9A45C' },
  { name: 'Azul', hex: '#2A6FDB' },
];

// Development-only gallery of the UI kit. Reachable from Cuenta while __DEV__.
export default function UiKitScreen() {
  const toast = useToast();
  const [chip, setChip] = useState('Todos');
  const [swatch, setSwatch] = useState(0);
  const [loading, setLoading] = useState(false);

  return (
    <Screen>
      <Section title="Tipografía">
        <AppText variant="title">Título</AppText>
        <AppText variant="heading">Encabezado</AppText>
        <AppText variant="subheading">Subencabezado</AppText>
        <AppText>Texto normal del cuerpo.</AppText>
        <AppText variant="small">Texto secundario pequeño.</AppText>
      </Section>

      <Section title="Botones">
        <Button title="Principal" icon="cart-outline" onPress={() => toast('Botón principal', 'success')} />
        <Button title="Secundario" variant="secondary" onPress={() => toast('Botón secundario')} />
        <Button
          title="Eliminar"
          variant="danger"
          icon="trash-outline"
          onPress={() => toast('Error de ejemplo', 'error')}
        />
        <Button
          title="Con carga"
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1500);
          }}
        />
        <View style={styles.row}>
          <Button title="Pequeño" size="sm" />
          <Button title="Fantasma" size="sm" variant="ghost" />
          <Button title="Desactivado" size="sm" disabled />
        </View>
      </Section>

      <Section title="Campos">
        <TextField
          label="Email"
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField label="Contraseña" placeholder="••••••••" revealable />
        <TextField label="Con error" defaultValue="correo-no-valido" error="Introduce un email válido." />
      </Section>

      <Section title="Filtros">
        <View style={styles.row}>
          {['Todos', 'Graduadas', 'Sol'].map((c) => (
            <Chip key={c} label={c} selected={chip === c} onPress={() => setChip(c)} />
          ))}
        </View>
      </Section>

      <Section title="Muestras de color">
        <View style={styles.row}>
          {SAMPLES.map((s, i) => (
            <Swatch
              key={s.name}
              hex={s.hex}
              alpha={s.alpha}
              selected={swatch === i}
              onPress={() => setSwatch(i)}
              accessibilityLabel={s.name}
            />
          ))}
        </View>
        <AppText variant="small">Seleccionado: {SAMPLES[swatch]?.name}</AppText>
      </Section>

      <Section title="Estados de pedido">
        <View style={styles.row}>
          {ORDER_STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </View>
      </Section>

      <Section title="Tarjeta y carga">
        <Card onPress={() => toast('Tarjeta pulsada')} accessibilityLabel="Tarjeta de ejemplo">
          <AppText variant="subheading">PHILEAS</AppText>
          <AppText variant="small">Titanio + acetato</AppText>
        </Card>
        <Skeleton height={120} radius={tokens.radius.lg} />
        <Skeleton width="60%" />
      </Section>

      <Section title="Vacío">
        <Card>
          <EmptyState
            icon="heart-outline"
            title="Aún no tienes diseños"
            message="Personaliza un modelo y guárdalo para verlo aquí."
            actionLabel="Ir al catálogo"
            onAction={() => toast('Acción')}
          />
        </Card>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="tiny" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.spacing.md, marginBottom: tokens.spacing.md },
  sectionTitle: { letterSpacing: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, alignItems: 'center' },
});
