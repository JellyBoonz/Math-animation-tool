import { Point } from "./Point"

type Position = { x: number, y: number };

export class ParametricCurve {
    private point: Point;
    private length = 512;
    private count = 0;
    private history: Position[] = [];
    private head: number = 0;

    constructor() {
        this.point = new Point();
    }

    setCenter(x: string, y: string) {
        this.point.setCenter(x, y);
    }

    setRadius(r: string) {
        this.point.setRadius(r);
    }

    setColor(c: { r: number, g: number, b: number, a: number }) {
        this.point.setColor(c);
    }

    setLength(l: number) {
        this.length = l;
    }

    step(t: number) {
        const pos: Position = this.point.evaluate(t);
        this.history[this.head] = pos;
        if (this.count < this.length)
            this.count++;
        this.head = (this.head + 1) % this.length;
    }

    evaluate(t: number) {
        return {
            ...this.point.evaluate(t),
            length: this.length,
            history: this.history,
            head: this.head,
            count: this.count
        }
    }
}