#version 300 es
precision highp float;

in vec2 vTextureCoord;
out vec4 fragColor;

uniform sampler2D uDiffuse;
uniform float uAlpha;

uniform bool  uFogUse;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3  uFogColor;

void main(void) {
    vec4 textureSample = texture(uDiffuse, vTextureCoord.st);

    if (textureSample.a < 0.05) {
        discard;
    }

    fragColor = vec4(textureSample.rgb, textureSample.a * uAlpha);

    if (uFogUse) {
        float depth     = gl_FragCoord.z / gl_FragCoord.w;
        float fogFactor = smoothstep(uFogNear, uFogFar, depth);
        fragColor       = mix(fragColor, vec4(uFogColor, fragColor.w), fogFactor);
    }
}
