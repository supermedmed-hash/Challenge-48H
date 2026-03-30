import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * UTILS : Gestion des styles CSS
 * Cette fonction permet de fusionner des classes Tailwind proprement, 
 * en évitant les conflits (ex: 'p-2 p-4' devient 'p-4').
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
