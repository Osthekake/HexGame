export interface ProgressBar {
  render(percentage: number): void;
}

export interface GameTimer {
  hold(howlong: number): void;
  addTime(time: number): void;
  startIfNotRunning(onStop: () => void): void;
  isRunning(): boolean;
}

export class Timer implements GameTimer {
  private increment: number;
  private maxTime: number;
  time: number;
  private lastTime: number = -1;
  private helduntil: number = 0;
  private id: number | undefined;
  private bar: ProgressBar;
  private onStop: (() => void) | undefined;

  constructor(bar: ProgressBar, maxTime: number = 30000, increment: number = 1000) {
    this.bar = bar;
    this.maxTime = maxTime;
    this.time = maxTime;
    this.increment = increment;
  }

  hold(howlong: number): void {
    const now = new Date().getTime();
    if (this.helduntil < now)
      this.helduntil = now + howlong;
    else
      this.helduntil += howlong;
    this.addTime(howlong);
  }

  private tick(): void {
    const newTime = new Date().getTime();
    const delta = newTime - this.lastTime;
    this.lastTime = newTime;
    this.time -= delta;

    if (this.time <= 0) {
      this.stop();
      if (this.onStop)
        this.onStop();
    }
    if (this.bar && this.helduntil < newTime)
      this.bar.render(Math.round(this.time / this.maxTime * 100));
    else
      console.log("timer held for another " + (this.helduntil - newTime));
  }

  start(onStop: () => void): void {
    this.time = this.maxTime;
    this.onStop = onStop;
    this.lastTime = new Date().getTime();
    this.id = window.setInterval(() => this.tick(), this.increment);
  }

  stop(): void {
    if (this.id !== undefined) {
      window.clearInterval(this.id);
      this.id = undefined;
    }
  }

  isRunning(): boolean {
    return this.id !== undefined;
  }

  addTime(howmuch: number): void {
    this.time += howmuch;
  }

  startIfNotRunning(onStop: () => void): void {
    if (this.id)
      return;
    else
      this.start(onStop);
  }
}

export class Bar implements ProgressBar {
  private element: HTMLElement;

  constructor(htmlElement: HTMLElement) {
    this.element = htmlElement;
  }

  render(percentage: number): void {
    //console.log("Rendering timer at " + percentage + "%");
    const html = "<div class='timer-bar' style='height: " + percentage + "%;'>" +
      "</div>";
    this.element.innerHTML = html;
  }
}
