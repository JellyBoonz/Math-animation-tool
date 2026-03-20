import { createSignal, onMount } from "solid-js";
import { Renderer } from "./renderer/Renderer";
import { Circle } from "./Circle";

const WIDTH = 800;
const HEIGHT = 600;
const SPACING = 1.0;
const ASPECT = WIDTH / HEIGHT;

export default function Canvas() {
    let canvas!: HTMLCanvasElement;
    let overlay!: HTMLCanvasElement;
    let t: number = 0;

    const [panX, setPanX] = createSignal(0);
    const [panY, setPanY] = createSignal(0);
    const [zoom, setZoom] = createSignal(1);
    const [playing, setPlaying] = createSignal(false);
    const [startTime, setStartTime] = createSignal(0);

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

        console.log("panning")
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
        console.log("Wheel scrolling")
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

        const c = new Circle();
        c.setCenter("0", "sin(t)")
        
        function loop() {
            
            ctx.clearRect(0, 0, WIDTH, HEIGHT);

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

            if(playing() == true) {
                t = (performance.now() - startTime()) / 1000;
            }

            renderer.frame(panX(), panY(), zoom(), currentSpacing, [c] , t);

            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    });

    return (
        <div style={{ position: "relative", width: `${WIDTH}px`, height: `${HEIGHT}px` }}>
            <canvas ref={canvas} width={WIDTH} height={HEIGHT} />
            <canvas
                ref={overlay}
                width={WIDTH}
                height={HEIGHT}
                style={{ position: "absolute", top: "0", left: "0", background: "transparent"}}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onWheel={onWheel}
            />
            <button onClick={() => {setPlaying(true); setStartTime(performance.now())}}>Play</button>
        </div>
    );
}
