import { Circle } from "../Circle";

export class Renderer {

    private canvas: HTMLCanvasElement;
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private circlePipeline!: GPURenderPipeline;
    private vertexBuffer!: GPUBuffer;
    private circleBuffer!: GPUBuffer;
    private uniformBuf!: GPUBuffer;
    private bindGroup!: GPUBindGroup;
    private circleBingGroup!: GPUBindGroup;
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

        // Grid Pipeline
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

        const circleShaderSource = await fetch("/shaders/circle.wgsl").then(r => r.text());
        const circleModule = this.device.createShaderModule({ code: circleShaderSource });

        const infoC = await circleModule.getCompilationInfo();
        for (const msg of info.messages) {
            console.error(`[shader] ${msg.type}: ${msg.message} (line ${msg.lineNum})`);
        }

        this.circleBuffer = this.device.createBuffer({
            size: 280,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        })

        this.circlePipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: circleModule,
                entryPoint: "vs_circle",
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
                module: circleModule,
                entryPoint: "fs_circle",
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
            }
        })

        this.circleBingGroup = this.device.createBindGroup({
            layout: this.circlePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.circleBuffer } },
                { binding: 1, resource: { buffer: this.uniformBuf } }
            ]
        })
    }

    public frame(panX: number, panY: number, zoom: number, currentSpacing: number, circles: Circle[], t: number) {

        const textureView = this.context.getCurrentTexture().createView()
        this.device.queue.writeBuffer(
            this.uniformBuf, 0,
            new Float32Array([currentSpacing, zoom, panX, panY, this.width, this.height])
        );

        const encoder = this.device.createCommandEncoder();

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
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

        const data: number[] = [];
        for (const circle of circles) {
            const ev = circle.evaluate(t);
            data.push(ev.x, ev.y, ev.radius, 0, ev.color.r, ev.color.g, ev.color.b, ev.color.a);
        }

        this.device.queue.writeBuffer(
            this.circleBuffer, 0,
            new Float32Array(data)
        )
        this.device.pushErrorScope("validation");
        // ... circle pass code ...                 
        const circleEncoder = this.device.createCommandEncoder();
        const circlePass = circleEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.8, g: 0.87, b: 0.98, a: 1 },
                loadOp: "load",
                storeOp: "store"
            }]
        })
        circlePass.setPipeline(this.circlePipeline);
        circlePass.setVertexBuffer(0, this.vertexBuffer);
        circlePass.setBindGroup(0, this.circleBingGroup);
        circlePass.draw(6, circles.length);
        circlePass.end();

        this.device.popErrorScope().then(error => {
            if (error) console.error("WebGPU error:", error.message);
        });

        this.device.queue.submit([encoder.finish()]);
        this.device.queue.submit([circleEncoder.finish()]);
    }
}
