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
    @builtin(position) pos:             vec4<f32>,
    @location(0) @interpolate(flat) id: u32,
    @location(1)                  local: vec2<f32>,
}

@group(0) @binding(0) var<storage, read> vectors: array<Vector>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@vertex
fn vs_vecHead(@builtin(instance_index) i: u32, @location(0) pos: vec2<f32>) -> VertexOut {
    var out: VertexOut;
    let v = vectors[i];
    let aspect = uniforms.resolution.x / uniforms.resolution.y;

    let angle = atan2(v.dir.y, v.dir.x);
    let cos_a = cos(angle);
    let sin_a = sin(angle);

    let scale = mat2x2<f32>(
        0.1, 0.0,
        0.0, 0.1,
    );

    let rotate = mat2x2<f32>(
        cos_a, -sin_a,
        sin_a,  cos_a,
    );

    let tip = v.origin + v.dir;
    let world_pos = rotate * scale * pos + tip - 0.06;

    out.pos = vec4<f32>(
        (world_pos.x - uniforms.pan.x) * uniforms.zoom / aspect,
        (world_pos.y - uniforms.pan.y) * uniforms.zoom,
        0.0, 1.0
    );
    out.id = i;
    out.local = pos;
    return out;
}

fn sdf_triangle(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, c: vec2<f32>) -> f32 {
    let e0 = b - a; let e1 = c - b; let e2 = a - c;
    let v0 = p - a; let v1 = p - b; let v2 = p - c;
    let pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    let pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    let pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
    let s = sign(e0.x * e2.y - e0.y * e2.x);
    let d = min(min(
        vec2<f32>(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
        vec2<f32>(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
        vec2<f32>(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
    return -sqrt(d.x) * sign(d.y);
}

@fragment
fn fs_vecHead(in: VertexOut) -> @location(0) vec4<f32> {
    let color = vectors[in.id].color;
    let d = sdf_triangle(in.local, vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(0.0, 1.0));
    let alpha = 1.0 - smoothstep(-0.05, 0.01, d);
    return vec4<f32>(color.rgb, color.a * alpha);
}
