// Header, footer et logo partagés entre l'accueil, la confirmation et les pages
// légales. Toutes les infos de contact sont dans SITE : un seul endroit à modifier.
import { Link } from "@tanstack/react-router";
import { useId, type ReactNode } from "react";

export const SITE = {
  name: "TaxiDriveFirst",
  phoneDisplay: "06 17 98 59 43",
  phoneHref: "tel:+33617985943",
  email: "taxisdrivefirst@yahoo.com",
};

// Symbole : un « 1 » (First) lancé à pleine vitesse, sur fond ambre, avec la
// bande à damier des taxis. Les ids SVG sont uniques car le logo apparaît
// plusieurs fois par page (header + footer).
export function LogoMark({ className = "logo-mark" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD98A" />
          <stop offset=".55" stopColor="#E9A23B" />
          <stop offset="1" stopColor="#B8671A" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <rect width="48" height="48" rx="12" />
        </clipPath>
        <pattern id={`${id}k`} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#0D1015" />
          <rect x="4" y="4" width="4" height="4" fill="#0D1015" />
        </pattern>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="48" height="48" fill={`url(#${id}g)`} />
        <rect y="40" width="48" height="8" fill={`url(#${id}k)`} />
        <rect y="38.5" width="48" height="1.5" fill="#0D1015" />
        <g fill="#0D1015">
          <path d="M27 8.5 L35 8.5 L30.4 33 L22.4 33 L25.3 17.6 L18.8 20.2 L20 13.8 Z" />
          <g className="logo-speed">
            <rect x="6" y="14" width="10" height="2.8" rx="1.4" transform="skewX(-12)" />
            <rect x="5" y="20.5" width="13" height="2.8" rx="1.4" transform="skewX(-12)" opacity=".7" />
            <rect x="5" y="27" width="8" height="2.8" rx="1.4" transform="skewX(-12)" opacity=".45" />
          </g>
        </g>
        <rect className="logo-shine" x="-30" y="-10" width="18" height="70" fill={`url(#${id}s)`} transform="rotate(20 24 24)" />
      </g>
    </svg>
  );
}

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
          <LogoMark />
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
          <LogoMark className="logo-mark logo-mark-sm" />
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
