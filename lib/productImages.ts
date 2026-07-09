function imageColumn(alias?: string) {
  return alias ? `${alias}.image_url` : "image_url";
}

function idColumn(alias?: string) {
  return alias ? `${alias}.id` : "id";
}

export function productCoverImageFilterSql(alias?: string) {
  const image = imageColumn(alias);
  return `
  ${image} ~ '^https?://'
  AND ${image} NOT ILIKE '%loading%'
  AND ${image} NOT ILIKE '%placeholder%'
  AND ${image} NOT ILIKE '%no-image%'
  AND ${image} NOT ILIKE '%not-found%'
  AND ${image} NOT ILIKE '%.gif%'
  AND ${image} NOT ILIKE '%yatoo.com.tn%'
`;
}

export function productCoverImageOrderSql(alias?: string) {
  const image = imageColumn(alias);
  return `
  CASE
    WHEN ${image} ILIKE 'https://clusteraz.flesk.fr/%' THEN 1
    WHEN ${image} ILIKE 'https://back.carrefour.tn/%' THEN 2
    WHEN ${image} ILIKE 'https://www.carrefour.tn/%' THEN 3
    WHEN ${image} ILIKE 'https://cdn.monoprix.tn/%' THEN 4
    WHEN ${image} ILIKE 'https://www.monoprix.tn/%' THEN 5
    WHEN ${image} ILIKE 'https://www.geantdrive.tn/%' THEN 6
    WHEN ${image} ILIKE '%.webp%' THEN 20
    WHEN ${image} ILIKE '%.jpg%' THEN 21
    WHEN ${image} ILIKE '%.jpeg%' THEN 21
    WHEN ${image} ILIKE '%.png%' THEN 22
    ELSE 99
  END,
  ${idColumn(alias)} ASC
`;
}

export function productCoverImageSql(productIdExpression: string) {
  return `(
    SELECT image_url
    FROM product_images
    WHERE product_id = ${productIdExpression}
      AND ${productCoverImageFilterSql()}
    ORDER BY ${productCoverImageOrderSql()}
    LIMIT 1
  )`;
}
