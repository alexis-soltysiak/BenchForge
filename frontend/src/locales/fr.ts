const fr = {
  // Navigation
  "nav.promptLibrary": "Prompt Library",
  "nav.promptLibraryDesc": "Assets de prompts réutilisables",
  "nav.modelRegistry": "Model Registry",
  "nav.modelRegistryDesc": "Profils et endpoints",
  "nav.sessions": "Sessions",
  "nav.sessionsDesc": "Configuration des benchmarks",
  "nav.runs": "Runs",
  "nav.runsDesc": "Exécution et jugement",
  "nav.credits": "Crédits",
  "nav.settings": "Paramètres",
  "nav.openCredits": "Ouvrir les contributeurs",
  "nav.openSettings": "Ouvrir les paramètres",
  "nav.navigationRail": "Rail de navigation",
  "nav.mobileNote":
    "Le bureau affiche la navigation latérale droite. Le mobile garde les mêmes sections dans une barre compacte.",

  // Settings sidebar
  "settings.title": "Paramètres",
  "settings.workspacePreferences": "Préférences du workspace",
  "settings.theme.sidebarTitle": "Theme",
  "settings.theme.sidebarDesc": "Choisir l'ambiance visuelle du workspace",
  "settings.apiKeys.sidebarTitle": "API Keys",
  "settings.apiKeys.sidebarDesc": "Renseigner des clés locales pour les providers",
  "settings.language.sidebarTitle": "Langue",
  "settings.language.sidebarDesc": "Choisir la langue de l'interface",

  // Settings header cards
  "settings.theme.pageTitle": "Theme",
  "settings.theme.pageHeading": "Page Thème",
  "settings.theme.pageDesc":
    "Chaque sélection applique immédiatement une ambiance globale à BenchForge.",
  "settings.apiKeys.pageTitle": "API Keys",
  "settings.apiKeys.pageHeading": "Page API Keys",
  "settings.apiKeys.pageDesc":
    "Crée des presets réutilisables par provider, puis sélectionne-les dans la création ou l'édition de modèles.",
  "settings.language.pageTitle": "Langue",
  "settings.language.pageHeading": "Page Langue",
  "settings.language.pageDesc":
    "Sélectionne la langue de l'interface. Le changement s'applique immédiatement.",

  // Theme options
  "theme.paperWhite.name": "Paper White",
  "theme.paperWhite.description":
    "La base claire et nette, proche de l'interface actuelle.",
  "theme.nightSlate.name": "Night Slate",
  "theme.nightSlate.description":
    "Bleu nuit dense pour les longues sessions et les écrans sombres.",
  "theme.carbonNoir.name": "Carbon Noir",
  "theme.carbonNoir.description":
    "Un sombre plus chaud, plus contrasté, presque editorial.",
  "theme.duneSand.name": "Dune Sand",
  "theme.duneSand.description":
    "Palette sable, solaire et mate, moins clinique que le blanc pur.",
  "theme.canopyForest.name": "Canopy Forest",
  "theme.canopyForest.description":
    "Verts doux et profonds, plus organiques sans virer fantasy.",
  "theme.tidalOcean.name": "Tidal Ocean",
  "theme.tidalOcean.description":
    "Bleus aqua et surfaces fraîches, plus calmes et plus fluides.",
  "theme.active": "Actif",
  "theme.apply": "Appliquer",

  // API Keys
  "apiKeys.addPreset": "Ajouter un preset de clé API",
  "apiKeys.addPresetDesc":
    "Donne un nom, choisis un provider, puis colle la clé. Ce preset pourra ensuite être réutilisé depuis la page Models.",
  "apiKeys.namePlaceholder": "Ex: OpenAI prod",
  "apiKeys.addLine": "Ajouter",
  "apiKeys.registeredPresets": "Presets enregistrés",
  "apiKeys.registeredPresetsDesc":
    "Chaque modèle pourra soit utiliser une clé manuelle, soit un preset.",
  "apiKeys.encryptedInBackend": "Chiffré dans le backend",
  "apiKeys.noPresetYet": "Aucun preset de clé API. Ajoute la première ligne ci-dessus.",
  "apiKeys.storedKeyPrefix": "Clé enregistrée :",
  "apiKeys.pasteNewKey": "Coller une nouvelle clé API",
  "apiKeys.save": "Enregistrer",
  "apiKeys.delete": "Supprimer",
  "apiKeys.created": "Preset de clé API créé.",
  "apiKeys.updated": "Preset de clé API mis à jour.",
  "apiKeys.deleted": "Preset de clé API supprimé.",
  "apiKeys.errorCreate": "Impossible de créer le preset de clé API.",
  "apiKeys.errorUpdate": "Impossible de mettre à jour le preset de clé API.",
  "apiKeys.errorDelete": "Impossible de supprimer le preset de clé API.",

  // Language settings
  "language.fr.native": "Français",
  "language.fr.label": "Francais",
  "language.fr.description":
    "Interface orientée FR pour le studio et les pages internes.",
  "language.fr.badge": "Par défaut",
  "language.en.native": "English",
  "language.en.label": "English",
  "language.en.description":
    "Interface orientée EN pour un usage plus international.",
  "language.en.badge": "Disponible",
  "language.selected": "Sélectionné",
  "language.select": "Sélectionner",
  "language.previewState": "État de la sélection",
  "language.currentSelection": "Sélection actuelle",

  // Home page
  "home.benchmarkStudio": "Benchmark studio",
  "home.tagline": "Benchmark studio pour prompts, modèles, sessions et runs.",
  "home.credits": "Crédits",
  "home.startWithPrompts": "Commencer avec les prompts",
  "home.howItWorks": "Comment ça marche",
  "home.mainHeading":
    "Construis un parcours de benchmark lisible, du prompt au run.",
  "home.mainDesc":
    "BenchForge est un espace simple et auto-hébergeable pour comparer des modèles avec la même base de test. Tu crées les prompts, tu enregistres les modèles, tu assembles les sessions, puis tu lances les runs et lis les résultats.",
  "home.exploreSessions": "Explorer les sessions",
  "home.viewRuns": "Voir les runs",
  "home.configureModels": "Configurer les modèles",
  "home.browsePrompts": "Parcourir les prompts",
  "home.openSessions": "Ouvrir les sessions",
  "home.feature.structured": "Structuré",
  "home.feature.structuredDesc":
    "Chaque benchmark reste dans un modèle d'objet prévisible.",
  "home.feature.replayable": "Rejouable",
  "home.feature.replayableDesc":
    "Les sessions permettent de relancer exactement la même base plus tard.",
  "home.feature.readable": "Lisible",
  "home.feature.readableDesc":
    "Le chemin du prompt au résultat reste visible d'un coup d'œil.",
  "home.pipeline": "Pipeline",
  "home.pipelineSubtitle": "Prompts, modèles, sessions, runs.",
  "home.objectif": "Objectif",
  "home.objectifValue": "Comparer, décider, recommencer.",
  "home.howToUseIt": "Comment l'utiliser",
  "home.simplePathHeading": "Un chemin simple de l'idée à l'évaluation.",
  "home.startingPoint": "Point de départ",
  "home.startingPointHeading":
    "Crée d'abord les prompts, puis laisse le reste du pipeline suivre.",
  "home.startingPointDesc":
    "Le projet est volontairement ordonné. Si la couche prompts est propre, le registre de modèles, le builder de sessions et les résultats restent faciles à comprendre.",
  "home.readyToLaunch": "Prêt à lancer",
  "home.readyToLaunchHeading":
    "Compose une session et lance un run quand le setup est stable.",
  "home.readyToLaunchDesc":
    "Les sessions emballent le benchmark. Les runs l'exécutent. Résultat: des comparaisons reproductibles, faciles à auditer et à partager.",
  "home.ctaDesc":
    "BenchForge garde le chemin du benchmark visible du premier prompt au run final.",

  // Flow steps
  "flow.prompts.subtitle": "On crée le contenu à tester",
  "flow.prompts.description":
    "Tu centralises tes prompts, tes variantes et tes règles d'exécution pour garder une base propre et réutilisable.",
  "flow.models.subtitle": "On référence les moteurs",
  "flow.models.description":
    "Tu enregistres les modèles, endpoints et paramètres pour comparer plusieurs fournisseurs ou configurations.",
  "flow.sessions.subtitle": "On assemble le scénario",
  "flow.sessions.description":
    "Tu combines prompts, modèles, candidats et juges dans une session de benchmark claire et rejouable.",
  "flow.runs.subtitle": "On lance et on mesure",
  "flow.runs.description":
    "La session produit un run: exécution, suivi, arbitrage et lecture des résultats pour décider vite et bien.",

  // How it works steps
  "howItWorks.step1.title": "Préparer les prompts",
  "howItWorks.step1.body":
    "Commence par écrire le problème, les contraintes et les variantes à comparer. BenchForge garde tout structuré.",
  "howItWorks.step2.title": "Brancher les modèles",
  "howItWorks.step2.body":
    "Ajoute un ou plusieurs modèles, locaux ou distants. Tu peux ensuite mesurer les écarts avec la même base de test.",
  "howItWorks.step3.title": "Composer une session",
  "howItWorks.step3.body":
    "Une session relie prompts, modèles et règles d'évaluation. C'est ton plan de benchmark, pas juste une liste d'items.",
  "howItWorks.step4.title": "Lancer un run",
  "howItWorks.step4.body":
    "Le run exécute la session, collecte les réponses et prépare la lecture des résultats pour comparer proprement.",

  // Prompt Library
  "prompts.reusableAssets": "Reusable Assets",
  "prompts.pageTitle": "Prompt Library",
  "prompts.metricVisible": "Prompts visibles",
  "prompts.metricCategories": "Catégories",
  "prompts.metricSystemPacks": "Packs système",
  "prompts.searchPlaceholder": "Rechercher noms, descriptions, tags",
  "prompts.categoryLabel": "Catégorie",
  "prompts.allCategories": "Toutes les catégories",
  "prompts.chooseCategory": "Choisir une catégorie",
  "prompts.chooseCategoryDesc": "Restreindre la bibliothèque à une famille de prompts.",
  "prompts.tagsLabel": "Tags",
  "prompts.addOrRemoveTags": "Ajouter ou supprimer des tags",
  "prompts.manageTags": "Gérer les tags",
  "prompts.manageTagsDesc":
    "Ajoute des tags pour affiner la bibliothèque, ou retire-les pour l'élargir.",
  "prompts.addATag": "Ajouter un tag",
  "prompts.add": "Ajouter",
  "prompts.activeTags": "Tags actifs",
  "prompts.clearAll": "Tout effacer",
  "prompts.suggestions": "Suggestions",
  "prompts.clickToAdd": "Cliquer pour ajouter",
  "prompts.noTagsToSuggest": "Aucun tag à suggérer.",
  "prompts.resetFilters": "Réinitialiser les filtres",
  "prompts.showArchived": "Afficher les archivés",
  "prompts.showUnarchived": "Afficher les actifs",
  "prompts.newPrompt": "Nouveau prompt",
  "prompts.filtered": "Filtré",
  "prompts.colName": "Nom",
  "prompts.colCategory": "Catégorie",
  "prompts.colTags": "Tags",
  "prompts.colUpdated": "Mis à jour",
  "prompts.colStatus": "Statut",
  "prompts.colActions": "Actions",
  "prompts.noDescription": "Aucune description",
  "prompts.noTags": "Aucun tag",
  "prompts.statusArchived": "Archivé",
  "prompts.statusActive": "Actif",
  "prompts.statusInactive": "Inactif",
  "prompts.loading": "Chargement de la bibliothèque...",
  "prompts.noArchivedYet": "Aucun prompt archivé pour l'instant.",
  "prompts.emptySeeded":
    "Les prompts intégrés sont générés automatiquement au premier chargement. Actualise si la bibliothèque est encore vide.",
  "prompts.noMatchingFilters": "Aucun prompt ne correspond aux filtres actuels.",
  "prompts.createModal.title": "Créer un prompt",
  "prompts.editModal.title": "Modifier le prompt",
  "prompts.modal.description":
    "Crée un prompt réutilisable ou affine un existant sans quitter la bibliothèque.",
  "prompts.form.name": "Nom",
  "prompts.form.nameHint": 'Exemple : "Résumer un email de lancement produit"',
  "prompts.form.namePlaceholder": "Résumer un email de lancement produit",
  "prompts.form.category": "Catégorie",
  "prompts.form.categoryHint":
    "Sélectionne la famille de prompts la plus proche utilisée dans la bibliothèque.",
  "prompts.form.description": "Description",
  "prompts.form.descriptionHint":
    'Exemple : "Bref résumé du benchmark affiché dans la bibliothèque."',
  "prompts.form.descriptionPlaceholder":
    "Bref résumé du benchmark affiché dans la bibliothèque.",
  "prompts.form.tags": "Tags",
  "prompts.form.tagsHint": 'Exemple : "résumé, rédaction, business"',
  "prompts.form.tagsPlaceholder": "Tags séparés par des virgules",
  "prompts.form.systemPrompt": "Prompt système",
  "prompts.form.systemPromptHint":
    'Exemple : "Tu es un analyste précis qui rédige des réponses concises."',
  "prompts.form.systemPromptPlaceholder":
    "Tu es un analyste précis qui rédige des réponses concises.",
  "prompts.form.userPrompt": "Prompt utilisateur",
  "prompts.form.userPromptHint":
    'Exemple : "Résume le texte suivant en 5 points clairs."',
  "prompts.form.userPromptPlaceholder": "Résume le texte suivant en 5 points clairs.",
  "prompts.form.evaluationNotes": "Notes d'évaluation",
  "prompts.form.evaluationNotesHint":
    'Exemple : "Vérifier l\'exactitude factuelle, la structure et le ton concis."',
  "prompts.form.evaluationNotesPlaceholder":
    "Vérifier l'exactitude factuelle, la structure et le ton concis.",
  "prompts.form.isActive": "Prompt disponible pour les prochaines sessions",
  "prompts.form.isActiveNote":
    "Garde cette option activée si le prompt doit rester sélectionnable dans les futures sessions.",
  "prompts.form.cancel": "Annuler",
  "prompts.form.saveChanges": "Enregistrer",
  "prompts.form.createPrompt": "Créer le prompt",
  "prompts.feedback.updated": 'Prompt "{{name}}" mis à jour.',
  "prompts.feedback.created": 'Prompt "{{name}}" créé.',
  "prompts.feedback.archived": 'Prompt "{{name}}" archivé.',
  "prompts.feedback.errorSave": "Impossible d'enregistrer le prompt.",
  "prompts.feedback.errorArchive": "Impossible d'archiver le prompt.",

  // Model Registry
  "models.connectionProfiles": "Connection Profiles",
  "models.pageTitle": "Model Registry",
  "models.metricVisible": "Modèles visibles",
  "models.metricCandidates": "Candidats",
  "models.metricJudges": "Juges",
  "models.searchPlaceholder": "Rechercher noms, providers, runtimes",
  "models.rolesLabel": "Rôles",
  "models.allRoles": "Tous les rôles",
  "models.pickRoles": "Choisir les rôles",
  "models.pickRolesDesc": "Sélectionner un ou plusieurs rôles du registre.",
  "models.providerLabel": "Provider",
  "models.allProviders": "Tous les providers",
  "models.chooseProvider": "Choisir un provider",
  "models.chooseProviderDesc": "Restreindre le registre à un provider.",
  "models.runtimeLabel": "Runtime",
  "models.allRuntimes": "Tous les runtimes",
  "models.chooseRuntime": "Choisir un runtime",
  "models.chooseRuntimeDesc": "Filtrer pour les profils distants ou locaux.",
  "models.resetFilters": "Réinitialiser les filtres",
  "models.showArchived": "Afficher les archivés",
  "models.showUnarchived": "Afficher les actifs",
  "models.newProfile": "Nouveau profil",
  "models.colDisplayName": "Nom d'affichage",
  "models.colRole": "Rôle",
  "models.colProvider": "Provider",
  "models.colRuntime": "Runtime",
  "models.colStatus": "Statut",
  "models.colActions": "Actions",
  "models.loading": "Chargement du registre...",
  "models.noArchivedYet": "Aucun profil archivé pour l'instant.",
  "models.noMatchingFilters": "Aucun profil ne correspond aux filtres actuels.",
  "models.statusArchived": "Archivé",
  "models.statusActive": "Actif",
  "models.statusInactive": "Inactif",
  "models.statusMissingSecret": "Secret manquant",
  "models.testConnection": "Tester la connexion pour {{name}}",
  "models.missingSecretExplain": "Expliquer le secret manquant pour {{name}}",
  "models.missingSecret": "Secret manquant",
  "models.missingSecretTitle": "Secret manquant",
  "models.missingSecretDesc":
    "Ce modèle distant ne peut pas être utilisé tant qu'un secret n'est pas configuré.",
  "models.toastDone": "Fait",
  "models.createModal.title": "Créer un profil",
  "models.editModal.title": "Modifier le profil",
  "models.modal.description":
    "Crée un nouveau profil de modèle partagé ou ajuste un existant depuis un éditeur dédié.",
  "models.role.candidate": "Candidat",
  "models.role.judge": "Juge",
  "models.role.both": "Les deux",
  "models.role.candidateDesc": "Génère les réponses du benchmark",
  "models.role.judgeDesc": "Note les sorties des modèles",
  "models.role.bothDesc": "Peut faire les deux",
  "models.runtime.remote": "Distant",
  "models.runtime.local": "Local",
  "models.runtime.allRuntimes": "Tous les runtimes",
  "models.connection.testing": "Test en cours...",
  "models.connection.success": "Succès {{code}}",
  "models.connection.successNoCode": "Succès",
  "models.connection.failure": "Échec {{code}}",
  "models.connection.failureNoCode": "Échec",
  "models.connection.notLoaded": "Modèle pas encore chargé",
  "models.form.displayName": "Nom d'affichage",
  "models.form.displayNameHint": 'Exemple : "GPT-4.1 Mini - Distant"',
  "models.form.displayNamePlaceholder": "GPT-4.1 Mini - Distant",
  "models.form.role": "Rôle",
  "models.form.roleHint":
    "Choisir Candidat pour la génération, Juge pour la notation, ou Les deux.",
  "models.form.providerType": "Type de provider",
  "models.form.providerTypeHint":
    'Choisir un provider connu ou saisir sa propre valeur. Exemple : "openai", "google", "mistral", "groq", "deepseek", "huggingface" ou "ollama".',
  "models.form.apiStyle": "Style API",
  "models.form.apiStyleHint":
    "Les options recommandées dépendent du provider. Tu peux saisir un style personnalisé si nécessaire.",
  "models.form.runtimeType": "Type de runtime",
  "models.form.runtimeTypeHint":
    "Choisir Distant pour les appels API ou Local pour une exécution opérateur.",
  "models.form.endpointUrl": "URL de l'endpoint",
  "models.form.endpointUrlHint":
    "Pré-rempli depuis {{provider}}. Tu peux quand même le remplacer manuellement si ton déploiement utilise une URL personnalisée.",
  "models.form.modelIdentifier": "Identifiant du modèle",
  "models.form.modelIdentifierHint":
    "Suggestion depuis la documentation {{provider}}. Tu peux sélectionner ou saisir un identifiant personnalisé.",
  "models.form.secret": "Secret",
  "models.form.secretHint.local": "Le runtime local ne nécessite pas de secret.",
  "models.form.secretHint.remoteMissing":
    "Les modèles distants nécessitent un secret manuel ou un preset de clé API.",
  "models.form.secretHint.hasStored":
    "Laisse le secret manuel vide pour garder l'existant, ou passe sur un preset pour le remplacer.",
  "models.form.secretHint.default":
    "Choisir entre un secret manuel et un preset depuis les Paramètres.",
  "models.form.secretMode.manual": "Secret manuel",
  "models.form.secretMode.preset": "Utiliser un preset de clé API",
  "models.form.selectPreset": "Sélectionner un preset enregistré",
  "models.form.secretPlaceholder.local": "Non requis pour le runtime local",
  "models.form.secretPlaceholder.stored": "Clé enregistrée : {{preview}}",
  "models.form.secretPlaceholder.bearer": "Bearer token optionnel",
  "models.form.noSecretLocal": "Aucun secret requis pour les runtimes locaux.",
  "models.form.presetsFrom":
    "Les presets viennent de Paramètres / API Keys et seront copiés dans ce profil à l'enregistrement.",
  "models.form.noPresetAvailable":
    "Aucun preset de clé API disponible pour ce provider. Crée-en un dans Paramètres / API Keys ou reviens à un secret manuel.",
  "models.form.remoteSecretMissing":
    "Les modèles distants sans secret ou preset sont marqués inutilisables jusqu'à ce qu'un soit défini.",
  "models.form.timeoutSeconds": "Délai (secondes)",
  "models.form.timeoutSecondsHint": 'Exemple : "60"',
  "models.form.contextWindow": "Fenêtre de contexte",
  "models.form.contextWindowHint": 'Exemple : "128000"',
  "models.form.contextWindowPlaceholder": "Optionnel",
  "models.form.inputPricing": "Tarif entrée / 1M",
  "models.form.inputPricingHint.local": "Les runtimes locaux sont forcés à 0.",
  "models.form.inputPricingHint.remote": 'Exemple : "0.15"',
  "models.form.outputPricing": "Tarif sortie / 1M",
  "models.form.outputPricingHint.local": "Les runtimes locaux sont forcés à 0.",
  "models.form.outputPricingHint.remote": 'Exemple : "0.60"',
  "models.form.pricingPlaceholder": "Optionnel",
  "models.form.notes": "Notes",
  "models.form.notesHint":
    'Exemple : "Utiliser pour la génération rapide de brouillons sur des prompts courts."',
  "models.form.notesPlaceholder":
    "Utiliser pour la génération rapide de brouillons sur des prompts courts.",
  "models.form.localLoadInstructions": "Instructions de chargement local",
  "models.form.localLoadInstructionsHint":
    'Exemple : "Lancer Ollama, charger le modèle, puis cliquer sur Prêt."',
  "models.form.localLoadInstructionsPlaceholder":
    "Lancer Ollama, charger le modèle, puis cliquer sur Prêt.",
  "models.form.isActive": "Profil disponible pour les nouvelles sessions",
  "models.form.isActiveNote":
    "Désactive si le profil doit rester dans l'historique mais ne plus apparaître dans les nouvelles sessions.",
  "models.form.cancel": "Annuler",
  "models.form.saveChanges": "Enregistrer",
  "models.form.createProfile": "Créer le profil",
  "models.feedback.updated": 'Modèle "{{name}}" mis à jour.',
  "models.feedback.created": 'Modèle "{{name}}" créé.',
  "models.feedback.archived": 'Modèle "{{name}}" archivé.',
  "models.feedback.errorSave": "Impossible d'enregistrer le profil du modèle.",
  "models.feedback.errorArchive": "Impossible d'archiver le profil du modèle.",
  "models.feedback.errorTest": "Échec du test de connexion.",

  // Sessions
  "sessions.benchmarkSetup": "Benchmark Setup",
  "sessions.pageTitle": "Sessions",
  "sessions.metricVisible": "Sessions visibles",
  "sessions.metricPromptLibrary": "Prompt Library",
  "sessions.metricModelRegistry": "Model Registry",
  "sessions.listTitle": "Liste des sessions",
  "sessions.searchPlaceholder": "Rechercher des sessions",
  "sessions.showArchived": "Afficher les archivées",
  "sessions.showUnarchived": "Afficher les actives",
  "sessions.configureSelection": "Configurer la sélection",
  "sessions.newSession": "Nouvelle session",
  "sessions.syncing": "Synchronisation...",
  "sessions.launching": "Lancement du run...",
  "sessions.colSession": "Session",
  "sessions.colComposition": "Composition",
  "sessions.colRubric": "Rubrique",
  "sessions.colUpdated": "Mis à jour",
  "sessions.colStatus": "Statut",
  "sessions.colActions": "Actions",
  "sessions.loading": "Chargement des sessions...",
  "sessions.noArchivedYet": "Aucune session archivée pour l'instant.",
  "sessions.emptyState":
    "Aucune session trouvée. Crée une session de benchmark avec des prompts et des modèles enregistrés pour lancer ton premier run.",
  "sessions.noDescription": "Aucune description",
  "sessions.compositionPrompts": "{{count}} prompts",
  "sessions.compositionCandidates": "{{count}}/{{max}} candidats",
  "sessions.compositionJudges": "{{count}} juges",
  "sessions.action.configure": "Configurer",
  "sessions.action.configureDesc":
    "Ouvrir le flux de sélection étape par étape pour les prompts, candidats et juge.",
  "sessions.action.edit": "Modifier",
  "sessions.action.editDesc":
    "Modifier le nom, la description, le statut, la limite de candidats et la version de rubrique.",
  "sessions.action.launch": "Lancer",
  "sessions.action.launchDesc":
    "Créer et démarrer un nouveau run de benchmark à partir de cette configuration de session.",
  "sessions.action.duplicate": "Dupliquer",
  "sessions.action.duplicateDesc":
    "Cloner cette session avec ses sélections actuelles de prompts, candidats et juge.",
  "sessions.action.archive": "Archiver",
  "sessions.action.archiveDesc":
    "Archiver cette session pour qu'elle disparaisse de la liste active sans supprimer l'historique.",
  "sessions.createModal.title": "Créer une session",
  "sessions.editModal.title": "Modifier la session",
  "sessions.modal.description":
    "Crée une session de benchmark ou met à jour la sélectionnée sans quitter l'écran de configuration.",
  "sessions.configureModal.title": "Configurer {{name}}",
  "sessions.configureModal.defaultTitle": "Configurer la session",
  "sessions.form.name": "Nom",
  "sessions.form.nameHint": 'Exemple : "Benchmark Notes de Version - Avril"',
  "sessions.form.namePlaceholder": "Benchmark Notes de Version - Avril",
  "sessions.form.description": "Description",
  "sessions.form.descriptionHint":
    'Exemple : "Comparer trois modèles sur la résumé de mises à jour produit."',
  "sessions.form.descriptionPlaceholder":
    "Comparer trois modèles sur le résumé de mises à jour produit.",
  "sessions.form.status": "Statut",
  "sessions.form.statusHint":
    "Utiliser Brouillon pendant la configuration, puis Prêt quand la session peut être lancée.",
  "sessions.form.status.draft": "Brouillon",
  "sessions.form.status.ready": "Prêt",
  "sessions.form.status.archived": "Archivé",
  "sessions.form.maxCandidates": "Candidats max",
  "sessions.form.maxCandidatesHint":
    "Choisir combien de slots de modèles candidats cette session peut accepter.",
  "sessions.form.rubricVersion": "Version de rubrique",
  "sessions.form.rubricVersionHint": 'Exemple : "mvp-v1"',
  "sessions.form.cancel": "Annuler",
  "sessions.form.saveSession": "Enregistrer la session",
  "sessions.form.createSession": "Créer la session",
  "sessions.selection.prompts": "Prompts",
  "sessions.selection.promptsDesc":
    "Choisir les prompts inclus dans cette session de benchmark.",
  "sessions.selection.candidates": "Candidats",
  "sessions.selection.candidatesDesc":
    "Attacher jusqu'à {{max}} modèles candidats pour cette configuration de run.",
  "sessions.selection.judges": "Juge",
  "sessions.selection.judgesDesc": "Assigner le modèle juge responsable de l'évaluation.",
  "sessions.selection.selected": "Sélectionné",
  "sessions.selection.library": "Bibliothèque",
  "sessions.selection.noPromptsYet": "Aucun prompt sélectionné pour l'instant.",
  "sessions.selection.noCandidatesYet": "Aucun modèle candidat sélectionné pour l'instant.",
  "sessions.selection.noJudgeYet": "Aucun juge sélectionné pour l'instant.",
  "sessions.selection.noItems": "Aucun élément correspondant disponible.",
  "sessions.selection.current": "Actuel",
  "sessions.selection.open": "Ouvrir",
  "sessions.selection.count": "{{count}} sélectionné(s)",
  "sessions.selection.searchLibrary": "Rechercher la bibliothèque de {{type}}",
  "sessions.selection.add": "Ajouter",
  "sessions.selection.close": "Fermer",
  "sessions.selection.nextStep": "Étape suivante",
  "sessions.selection.orderPrefix": "Ordre {{order}}",
  "sessions.feedback.updated": 'Session "{{name}}" mise à jour.',
  "sessions.feedback.created": 'Session "{{name}}" créée.',
  "sessions.feedback.archived": 'Session "{{name}}" archivée.',
  "sessions.feedback.duplicated": 'Session dupliquée en "{{name}}".',
  "sessions.feedback.promptAdded": "Prompt ajouté à la session.",
  "sessions.feedback.promptRemoved": "Prompt retiré de la session.",
  "sessions.feedback.candidateAdded": "Candidat ajouté à la session.",
  "sessions.feedback.candidateRemoved": "Candidat retiré de la session.",
  "sessions.feedback.judgeAdded": "Juge ajouté à la session.",
  "sessions.feedback.judgeRemoved": "Juge retiré de la session.",
  "sessions.feedback.runLaunched": 'Run "{{name}}" lancé.',
  "sessions.feedback.errorSave": "Impossible d'enregistrer la session.",
  "sessions.feedback.errorOp": "Opération échouée.",
  "sessions.feedback.errorLaunch": "Impossible de lancer le run.",

  // Runs
  "runs.executionMonitor": "Execution Monitor",
  "runs.pageTitle": "Runs",
  "runs.metricVisible": "Runs visibles",
  "runs.metricCompleted": "Terminés",
  "runs.metricActive": "Runs actifs",
  "runs.metricReports": "Rapports prêts",
  "runs.listTitle": "Liste des runs",
  "runs.searchPlaceholder": "Rechercher des runs",
  "runs.loading": "Chargement des runs...",
  "runs.noRuns": "Aucun run pour l'instant. Lance une session pour créer ton premier run.",
  "runs.noMatchingFilters": "Aucun run ne correspond à la recherche.",
  "runs.preview.title": "Aperçu du run",
  "runs.preview.close": "Fermer",
  "runs.preview.viewFull": "Voir le run complet",

  // Contributors
  "contributors.creditsWall": "Mur des crédits",
  "contributors.pageTitle": "Contributeurs",
  "contributors.mainContributors": "Contributeurs principaux",
  "contributors.others": "Autres",
  "contributors.noMain": "Aucun contributeur principal trouvé.",
  "contributors.noOthers": "Aucun autre contributeur trouvé.",

  // Load error state
  "error.databaseOffline": "Base de données hors ligne",
  "error.databaseOfflineDesc":
    "BenchForge n'a pas pu charger {{resource}} car la connexion à la base de données est indisponible.",
  "error.backendOffline": "Backend hors ligne",
  "error.backendOfflineDesc":
    "BenchForge n'a pas pu atteindre l'API lors du chargement de {{resource}}. Démarrez le backend et réessayez.",
  "error.unableToLoad": "Impossible de charger {{resource}}",
  "error.retry": "Réessayer",

  // Common
  "common.settings": "Paramètres",
  "common.archive": "Archiver {{name}}",
  "common.delete": "Supprimer {{name}}",
  "common.cancel": "Annuler",
  "common.save": "Enregistrer",
  "common.moreItems": "+{{count}} de plus",
} as const;

export default fr;
