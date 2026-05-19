import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Hero from '@/components/sections/Hero'
// import Problems from '@/components/sections/Problems'
// import TechnicalApproach from '@/components/sections/TechnicalApproach'
// import Protocol from '@/components/sections/Protocol'
// import UnitEconomics from '@/components/sections/UnitEconomics'
import CTA from '@/components/sections/CTA'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        {/* {/* <Problems />
        <TechnicalApproach />
        <Protocol />
        <UnitEconomics /> */}
        <CTA />
      </main>
      <Footer />
    </>
  )
}