import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { renderKey } from '@taitit/shared';
import { listModels, modelKeys } from '../lib/models';
import { listAllZones } from '../lib/zones';
import { listSwatches, swatchKeys } from '../lib/swatches';
import { defaultPlan, saveThumbnail } from '../lib/thumbnails';

const RETRY_MS = 60_000;

/**
 * Keeps every model's catalog thumbnail current, in the background, while an admin uses the panel:
 * after a model, zone or color change, models whose thumbnail no longer matches their default colors
 * are re-rendered one at a time. (The app never shows a stale thumbnail either way: it renders live
 * until this has run.) Renders nothing.
 */
export function ThumbnailRefresher() {
  const queryClient = useQueryClient();
  const models = useQuery({ queryKey: modelKeys.all, queryFn: listModels });
  const zones = useQuery({ queryKey: modelKeys.allZones, queryFn: listAllZones });
  const swatches = useQuery({ queryKey: swatchKeys.all, queryFn: listSwatches });
  const [tick, setTick] = useState(0); // re-runs the check (after a run with pending changes, or a retry)
  const running = useRef(false);
  const dirty = useRef(false); // data changed while a run was busy
  const degraded = useRef(new Set<string>()); // model+key whose render had a broken texture: don't retry
  const retryAt = useRef(new Map<string, number>()); // model+key → time of the next attempt after an error
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!models.data || !zones.data || !swatches.data) return;
    if (running.current) {
      dirty.current = true; // checked again when the current run ends
      return;
    }
    const now = Date.now();
    const stale = models.data
      .map((m) => {
        const plan = defaultPlan(m, zones.data, swatches.data);
        return plan ? { id: m.id, plan, key: renderKey(plan), stored: m.thumb_key } : null;
      })
      .filter((x) => x !== null && x.key !== x.stored)
      .filter(
        (x) =>
          !degraded.current.has(`${x!.id}:${x!.key}`) &&
          (retryAt.current.get(`${x!.id}:${x!.key}`) ?? 0) <= now,
      );
    if (!stale.length) return;
    running.current = true;
    void (async () => {
      let changed = 0;
      for (const x of stale) {
        const id = `${x!.id}:${x!.key}`;
        try {
          const result = await saveThumbnail(x!.id, x!.plan);
          if (result === 'degraded') degraded.current.add(id);
          else changed++; // saved, or someone else saved first: refresh either way
          retryAt.current.delete(id);
        } catch {
          // network / storage error: try again later (the app renders this model live meanwhile)
          retryAt.current.set(id, Date.now() + RETRY_MS);
          timers.current.push(window.setTimeout(() => setTick((t) => t + 1), RETRY_MS + 1000));
        }
      }
      running.current = false;
      if (changed) void queryClient.invalidateQueries({ queryKey: modelKeys.all });
      if (dirty.current) {
        dirty.current = false;
        setTick((t) => t + 1);
      }
    })();
  }, [models.data, zones.data, swatches.data, queryClient, tick]);

  return null;
}
