"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MissionEditor } from "./MissionEditor";
import { PreparationWorkbench } from "./PreparationWorkbench";
import { checkMission, emptyMission, summarize } from "@/lib/admin/mission-draft";
import type { MissionConfig } from "@/lib/inventory/mission-config";

/**
 * Poste de travail des deux administrateurs : la mission et sa préparation
 * partagent un même état, sinon l'une ignorerait ce que l'autre déclare.
 *
 * Tout vit dans le navigateur du poste. À deux personnes, ajouter une table,
 * une migration et un contrôle d'accès coûterait plus que l'échange d'un
 * fichier exporté.
 */
const MISSION_KEY = "preuvance.mission.v1";

export function MissionConsole() {
  const [mission, setMission] = useState<MissionConfig>(() => emptyMission());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MISSION_KEY);
      if (!raw) return;
      const verdict = checkMission(JSON.parse(raw));
      if (verdict.valid) setMission(verdict.mission);
    } catch {
      // Un brouillon illisible ne doit pas bloquer l'écran : on repart d'une
      // mission vierge plutôt que d'afficher une erreur au chargement.
    }
  }, []);

  const persist = useCallback((next: MissionConfig) => {
    setMission(next);
    try {
      window.localStorage.setItem(MISSION_KEY, JSON.stringify(next));
    } catch {
      // Stockage plein ou refusé : l'écran reste utilisable, l'export sauve.
    }
  }, []);

  // Seules les sources d'une mission valide alimentent la préparation : un
  // brouillon à moitié saisi produirait des demandes d'accès sans nom.
  const sources = useMemo(() => {
    const verdict = checkMission(mission);
    return verdict.valid ? summarize(verdict.mission).acces : [];
  }, [mission]);

  return (
    <>
      <MissionEditor mission={mission} onChange={persist} />
      <PreparationWorkbench
        sources={sources}
        client={mission.mission.client}
        reference={mission.mission.reference}
      />
    </>
  );
}
