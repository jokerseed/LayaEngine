#define SHADER_NAME BloomUpSampleBoxFS

#include "Color.glsl";
#include "Colors.glsl";
#include "Sampling.glsl";

varying vec2 v_Texcoord0;

mediump vec4 combine(mediump vec4 bloom, vec2 uv)
{
    mediump vec4 color = texture2D(u_BloomTex, uv);
#ifdef Gamma_u_BloomTex
    color = gammaToLinear(color);
#endif // Gamma_u_BloomTex
    return bloom + color;
}

void fragUpsampleBox()
{
    mediump vec4 bloom = upsampleBox(u_MainTex, v_Texcoord0, u_MainTex_TexelSize.xy, vec4(u_SampleScale));
    gl_FragColor = combine(bloom, v_Texcoord0);
}

void main()
{
    fragUpsampleBox();

    gl_FragColor = outputTransform(gl_FragColor);
}