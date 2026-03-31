import { z } from "zod";

/**
 * Schémas de validation Zod pour l'extraction de données.
 * Ces schémas sont utilisés par GPT pour structurer ses réponses JSON.
 */

/**
 * Schéma représentant un exposant individuel dans une liste (Phase 1).
 */
export const exhibitorSchema = z.object({
  name: z.string().describe("Nom de l'exposant. Requis."),
  website: z.string().describe("URL du site web de l'exposant. Laisser vide si non trouvé."),
  booth: z.string().describe("Numéro de stand ou emplacement. Laisser vide si non trouvé."),
  linkedin: z.string().describe("Lien vers le profil LinkedIn. Laisser vide si non trouvé."),
  twitter: z.string().describe("Lien vers le profil Twitter ou X. Laisser vide si non trouvé."),
  email: z.string().describe("Adresse email de contact. Laisser vide si non trouvé."),
  phone: z.string().describe("Numéro de téléphone. Laisser vide si non trouvé."),
});

// Type TypeScript généré pour un exposant
export type Exhibitor = z.infer<typeof exhibitorSchema>;

/**
 * Schéma pour l'extraction groupée d'exposants.
 */
export const extractionProcessSchema = z.object({
  exhibitors: z.array(exhibitorSchema).describe("Liste des exposants trouvés sur la page"),
});

/**
 * Schéma détaillé pour un seul exposant (Phase 2 - après clic sur la fiche).
 * Permet une extraction plus granulaire sur la page de détail.
 */
export const singleExhibitorSchema = z.object({
  name: z.string().describe("Nom de l'exposant. Requis."),
  website: z.string().describe("URL du site web officiel. Laisser vide si non trouvé."),
  booth: z.string().describe("Numéro de stand. Laisser vide si non trouvé."),
  linkedin: z.string().describe("URL LinkedIn. Laisser vide si non trouvé."),
  twitter: z.string().describe("URL Twitter/X. Laisser vide si non trouvé."),
  email: z.string().describe("Email de contact. Laisser vide si non trouvé."),
  phone: z.string().describe("Téléphone. Laisser vide si non trouvé."),
});

/**
 * Objet de réponse final pour le traitement d'une fiche individuelle.
 */
export const singleExhibitorProcessSchema = z.object({
  exhibitor: singleExhibitorSchema.describe("Données extraites de la fiche exposant"),
});
