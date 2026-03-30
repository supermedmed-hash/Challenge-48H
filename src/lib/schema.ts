import { z } from "zod";

export const exhibitorSchema = z.object({
  name: z.string().describe("Nom de l'exposant (Requis)"),
  description: z.string().optional().describe("Description de l'entreprise ou de l'exposant"),
  website: z.string().optional().describe("URL du site web de l'exposant"),
  logo: z.string().optional().describe("URL vers l'image du logo de l'exposant"),
  booth: z.string().optional().describe("Numéro de stand ou emplacement"),
  country: z.string().optional().describe("Pays d'origine de l'exposant"),
  linkedin: z.string().optional().describe("Lien vers le profil LinkedIn"),
  twitter: z.string().optional().describe("Lien vers le profil Twitter ou X"),
  categories: z.array(z.string()).optional().describe("Catégories, tags ou secteur d'activité de l'exposant"),
  email: z.string().optional().describe("Adresse email de contact"),
  phone: z.string().optional().describe("Numéro de téléphone"),
});

export type Exhibitor = z.infer<typeof exhibitorSchema>;

export const extractionProcessSchema = z.object({
  exhibitors: z.array(exhibitorSchema).describe("Liste des exposants trouvés sur la page"),
});
