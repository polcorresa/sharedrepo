/**
 * Language detection utilities for file extensions
 * 
 * Maps file extensions to Monaco Editor language identifiers
 * for syntax highlighting and editor configuration.
 */

/**
 * Supported programming languages and their extensions
 */
export const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',

  // Python
  py: 'python',
  pyw: 'python',
  pyi: 'python',

  // Java
  java: 'java',

  // C / C++
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',

  // C#
  cs: 'csharp',
  csx: 'csharp',

  // Go
  go: 'go',

  // Rust
  rs: 'rust',

  // Ruby
  rb: 'ruby',
  rake: 'ruby',

  // PHP
  php: 'php',
  phtml: 'php',

  // Swift
  swift: 'swift',

  // Kotlin
  kt: 'kotlin',
  kts: 'kotlin',

  // Scala
  scala: 'scala',
  sc: 'scala',

  // Shell
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',

  // HTML / XML
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  xml: 'xml',
  svg: 'xml',

  // CSS / SCSS / LESS
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',

  // JSON
  json: 'json',
  jsonc: 'json',

  // YAML
  yaml: 'yaml',
  yml: 'yaml',

  // Markdown
  md: 'markdown',
  markdown: 'markdown',

  // SQL
  sql: 'sql',

  // GraphQL
  graphql: 'graphql',
  gql: 'graphql',

  // Docker
  dockerfile: 'dockerfile',

  // Makefile
  makefile: 'makefile',

  // Plain text
  txt: 'plaintext',
  text: 'plaintext',

  // Configuration files
  ini: 'ini',
  toml: 'toml',
  conf: 'plaintext',
  config: 'plaintext',

  // Lua
  lua: 'lua',

  // Perl
  pl: 'perl',
  pm: 'perl',

  // R
  r: 'r',

  // Dart
  dart: 'dart',

  // Elixir
  ex: 'elixir',
  exs: 'elixir',

  // Clojure
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',

  // Haskell
  hs: 'haskell',

  // Objective-C
  m: 'objective-c',
  mm: 'objective-c',

  // PowerShell
  ps1: 'powershell',
  psm1: 'powershell',
  psd1: 'powershell',

  // Batch
  bat: 'bat',
  cmd: 'bat',

  // VB
  vb: 'vb',

  // F#
  fs: 'fsharp',
  fsx: 'fsharp',
  fsi: 'fsharp',

  // Pascal
  pas: 'pascal',

  // Solidity
  sol: 'sol',

  // Protocol Buffers
  proto: 'proto',

  // Terraform
  tf: 'terraform',
  tfvars: 'terraform',

  // Redis
  redis: 'redis',

  // Handlebars
  hbs: 'handlebars',
  handlebars: 'handlebars',

  // Pug
  pug: 'pug',
  jade: 'pug',

  // WASM
  wat: 'wasm',
  wast: 'wasm',
};

/**
 * Default language when no match is found
 */
export const DEFAULT_LANGUAGE = 'plaintext';

/**
 * Special filenames that should map to specific languages
 */
export const SPECIAL_FILENAMES: Record<string, string> = {
  // Docker
  Dockerfile: 'dockerfile',
  'Dockerfile.dev': 'dockerfile',
  'Dockerfile.prod': 'dockerfile',

  // Makefile
  Makefile: 'makefile',
  makefile: 'makefile',
  GNUmakefile: 'makefile',

  // Git
  '.gitignore': 'plaintext',
  '.gitattributes': 'plaintext',

  // Node.js
  '.npmrc': 'ini',
  '.nvmrc': 'plaintext',

  // Editor config
  '.editorconfig': 'ini',

  // Environment
  '.env': 'plaintext',
  '.env.example': 'plaintext',
  '.env.local': 'plaintext',

  // ESLint
  '.eslintrc': 'json',
  '.eslintrc.json': 'json',
  '.eslintrc.js': 'javascript',

  // Prettier
  '.prettierrc': 'json',
  '.prettierrc.json': 'json',
  '.prettierrc.js': 'javascript',

  // TypeScript
  'tsconfig.json': 'json',
  'tsconfig.base.json': 'json',

  // Package managers
  'package.json': 'json',
  'package-lock.json': 'json',
  'yarn.lock': 'yaml',
  'pnpm-lock.yaml': 'yaml',

  // Webpack
  'webpack.config.js': 'javascript',

  // Vite
  'vite.config.js': 'javascript',
  'vite.config.ts': 'typescript',

  // Readme
  README: 'markdown',
  'README.md': 'markdown',
  'readme.md': 'markdown',

  // License
  LICENSE: 'plaintext',
  'LICENSE.md': 'markdown',
};

/**
 * Extracts the file extension from a filename.
 * Returns lowercase extension without the dot.
 *
 * @param filename - File name to extract extension from
 * @returns Extension without dot (lowercase), or empty string if none
 *
 * @example
 * getFileExtension('index.ts');        // 'ts'
 * getFileExtension('app.min.js');      // 'js'
 * getFileExtension('Dockerfile');      // ''
 * getFileExtension('.gitignore');      // 'gitignore'
 */
export const getFileExtension = (filename: string): string => {
  if (!filename || filename.trim().length === 0) {
    return '';
  }

  const trimmed = filename.trim();
  const lastDotIndex = trimmed.lastIndexOf('.');

  // No extension
  if (lastDotIndex === -1 || lastDotIndex === trimmed.length - 1) {
    return '';
  }

  // File starts with dot (.gitignore) - treat as extension
  if (lastDotIndex === 0) {
    return trimmed.substring(1).toLowerCase();
  }

  return trimmed.substring(lastDotIndex + 1).toLowerCase();
};

/**
 * Detects language from filename using extension and special filename mappings.
 *
 * @param filename - File name to detect language for
 * @returns Monaco Editor language identifier
 *
 * @example
 * detectLanguage('index.ts');           // 'typescript'
 * detectLanguage('App.jsx');            // 'javascript'
 * detectLanguage('Dockerfile');         // 'dockerfile'
 * detectLanguage('unknown.xyz');        // 'plaintext'
 */
export const detectLanguage = (filename: string): string => {
  if (!filename || filename.trim().length === 0) {
    return DEFAULT_LANGUAGE;
  }

  const trimmed = filename.trim();

  // Check special filenames first (case-sensitive)
  if (SPECIAL_FILENAMES[trimmed]) {
    return SPECIAL_FILENAMES[trimmed];
  }

  // Check case-insensitive special filenames
  const lowerFilename = trimmed.toLowerCase();
  const specialMatch = Object.entries(SPECIAL_FILENAMES).find(
    ([name]) => name.toLowerCase() === lowerFilename
  );
  if (specialMatch) {
    return specialMatch[1];
  }

  // Extract extension and map to language
  const extension = getFileExtension(trimmed);
  if (extension && LANGUAGE_MAP[extension]) {
    return LANGUAGE_MAP[extension];
  }

  return DEFAULT_LANGUAGE;
};

/**
 * Checks if a language is supported (has a mapping).
 *
 * @param language - Language identifier to check
 * @returns true if language is in the map
 *
 * @example
 * isLanguageSupported('typescript');    // true
 * isLanguageSupported('xyz');           // false
 */
export const isLanguageSupported = (language: string): boolean => {
  const supportedLanguages = new Set(Object.values(LANGUAGE_MAP));
  return supportedLanguages.has(language) || language === DEFAULT_LANGUAGE;
};

/**
 * Gets all extensions that map to a specific language.
 *
 * @param language - Monaco language identifier
 * @returns Array of extensions (without dots)
 *
 * @example
 * getExtensionsForLanguage('typescript');  // ['ts', 'tsx', 'mts', 'cts']
 * getExtensionsForLanguage('python');      // ['py', 'pyw', 'pyi']
 */
export const getExtensionsForLanguage = (language: string): string[] => {
  return Object.entries(LANGUAGE_MAP)
    .filter(([, lang]) => lang === language)
    .map(([ext]) => ext);
};

/**
 * Gets all supported languages (unique language identifiers).
 *
 * @returns Array of unique language identifiers
 *
 * @example
 * const languages = getSupportedLanguages();
 * // ['javascript', 'typescript', 'python', 'java', ...]
 */
export const getSupportedLanguages = (): string[] => {
  return Array.from(new Set(Object.values(LANGUAGE_MAP))).sort();
};

/**
 * Checks if a file extension is recognized.
 *
 * @param extension - Extension to check (with or without dot)
 * @returns true if extension has a language mapping
 *
 * @example
 * isExtensionRecognized('ts');     // true
 * isExtensionRecognized('.ts');    // true
 * isExtensionRecognized('xyz');    // false
 */
export const isExtensionRecognized = (extension: string): boolean => {
  if (!extension) {
    return false;
  }

  const normalized = extension.startsWith('.')
    ? extension.substring(1).toLowerCase()
    : extension.toLowerCase();

  return normalized in LANGUAGE_MAP;
};

/**
 * Gets a human-readable language name from the identifier.
 *
 * @param languageId - Monaco language identifier
 * @returns Human-readable language name
 *
 * @example
 * getLanguageName('typescript');    // 'TypeScript'
 * getLanguageName('python');        // 'Python'
 * getLanguageName('plaintext');     // 'Plain Text'
 */
export const getLanguageName = (languageId: string): string => {
  const nameMap: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    go: 'Go',
    rust: 'Rust',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    kotlin: 'Kotlin',
    scala: 'Scala',
    shell: 'Shell Script',
    html: 'HTML',
    xml: 'XML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'LESS',
    json: 'JSON',
    yaml: 'YAML',
    markdown: 'Markdown',
    sql: 'SQL',
    graphql: 'GraphQL',
    dockerfile: 'Dockerfile',
    makefile: 'Makefile',
    plaintext: 'Plain Text',
    ini: 'INI',
    toml: 'TOML',
    lua: 'Lua',
    perl: 'Perl',
    r: 'R',
    dart: 'Dart',
    elixir: 'Elixir',
    clojure: 'Clojure',
    haskell: 'Haskell',
    'objective-c': 'Objective-C',
    powershell: 'PowerShell',
    bat: 'Batch',
    vb: 'Visual Basic',
    fsharp: 'F#',
    pascal: 'Pascal',
    sol: 'Solidity',
    proto: 'Protocol Buffers',
    terraform: 'Terraform',
    redis: 'Redis',
    handlebars: 'Handlebars',
    pug: 'Pug',
    wasm: 'WebAssembly',
  };

  return nameMap[languageId] || languageId;
};

/**
 * Suggests a file extension for a given language.
 * Returns the most common extension for that language.
 *
 * @param language - Monaco language identifier
 * @returns Suggested extension without dot, or empty string if unknown
 *
 * @example
 * suggestExtension('typescript');    // 'ts'
 * suggestExtension('python');        // 'py'
 * suggestExtension('unknown');       // ''
 */
export const suggestExtension = (language: string): string => {
  const primaryExtensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    go: 'go',
    rust: 'rs',
    ruby: 'rb',
    php: 'php',
    swift: 'swift',
    kotlin: 'kt',
    scala: 'scala',
    shell: 'sh',
    html: 'html',
    xml: 'xml',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    markdown: 'md',
    sql: 'sql',
    graphql: 'graphql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    plaintext: 'txt',
    ini: 'ini',
    toml: 'toml',
    lua: 'lua',
    perl: 'pl',
    r: 'r',
    dart: 'dart',
    elixir: 'ex',
    clojure: 'clj',
    haskell: 'hs',
    'objective-c': 'm',
    powershell: 'ps1',
    bat: 'bat',
    vb: 'vb',
    fsharp: 'fs',
    pascal: 'pas',
    sol: 'sol',
    proto: 'proto',
    terraform: 'tf',
    redis: 'redis',
    handlebars: 'hbs',
    pug: 'pug',
    wasm: 'wat',
  };

  return primaryExtensions[language] || '';
};
