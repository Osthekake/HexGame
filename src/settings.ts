import { config } from './config';
import type { RendererType, InputType } from './config';

export class SettingsMenu {
  private settingsButton: HTMLElement;
  private settingsMenu: HTMLElement;
  private rendererCanvas2dButton: HTMLElement;
  private rendererThreejsButton: HTMLElement;
  private inputKeyboardButton: HTMLElement;
  private inputGamepadButton: HTMLElement;
  private inputTouchButton: HTMLElement;
  private onRendererChange?: (renderer: RendererType) => void;
  private onInputChange?: (input: InputType) => void;

  constructor(
    onRendererChange?: (renderer: RendererType) => void,
    onInputChange?: (input: InputType) => void
  ) {
    this.onRendererChange = onRendererChange;
    this.onInputChange = onInputChange;

    // Get DOM elements
    this.settingsButton = this.getElement("settings-button");
    this.settingsMenu = this.getElement("settings-menu");
    this.rendererCanvas2dButton = this.getElement("renderer-canvas2d");
    this.rendererThreejsButton = this.getElement("renderer-threejs");
    this.inputKeyboardButton = this.getElement("input-keyboard");
    this.inputGamepadButton = this.getElement("input-gamepad");
    this.inputTouchButton = this.getElement("input-touch");

    this.setupEventListeners();
    this.updateRendererButtonStates();
    this.updateInputButtonStates();
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

    // Input switching
    this.inputKeyboardButton.addEventListener('click', () => {
      this.handleInputSwitch('keyboard');
    });

    this.inputGamepadButton.addEventListener('click', () => {
      this.handleInputSwitch('gamepad');
    });

    this.inputTouchButton.addEventListener('click', () => {
      this.handleInputSwitch('touch');
    });
  }

  private updateRendererButtonStates(): void {
    this.rendererCanvas2dButton.classList.toggle('active', config.renderer === 'canvas2d');
    this.rendererThreejsButton.classList.toggle('active', config.renderer === 'threejs');
  }

  private updateInputButtonStates(): void {
    this.inputKeyboardButton.classList.toggle('active', config.input === 'keyboard');
    this.inputGamepadButton.classList.toggle('active', config.input === 'gamepad');
    this.inputTouchButton.classList.toggle('active', config.input === 'touch');
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

  private handleInputSwitch(input: InputType): void {
    if (config.input !== input) {
      if (this.onInputChange) {
        this.onInputChange(input);
      }
      this.updateInputButtonStates();
      this.settingsMenu.classList.remove('open');
    }
  }
}
