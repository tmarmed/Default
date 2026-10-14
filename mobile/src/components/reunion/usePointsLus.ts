/**
 * Lecture commune des points de réunion (14/10, refactoring lot 4) : une lecture du Sheet de l'espace quand `cle`
 * change (et à `relire`), ignorée si la fenêtre s'est refermée entre-temps ; erreur (quota, réseau) : liste vide.
 * `points` vaut null pendant la première lecture ; `modifier` : changement local après une écriture. `lecture` null : rien à lire pour l'instant.
 */
import { useEffect, useRef, useState } from 'react';
import type { PointReunion } from '../../types';

export function usePointsLus(lecture: (() => Promise<PointReunion[]>) | null, cle: string): { points: PointReunion[] | null; relire: () => void; modifier: (f: (l: PointReunion[]) => PointReunion[]) => void } {
  const [points, setPoints] = useState<PointReunion[] | null>(null);
  const [tour, setTour] = useState(0);
  const lire = useRef(lecture);
  lire.current = lecture;
  useEffect(() => setPoints(null), [cle]);
  useEffect(() => {
    if (!lire.current) return;
    let vivant = true;
    lire.current()
      .then((l) => vivant && setPoints(l))
      .catch(() => vivant && setPoints((x) => x ?? []));
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, tour, !!lecture]);
  return { points, relire: () => setTour((t) => t + 1), modifier: (f) => setPoints((x) => f(x ?? [])) };
}

/** Points de plusieurs espaces (ou séries) en une fois : une lecture chacun, celles qui échouent sont ignorées */
export async function lirePlusieurs(lectures: (() => Promise<PointReunion[]>)[]): Promise<PointReunion[]> {
  const r = await Promise.allSettled(lectures.map((f) => f()));
  return r.flatMap((x) => (x.status === 'fulfilled' ? x.value : []));
}
