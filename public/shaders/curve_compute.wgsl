struct CurveUniforms {
    color: vec4<f32>,
    radius: f32,
    count: u32,
    head: u32,
    length: u32
}

@group(0) @binding(0) var<storage, read_write> output: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read> history: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> curveUniforms: CurveUniforms;

// De Casteljau — works for vec2f, vec3f, vec4f
fn cubic_bezier(
    p0: vec2f,
    p1: vec2f,
    p2: vec2f,
    p3: vec2f,
    t:  f32,
) -> vec2f {
    // Level 1
    let q0 = mix(p0, p1, t);
    let q1 = mix(p1, p2, t);
    let q2 = mix(p2, p3, t);
    // Level 2
    let r0 = mix(q0, q1, t);
    let r1 = mix(q1, q2, t);
    // Level 3 → point on curve
    return mix(r0, r1, t);
}

@compute @workgroup_size(1)
fn cs_curve(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x; // segment index
    let length = curveUniforms.length;
    let head = curveUniforms.head;

    let p0 = history[(head + i) % length];
    let p1 = history[(head + i + 1) % length];
    let p2 = history[(head + i + 2) % length];
    let p3 = history[(head + i + 3) % length];

    // Catmull-Rom spline
    let b1 = p1 + (p2 - p0) / 6;
    let b2 = p2 - (p3 - p1) / 6;

    const sample_size = 16;

    var pos_data: array<vec2<f32>, sample_size>;

    for(var idx = 0; idx < sample_size; idx++) {
        let t = f32(idx) / (sample_size - 1);
        pos_data[idx] = cubic_bezier(p1, b1, b2, p2, t);
    }
    // sample bezier and write to output[i * 64 + sample]
    for(var sample = 0; sample < sample_size - 1; sample++) {
        let tangent: vec2f = normalize(pos_data[sample + 1] - pos_data[sample]);
        let N: vec2f = vec2(-tangent.y, tangent.x);
        let scale = 0.01;
        output[i * (sample_size - 1) * 2 + (2 * u32(sample))] = pos_data[sample] + N/2 * scale;
        output[i * (sample_size - 1) * 2 + (2 * u32(sample)) + 1] = pos_data[sample] - N/2 * scale;
    }
}