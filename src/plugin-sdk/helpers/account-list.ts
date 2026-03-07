// ============================================================
// 🦀 Krab — Plugin SDK: Account List Helpers
// ============================================================
import type { ChannelAccountState, ChannelAccountSnapshot } from "../types/core.js";

export function createAccountListHelpers(getAccounts: () => ChannelAccountState[]) {
  return {
    getAccount(id: string): ChannelAccountState | undefined {
      return getAccounts().find((a) => a.id === id);
    },
    
    getAccountsByUsername(username: string): ChannelAccountState[] {
      return getAccounts().filter((a) => a.username === username);
    },
    
    getSnapshot(): ChannelAccountSnapshot {
      return {
        channelId: "",
        accounts: getAccounts(),
        timestamp: new Date(),
      };
    },
    
    isBot(id: string): boolean {
      const account = getAccounts().find((a) => a.id === id);
      return account?.isBot ?? false;
    },
  };
}
