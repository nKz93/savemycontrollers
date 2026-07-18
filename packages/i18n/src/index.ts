import fr from "./locales/fr.json";

/**
 * Le francais est la langue initiale, mais toute chaine visible par un
 * utilisateur doit passer par ce dictionnaire (jamais de texte en dur
 * dans les composants ou les templates). L'ajout d'une langue se fait
 * en ajoutant un fichier locales/<code>.json avec les memes cles.
 */
export const SUPPORTED_LOCALES = ["fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DICTIONARIES: Record<SupportedLocale, Record<string, string>> = { fr };

export function translate(locale: SupportedLocale, key: string, vars?: Record<string, string>): string {
  const dictionary = DICTIONARIES[locale] ?? DICTIONARIES.fr;
  let value = dictionary[key] ?? key;
  if (vars) {
    for (const [varKey, varValue] of Object.entries(vars)) {
      value = value.replace(`{${varKey}}`, varValue);
    }
  }
  return value;
}
