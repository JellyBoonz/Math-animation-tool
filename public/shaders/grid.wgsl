struct Uniforms {
    spacing: f32,
    zoom: f32,
    pan: vec2<f32>,
    resolution: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexOut {
    @builtin(position) pos    : vec4<f32>,
    @location(0)       uv     : vec2<f32>,
};

@vertex
fn vs_grid(@location(0) pos: vec2<f32>) -> VertexOut {
    var out: VertexOut;
    out.pos = vec4(pos, 0.0, 1.0);
    out.uv = pos;
    return out;
}

@fragment
fn fs_grid(in: VertexOut) -> @location(0) vec4<f32> {
    var aspect = uniforms.resolution.x / uniforms.resolution.y;

    var panX = uniforms.pan.x;
    var panY = uniforms.pan.y;
    var spacing = uniforms.spacing;

    // Map each pixel to a world coordinate
    var worldX = (in.uv.x * aspect) / uniforms.zoom + panX;
    var worldY = in.uv.y / uniforms.zoom + panY;

    // Divide thickness by zoom so lines stay the same thickness on screen as you zoom
    var mainLineThickness = 0.0035 / uniforms.zoom;
    var lineThickness = 0.003 / uniforms.zoom;
    var oLineThickness = 0.005 / uniforms.zoom;

    // Check if this pixel is near a grid line
    var quintileSpacing = spacing / 5;
    var nearestLineX = ceil(panX / spacing) * spacing;
    var nearestLineY = ceil(panY / spacing) * spacing;

    var xRemainder = fract((worldX - nearestLineX) / spacing) * spacing;
    var yRemainder = fract((worldY - nearestLineY) / spacing) * spacing;
    var xRemainderQ = fract((worldX - nearestLineX) / quintileSpacing) * quintileSpacing;
    var yRemainderQ = fract((worldY - nearestLineY) / quintileSpacing) * quintileSpacing;
    // Check if this pixel is near the X or Y axis (world origin lines)
    if (abs(worldX) < oLineThickness || abs(worldY) < oLineThickness) {
        return vec4(0.1, 0.1, 0.1, .7);
    }
    else if (xRemainder < mainLineThickness || xRemainder > spacing - mainLineThickness ||
    yRemainder < mainLineThickness || yRemainder > spacing - mainLineThickness) {
       return vec4(0.1, 0.1, 0.1, .4); 
    }
    else if (xRemainderQ < lineThickness || xRemainderQ > quintileSpacing - lineThickness ||
        yRemainderQ < lineThickness || yRemainderQ > quintileSpacing - lineThickness) {
        return vec4(0.5, 0.5, 0.5, .2);
    }


    return vec4(0.95, 0.95, 0.98, 1.0);
}
