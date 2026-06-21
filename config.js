// Configuration Supabase (synchro du compte).
// Renseigne ces 2 valeurs depuis ton projet Supabase :
//   Project Settings → API → "Project URL" et "anon public" key.
// Tant qu'elles sont vides, le site fonctionne en local uniquement (sans compte).
// Note : la clé "anon" est PUBLIQUE par conception (protégée par les règles RLS),
// donc elle peut être commitée sans risque.
window.SUPABASE_CONFIG = {
  url: "",      // ex. "https://abcdefgh.supabase.co"
  anonKey: "",  // ex. "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
};
