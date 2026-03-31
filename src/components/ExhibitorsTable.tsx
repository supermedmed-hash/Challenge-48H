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
import { Download, Search, Globe, Mail, Phone, Link, X, ChevronDown } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface ExhibitorsTableProps {
  exhibitors: Exhibitor[];
  isLoading?: boolean;
}

export function ExhibitorsTable({ exhibitors, isLoading }: ExhibitorsTableProps) {
  const [search, setSearch] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const filteredExhibitors = exhibitors.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = (format: 'csv' | 'xlsx') => {
    const formattedData = filteredExhibitors.map(e => ({
      'Nom': e.name,
      'Site Web': e.website || '',
      'Stand': e.booth || '',
      'Email': e.email || '',
      'Téléphone': e.phone || '',
      'LinkedIn': e.linkedin || '',
      'Twitter': e.twitter || '',
    }));

    if (format === 'csv') {
      const csv = Papa.unparse(formattedData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `exposants_shaarp_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Exposants");
      XLSX.writeFile(workbook, `exposants_shaarp_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  if (exhibitors.length === 0 && !isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background rounded-l-3xl shadow-sm my-4 mr-4 ml-0 border border-muted animate-in fade-in duration-500">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
          <Search size={32} className="text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Aucun contact</h2>
        <p className="text-muted-foreground max-w-md">
          L'assistant IA va extraire les coordonnées de contact dès que vous fournissez une URL.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 bg-background p-4 rounded-lg border shadow-sm w-full">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Contacts Extraits
            <Badge variant="secondary" className="ml-2">{filteredExhibitors.length}</Badge>
          </h2>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pt-[20px] pb-[20px]"
            />
          </div>
          <div className="relative flex items-center bg-primary text-primary-foreground rounded-md shadow-sm transition-all">
            <button
              onClick={() => handleExport('csv')}
              className="h-10 px-4 text-sm font-medium border-r border-primary-foreground/20 hover:bg-primary/90 transition-colors rounded-l-md"
              title="Exporter en CSV"
            >
              Export
            </button>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="h-10 px-3 hover:bg-primary/90 transition-colors rounded-r-md"
              title="Options d'export"
            >
              <ChevronDown size={14} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-32 bg-popover text-popover-foreground border rounded-md shadow-lg z-30 py-1 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      handleExport('xlsx');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    Export XLSX
                  </button>
                  <button
                    onClick={() => {
                      handleExport('csv');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors sm:hidden"
                  >
                    Export CSV
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-lg border bg-background overflow-x-auto shadow-sm w-full">
        <Table className="min-w-[600px] w-full table-fixed">
          <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[30%]">Exposant</TableHead>
              <TableHead className="w-[15%]">Stand</TableHead>
              <TableHead className="w-[40%]">Coordonnées Directes</TableHead>
              <TableHead className="w-[15%] text-right">Réseaux</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExhibitors.map((ex, i) => (
              <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium align-top whitespace-normal break-words py-4">
                  <div className="flex flex-col gap-1 pr-2">
                    <span className="text-base leading-tight">{ex.name}</span>
                    {ex.website && ex.website !== "" && (
                      <a href={ex.website} target="_blank" rel="noreferrer" className="text-xs text-blue-500 flex items-center gap-1 hover:underline w-fit">
                        <Globe size={12} /> Site Web
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="align-top whitespace-normal break-words py-4">
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {ex.booth && ex.booth !== "" ? (
                      <span className="font-medium text-foreground">Stand: {ex.booth}</span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground/50">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="align-top whitespace-normal break-words py-4">
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {ex.email && ex.email !== "" && (
                      <a href={`mailto:${ex.email}`} className="flex items-center gap-1 hover:text-foreground transition break-all">
                        <Mail size={12} className="shrink-0" /> {ex.email}
                      </a>
                    )}
                    {ex.phone && ex.phone !== "" && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} /> {ex.phone}
                      </span>
                    )}
                    {(!ex.email || ex.email === "") && (!ex.phone || ex.phone === "") && (
                      <span className="italic text-xs text-muted-foreground/50">Non spécifié</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="align-top text-right">
                  <div className="flex items-center justify-end gap-3">
                    {ex.linkedin && ex.linkedin !== "" && (
                      <a href={ex.linkedin} target="_blank" rel="noreferrer" className="text-[#0077B5] hover:opacity-80 transition" title="LinkedIn">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                      </a>
                    )}
                    {ex.twitter && ex.twitter !== "" && (
                      <a href={ex.twitter} target="_blank" rel="noreferrer" className="text-foreground hover:opacity-80 transition" title="X (Twitter)">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.29 19.494h2.039L6.486 3.24H4.298l13.313 17.407z" /></svg>
                      </a>
                    )}
                    {(!ex.linkedin || ex.linkedin === "") && (!ex.twitter || ex.twitter === "") && (
                      <span className="text-xs text-muted-foreground/30">-</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="animate-pulse">
                <TableCell>
                  <div className="h-4 w-32 bg-muted rounded mb-2" />
                  <div className="h-3 w-20 bg-muted/50 rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-16 bg-muted rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-40 bg-muted rounded mb-2" />
                  <div className="h-4 w-32 bg-muted rounded" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="h-8 w-8 rounded-full bg-muted" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredExhibitors.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Aucun contact trouvé.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
