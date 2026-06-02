# Guide de l'équipe — VisaFlow France

**Pour les conseillers, examinateurs et administrateurs**

VisaFlow France centralise la gestion des **dossiers visa d'étudiants déjà admis dans une école privée française** (hors Campus France / Études en France). Ce guide explique comment utiliser l'application au quotidien selon votre rôle.

---

## 1. Rôles et permissions

L'application distingue cinq rôles, chacun avec un niveau d'accès différent :

| Rôle | Accès principal |
|---|---|
| **Étudiant** | Son propre dossier uniquement |
| **Conseiller** | Portefeuille d'étudiants assignés, suivi opérationnel |
| **Examinateur** | Validation/rejet des documents, contrôle qualité |
| **Administrateur** | Gestion de l'organisation (équipe, écoles, facturation) |
| **Super-admin** | Configuration multi-organisations et paramètres globaux |

Votre rôle est attribué par votre administrateur lors de la création de votre compte.

---

## 2. Connexion et sécurité

### Première connexion
1. Vous recevez un e-mail d'invitation contenant un lien de création de compte.
2. Cliquez sur le lien, choisissez un mot de passe fort et confirmez votre adresse.
3. Vous arrivez sur votre tableau de bord personnalisé.

### Double authentification (2FA)
- **Recommandée pour tous**, **obligatoire pour les administrateurs** si activée par votre organisation.
- Activation : **Profil → Sécurité → Activer la 2FA**.
- Scannez le QR code avec une application d'authentification (Google Authenticator, Authy, 1Password…).
- Un code à 6 chiffres vous sera demandé à chaque connexion.

### Restriction par IP (administrateurs)
Si votre organisation a configuré une liste d'IP autorisées, vous ne pourrez accéder à l'interface d'administration que depuis ces adresses (par exemple le bureau).

---

## 3. Tableau de bord conseiller

Dès la connexion, vous voyez :

- **Statistiques de portefeuille** : nombre total d'étudiants, dossiers actifs, en attente, bloqués, visas obtenus, visas refusés.
- **Étudiants urgents** : liste des dossiers à risque élevé ou avec actions en retard.
- **Activité récente** : flux temps réel des actions de l'équipe et des étudiants (dépôt de document, message reçu, etc.).
- **Calendrier intake** : aperçu des prochaines rentrées d'écoles.

---

## 4. Gestion des dossiers étudiants

### Liste des étudiants
**Menu : Étudiants**
- Recherche par nom ou e-mail.
- Filtres par statut (Prospect, Actif, Déposé, Visa obtenu…), école, pays, conseiller assigné.
- Bouton **Nouveau dossier** pour créer un étudiant manuellement.

### Fiche étudiant
La fiche d'un étudiant est organisée en onglets :

#### Onglet **Parcours**
Vue chronologique des **16 étapes** (profil, admission, justificatifs, TLS/VFS, consulat, OFII). Les étapes Campus France n'apparaissent que si le pays l'exige. Chaque étape affiche son statut (À faire, En cours, En revue, Validé, Bloqué).
Vous pouvez **faire avancer une étape** ou la **bloquer** en cas de problème.

#### Onglet **Documents**
- Liste de tous les documents requis selon la matrice (nationalité × niveau).
- Chaque document affiche son statut, sa date d'expiration, son score de confiance IA.
- **Extraction IA automatique** : à l'upload, l'IA extrait les champs (nom, dates, numéros) — vous voyez le niveau de confiance et les avertissements éventuels (catégorie incohérente, document expiré bientôt…).
- **Validation** : bouton **Valider** ou **Rejeter avec motif** (motif obligatoire en cas de rejet).
- **Relance d'extraction** disponible si la première tentative a échoué.

#### Onglet **Messages**
- Discussion avec l'étudiant.
- **Note interne** (cochée par défaut côté équipe) : commentaire visible uniquement par l'équipe, jamais par l'étudiant.
- **Traduction IA** : les messages dans une langue autre que celle de l'étudiant sont traduits automatiquement. Un bouton permet de basculer entre original et traduction.

#### Onglet **Tâches**
- Créer, assigner et suivre des tâches liées à un étudiant (ex. « Vérifier l'authenticité du diplôme »).
- Statuts : À faire, En cours, Terminé, Annulé.

#### Onglet **Rendez-vous**
- Planifier les RDV **TLS/VFS**, consulat, biométrie, etc.
- Statuts : À venir, Terminé, Manqué.

#### Onglet **Risque**
- **Score automatique** : niveau Faible / Moyen / Élevé calculé à partir de la complétude du dossier et de signaux historiques.
- **Explication IA du risque** : narration générée par IA qui résume les points forts et faibles du dossier. Bouton **Regénérer** disponible. Vous pouvez voter pour donner un feedback (pouce haut/bas).

#### Onglet **Profil**
Informations personnelles, état civil, contact, intake (date de rentrée).

#### Onglet **Profil approfondi**
- Complétude visualisée en pourcentage.
- État civil détaillé, parents, fratrie, adresse.
- Scolarité antérieure (établissements, diplômes, mentions, années).
- Tests de langue (TCF, DELF, TOEFL…) avec alertes d'expiration (renouvellement nécessaire à 90 jours).
- Équivalences de diplômes (ENIC-NARIC).
- Candidatures école (jusqu'à 7 vœux : école, programme, motivation).

#### Onglet **Garanties & logement**
- Calcul de la capacité financière (seuil minimum requis par le visa).
- Justificatifs : attestations bancaires, bourses, garants.
- Hébergement (justificatif), CVEC (paiement ou exonération).
- **Verrou de soumission** : un dossier ne peut être soumis sans ces justificatifs.

#### Onglet **Projet & lettres**
- Édition du Projet d'études (avec versionnage et compteur de mots).
- Lettres de motivation par candidature école.
- **Coach IA** : critique en streaming, points forts/faibles, suggestion d'amélioration paragraphe par paragraphe.
- Notation automatique selon une rubrique : Cohérence, Français, Spécificité, Plan de retour, Note globale.

---

## 5. Communications et collaboration

### Notes internes
Toute discussion d'équipe est cloisonnée. Cochez **Note interne** lors de la rédaction d'un commentaire — l'étudiant ne le verra jamais.

### Copilote équipe
Sur la fiche étudiant, un bouton **Synthèse IA** génère un résumé complet du dossier (utile avant un appel ou un RDV).

### Calendrier partagé
- Export ICS / Webcal des RDV et échéances de votre portefeuille.
- Compatible Google Calendar, Apple Calendar, Outlook.
- **Profil → Calendrier → Copier le lien de flux**.

---

## 6. Outils administrateurs

### Menu **Administration**

#### Utilisateurs
- Inviter un nouveau membre par e-mail.
- Modifier les rôles (Étudiant, Conseiller, Examinateur, Administrateur, Super-admin).
- Désactiver un compte (l'utilisateur ne pourra plus se connecter, mais les données sont conservées).

#### Écoles
- Catalogue des écoles partenaires (nom, ville, site web).
- Utilisé pour les vœux EEF des étudiants.

#### Pays
- Liste des pays sources avec leur **centre TLS/VFS** et le statut procédure visa pays (Requis / Non requis).

#### Import en masse
- Import CSV/XLSX d'une cohorte entière d'étudiants.
- Aperçu avec détection des doublons, mapping automatique des écoles.
- **Important** : les imports sont strictement cloisonnés à votre organisation — aucune fuite possible vers d'autres tenants.

#### Journaux d'audit
- Historique complet de toutes les actions (création, modification, validation, suppression).
- Recherche par utilisateur, action, type d'objet.
- Conforme aux exigences RGPD.

### Menu **Facturation** (administrateurs)
- Plan actuel (Free, Pro, Agency) et état de l'abonnement.
- Bouton **Gérer mon abonnement** : redirection vers le portail Stripe pour changer de formule, mettre à jour la carte, télécharger les factures.
- Limites en cours : nombre d'utilisateurs, nombre d'étudiants, budget IA mensuel.

### Menu **Personnalisation (white-label)**
- Logo de l'organisation (URL).
- Couleur principale (la barre, les boutons et accents s'adapteront).
- Nom et adresse e-mail d'expéditeur pour les notifications.
- Sous-domaine personnalisé (si configuré).

### Sécurité organisation
- **2FA obligatoire** : activer pour forcer tous les administrateurs à utiliser la double authentification.
- **Liste d'IP autorisées** : restreindre l'accès admin à certaines adresses IP.

---

## 7. RGPD et confidentialité

VisaFlow France est conçu pour la conformité RGPD.

### Pour vos étudiants
- Ils peuvent **exporter leurs données** (archive ZIP avec JSON + liens vers leurs documents) depuis **Profil → Confidentialité**.
- Ils peuvent **demander la suppression de leur compte**. La demande est exécutée (anonymisation) après confirmation explicite.

### Pour l'équipe
- En tant qu'admin, vous pouvez **anonymiser un dossier étudiant** sur demande légale depuis la fiche étudiant.
- Tous les accès et exports sont tracés dans les journaux d'audit.

---

## 8. Fonctionnement multilingue

- L'interface est traduite en **français, anglais, arabe et portugais**.
- Chaque utilisateur choisit sa langue préférée dans **Profil → Préférences**.
- L'arabe est rendu en **RTL (lecture de droite à gauche)** automatiquement.
- Les **messages échangés avec les étudiants** sont automatiquement traduits par IA dans la langue préférée du destinataire.

---

## 9. Mode hors ligne

L'application fonctionne partiellement hors ligne grâce à un cache local sécurisé :
- Le cache est **cloisonné par utilisateur** — changer de compte purge automatiquement les données précédentes.
- Les routes API sensibles ne sont jamais mises en cache.
- Aucune donnée d'un autre étudiant ou d'un autre conseiller n'est accessible hors ligne.

---

## 10. Bonnes pratiques

1. **Activez la 2FA** dès votre première connexion.
2. **Validez les documents au fil de l'eau** plutôt que par lots — l'étudiant voit le statut en temps réel et peut corriger plus vite.
3. **Utilisez les notes internes** pour les remarques sensibles (vous éviterez tout malentendu).
4. **Consultez l'explication IA du risque** avant les RDV — gain de temps considérable.
5. **Exportez votre calendrier** vers votre outil quotidien pour ne rien manquer.
6. **Donnez votre feedback** sur les sorties IA (pouce haut/bas) — cela améliore le service.

---

## 11. Support

- Question fonctionnelle : contactez votre administrateur d'organisation.
- Problème technique ou bug : signalez-le via le canal interne défini par votre organisation.
- Documentation détaillée : disponible sur le site VisaFlow France.

Bonne utilisation !
