import { createLocalRepository } from './localRepository.js';
import {
  canUseSupabaseRpc,
  createSupabaseRpcRepository,
} from './supabaseRpcClient.js';
import {
  sendGoogleSheetsBackup,
  shouldBackUpAction,
} from './googleSheetsBackup.js';

export function createRepository() {
  const localRepository = createLocalRepository();
  let supabaseRepository = null;

  function activeRepository() {
    if (canUseSupabaseRpc()) {
      supabaseRepository ||= createSupabaseRpcRepository();
      return supabaseRepository;
    }

    return localRepository;
  }

  return new Proxy(
    {},
    {
      get(_target, prop) {
        const repository = activeRepository();
        const value = repository[prop];

        if (typeof value !== 'function') return value;

        return async (...args) => {
          const result = await value.apply(repository, args);
          if (shouldBackUpAction(prop)) {
            sendGoogleSheetsBackup(prop, args[0] || {}, result, repository.mode);
          }
          return result;
        };
      },
    },
  );
}
