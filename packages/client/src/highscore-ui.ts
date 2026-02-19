import { getScores, submitScore, countryFlag, type ScoreEntry } from './api-client';
import { getNickname, setNickname } from './nickname-store';
import type { GameAction } from '@hexgame/shared';

export class HighscoreUI {
  private overlay: HTMLElement;
  private uploadView: HTMLElement;
  private boardView: HTMLElement;
  private scoreDisplay: HTMLElement;
  private nicknameInput: HTMLInputElement;
  private uploadBtn: HTMLElement;
  private skipBtn: HTMLElement;
  private uploadStatus: HTMLElement;
  private highscoreList: HTMLElement;
  private tabs: HTMLElement[];
  private closeBtn: HTMLElement;

  private currentVariant: 'alltime' | 'today' | 'region' = 'alltime';
  private playerCountry: string = '';
  private lastScore: number = 0;
  private lastActions: GameAction[] = [];
  private lastSessionId: string = '';

  constructor() {
    this.overlay = document.getElementById('highscore-overlay')!;
    this.uploadView = document.getElementById('upload-prompt')!;
    this.boardView = document.getElementById('highscore-board')!;
    this.scoreDisplay = document.getElementById('upload-score-display')!;
    this.nicknameInput = document.getElementById('nickname-input') as HTMLInputElement;
    this.uploadBtn = document.getElementById('upload-score-btn')!;
    this.skipBtn = document.getElementById('skip-upload-btn')!;
    this.uploadStatus = document.getElementById('upload-status')!;
    this.highscoreList = document.getElementById('highscore-list')!;
    this.closeBtn = document.getElementById('close-highscore-btn')!;

    this.tabs = [
      document.getElementById('tab-alltime')!,
      document.getElementById('tab-today')!,
      document.getElementById('tab-region')!,
    ];

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.uploadBtn.addEventListener('click', () => this.handleUpload());
    this.skipBtn.addEventListener('click', () => this.hide());
    this.closeBtn.addEventListener('click', () => this.hide());

    this.tabs[0].addEventListener('click', () => this.switchTab('alltime'));
    this.tabs[1].addEventListener('click', () => this.switchTab('today'));
    this.tabs[2].addEventListener('click', () => this.switchTab('region'));

    // Close on backdrop click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  setPlayerCountry(country: string): void {
    this.playerCountry = country;
  }

  showUploadPrompt(score: number, actions: GameAction[], sessionId: string): void {
    this.lastScore = score;
    this.lastActions = actions;
    this.lastSessionId = sessionId;

    this.scoreDisplay.textContent = String(score);
    this.nicknameInput.value = getNickname();
    this.uploadBtn.textContent = 'Upload Score';
    (this.uploadBtn as HTMLButtonElement).disabled = false;
    this.uploadStatus.textContent = '';
    this.uploadStatus.className = 'highscore-status';

    this.uploadView.style.display = 'block';
    this.boardView.style.display = 'none';
    this.overlay.style.display = 'flex';

    this.nicknameInput.focus();
  }

  async showBoard(): Promise<void> {
    this.uploadView.style.display = 'none';
    this.boardView.style.display = 'block';
    this.overlay.style.display = 'flex';
    await this.loadScores();
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  private async handleUpload(): Promise<void> {
    const nickname = this.nicknameInput.value.trim();
    if (!nickname) {
      this.uploadStatus.textContent = 'Please enter a nickname';
      this.uploadStatus.className = 'highscore-status error';
      return;
    }

    (this.uploadBtn as HTMLButtonElement).disabled = true;
    this.uploadBtn.textContent = 'Uploading...';
    this.uploadStatus.textContent = '';

    try {
      const result = await submitScore({
        sessionId: this.lastSessionId,
        nickname,
        score: this.lastScore,
        actions: this.lastActions,
      });

      if (result.valid) {
        setNickname(nickname);
        this.uploadStatus.textContent = `Score uploaded! Rank: #${result.rank}`;
        this.uploadStatus.className = 'highscore-status success';
        // Auto-switch to board after delay
        setTimeout(() => this.showBoard(), 1500);
      } else {
        this.uploadStatus.textContent = `Score rejected: ${result.reason || result.error || 'Unknown error'}`;
        this.uploadStatus.className = 'highscore-status error';
        (this.uploadBtn as HTMLButtonElement).disabled = false;
        this.uploadBtn.textContent = 'Upload Score';
      }
    } catch {
      this.uploadStatus.textContent = 'Network error. Please try again.';
      this.uploadStatus.className = 'highscore-status error';
      (this.uploadBtn as HTMLButtonElement).disabled = false;
      this.uploadBtn.textContent = 'Upload Score';
    }
  }

  private async switchTab(variant: 'alltime' | 'today' | 'region'): Promise<void> {
    this.currentVariant = variant;

    // Update active tab styling
    const variantIndex = { alltime: 0, today: 1, region: 2 };
    this.tabs.forEach((tab, i) => {
      tab.classList.toggle('active', i === variantIndex[variant]);
    });

    await this.loadScores();
  }

  private async loadScores(): Promise<void> {
    this.highscoreList.innerHTML = '<p class="highscore-loading">Loading...</p>';

    try {
      const country = this.currentVariant === 'region' ? this.playerCountry : undefined;
      const data = await getScores(this.currentVariant, this.lastScore || undefined, country);
      if (this.currentVariant === 'region' && data.country) {
        this.tabs[2].textContent = `My Region ${countryFlag(data.country)}`;
      }
      this.highscoreList.innerHTML = this.renderScoreTable(data.top10, data.around);
    } catch {
      this.highscoreList.innerHTML = '<p class="highscore-error">Failed to load scores</p>';
    }
  }

  private renderScoreTable(top10: ScoreEntry[], around: ScoreEntry[]): string {
    if (top10.length === 0 && around.length === 0) {
      return '<p class="highscore-empty">No scores yet</p>';
    }

    let html = '<table class="highscore-table"><thead><tr><th>#</th><th>Name</th><th>Country</th><th>Score</th></tr></thead><tbody>';

    for (const entry of top10) {
      html += this.renderRow(entry);
    }

    if (around.length > 0) {
      html += '<tr class="separator"><td colspan="4">...</td></tr>';
      for (const entry of around) {
        html += this.renderRow(entry);
      }
    }

    html += '</tbody></table>';
    return html;
  }

  private renderRow(entry: ScoreEntry): string {
    const isHighlighted = entry.score === this.lastScore && this.lastScore > 0;
    const cls = isHighlighted ? ' class="highlighted"' : '';
    return `<tr${cls}><td>${entry.rank}</td><td>${this.escapeHtml(entry.nickname)}</td><td>${this.escapeHtml(entry.country)}</td><td>${entry.score}</td></tr>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
