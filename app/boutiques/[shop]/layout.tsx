import type { Metadata } from "next";
import { catalogPool } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";


export const revalidate = 300;

async function lookupShop(slug: string): Promise<{ name: string; products: number } | null> {
  try {
    const r = await catalogPool().query<{ name: string; products: string }>(
      `SELECT s.name, s.product_count::text AS products
       FROM shops s
       WHERE s.slug = $1 OR s.shop_key = $1
       LIMIT 1`,
      [slug]
    );
    if (!r.rows.length) return null;
    return { name: r.rows[0].name, products: parseInt(r.rows[0].products, 10) || 0 };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { shop: string } }
): Promise<Metadata> {
  const s = await lookupShop(params.shop);
  const title = s ? `${s.name} — Catalogue & prix` : "Boutique";
  const description = s
    ? `Catalogue complet de ${s.name}${s.products > 0 ? ` (${s.products.toLocaleString("fr-FR")} produits)` : ""} avec prix mis à jour en continu. Comparez avec les autres enseignes sur 1111.tn.`
    : "Catalogue d'une boutique tunisienne avec prix mis à jour en continu.";
  return pageMetadata({
    title,
    description,
    path: `/boutiques/${params.shop}`,
  });
}

export default function BoutiqueShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
