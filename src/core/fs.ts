import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import type { DiagnosticFs } from '../types/index.js';

/**
 * Real filesystem implementation of {@link DiagnosticFs}.
 *
 * Every method swallows errors and returns a safe default so plugins never
 * have to wrap filesystem access in try/catch. Tests substitute an in-memory
 * implementation of the same interface.
 */
export const realFs: DiagnosticFs = {
  exists(path) {
    try {
      return existsSync(path);
    } catch {
      return false;
    }
  },
  readFile(path) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  },
  readDir(path) {
    try {
      return readdirSync(path);
    } catch {
      return null;
    }
  },
  isDirectory(path) {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  },
  canAccess(path) {
    try {
      accessSync(path, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  },
};
