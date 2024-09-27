#if !defined(SpineFragment_lib)
        #define SpineFragment_lib

varying vec2 vUv;
varying vec4 vColor;

#ifdef COLOR_FILTER
    uniform vec4 u_colorAlpha;
    uniform mat4 u_colorMat;
#endif

#ifdef SPINE_CULLING_CONTROL
    uniform vec4 u_spineCulling;
#endif

#ifdef SPINE_ALPHA_CONTROL
    uniform float u_spineAlpha;
#endif

vec4 getColor(){
    return texture2D(u_spineTexture, vUv.xy)*vColor;//vec4(1.0,0.0,0.0,1.0);
}

void setglColor(){
    #ifdef COLOR_FILTER
        mat4 alphaMat = u_colorMat;

        alphaMat[0][3] *= gl_FragColor.a;
        alphaMat[1][3] *= gl_FragColor.a;
        alphaMat[2][3] *= gl_FragColor.a;

        gl_FragColor = gl_FragColor * alphaMat;
        gl_FragColor += u_colorAlpha / 255.0 * gl_FragColor.a;
    #endif
}

void checkClip(){
    #ifdef SPINE_CULLING_CONTROL
    if(u_spineCulling.x+u_spineCulling.y+u_spineCulling.z+u_spineCulling.w<=0.0) return;
        vec2 pc = gl_FragCoord.xy;
        if(pc.x<u_spineCulling.x) discard;
        if(pc.x>u_spineCulling.z) discard;
        if(pc.y>u_spineCulling.y) discard;
        if(pc.y<u_spineCulling.w) discard;
    #endif
}

void setAlpha(){
    #ifdef SPINE_ALPHA_CONTROL
        gl_FragColor *= u_spineAlpha;
    #endif
}

#endif //SpineFragment_lib