/**
 * Décode en profondeur et de manière récursive toutes les entités HTML
 * (ex: &#x27;, &#X27;, &#39;, &#039;, &apos;, &quot;, &amp;, &lt;, &gt;, &#x2F;, &#X2F;, etc.)
 * Gère le multi-encodage (ex: &amp;#x27; -> &#x27; -> ') et l'insensibilité à la casse.
 * @param {string} str - Chaîne potentiellement encodée.
 * @returns {string} - Chaîne texte propre et décodée.
 */
export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  
  let current = str;
  let prev = '';
  let iterations = 0;

  // Décodage récursif en boucle pour résoudre le multi-encodage (ex: &amp;#x27; -> &#x27; -> ')
  while (current !== prev && iterations < 5) {
    prev = current;
    iterations++;

    // Hex entities: &#x27;, &#X27;, &#x2F;, &#X2F;, etc.
    current = current.replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => {
      try {
        const code = parseInt(hex, 16);
        return !isNaN(code) ? String.fromCharCode(code) : match;
      } catch (e) {
        return match;
      }
    });

    // Decimal entities: &#39;, &#039;, &#34;, &#38;, etc.
    current = current.replace(/&#(\d+);/g, (match, dec) => {
      try {
        const code = parseInt(dec, 10);
        return !isNaN(code) ? String.fromCharCode(code) : match;
      } catch (e) {
        return match;
      }
    });

    // Common named entities
    current = current
      .replace(/&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&');
  }

  return current;
}

export const unescapeHTML = decodeHtmlEntities;

/**
 * Nettoie les entrées utilisateur pour supprimer les balises HTML/Script dangereuses
 * tout en préservant fidèlement les caractères normaux (apostrophes, guillemets, barres obliques, etc.).
 * @param {string} str - La chaîne brute à nettoyer.
 * @returns {string}
 */
export function sanitizeInputString(str) {
  if (typeof str !== 'string') return '';
  // Décode d'abord toute entité HTML résiduelle pour éviter le stockage d'entités brutes
  const decoded = decodeHtmlEntities(str);
  return decoded
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

/**
 * Valide un numéro de téléphone selon un format standard (chiffres, espaces, tirets, +).
 * Autorise les numéros de 8 à 20 caractères.
 * @param {string} phone
 * @returns {boolean}
 */
export function validatePhoneNumber(phone) {
  if (typeof phone !== 'string') return false;
  const phoneRegex = /^[+0-9\s-]{8,20}$/;
  return phoneRegex.test(phone.trim());
}

