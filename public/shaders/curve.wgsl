struct Uniforms {
    spacing: f32,
    zoom: f32,
    pan: vec2<f32>,
    resolution: vec2<f32>,
};
struct CurveUniforms {
    color: vec4<f32>,
    radius: f32,
    count: u32,
    head: u32,
    length: u32
}

struct VertexOut {
    @builtin(position) pos    : vec4<f32>,
    @location(0) v: f32,
}

@group(0) @binding(0) var<storage, read> positions: array<vec2<f32>>;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;
@group(0) @binding(2) var<uniform> curveUniforms: CurveUniforms;

@vertex
fn vs_curve(@builtin(vertex_index) i: u32) -> VertexOut {
    var out: VertexOut;
    let position = positions[i];

    let panX = uniforms.pan.x;
    let panY = uniforms.pan.y;
    let aspect = uniforms.resolution.x / uniforms.resolution.y;

    let clipPosX = ((position.x - panX) * uniforms.zoom / aspect);
    let clipPosY = (position.y - panY) * uniforms.zoom;

    out.pos = vec4(clipPosX, clipPosY, 0, 1);
    out.v = f32(i % 2u) * 2.0 - 1.0;
    
    return out;
}

@fragment
fn fs_curve(in: VertexOut) -> @location(0) vec4<f32>  {

    // if(length(in.uv) < 1.0) {
    //     let color = curveUniforms.color.xyz;

    //     let bandwidth = 0.08;
    //     let min = 1 - bandwidth / uniforms.zoom;
    //     let max = 1.0;

    //     return vec4(color, 1 - smoothstep(min, max, length(in.uv)));
    // }

    // return vec4(1, 0, 0, 0);

    let alpha = 1.0 - smoothstep(0.3 / uniforms.zoom, 1.0, abs(in.v));   
    return vec4(curveUniforms.color.xyz, alpha);
}