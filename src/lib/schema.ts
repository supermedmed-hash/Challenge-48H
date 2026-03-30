import { z } from "zod";

export const exhibitorSchema = z.object({
  name: z.string().describe("Nom de l'exposant. Requis."),
  website: z.string().describe("URL du site web de l'exposant. Laisser vide si non trouvé."),
  booth: z.string().describe("Numéro de stand ou emplacement. Laisser vide si non trouvé."),
  linkedin: z.string().describe("Lien vers le profil LinkedIn. Laisser vide si non trouvé."),
  twitter: z.string().describe("Lien vers le profil Twitter ou X. Laisser vide si non trouvé."),
  email: z.string().describe("Adresse email de contact. Laisser vide si non trouvé."),
  phone: z.string().describe("Numéro de téléphone. Laisser vide si non trouvé."),
});

export type Exhibitor = z.infer<typeof exhibitorSchema>;

export const extractionProcessSchema = z.object({
  exhibitors: z.array(exhibitorSchema).describe("Liste des exposants trouvés sur la page"),
});

// Schema for a single exhibitor detail page extraction
export const singleExhibitorSchema = z.object({
  name: z.string().describe("Nom de l'exposant. Requis."),
  website: z.string().describe("URL du site web officiel. Laisser vide si non trouvé."),
  booth: z.string().describe("Numéro de stand. Laisser vide si non trouvé."),
  linkedin: z.string().describe("URL LinkedIn. Laisser vide si non trouvé."),
  twitter: z.string().describe("URL Twitter/X. Laisser vide si non trouvé."),
  email: z.string().describe("Email de contact. Laisser vide si non trouvé."),
  phone: z.string().describe("Téléphone. Laisser vide si non trouvé."),
});

export const singleExhibitorProcessSchema = z.object({
  exhibitor: singleExhibitorSchema.describe("Données extraites de la fiche exposant"),
});
