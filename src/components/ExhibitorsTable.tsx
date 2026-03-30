import { useState } from 'react';
import { Exhibitor } from '@/lib/schema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Search, Globe, Mail, Phone } from 'lucide-react';
import Papa from 'papaparse';

interface ExhibitorsTableProps {
  exhibitors: Exhibitor[];
}

export function ExhibitorsTable({ exhibitors }: ExhibitorsTableProps) {
  const [search, setSearch] = useState('');

  const filteredExhibitors = exhibitors.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    e.categories?.some(c => c.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExport = () => {
    const formattedData = filteredExhibitors.map(e => ({
      'Nom': e.name,
      'Description': e.description || '',
      'Site Web': e.website || '',
      'Stand': e.booth || '',
      'Pays': e.country || '',
      'Email': e.email || '',
      'Téléphone': e.phone || '',
      'Catégories': (e.categories || []).join(', '),
      'LinkedIn': e.linkedin || '',
      'Twitter': e.twitter || '',
    }));

    const csv = Papa.unparse(formattedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'exposants_shaarp.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (exhibitors.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background rounded-l-3xl shadow-sm my-4 mr-4 ml-0 border border-muted">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
          <Search size={32} className="text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Aucun exposant</h2>
        <p className="text-muted-foreground max-w-md">
          Utilisez l'assistant IA à gauche pour extraire la liste des exposants depuis les sites web.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 bg-background p-4 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Résultats d'Extraction
            <Badge variant="secondary" className="ml-2">{filteredExhibitors.length}</Badge>
          </h2>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <div className="relative w-full sm:w-64">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <Input 
               placeholder="Rechercher par nom ou tag..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="pl-9"
             />
          </div>
          <Button onClick={handleExport} className="flex items-center gap-2">
            <Download size={16} />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 rounded-xl border bg-background overflow-auto shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
            <TableRow>
              <TableHead>Exposant</TableHead>
              <TableHead>Localisation</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExhibitors.map((ex, i) => (
              <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium align-top">
                   <div className="flex flex-col gap-1">
                      <span className="text-base">{ex.name}</span>
                      {ex.website && ex.website !== "" && (
                         <a href={ex.website} target="_blank" rel="noreferrer" className="text-xs text-blue-500 flex items-center gap-1 hover:underline w-fit">
                           <Globe size={12}/> Site Web
                         </a>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                         {ex.linkedin && ex.linkedin !== "" && <a href={ex.linkedin} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-blue-700 transition font-bold text-xs" title="LinkedIn">in</a>}
                         {ex.twitter && ex.twitter !== "" && <a href={ex.twitter} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-blue-400 transition font-bold text-xs" title="Twitter/X">X</a>}
                      </div>
                   </div>
                </TableCell>
                <TableCell className="align-top">
                   <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {ex.booth && ex.booth !== "" && <span className="font-medium text-foreground">Stand: {ex.booth}</span>}
                      {ex.country && ex.country !== "" && <span>{ex.country}</span>}
                      {(!ex.booth || ex.booth === "") && (!ex.country || ex.country === "") && <span className="text-xs italic">-</span>}
                   </div>
                </TableCell>
                <TableCell className="align-top">
                   <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {ex.email && ex.email !== "" && <a href={`mailto:${ex.email}`} className="flex items-center gap-1 hover:text-foreground transition break-all"><Mail size={12} className="shrink-0"/> {ex.email}</a>}
                      {ex.phone && ex.phone !== "" && <span className="flex items-center gap-1"><Phone size={12}/> {ex.phone}</span>}
                      {(!ex.email || ex.email === "") && (!ex.phone || ex.phone === "") && <span className="italic text-xs">Non spécifié</span>}
                   </div>
                </TableCell>
                <TableCell className="align-top max-w-[200px]">
                   <div className="flex flex-wrap gap-1">
                      {ex.categories?.map((cat, j) => (
                        <Badge key={j} variant="outline" className="text-xs font-normal">
                           {cat}
                        </Badge>
                      ))}
                      {(!ex.categories || ex.categories.length === 0) && <span className="text-xs text-muted-foreground italic">-</span>}
                   </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredExhibitors.length === 0 && (
               <TableRow>
                 <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Aucun exposant trouvé correspondant à votre recherche.</TableCell>
               </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
