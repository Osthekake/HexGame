import { Group, Tween } from "@tweenjs/tween.js";
import { ThreeJsRenderer } from "./threejs-renderer";

export function tweenPromise(renderer: ThreeJsRenderer, animationTime: number, tweens: Tween[]){
    return new Promise<void>(resolve => {
        const group = new Group(...tweens)
        const start = new Date().getTime()
        const tick = () => {
            group.update()
            renderer.render()
            const now = new Date().getTime()
            if(now > start + animationTime){
                resolve()
            } else {
                requestAnimationFrame(tick)
            }
        }
        tweens.forEach(t => t.start())
        requestAnimationFrame(tick)
    })
}