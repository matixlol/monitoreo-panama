export const MODELS = {
  'gemini-3-flash': {
    id: 'gemini-3-flash',
    openrouterId: 'google/gemini-3-flash-preview',
    geminiId: 'gemini-3-flash-preview',
  },
  'gemini-3-pro': {
    id: 'gemini-3-pro',
    openrouterId: 'google/gemini-3-pro-preview',
    geminiId: 'gemini-3-pro-preview',
  },
} as const;

export type ModelKey = keyof typeof MODELS;

export const DEFAULT_MODEL: ModelKey = 'gemini-3-flash';

export function getModel(key?: ModelKey): (typeof MODELS)[ModelKey] {
  return MODELS[key ?? DEFAULT_MODEL];
}
