import { createFileRoute } from "@tanstack/react-router";
import { SITE, SiteShell } from "@/components/site-chrome";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: `Mentions légales — ${SITE.name}` },
      {
        name: "description",
        content: `Mentions légales du site ${SITE.name} : éditeur, hébergeur, propriété intellectuelle.`,
      },
    ],
  }),
  component: MentionsLegales,
});

// Les champs « à compléter » doivent être remplis avant la mise en ligne.
function MentionsLegales() {
  return (
    <SiteShell>
      <main className="wrap legal">
        <div className="eyebrow">Informations légales</div>
        <h1>Mentions légales</h1>

        <h2>Éditeur du site</h2>
        <p>
          Le site {SITE.name} est édité par [raison sociale à compléter].
          <br />
          SIRET : [à compléter]
          <br />
          Adresse : [à compléter]
          <br />
          Registre des VTC : [numéro d'inscription à compléter]
          <br />
          Téléphone : {SITE.phoneDisplay}
          <br />
          Email : <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </p>

        <h2>Directeur de la publication</h2>
        <p>[À compléter].</p>

        <h2>Hébergeur</h2>
        <p>
          Render Services, Inc.
          <br />
          525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis
          <br />
          <a href="https://render.com" target="_blank" rel="noopener noreferrer">
            render.com
          </a>
        </p>

        <h2>Propriété intellectuelle</h2>
        <p>
          L'ensemble des contenus présents sur ce site (textes, logo, mise en page) est la propriété
          de {SITE.name}, sauf mention contraire. Toute reproduction sans autorisation préalable est
          interdite.
        </p>

        <h2>Données personnelles</h2>
        <p>
          Le traitement de vos données personnelles est détaillé sur notre page{" "}
          <a href="/confidentialite">Politique de confidentialité</a>.
        </p>
      </main>
    </SiteShell>
  );
}
