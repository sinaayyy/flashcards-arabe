// Configuration Supabase (synchro du compte).
// Renseigne ces 2 valeurs depuis ton projet Supabase :
//   Project Settings → API → "Project URL" et "anon public" key.
// Tant qu'elles sont vides, le site fonctionne en local uniquement (sans compte).
// Note : la clé "anon" est PUBLIQUE par conception (protégée par les règles RLS),
// donc elle peut être commitée sans risque.
window.SUPABASE_CONFIG = {
  url: "https://kilgobplcmoorrnvihpw.supabase.co",
  anonKey: "sb_publishable_y2hI-acbyMuTwVrZWzlw_w_o_3ZDn_1", // clé "publishable" (publique)
};
