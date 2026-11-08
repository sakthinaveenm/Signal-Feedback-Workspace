export type UpdateStatus = 'disabled' | 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'restarting' | 'error';
export type UpdateState = { status: UpdateStatus; message: string; lastChecked: number | null };
export type UpdateAdapter = {
  check(): Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  download(): Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }>;
  reload(): Promise<void>;
};
/** One shared controller prevents duplicate native calls across the banner,
 * Settings card, first launch, and foreground checks. It never reloads implicitly.
 */
export class UpdateController {
  private state: UpdateState;
  private listeners = new Set<() => void>();
  constructor(private readonly adapter: UpdateAdapter, enabled: boolean, disabledReason = 'Updates are not enabled in this build.') {
    this.state = { status: enabled ? 'idle' : 'disabled', message: enabled ? '' : disabledReason, lastChecked: null };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(next: Partial<UpdateState>) { this.state = { ...this.state, ...next }; for (const listener of this.listeners) listener(); }
  markReady() { if (!['disabled', 'restarting'].includes(this.state.status)) this.set({ status: 'ready', message: '' }); }
  async check() {
    if (!['idle', 'error'].includes(this.state.status)) return;
    this.set({ status: 'checking', message: '' });
    try {
      const result = await this.adapter.check();
      if (this.getSnapshot().status === 'ready') return;
      this.set({ status: result.isAvailable || result.isRollBackToEmbedded ? 'available' : 'idle',
        message: result.isAvailable || result.isRollBackToEmbedded ? '' : 'You’re up to date.', lastChecked: Date.now() });
    } catch {
      if (this.getSnapshot().status !== 'ready') this.set({ status: 'error', message: 'Unable to check for updates. Check your connection and retry.' });
    }
  }
  async download() {
    if (this.state.status !== 'available') return;
    this.set({ status: 'downloading', message: '' });
    try {
      const result = await this.adapter.download();
      if (this.getSnapshot().status === 'ready') return;
      this.set({ status: result.isNew || result.isRollBackToEmbedded ? 'ready' : 'idle',
        message: result.isNew || result.isRollBackToEmbedded ? '' : 'This update is no longer available. Check again later.' });
    } catch {
      if (this.getSnapshot().status !== 'ready') this.set({ status: 'available', message: 'Download failed. Your current app is still available. Tap Download to retry.' });
    }
  }
  async restart() {
    if (this.state.status !== 'ready') return;
    this.set({ status: 'restarting', message: '' });
    try { await this.adapter.reload(); }
    catch { this.set({ status: 'ready', message: 'Could not restart. Try again, or close and reopen the app.' }); }
  }
}
