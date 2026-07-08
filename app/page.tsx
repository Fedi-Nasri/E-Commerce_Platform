import { AcBarometer } from "@/components/AcBarometer";
import { AppBanner } from "@/components/AppBanner";
import { Categories } from "@/components/Categories";
import { Footer } from "@/components/Footer";
import { GrandeDistribRow } from "@/components/GrandeDistribRow";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { IaPredictive } from "@/components/IaPredictive";
import { MarketIndex } from "@/components/MarketIndex";
import { Observatoire } from "@/components/Observatoire";
import { PromoBanner } from "@/components/PromoBanner";
import { QoffaSection } from "@/components/QoffaSection";
import { StatRow } from "@/components/StatRow";
import { TechOffers } from "@/components/TechOffers";

export default function HomePage() {
  return (
    <main className="home-page min-h-screen">
      <Header />
      <Hero />
      <PromoBanner />
      <TechOffers />
      <Categories />
      <GrandeDistribRow />
      <StatRow />
      <QoffaSection />
      <AcBarometer />
      <IaPredictive />
      <MarketIndex />
      <Observatoire />
      <AppBanner />
      <Footer />
    </main>
  );
}
