struct Vector {
    origin: vec2<f32>,
    dir:    vec2<f32>,
    color:  vec4<f32>,
    len:    f32
}
struct Uniforms {
    spacing: f32,
    zoom: f32,
    pan: vec2<f32>,
    resolution: vec2<f32>,
};

struct VertexOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) @interpolate(flat) id: u32,
}

@group(0) @binding(0) var<storage, read> vectors: array<Vector>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@vertex
fn vs_vecBody(@builtin(instance_index) i: u32, @location(0) pos: vec2<f32>) -> VertexOut {
    var out: VertexOut;
    let v = vectors[i];
    let aspect = uniforms.resolution.x / uniforms.resolution.y;

    let angle = atan2(v.dir.y, v.dir.x);
    let cos_a = cos(angle);
    let sin_a = sin(angle);

    let scale = mat2x2<f32>(
        0.01, 0.0,
        0.0,  v.len / 2.0,
    );

    let rotate = mat2x2<f32>(
        cos_a, -sin_a,
        sin_a,  cos_a,
    );

    let mid = v.origin + v.dir / 2.0;
    let world_pos = rotate * scale * pos + mid;

    out.pos = vec4<f32>(
        (world_pos.x - uniforms.pan.x) * uniforms.zoom / aspect,
        (world_pos.y - uniforms.pan.y) * uniforms.zoom,
        0.0, 1.0
    );
    out.id = i;
    return out;
}

@fragment
fn fs_vecBody(in: VertexOut) -> @location(0) vec4<f32> {
    return vectors[in.id].color;
}
