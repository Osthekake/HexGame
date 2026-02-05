import type { RendererType, InputType } from './config';

interface Umami {
  track(event: string, data?: Record<string, string | number>): void;
}

declare global {
  interface Window {
    umami?: Umami;
  }
}

function track(event: string, data?: Record<string, string | number>): void {
  window.umami?.track(event, data);
}

export function trackSettingsRenderer(renderer: RendererType): void {
  track('settings-renderer', { renderer });
}

export function trackSettingsInput(input: InputType): void {
  track('settings-input', { input });
}

export function trackGameStart(): void {
  track('game-start');
}

export function trackGameOver(score: number): void {
  track('game-over', { score });
}
