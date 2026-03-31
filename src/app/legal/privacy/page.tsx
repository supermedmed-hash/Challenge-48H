import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground p-8 md:p-16 lg:p-24 font-sans">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8 transition-all">
          <ArrowLeft size={16} />
          Retour à l'application
        </Link>
        
        <h1 className="text-4xl font-bold mb-8 tracking-tight">Politique de Confidentialité (RGPD)</h1>
        
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Collecte des données</h2>
            <p>
              Shaarp Scraper AI extrait des données professionnelles publiques depuis les sites officiels de salons et foires professionnelles. 
              Les données collectées incluent : nom de l'entreprise, site web, numéro de stand, réseaux sociaux professionnels (LinkedIn, X), email de contact professionnel et numéro de téléphone professionnel.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Finalité du traitement</h2>
            <p>
              Le traitement de ces données a pour but unique la prospection commerciale B2B (Business to Business) et la constitution de fichiers de prospection pour les utilisateurs de l'outil. 
              L'outil agit comme un facilitateur d'accès aux informations déjà publiques.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Base légale</h2>
            <p>
              Conformément à l'intérêt légitime (Article 6.1.f du RGPD), la collecte d'informations professionnelles de contact est autorisée dans un but de prospection commerciale B2B, 
              à condition que les personnes concernées puissent s'y opposer simplement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Conservation et Partage</h2>
            <p>
              Shaarp Scraper AI ne conserve pas les données extraites sur ses propres serveurs de manière permanente. Les données sont traitées de manière éphémère durant la session de l'utilisateur. 
              Nous ne revendons aucune donnée à des tiers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Vos droits</h2>
            <p>
              Bien que les données soient professionnelles, vous disposez d'un droit d'accès, de rectification et d'opposition. 
              Pour toute demande concernant vos données, veuillez contacter l'administrateur de votre instance Shaarp.
            </p>
          </section>
        </div>
        
        <div className="mt-16 pt-8 border-t border-border text-sm text-muted-foreground italic">
          Dernière mise à jour : 31 mars 2026
        </div>
      </div>
    </main>
  );
}
