import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/sections/Hero";
import Problems from '@/components/sections/Problems'
import CTA from "@/components/sections/CTA";
import TechnicalApproach from "@/components/sections/TechnicalApproach";
import UnitEconomics from "@/components/sections/UnitEconomics";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problems />
        <TechnicalApproach />
        <UnitEconomics />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
