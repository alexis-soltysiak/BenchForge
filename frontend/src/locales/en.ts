const en = {
  // Navigation
  "nav.promptLibrary": "Prompt Library",
  "nav.promptLibraryDesc": "Reusable prompt assets",
  "nav.modelRegistry": "Model Registry",
  "nav.modelRegistryDesc": "Profiles and endpoints",
  "nav.sessions": "Sessions",
  "nav.sessionsDesc": "Benchmark configuration",
  "nav.runs": "Runs",
  "nav.runsDesc": "Execution and judging",
  "nav.credits": "Credits",
  "nav.settings": "Settings",
  "nav.openCredits": "Open contributors",
  "nav.openSettings": "Open settings",
  "nav.navigationRail": "Navigation rail",
  "nav.mobileNote":
    "Desktop gets the right-side sticky navigation. Mobile keeps the same sections in a lighter compact strip.",

  // Settings sidebar
  "settings.title": "Settings",
  "settings.workspacePreferences": "Workspace preferences",
  "settings.theme.sidebarTitle": "Theme",
  "settings.theme.sidebarDesc": "Choose the visual atmosphere of the workspace",
  "settings.apiKeys.sidebarTitle": "API Keys",
  "settings.apiKeys.sidebarDesc": "Set up local keys for providers",
  "settings.language.sidebarTitle": "Language",
  "settings.language.sidebarDesc": "Choose the interface language",

  // Settings header cards
  "settings.theme.pageTitle": "Theme",
  "settings.theme.pageHeading": "Theme page",
  "settings.theme.pageDesc":
    "Each selection immediately applies a global atmosphere to BenchForge.",
  "settings.apiKeys.pageTitle": "API Keys",
  "settings.apiKeys.pageHeading": "API Key page",
  "settings.apiKeys.pageDesc":
    "Create reusable presets per provider, then select them when creating or editing models.",
  "settings.language.pageTitle": "Language",
  "settings.language.pageHeading": "Language page",
  "settings.language.pageDesc":
    "Select the interface language. The change applies immediately.",

  // Theme options
  "theme.paperWhite.name": "Paper White",
  "theme.paperWhite.description":
    "The clean, bright base, close to the current interface.",
  "theme.nightSlate.name": "Night Slate",
  "theme.nightSlate.description":
    "Dense night blue for long sessions and dark screens.",
  "theme.carbonNoir.name": "Carbon Noir",
  "theme.carbonNoir.description":
    "A warmer, higher-contrast dark, almost editorial.",
  "theme.duneSand.name": "Dune Sand",
  "theme.duneSand.description":
    "Sandy, solar, matte palette — less clinical than pure white.",
  "theme.canopyForest.name": "Canopy Forest",
  "theme.canopyForest.description":
    "Soft, deep greens — more organic without going fantasy.",
  "theme.tidalOcean.name": "Tidal Ocean",
  "theme.tidalOcean.description":
    "Aqua blues and cool surfaces — calmer and more fluid.",
  "theme.active": "Active",
  "theme.apply": "Apply",

  // API Keys
  "apiKeys.addPreset": "Add API key preset",
  "apiKeys.addPresetDesc":
    "Give it a name, pick a provider, then paste the key. This preset can then be reused from the Models page.",
  "apiKeys.namePlaceholder": "Ex: OpenAI prod",
  "apiKeys.addLine": "Add line",
  "apiKeys.registeredPresets": "Registered presets",
  "apiKeys.registeredPresetsDesc":
    "Each model can either use a manual key or a preset.",
  "apiKeys.encryptedInBackend": "Encrypted in backend",
  "apiKeys.noPresetYet": "No API key preset yet. Add the first line above.",
  "apiKeys.storedKeyPrefix": "Stored key:",
  "apiKeys.pasteNewKey": "Paste a new API key",
  "apiKeys.save": "Save",
  "apiKeys.delete": "Delete",
  "apiKeys.created": "API key preset created.",
  "apiKeys.updated": "API key preset updated.",
  "apiKeys.deleted": "API key preset deleted.",
  "apiKeys.errorCreate": "Unable to create API key preset.",
  "apiKeys.errorUpdate": "Unable to update API key preset.",
  "apiKeys.errorDelete": "Unable to delete API key preset.",

  // Language settings
  "language.fr.native": "Français",
  "language.fr.label": "French",
  "language.fr.description": "FR-oriented interface for the studio and internal pages.",
  "language.fr.badge": "Default",
  "language.en.native": "English",
  "language.en.label": "English",
  "language.en.description": "EN-oriented interface for more international use.",
  "language.en.badge": "Available",
  "language.selected": "Selected",
  "language.select": "Select",
  "language.previewState": "Selection state",
  "language.currentSelection": "Current selection",

  // Home page
  "home.benchmarkStudio": "Benchmark studio",
  "home.tagline": "Benchmark studio for prompts, models, sessions and runs.",
  "home.credits": "Credits",
  "home.startWithPrompts": "Start with prompts",
  "home.howItWorks": "How it works",
  "home.mainHeading":
    "Build a readable benchmark path, from prompt to run.",
  "home.mainDesc":
    "BenchForge is a simple, self-hostable space to compare models using the same test base. You create prompts, register models, assemble sessions, then launch runs and read results.",
  "home.exploreSessions": "Explore sessions",
  "home.viewRuns": "View runs",
  "home.configureModels": "Configure models",
  "home.browsePrompts": "Browse prompts",
  "home.openSessions": "Open sessions",
  "home.feature.structured": "Structured",
  "home.feature.structuredDesc":
    "Each benchmark stays within a predictable object model.",
  "home.feature.replayable": "Replayable",
  "home.feature.replayableDesc":
    "Sessions let you rerun exactly the same base later.",
  "home.feature.readable": "Readable",
  "home.feature.readableDesc":
    "The path from prompt to result stays visible at a glance.",
  "home.pipeline": "Pipeline",
  "home.pipelineSubtitle": "Prompts, models, sessions, runs.",
  "home.objectif": "Goal",
  "home.objectifValue": "Compare, decide, iterate.",
  "home.howToUseIt": "How to use it",
  "home.simplePathHeading": "A simple path from idea to evaluation.",
  "home.startingPoint": "Starting point",
  "home.startingPointHeading":
    "Create prompts first, then let the rest of the pipeline follow.",
  "home.startingPointDesc":
    "The project is intentionally ordered. If the prompt layer is clean, the model registry, session builder, and results stay easy to understand.",
  "home.readyToLaunch": "Ready to launch",
  "home.readyToLaunchHeading":
    "Compose a session and launch a run when the setup is stable.",
  "home.readyToLaunchDesc":
    "Sessions wrap the benchmark. Runs execute it. Result: reproducible comparisons, easy to audit and share.",
  "home.ctaDesc":
    "BenchForge keeps the benchmark path visible from the first prompt to the final run.",

  // Flow steps
  "flow.prompts.subtitle": "Create the content to test",
  "flow.prompts.description":
    "Centralize your prompts, variants, and execution rules to keep a clean, reusable base.",
  "flow.models.subtitle": "Register the engines",
  "flow.models.description":
    "Register models, endpoints, and parameters to compare multiple providers or configurations.",
  "flow.sessions.subtitle": "Assemble the scenario",
  "flow.sessions.description":
    "Combine prompts, models, candidates, and judges in a clear, replayable benchmark session.",
  "flow.runs.subtitle": "Launch and measure",
  "flow.runs.description":
    "The session produces a run: execution, tracking, arbitration, and result reading to decide fast and well.",

  // How it works steps
  "howItWorks.step1.title": "Prepare prompts",
  "howItWorks.step1.body":
    "Start by writing the problem, constraints, and variants to compare. BenchForge keeps everything structured.",
  "howItWorks.step2.title": "Connect models",
  "howItWorks.step2.body":
    "Add one or more models, local or remote. You can then measure differences with the same test base.",
  "howItWorks.step3.title": "Compose a session",
  "howItWorks.step3.body":
    "A session links prompts, models, and evaluation rules. It's your benchmark plan, not just a list of items.",
  "howItWorks.step4.title": "Launch a run",
  "howItWorks.step4.body":
    "The run executes the session, collects responses, and prepares result reading for clean comparisons.",

  // Prompt Library
  "prompts.reusableAssets": "Reusable Assets",
  "prompts.pageTitle": "Prompt Library",
  "prompts.metricVisible": "Visible Prompts",
  "prompts.metricCategories": "Categories",
  "prompts.metricSystemPacks": "System Packs",
  "prompts.searchPlaceholder": "Search names, descriptions, tags",
  "prompts.categoryLabel": "Category",
  "prompts.allCategories": "All categories",
  "prompts.chooseCategory": "Choose a category",
  "prompts.chooseCategoryDesc": "Narrow the library to one family of prompts.",
  "prompts.tagsLabel": "Tags",
  "prompts.addOrRemoveTags": "Add or remove tags",
  "prompts.manageTags": "Manage tags",
  "prompts.manageTagsDesc":
    "Add tags to refine the library, or remove them to broaden it.",
  "prompts.addATag": "Add a tag",
  "prompts.add": "Add",
  "prompts.activeTags": "Active tags",
  "prompts.clearAll": "Clear all",
  "prompts.suggestions": "Suggestions",
  "prompts.clickToAdd": "Click to add",
  "prompts.noTagsToSuggest": "No remaining tags to suggest.",
  "prompts.resetFilters": "Reset filters",
  "prompts.showArchived": "Show archived prompts",
  "prompts.showUnarchived": "Show unarchived prompts",
  "prompts.newPrompt": "New prompt",
  "prompts.filtered": "Filtered",
  "prompts.colName": "Name",
  "prompts.colCategory": "Category",
  "prompts.colTags": "Tags",
  "prompts.colUpdated": "Updated",
  "prompts.colStatus": "Status",
  "prompts.colActions": "Actions",
  "prompts.noDescription": "No description",
  "prompts.noTags": "No tags",
  "prompts.statusArchived": "Archived",
  "prompts.statusActive": "Active",
  "prompts.statusInactive": "Inactive",
  "prompts.loading": "Loading prompt library...",
  "prompts.noArchivedYet": "No archived prompts yet.",
  "prompts.emptySeeded":
    "Built-in prompts are seeded automatically on first load. Refresh if the library is still empty.",
  "prompts.noMatchingFilters": "No prompts match the current filters.",
  "prompts.createModal.title": "Create prompt",
  "prompts.editModal.title": "Edit prompt",
  "prompts.modal.description":
    "Create a reusable prompt or refine an existing one without leaving the library view.",
  "prompts.form.name": "Name",
  "prompts.form.nameHint": 'Example: "Summarize a product launch email"',
  "prompts.form.namePlaceholder": "Summarize a product launch email",
  "prompts.form.category": "Category",
  "prompts.form.categoryHint":
    "Select the closest prompt family used in the library.",
  "prompts.form.description": "Description",
  "prompts.form.descriptionHint":
    'Example: "Short benchmark brief displayed in the library."',
  "prompts.form.descriptionPlaceholder":
    "Short benchmark brief displayed in the library.",
  "prompts.form.tags": "Tags",
  "prompts.form.tagsHint": 'Example: "summarization, writing, business"',
  "prompts.form.tagsPlaceholder": "Comma-separated tags",
  "prompts.form.systemPrompt": "System prompt",
  "prompts.form.systemPromptHint":
    'Example: "You are a precise analyst who writes concise answers."',
  "prompts.form.systemPromptPlaceholder":
    "You are a precise analyst who writes concise answers.",
  "prompts.form.userPrompt": "User prompt",
  "prompts.form.userPromptHint":
    'Example: "Summarize the following text in 5 clear bullet points."',
  "prompts.form.userPromptPlaceholder":
    "Summarize the following text in 5 clear bullet points.",
  "prompts.form.evaluationNotes": "Evaluation notes",
  "prompts.form.evaluationNotesHint":
    'Example: "Check factual accuracy, structure and concise tone."',
  "prompts.form.evaluationNotesPlaceholder":
    "Check factual accuracy, structure and concise tone.",
  "prompts.form.isActive": "Prompt available for upcoming sessions",
  "prompts.form.isActiveNote":
    "Keep this enabled when the prompt should remain selectable in future sessions.",
  "prompts.form.cancel": "Cancel",
  "prompts.form.saveChanges": "Save changes",
  "prompts.form.createPrompt": "Create prompt",
  "prompts.feedback.updated": 'Prompt "{{name}}" updated.',
  "prompts.feedback.created": 'Prompt "{{name}}" created.',
  "prompts.feedback.archived": 'Prompt "{{name}}" archived.',
  "prompts.feedback.errorSave": "Unable to save prompt.",
  "prompts.feedback.errorArchive": "Unable to archive prompt.",

  // Model Registry
  "models.connectionProfiles": "Connection Profiles",
  "models.pageTitle": "Model Registry",
  "models.metricVisible": "Visible Models",
  "models.metricCandidates": "Candidates",
  "models.metricJudges": "Judges",
  "models.searchPlaceholder": "Search names, providers, runtimes",
  "models.rolesLabel": "Roles",
  "models.allRoles": "All roles",
  "models.pickRoles": "Pick roles",
  "models.pickRolesDesc": "Select one or more registry roles.",
  "models.providerLabel": "Provider",
  "models.allProviders": "All providers",
  "models.chooseProvider": "Choose a provider",
  "models.chooseProviderDesc": "Narrow the registry to one provider.",
  "models.runtimeLabel": "Runtime",
  "models.allRuntimes": "All runtimes",
  "models.chooseRuntime": "Choose a runtime",
  "models.chooseRuntimeDesc": "Filter for remote or local model profiles.",
  "models.resetFilters": "Reset filters",
  "models.showArchived": "Show archived models",
  "models.showUnarchived": "Show unarchived models",
  "models.newProfile": "New profile",
  "models.colDisplayName": "Display name",
  "models.colRole": "Role",
  "models.colProvider": "Provider",
  "models.colRuntime": "Runtime",
  "models.colStatus": "Status",
  "models.colActions": "Actions",
  "models.loading": "Loading model registry...",
  "models.noArchivedYet": "No archived model profiles yet.",
  "models.noMatchingFilters": "No model profiles match the current filters.",
  "models.statusArchived": "Archived",
  "models.statusActive": "Active",
  "models.statusInactive": "Inactive",
  "models.statusMissingSecret": "Missing secret",
  "models.testConnection": "Test connection for {{name}}",
  "models.missingSecretExplain": "Explain missing secret for {{name}}",
  "models.missingSecret": "Missing secret",
  "models.missingSecretTitle": "Secret missing",
  "models.missingSecretDesc":
    "This remote model cannot be used until a secret is configured.",
  "models.toastDone": "Done",
  "models.createModal.title": "Create profile",
  "models.editModal.title": "Edit profile",
  "models.modal.description":
    "Create a new shared model profile or adjust an existing one from a dedicated editor.",
  "models.role.candidate": "Candidate",
  "models.role.judge": "Judge",
  "models.role.both": "Both",
  "models.role.candidateDesc": "Generates benchmark answers",
  "models.role.judgeDesc": "Scores model outputs",
  "models.role.bothDesc": "Can do both jobs",
  "models.runtime.remote": "Remote",
  "models.runtime.local": "Local",
  "models.runtime.allRuntimes": "All runtimes",
  "models.connection.testing": "Testing...",
  "models.connection.success": "Success {{code}}",
  "models.connection.successNoCode": "Success",
  "models.connection.failure": "Failure {{code}}",
  "models.connection.failureNoCode": "Failure",
  "models.connection.notLoaded": "Model not loaded yet",
  "models.form.displayName": "Display name",
  "models.form.displayNameHint": 'Example: "GPT-4.1 Mini - Remote"',
  "models.form.displayNamePlaceholder": "GPT-4.1 Mini - Remote",
  "models.form.role": "Role",
  "models.form.roleHint":
    "Choose Candidate for generation, Judge for scoring, or Both.",
  "models.form.providerType": "Provider type",
  "models.form.providerTypeHint":
    'Pick a known provider or type your own value. Example: "openai", "google", "mistral", "groq", "deepseek", "huggingface" or "ollama".',
  "models.form.apiStyle": "API style",
  "models.form.apiStyleHint":
    "Recommended options are driven by the provider. You can still type a custom style if you know what you are doing.",
  "models.form.runtimeType": "Runtime type",
  "models.form.runtimeTypeHint":
    "Choose Remote for API calls or Local for operator-driven execution.",
  "models.form.endpointUrl": "Endpoint URL",
  "models.form.endpointUrlHint":
    "Auto-filled from {{provider}}. You can still override it manually if your deployment uses a custom URL.",
  "models.form.modelIdentifier": "Model identifier",
  "models.form.modelIdentifierHint":
    "Suggested from {{provider}} docs. You can select one or type any custom identifier.",
  "models.form.secret": "Secret",
  "models.form.secretHint.local": "Local runtime does not require a secret.",
  "models.form.secretHint.remoteMissing":
    "Remote models need either a manual secret or an API key preset.",
  "models.form.secretHint.hasStored":
    "Leave manual secret blank to keep the existing one, or switch to a preset to replace it.",
  "models.form.secretHint.default":
    "Choose between a manual secret and a preset from Settings.",
  "models.form.secretMode.manual": "Manual secret",
  "models.form.secretMode.preset": "Use API key preset",
  "models.form.selectPreset": "Select a saved preset",
  "models.form.secretPlaceholder.local": "Not required for local runtime",
  "models.form.secretPlaceholder.stored": "Stored key: {{preview}}",
  "models.form.secretPlaceholder.bearer": "Optional bearer token",
  "models.form.noSecretLocal": "No secret is needed for local runtimes.",
  "models.form.presetsFrom":
    "Presets come from Settings / API Keys and will be copied into this model profile when you save.",
  "models.form.noPresetAvailable":
    "No API key preset is available yet for this provider. Create one in Settings / API Keys or switch back to a manual secret.",
  "models.form.remoteSecretMissing":
    "Remote models without a secret or preset are marked unusable until one is set.",
  "models.form.timeoutSeconds": "Timeout seconds",
  "models.form.timeoutSecondsHint": 'Example: "60"',
  "models.form.contextWindow": "Context window",
  "models.form.contextWindowHint": 'Example: "128000"',
  "models.form.contextWindowPlaceholder": "Optional",
  "models.form.inputPricing": "Input pricing / 1M",
  "models.form.inputPricingHint.local": "Local runtimes are forced to 0.",
  "models.form.inputPricingHint.remote": 'Example: "0.15"',
  "models.form.outputPricing": "Output pricing / 1M",
  "models.form.outputPricingHint.local": "Local runtimes are forced to 0.",
  "models.form.outputPricingHint.remote": 'Example: "0.60"',
  "models.form.pricingPlaceholder": "Optional",
  "models.form.notes": "Notes",
  "models.form.notesHint":
    'Example: "Use for fast draft generation on short prompts."',
  "models.form.notesPlaceholder": "Use for fast draft generation on short prompts.",
  "models.form.localLoadInstructions": "Local load instructions",
  "models.form.localLoadInstructionsHint":
    'Example: "Launch Ollama, load the model, then click Confirm ready."',
  "models.form.localLoadInstructionsPlaceholder":
    "Launch Ollama, load the model, then click Confirm ready.",
  "models.form.isActive": "Profile available for new sessions",
  "models.form.isActiveNote":
    "Disable this if the profile should stay in history but no longer appear in new session setup.",
  "models.form.cancel": "Cancel",
  "models.form.saveChanges": "Save changes",
  "models.form.createProfile": "Create profile",
  "models.feedback.updated": 'Model "{{name}}" updated.',
  "models.feedback.created": 'Model "{{name}}" created.',
  "models.feedback.archived": 'Model "{{name}}" archived.',
  "models.feedback.errorSave": "Unable to save model profile.",
  "models.feedback.errorArchive": "Unable to archive model profile.",
  "models.feedback.errorTest": "Connection test failed.",

  // Sessions
  "sessions.benchmarkSetup": "Benchmark Setup",
  "sessions.pageTitle": "Sessions",
  "sessions.metricVisible": "Visible Sessions",
  "sessions.metricPromptLibrary": "Prompt Library",
  "sessions.metricModelRegistry": "Model Registry",
  "sessions.listTitle": "Sessions List",
  "sessions.searchPlaceholder": "Search sessions",
  "sessions.showArchived": "Show archived",
  "sessions.showUnarchived": "Show unarchived",
  "sessions.configureSelection": "Configure selection",
  "sessions.newSession": "New session",
  "sessions.syncing": "Syncing changes...",
  "sessions.launching": "Launching run...",
  "sessions.colSession": "Session",
  "sessions.colComposition": "Composition",
  "sessions.colRubric": "Rubric",
  "sessions.colUpdated": "Updated",
  "sessions.colStatus": "Status",
  "sessions.colActions": "Actions",
  "sessions.loading": "Loading sessions...",
  "sessions.noArchivedYet": "No archived sessions yet.",
  "sessions.emptyState":
    "No sessions found. Create a benchmark session with seeded prompts and registered models to launch your first run.",
  "sessions.noDescription": "No description",
  "sessions.compositionPrompts": "{{count}} prompts",
  "sessions.compositionCandidates": "{{count}} candidates",
  "sessions.compositionJudges": "{{count}} judges",
  "sessions.action.configure": "Configure",
  "sessions.action.configureDesc":
    "Open the step-by-step selection flow for prompts, candidates, and judge.",
  "sessions.action.edit": "Edit",
  "sessions.action.editDesc":
    "Edit the session name, description, status, and rubric version.",
  "sessions.action.launch": "Launch",
  "sessions.action.launchDesc":
    "Create and start a new benchmark run from this session configuration.",
  "sessions.action.duplicate": "Duplicate",
  "sessions.action.duplicateDesc":
    "Clone this session with its current prompts, candidates, and judge selections.",
  "sessions.action.archive": "Archive",
  "sessions.action.archiveDesc":
    "Archive this session so it disappears from the active list without deleting history.",
  "sessions.createModal.title": "Create session",
  "sessions.editModal.title": "Edit session",
  "sessions.modal.description":
    "Create a benchmark session or update the selected one without leaving the setup screen.",
  "sessions.configureModal.title": "Configure {{name}}",
  "sessions.configureModal.defaultTitle": "Configure session",
  "sessions.form.name": "Name",
  "sessions.form.nameHint": 'Example: "Release Notes Benchmark - April"',
  "sessions.form.namePlaceholder": "Release Notes Benchmark - April",
  "sessions.form.description": "Description",
  "sessions.form.descriptionHint":
    'Example: "Compare three models on product update summarization."',
  "sessions.form.descriptionPlaceholder":
    "Compare three models on product update summarization.",
  "sessions.form.status": "Status",
  "sessions.form.statusHint":
    "Use Draft while configuring, then Ready when the session can be launched.",
  "sessions.form.status.draft": "Draft",
  "sessions.form.status.ready": "Ready",
  "sessions.form.status.archived": "Archived",
  "sessions.form.rubricVersion": "Rubric version",
  "sessions.form.rubricVersionHint": 'Example: "mvp-v1"',
  "sessions.form.cancel": "Cancel",
  "sessions.form.saveSession": "Save session",
  "sessions.form.createSession": "Create session",
  "sessions.selection.prompts": "Prompts",
  "sessions.selection.promptsDesc":
    "Choose the prompts included in this benchmark session.",
  "sessions.selection.candidates": "Candidates",
  "sessions.selection.candidatesDesc":
    "Attach the candidate models for this run configuration.",
  "sessions.selection.judges": "Judge",
  "sessions.selection.judgesDesc": "Assign the judge model responsible for evaluation.",
  "sessions.selection.selected": "Selected",
  "sessions.selection.library": "Library",
  "sessions.selection.noPromptsYet": "No prompts selected yet.",
  "sessions.selection.noCandidatesYet": "No candidate models selected yet.",
  "sessions.selection.noJudgeYet": "No judge selected yet.",
  "sessions.selection.noItems": "No matching items available.",
  "sessions.selection.current": "Current",
  "sessions.selection.open": "Open",
  "sessions.selection.count": "{{count}} selected",
  "sessions.selection.searchLibrary": "Search {{type}} library",
  "sessions.selection.add": "Add",
  "sessions.selection.close": "Close",
  "sessions.selection.nextStep": "Next step",
  "sessions.selection.orderPrefix": "Order {{order}}",
  "sessions.selection.information": "Information",
  "sessions.selection.saved": "Saved",
  "sessions.selection.new": "New",
  "sessions.selection.filterCategory": "Category",
  "sessions.selection.filterDifficulty": "Difficulty",
  "sessions.feedback.updated": 'Session "{{name}}" updated.',
  "sessions.feedback.created": 'Session "{{name}}" created.',
  "sessions.feedback.archived": 'Session "{{name}}" archived.',
  "sessions.feedback.duplicated": 'Session duplicated as "{{name}}".',
  "sessions.feedback.promptAdded": "Prompt added to session.",
  "sessions.feedback.promptRemoved": "Prompt removed from session.",
  "sessions.feedback.candidateAdded": "Candidate added to session.",
  "sessions.feedback.candidateRemoved": "Candidate removed from session.",
  "sessions.feedback.judgeAdded": "Judge added to session.",
  "sessions.feedback.judgeRemoved": "Judge removed from session.",
  "sessions.feedback.runLaunched": 'Run "{{name}}" launched.',
  "sessions.feedback.errorSave": "Unable to save session.",
  "sessions.feedback.errorOp": "Operation failed.",
  "sessions.feedback.errorLaunch": "Unable to launch run.",

  // Runs
  "runs.executionMonitor": "Execution Monitor",
  "runs.pageTitle": "Runs",
  "runs.metricVisible": "Visible Runs",
  "runs.metricCompleted": "Completed",
  "runs.metricActive": "Active Runs",
  "runs.metricReports": "Reports Ready",
  "runs.listTitle": "Runs List",
  "runs.searchPlaceholder": "Search runs",
  "runs.loading": "Loading runs...",
  "runs.noRuns": "No runs yet. Launch a session to create your first run.",
  "runs.noMatchingFilters": "No runs match the search.",
  "runs.preview.title": "Run preview",
  "runs.preview.close": "Close",
  "runs.preview.viewFull": "View full run",

  // Contributors
  "contributors.creditsWall": "Credits wall",
  "contributors.pageTitle": "Contributors",
  "contributors.mainContributors": "Main contributors",
  "contributors.others": "Others",
  "contributors.noMain": "No main contributors found.",
  "contributors.noOthers": "No other contributors found.",

  // Load error state
  "error.databaseOffline": "Database offline",
  "error.databaseOfflineDesc":
    "BenchForge couldn't load {{resource}} because the database connection is unavailable.",
  "error.backendOffline": "Backend offline",
  "error.backendOfflineDesc":
    "BenchForge couldn't reach the API while loading {{resource}}. Start the backend and try again.",
  "error.unableToLoad": "Unable to load {{resource}}",
  "error.retry": "Retry",

  // Common
  "common.settings": "Settings",
  "common.archive": "Archive {{name}}",
  "common.delete": "Delete {{name}}",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.moreItems": "+{{count}} more",
} as const;

export default en;
