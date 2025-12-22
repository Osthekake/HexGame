import type { GameTimer } from '../timer';

export function canvasAnimationPromise(timer: GameTimer, animationTime: number, drawOp: (fraction: number) => void): Promise<void> {
  timer.hold(animationTime)
  const start = new Date().getTime()
  return new Promise((resolve) => {
    const tick = () => {
      const delta = new Date().getTime() - start
      const fraction = delta / animationTime
      if(delta < animationTime){
        drawOp(fraction)
        requestAnimationFrame(tick)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}
