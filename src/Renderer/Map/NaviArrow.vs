#version 300 es
precision highp float;

in vec3 aPosition;
in vec2 aTextCoord;

out vec2 vTextureCoord;

uniform mat4 uModelViewMat;
uniform mat4 uProjectionMat;
uniform float uAngle;
uniform vec3  uOffset;

void main(void) {
    float cosA = cos(uAngle);
    float sinA = sin(uAngle);

    // Rotate the quad in XZ plane (ground plane) around the cell center
    float rx = aPosition.x * cosA + aPosition.z * sinA;
    float rz = -aPosition.x * sinA + aPosition.z * cosA;

    vec3 pos = vec3(
        uOffset.x + rx,
        uOffset.y + aPosition.y,
        uOffset.z + rz
    );

    // Slight offset below entities to avoid z-fighting
    pos.y -= 0.12;

    gl_Position   = uProjectionMat * uModelViewMat * vec4(pos, 1.0);
    vTextureCoord = aTextCoord;
}
