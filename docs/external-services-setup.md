# Services externes — remise à zéro et reconfiguration

Procédure complète pour repartir d'une configuration propre sur **tous** les services
tiers du projet, Android et iOS compris. À suivre dans l'ordre : chaque étape produit
des valeurs consommées par la suivante. Deux dépendances circulaires à connaître dès
maintenant — le client OAuth Android (§1) a besoin du SHA-1 du keystore EAS (§4), et
EAS (§4) a besoin de la clé de service Firebase (§2).

Chaque valeur atterrit à un seul endroit. Trois destinations, à ne pas confondre :

| Destination | Quoi | Qui le lit |
|---|---|---|
| `.env` (racine du dépôt) | secrets backend, URLs, et les variables `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` **en développement local** | Django (django-environ) ; Node via `@project-gestion/config/load-root-env`, appelé par `next.config.ts`, `app.config.js` et `apps/mobile/scripts/start.js` |
| `apps/mobile/eas.json` | les mêmes `EXPO_PUBLIC_*`, mais pour les **builds EAS** | EAS Build |
| Console EAS (`eas credentials`) | clés de signature et de push — jamais dans le dépôt | EAS Build / Expo Push |

> Pourquoi la duplication `.env` ↔ `eas.json` : les builds EAS tournent sur un serveur
> qui ne reçoit **que** ce que git contient, et `.env` est ignoré. Sans le bloc `env`
> d'`eas.json`, les variables publiques seraient vides dans le binaire — silencieusement.
> Toute valeur `EXPO_PUBLIC_*` modifiée est donc à reporter aux **deux** endroits.

Ni `.env` ni les JSON de clés ne doivent être committés ; `google-services.json`, si.

---

## 0. Révoquer l'existant

À faire **avant** de recréer quoi que ce soit, sinon on ne sait plus quelle clé est
active. Les libellés des consoles Google bougent souvent : les chemins ci-dessous
sont ceux constatés en août 2026.

1. **Clé de compte de service Firebase** — la console Firebase ne sait que *créer*
   des clés, pas les supprimer. Passer par Google Cloud :
   `console.cloud.google.com/iam-admin/serviceaccounts?project=<projet>` → cliquer sur
   `firebase-adminsdk-…@<projet>.iam.gserviceaccount.com` → onglet **CLÉS** →
   supprimer les clés « géré par l'utilisateur ». Celles marquées « géré par Google »
   ne sont ni supprimables ni un problème.
   ⚠️ Ne pas confondre avec l'icône poubelle de la liste des comptes de service :
   elle supprime le **compte** entier, pas la clé.
   Supprimer aussi le fichier JSON téléchargé (`~/Downloads/*firebase-adminsdk*.json`).
2. **Projet Firebase** — si tu repars de zéro : Paramètres → Supprimer le projet.
   Sinon, garde-le et remplace juste la clé ci-dessus.
3. **Clients OAuth Google** — Google Cloud Console → **API et services →
   Identifiants** (ou **Google Auth Platform → Clients**, le nouveau nom du même
   écran) → section « ID clients OAuth 2.0 » → supprimer les clients Web / Android /
   iOS existants.
   ⚠️ Ne **pas** toucher aux entrées « Clés API (auto created by Firebase) » de la
   même page : elles sont gérées par Firebase et servent au SDK client.
4. **Clé API Resend** — dashboard Resend → API Keys → révoquer. Idem pour le
   *signing secret* du webhook.
5. **Credentials EAS** — depuis `apps/mobile`, `npx eas-cli credentials -p android`
   puis `-p ios` (menu interactif, un profil de build est demandé au lancement :
   prendre `development`). Supprimer la clé de service FCM, la Push Key APNs, et
   éventuellement le keystore Android (⚠️ un nouveau keystore change l'empreinte
   SHA-1 et invalide toute app déjà distribuée avec l'ancien).
6. **Vider les valeurs correspondantes** dans `.env` — les laisser vides plutôt que
   de garder d'anciennes valeurs mortes.

---

## 1. Google Cloud — OAuth (connexion Google)

Un seul projet Google Cloud, trois clients OAuth. Le **client Web** est la pièce
centrale : c'est lui que le backend vérifie, sur web comme sur mobile. Les clients
iOS et Android ne servent qu'à autoriser le SDK natif à demander un `id_token` dont
l'audience est le client Web.

1. Google Cloud Console → nouveau projet (ou existant).
2. **Écran de consentement OAuth** : externe, nom de l'app, email d'assistance,
   domaine, email du développeur. Tant que l'app est en mode « Test », seuls les
   comptes ajoutés dans « Utilisateurs test » peuvent se connecter.
3. Identifiants → **Créer un ID client OAuth**, trois fois :

   **Application Web** — c'est le seul des trois qui a des champs d'URL.

   | Champ | Valeur |
   |---|---|
   | Nom | libre (`Auth`, `Project Gestion — Web`…), purement cosmétique |
   | Origines JavaScript autorisées | **laisser vide** |
   | URI de redirection autorisés | `http://localhost:8000/accounts/google/login/callback/` (dev) et `https://<domaine-backend>/accounts/google/login/callback/` (prod) |

   > Pourquoi aucune origine JavaScript : le web ne parle jamais à Google depuis le
   > navigateur. `redirectToGoogle()` (`apps/web/src/lib/allauth-client.ts`) soumet
   > un vrai formulaire vers `POST <backend>/_allauth/browser/v1/auth/provider/redirect`,
   > et c'est Django qui redirige vers Google. Le seul point de retour est donc
   > l'URI de redirection **du backend** — jamais une URL du front Next.js.
   >
   > L'URI de redirection porte le port du **backend** (8000), pas celui du front
   > (3000). La route vient de `path("accounts/", include(...google.urls))` dans
   > `apps/backend/config/urls.py` : slash final obligatoire, et Google compare la
   > chaîne au caractère près.

   **iOS** — un seul champ : bundle ID `com.mtx26.projectgestion`. Pas d'URI de
   redirection à saisir, le schéma d'URL est dérivé du client ID.

   **Android** — deux champs : package `com.mtx26.projectgestion` + **empreinte
   SHA-1**. Celle-ci vient du keystore géré par EAS (voir §4), pas de ton poste ni du
   debug keystore d'Android Studio. Ce client est donc à créer *après* le §4, ou à
   compléter plus tard.

Où vont les valeurs :

```bash
# .env (racine)
GOOGLE_OAUTH_CLIENT_ID=<client Web>
GOOGLE_OAUTH_CLIENT_SECRET=<secret du client Web>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<client Web>      # le MEME que ci-dessus
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<client iOS>
```

Le secret n'existe que pour le client Web ; les clients iOS et Android n'en ont pas.
Le client Android n'a aucune variable : le SDK natif le retrouve seul via le package
et l'empreinte SHA-1. Les deux `EXPO_PUBLIC_*` sont aussi à recopier dans
`apps/mobile/eas.json` (bloc `env` des **trois** profils : `development`, `preview`,
`production`) — c'est ce qui permet à `app.config.js` de dériver l'URL scheme iOS au
build.

> Sans `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, le bouton Google se masque de lui-même.
> C'est voulu : mieux vaut pas de bouton qu'un bouton qui échoue.

---

## 2. Firebase — FCM (push Android uniquement)

Firebase ne sert **qu'aux notifications push Android**, et uniquement comme relais :
c'est Expo qui appelle FCM, jamais le backend (voir §7). iOS passe par APNs, sans
Firebase — n'ajoute donc **pas** d'app iOS ici, elle ne servirait à rien.

Le projet Firebase et le projet Google Cloud du §1 sont **le même projet** (Firebase
crée/adopte un projet GCP homonyme). C'est ce qui est en place aujourd'hui :
`project-gestion-mtx26`, numéro `17609516105` — d'où les clients OAuth et le compte
de service `firebase-adminsdk-…` visibles sur la même page « Identifiants ».

1. Console Firebase → nouveau projet (ou le projet GCP existant du §1).
2. Ajouter une app **Android**. Le package doit être *exactement*
   `com.mtx26.projectgestion` — la valeur de `android.package` dans
   [`apps/mobile/app.json`](../apps/mobile/app.json). Un package qui diffère ne
   provoque aucune erreur au build : les push partent et n'arrivent jamais.
   Ne rien saisir dans « Certificat de signature de débogage SHA-1 » : c'est
   facultatif ici, et le SHA-1 qui compte est celui du §4, à déclarer côté OAuth.
3. Télécharger `google-services.json` → `apps/mobile/google-services.json`.
   **À committer** : ce n'est pas un secret (il est embarqué en clair dans l'APK), et
   EAS construit à partir de ce que **git** connaît, pas de ton disque — un fichier
   non suivi fait échouer le build sur `googleServicesFile does not exist`.
   Vérifier : `git ls-files apps/mobile/google-services.json` doit renvoyer le chemin.
4. Paramètres du projet → **Comptes de service** → *Générer une nouvelle clé privée* →
   un JSON se télécharge.
   **Celui-là est un secret** : il ouvre l'accès admin au projet Firebase. Il ne doit
   jamais entrer dans le dépôt — `apps/mobile/.gitignore` bloque `*firebase-adminsdk*.json`
   — et se supprime du disque dès qu'il est uploadé dans EAS (§4).

Rien à modifier dans `app.json` : `android.googleServicesFile` pointe déjà sur le
fichier.

---

## 3. Apple Developer — APNs (push iOS)

Nécessite un **compte Apple Developer payant** (99 $/an) : sans lui, pas d'installation
sur un appareil physique. Pas besoin de Mac — EAS compile dans le cloud et
l'installation se fait par lien.

1. **Enregistrer l'iPhone** avant tout build :
   ```bash
   cd apps/mobile
   npx eas-cli device:create
   ```
   Choisir la méthode *Website* : un QR code s'affiche, l'iPhone le scanne, installe un
   profil de configuration, et son UDID remonte chez Apple. À refaire pour chaque
   appareil — et **rebuilder** après, le profil de provisioning fige la liste des
   appareils au moment du build.
2. Au premier `eas build --platform ios`, répondre **oui** aux deux questions :
   génération du certificat de distribution, puis de la **Push Key (APNs)**. C'est tout
   ce qu'il faut pour le push iOS.
   Apple limite à **2 clés APNs par compte** : si la création échoue, c'est qu'il faut
   d'abord en révoquer une ancienne sur `developer.apple.com`.
3. Vérification : `npx eas-cli credentials -p ios` → la Push Key doit apparaître.

Rien à configurer dans `app.json` : `ios.bundleIdentifier` est déjà renseigné, et on
n'envoie que des notifications visibles (pas besoin de `UIBackgroundModes`).

---

## 4. EAS — signature et credentials

```bash
cd apps/mobile
npx eas-cli login                       # compte proprietaire : mtx_26
npx eas-cli whoami                      # doit afficher mtx_26
npx eas-cli credentials -p android
npx eas-cli credentials -p ios
```

Le compte doit être `mtx_26` : c'est le `owner` d'`app.json`, et le projet EAS ciblé
est `extra.eas.projectId` = `58fa5012-8277-437f-bdcc-cf4e2a5b2601`. Un autre compte ne
verrait tout simplement pas ces credentials.

`credentials` est un **menu interactif** (flèches + entrée) : il faut un vrai terminal.
Il demande d'abord un profil de build — prendre `development` — puis affiche un état des
lieux. Sur une configuration remise à zéro, tout est à `None assigned yet`.

**Côté Android**, le menu principal ressemble à ça — deux entrées comptent :

```
> Keystore: Manage everything needed to build your project        <- 1
  Google Service Account                                          <- 2
  Push Notifications (Legacy): Manage your FCM (Legacy) API Key
  credentials.json: Upload/Download credentials between EAS servers and your local json
  Go back
  Exit
```

**1. `Keystore: Manage everything needed to build your project`**

- Keystore absent (`None assigned yet`) → `Set up a new keystore`. EAS demande un nom
  (`Assign a name to your build credentials`) : c'est une étiquette interne à EAS, sans
  effet sur l'app — accepter le nom proposé par entrée.
- Le keystore généré, le menu se réaffiche avec le bloc `Keystore` rempli : y lire le
  **SHA1 Fingerprint**. C'est **lui** — pas l'empreinte de ton poste, ni le debug
  keystore d'Android Studio — qu'il faut coller dans le client OAuth Android (§1.3).
  Sans ça, la connexion Google échoue par un `DEVELOPER_ERROR` sans détail.
  À défaut d'affichage lisible : `Download existing keystore` puis
  `keytool -list -v -keystore <fichier>`.
- ⚠️ Sur un projet déjà distribué, `Delete your keystore` / `Set up a new keystore`
  change l'empreinte : les installations existantes ne peuvent plus être mises à jour,
  et le client OAuth Android est à corriger derrière.

**2. `Google Service Account`** — la clé FCM V1 est *dans ce sous-menu*, pas au premier
niveau. Il propose deux usages sans rapport ; prendre le premier :

```
> Manage your Google Service Account Key for Push Notifications (FCM V1)   <- celui-ci
  Manage your Google Service Account Key for Play Store Submissions        <- publication Play Store
  Go back
```

Puis `Set up a Google Service Account Key for Push Notifications (FCM V1)`. EAS demande
un **chemin de fichier**, relatif à `apps/mobile` — pas un contenu à coller. Le plus
simple : déplacer le JSON du §2.4 dans `apps/mobile/` (le `.gitignore` y bloque déjà
`*firebase-adminsdk*.json`), répondre `./<fichier>.json`, puis le supprimer du disque.

L'état des lieux doit ensuite afficher `Project ID`, `Client Email` et `Updated` sous
**Push Notifications (FCM V1)**.

⚠️ `Push Notifications (Legacy): Manage your FCM (Legacy) API Key`, au premier niveau du
menu, attend une clé serveur — pas ce JSON. Y coller le contenu du fichier est **accepté
sans erreur** et le push reste mort : l'API legacy est désactivée par Google depuis juin
2024. Si c'est arrivé, `Remove FCM (Legacy) API Key` nettoie.

**Côté iOS** : *Push Notifications: Manage your Apple Push Notifications Key*. Le reste
(certificat de distribution, provisioning) se règle tout seul au premier build.

Après tout changement de credentials, **rebuilder** : ils sont figés dans le binaire.

---

## 5. Resend — emails

1. Dashboard Resend → **Domains** → ajouter le domaine et publier les enregistrements
   SPF/DKIM chez le registrar. Tant que le domaine n'est pas vérifié, seul
   `onboarding@resend.dev` peut servir d'expéditeur.
2. **API Keys** → nouvelle clé. La permission *Sending access* suffit pour envoyer ; il
   faut *Full access* pour publier les templates au point 4.
3. **Webhooks** (optionnel — sert à alimenter le modèle `EmailDelivery`) :
   - URL : `https://<domaine-backend>/anymail/resend/tracking/`
     (montée par `path("anymail/", include("anymail.urls"))`,
     [`apps/backend/config/urls.py:29`](../apps/backend/config/urls.py#L29))
   - Événements utiles : `sent`, `delivered`, `bounced`, `complained`, `opened`,
     `clicked`, `failed` — ce sont ceux que
     [`apps/backend/api/signals.py`](../apps/backend/api/signals.py) sait mapper.
   - Copier le *signing secret* dans `RESEND_SIGNING_SECRET` : sans lui, anymail rejette
     les appels et rien n'est enregistré.
   - En local, l'URL doit être publiquement joignable (tunnel type ngrok) — sinon,
     sauter cette étape.
4. Publier les templates du dépôt, **depuis la racine** :
   ```bash
   venv/Scripts/python.exe scripts/sync_resend_templates.py
   ```
   Le script lit `RESEND_API_KEY` et `DEFAULT_FROM_EMAIL` dans `.env` / `.env.local` (il
   affiche d'où vient chaque valeur), puis crée-ou-met-à-jour et publie les trois
   gabarits de `resend_templates/`. Leurs alias sont figés côté Django
   (`RESEND_*_TEMPLATE_ID` dans `settings.py`) : `email-verification`, `password-reset`,
   `project-invitation`. Ne pas les renommer dans le dashboard Resend.

```bash
# .env
DEFAULT_FROM_EMAIL=Project Gestion <no-reply@ton-domaine.com>
RESEND_API_KEY=<cle>
RESEND_SIGNING_SECRET=<secret webhook, optionnel>
```

Sans `RESEND_API_KEY`, Django bascule **automatiquement** sur le backend console : les
emails s'affichent dans le terminal `runserver` et ne partent nulle part. Pratique en
dev, piège classique en prod.

---

## 6. Stockage S3 / MinIO — documents et photos de profil

**En local**, `docker compose up` suffit : le service `minio-init` crée les deux buckets
et ouvre le second en lecture anonyme. Ports publiés par `docker-compose.yml` :

| Depuis | Endpoint API | Console web |
|---|---|---|
| un conteneur (backend dockerisé) | `http://minio:9000` | — |
| l'hôte (backend lancé par `manage.py runserver`) | `http://localhost:9001` | `http://localhost:9002` |

> ⚠️ `.env.example` propose `S3_ENDPOINT_URL=http://localhost:32768`, qui ne correspond
> pas au mapping de `docker-compose.yml` (`9001:9000`). Pour un backend lancé sur
> l'hôte, la bonne valeur est `http://localhost:9001`.

Identifiants par défaut : `minioadmin` / `minioadmin`, surchargés par `S3_ACCESS_KEY_ID`
et `S3_SECRET_ACCESS_KEY` s'ils sont définis — le conteneur MinIO et le backend lisent
les mêmes variables, donc ils restent forcément d'accord.

**En production** :

```bash
# .env
S3_ENDPOINT_URL=http://minio:9000                 # acces backend -> MinIO sur le reseau Docker
S3_PUBLIC_ENDPOINT_URL=https://<domaine-minio>   # acces navigateur -> MinIO via proxy HTTPS
S3_ACCESS_KEY_ID=<cle>
S3_SECRET_ACCESS_KEY=<secret>
S3_BUCKET_NAME=project-documents
PROFILE_PICTURE_S3_BUCKET_NAME=profile-pictures   # bucket en lecture publique
# S3_REGION=us-east-1                             # defaut
# S3_PRESIGNED_URL_EXPIRES_SECONDS=300            # defaut
```

Les deux buckets n'ont pas la même politique, et ce n'est pas un détail :

- `project-documents` reste **privé** : tout passe par des URLs signées valables
  `S3_PRESIGNED_URL_EXPIRES_SECONDS` (300 s par défaut). La signature est générée
  pour `S3_PUBLIC_ENDPOINT_URL`, qui doit donc etre joignable par le navigateur
  et pointer vers l'API S3 de MinIO (pas vers sa console). Le proxy doit conserver
  le chemin et la query string. Sans cette variable, les URLs utilisent
  `S3_ENDPOINT_URL`, ce qui ne convient pas si sa valeur est `http://minio:9000`.
- `profile-pictures` est en **lecture anonyme** (`mc anonymous set download`), pour que
  les avatars s'affichent sans URL signée — donc sans expiration à gérer côté client.

> ⚠️ Si `PROFILE_PICTURE_S3_BUCKET_NAME` est vide, `settings.py` retombe sur
> `S3_BUCKET_NAME` : les avatars atterrissent dans le bucket privé et ne s'affichent
> plus nulle part. Toujours le renseigner en production.

---

## 7. Expo Push — envoi des notifications

Aucun compte supplémentaire, et **aucun appel direct à FCM/APNs** côté Django : le
backend poste sur `https://exp.host/--/api/v2/push/send`
([`services/push.py`](../apps/backend/api/services/push.py)), par lots de 100, avec un
timeout de 10 s. Expo se charge de router vers FCM (Android, §2) ou APNs (iOS, §3).

```bash
# .env — expo.dev → Account settings → Access tokens
EXPO_ACCESS_TOKEN=<jeton>
```

Facultatif mais recommandé en production : il authentifie l'expéditeur auprès d'Expo.
Absent, les envois passent quand même — l'en-tête `Authorization` n'est ajouté que si la
variable est remplie.

Deux comportements à connaître :

- **Rien ne casse jamais.** `send_push_to_user()` avale ses erreurs : un service Expo
  injoignable ne doit pas faire échouer l'invitation ou le paiement qui l'a déclenché.
  Les échecs partent dans les logs (`logger.warning`), pas dans la réponse HTTP.
- **Les jetons morts sont purgés seuls.** Un ticket `DeviceNotRegistered` (app
  désinstallée, notifications coupées) supprime la ligne `DeviceToken` au prochain envoi.

Le jeton d'un appareil est lié à `extra.eas.projectId` d'`app.json`
([`lib/push-notifications.ts`](../apps/mobile/src/lib/push-notifications.ts)) : changer
de projet EAS invalide **tous** les jetons déjà enregistrés en base.

---

## 8. Vérifier, service par service

```bash
# Backend : migrations (dont 0060_devicetoken), sanity check, demarrage
venv/Scripts/python.exe apps/backend/manage.py migrate
venv/Scripts/python.exe apps/backend/manage.py check
venv/Scripts/python.exe apps/backend/manage.py runserver 0.0.0.0:8000
```

`0.0.0.0` et non `127.0.0.1` : un téléphone physique doit pouvoir joindre le backend sur
le réseau local.

```bash
# Front web — le bouton "Continuer avec Google" doit aller au bout
pnpm --filter web dev

# Mobile en Expo Go : tout marche SAUF Google Sign-In et le push Android
pnpm --filter mobile start
```

`scripts/start.js` réécrit `EXPO_PUBLIC_API_BASE_URL` avec l'IP LAN détectée à chaque
démarrage — inutile de la maintenir à la main dans `.env`.

```bash
# Build de dev, une fois les credentials en place (§4)
cd apps/mobile
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
```

Deux profils produisent un APK installable directement (`buildType: "apk"`,
`distribution: "internal"`), et ils ne servent pas à la même chose :

| Profil | Contenu | Usage |
|---|---|---|
| `development` | `expo-dev-client`, **sans bundle JS** | développement : le code vient de Metro, en direct |
| `preview` | bundle JS embarqué | tester l'app telle qu'elle sera, sans PC |

> ⚠️ Un build `development` qui affiche **« No development server found »** fonctionne
> normalement : c'est un lanceur, pas l'app. Il faut `pnpm --filter mobile start` sur le
> PC, téléphone sur le même Wi-Fi, puis `Fetch development servers` (ou l'URL
> `http://<IP-du-PC>:8081`). Si rien n'apparaît, c'est en général le pare-feu Windows
> sur le port 8081.

Les deux profils suffisent pour tester Google Sign-In et le push Android — contrairement
à Expo Go, qui ne sait faire ni l'un ni l'autre.

`DJANGO_ALLOWED_HOSTS` doit contenir l'IP LAN du PC, sinon l'app se lance mais toutes les
requêtes API échouent. `scripts/start.js` affiche l'IP qu'il a détectée à chaque
démarrage : c'est celle-là qui doit y figurer.

Puis, une fois connecté dans l'app **et** les notifications acceptées :

```bash
# Le jeton de l'appareil est-il bien remonte ?
venv/Scripts/python.exe apps/backend/manage.py shell -c "from api.models import DeviceToken; print(list(DeviceToken.objects.values('user__email','platform','token')))"

# Notification de test (--in-app cree aussi la notification en base : teste toute la chaine)
venv/Scripts/python.exe apps/backend/manage.py send_test_push --email ton@email.com --in-app
```

### Symptômes et causes

| Symptôme | Cause la plus fréquente |
|---|---|
| `DEVELOPER_ERROR` à la connexion Google (Android) | empreinte SHA-1 du keystore EAS absente du client OAuth Android (§4), ou build antérieur à son ajout |
| `redirect_uri_mismatch` (web) | URI de redirection mal saisie : port **8000** (backend) et slash final obligatoire (§1.3) |
| Bouton Google absent (mobile) | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` vide dans `eas.json`, ou app lancée dans Expo Go |
| `Aucun appareil enregistre pour ce compte` | permission refusée, ou Expo Go sur Android (push distantes coupées depuis le SDK 53) |
| Push « envoyée » mais rien ne s'affiche (Android) | package Firebase ≠ `com.mtx26.projectgestion`, ou clé de service FCM V1 pas uploadée dans EAS (§4) |
| Push muette sur iOS | Push Key APNs absente, ou build antérieur à son ajout |
| Build qui échoue sur `googleServicesFile does not exist` | `google-services.json` présent sur le disque mais **non committé** |
| Emails invisibles | `RESEND_API_KEY` vide → bascule silencieuse sur le backend console, regarde le terminal Django |
| `EmailDelivery` jamais mis à jour | webhook non configuré, URL erronée, ou `RESEND_SIGNING_SECRET` absent (§5.3) |
| Avatars cassés, documents OK | `PROFILE_PICTURE_S3_BUCKET_NAME` vide → tout part dans le bucket privé (§6) |
| Push qui marchaient et s'arrêtent d'un coup | `extra.eas.projectId` a changé → jetons obsolètes, se reconnecter dans l'app |
