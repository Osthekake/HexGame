export class HighScore {
  private list: number[] | undefined;
  private renderTarget: HTMLElement;

  constructor(private enabled: boolean) {
    this.renderTarget = document.getElementById("highscore") as HTMLElement;
    if (!this.renderTarget ) {
      console.warn("Highscore element not found");
    }
    this.loadFromStorage();
    this.render();
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem("highscore");
    if (stored && stored !== "undefined") {
      try {
        this.list = JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing highscore from localStorage", e);
        this.list = undefined;
      }
    }
  }

  private makeHTML(): string {
    if (!this.list) {
      this.list = [];
      this.list.length = 10;
    }
    let html = "<ol>";
    for (let i = 0; i < this.list.length; i++) {
      if (this.list[i])
        html += "<li>" + this.list[i] + "</li>";
      else
        html += "<li> --- </li>";
    }
    return html + "</ol>";
  }

  enter(entry: number): void {
    if (!this.list)
      this.list = [];
    const free = this.list.indexOf(undefined as any);
    if (free > 0)
      this.list[free] = entry;
    else {
      this.list.push(entry);
      this.list.sort((a, b) => b - a);
      this.list.splice(10, 1);
    }
    localStorage.setItem("highscore", JSON.stringify(this.list));
    this.render();
  }

  render(): void {
    if(this.enabled)
      this.renderTarget.innerHTML = this.makeHTML();
  }

  clear(): void {
    console.log("Clearing high score.");
    localStorage.setItem('highscore', 'undefined');
    this.list = undefined;
    this.render();
  }
}
