import { normalizeExternalUrl } from './domain.js';

export const CREATOR_CONFIG_STORAGE_KEY = 'bluedia-creator-config-v1';

export const DEFAULT_CREATOR_CONFIG = {
  dataMode: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  googleSheetsWebhookUrl: '',
};

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function cleanConfig(config = {}) {
  const supabaseUrl = String(config.supabaseUrl || '').trim();
  const googleSheetsWebhookUrl = String(config.googleSheetsWebhookUrl || '').trim();

  return {
    dataMode: String(config.dataMode || '').trim(),
    supabaseUrl: supabaseUrl ? normalizeExternalUrl(supabaseUrl) : '',
    supabaseAnonKey: String(config.supabaseAnonKey || '').trim(),
    googleSheetsWebhookUrl: googleSheetsWebhookUrl
      ? normalizeExternalUrl(googleSheetsWebhookUrl)
      : '',
  };
}

export function loadCreatorConfig() {
  if (!canUseStorage()) return { ...DEFAULT_CREATOR_CONFIG };

  try {
    return {
      ...DEFAULT_CREATOR_CONFIG,
      ...JSON.parse(window.localStorage.getItem(CREATOR_CONFIG_STORAGE_KEY) || '{}'),
    };
  } catch {
    return { ...DEFAULT_CREATOR_CONFIG };
  }
}

export function saveCreatorConfig(config) {
  const cleaned = cleanConfig(config);
  if (canUseStorage()) {
    window.localStorage.setItem(CREATOR_CONFIG_STORAGE_KEY, JSON.stringify(cleaned));
  }
  return cleaned;
}

export function clearCreatorConfig() {
  if (canUseStorage()) {
    window.localStorage.removeItem(CREATOR_CONFIG_STORAGE_KEY);
  }
  return getResolvedAppConfig();
}

export function getResolvedAppConfig() {
  const saved = cleanConfig(loadCreatorConfig());
  const env = {
    dataMode: import.meta.env.VITE_DATA_MODE || '',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    googleSheetsWebhookUrl: import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL || '',
  };

  return cleanConfig({
    dataMode: saved.dataMode || env.dataMode,
    supabaseUrl: saved.supabaseUrl || env.supabaseUrl,
    supabaseAnonKey: saved.supabaseAnonKey || env.supabaseAnonKey,
    googleSheetsWebhookUrl:
      saved.googleSheetsWebhookUrl || env.googleSheetsWebhookUrl,
  });
}
