/**
 * @deprecated Use @/lib/homepageStatsDb instead.
 * Kept for backwards-compatible imports.
 */
export {
  getPrixMoyenRunFromDb as getShopCatalogSnapshotFromDb,
  getPrixMoyenStatsFromDb as getShopCatalogStatsFromDb,
  getShopCatalogDetailFromDb,
  type PrixMoyenRunRow as ShopCatalogSnapshotRow,
} from "@/lib/homepageStatsDb";
