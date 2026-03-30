import { Progress } from "@/components/ui/progress";
import { Loader2, Zap, Globe, Database, CheckCircle, AlertCircle } from "lucide-react";

/**
 * COMPOSANT : BARRE DE PROGRESSION
 * Affiche l'avancement du robot (connexion, collecte des liens, extraction profonde).
 */
interface ScrapeProgressProps {
  status: string;  // Le message de texte (ex: "En cours...")
  current: number; // Nombre d'entreprises traitées jusqu'ici
  total: number;   // Nombre total d'entreprises à traiter
  phase: 'idle' | 'connecting' | 'collecting' | 'scraping' | 'done' | 'error';
}

export function ScrapeProgress({ status, current, total, phase }: ScrapeProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  // Choisit une icône animée en fonction de ce que fait le robot
  const getIcon = () => {
    switch(phase) {
      case 'connecting': return <Globe className="text-blue-500 animate-pulse" size={20} />; // Globe qui bat (connexion)
      case 'collecting': return <Zap className="text-yellow-500 animate-pulse" size={20} />; // Éclair (recherche de liens)
      case 'scraping': return <Database className="text-indigo-500 animate-pulse" size={20} />; // Base de données (extraction profonde)
      case 'done': return <CheckCircle className="text-green-500" size={20} />; // Check vert (terminé)
      case 'error': return <AlertCircle className="text-red-500" size={20} />; // Alerte rouge (erreur)
      default: return <Loader2 className="animate-spin text-muted-foreground" size={20} />;
    }
  };

  return (
    <div className="bg-background border-b px-6 py-4 flex flex-col gap-3 shrink-0 shadow-sm z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getIcon()}
          <span className="font-medium text-sm text-foreground">{status}</span>
        </div>
        
        {phase === 'scraping' && total > 0 && (
          <span className="text-sm font-semibold text-muted-foreground">
            {current} / {total} ({percentage}%)
          </span>
        )}
      </div>
      
      {(phase === 'scraping' || phase === 'done') && total > 0 && (
        <Progress value={percentage} className="h-2" />
      )}
    </div>
  );
}
