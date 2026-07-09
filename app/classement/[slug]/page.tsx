import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PriceRankingDetail } from "@/components/PriceRankingDetail";
import { PageShell } from "@/components/site/PageShell";
import { PRICE_RANKING_CATALOG } from "@/lib/priceRankings";
import { getRankingBySlug, scopeLeader } from "@/lib/priceRankingsServer";
import { formatEcartPct, shopDisplayName } from "@/lib/priceRankings";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

/** Always render from DB at request time — avoids stale 404 pages when build ran without rankings data. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const catalog = PRICE_RANKING_CATALOG.find((c) => c.slug === params.slug);
  if (!catalog) return { title: "Classement introuvable" };
  return pageMetadata({
    title: `Meilleurs prix — ${catalog.title}`,
    description: `Classement des enseignes en ${catalog.title.toLowerCase()} : comparaison équitable des prix sur les mêmes produits.`,
    path: `/classement/${params.slug}`,
  });
}

export default async function ClassementPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getRankingBySlug(params.slug, 50);
  if (!data) notFound();

  const { catalog, scope } = data;
  const leader = scopeLeader(scope);
  const ecart = leader?.ecart_pct ?? leader?.avg_extra_cost_vs_cheapest;

  return (
    <PageShell
      icon="scale"
      title="Classement prix"
      accent={catalog.title}
      arabic="أفضل الأسعار"
      description={
        leader
          ? `${shopDisplayName(leader.shop_key)} en tête des grandes enseignes avec ${formatEcartPct(ecart)} vs le marché sur ${scope.matched_products?.toLocaleString("fr-FR")} produits comparés (stock confirmé).`
          : `Comparaison des enseignes en ${catalog.title.toLowerCase()}.`
      }
    >
      <PriceRankingDetail catalog={catalog} scope={scope} />
    </PageShell>
  );
}
