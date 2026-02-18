import seedrandom from 'seedrandom';

export class SeededRNG {
  private rng: seedrandom.PRNG;

  constructor(seed: number) {
    this.rng = seedrandom(String(seed));
  }

  next(): number {
    return this.rng();
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}
