import { Circle } from "../Circle";
import { Point } from "../Point";
import { ParametricCurve } from "../ParametricCurve";

export class Renderer {

    private canvas: HTMLCanvasElement;
    private device!: GPUDevice;
    private context!: GPUCanvasContext;

    private pipeline!: GPURenderPipeline;
    private circlePipeline!: GPURenderPipeline;
    private pointPipeline!: GPURenderPipeline;
    private curvePipeline!: GPURenderPipeline;

    private curveComputePipeline!: GPUComputePipeline;

    private circleBuffer!: GPUBuffer;
    private pointBuffer!: GPUBuffer;
    private vertexBuffer!: GPUBuffer;
    private uniformBuf!: GPUBuffer;
    private curveUniformBuffers: Map<ParametricCurve, GPUBuffer> = new Map();
    private curveBuffers: Map<ParametricCurve, GPUBuffer> = new Map();
    private curveOutputBuffers: Map<ParametricCurve, GPUBuffer> = new Map();

    private bindGroup!: GPUBindGroup;
    private circleBingGroup!: GPUBindGroup;
    private pointBindGroup!: GPUBindGroup;
    private curveBindGroups: Map<ParametricCurve, GPUBindGroup> = new Map();
    private computeBindGroups: Map<ParametricCurve, GPUBindGroup> = new Map();

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

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }

        this.device = await adapter.requestDevice();

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

        const vertices = new Float32Array([
            -1, -1, 1, -1, 1, 1,   // triangle 1
            -1, -1, 1, 1, -1, 1,   // triangle 2
        ]);
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

        // spacing, zoom, panX, panY, width, height = 6 floats = 24 bytes
        this.uniformBuf = this.device.createBuffer({
            size: 24,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        await this.initGrid(canvasFormat);
        await this.initCircles(canvasFormat);
        await this.initPoints(canvasFormat);
        await this.initCurves(canvasFormat);
    }

    private async initGrid(canvasFormat: GPUTextureFormat) {
        const shaderSource = await fetch("/shaders/grid.wgsl").then(r => r.text());
        const module = this.device.createShaderModule({ code: shaderSource });

        const info = await module.getCompilationInfo();
        for (const msg of info.messages) {
            console.error(`[shader] ${msg.type}: ${msg.message} (line ${msg.lineNum})`);
        }

        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module,
                entryPoint: "vs_grid",
                buffers: [{
                    arrayStride: 8,
                    attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }]
                }]
            },
            fragment: {
                module,
                entryPoint: "fs_grid",
                targets: [{
                    format: canvasFormat,
                    blend: {
                        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
                    }
                }]
            },
            primitive: { topology: "triangle-list" },
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }],
        });
    }

    private async initCircles(canvasFormat: GPUTextureFormat) {
        const shaderSource = await fetch("/shaders/circle.wgsl").then(r => r.text());
        const module = this.device.createShaderModule({ code: shaderSource });

        const info = await module.getCompilationInfo();
        for (const msg of info.messages) {
            console.error(`[shader] ${msg.type}: ${msg.message} (line ${msg.lineNum})`);
        }

        this.circleBuffer = this.device.createBuffer({
            size: 280,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        this.circlePipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module,
                entryPoint: "vs_circle",
                buffers: [{
                    arrayStride: 8,
                    attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }]
                }]
            },
            fragment: {
                module,
                entryPoint: "fs_circle",
                targets: [{
                    format: canvasFormat,
                    blend: {
                        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
                    }
                }]
            }
        });

        this.circleBingGroup = this.device.createBindGroup({
            layout: this.circlePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.circleBuffer } },
                { binding: 1, resource: { buffer: this.uniformBuf } }
            ]
        });
    }

    private async initPoints(canvasFormat: GPUTextureFormat) {
        const shaderSource = await fetch("/shaders/point.wgsl").then(r => r.text());
        const module = this.device.createShaderModule({ code: shaderSource });

        const info = await module.getCompilationInfo();
        for (const msg of info.messages) {
            console.error(`[shader] ${msg.type}: ${msg.message} (line ${msg.lineNum})`);
        }

        this.pointBuffer = this.device.createBuffer({
            size: 280,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        this.pointPipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module,
                entryPoint: "vs_point",
                buffers: [{
                    arrayStride: 8,
                    attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }]
                }]
            },
            fragment: {
                module,
                entryPoint: "fs_point",
                targets: [{
                    format: canvasFormat,
                    blend: {
                        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
                    }
                }]
            }
        });

        this.pointBindGroup = this.device.createBindGroup({
            layout: this.pointPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.pointBuffer } },
                { binding: 1, resource: { buffer: this.uniformBuf } }
            ]
        });


    }

    private async initCurves(canvasFormat: GPUTextureFormat) {
        const shaderSource = await fetch("/shaders/curve.wgsl").then(r => r.text());
        const module = this.device.createShaderModule({ code: shaderSource });

        const computeSource = await fetch("/shaders/curve_compute.wgsl").then(r => r.text());
        const computeModule = this.device.createShaderModule({ code: computeSource });

        const info = await module.getCompilationInfo();
        for (const msg of info.messages) {
            console.error(`[shader] ${msg.type}: ${msg.message} (line ${msg.lineNum})`);
        }

        const computeInfo = await computeModule.getCompilationInfo();
        for (const msg of computeInfo.messages) {
            console.error(`[compute shader] ${msg.type}: ${msg.message} (line ${msg.lineNum})`);
        }

        this.curvePipeline = this.device.createRenderPipeline({
            layout: "auto",
            primitive: { topology: "triangle-strip" },
            vertex: {
                module,
                entryPoint: "vs_curve",
            },
            fragment: {
                module,
                entryPoint: "fs_curve",
                targets: [{
                    format: canvasFormat,
                    blend: {
                        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
                    }
                }]
            }
        });

        this.curveComputePipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: computeModule,
                entryPoint: "cs_curve"
            }
        });


    }

    public addCurve(curve: ParametricCurve) {
        const buffer = this.device.createBuffer({
            size: 5000 * 2 * 4, // 5000 positions * 2 floats * 4 bytes
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        this.curveBuffers.set(curve, buffer);

        const curveUniformBuf = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const outputBuffer = this.device.createBuffer({
            size: 5000 * 15 * 2 * 8,
            usage: GPUBufferUsage.STORAGE
        });

        const computeBindGroup = this.device.createBindGroup({
            layout: this.curveComputePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: outputBuffer } },
                { binding: 1, resource: { buffer: buffer } },
                { binding: 2, resource: { buffer: curveUniformBuf } },
            ]
        })

        const bindGroup = this.device.createBindGroup({
            layout: this.curvePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: outputBuffer } },
                { binding: 1, resource: { buffer: this.uniformBuf } },
                { binding: 2, resource: { buffer: curveUniformBuf } },
            ]
        });


        this.computeBindGroups.set(curve, computeBindGroup);
        this.curveBindGroups.set(curve, bindGroup);
        this.curveUniformBuffers.set(curve, curveUniformBuf);
        this.curveOutputBuffers.set(curve, outputBuffer);
    }

    private drawGrid(encoder: GPUCommandEncoder, textureView: GPUTextureView) {
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
    }

    private drawCircles(encoder: GPUCommandEncoder, textureView: GPUTextureView, circles: Circle[], t: number) {
        const data: number[] = [];
        for (const circle of circles) {
            const ev = circle.evaluate(t);
            data.push(ev.x, ev.y, ev.radius, 0, ev.color.r, ev.color.g, ev.color.b, ev.color.a);
        }
        this.device.queue.writeBuffer(this.circleBuffer, 0, new Float32Array(data));

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.8, g: 0.87, b: 0.98, a: 1 },
                loadOp: "load",
                storeOp: "store"
            }]
        });
        pass.setPipeline(this.circlePipeline);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setBindGroup(0, this.circleBingGroup);
        pass.draw(6, circles.length);
        pass.end();
    }

    private drawPoints(encoder: GPUCommandEncoder, textureView: GPUTextureView, points: Point[], t: number) {
        const data: number[] = [];
        for (const point of points) {
            const ev = point.evaluate(t);
            data.push(ev.x, ev.y, ev.radius, 0, ev.color.r, ev.color.g, ev.color.b, ev.color.a);
        }
        this.device.queue.writeBuffer(this.pointBuffer, 0, new Float32Array(data));

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.8, g: 0.87, b: 0.98, a: 1 },
                loadOp: "load",
                storeOp: "store"
            }]
        });
        pass.setPipeline(this.pointPipeline);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setBindGroup(0, this.pointBindGroup);
        pass.draw(6, points.length);
        pass.end();
    }

    private drawCurves(encoder: GPUCommandEncoder, textureView: GPUTextureView, curves: ParametricCurve[], t: number) {
        const counts: Map<ParametricCurve, number> = new Map();
        let count = 0;
        for (const curve of curves) {
            curve.step(t);
            const ev = curve.evaluate(t);

            counts.set(curve, ev.count);
            count = ev.count;
            const oldest = ev.count < ev.length ? 0 : ev.head;

            const flat = new Float32Array(ev.history.flatMap(p => [p.x, p.y]));
            this.device.queue.writeBuffer(this.curveBuffers.get(curve)!, 0, flat);
            const buffer = new ArrayBuffer(32)
            const floats = new Float32Array(buffer, 0, 5)
            const ints = new Uint32Array(buffer, 20, 3)

            floats[0] = ev.color.r;
            floats[1] = ev.color.g;
            floats[2] = ev.color.b;
            floats[3] = ev.color.a;
            floats[4] = ev.radius;

            ints[0] = ev.count;
            ints[1] = oldest;
            ints[2] = ev.length;

            this.device.queue.writeBuffer(
                this.curveUniformBuffers.get(curve)!, 0,
                buffer
            );
        }

        const computePass = encoder.beginComputePass();
        computePass.setPipeline(this.curveComputePipeline);

        for (const curve of curves) {
            const bindGroup = this.computeBindGroups.get(curve);
            computePass.setBindGroup(0, bindGroup);
            if (count > 3)
                computePass.dispatchWorkgroups(count - 3);
        }

        computePass.end();

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.8, g: 0.87, b: 0.98, a: 1 },
                loadOp: "load",
                storeOp: "store"
            }]
        });

        pass.setPipeline(this.curvePipeline);

        for (const curve of curves) {
            const bindGroup = this.curveBindGroups.get(curve);
            pass.setBindGroup(0, bindGroup);
            if (count > 3)
                pass.draw(30 * (count - 3)); // 30 positions per segment, length - 3 segments in total
        }

        pass.end();
    }

    public frame(panX: number, panY: number, zoom: number, currentSpacing: number, circles: Circle[], points: Point[], curves: ParametricCurve[], t: number) {
        const textureView = this.context.getCurrentTexture().createView();
        this.device.queue.writeBuffer(
            this.uniformBuf, 0,
            new Float32Array([currentSpacing, zoom, panX, panY, this.width, this.height])
        );

        this.device.pushErrorScope("validation");

        const encoder = this.device.createCommandEncoder();
        this.drawGrid(encoder, textureView);
        this.drawCircles(encoder, textureView, circles, t);
        this.drawPoints(encoder, textureView, points, t);
        this.drawCurves(encoder, textureView, curves, t);
        this.device.queue.submit([encoder.finish()]);

        this.device.popErrorScope().then(error => {
            if (error) console.error("WebGPU error:", error.message);
        });
    }
}
