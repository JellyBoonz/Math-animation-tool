import { compile } from "mathjs"

function compileExpr(expr: string): (t: number) => number {
    const fn = compile(expr);

    return (t: number) => fn.evaluate({ t });
}
export class Point {
    private centerX: (t: number) => number;
    private centerY: (t: number) => number;
    private radius: (t: number) => number;
    private color: {r: number, g: number, b: number, a: number};

    constructor() {
        this.centerX = compileExpr("0");
        this.centerY = compileExpr("0");
        this.radius = compileExpr(".1");
        this.color = {r: 0, g: 0, b: 1, a: 1};
    }

    setCenter(x: string, y: string) {
        this.centerX = compileExpr(x);
        this.centerY = compileExpr(y);
    }

    setRadius(r: string) {
        this.radius = compileExpr(r);
    }

    setColor(c: {r: number, g: number, b: number, a: number}) {
        this.color = c;
    }

    evaluate(t: number) {
        return {
            x: this.centerX(t),
            y: this.centerY(t),
            radius: this.radius(t),
            color: this.color
        };
    }
}