/** Legal pages (EN + FR). Facts here must match how the app really works (see docs/SECURITY.md, docs/DATA_MODEL.md).
 * Bump LEGAL_VERSION (and server/routes/auth.ts TERMS_VERSION) when the Terms or Privacy Policy change materially.
 * These texts are a solid starting point, not legal advice: have them reviewed for your jurisdiction. */
import type { Lang } from './i18n'

export const LEGAL_VERSION = '2026-11-10'

// ---- fill these in (shown on the pages exactly as written) ----
export const OPERATOR = '[Operator name / company — to be completed]'
export const CONTACT_EMAIL = '[contact email — to be completed]'
export const GOVERNING_LAW = { en: '[country of the operator — to be completed]', fr: "[pays de l'éditeur — à compléter]" }

export type LegalDoc = 'privacy' | 'terms' | 'content-policy'
type Section = { h: string; p: string[] }
type Page = { title: string; intro: string; sections: Section[] }

const en: Record<LegalDoc, Page> = {
  privacy: {
    title: 'Privacy Policy',
    intro: `This policy explains what personal data CharaForge processes, why, and your rights. Operator: ${OPERATOR}. Contact: ${CONTACT_EMAIL}.`,
    sections: [
      { h: 'What we collect', p: [
        'Account: email address (confirmed with a one-time code we email you), display name, a salted hash of your password (we never store the password itself), the date you accepted these terms.',
        'Two-factor authentication (if enabled): an encrypted authenticator secret and hashed recovery codes.',
        'Your content: characters (name, description, art style), prompts, reference images you upload, generated designs, likes, reports you file, and your activity history.',
        'Security data: session records, a keyed hash (pseudonym) of your IP address, request logs and security events (for example failed logins). Passwords, codes and session tokens are never written to logs.',
      ] },
      { h: 'Why we use it (legal bases)', p: [
        'To provide the service you asked for: your account, the studio, exports, sharing (performance of a contract).',
        'To keep the service and its users safe: fraud and abuse prevention, rate limiting, security alerts, moderation of shared content (legitimate interest).',
        'We do not sell your data, show advertising, or use tracking or analytics cookies.',
      ] },
      { h: 'AI processing', p: [
        'To generate or edit an image, your prompt, character description and, when needed, the reference image and selected area are sent to AI models run by Cloudflare Workers AI. The result is returned to you and stored in your account. We do not use your content to train AI models.',
      ] },
      { h: 'What is public', p: [
        'Everything is private by default. A design becomes public only when you click "Share to community": it then appears in the community gallery and on its share page, with the character name, the prompt and your display name (never your email). Other members can like it and use it as the starting point of their own character. You can unshare it at any time.',
      ] },
      { h: 'Who processes your data', p: [
        'CharaForge runs on Cloudflare (hosting, database, file storage, AI inference), which processes data on our behalf on its global network. Verification and password-reset codes are sent by our email provider (Resend or Brevo), which receives only your email address and the message. Data may therefore be processed outside your country, with the safeguards these providers offer (including EU Standard Contractual Clauses).',
      ] },
      { h: 'How long we keep it', p: [
        'Account data and content: until you delete them or your account. "Delete account" erases your account, characters, designs, files and history from the live database immediately.',
        'Backups: encrypted, kept up to 30 days, then overwritten. Security logs: 90 days. Sessions: at most 30 days (7 days of inactivity).',
      ] },
      { h: 'Cookies and local storage', p: [
        'We only use strictly necessary cookies: "__Host-session" keeps you logged in and "__Host-csrf" protects your actions against cross-site attacks. Your browser also stores your language and whether you closed the cookie notice. No consent is required for these, and there are no advertising or analytics cookies.',
      ] },
      { h: 'Your rights', p: [
        'You can access, correct, export and delete your data: most of it directly in the app (Settings, exports, Delete account), and the rest by writing to us. You can also object to processing based on legitimate interest and lodge a complaint with your data protection authority (for example the CNIL in France or the INPDP in Tunisia).',
      ] },
      { h: 'Age', p: ['CharaForge is not intended for children under 13. If you are under the age required in your country to consent on your own (15 in France, 16 in some EU countries), you need your parent or guardian\'s permission.'] },
      { h: 'Security', p: ['HTTPS everywhere, salted password hashing, HttpOnly session cookies, CSRF protection, optional two-factor authentication (mandatory for administrators), per-user access control, rate limiting, encrypted backups and security monitoring. Details: our security documentation.'] },
      { h: 'Changes', p: [`We will announce material changes in the app. Version: ${LEGAL_VERSION}.`] },
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro: `By creating an account you agree to these terms, the Privacy Policy and the Content Policy. Service operated by ${OPERATOR}. Contact: ${CONTACT_EMAIL}.`,
    sections: [
      { h: 'Your account', p: ['You must be at least 13 years old (see the Privacy Policy for local age rules). Keep your password and recovery codes secret; you are responsible for activity on your account. Tell us immediately if you think it was compromised.'] },
      { h: 'The service', p: ['CharaForge is provided free of charge, as is. AI generation is subject to daily limits; when they are reached or the AI is unavailable, simpler preview art is used. We may change, limit or stop features, and we do not guarantee uninterrupted availability.'] },
      { h: 'Your content', p: [
        'You keep whatever rights you have in what you upload and create. You give us a worldwide, free license to store, process and display it only as needed to run the service for you.',
        'When you share a design to the community, you also allow us to display it publicly (gallery, share page, social previews) and allow other members to like it and to use it as the starting point of their own characters. Unsharing stops new uses; copies others already made remain theirs to keep.',
        'AI output can be imperfect or resemble existing works, and may not be protected by copyright in every country. You are responsible for how you use what you create, especially commercially.',
      ] },
      { h: 'Rules', p: ['You must follow the Content Policy. Do not try to break, overload or bypass the security of the service, access other people\'s data, or automate account creation.'] },
      { h: 'Moderation', p: ['Anyone can report a shared design. We may remove content, limit features or close accounts that break these terms, and we cooperate with lawful requests from authorities.'] },
      { h: 'Liability', p: ['To the extent permitted by law, the service is provided without warranties and we are not liable for indirect losses or for loss of content: keep your own copies of important work (use the exports). Nothing here limits rights you have under mandatory consumer law.'] },
      { h: 'Ending', p: ['You can delete your account at any time in Settings. We may suspend accounts that seriously or repeatedly break these terms.'] },
      { h: 'Law and changes', p: [`These terms are governed by the law of ${GOVERNING_LAW.en}, without depriving consumers of the protection of the mandatory rules of their country of residence. We will announce material changes in the app. Version: ${LEGAL_VERSION}.`] },
    ],
  },
  'content-policy': {
    title: 'Content Policy',
    intro: 'CharaForge is for creating original characters for games, comics and animation. These rules apply to everything you upload, generate and share.',
    sections: [
      { h: 'Not allowed', p: [
        'Sexual content or nudity. Any sexualised depiction of minors is strictly forbidden and will be reported to the authorities.',
        'Graphic violence or gore, content promoting terrorism, self-harm or illegal acts.',
        'Hate, harassment or discrimination against people or groups.',
        'Real people without their consent, impersonation or deceptive "deepfakes".',
        'Content you don\'t have the right to use: other artists\' work as references, or protected characters and brands you don\'t own or license.',
        'Spam, scams, malware or attempts to abuse the AI or the service.',
      ] },
      { h: 'Sharing', p: ['Only share designs that are fine for a general audience. Shared designs show your display name and can be used by others as a starting point.'] },
      { h: 'Reporting', p: ['Use "Report" on any community design. Reports are confidential and reviewed by our moderators, who can remove the design. Repeated or serious violations lead to account closure.'] },
    ],
  },
}

const fr: Record<LegalDoc, Page> = {
  privacy: {
    title: 'Politique de confidentialité',
    intro: `Cette politique explique quelles données personnelles CharaForge traite, pourquoi, et quels sont vos droits. Éditeur : ${OPERATOR}. Contact : ${CONTACT_EMAIL}.`,
    sections: [
      { h: 'Données collectées', p: [
        'Compte : adresse e-mail (confirmée par un code à usage unique que nous vous envoyons), nom affiché, une empreinte salée de votre mot de passe (nous ne conservons jamais le mot de passe lui-même), la date d\'acceptation de ces conditions.',
        'Double authentification (si activée) : un secret d\'application d\'authentification chiffré et des codes de secours hachés.',
        'Vos contenus : personnages (nom, description, style), prompts, images de référence importées, designs générés, « j\'aime », signalements effectués et historique d\'activité.',
        'Données de sécurité : sessions, une empreinte (pseudonyme) de votre adresse IP, journaux de requêtes et événements de sécurité (par exemple les connexions échouées). Les mots de passe, codes et jetons de session ne sont jamais journalisés.',
      ] },
      { h: 'Finalités et bases légales', p: [
        'Fournir le service demandé : compte, studio, exports, partage (exécution du contrat).',
        'Protéger le service et ses utilisateurs : prévention de la fraude et des abus, limitation de débit, alertes de sécurité, modération des contenus partagés (intérêt légitime).',
        'Nous ne vendons pas vos données, n\'affichons pas de publicité et n\'utilisons aucun cookie de suivi ou de mesure d\'audience.',
      ] },
      { h: 'Traitement par l\'IA', p: [
        'Pour générer ou modifier une image, votre prompt, la description du personnage et, si nécessaire, l\'image de référence et la zone sélectionnée sont envoyés à des modèles d\'IA exécutés par Cloudflare Workers AI. Le résultat vous est renvoyé et enregistré dans votre compte. Nous n\'utilisons pas vos contenus pour entraîner des modèles d\'IA.',
      ] },
      { h: 'Ce qui est public', p: [
        'Tout est privé par défaut. Un design ne devient public que si vous cliquez sur « Partager à la communauté » : il apparaît alors dans la galerie et sur sa page de partage, avec le nom du personnage, le prompt et votre nom affiché (jamais votre e-mail). Les autres membres peuvent l\'aimer et s\'en servir comme point de départ de leur propre personnage. Vous pouvez annuler le partage à tout moment.',
      ] },
      { h: 'Sous-traitants', p: [
        'CharaForge fonctionne sur Cloudflare (hébergement, base de données, stockage, inférence IA), qui traite les données pour notre compte sur son réseau mondial. Les codes de vérification et de réinitialisation sont envoyés par notre prestataire d\'e-mail (Resend ou Brevo), qui ne reçoit que votre adresse et le message. Les données peuvent donc être traitées hors de votre pays, avec les garanties offertes par ces prestataires (dont les clauses contractuelles types de l\'UE).',
      ] },
      { h: 'Durées de conservation', p: [
        'Données de compte et contenus : jusqu\'à leur suppression ou celle de votre compte. « Supprimer mon compte » efface immédiatement compte, personnages, designs, fichiers et historique de la base active.',
        'Sauvegardes : chiffrées, conservées 30 jours maximum puis écrasées. Journaux de sécurité : 90 jours. Sessions : 30 jours maximum (7 jours d\'inactivité).',
      ] },
      { h: 'Cookies et stockage local', p: [
        'Nous n\'utilisons que des cookies strictement nécessaires : « __Host-session » vous garde connecté et « __Host-csrf » protège vos actions contre les attaques intersites. Votre navigateur mémorise aussi votre langue et la fermeture du bandeau cookies. Ces éléments ne nécessitent pas de consentement ; il n\'y a aucun cookie publicitaire ou de mesure d\'audience.',
      ] },
      { h: 'Vos droits', p: [
        'Vous pouvez accéder à vos données, les rectifier, les exporter et les supprimer : en grande partie directement dans l\'application (Paramètres, exports, Supprimer mon compte), et pour le reste en nous écrivant. Vous pouvez aussi vous opposer aux traitements fondés sur l\'intérêt légitime et introduire une réclamation auprès de votre autorité de protection des données (par exemple la CNIL en France ou l\'INPDP en Tunisie).',
      ] },
      { h: 'Âge', p: ['CharaForge ne s\'adresse pas aux enfants de moins de 13 ans. Si vous n\'avez pas l\'âge requis dans votre pays pour consentir seul (15 ans en France, 16 ans dans certains pays de l\'UE), il vous faut l\'autorisation d\'un parent ou tuteur.'] },
      { h: 'Sécurité', p: ['HTTPS partout, mots de passe hachés et salés, cookies de session HttpOnly, protection CSRF, double authentification facultative (obligatoire pour les administrateurs), contrôle d\'accès par utilisateur, limitation de débit, sauvegardes chiffrées et surveillance de sécurité.'] },
      { h: 'Modifications', p: [`Nous annoncerons les changements importants dans l'application. Version : ${LEGAL_VERSION}.`] },
    ],
  },
  terms: {
    title: 'Conditions d\'utilisation',
    intro: `En créant un compte, vous acceptez ces conditions, la Politique de confidentialité et la Politique de contenu. Service édité par ${OPERATOR}. Contact : ${CONTACT_EMAIL}.`,
    sections: [
      { h: 'Votre compte', p: ['Vous devez avoir au moins 13 ans (voir la Politique de confidentialité pour les règles d\'âge locales). Gardez secrets votre mot de passe et vos codes de secours ; vous êtes responsable de l\'activité de votre compte. Prévenez-nous immédiatement en cas de compromission.'] },
      { h: 'Le service', p: ['CharaForge est fourni gratuitement, en l\'état. La génération par IA est soumise à des limites quotidiennes ; lorsqu\'elles sont atteintes ou que l\'IA est indisponible, un aperçu simplifié est utilisé. Nous pouvons modifier, limiter ou arrêter des fonctionnalités et ne garantissons pas une disponibilité ininterrompue.'] },
      { h: 'Vos contenus', p: [
        'Vous conservez les droits dont vous disposez sur ce que vous importez et créez. Vous nous accordez une licence mondiale et gratuite pour les stocker, les traiter et les afficher uniquement dans la mesure nécessaire au fonctionnement du service.',
        'Lorsque vous partagez un design à la communauté, vous nous autorisez aussi à l\'afficher publiquement (galerie, page de partage, aperçus sur les réseaux sociaux) et autorisez les autres membres à l\'aimer et à s\'en servir comme point de départ de leurs personnages. Annuler le partage empêche de nouvelles utilisations ; les copies déjà faites restent à leurs auteurs.',
        'Les résultats de l\'IA peuvent être imparfaits ou ressembler à des œuvres existantes, et ne sont pas forcément protégeables par le droit d\'auteur dans tous les pays. Vous êtes responsable de l\'usage que vous en faites, notamment commercial.',
      ] },
      { h: 'Règles', p: ['Vous devez respecter la Politique de contenu. N\'essayez pas de casser, surcharger ou contourner la sécurité du service, d\'accéder aux données d\'autrui ou d\'automatiser la création de comptes.'] },
      { h: 'Modération', p: ['Tout membre peut signaler un design partagé. Nous pouvons retirer des contenus, limiter des fonctionnalités ou fermer les comptes qui enfreignent ces conditions, et nous coopérons avec les demandes légales des autorités.'] },
      { h: 'Responsabilité', p: ['Dans les limites permises par la loi, le service est fourni sans garantie et nous ne sommes pas responsables des pertes indirectes ni de la perte de contenus : conservez vos propres copies des travaux importants (utilisez les exports). Rien ici ne limite les droits que vous tenez du droit impératif de la consommation.'] },
      { h: 'Fin', p: ['Vous pouvez supprimer votre compte à tout moment dans les Paramètres. Nous pouvons suspendre les comptes qui enfreignent gravement ou de façon répétée ces conditions.'] },
      { h: 'Droit applicable et modifications', p: [`Ces conditions sont régies par le droit de ${GOVERNING_LAW.fr}, sans priver les consommateurs de la protection des règles impératives de leur pays de résidence. Nous annoncerons les changements importants dans l'application. Version : ${LEGAL_VERSION}.`] },
    ],
  },
  'content-policy': {
    title: 'Politique de contenu',
    intro: 'CharaForge sert à créer des personnages originaux pour les jeux, la BD et l\'animation. Ces règles s\'appliquent à tout ce que vous importez, générez et partagez.',
    sections: [
      { h: 'Interdit', p: [
        'Contenus sexuels ou nudité. Toute représentation sexualisée de mineurs est strictement interdite et sera signalée aux autorités.',
        'Violence graphique ou gore, apologie du terrorisme, de l\'automutilation ou d\'actes illégaux.',
        'Haine, harcèlement ou discrimination envers des personnes ou des groupes.',
        'Personnes réelles sans leur consentement, usurpation d\'identité ou « deepfakes » trompeurs.',
        'Contenus que vous n\'avez pas le droit d\'utiliser : œuvres d\'autres artistes comme références, personnages ou marques protégés dont vous n\'avez pas les droits.',
        'Spam, arnaques, logiciels malveillants ou tentatives d\'abuser de l\'IA ou du service.',
      ] },
      { h: 'Partage', p: ['Ne partagez que des designs adaptés à tous les publics. Les designs partagés affichent votre nom et peuvent servir de point de départ à d\'autres membres.'] },
      { h: 'Signalement', p: ['Utilisez « Signaler » sur n\'importe quel design de la communauté. Les signalements sont confidentiels et examinés par nos modérateurs, qui peuvent retirer le design. Les infractions graves ou répétées entraînent la fermeture du compte.'] },
    ],
  },
}

export const legalPage = (doc: LegalDoc, lang: Lang): Page => (lang === 'fr' ? fr : en)[doc]
