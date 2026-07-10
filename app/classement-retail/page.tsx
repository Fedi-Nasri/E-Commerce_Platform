import type { Metadata } from "next";
import { RetailRankingDetail } from "@/components/RetailRankingDetail";
import { PageShell } from "@/components/site/PageShell";
import { getTopRetailRankingForApi } from "@/lib/topRetailShops";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Classement retail — Meilleurs prix",
  description:
    "Quelle boutique e-commerce propose le plus souvent le meilleur prix en Tunisie ? Classement complet sur produits identiques en stock, graphiques et détail par catégorie.",
  path: "/classement-retail",
  keywords: [
    "classement retail tunisie",
    "meilleur prix informatique",
    "comparer boutiques tunisie",
    "mytek spacenet tunisianet prix",
  ],
});

export default function ClassementRetailPage() {
  const data = getTopRetailRankingForApi();
  const leader = data.shops[0];

  return (
    <PageShell
      icon="store"
      title="Classement retail"
      accent="Meilleurs prix"
      arabic="أفضل أسعار المتاجر"
      description={
        leader
          ? `${leader.displayName} en tête avec ${leader.cheapestCount.toLocaleString("fr-FR")} meilleurs prix sur ${data.clustersUsed.toLocaleString("fr-FR")} produits identiques comparés entre ${data.shops.length} boutiques.`
          : "Comparaison des boutiques retail sur les produits identiques en stock."
      }
      chips={[
        { label: "Produits comparés", value: data.clustersUsed.toLocaleString("fr-FR"), tone: "emerald" },
        { label: "Boutiques", value: String(data.shops.length), tone: "blue" },
        {
          label: "Leader",
          value: leader ? `${leader.winRatePct}%` : "—",
          tone: "gold",
        },
      ]}
    >
      <RetailRankingDetail {...data} />
    </PageShell>
  );
}
