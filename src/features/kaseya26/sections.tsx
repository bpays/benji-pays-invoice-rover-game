import { useScrollReveal } from "./useScrollReveal";
import benjiLogo from "../../assets/kaseya26/benji-logo.png";
import halopsaLogo from "../../assets/kaseya26/halopsa.png";
import scalepadLogo from "../../assets/kaseya26/scalepad.png";
import monerisLogo from "../../assets/kaseya26/moneris.png";
import elavonLogo from "../../assets/kaseya26/elavon.png";

const PLAY_HREF = "/";
const LEADERBOARD_HREF = "/leaderboard";
const DEMO_HREF = "https://calendly.com/d/cymg-qwt-gbd/benji-pays-demo-kaseya-connect";

export const Navbar = () => (
  <nav className="k26-navbar">
    <a
      href="https://benjipays.com"
      target="_blank"
      rel="noopener noreferrer"
      className="k26-navbar-logo"
    >
      <img src={benjiLogo} alt="Benji Pays" />
    </a>
    <div className="k26-navbar-actions">
      <a
        href={DEMO_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="k26-btn-ghost k26-hide-sm"
      >
        Book a Demo
      </a>
      <a href={PLAY_HREF} className="k26-btn-primary k26-btn-primary--sm">
        P(L)ay Now
      </a>
    </div>
  </nav>
);

export const Hero = () => (
  <div className="k26-hero">
    <div className="k26-hero-bg-radial" />
    <div className="k26-hero-bg-grid" />

    <div className="k26-hero-inner">
      <div className="k26-hero-eyebrow k26-anim k26-anim-1">
        KASEYA CONNECT 2026 · LAS VEGAS · APRIL 27-30 · BOOTH #B28
      </div>

      <h1 className="k26-hero-title k26-anim k26-anim-2">
        Invoice<br />
        <em>Rover.</em>
      </h1>

      <div className="k26-hero-underline k26-anim k26-anim-3" />

      <p className="k26-hero-tagline k26-anim k26-anim-4">
        Dodge bad payments. Collect good ones. Win up to $300.
      </p>

      <div className="k26-prize-pill k26-anim k26-anim-5">
        <PrizePillItem amount="$50" label="Daily prize" />
        <PrizePillSep>+</PrizePillSep>
        <PrizePillItem amount="$200" label="Grand prize" />
        <PrizePillSep>=</PrizePillSep>
        <PrizePillItem amount="$300" label="Up for grabs" amountAccent />
      </div>

      <div className="k26-hero-ctas k26-anim k26-anim-6">
        <div className="k26-hero-ctas-row">
          <a href={PLAY_HREF} className="k26-btn-primary k26-btn-primary--lg">
            P(L)ay Now
          </a>
          <a href={LEADERBOARD_HREF} className="k26-btn-secondary k26-btn-secondary--lg">
            Leaderboard →
          </a>
        </div>
        <a
          href={DEMO_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="k26-demo-pill"
        >
          <span className="k26-demo-dot" />
          Interested in Benji Pays? Book a demo →
        </a>
      </div>
    </div>

    <div className="k26-scroll-cue k26-anim k26-anim-fade">
      <span>Scroll</span>
      <div className="k26-scroll-line" />
    </div>
  </div>
);

const PrizePillItem = ({
  amount,
  label,
  amountAccent = false,
}: {
  amount: string;
  label: string;
  amountAccent?: boolean;
}) => (
  <div className="k26-prize-item">
    <span className={`k26-prize-amount${amountAccent ? " k26-prize-amount--accent" : ""}`}>
      {amount}
    </span>
    <span className="k26-prize-label">{label}</span>
  </div>
);

const PrizePillSep = ({ children }: { children: string }) => (
  <div className="k26-prize-sep">
    <span>{children}</span>
  </div>
);

export const BenjiBlurb = () => {
  const ref = useScrollReveal();
  return (
    <section className="k26-blurb-section">
      <div className="k26-container">
        <div ref={ref} className="k26-blurb k26-reveal">
          <img src={benjiLogo} alt="Benji Pays" className="k26-blurb-logo" />
          <div>
            <p className="k26-blurb-text">
              <strong>Benji Pays</strong> is an AI-powered payment platform for MSPs.
              Accept ACH, credit card &amp; check payments — all reconciled automatically inside your PSA.
            </p>
            <a
              href="https://benjipays.com"
              target="_blank"
              rel="noopener noreferrer"
              className="k26-blurb-link"
            >
              Learn more about Benji Pays →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

const steps = [
  { n: "01", title: "Scan the QR", desc: "No app download. Game loads instantly on any phone. Just scan and go." },
  { n: "02", title: "Name + email", desc: "Enter your details to appear on the leaderboard. Real info = real prize eligibility." },
  { n: "03", title: "Run for it", desc: "Dodge paper checks and angry clients. Collect ACH payments. Grab Partner Power-Ups." },
  { n: "04", title: "Top score wins", desc: "$50 daily. $200 for the highest score across all days of the event." },
];

export const HowToPlay = () => {
  const headerRef = useScrollReveal();
  const stepsRef = useScrollReveal();
  return (
    <section className="k26-section">
      <div className="k26-container">
        <div ref={headerRef} className="k26-reveal">
          <div className="k26-eyebrow">How to Play</div>
          <h2 className="k26-h2">
            Four steps to <span className="k26-accent">cash.</span>
          </h2>
          <p className="k26-section-lead">
            No app. No download. Just scan, play and climb the leaderboard.
          </p>
        </div>

        <div ref={stepsRef} className="k26-steps k26-reveal k26-reveal-delay">
          {steps.map((step) => (
            <div key={step.n} className="k26-step">
              <div className="k26-step-bar" />
              <div className="k26-step-num k26-grad-text">{step.n}</div>
              <h4 className="k26-step-title">{step.title}</h4>
              <p className="k26-step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const cities = [
  { flag: "🇨🇦", name: "Vancouver", pts: "0 (start)", genre: "Indie folk", color: "#004777" },
  { flag: "🇨🇦", name: "Toronto", pts: "6,667", genre: "Canadian indie", color: "#3a7bd5" },
  { flag: "🇨🇦", name: "Montreal", pts: "13,333", genre: "French electronic", color: "#9b59b6" },
  { flag: "🤠", name: "Dallas", pts: "20,000", genre: "Country hip hop", color: "#c45c10" },
  { flag: "🗽", name: "New York", pts: "26,667", genre: "East coast hip hop", color: "#f0c040" },
  { flag: "🌴", name: "Los Angeles", pts: "33,333", genre: "West coast lo-fi", color: "#b040ff" },
  { flag: "🌊", name: "Miami", pts: "40,000", genre: "Latin electronic", color: "#00c8aa" },
  { flag: "🇬🇧", name: "London", pts: "46,667", genre: "Drum & bass", color: "#4488ff" },
  { flag: "🇦🇺", name: "Australia", pts: "53,333", genre: "Surf rock", color: "#00aadd" },
  { flag: "🤖", name: "Cyber City", pts: "60,000", genre: "Synthwave / glitch", color: "#00ffcc" },
];

export const CitiesGrid = () => {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();
  return (
    <section className="k26-section">
      <div className="k26-container">
        <div ref={headerRef} className="k26-reveal">
          <div className="k26-eyebrow">10 Cities · 10 Soundtracks</div>
          <h2 className="k26-h2">
            Every city has its<br />
            <span className="k26-accent">own vibe.</span>
          </h2>
          <p className="k26-section-lead">
            Score more points and advance through 10 cities — each with unique visuals, music, and increasing difficulty.
          </p>
        </div>

        <div ref={gridRef} className="k26-cities k26-reveal k26-reveal-delay">
          {cities.map((city) => (
            <div key={city.name} className="k26-city">
              <div className="k26-city-flag">{city.flag}</div>
              <div className="k26-city-name">{city.name}</div>
              <div className="k26-city-pts">{city.pts}</div>
              <div className="k26-city-genre">{city.genre}</div>
              <div className="k26-city-bar" style={{ background: city.color }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const partners = [
  { name: "HaloPSA Shield", effect: "Full Invincibility · 15s", desc: "Nothing can touch you. Powered by HaloPSA — the PSA built for MSPs.", logo: halopsaLogo, whiteBg: false },
  { name: "ScalePad Boost", effect: "2× Score · 12s", desc: "Every point doubled. ScalePad gives MSPs complete lifecycle visibility.", logo: scalepadLogo, whiteBg: false },
  { name: "Moneris Paid In Full", effect: "Clears All Obstacles · Instant", desc: "Every obstacle on screen explodes. Every bad payment: gone.", logo: monerisLogo, whiteBg: true },
  { name: "Elavon Payment Streak", effect: "Double Points · 15s", desc: "Double points on every collect. Keep collecting to extend the streak.", logo: elavonLogo, whiteBg: true },
];

export const PartnerPowerUps = () => {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();
  return (
    <section className="k26-section k26-partners-section">
      <div className="k26-container">
        <div ref={headerRef} className="k26-reveal">
          <div className="k26-eyebrow">Partner Power-Ups</div>
          <h2 className="k26-h2">
            Powered by our<br />
            <span className="k26-accent">integration partners.</span>
          </h2>
          <p className="k26-section-lead">
            Four Partner Power-Ups appear randomly during play. Grab one and the city slams into night mode — music spikes, score multiplies, chaos ensues.
          </p>
        </div>

        <div ref={gridRef} className="k26-partners k26-reveal k26-reveal-delay">
          {partners.map((p) => (
            <div key={p.name} className="k26-partner">
              <div className="k26-partner-bar" />
              <div className={`k26-partner-logo${p.whiteBg ? " k26-partner-logo--white" : ""}`}>
                <img src={p.logo} alt={p.name} />
              </div>
              <div>
                <div className="k26-partner-name">{p.name}</div>
                <div className="k26-partner-effect">{p.effect}</div>
                <p className="k26-partner-desc">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const FinalCTA = () => {
  const ref = useScrollReveal();
  return (
    <section className="k26-final">
      <div className="k26-final-glow" />
      <div className="k26-container">
        <div ref={ref} className="k26-reveal">
          <h2 className="k26-final-title">
            Ready to run<br />with <em>Benji?</em>
          </h2>
          <p className="k26-final-lead">
            No app download. Play instantly on any phone. Las Vegas, April 27–30, 2026.
          </p>
          <div className="k26-final-ctas">
            <a href={PLAY_HREF} className="k26-btn-primary k26-btn-primary--lg">
              P(L)ay Now →
            </a>
            <a href={LEADERBOARD_HREF} className="k26-btn-secondary k26-btn-secondary--lg">
              Live Leaderboard
            </a>
          </div>
          <div className="k26-final-msp">
            <div className="k26-final-msp-eyebrow">Working in an MSP?</div>
            <a href={DEMO_HREF} target="_blank" rel="noopener noreferrer" className="k26-final-msp-cta">
              Book a Benji Pays demo while you're at the show →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export const Footer = () => (
  <footer className="k26-footer">
    <img src={benjiLogo} alt="Benji Pays" />
    <p>
      Benji Pays: Invoice Rover · Kaseya Connect 2026 · MGM Grand Hotel &amp; Casino · Booth #B28 ·{" "}
      <a href="https://benjipays.com" target="_blank" rel="noopener noreferrer">benjipays.com</a> ·{" "}
      <a href="https://benjigame.com" target="_blank" rel="noopener noreferrer">benjigame.com</a>
    </p>
  </footer>
);
