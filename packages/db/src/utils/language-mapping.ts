/**
 * Maps file extensions to language hints for syntax highlighting
 */

const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mjs: 'javascript',
  cjs: 'javascript',

  // Python
  py: 'python',
  pyw: 'python',
  pyi: 'python',

  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',

  // Java/Kotlin
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',

  // C/C++
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cxx: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',

  // C#
  cs: 'csharp',

  // Go
  go: 'go',

  // Rust
  rs: 'rust',

  // Ruby
  rb: 'ruby',

  // PHP
  php: 'php',

  // Shell
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',

  // SQL
  sql: 'sql',

  // JSON/YAML/TOML
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',

  // Markdown
  md: 'markdown',
  markdown: 'markdown',

  // XML
  xml: 'xml',

  // Other
  dockerfile: 'dockerfile',
  swift: 'swift',
  r: 'r',
  lua: 'lua',
};

/**
 * Get language hint from file extension
 */
export function getLanguageFromExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return null;
  }

  const extension = filename.slice(lastDot + 1).toLowerCase();
  return LANGUAGE_MAP[extension] || null;
}

/**
 * Get all supported extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(LANGUAGE_MAP);
}

/**
 * Check if extension is supported
 */
export function isExtensionSupported(extension: string): boolean {
  return extension.toLowerCase() in LANGUAGE_MAP;
}
