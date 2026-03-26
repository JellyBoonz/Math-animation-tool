import { createSignal, onMount, Show } from "solid-js";
import { Renderer } from "./renderer/Renderer";
import { Circle } from "./Circle";
import { Point } from "./Point"
import { ParametricCurve } from "./ParametricCurve";

const WIDTH = 800;
const HEIGHT = 600;
const SPACING = 1.0;
const ASPECT = WIDTH / HEIGHT;

export default function Canvas() {
    let canvas!: HTMLCanvasElement;
    let overlay!: HTMLCanvasElement;
    let t: number = 0;
    let circles: Circle[] = [];

    const [panX, setPanX] = createSignal(0);
    const [panY, setPanY] = createSignal(0);
    const [zoom, setZoom] = createSignal(1);
    const [playing, setPlaying] = createSignal(false);
    const [startTime, setStartTime] = createSignal(0);
    const [selectedCircle, setSelectedCircle] = createSignal<Circle | null>(null);
    const [selectedColor, setSelectedColor] = createSignal("#3b82f6");

    // Track current input values for center so we can call setCenter(x, y) with both
    let centerXVal = "0";
    let centerYVal = "0";

    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    function onMouseDown(e: MouseEvent) {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }

    function onMouseMove(e: MouseEvent) {
        if (!isDragging) return;

        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        const z = zoom();
        setPanX(p => p - dx * 2 * ASPECT / (z * WIDTH));
        setPanY(p => p + dy * 2 / (z * HEIGHT));
    }

    function onMouseUp() {
        isDragging = false;
    }

    function onWheel(e: WheelEvent) {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const uvX = ((e.clientX - rect.left) / WIDTH) * 2 - 1;
        const uvY = -(((e.clientY - rect.top) / HEIGHT) * 2 - 1);

        const oldZoom = zoom();
        const newZoom = oldZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1);

        // Adjust pan so the world point under the cursor stays fixed
        setPanX(p => p + uvX * ASPECT * (1 / oldZoom - 1 / newZoom));
        setPanY(p => p + uvY * (1 / oldZoom - 1 / newZoom));
        setZoom(newZoom);
    }

    function mod(i: number, n: number) {
        return ((i % n) + n) % n;
    }

    function labelGridLines(ctx: CanvasRenderingContext2D, aspect: number, currentSpacing: number) {
        let worldLeft = (-1 * aspect) / zoom() + panX();
            const worldRight = (1 * aspect) / zoom() + panX();
            let worldBottom = -1 / zoom() + panY();
            const worldTop = 1 / zoom() + panY();
            const xAxis = 0;
            while (worldLeft < worldRight) {
                let leftGridLine = Math.ceil(worldLeft / currentSpacing) * currentSpacing;

                const lineCoord = (((leftGridLine - panX()) * zoom() / aspect) + 1) * WIDTH / 2;    // worldX to screenX
                const xAxisCoord = ((0 + panY()) * zoom() + 1) * HEIGHT / 2;                        // worldY to screenY
                ctx.font = "bold 15px sans-serif";
                ctx.fillText(leftGridLine.toString(), lineCoord - 15, xAxisCoord + 20);
                worldLeft += currentSpacing;
            }

            while (worldBottom < worldTop) {
                let bottomGridLine = Math.ceil(worldBottom / currentSpacing) * currentSpacing;

                const lineCoord = ((-bottomGridLine + panY()) * zoom() + 1) * HEIGHT / 2;
                const yAxisCoord = (((0 - panX()) * zoom() / aspect) + 1) * WIDTH / 2;
                ctx.font = "bold 15px sans-serif";
                if(bottomGridLine !== 0)
                ctx.fillText(bottomGridLine.toString(), yAxisCoord - 40, lineCoord - 3);
                worldBottom += currentSpacing;
            }
    }

    function adjustGridSpacing(aspect: number, currentSpacing: number, i: number, exponent: number, sequence: number[]) {
        const maxPixelDistance = 300;
        const minPixelDistance = 100;
        const halfWidth = WIDTH / 2;
        const zoomOverAspect = zoom() / aspect;

        let pixelSpacing = currentSpacing * halfWidth * zoomOverAspect;

        if (pixelSpacing > maxPixelDistance) {
            i--;
            if (mod(i, 3) == 2) {
                exponent--;
            }
            currentSpacing = sequence[mod(i, 3)] * (10 ** exponent);
        }
        else if(pixelSpacing < minPixelDistance) {
            i++;
            if (mod(i, 3) == 0) {
                exponent++;
            }
            currentSpacing = sequence[mod(i, 3)] * (10 ** exponent);
        }

        return {currentSpacing, i, exponent};
    }

    onMount(async () => {
        // wheel must be registered manually to opt out of passive mode,
        // otherwise preventDefault() has no effect and the page will scroll
        canvas.addEventListener("wheel", onWheel, { passive: false });

        const renderer = new Renderer(canvas);
        await renderer.init(WIDTH, HEIGHT, SPACING);

        const ctx = overlay.getContext("2d")!;
        const aspect = WIDTH / HEIGHT;
        let exponent = 0;
        let currentSpacing = SPACING;
        let i = 0;
        const sequence = [1, 2, 5];

        const p = new Point();
        p.setCenter("0", "sin(t)");
        const points: Point[] = [p];

        const c = new ParametricCurve();
        c.setCenter("cos(t)", "sin(t)");
        c.setRadius("0.01")
        const curves: ParametricCurve[] = [c];

        for(const curve of curves) {
            renderer.addCurve(curve);
        }

        function loop() {

            ctx.clearRect(0, 0, WIDTH, HEIGHT);

            ({currentSpacing, i, exponent} = adjustGridSpacing(aspect, currentSpacing, i, exponent, sequence));

            labelGridLines(ctx, aspect, currentSpacing);

            if(playing() == true) {
                t = (performance.now() - startTime()) / 1000;
            }

            renderer.frame(panX(), panY(), zoom(), currentSpacing, circles, points, curves, t);

            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    });

    const panelStyle = {
        display: "flex",
        "flex-direction": "column" as const,
        gap: "0px",
        width: "260px",
        "font-family": "system-ui, sans-serif",
        "font-size": "13px",
        color: "#1a1a1a",
    };

    const btnStyle = (primary: boolean) => ({
        padding: "8px 12px",
        border: "none",
        "border-radius": "6px",
        cursor: "pointer",
        "font-size": "13px",
        "font-weight": "500",
        background: primary ? "#3b82f6" : "#f1f5f9",
        color: primary ? "#fff" : "#334155",
        transition: "opacity 0.15s",
    });

    const inputStyle = {
        padding: "6px 10px",
        border: "1px solid #e2e8f0",
        "border-radius": "6px",
        "font-size": "13px",
        "font-family": "monospace",
        outline: "none",
        background: "#f8fafc",
        color: "#1a1a1a",
        width: "100%",
        "box-sizing": "border-box" as const,
    };

    const labelStyle = {
        "font-size": "11px",
        "font-weight": "600",
        "text-transform": "uppercase" as const,
        "letter-spacing": "0.05em",
        color: "#64748b",
        "margin-bottom": "2px",
    };

    return (
        <div style={{ display: "flex", gap: "0px", height: "100vh", background: "#f8fafc", "font-family": "system-ui, sans-serif" }}>
            <div style={{ position: "relative", width: `${WIDTH}px`, height: `${HEIGHT}px`, "flex-shrink": "0", "box-shadow": "2px 0 8px rgba(0,0,0,0.06)" }}>
                <canvas ref={canvas} width={WIDTH} height={HEIGHT} />
                <canvas
                    ref={overlay}
                    width={WIDTH}
                    height={HEIGHT}
                    style={{ position: "absolute", top: "0", left: "0", background: "transparent" }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onWheel={onWheel}
                />
            </div>

            <div style={{ ...panelStyle, padding: "16px", "overflow-y": "auto", "flex-grow": "1", "max-width": "280px", background: "#fff", "border-left": "1px solid #e2e8f0" }}>
                <div style={{ "font-size": "15px", "font-weight": "600", "margin-bottom": "16px", color: "#0f172a" }}>Math Viz</div>

                <div style={{ display: "flex", gap: "8px", "margin-bottom": "16px" }}>
                    <button style={btnStyle(true)} onClick={() => { setPlaying(true); setStartTime(performance.now() - t * 1000); }}>▶ Play</button>
                    <button style={btnStyle(true)} onClick={() => { setPlaying(false); setStartTime(startTime()); }}>⏸︎ Pause</button>
                    <button style={btnStyle(false)} onClick={() => {
                        const c = new Circle();
                        circles.push(c);
                        setSelectedCircle(c);
                        setSelectedColor("#3b82f6");
                    }}>+ Circle</button>
                </div>

                <Show when={selectedCircle() !== null}>
                    <div style={{ "border-radius": "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                        <div style={{ padding: "10px 12px", background: "#f1f5f9", "border-bottom": "1px solid #e2e8f0", "font-weight": "600", "font-size": "12px", color: "#475569", display: "flex", "align-items": "center", gap: "6px" }}>
                            <span style={{ display: "inline-block", width: "10px", height: "10px", "border-radius": "50%", background: selectedColor() }} />
                            Circle
                        </div>
                        <div style={{ padding: "12px", display: "flex", "flex-direction": "column", gap: "10px" }}>
                            <div>
                                <div style={labelStyle}>Center X</div>
                                <input style={inputStyle} placeholder="0"
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            centerXVal = e.currentTarget.value;
                                            try { selectedCircle()!.setCenter(centerXVal, centerYVal); } catch {}
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <div style={labelStyle}>Center Y</div>
                                <input style={inputStyle} placeholder="0"
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            centerYVal = e.currentTarget.value;
                                            try { selectedCircle()!.setCenter(centerXVal, centerYVal); } catch {}
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <div style={labelStyle}>Radius</div>
                                <input style={inputStyle} placeholder="1"
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            try { selectedCircle()!.setRadius(e.currentTarget.value); } catch {}
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <div style={labelStyle}>Color</div>
                                <input type="color" value={selectedColor()}
                                    style={{ width: "100%", height: "32px", border: "1px solid #e2e8f0", "border-radius": "6px", cursor: "pointer", padding: "2px" }}
                                    onInput={e => {
                                        const hex = e.currentTarget.value;
                                        setSelectedColor(hex);
                                        const r = parseInt(hex.slice(1, 3), 16) / 255;
                                        const g = parseInt(hex.slice(3, 5), 16) / 255;
                                        const b = parseInt(hex.slice(5, 7), 16) / 255;
                                        selectedCircle()!.setColor({ r, g, b, a: 1 });
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
}
