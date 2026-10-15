import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps } from 'react';
import { ColorValue } from 'react-native';
import { tokens } from '@taitit/shared';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({
  name,
  size = 22,
  color = tokens.colors.text,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
