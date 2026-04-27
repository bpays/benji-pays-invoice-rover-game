import { useEffect } from "react";
import {
  Navbar,
  Hero,
  BenjiBlurb,
  HowToPlay,
  CitiesGrid,
  FinalCTA,
  Footer,
} from "../features/kaseya26/sections";
import "../styles/kaseya26.css";

export const Kaseya26Page = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Invoice Rover · Kaseya Connect 2026 · Benji Pays";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className="kaseya26-page">
      <Navbar />
      <Hero />
      <div className="k26-grad-line" />
      <BenjiBlurb />
      <HowToPlay />
      <div className="k26-grad-line" />
      <CitiesGrid />
      <div className="k26-grad-line" />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Kaseya26Page;
