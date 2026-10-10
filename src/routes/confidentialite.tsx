import { createFileRoute } from "@tanstack/react-router";
import { SITE, SiteShell } from "@/components/site-chrome";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: `Politique de confidentialité — ${SITE.name}` },
      {
        name: "description",
        content: `Comment ${SITE.name} collecte et protège vos données personnelles.`,
      },
    ],
  }),
  component: Confidentialite,
});

function Confidentialite() {
  const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;
  return (
    <SiteShell>
      <main className="wrap legal">
        <div className="eyebrow">Dernière mise à jour : octobre 2026</div>
        <h1>Politique de confidentialité</h1>

        <h2>Qui traite vos données ?</h2>
        <p>
          {SITE.name}, service de chauffeur privé (VTC), est responsable du traitement des données
          collectées sur ce site. Pour toute question relative à vos données, contactez-nous à{" "}
          {mail} ou au {SITE.phoneDisplay}.
        </p>

        <h2>Quelles données sont collectées ?</h2>
        <p>
          Lorsque vous effectuez une réservation, nous collectons : votre nom, votre email, votre
          téléphone, les adresses de départ et d'arrivée, la date et l'heure du trajet, et les
          informations que vous nous donnez volontairement (numéro de vol, remarques). Ces données
          sont nécessaires à l'exécution de votre course et sont stockées de façon sécurisée
          (hébergement Supabase).
        </p>
        <p>
          Les adresses saisies sont transmises à Google Maps pour proposer des suggestions et
          calculer la distance du trajet.
        </p>
        <p>
          Si vous payez en ligne, le paiement est traité directement par notre prestataire Stripe ;
          nous ne stockons jamais vos coordonnées bancaires.
        </p>

        <h2>Vos droits</h2>
        <p>
          Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et
          de portabilité de vos données, ainsi que d'un droit d'opposition. Vous pouvez exercer ces
          droits à tout moment en nous écrivant à {mail}.
        </p>

        <h2>Cookies</h2>
        <p>
          Ce site ne dépose aucun cookie publicitaire ni de mesure d'audience. Seuls les éléments
          techniques nécessaires au fonctionnement du site (réservation, paiement) sont utilisés.
        </p>

        <h2>Sécurité</h2>
        <p>
          Vos données sont hébergées chez des prestataires qui appliquent des mesures de sécurité
          techniques et organisationnelles (chiffrement des échanges, accès restreint). Les
          paiements en ligne sont exclusivement traités par Stripe, certifié PCI-DSS.
        </p>
      </main>
    </SiteShell>
  );
}
