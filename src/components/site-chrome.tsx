// Header, footer et logo partagés entre l'accueil, la confirmation et les pages
// légales. Toutes les infos de contact sont dans SITE : un seul endroit à modifier.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const SITE = {
  name: "TaxiDriveFirst",
  phoneDisplay: "06 17 98 59 43",
  phoneHref: "tel:+33617985943",
  email: "taxisdrivefirst@yahoo.com",
};

export function LogoWord({ style }: { style?: React.CSSProperties }) {
  return (
    <span className="logo-word" style={style}>
      TaxiDrive<span>First</span>
    </span>
  );
}

// Enveloppe sombre de la charte : toutes les pages publiques passent par là.
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="tdf">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

export function SiteHeader() {
  return (
    <nav className="nav" aria-label="Navigation principale">
      <div className="wrap">
        <Link className="logo" to="/" aria-label={`${SITE.name}, accueil`}>
          <LogoWord />
        </Link>
        <div className="nav-links">
          <Link to="/" hash="tarifs">
            Tarifs
          </Link>
          <Link to="/" hash="flotte">
            Véhicule
          </Link>
          <Link to="/" hash="services">
            Services
          </Link>
          <Link to="/" hash="faq">
            Questions
          </Link>
        </div>
        <a className="nav-phone" href={SITE.phoneHref}>
          {SITE.phoneDisplay}
        </a>
        <Link className="btn btn-amber" to="/" hash="reserver">
          Réserver
        </Link>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <span className="logo">
          <LogoWord style={{ fontSize: "1.15rem", color: "var(--fg)" }} />
          <span style={{ marginLeft: 6 }}>· Chauffeur privé, Paris</span>
        </span>
        <div className="cols">
          <Link to="/mentions-legales">Mentions légales</Link>
          <Link to="/confidentialite">Confidentialité</Link>
          <a href={SITE.phoneHref}>{SITE.phoneDisplay}</a>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </div>
        <p className="disclaimer">
          © {new Date().getFullYear()} {SITE.name}. Prix TTC calculés sur la distance routière
          réelle (Google Maps).
        </p>
      </div>
    </footer>
  );
}
