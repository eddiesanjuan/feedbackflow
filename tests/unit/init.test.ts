/**
 * Init Command Unit Tests
 *
 * Tests the project initialization functionality:
 * - Config file creation with defaults
 * - Skipping when config already exists
 * - Force overwrite
 * - .gitignore update
 * - Custom output directory
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Hoisted mocks
// ============================================================================

const {
  mockExistsSync,
  mockReadFile,
  mockWriteFile,
  mockAppendFile,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockAppendFile: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
}));

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  appendFile: mockAppendFile,
}));

// ============================================================================
// Import module under test (after mocks)
// ============================================================================

import {
  runInit,
  updateGitignore,
  createDefaultConfig,
  CONFIG_FILENAME,
  type InitOptions,
  type MarkuprConfig,
} from '../../src/cli/init';

// ============================================================================
// Helpers
// ============================================================================

function makeInitOptions(overrides: Partial<InitOptions> = {}): InitOptions {
  return {
    directory: '/test/project',
    outputDir: './markupr-output',
    skipGitignore: false,
    force: false,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('init', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockAppendFile.mockReset();
  });

  // --------------------------------------------------------------------------
  // CONFIG_FILENAME constant
  // --------------------------------------------------------------------------

  describe('CONFIG_FILENAME', () => {
    it('is .markupr.json', () => {
      expect(CONFIG_FILENAME).toBe('.markupr.json');
    });
  });

  // --------------------------------------------------------------------------
  // createDefaultConfig
  // --------------------------------------------------------------------------

  describe('createDefaultConfig', () => {
    it('returns config with correct output dir', () => {
      const config = createDefaultConfig('./my-output');
      expect(config.outputDir).toBe('./my-output');
    });

    it('uses markdown as default template', () => {
      const config = createDefaultConfig('./output');
      expect(config.recording.template).toBe('markdown');
    });

    it('does not skip frames by default', () => {
      const config = createDefaultConfig('./output');
      expect(config.recording.skipFrames).toBe(false);
    });

    it('references standard env var names for API keys', () => {
      const config = createDefaultConfig('./output');
      expect(config.apiKeys.anthropic).toBe('ANTHROPIC_API_KEY');
      expect(config.apiKeys.openai).toBe('OPENAI_API_KEY');
    });
  });

  // --------------------------------------------------------------------------
  // runInit - config creation
  // --------------------------------------------------------------------------

  describe('runInit', () => {
    it('creates config file with defaults', async () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFile.mockResolvedValue(undefined);
      mockAppendFile.mockResolvedValue(undefined);

      const result = await runInit(makeInitOptions());

      expect(result.created).toBe(true);
      expect(result.alreadyExists).toBe(false);
      expect(result.configPath).toContain(CONFIG_FILENAME);

      // Verify writeFile was called with valid JSON
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent) as MarkuprConfig;
      expect(parsed.outputDir).toBe('./markupr-output');
      expect(parsed.recording).toBeDefined();
      expect(parsed.apiKeys).toBeDefined();
    });

    it('skips creation when config already exists', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes(CONFIG_FILENAME)) return true;
        return false;
      });

      const result = await runInit(makeInitOptions());

      expect(result.created).toBe(false);
      expect(result.alreadyExists).toBe(true);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('overwrites config when --force is used', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes(CONFIG_FILENAME)) return true;
        return false;
      });
      mockWriteFile.mockResolvedValue(undefined);
      mockAppendFile.mockResolvedValue(undefined);

      const result = await runInit(makeInitOptions({ force: true }));

      expect(result.created).toBe(true);
      expect(result.alreadyExists).toBe(false);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('uses custom output directory', async () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFile.mockResolvedValue(undefined);
      mockAppendFile.mockResolvedValue(undefined);

      await runInit(makeInitOptions({ outputDir: './custom-output' }));

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent) as MarkuprConfig;
      expect(parsed.outputDir).toBe('./custom-output');
    });

    it('skips .gitignore when option is set', async () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await runInit(makeInitOptions({ skipGitignore: true }));

      expect(result.gitignoreUpdated).toBe(false);
      expect(mockAppendFile).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // updateGitignore
  // --------------------------------------------------------------------------

  describe('updateGitignore', () => {
    it('creates .gitignore entries when file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockReadFile.mockResolvedValue('');
      mockAppendFile.mockResolvedValue(undefined);

      const updated = await updateGitignore('/test/project', './markupr-output');

      expect(updated).toBe(true);
      expect(mockAppendFile).toHaveBeenCalledTimes(1);
      const appended = mockAppendFile.mock.calls[0][1] as string;
      expect(appended).toContain('./markupr-output');
      expect(appended).toContain('.markupr-watch.log');
      expect(appended).toContain('# markupr output');
    });

    it('appends to existing .gitignore', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('node_modules\n.env\n');
      mockAppendFile.mockResolvedValue(undefined);

      const updated = await updateGitignore('/test/project', './markupr-output');

      expect(updated).toBe(true);
      const appended = mockAppendFile.mock.calls[0][1] as string;
      expect(appended).toContain('./markupr-output');
    });

    it('skips if entries already exist in .gitignore', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(
        'node_modules\n./markupr-output\n.markupr-watch.log\n',
      );

      const updated = await updateGitignore('/test/project', './markupr-output');

      expect(updated).toBe(false);
      expect(mockAppendFile).not.toHaveBeenCalled();
    });

    it('only adds missing entries', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('node_modules\n./markupr-output\n');
      mockAppendFile.mockResolvedValue(undefined);

      const updated = await updateGitignore('/test/project', './markupr-output');

      expect(updated).toBe(true);
      const appended = mockAppendFile.mock.calls[0][1] as string;
      // Should only add the missing .markupr-watch.log entry
      expect(appended).toContain('.markupr-watch.log');
      expect(appended).not.toContain('./markupr-output');
    });
  });
});
