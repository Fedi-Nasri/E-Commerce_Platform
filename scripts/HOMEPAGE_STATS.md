# Homepage stats (PostgreSQL)

All homepage statistics are stored in `retail_db` with named tables:

| Dataset | Tables | Source |
|---------|--------|--------|
| Prix moyen catalogue | `stats_prix_moyen_runs`, `stats_prix_moyen_shops`, `stats_prix_moyen_buckets` | Latest scrapes (`products_detailed.json`) |
| Top 5 retail | `stats_top_retail_runs`, `stats_top_retail_shops` | `lib/data/topRetailShops.json` |
| Para comparator | `stats_para_runs`, `stats_para_shops` | `lib/data/topParaShops.json` |
| Climatiseurs | `stats_climatiseurs_runs`, `stats_climatiseurs_shops`, `stats_climatiseurs_btu` | `lib/data/climatiseursEnStock.json` |

APIs read PostgreSQL first, then fall back to JSON files.

## Refresh workflow

```bash
# Full refresh (recompute rankings from clusters + import to DB)
export RETAIL_DB_URL=postgresql://retail_user:PASS@localhost:5433/retail_db
export STOCK_DIR=/path/to/scrapes
export CLUSTERS_JSON=/path/to/product_clusters.json
npm run stats:refresh

# Import only (JSON + scrapes already up to date)
npm run stats:refresh:db-only

# Import DB only (single script)
npm run stats:import -- --stock-dir=/home/ubuntu/scrapping/data
```

## VPS

```bash
python scripts/vps_refresh_homepage_stats.py
```

Requires `RETAIL_DB_URL` in `/home/ubuntu/project/.env.local` and scrapes at `/home/ubuntu/scrapping/data`.
