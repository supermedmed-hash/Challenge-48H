import { z } from "zod";

export const exhibitorSchema = z.object({
  name: z.string().describe("Nom de l'exposant. Requis."),
  description: z.string().describe("Description de l'entreprise ou de l'exposant. Laisser vide si non trouvé."),
  website: z.string().describe("URL du site web de l'exposant. Laisser vide si non trouvé."),
  logo: z.string().describe("URL vers l'image du logo de l'exposant. Laisser vide si non trouvé."),
  booth: z.string().describe("Numéro de stand ou emplacement. Laisser vide si non trouvé."),
  country: z.string().describe("Pays d'origine de l'exposant. Laisser vide si non trouvé."),
  linkedin: z.string().describe("Lien vers le profil LinkedIn. Laisser vide si non trouvé."),
  twitter: z.string().describe("Lien vers le profil Twitter ou X. Laisser vide si non trouvé."),
  categories: z.array(z.string()).describe("Liste des catégories ou secteurs d'activité. Liste vide si non trouvé."),
  email: z.string().describe("Adresse email de contact. Laisser vide si non trouvé."),
  phone: z.string().describe("Numéro de téléphone. Laisser vide si non trouvé."),
});

export type Exhibitor = z.infer<typeof exhibitorSchema>;

export const extractionProcessSchema = z.object({
  exhibitors: z.array(exhibitorSchema).describe("Liste des exposants trouvés sur la page"),
});
