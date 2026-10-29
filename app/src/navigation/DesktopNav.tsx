import { useEffect, type ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
import { TopBar, setPageTitle, type Section } from './TopBar';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** A tab's route name as the bar's section ("index" is the catalog). */
const sectionOf = (name: string) => (name === 'index' ? 'catalog' : name) as Section;

/**
 * The web on a computer, tab pages: the top bar (TopBar) instead of the phone's floating bar at the
 * bottom. Same tabs, same events as the standard bar; the browser tab shows the section's name.
 */
export function DesktopNav({ state, descriptors, navigation }: TabBarProps) {
  const route = state.routes[state.index]!;
  const title = descriptors[route.key]?.options.title;
  useEffect(() => setPageTitle(title), [title]);

  const go = (key: Section) => {
    const index = state.routes.findIndex((r) => sectionOf(r.name) === key);
    if (index < 0) return;
    const target = state.routes[index]!;
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) navigation.navigate(target.name, target.params);
  };

  return <TopBar active={sectionOf(route.name)} onSection={go} />;
}
