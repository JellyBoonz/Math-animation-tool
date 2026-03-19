export class Renderer {

    private canvas: HTMLCanvasElement;
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private vertexBuffer!: GPUBuffer;
    private uniformBuf!: GPUBuffer;
    private bindGroup!: GPUBindGroup;
    private width!: number;
    private height!: number;
    private spacing!: number;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    public async init(width: number, height: number, spacing: number) {
        this.width = width;
        this.height = height;
        this.spacing = spacing;

        if (!navigator.gpu) {
            throw new Error("WebGPU not supported on this browser.");
        }

        // Get WebGPU representation of piece of GPU hardware
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }

        // Get device interface
        this.device = await adapter.requestDevice();

        // WebGPU context from canvas
        this.context = this.canvas.getContext("webgpu")!;
        if (!this.context) {
            throw new Error("Unable to create context from canvas.");
        }
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: canvasFormat,
            alphaMode: "premultiplied"
        });

        const shaderSource = await fetch("/shaders/grid.wgsl").then(r => r.text());
        const module = this.device.createShaderModule({ code: shaderSource });

        const info = await module.getCompilationInfo();
        for (const msg of info.messages) {
            console.error(`[shader] ${msg.type}: ${msg.message} (line ${msg.lineNum})`);
        }

        const vertices = new Float32Array([
            -1, -1, 1, -1, 1, 1,   // triangle 1
            -1, -1, 1, 1, -1, 1,   // triangle 2
        ]);

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module,
                entryPoint: "vs_grid",
                buffers: [{
                    arrayStride: 8,
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x2",
                    }]
                }]
            },
            fragment: {
                module,
                entryPoint: "fs_grid",
                targets: [{
                    format: canvasFormat,
                    blend: {
                        color: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add"
                        },
                        alpha: {
                            srcFactor: "one",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add"
                        }
                    }
                }]
            },
            primitive: { topology: "triangle-list" },
        });

        // spacing, zoom, panX, panY, width, height = 6 floats = 24 bytes
        this.uniformBuf = this.device.createBuffer({
            size: 24,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // More general channel for passing buffers, textures, uniforms, etc. to the shader code.
        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuf } },
            ],
        });
    }

    public frame(panX: number, panY: number, zoom: number, currentSpacing: number) {
        this.device.queue.writeBuffer(
            this.uniformBuf, 0,
            new Float32Array([currentSpacing, zoom, panX, panY, this.width, this.height])
        );

        const encoder = this.device.createCommandEncoder();

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.8, g: 0.87, b: 0.98, a: 1 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        pass.setPipeline(this.pipeline);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(6);
        pass.end();

        this.device.queue.submit([encoder.finish()]);
    }
}
