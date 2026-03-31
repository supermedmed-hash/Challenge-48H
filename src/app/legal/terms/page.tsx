import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground p-8 md:p-16 lg:p-24 font-sans text-muted-foreground leading-relaxed">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8 transition-all">
          <ArrowLeft size={16} />
          Retour à l'application
        </Link>
        
        <h1 className="text-4xl font-bold mb-8 text-foreground tracking-tight">Conditions Générales d'Utilisation (CGU)</h1>
        
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3 font-sans">1. Objet du service</h2>
            <p>
              Le service Shaarp Scraper AI permet d'extraire de manière automatisée des informations publiques professionnelles de salons d'expositions. 
              L'outil fait office de moteur de recherche assisté par l'IA.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3 font-sans">2. Responsabilité de l'utilisateur</h2>
            <p>
              L'utilisateur est seul responsable de l'usage qu'il fait des données extraites. 
              L'utilisateur s'engage à respecter les lois en vigueur concernant la prospection commerciale (LPD en Suisse, RGPD en Europe).
              Toute utilisation malveillante, spamming massif ou tentative de déstabilisation des serveurs tiers est strictement interdite.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3 font-sans">3. Propriété Intellectuelle</h2>
            <p>
              Shaarp Scraper AI ne sature pas les droits de propriété des sites web analysés. 
              L'utilisateur doit respecter les mentions légales des sites scrapés. 
              La marque Shaarp Scraper AI et son code source sont protégés par le droit d'auteur.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3 font-sans">4. Limitation de Responsabilité</h2>
            <p>
              L'outil fournit les données en l'état. Nous ne garantissons pas l'exhaustivité ni l'exactitude des données scrapées. 
              Nous ne saurions être tenus responsables en cas d'erreurs de l'IA (hallucinations ou sélecteurs obsolètes).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3 font-sans">5. Disponibilité</h2>
            <p>
              Le service est fourni selon les capacités techniques du moment. 
              L'accès à l'IA et aux navigateurs distants peut être interrompu pour maintenance ou quota épuisé.
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
