export function unique<T>(arr: T[]): T[] {
  const result: T[] = [];
  outer: for (let i = 0; i < arr.length; i++) {
    for (let x = 0; x < result.length; x++) {
      if (JSON.stringify(result[x]) === JSON.stringify(arr[i])) {
        continue outer;
      }
    }
    result.push(arr[i]);
  }
  return result;
}

export const requestAnimFrame = (function() {
  return window.requestAnimationFrame ||
    (window as any).webkitRequestAnimationFrame ||
    (window as any).mozRequestAnimationFrame ||
    (window as any).oRequestAnimationFrame ||
    (window as any).msRequestAnimationFrame ||
    function(callback: (time: number) => void, secondsPerFrame: number) {
      window.setTimeout(() => callback(performance.now()), secondsPerFrame);
    };
})();
