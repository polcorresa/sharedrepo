import { describe, it, expect } from 'vitest';
import {
  LANGUAGE_MAP,
  SPECIAL_FILENAMES,
  DEFAULT_LANGUAGE,
  getFileExtension,
  detectLanguage,
  isLanguageSupported,
  getExtensionsForLanguage,
  getSupportedLanguages,
  isExtensionRecognized,
  getLanguageName,
  suggestExtension,
} from './language.js';

describe('Language Detection Utilities', () => {
  describe('getFileExtension', () => {
    it('extracts extension from simple filename', () => {
      expect(getFileExtension('index.ts')).toBe('ts');
      expect(getFileExtension('app.js')).toBe('js');
      expect(getFileExtension('styles.css')).toBe('css');
    });

    it('handles files with multiple dots', () => {
      expect(getFileExtension('app.min.js')).toBe('js');
      expect(getFileExtension('jquery.3.6.0.js')).toBe('js');
      expect(getFileExtension('tsconfig.base.json')).toBe('json');
    });

    it('handles files without extension', () => {
      expect(getFileExtension('Dockerfile')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
      expect(getFileExtension('README')).toBe('');
    });

    it('handles dotfiles as having extension', () => {
      expect(getFileExtension('.gitignore')).toBe('gitignore');
      expect(getFileExtension('.env')).toBe('env');
      expect(getFileExtension('.npmrc')).toBe('npmrc');
    });

    it('returns lowercase extension', () => {
      expect(getFileExtension('App.TS')).toBe('ts');
      expect(getFileExtension('Index.JSX')).toBe('jsx');
    });

    it('handles edge cases', () => {
      expect(getFileExtension('')).toBe('');
      expect(getFileExtension('   ')).toBe('');
      expect(getFileExtension('file.')).toBe('');
      expect(getFileExtension('.')).toBe('');
      expect(getFileExtension('..')).toBe('');
    });

    it('trims whitespace', () => {
      expect(getFileExtension('  index.ts  ')).toBe('ts');
    });
  });

  describe('detectLanguage', () => {
    describe('by extension', () => {
      it('detects JavaScript variants', () => {
        expect(detectLanguage('index.js')).toBe('javascript');
        expect(detectLanguage('app.jsx')).toBe('javascript');
        expect(detectLanguage('module.mjs')).toBe('javascript');
        expect(detectLanguage('common.cjs')).toBe('javascript');
      });

      it('detects TypeScript variants', () => {
        expect(detectLanguage('index.ts')).toBe('typescript');
        expect(detectLanguage('Component.tsx')).toBe('typescript');
        expect(detectLanguage('module.mts')).toBe('typescript');
        expect(detectLanguage('common.cts')).toBe('typescript');
      });

      it('detects Python', () => {
        expect(detectLanguage('script.py')).toBe('python');
        expect(detectLanguage('app.pyw')).toBe('python');
        expect(detectLanguage('types.pyi')).toBe('python');
      });

      it('detects Java', () => {
        expect(detectLanguage('Main.java')).toBe('java');
      });

      it('detects C/C++', () => {
        expect(detectLanguage('main.c')).toBe('c');
        expect(detectLanguage('header.h')).toBe('c');
        expect(detectLanguage('app.cpp')).toBe('cpp');
        expect(detectLanguage('impl.cc')).toBe('cpp');
        expect(detectLanguage('code.cxx')).toBe('cpp');
        expect(detectLanguage('header.hpp')).toBe('cpp');
      });

      it('detects other languages', () => {
        expect(detectLanguage('app.cs')).toBe('csharp');
        expect(detectLanguage('main.go')).toBe('go');
        expect(detectLanguage('lib.rs')).toBe('rust');
        expect(detectLanguage('app.rb')).toBe('ruby');
        expect(detectLanguage('index.php')).toBe('php');
      });

      it('detects web languages', () => {
        expect(detectLanguage('index.html')).toBe('html');
        expect(detectLanguage('styles.css')).toBe('css');
        expect(detectLanguage('theme.scss')).toBe('scss');
        expect(detectLanguage('vars.less')).toBe('less');
        expect(detectLanguage('data.xml')).toBe('xml');
        expect(detectLanguage('icon.svg')).toBe('xml');
      });

      it('detects data formats', () => {
        expect(detectLanguage('config.json')).toBe('json');
        expect(detectLanguage('data.yaml')).toBe('yaml');
        expect(detectLanguage('settings.yml')).toBe('yaml');
      });

      it('detects markdown', () => {
        expect(detectLanguage('README.md')).toBe('markdown');
        expect(detectLanguage('docs.markdown')).toBe('markdown');
      });

      it('detects shell scripts', () => {
        expect(detectLanguage('script.sh')).toBe('shell');
        expect(detectLanguage('deploy.bash')).toBe('shell');
        expect(detectLanguage('config.zsh')).toBe('shell');
      });

      it('detects SQL and GraphQL', () => {
        expect(detectLanguage('query.sql')).toBe('sql');
        expect(detectLanguage('schema.graphql')).toBe('graphql');
        expect(detectLanguage('query.gql')).toBe('graphql');
      });

      it('handles case-insensitive extensions', () => {
        expect(detectLanguage('App.TS')).toBe('typescript');
        expect(detectLanguage('Index.JSX')).toBe('javascript');
      });
    });

    describe('by special filename', () => {
      it('detects Dockerfile', () => {
        expect(detectLanguage('Dockerfile')).toBe('dockerfile');
        expect(detectLanguage('Dockerfile.dev')).toBe('dockerfile');
        expect(detectLanguage('Dockerfile.prod')).toBe('dockerfile');
      });

      it('detects Makefile', () => {
        expect(detectLanguage('Makefile')).toBe('makefile');
        expect(detectLanguage('makefile')).toBe('makefile');
        expect(detectLanguage('GNUmakefile')).toBe('makefile');
      });

      it('detects config files', () => {
        expect(detectLanguage('.gitignore')).toBe('plaintext');
        expect(detectLanguage('.env')).toBe('plaintext');
        expect(detectLanguage('.editorconfig')).toBe('ini');
        expect(detectLanguage('.npmrc')).toBe('ini');
      });

      it('detects JSON config files', () => {
        expect(detectLanguage('package.json')).toBe('json');
        expect(detectLanguage('tsconfig.json')).toBe('json');
        expect(detectLanguage('.eslintrc.json')).toBe('json');
        expect(detectLanguage('.prettierrc.json')).toBe('json');
      });

      it('detects JS config files', () => {
        expect(detectLanguage('.eslintrc.js')).toBe('javascript');
        expect(detectLanguage('webpack.config.js')).toBe('javascript');
        expect(detectLanguage('vite.config.js')).toBe('javascript');
      });

      it('detects TypeScript config files', () => {
        expect(detectLanguage('vite.config.ts')).toBe('typescript');
      });

      it('detects README files', () => {
        expect(detectLanguage('README')).toBe('markdown');
        expect(detectLanguage('README.md')).toBe('markdown');
        expect(detectLanguage('readme.md')).toBe('markdown');
      });

      it('handles case-insensitive special filenames', () => {
        expect(detectLanguage('dockerfile')).toBe('dockerfile');
        expect(detectLanguage('MAKEFILE')).toBe('makefile');
      });
    });

    describe('fallback behavior', () => {
      it('returns plaintext for unknown extensions', () => {
        expect(detectLanguage('file.xyz')).toBe('plaintext');
        expect(detectLanguage('unknown.abc123')).toBe('plaintext');
      });

      it('returns plaintext for empty input', () => {
        expect(detectLanguage('')).toBe('plaintext');
        expect(detectLanguage('   ')).toBe('plaintext');
      });

      it('returns plaintext for files without extension', () => {
        expect(detectLanguage('LICENSE')).toBe('plaintext');
        expect(detectLanguage('CHANGELOG')).toBe('plaintext');
      });
    });
  });

  describe('isLanguageSupported', () => {
    it('returns true for supported languages', () => {
      expect(isLanguageSupported('typescript')).toBe(true);
      expect(isLanguageSupported('javascript')).toBe(true);
      expect(isLanguageSupported('python')).toBe(true);
      expect(isLanguageSupported('plaintext')).toBe(true);
    });

    it('returns false for unsupported languages', () => {
      expect(isLanguageSupported('unknown')).toBe(false);
      expect(isLanguageSupported('xyz')).toBe(false);
    });
  });

  describe('getExtensionsForLanguage', () => {
    it('returns all extensions for TypeScript', () => {
      const extensions = getExtensionsForLanguage('typescript');
      expect(extensions).toContain('ts');
      expect(extensions).toContain('tsx');
      expect(extensions).toContain('mts');
      expect(extensions).toContain('cts');
      expect(extensions.length).toBe(4);
    });

    it('returns all extensions for JavaScript', () => {
      const extensions = getExtensionsForLanguage('javascript');
      expect(extensions).toContain('js');
      expect(extensions).toContain('jsx');
      expect(extensions).toContain('mjs');
      expect(extensions).toContain('cjs');
      expect(extensions.length).toBe(4);
    });

    it('returns all extensions for Python', () => {
      const extensions = getExtensionsForLanguage('python');
      expect(extensions).toEqual(['py', 'pyw', 'pyi']);
    });

    it('returns empty array for unknown language', () => {
      expect(getExtensionsForLanguage('unknown')).toEqual([]);
    });
  });

  describe('getSupportedLanguages', () => {
    it('returns array of unique languages', () => {
      const languages = getSupportedLanguages();
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages.length).toBeGreaterThan(20);
    });

    it('returns sorted array', () => {
      const languages = getSupportedLanguages();
      const sorted = [...languages].sort();
      expect(languages).toEqual(sorted);
    });

    it('has no duplicates', () => {
      const languages = getSupportedLanguages();
      const unique = Array.from(new Set(languages));
      expect(languages.length).toBe(unique.length);
    });
  });

  describe('isExtensionRecognized', () => {
    it('returns true for recognized extensions', () => {
      expect(isExtensionRecognized('ts')).toBe(true);
      expect(isExtensionRecognized('js')).toBe(true);
      expect(isExtensionRecognized('py')).toBe(true);
    });

    it('handles extensions with dot', () => {
      expect(isExtensionRecognized('.ts')).toBe(true);
      expect(isExtensionRecognized('.js')).toBe(true);
    });

    it('handles case-insensitive', () => {
      expect(isExtensionRecognized('TS')).toBe(true);
      expect(isExtensionRecognized('JS')).toBe(true);
    });

    it('returns false for unrecognized extensions', () => {
      expect(isExtensionRecognized('xyz')).toBe(false);
      expect(isExtensionRecognized('unknown')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isExtensionRecognized('')).toBe(false);
    });
  });

  describe('getLanguageName', () => {
    it('returns human-readable names', () => {
      expect(getLanguageName('typescript')).toBe('TypeScript');
      expect(getLanguageName('javascript')).toBe('JavaScript');
      expect(getLanguageName('python')).toBe('Python');
      expect(getLanguageName('cpp')).toBe('C++');
      expect(getLanguageName('csharp')).toBe('C#');
      expect(getLanguageName('fsharp')).toBe('F#');
    });

    it('handles special cases', () => {
      expect(getLanguageName('plaintext')).toBe('Plain Text');
      expect(getLanguageName('shell')).toBe('Shell Script');
      expect(getLanguageName('objective-c')).toBe('Objective-C');
    });

    it('returns input for unknown languages', () => {
      expect(getLanguageName('unknown')).toBe('unknown');
    });
  });

  describe('suggestExtension', () => {
    it('suggests primary extension for language', () => {
      expect(suggestExtension('typescript')).toBe('ts');
      expect(suggestExtension('javascript')).toBe('js');
      expect(suggestExtension('python')).toBe('py');
      expect(suggestExtension('java')).toBe('java');
    });

    it('suggests common extensions', () => {
      expect(suggestExtension('html')).toBe('html');
      expect(suggestExtension('css')).toBe('css');
      expect(suggestExtension('json')).toBe('json');
      expect(suggestExtension('markdown')).toBe('md');
    });

    it('returns empty string for unknown language', () => {
      expect(suggestExtension('unknown')).toBe('');
    });
  });

  describe('LANGUAGE_MAP constant', () => {
    it('is exported and accessible', () => {
      expect(LANGUAGE_MAP).toBeDefined();
      expect(typeof LANGUAGE_MAP).toBe('object');
    });

    it('contains expected mappings', () => {
      expect(LANGUAGE_MAP.ts).toBe('typescript');
      expect(LANGUAGE_MAP.js).toBe('javascript');
      expect(LANGUAGE_MAP.py).toBe('python');
    });
  });

  describe('SPECIAL_FILENAMES constant', () => {
    it('is exported and accessible', () => {
      expect(SPECIAL_FILENAMES).toBeDefined();
      expect(typeof SPECIAL_FILENAMES).toBe('object');
    });

    it('contains expected mappings', () => {
      expect(SPECIAL_FILENAMES.Dockerfile).toBe('dockerfile');
      expect(SPECIAL_FILENAMES.Makefile).toBe('makefile');
      expect(SPECIAL_FILENAMES['package.json']).toBe('json');
    });
  });

  describe('DEFAULT_LANGUAGE constant', () => {
    it('is exported and equals plaintext', () => {
      expect(DEFAULT_LANGUAGE).toBe('plaintext');
    });
  });

  describe('Real-world filename scenarios', () => {
    it('handles common project files', () => {
      expect(detectLanguage('index.tsx')).toBe('typescript');
      expect(detectLanguage('App.jsx')).toBe('javascript');
      expect(detectLanguage('styles.module.css')).toBe('css');
      expect(detectLanguage('utils.test.ts')).toBe('typescript');
      expect(detectLanguage('component.stories.tsx')).toBe('typescript');
    });

    it('handles config files', () => {
      expect(detectLanguage('.eslintrc.json')).toBe('json');
      expect(detectLanguage('tsconfig.json')).toBe('json');
      expect(detectLanguage('package.json')).toBe('json');
      expect(detectLanguage('docker-compose.yml')).toBe('yaml');
    });

    it('handles build files', () => {
      expect(detectLanguage('webpack.config.js')).toBe('javascript');
      expect(detectLanguage('vite.config.ts')).toBe('typescript');
      expect(detectLanguage('rollup.config.js')).toBe('javascript');
    });

    it('handles backend files', () => {
      expect(detectLanguage('server.ts')).toBe('typescript');
      expect(detectLanguage('routes.py')).toBe('python');
      expect(detectLanguage('Main.java')).toBe('java');
      expect(detectLanguage('main.go')).toBe('go');
    });

    it('handles documentation', () => {
      expect(detectLanguage('README.md')).toBe('markdown');
      expect(detectLanguage('CHANGELOG.md')).toBe('markdown');
      expect(detectLanguage('docs/guide.md')).toBe('markdown');
    });

    it('handles database and query files', () => {
      expect(detectLanguage('schema.sql')).toBe('sql');
      expect(detectLanguage('queries.graphql')).toBe('graphql');
    });
  });

  describe('Integration tests', () => {
    it('roundtrip: detect language and suggest extension', () => {
      const filename = 'index.ts';
      const language = detectLanguage(filename);
      const extension = suggestExtension(language);

      expect(language).toBe('typescript');
      expect(extension).toBe('ts');
    });

    it('get extensions then verify each is recognized', () => {
      const extensions = getExtensionsForLanguage('typescript');

      extensions.forEach((ext) => {
        expect(isExtensionRecognized(ext)).toBe(true);
      });
    });

    it('all supported languages are valid', () => {
      const languages = getSupportedLanguages();

      languages.forEach((lang) => {
        expect(isLanguageSupported(lang)).toBe(true);
      });
    });

    it('all mapped extensions produce supported languages', () => {
      Object.entries(LANGUAGE_MAP).forEach(([ext, lang]) => {
        expect(isLanguageSupported(lang)).toBe(true);
        expect(isExtensionRecognized(ext)).toBe(true);
      });
    });
  });
});
