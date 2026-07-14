import React from "react";
import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { decisionScoreLabel } from "./assessment-payload";
import type {
  EvidenceStatus,
  GapPriority,
  PdfCrossCheckStatus,
  PreuvanceAssessment,
  RiskLevel,
} from "./assessment-payload";

const colors = {
  ink: "#0B1220",
  muted: "#566173",
  line: "#DDE2E8",
  paper: "#FAFAF7",
  white: "#FFFFFF",
  blue: "#2552F0",
  bluePale: "#EEF2FF",
  green: "#15803D",
  greenPale: "#ECFDF3",
  amber: "#B45309",
  amberPale: "#FFF7E8",
  red: "#B91C1C",
  redPale: "#FEF2F2",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.45,
    paddingTop: 62,
    paddingRight: 46,
    paddingBottom: 54,
    paddingLeft: 46,
  },
  header: {
    position: "absolute",
    top: 24,
    left: 46,
    right: 46,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: colors.blue,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 1.6,
  },
  headerMeta: { color: colors.muted, fontSize: 7.5 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 46,
    right: 46,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    color: colors.muted,
    fontSize: 7,
  },
  eyebrow: {
    color: colors.blue,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.3,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 29,
    lineHeight: 1.08,
    letterSpacing: -0.5,
    marginBottom: 12,
    maxWidth: 420,
  },
  subtitle: { color: colors.muted, fontSize: 11, maxWidth: 430, marginBottom: 24 },
  metaGrid: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 22,
  },
  metaItem: { width: "33.333%", paddingRight: 12 },
  label: {
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.8,
    letterSpacing: 0.7,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  value: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  scorePanel: {
    backgroundColor: colors.ink,
    color: colors.white,
    borderRadius: 8,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  scoreBlock: {
    width: 140,
    borderRightWidth: 1,
    borderRightColor: "#384152",
    marginRight: 20,
  },
  scoreNumber: { fontFamily: "Helvetica-Bold", fontSize: 46, lineHeight: 1 },
  scoreOutOf: { color: "#AEB7C6", fontSize: 8, marginTop: 4 },
  tier: {
    alignSelf: "flex-start",
    backgroundColor: colors.blue,
    color: colors.white,
    borderRadius: 12,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 9,
  },
  scoreSummary: { width: 320 },
  scoreSummaryTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 5 },
  scoreSummaryText: { color: "#D9DFE8", fontSize: 8.5 },
  section: { marginTop: 18 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionIndex: {
    backgroundColor: colors.blue,
    color: colors.white,
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: "center",
    paddingTop: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    marginRight: 8,
  },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 14 },
  body: { color: colors.ink, fontSize: 9.5 },
  muted: { color: colors.muted },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 4 },
  inlineRow: { flexDirection: "row", alignItems: "center" },
  riskBadge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    marginBottom: 7,
  },
  dimension: { marginBottom: 10 },
  dimensionTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  dimensionName: { fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  dimensionScore: { color: colors.blue, fontFamily: "Helvetica-Bold", fontSize: 8 },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E8ECF2",
    marginBottom: 4,
  },
  barFill: { height: 5, borderRadius: 3, backgroundColor: colors.blue },
  articleReference: { color: colors.blue, fontFamily: "Helvetica-Bold", fontSize: 8 },
  articleTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 2 },
  articleMeta: { color: colors.muted, fontSize: 7.5, marginTop: 5 },
  sourceLink: { color: colors.blue, fontSize: 7, marginTop: 4, textDecoration: "none" },
  priorityBadge: {
    borderRadius: 9,
    paddingVertical: 3,
    paddingHorizontal: 7,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    marginRight: 7,
  },
  gapTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, flexGrow: 1 },
  gapAction: {
    borderLeftWidth: 2,
    borderLeftColor: colors.blue,
    paddingLeft: 8,
    marginTop: 7,
    fontSize: 8.5,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 7 },
  chip: {
    backgroundColor: colors.bluePale,
    color: colors.blue,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 6.5,
    marginRight: 4,
    marginBottom: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.ink,
    color: colors.white,
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontSize: 7.5,
  },
  tableControl: { width: "31%", paddingRight: 8 },
  tableStatus: { width: "18%", paddingRight: 8 },
  tableDetail: { width: "51%" },
  brokerGrid: { flexDirection: "row", flexWrap: "wrap" },
  brokerItem: { width: "50%", paddingRight: 14, marginBottom: 10 },
  disclaimer: {
    marginTop: 16,
    backgroundColor: colors.bluePale,
    borderLeftWidth: 3,
    borderLeftColor: colors.blue,
    padding: 10,
    color: colors.muted,
    fontSize: 7.5,
  },
});

export function createPreuvanceReportDocument(assessment: PreuvanceAssessment) {
  const generatedDate = formatDate(assessment.generatedAt);
  const riskStyle = riskBadgeStyle(assessment.result.riskLevel);

  // Les sections 05+ sont conditionnelles : leur numéro est calculé pour
  // rester consécutif quel que soit le payload validé par le schéma.
  let sectionNumber = 4;
  const nextSectionIndex = () => String(++sectionNumber).padStart(2, "0");
  const journalIndex =
    assessment.crossCheck || assessment.decisionLog?.length
      ? nextSectionIndex()
      : null;
  const evidenceIndex = assessment.evidence?.length ? nextSectionIndex() : null;
  const brokerIndex = assessment.brokerContext ? nextSectionIndex() : null;

  return (
    <Document
      author="PREUVANCE"
      creator="PREUVANCE"
      keywords="EU AI Act, risque IA, assurabilité, conformité"
      subject={`Préparation au risque IA — ${assessment.system.name}`}
      title={`Rapport PREUVANCE — ${assessment.system.name}`}
    >
      <Page size="A4" style={styles.page} wrap>
        <ReportHeader assessmentId={assessment.assessmentId} />

        <Text style={styles.eyebrow}>Rapport confidentiel · préparation courtier</Text>
        <Text style={styles.title}>Rapport de préparation au risque IA</Text>
        <Text style={styles.subtitle}>
          Lecture structurée du système, de son exposition réglementaire et des
          mesures qui renforcent sa présentation à un courtier ou à un assureur.
        </Text>

        <View style={styles.metaGrid}>
          <MetaItem label="Organisation" value={assessment.organization.name} />
          <MetaItem label="Système évalué" value={assessment.system.name} />
          <MetaItem label="Émis le" value={generatedDate} />
        </View>

        <View style={styles.scorePanel} wrap={false}>
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreNumber}>{assessment.result.score}</Text>
            <Text style={styles.scoreOutOf}>SCORE DE PRÉPARATION / 100</Text>
          </View>
          <View style={styles.scoreSummary}>
            <Text style={styles.tier}>NIVEAU {assessment.result.tier}</Text>
            <Text style={styles.scoreSummaryTitle}>Synthèse de pré-souscription</Text>
            <Text style={styles.scoreSummaryText}>
              {assessment.result.executiveSummary}
            </Text>
          </View>
        </View>

        <SectionHeader index="01" title="Profil du risque" />
        <View style={styles.card} wrap={false}>
          <View style={[styles.riskBadge, riskStyle]}>
            <Text>{riskLabel(assessment.result.riskLevel)}</Text>
          </View>
          <Text style={styles.cardTitle}>{assessment.system.name}</Text>
          <Text style={styles.body}>{assessment.system.description}</Text>
          <View style={{ marginTop: 9 }}>
            {assessment.system.sector ? (
              <FactLine label="Secteur" value={assessment.system.sector} />
            ) : null}
            {assessment.system.intendedUse ? (
              <FactLine label="Usage prévu" value={assessment.system.intendedUse} />
            ) : null}
            {assessment.system.affectedPeople ? (
              <FactLine
                label="Personnes concernées"
                value={assessment.system.affectedPeople}
              />
            ) : null}
            {assessment.system.operatorRole ? (
              <FactLine label="Rôle" value={assessment.system.operatorRole} />
            ) : null}
          </View>
        </View>

        <Text style={[styles.body, { marginTop: 8 }]}>
          {assessment.classification.rationale}
        </Text>

        <View style={styles.section}>
          <SectionHeader index="02" title="Dimensions de préparation" />
          <View style={styles.card}>
            {assessment.dimensions.map((dimension) => (
              <View key={dimension.name} style={styles.dimension} wrap={false}>
                <View style={styles.dimensionTop}>
                  <Text style={styles.dimensionName}>{dimension.name}</Text>
                  <Text style={styles.dimensionScore}>{dimension.score}/100</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${dimension.score}%` }]} />
                </View>
                <Text style={[styles.muted, { fontSize: 7.5 }]}>
                  {dimension.finding}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section} break>
          <SectionHeader index="03" title="Qualification réglementaire" />
          {assessment.classification.articles.map((article) => (
            <View key={`${article.reference}-${article.title ?? ""}`} style={styles.card} wrap={false}>
              <Text style={styles.articleReference}>{article.reference}</Text>
              {article.title ? <Text style={styles.articleTitle}>{article.title}</Text> : null}
              <Text style={[styles.body, { marginTop: 5 }]}>{article.finding}</Text>
              {article.deadline || article.deadlineStatus ? (
                <Text style={styles.articleMeta}>
                  {[article.deadline, article.deadlineStatus].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
              {article.sourceUrl ? (
                <Link src={article.sourceUrl} style={styles.sourceLink}>
                  Source réglementaire
                </Link>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader index="04" title="Plan d’actions priorisé" />
          {assessment.gaps.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.body}>
                Aucun écart prioritaire n’a été relevé dans l’évaluation transmise.
              </Text>
            </View>
          ) : (
            assessment.gaps.map((gap, index) => (
              <View key={`${index}-${gap.title}`} style={styles.card} wrap={false}>
                <View style={styles.inlineRow}>
                  <View style={[styles.priorityBadge, priorityBadgeStyle(gap.priority)]}>
                    <Text>{priorityLabel(gap.priority)}</Text>
                  </View>
                  <Text style={styles.gapTitle}>{gap.title}</Text>
                </View>
                <Text style={[styles.body, { marginTop: 6 }]}>{gap.finding}</Text>
                <Text style={styles.gapAction}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Action attendue : </Text>
                  {gap.recommendedAction}
                </Text>
                {gap.dueDate || gap.owner ? (
                  <Text style={styles.articleMeta}>
                    {[gap.dueDate ? `Échéance : ${gap.dueDate}` : null, gap.owner ? `Responsable : ${gap.owner}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                ) : null}
                {gap.articleReferences.length > 0 ? (
                  <View style={styles.chips}>
                    {gap.articleReferences.map((reference) => (
                      <Text key={reference} style={styles.chip}>
                        {reference}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>

        {journalIndex ? (
          <View style={styles.section} break>
            <SectionHeader index={journalIndex} title="Journal des décisions et contre-vérification" />
            {assessment.crossCheck ? (
              <View
                style={[styles.card, crossCheckCardStyle(assessment.crossCheck.status)]}
                wrap={false}
              >
                <Text style={styles.cardTitle}>
                  Contre-vérification déterministe — {crossCheckLabel(assessment.crossCheck.status)}
                </Text>
                <Text style={styles.body}>{assessment.crossCheck.note}</Text>
                <Text style={styles.articleMeta}>
                  Moteur de règles {assessment.crossCheck.version}, indépendant du modèle de langage.
                </Text>
              </View>
            ) : null}
            {assessment.result.appliedCaps?.length ? (
              <View style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Plafonds prudentiels appliqués au score</Text>
                {assessment.result.appliedCaps.map((appliedCap, index) => (
                  <Text key={`${appliedCap.cap}-${index}`} style={[styles.body, { marginBottom: 3 }]}>
                    Plafond {appliedCap.cap}/100 — {appliedCap.reason}
                  </Text>
                ))}
              </View>
            ) : null}
            {assessment.decisionLog?.map((entry, index) => (
              <View key={`${entry.title}-${index}`} style={styles.card} wrap={false}>
                <View style={styles.dimensionTop}>
                  <Text style={styles.cardTitle}>{entry.title}</Text>
                  <Text style={styles.dimensionScore}>
                    {decisionScoreLabel(entry.score)}
                  </Text>
                </View>
                <Text style={[styles.body, { fontFamily: "Helvetica-Bold", marginBottom: 3 }]}>
                  {entry.decision}
                </Text>
                <Text style={[styles.muted, { fontSize: 7.5 }]}>{entry.rationale}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {assessment.evidence?.length && evidenceIndex ? (
          <View style={styles.section} break>
            <SectionHeader index={evidenceIndex} title="Éléments de maîtrise déclarés" />
            <View style={styles.tableHeader} fixed>
              <Text style={styles.tableControl}>Contrôle</Text>
              <Text style={styles.tableStatus}>État</Text>
              <Text style={styles.tableDetail}>Élément observé</Text>
            </View>
            {assessment.evidence.map((item) => (
              <View key={item.control} style={styles.tableRow} wrap={false}>
                <Text style={styles.tableControl}>{item.control}</Text>
                <Text style={[styles.tableStatus, { color: evidenceColor(item.status) }]}>
                  {evidenceLabel(item.status)}
                </Text>
                <Text style={styles.tableDetail}>{item.detail}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {assessment.brokerContext && brokerIndex ? (
          <View style={styles.section}>
            <SectionHeader index={brokerIndex} title="Contexte de placement" />
            <View style={[styles.card, styles.brokerGrid]}>
              {assessment.brokerContext.requestedCoverage ? (
                <BrokerItem
                  label="Couverture recherchée"
                  value={assessment.brokerContext.requestedCoverage}
                />
              ) : null}
              {assessment.brokerContext.annualAiRevenueEur !== undefined ? (
                <BrokerItem
                  label="Revenu annuel lié à l’IA"
                  value={formatCurrency(assessment.brokerContext.annualAiRevenueEur)}
                />
              ) : null}
              {assessment.brokerContext.incidentHistory ? (
                <BrokerItem
                  label="Historique d’incidents déclaré"
                  value={assessment.brokerContext.incidentHistory}
                />
              ) : null}
              {assessment.brokerContext.contactName ? (
                <BrokerItem
                  label="Contact dossier"
                  value={assessment.brokerContext.contactName}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.disclaimer} wrap={false}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>
            Portée et traçabilité
          </Text>
          <Text>
            Référentiel déclaré vérifié le {formatDate(assessment.lastRegulatoryVerification)}.
            Confiance de classification : {Math.round(assessment.result.confidence * 100)} %.
            {assessment.methodology?.model
              ? ` Modèle déclaré : ${assessment.methodology.model}${assessment.methodology.version ? ` (${assessment.methodology.version})` : ""}.`
              : ""}
          </Text>
          <Text style={{ marginTop: 3 }}>
            Ce rapport constitue une aide à la préparation d’un dossier de risque. Il ne vaut ni
            avis juridique, ni engagement de couverture, ni décision de souscription. Les faits
            déclarés et les pièces justificatives doivent être vérifiés par les professionnels concernés.
          </Text>
        </View>

        <ReportFooter lastVerified={assessment.lastRegulatoryVerification} />
      </Page>
    </Document>
  );
}

function ReportHeader({ assessmentId }: { assessmentId: string }) {
  return (
    <View style={styles.header} fixed>
      <Text style={styles.brand}>PREUVANCE</Text>
      <Text style={styles.headerMeta}>DOSSIER {assessmentId}</Text>
    </View>
  );
}

function ReportFooter({ lastVerified }: { lastVerified: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>PREUVANCE · Document confidentiel · Vérifié {lastVerified}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIndex}>{index}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function FactLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 3 }}>
      <Text style={[styles.label, { width: 110, marginBottom: 0 }]}>{label}</Text>
      <Text style={{ flexGrow: 1, fontSize: 8 }}>{value}</Text>
    </View>
  );
}

function BrokerItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.brokerItem} wrap={false}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

function crossCheckLabel(status: PdfCrossCheckStatus) {
  return {
    concordant: "concordante avec la classification",
    attention: "signaux à examiner",
    divergent: "contradiction détectée, revue humaine requise",
  }[status];
}

function crossCheckCardStyle(status: PdfCrossCheckStatus) {
  if (status === "divergent") {
    return { backgroundColor: colors.redPale, borderColor: colors.red };
  }
  if (status === "attention") {
    return { backgroundColor: colors.amberPale, borderColor: colors.amber };
  }
  return { backgroundColor: colors.greenPale, borderColor: colors.green };
}

function riskLabel(level: RiskLevel) {
  return {
    minimal: "RISQUE MINIMAL",
    limited: "RISQUE LIMITÉ",
    high: "HAUT RISQUE",
    prohibited: "PRATIQUE POTENTIELLEMENT INTERDITE",
    undetermined: "CLASSIFICATION À CONFIRMER",
  }[level];
}

function riskBadgeStyle(level: RiskLevel) {
  if (level === "minimal") return { backgroundColor: colors.greenPale, color: colors.green };
  if (level === "limited") return { backgroundColor: colors.amberPale, color: colors.amber };
  if (level === "undetermined") return { backgroundColor: colors.bluePale, color: colors.blue };
  return { backgroundColor: colors.redPale, color: colors.red };
}

function priorityLabel(priority: GapPriority) {
  return {
    critical: "CRITIQUE",
    high: "HAUTE",
    medium: "MOYENNE",
    low: "FAIBLE",
  }[priority];
}

function priorityBadgeStyle(priority: GapPriority) {
  if (priority === "critical" || priority === "high") {
    return { backgroundColor: colors.redPale, color: colors.red };
  }
  if (priority === "medium") {
    return { backgroundColor: colors.amberPale, color: colors.amber };
  }
  return { backgroundColor: colors.greenPale, color: colors.green };
}

function evidenceLabel(status: EvidenceStatus) {
  return {
    documented: "Documenté",
    declared: "Déclaré · non vérifié",
    partial: "Partiel",
    missing: "Manquant",
    unverified: "Non vérifié",
    "not-applicable": "Non applicable",
  }[status];
}

function evidenceColor(status: EvidenceStatus) {
  if (status === "documented") return colors.green;
  if (status === "partial") return colors.amber;
  if (status === "declared" || status === "unverified") return colors.blue;
  if (status === "missing") return colors.red;
  return colors.muted;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
