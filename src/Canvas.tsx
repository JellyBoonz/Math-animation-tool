import { createSignal, onMount, For, Show } from "solid-js";
import { Renderer } from "./renderer/Renderer";
import { Circle } from "./Circle";
import { ParametricCurve } from "./ParametricCurve";
import { Vector } from "./Vector";

const SPACING = 1.0;
const PANEL_W = 280;
const CURVE_COLORS = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#f87171", "#38bdf8", "#fb923c"];
const CIRCLE_COLORS = CURVE_COLORS;

type CurveEntry = {
    id: number;
    curve: ParametricCurve;
    xExpr: string;
    yExpr: string;
    color: string;
};

type CircleEntry = {
    id: number;
    circle: Circle;
    color: string;
};

type VectorEntry = {
    id: number;
    vector: Vector;
    color: string;
};

let nextCurveId = 0;
let nextCircleId = 0;
let nextVectorId = 0;

export default function Canvas() {
    let canvas!: HTMLCanvasElement;
    let overlay!: HTMLCanvasElement;
    let renderer!: Renderer;
    let t = 0;
    let gpuCurves: ParametricCurve[] = [];
    let circles: Circle[] = [];
    let vectors: Vector[] = [];

    const W = window.innerWidth;
    const H = window.innerHeight;
    const ASPECT = W / H;

    const [panX, setPanX] = createSignal(0);
    const [panY, setPanY] = createSignal(0);
    const [zoom, setZoom] = createSignal(1);
    const [playing, setPlaying] = createSignal(false);
    const [startTime, setStartTime] = createSignal(0);
    const [panelOpen, setPanelOpen] = createSignal(true);
    const [curveEntries, setCurveEntries] = createSignal<CurveEntry[]>([]);
    const [circleEntries, setCircleEntries] = createSignal<CircleEntry[]>([]);
    const [vectorEntries, setVectorEntries] = createSignal<VectorEntry[]>([]);

    const curveInputs = new Map<number, { x: string; y: string }>();
    const vectorInputs = new Map<number, { ox: string; oy: string; tx: string; ty: string }>();
    let centerXVal = "0";
    let centerYVal = "0";
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    function hexToColor(hex: string) {
        return {
            r: parseInt(hex.slice(1, 3), 16) / 255,
            g: parseInt(hex.slice(3, 5), 16) / 255,
            b: parseInt(hex.slice(5, 7), 16) / 255,
            a: 1
        };
    }

    function addCurve(xExpr = "cos(t)", yExpr = "sin(t)") {
        const id = nextCurveId++;
        const colorHex = CURVE_COLORS[id % CURVE_COLORS.length];

        const curve = new ParametricCurve();
        curve.setCenter(xExpr, yExpr);
        curve.setLength(5000);
        curve.setColor(hexToColor(colorHex));

        renderer.addCurve(curve);
        gpuCurves.push(curve);
        curveInputs.set(id, { x: xExpr, y: yExpr });
        setCurveEntries(prev => [...prev, { id, curve, xExpr, yExpr, color: colorHex }]);
    }

    function removeCurve(id: number) {
        nextCurveId--;
        const entry = curveEntries().find(e => e.id === id);
        if (!entry) return;
        gpuCurves = gpuCurves.filter(c => c !== entry.curve);
        curveInputs.delete(id);
        setCurveEntries(prev => prev.filter(e => e.id !== id));
    }

    function addCircle() {
        const id = nextCircleId++;
        const colorHex = CIRCLE_COLORS[id % CIRCLE_COLORS.length];
        const c = new Circle();
        c.setColor(hexToColor(colorHex));
        circles.push(c);
        setCircleEntries(prev => [...prev, {id, circle: c, color: colorHex}]);
    }

    function removeCircle(id: number) {
        nextCircleId--;
        const entry = circleEntries().find(e => e.id === id);
        if (!entry) {
            console.log("Circle not found");
            return;
        }
        circles = circles.filter(c => c !== entry.circle);
        setCircleEntries(prev => prev.filter(e => e.id !== id));
    }

    function addVector() {
        const id = nextVectorId++;
        const colorHex = CURVE_COLORS[id % CURVE_COLORS.length];
        const v = new Vector();
        v.setColor(hexToColor(colorHex));
        vectors.push(v);
        vectorInputs.set(id, { ox: "0", oy: "0", tx: "1", ty: "1" });
        setVectorEntries(prev => [...prev, { id, vector: v, color: colorHex }]);
    }

    function removeVector(id: number) {
        nextVectorId--;
        const entry = vectorEntries().find(e => e.id === id);
        if (!entry) return;
        vectors = vectors.filter(v => v !== entry.vector);
        vectorInputs.delete(id);
        setVectorEntries(prev => prev.filter(e => e.id !== id));
    }

    function applyVectorExpr(id: number) {
        const entry = vectorEntries().find(e => e.id === id);
        const inputs = vectorInputs.get(id);
        if (!entry || !inputs) return;
        try {
            entry.vector.setOrigin(inputs.ox, inputs.oy);
            entry.vector.setDirection(inputs.tx, inputs.ty);
        } catch {}
    }

    function applyCurveExpr(id: number) {
        const entry = curveEntries().find(e => e.id === id);
        const inputs = curveInputs.get(id);
        if (!entry || !inputs) return;
        try {
            entry.curve.setCenter(inputs.x, inputs.y);
            setCurveEntries(prev => prev.map(e =>
                e.id === id ? { ...e, xExpr: inputs.x, yExpr: inputs.y } : e
            ));
        } catch {}
    }

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
        setPanX(p => p - dx * 2 * ASPECT / (z * W));
        setPanY(p => p + dy * 2 / (z * H));
    }

    function onMouseUp() { isDragging = false; }

    function onWheel(e: WheelEvent) {
        e.preventDefault();
        setZoom(z => z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }

    function mod(i: number, n: number) { return ((i % n) + n) % n; }

    function labelGridLines(ctx: CanvasRenderingContext2D, currentSpacing: number) {
        let worldLeft = (-1 * ASPECT) / zoom() + panX();
        const worldRight = (1 * ASPECT) / zoom() + panX();
        let worldBottom = -1 / zoom() + panY();
        const worldTop = 1 / zoom() + panY();

        ctx.fillStyle = "#1a1a2e";
        ctx.font = "bold 13px sans-serif";

        while (worldLeft < worldRight) {
            const leftGridLine = Math.ceil(worldLeft / currentSpacing) * currentSpacing;
            const lineCoord = (((leftGridLine - panX()) * zoom() / ASPECT) + 1) * W / 2;
            const xAxisCoord = (panY() * zoom() + 1) * H / 2;
            ctx.fillText(leftGridLine.toString(), lineCoord - 15, xAxisCoord + 20);
            worldLeft += currentSpacing;
        }

        while (worldBottom < worldTop) {
            const bottomGridLine = Math.ceil(worldBottom / currentSpacing) * currentSpacing;
            const lineCoord = ((-bottomGridLine + panY()) * zoom() + 1) * H / 2;
            const yAxisCoord = (((0 - panX()) * zoom() / ASPECT) + 1) * W / 2;
            if (bottomGridLine !== 0)
                ctx.fillText(bottomGridLine.toString(), yAxisCoord - 40, lineCoord - 3);
            worldBottom += currentSpacing;
        }
    }

    function adjustGridSpacing(currentSpacing: number, i: number, exponent: number, sequence: number[]) {
        const maxPixelDistance = 300;
        const minPixelDistance = 100;
        const pixelSpacing = currentSpacing * (W / 2) * (zoom() / ASPECT);

        if (pixelSpacing > maxPixelDistance) {
            i--;
            if (mod(i, 3) == 2) exponent--;
            currentSpacing = sequence[mod(i, 3)] * (10 ** exponent);
        } else if (pixelSpacing < minPixelDistance) {
            i++;
            if (mod(i, 3) == 0) exponent++;
            currentSpacing = sequence[mod(i, 3)] * (10 ** exponent);
        }

        return { currentSpacing, i, exponent };
    }

    onMount(async () => {
        overlay.addEventListener("wheel", onWheel, { passive: false });

        renderer = new Renderer(canvas);
        await renderer.init(W, H, SPACING);

        addCurve(
            "0.6 * cos(t) + 0.3 * cos(7 * t / 3)",
            "0.6 * sin(t) - 0.3 * sin(7 * t / 3)"
        );
        
        const ctx = overlay.getContext("2d")!;
        let exponent = 0;
        let currentSpacing = SPACING;
        let seqIdx = 0;
        const sequence = [1, 2, 5];

        function loop() {
            ctx.clearRect(0, 0, W, H);
            ({ currentSpacing, i: seqIdx, exponent } = adjustGridSpacing(currentSpacing, seqIdx, exponent, sequence));
            labelGridLines(ctx, currentSpacing);
            if (playing()) t = (performance.now() - startTime()) / 1000;
            renderer.frame(panX(), panY(), zoom(), currentSpacing, circles, [], gpuCurves, vectors, t);
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    });

    // Styles
    const darkInput = {
        padding: "6px 10px",
        border: "1px solid rgba(255,255,255,0.1)",
        "border-radius": "6px",
        "font-size": "12px",
        "font-family": "monospace",
        outline: "none",
        background: "rgba(255,255,255,0.06)",
        color: "#e2e8f0",
        width: "100%",
        "box-sizing": "border-box" as const,
    };

    const fieldLabel = {
        "font-size": "11px",
        "font-weight": "500" as const,
        color: "rgba(255,255,255,0.45)",
        "margin-bottom": "3px",
    };

    const sectionLabel = {
        "font-size": "10px",
        "font-weight": "700" as const,
        "text-transform": "uppercase" as const,
        "letter-spacing": "0.1em",
        color: "rgba(255,255,255,0.3)",
        "margin-bottom": "8px",
    };

    const btn = (accent: string, textColor: string) => ({
        border: "none",
        "border-radius": "6px",
        cursor: "pointer",
        "font-size": "12px",
        "font-weight": "500" as const,
        background: accent,
        color: textColor,
        transition: "opacity 0.15s",
    });

    return (
        <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
            <canvas ref={canvas} width={W} height={H} style={{ position: "absolute", top: "0", left: "0" }} />
            <canvas
                ref={overlay}
                width={W}
                height={H}
                style={{ position: "absolute", top: "0", left: "0", background: "transparent" }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
            />

            {/* Panel toggle */}
            <button
                style={{
                    position: "absolute",
                    top: "12px",
                    left: panelOpen() ? `${PANEL_W + 12}px` : "12px",
                    "z-index": "20",
                    width: "34px",
                    height: "34px",
                    background: "rgba(8,12,24,0.85)",
                    "backdrop-filter": "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    "border-radius": "8px",
                    cursor: "pointer",
                    color: "#94a3b8",
                    "font-size": "15px",
                    transition: "left 0.2s ease",
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                    padding: "0",
                }}
                onClick={() => setPanelOpen(o => !o)}
            >
                {panelOpen() ? "✕" : "☰"}
            </button>

            {/* Side panel */}
            <div style={{
                position: "absolute",
                top: "0",
                left: panelOpen() ? "0" : `-${PANEL_W}px`,
                width: `${PANEL_W}px`,
                height: "100%",
                background: "rgba(8,12,24,0.88)",
                "backdrop-filter": "blur(16px)",
                "border-right": "1px solid rgba(255,255,255,0.07)",
                transition: "left 0.2s ease",
                "overflow-y": "auto",
                "z-index": "10",
                padding: "16px",
                "box-sizing": "border-box" as const,
                color: "#e2e8f0",
                "font-family": "system-ui, sans-serif",
                "font-size": "13px",
            }}>
                <div style={{ "font-size": "15px", "font-weight": "700", "margin-bottom": "20px", color: "#f1f5f9" }}>
                    Math Viz
                </div>

                {/* Playback */}
                <div style={{ display: "flex", gap: "6px", "margin-bottom": "24px" }}>
                    <button
                        style={{ ...btn("#3b82f6", "#fff"), padding: "7px 0", flex: "1" }}
                        onClick={() => { setPlaying(true); setStartTime(performance.now() - t * 1000); }}
                    >▶ Play</button>
                    <button
                        style={{ ...btn("rgba(255,255,255,0.08)", "#94a3b8"), padding: "7px 0", flex: "1" }}
                        onClick={() => setPlaying(false)}
                    >⏸ Pause</button>
                </div>

                {/* Curves */}
                <div style={sectionLabel}>Curves</div>
                <button
                    style={{ ...btn("transparent", "#64748b"), padding: "7px 12px", width: "100%", "margin-bottom": "10px", border: "1px dashed rgba(255,255,255,0.1)" }}
                    onClick={() => addCurve()}
                >+ Add Curve</button>

                <For each={curveEntries()}>
                    {(entry) => (
                        <div style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            "border-radius": "8px",
                            padding: "12px",
                            "margin-bottom": "8px",
                        }}>
                            <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "10px" }}>
                                <div style={{ display: "flex", "align-items": "center", gap: "7px" }}>
                                    <div style={{ width: "8px", height: "8px", "border-radius": "50%", background: entry.color, "flex-shrink": "0" }} />
                                    <span style={{ "font-weight": "600", "font-size": "12px", color: "#cbd5e1" }}>Curve {entry.id + 1}</span>
                                </div>
                                <button
                                    style={{ ...btn("rgba(239,68,68,0.12)", "#f87171"), padding: "2px 7px", "font-size": "11px" }}
                                    onClick={() => removeCurve(entry.id)}
                                >✕</button>
                            </div>

                            <div style={{ "margin-bottom": "8px" }}>
                                <div style={fieldLabel}>x(t)</div>
                                <input
                                    style={darkInput}
                                    value={entry.xExpr}
                                    onInput={e => { curveInputs.get(entry.id)!.x = e.currentTarget.value; }}
                                    onKeyDown={e => { if (e.key === "Enter") applyCurveExpr(entry.id); }}
                                />
                            </div>

                            <div style={{ "margin-bottom": "8px" }}>
                                <div style={fieldLabel}>y(t)</div>
                                <input
                                    style={darkInput}
                                    value={entry.yExpr}
                                    onInput={e => { curveInputs.get(entry.id)!.y = e.currentTarget.value; }}
                                    onKeyDown={e => { if (e.key === "Enter") applyCurveExpr(entry.id); }}
                                />
                            </div>

                            <div>
                                <div style={fieldLabel}>Color</div>
                                <input
                                    type="color"
                                    value={entry.color}
                                    style={{ width: "100%", height: "28px", border: "1px solid rgba(255,255,255,0.1)", "border-radius": "6px", cursor: "pointer", padding: "2px", background: "transparent" }}
                                    onInput={e => {
                                        const hex = e.currentTarget.value;
                                        entry.curve.setColor(hexToColor(hex));
                                        setCurveEntries(prev => prev.map(en => en.id === entry.id ? { ...en, color: hex } : en));
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </For>

                <div style={{ "border-top": "1px solid rgba(255,255,255,0.06)", margin: "16px 0" }} />

                {/* Circles */}
                <div style={sectionLabel}>Circles</div>
                <button
                    style={{ ...btn("transparent", "#64748b"), padding: "7px 12px", width: "100%", "margin-bottom": "10px", border: "1px dashed rgba(255,255,255,0.1)" }}
                    onClick={() => { addCircle() }}
                >+ Add Circle</button>

                <For each={circleEntries()}>
                    {(entry) => (
                        <div
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            "border-radius": "8px",
                            padding: "12px",
                            "margin-bottom": "8px",
                        }}>
                            <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "10px" }}>
                                <div style={{ display: "flex", "align-items": "center", gap: "7px" }}>
                                    <div style={{ width: "8px", height: "8px", "border-radius": "50%", background: entry.color, "flex-shrink": "0" }} />
                                    <span style={{ "font-weight": "600", "font-size": "12px", color: "#cbd5e1" }}>Circle {entry.id + 1}</span>
                                </div>
                                <button
                                    style={{ ...btn("rgba(239,68,68,0.12)", "#f87171"), padding: "2px 7px", "font-size": "11px" }}
                                    onClick={() => removeCircle(entry.id)}
                                >✕</button>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", "border-radius": "8px", padding: "12px", display: "flex", "flex-direction": "column", gap: "8px" }}>
                                <div>
                                    <div style={fieldLabel}>Center X</div>
                                    <input style={darkInput} placeholder="0"
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                centerXVal = e.currentTarget.value;
                                                try { entry.circle.setCenter(centerXVal, centerYVal); } catch {}
                                            }
                                        }}
                                    />
                                </div>
                                <div>
                                    <div style={fieldLabel}>Center Y</div>
                                    <input style={darkInput} placeholder="0"
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                centerYVal = e.currentTarget.value;
                                                try { entry.circle.setCenter(centerXVal, centerYVal); } catch {}
                                            }
                                        }}
                                    />
                                </div>
                                <div>
                                    <div style={fieldLabel}>Radius</div>
                                    <input style={darkInput} placeholder="1"
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                try { entry.circle.setRadius(e.currentTarget.value); } catch {}
                                            }
                                        }}
                                    />
                                </div>
                                <div>
                                    <div style={fieldLabel}>Color</div>
                                    <input
                                        type="color"
                                        value={entry.color}
                                        style={{ width: "100%", height: "28px", border: "1px solid rgba(255,255,255,0.1)", "border-radius": "6px", cursor: "pointer", padding: "2px", background: "transparent" }}
                                        onInput={e => {
                                            const hex = e.currentTarget.value;
                                            entry.circle.setColor(hexToColor(hex));
                                            setCircleEntries(prev => prev.map(en => en.id === entry.id ? { ...en, color: hex } : en));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </For>

                <div style={{ "border-top": "1px solid rgba(255,255,255,0.06)", margin: "16px 0" }} />

                {/* Vectors */}
                <div style={sectionLabel}>Vectors</div>
                <button
                    style={{ ...btn("transparent", "#64748b"), padding: "7px 12px", width: "100%", "margin-bottom": "10px", border: "1px dashed rgba(255,255,255,0.1)" }}
                    onClick={() => addVector()}
                >+ Add Vector</button>

                <For each={vectorEntries()}>
                    {(entry) => (
                        <div style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            "border-radius": "8px",
                            padding: "12px",
                            "margin-bottom": "8px",
                        }}>
                            <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "10px" }}>
                                <div style={{ display: "flex", "align-items": "center", gap: "7px" }}>
                                    <div style={{ width: "8px", height: "8px", "border-radius": "50%", background: entry.color, "flex-shrink": "0" }} />
                                    <span style={{ "font-weight": "600", "font-size": "12px", color: "#cbd5e1" }}>Vector {entry.id + 1}</span>
                                </div>
                                <button
                                    style={{ ...btn("rgba(239,68,68,0.12)", "#f87171"), padding: "2px 7px", "font-size": "11px" }}
                                    onClick={() => removeVector(entry.id)}
                                >✕</button>
                            </div>
                            <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                                <div>
                                    <div style={fieldLabel}>Origin X</div>
                                    <input style={darkInput} value="0"
                                        onInput={e => { vectorInputs.get(entry.id)!.ox = e.currentTarget.value; }}
                                        onKeyDown={e => { if (e.key === "Enter") applyVectorExpr(entry.id); }}
                                    />
                                </div>
                                <div>
                                    <div style={fieldLabel}>Origin Y</div>
                                    <input style={darkInput} value="0"
                                        onInput={e => { vectorInputs.get(entry.id)!.oy = e.currentTarget.value; }}
                                        onKeyDown={e => { if (e.key === "Enter") applyVectorExpr(entry.id); }}
                                    />
                                </div>
                                <div>
                                    <div style={fieldLabel}>Direction X</div>
                                    <input style={darkInput} value="1"
                                        onInput={e => { vectorInputs.get(entry.id)!.tx = e.currentTarget.value; }}
                                        onKeyDown={e => { if (e.key === "Enter") applyVectorExpr(entry.id); }}
                                    />
                                </div>
                                <div>
                                    <div style={fieldLabel}>Direction Y</div>
                                    <input style={darkInput} value="1"
                                        onInput={e => { vectorInputs.get(entry.id)!.ty = e.currentTarget.value; }}
                                        onKeyDown={e => { if (e.key === "Enter") applyVectorExpr(entry.id); }}
                                    />
                                </div>
                                <div>
                                    <div style={fieldLabel}>Color</div>
                                    <input
                                        type="color"
                                        value={entry.color}
                                        style={{ width: "100%", height: "28px", border: "1px solid rgba(255,255,255,0.1)", "border-radius": "6px", cursor: "pointer", padding: "2px", background: "transparent" }}
                                        onInput={e => {
                                            const hex = e.currentTarget.value;
                                            entry.vector.setColor(hexToColor(hex));
                                            setVectorEntries(prev => prev.map(en => en.id === entry.id ? { ...en, color: hex } : en));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}
