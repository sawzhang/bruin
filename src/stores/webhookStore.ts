import { create } from "zustand";
import type { Webhook, WebhookLog } from "../types/webhook";
import * as tauri from "../lib/tauri";

interface WebhookState {
  webhooks: Webhook[];
  logs: WebhookLog[];
  selectedWebhookId: string | null;
  isLoading: boolean;
  loadWebhooks: () => Promise<void>;
  loadLogs: (webhookId: string) => Promise<void>;
  registerWebhook: (url: string, eventTypes: string[], secret: string) => Promise<Webhook>;
  updateWebhook: (id: string, url?: string, eventTypes?: string[], isActive?: boolean) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  testWebhook: (id: string) => Promise<WebhookLog>;
  setSelectedWebhookId: (id: string | null) => void;
}

export const useWebhookStore = create<WebhookState>((set, get) => ({
  webhooks: [],
  logs: [],
  selectedWebhookId: null,
  isLoading: false,

  loadWebhooks: async () => {
    set({ isLoading: true });
    try {
      const webhooks = await tauri.listWebhooks();
      set({ webhooks });
    } finally {
      set({ isLoading: false });
    }
  },

  loadLogs: async (webhookId) => {
    const logs = await tauri.getWebhookLogs(webhookId);
    set({ logs });
  },

  registerWebhook: async (url, eventTypes, secret) => {
    const webhook = await tauri.registerWebhook(url, eventTypes, secret);
    set({ webhooks: [webhook, ...get().webhooks] });
    return webhook;
  },

  updateWebhook: async (id, url, eventTypes, isActive) => {
    const updated = await tauri.updateWebhook(id, url, eventTypes, isActive);
    set({ webhooks: get().webhooks.map((w) => (w.id === id ? updated : w)) });
  },

  deleteWebhook: async (id) => {
    await tauri.deleteWebhook(id);
    set({ webhooks: get().webhooks.filter((w) => w.id !== id) });
  },

  testWebhook: async (id) => {
    const log = await tauri.testWebhook(id);
    set({ logs: [log, ...get().logs] });
    return log;
  },

  setSelectedWebhookId: (id) => set({ selectedWebhookId: id }),
}));
