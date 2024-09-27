#define SHADER_NAME SpineStandardFS
#include "SpineFragment.glsl"

void main(){
    checkClip();
    gl_FragColor = getColor();
    setglColor();
    setAlpha();
}