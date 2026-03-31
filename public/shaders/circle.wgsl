struct Circle {
    center: vec2<f32>,
    radius: f32,
    padding: f32,
    color: vec4<f32>,
}
struct Uniforms {
    spacing: f32,
    zoom: f32,
    pan: vec2<f32>,
    resolution: vec2<f32>,
};

struct VertexOut {
    @builtin(position) pos    : vec4<f32>,
    @location(0)       uv     : vec2<f32>,
    @location(1) @interpolate(flat) id : u32
}

@group(0) @binding(0) var<storage, read> circles: array<Circle>;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;

@vertex
fn vs_circle(@builtin(instance_index) i: u32, @location(0) pos: vec2<f32>) -> VertexOut{
    var out: VertexOut;
    let circle = circles[i];
    let newPos = circle.center + circle.radius * pos;

    let panX = uniforms.pan.x;
    let panY = uniforms.pan.y;
    let aspect = uniforms.resolution.x / uniforms.resolution.y;

    let clipPosX = ((newPos.x - panX) * uniforms.zoom / aspect);
    let clipPosY = (newPos.y - panY) * uniforms.zoom;

    out.pos = vec4(clipPosX, clipPosY, 0, 1);
    out.uv = pos;
    out.id = i;

    return out;
}

@fragment
fn fs_circle(in: VertexOut) -> @location(0) vec4<f32>  {

    if(length(in.uv) < 1.0) {
        let color = circles[in.id].color.xyz;

        let bandwidth = 0.008;
        let min = 1 - bandwidth / uniforms.zoom;
        let max = 1.0;
        return vec4(color, 1 - smoothstep(min, max, length(in.uv)));
    }

    return vec4(1, 0, 0, 0);
}