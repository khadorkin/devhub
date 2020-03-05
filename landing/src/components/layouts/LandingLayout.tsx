import FloatingFooter from '../sections/footer/FloatingFooter'
import Footer from '../sections/footer/Footer'
import Header from '../sections/header/Header'

export interface LandingLayoutProps {
  children: React.ReactNode
}

export default function LandingLayout(props: LandingLayoutProps) {
  return (
    <section id="landing">
      <Header />

      {props.children}

      <div className="pb-16 md:pb-32" />

      <Footer />
      <FloatingFooter />
    </section>
  )
}
