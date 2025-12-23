import { config } from './config';
import type { RendererType } from './config';

export class SettingsMenu {
  private settingsButton: HTMLElement;
  private settingsMenu: HTMLElement;
  private rendererCanvas2dButton: HTMLElement;
  private rendererThreejsButton: HTMLElement;
  private onRendererChange?: (renderer: RendererType) => void;

  constructor(onRendererChange?: (renderer: RendererType) => void) {
    this.onRendererChange = onRendererChange;

    // Get DOM elements
    this.settingsButton = this.getElement("settings-button");
    this.settingsMenu = this.getElement("settings-menu");
    this.rendererCanvas2dButton = this.getElement("renderer-canvas2d");
    this.rendererThreejsButton = this.getElement("renderer-threejs");

    this.setupEventListeners();
    this.updateRendererButtonStates();
  }

  private getElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id '${id}' not found`);
    }
    return element;
  }

  private setupEventListeners(): void {
    // Settings menu toggle
    this.settingsButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.settingsMenu.classList.toggle('open');
    });

    // Close settings menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.settingsMenu.contains(e.target as Node) && e.target !== this.settingsButton) {
        this.settingsMenu.classList.remove('open');
      }
    });

    // Renderer switching
    this.rendererCanvas2dButton.addEventListener('click', () => {
      this.handleRendererSwitch('canvas2d');
    });

    this.rendererThreejsButton.addEventListener('click', () => {
      this.handleRendererSwitch('threejs');
    });
  }

  private updateRendererButtonStates(): void {
    this.rendererCanvas2dButton.classList.toggle('active', config.renderer === 'canvas2d');
    this.rendererThreejsButton.classList.toggle('active', config.renderer === 'threejs');
  }

  private handleRendererSwitch(renderer: RendererType): void {
    if (config.renderer !== renderer) {
      if (this.onRendererChange) {
        this.onRendererChange(renderer);
      }
      this.updateRendererButtonStates();
      this.settingsMenu.classList.remove('open');
    }
  }
}
