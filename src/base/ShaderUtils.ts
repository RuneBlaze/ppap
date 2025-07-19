/**
 * Shared GLSL utilities for shader effects
 */

export const OKLAB_GLSL_SNIPPET = `
/* -------- sRGB → OKLab conversion utilities ---------------------------- */
vec3 srgbToLinear(vec3 c)
{
    vec3 cutoff = vec3(0.04045);
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(cutoff, c));
}

vec3 linearToSrgb(vec3 c)
{
    vec3 cutoff = vec3(0.0031308);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(cutoff, c));
}

vec3 rgbToOklab(vec3 c)
{
    vec3 lrgb = srgbToLinear(c);

    // linear RGB → LMS
    float l = 0.4122214708 * lrgb.r + 0.5363325363 * lrgb.g + 0.0514459929 * lrgb.b;
    float m = 0.2119034982 * lrgb.r + 0.6806995451 * lrgb.g + 0.1073969566 * lrgb.b;
    float s = 0.0883024619 * lrgb.r + 0.2817188376 * lrgb.g + 0.6299787005 * lrgb.b;

    // cube-root and final OKLab transform
    vec3 lms = vec3(pow(l, 1.0/3.0), pow(m, 1.0/3.0), pow(s, 1.0/3.0));

    return vec3(
        0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
        1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
        0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z
    );
}

vec3 oklabToRgb(vec3 lab)
{
    // OKLab → LMS
    vec3 lms = vec3(
        lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z,
        lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z,
        lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z
    );

    // cube LMS values
    lms = lms * lms * lms;

    // LMS → linear RGB
    vec3 lrgb = vec3(
         4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,
        -1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,
        -0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z
    );

    return linearToSrgb(lrgb);
}
`;
