import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { avecLive, type EtatReunion, etatDe } from '../etatReunion';
import type { OrgValue } from '../organisation';
import { participantsReunion } from '../reunions';
import type { PointReunion, Reunion } from '../types';

/** Hors de la fenêtre d'une réunion : relecture des lignes d'état toutes les 60 s (une lecture par Sheet concerné) */
export const RELECTURE_HORS_FENETRE_MS = 60_000;

/**
 * Réunions lancées du jour (07/10) : pour le bandeau de réunion et l'ouverture au démarrage. Seules les réunions à
 * plusieurs ont une ligne d'état ; on relit celles du jour, une lecture par Sheet, au démarrage puis toutes les 60 s
 * quand l'application est à l'écran. `pret` : le premier tour est fait (l'ouverture au démarrage l'attend).
 */
export function useReunionsLancees(o: {
  actif: boolean;
  reunions: Reunion[];
  org: OrgValue;
  lirePoints: (espace: string, prefixe: string) => Promise<PointReunion[]>;
}) {
  const { actif, reunions, org, lirePoints } = o;
  const [etats, setEtats] = useState<Record<string, EtatReunion>>({});
  const [pret, setPret] = useState(false);
  /** Relire tout de suite (fenêtre de réunion refermée) */
  const [relance, setRelance] = useState(0);
  const aSuivre = reunions.filter((r) => !!r.niveau && avecLive(participantsReunion(r, org).length));
  const cle = aSuivre.map((r) => r.id).join('|');
  const lire = useRef(lirePoints);
  lire.current = lirePoints;

  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    let minuterie: ReturnType<typeof setTimeout> | null = null;
    const tour = async () => {
      if (!vivant) return;
      if (AppState.currentState === 'active' && aSuivre.length) {
        const espaces = [...new Set(aSuivre.map((r) => r.espace || 'moi'))];
        const out: Record<string, EtatReunion> = {};
        for (const esp of espaces) {
          try {
            const l = await lire.current(esp, '');
            for (const r of aSuivre.filter((x) => (x.espace || 'moi') === esp)) {
              const e = etatDe(l, r.id);
              if (e) out[r.id] = e;
            }
          } catch {
            // Quota ou réseau : au tour suivant
          }
        }
        if (vivant) setEtats(out);
      }
      if (vivant) {
        setPret(true);
        minuterie = setTimeout(tour, RELECTURE_HORS_FENETRE_MS);
      }
    };
    tour();
    const ecoute = AppState.addEventListener('change', (s) => s === 'active' && (minuterie && clearTimeout(minuterie), tour()));
    return () => {
      vivant = false;
      if (minuterie) clearTimeout(minuterie);
      ecoute.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, cle, relance]);

  /** Une réunion vient d'être ouverte, publiée ou finie ici : son état est mis à jour sans attendre */
  const noter = (id: string, e: EtatReunion | null) =>
    setEtats((m) => {
      const n = { ...m };
      if (e) n[id] = e;
      else delete n[id];
      return n;
    });
  return { etats, pret, noter, relire: () => setRelance((n) => n + 1) };
}
