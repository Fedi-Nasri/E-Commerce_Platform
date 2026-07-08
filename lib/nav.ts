export type NavLink = { fr: string; ar: string; href: string; caret?: boolean; megaMenu?: boolean };

export const navLinks: NavLink[] = [
  { fr: "Catégories", ar: "الفئات", href: "/categories", caret: true },
  { fr: "Boutiques", ar: "محلات", href: "/boutiques" },
  { fr: "Supermarché", ar: "السوبرماركت", href: "/supermarche" },
  { fr: "Parapharmacie", ar: "شبه الصيدلية", href: "/parapharmacie" },
  { fr: "Magasins", ar: "المتاجر", href: "/retail", caret: true, megaMenu: true },
  { fr: "Couffin Tounsi", ar: "القفة التونسية", href: "/couffin" },
  { fr: "Comparaison", ar: "مقارنة", href: "/comparaison" },
  { fr: "Classement", ar: "الترتيب", href: "/classement" },
];
