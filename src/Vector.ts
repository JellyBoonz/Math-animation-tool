
import { compile } from "mathjs"

function compileExpr(expr: string): (t: number) => number {
    const fn = compile(expr);

    return (t: number) => fn.evaluate({ t });
}

export class Vector {
    private oX: (t: number) => number;
    private oY: (t: number) => number;
    private oXStr: string = "";
    private oYStr: string = "";
    private dirX: (t: number) => number;
    private dirY: (t: number) => number;
    private color: { r: number, g: number, b: number, a: number };

    constructor() {
        this.oXStr = "0";
        this.oYStr = "0";
        this.oX = compileExpr(this.oXStr);
        this.oY = compileExpr(this.oYStr);
        this.dirX = compileExpr("1");
        this.dirY = compileExpr("1");
        this.color = { r: 0, g: 0, b: 0, a: 1 };
    }

    setOrigin(x: string, y: string) {
        this.oXStr = x;
        this.oYStr = y;
        this.oX = compileExpr(x);
        this.oY = compileExpr(y);
    }

    setDirection(x: string, y: string) {
        const dx = `(${x}) - (${this.oXStr})`;
        const dy = `(${y}) - (${this.oYStr})`;
        this.dirX = compileExpr(dx);
        this.dirY = compileExpr(dy);
    }

    setColor(c: { r: number, g: number, b: number, a: number }) {
        this.color = c;
    }

    evaluate(t: number) {
        const dx = this.dirX(t);
        const dy = this.dirY(t);
        const len = Math.sqrt(dx ** 2 + dy ** 2);
        return {
            originX: this.oX(t),
            originY: this.oY(t),
            directionX: this.dirX(t),
            directionY: this.dirY(t),
            len: len,
            color: this.color
        };
    }
}