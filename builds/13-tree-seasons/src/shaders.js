// src/shaders.js
// All GLSL for the scene. Each named constant at the top of a chunk says what it changes.

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler2DShadow;
`;

// Uniforms shared by every scene program. Unused ones are dropped by the compiler.
const SHARED = `
uniform mat4 uViewProj;
uniform mat4 uShadowMat;      // world -> shadow map (0..1)
uniform vec3 uCam;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb;
uniform vec3 uFogCol;
uniform float uFogDensity;
uniform float uTime;
uniform float uYear;
uniform float uWind;
uniform vec2 uWindDir;
uniform float uSnow;
uniform float uShadowStrength;
uniform float uShadowTexel;
uniform float uLdr;           // 1 when the scene target is 8-bit and colours must be squeezed
uniform float uCloud;         // 0 clear sky .. 1 overcast
uniform float uShadeDepth;    // how much direct sun a passing cloud takes away (0 = none)
`;

const NOISE = `
float hash11(float n){ return fract(sin(n)*43758.5453123); }
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float hash31(vec3 p){ p=fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
// Smooth noise read from a small texture of random numbers (see noiseTexture in scene.js): one
// lookup does the work of four (2D) or eight (3D) hashes. The texture's own blending does the
// mixing; easing f first keeps it as smooth as the worked-out version.
uniform sampler2D uNoise;
float noise2(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return texture(uNoise,(mod(i,256.)+f+0.5)/256.).r;
}
// The green channel holds the red channel shifted by (37,17), which stands in for the next layer up.
float noise3(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  vec2 rg=texture(uNoise,(mod(i.xy+vec2(37.,17.)*i.z,256.)+f.xy+0.5)/256.).rg;
  return mix(rg.r,rg.g,f.z);
}
// The worked-out version: slower, but exact. Used where one cell of noise is stretched over a
// huge area and the texture's 256 blending steps would show as faint bands.
float noise2h(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y);
}
float fbm2x2h(vec2 p){ return 0.667*noise2h(p)+0.333*noise2h(p*2.03+17.1); }
float fbm2(vec2 p){ float a=0.5,s=0.; for(int i=0;i<4;i++){ s+=a*noise2(p); p=p*2.03+17.1; a*=0.5; } return s; }
float fbm2x2(vec2 p){ return 0.667*noise2(p)+0.333*noise2(p*2.03+17.1); }   // two octaves, for broad patches
float fbm3(vec3 p){ float a=0.5,s=0.; for(int i=0;i<4;i++){ s+=a*noise3(p); p=p*2.03+7.3; a*=0.5; } return s; }
`;

// Patchy snow: where the lying snow has not melted yet (1 = covered).
const SNOW_MASK = `
float snowMask(vec2 p){ float n=fbm2(p*0.35+11.); return smoothstep(n-0.12, n+0.12, uSnow*1.25-0.1); }
`;

// The whole tree leans and shivers in the wind. Bark, twigs and leaves all use this one function
// so they stay glued together.
const SWAY = `
const float TREE_HEIGHT = 10.0;   // metres; sway grows with height squared
const float SWAY_TOP = 0.10;      // metres of travel at the top in a fresh breeze
const float SWAY_REACH = 0.006;   // extra travel per metre out from the trunk
vec3 sway(vec3 p, float t, float wind){
  float h=clamp(p.y/TREE_HEIGHT,0.,1.);
  float a=h*h*SWAY_TOP + length(p.xz)*SWAY_REACH*h;
  float gust=0.6+0.4*sin(t*0.37+p.x*0.11);
  vec3 o;
  o.x=sin(t*0.9+p.z*0.35+p.y*0.2)+0.5*sin(t*2.3+p.x*1.3);
  o.z=cos(t*0.7+p.x*0.31)+0.5*sin(t*2.9+p.z*1.1+1.7);
  o.y=0.3*sin(t*1.7+p.x*0.9+p.z*0.7);
  return o*a*wind*gust;
}
`;

// Gusts: wide, shallow fronts of harder wind that roll across the meadow. Grass and flowers bow
// as one passes, and the far field lightens with it, so the wind can be seen coming.
const GUST = `
const float GUST_SIZE = 11.;    // metres from one gust front to the next
const float GUST_SPEED = 5.;    // metres per second they travel
float gustAt(vec2 p){
  vec2 q=(p-uWindDir*uTime*GUST_SPEED)/GUST_SIZE;
  q=vec2(dot(q,uWindDir), dot(q,vec2(-uWindDir.y,uWindDir.x))*0.45);   // long across the wind, short along it
  return smoothstep(0.45,0.85,noise2(q)*0.65+noise2(q*2.3+9.)*0.35);
}
`;

const SHADOW = `
uniform sampler2DShadow uShadowMap;
// Slow patches of sun and shade from the clouds, drifting downwind over everything.
const float CLOUD_SHADE_SIZE = 60.;   // metres across one patch
const float CLOUD_SHADE_DRIFT = 2.4;  // metres per second
float cloudShade(vec2 p){
  if(uShadeDepth<0.01) return 1.;
  float n=noise2h((p-uWindDir*uTime*CLOUD_SHADE_DRIFT)/CLOUD_SHADE_SIZE+7.);
  float edge=mix(0.74,0.45,uCloud);      // more cloud, more of the ground in shade
  return 1.-uShadeDepth*smoothstep(edge-0.13,edge+0.13,n);
}
// spread = blur radius in shadow texels. Bigger = softer edge.
float shadowAt(vec3 wp, float spread){
  vec3 s=(uShadowMat*vec4(wp,1.)).xyz;
  if(s.x<0.||s.x>1.||s.y<0.||s.y>1.||s.z<0.||s.z>1.) return cloudShade(wp.xz);
  float r=spread*uShadowTexel;
  float sum=texture(uShadowMap,s);
  sum+=texture(uShadowMap,vec3(s.xy+vec2(-0.326,-0.406)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2(-0.840,-0.074)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2(-0.696, 0.457)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2(-0.203, 0.621)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2( 0.962,-0.195)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2( 0.473,-0.480)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2( 0.519, 0.767)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2( 0.185,-0.893)*r,s.z));
  return mix(1., sum/9., uShadowStrength)*cloudShade(wp.xz);
}
// Four taps instead of nine: enough for leaves, where the crown's own noise hides the grain.
float shadowAt4(vec3 wp, float spread){
  vec3 s=(uShadowMat*vec4(wp,1.)).xyz;
  if(s.x<0.||s.x>1.||s.y<0.||s.y>1.||s.z<0.||s.z>1.) return cloudShade(wp.xz);
  float r=spread*uShadowTexel;
  float sum=texture(uShadowMap,vec3(s.xy+vec2(-0.35,-0.35)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2( 0.35,-0.35)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2(-0.35, 0.35)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2( 0.35, 0.35)*r,s.z));
  return mix(1., sum/4., uShadowStrength)*cloudShade(wp.xz);
}
`;

const OUTPUT = `
out vec4 fragColor;
const float FOG_START = 42.;   // metres of clear air in front of the lens before haze builds up
vec3 applyFog(vec3 c, vec3 wp){
  float d=max(length(wp-uCam)-FOG_START,0.);
  return mix(c, uFogCol, 1.-exp(-d*uFogDensity));
}
vec4 encodeOut(vec3 c){ c=max(c,0.); return vec4(uLdr>0.5 ? c/(1.+c) : c, 1.); }
const vec3 SNOW_ALBEDO = vec3(0.86,0.90,0.96);
`;

// ---------------------------------------------------------------------------------------------
// Bark: trunk, boughs and twigs.
const BARK_VS_BODY = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aTan;
layout(location=3) in float aRad;
const float SNOW_DEPTH_MAX = 0.055;  // metres of snow piled on a thick bough
const float SNOW_DEPTH_MIN = 0.012;  // metres of snow on the thinnest twig
#ifndef SHADOW_PASS
out vec3 vWorld; out vec3 vRest; out vec3 vNrm; out vec3 vTan; out float vRad;
#endif
void main(){
  float up=smoothstep(0.15,0.85,aNrm.y);
  vec3 p=aPos+aNrm*(uSnow*up*min(SNOW_DEPTH_MAX, SNOW_DEPTH_MIN+aRad*0.5));
  p+=sway(aPos,uTime,uWind);
  gl_Position=uViewProj*vec4(p,1.);
#ifndef SHADOW_PASS
  vWorld=p; vRest=aPos; vNrm=aNrm; vTan=aTan; vRad=aRad;
#endif
}
`;

const BARK_FS = HEAD + SHARED + NOISE + SHADOW + OUTPUT + `
in vec3 vWorld; in vec3 vRest; in vec3 vNrm; in vec3 vTan; in float vRad;
const float BARK_STRETCH = 0.88;    // 0 = round blobs, 0.95 = long fissures running along the branch
const float BARK_SCALE_TRUNK = 15.; // ridges per metre on the trunk
const float BARK_SCALE_TWIG = 60.;  // ridges per metre on twigs
const float BARK_BUMP = 0.014;      // depth of the fissures in metres
const vec3 BARK_YOUNG = vec3(0.15,0.085,0.058);   // red-brown young wood
const vec3 BARK_CRACK = vec3(0.030,0.026,0.022);
const vec3 BARK_RIDGE = vec3(0.23,0.20,0.165);
const vec3 LICHEN = vec3(0.30,0.33,0.24);
const vec3 MOSS = vec3(0.06,0.12,0.02);
vec3 bumpNormal(vec3 N, vec3 p, float h, float amt){
  vec3 dpx=dFdx(p), dpy=dFdy(p);
  float hx=dFdx(h), hy=dFdy(h);
  vec3 r1=cross(dpy,N), r2=cross(N,dpx);
  float det=dot(dpx,r1);
  vec3 g=sign(det)*(hx*r1+hy*r2);
  return normalize(abs(det)*N-amt*g);
}
void main(){
  vec3 N=normalize(vNrm);
  vec3 T=normalize(vTan);
  float thick=smoothstep(0.012,0.09,vRad);
  // Squash the coordinate that runs along the branch so the noise becomes long ridges. No UV seam.
  vec3 q=vRest-T*dot(vRest,T)*BARK_STRETCH;
  float sc=mix(BARK_SCALE_TWIG,BARK_SCALE_TRUNK,thick);
  float ridge=fbm3(q*sc);
  ridge=1.-abs(2.*ridge-1.);
  float fine=noise3(vRest*95.);
  float h=ridge*0.8+fine*0.2;
  vec3 Nb=bumpNormal(N,vWorld,h,BARK_BUMP*thick);
  vec3 col=mix(BARK_YOUNG*(0.7+0.6*h), mix(BARK_CRACK,BARK_RIDGE,smoothstep(0.3,0.9,h)), thick);
  float lich=smoothstep(0.58,0.78,fbm3(vRest*3.1+7.))*thick;
  col=mix(col,LICHEN*(0.7+0.5*fine),lich*0.5);
  float moss=smoothstep(1.5,0.0,vRest.y)*smoothstep(0.35,0.7,fbm3(vRest*5.+3.));
  col=mix(col,MOSS,moss*0.7*(1.-uSnow));

  float sh=shadowAt(vWorld+N*0.05,1.5);
  float ndl=max(dot(Nb,uSunDir),0.);
  vec3 amb=mix(uGroundAmb,uSkyAmb,Nb.y*0.5+0.5)*mix(0.5,1.,h);
  vec3 lit=col*(ndl*sh*uSunCol+amb);

  float sn=uSnow*smoothstep(0.2,0.65,N.y+(fbm3(vRest*6.)-0.5)*0.5);
  vec3 snowLit=SNOW_ALBEDO*(max(dot(N,uSunDir),0.)*sh*uSunCol*0.9+mix(uGroundAmb,uSkyAmb,0.8)*1.05);
  lit=mix(lit,snowLit,sn);
  fragColor=encodeOut(applyFog(lit,vWorld));
}
`;

// ---------------------------------------------------------------------------------------------
// Leaves and blossom. One instanced program draws both (uKind 0 = leaf, 1 = flower).
// Every leaf's whole life (bud, grow, turn, fall, lie, vanish) is worked out here from uYear.
const LEAF_VS_BODY = `
layout(location=0) in vec3 aLocal;
layout(location=1) in vec3 iPos;
layout(location=2) in vec3 iDir;
layout(location=3) in vec3 iNrm;
layout(location=4) in vec4 iRand;   // three random numbers, then length in metres
layout(location=5) in vec3 iSched;  // grow start, turn start, fall start (years)
layout(location=6) in vec3 iMisc;   // height in crown, outerness, ambient occlusion
uniform float uKind;
uniform vec2 uFade;          // fallen pieces shrink away between these two times
uniform float uYearSeconds;  // length of the year on screen
uniform float uGrowDur;      // time to reach full size (years)
uniform float uTurnDur;      // time to change colour (years)
uniform float uSizeMul;      // phones draw fewer, larger leaves
const float FALL_SPEED = 3.6;      // metres per second
const float DRIFT_PER_M = 0.5;     // metres carried downwind per metre fallen
const float SCATTER = 3.2;         // radius of the random landing spread in metres
const float FLUTTER = 0.4;         // side-to-side swing while falling, metres
const float LEAF_HALF_WIDTH = 0.31; // half width as a share of length
const float LEAF_FOLD = 0.13;      // how far the edges lift (V fold along the midrib)
const float LEAF_CURL = 0.16;      // how far the tip droops
#ifndef SHADOW_PASS
out vec3 vWorld; out vec3 vNrm; out vec2 vLocal; out vec4 vParam; out float vAge; out float vTone;
#endif
const float CLUMP_SIZE = 0.9;      // metres; neighbouring leaves share a tone over about this distance
vec3 rotAxis(vec3 v, vec3 k, float a){ float c=cos(a), s=sin(a); return v*c+cross(k,v)*s+k*dot(k,v)*(1.-c); }
void main(){
  float grow=smoothstep(iSched.x, iSched.x+uGrowDur, uYear);
  float fallDur=max(iPos.y,1.)/FALL_SPEED/uYearSeconds;
  float f=clamp((uYear-iSched.z)/fallDur,0.,1.);
  float gone=smoothstep(uFade.x,uFade.y,uYear);
  float size=iRand.w*uSizeMul*grow*(1.-gone);
  if(uKind>0.5) size*=mix(1.,0.5,f);
  if(size<0.0005){ gl_Position=vec4(2.,2.,2.,1.); return; }

  vec3 attach=iPos+sway(iPos,uTime,uWind);
  vec2 h2=vec2(hash11(iRand.x*91.7+1.3), hash11(iRand.y*57.3+2.1));
  float ang=h2.x*6.2831;
  vec2 land2=iPos.xz+uWindDir*(iPos.y*DRIFT_PER_M)+vec2(cos(ang),sin(ang))*sqrt(h2.y)*SCATTER;
  vec3 land=vec3(land2.x, 0.015+iRand.z*0.04, land2.y);
  vec3 p=mix(attach,land,vec3(f,pow(f,1.25),f));
  float air=sin(f*3.14159);
  p.x+=sin(f*(9.+6.*h2.x)+iRand.x*40.)*FLUTTER*air;
  p.z+=cos(f*(8.+7.*h2.y)+iRand.y*40.)*FLUTTER*air;
  float landed=smoothstep(0.92,1.,f);

  vec3 A=iDir, N=iNrm;
  float hanging=1.-step(0.0001,f);
  float flutter=uWind*hanging*(sin(uTime*(4.+3.*iRand.z)+iRand.x*50.)*0.35+sin(uTime*1.3+iPos.x)*0.2);
  N=rotAxis(N,A,flutter);
  vec3 tAxis=normalize(vec3(cos(ang*3.),0.3,sin(ang*3.)));
  float th=f*(5.+9.*h2.x)*(1.-landed);
  A=rotAxis(A,tAxis,th); N=rotAxis(N,tAxis,th);
  vec3 A2=vec3(cos(ang*5.),0.,sin(ang*5.));
  vec3 N2=normalize(vec3((h2.x-0.5)*0.7,1.,(h2.y-0.5)*0.7));
  A=normalize(mix(A,A2,landed)); N=normalize(mix(N,N2,landed));
  vec3 B=normalize(cross(N,A)); N=cross(A,B);

  vec3 lp; vec3 nrm;
  if(uKind<0.5){
    float ax=abs(aLocal.x);
    float curl=LEAF_CURL*(1.+1.5*landed);
    float z=ax*LEAF_FOLD-aLocal.y*aLocal.y*curl;
    lp=A*aLocal.y+B*aLocal.x*LEAF_HALF_WIDTH+N*z;
    nrm=normalize(N-B*sign(aLocal.x)*ax*LEAF_FOLD*2.2+A*aLocal.y*curl*1.6);
  } else {
    lp=(A*aLocal.y+B*aLocal.x)*0.5; nrm=N;
  }
  vec3 wp=p+lp*size;
  gl_Position=uViewProj*vec4(wp,1.);
#ifndef SHADOW_PASS
  vWorld=wp; vNrm=nrm; vLocal=aLocal.xy;
  vParam=vec4(smoothstep(iSched.y,iSched.y+uTurnDur,uYear), iRand.y, iMisc.z, landed);
  vAge=clamp((uYear-(iSched.z+fallDur))/0.07,0.,1.);
  vTone=noise3(iPos/CLUMP_SIZE+3.1);
#endif
}
`;

const LEAF_FS = HEAD + SHARED + NOISE + SHADOW + OUTPUT + `
in vec3 vWorld; in vec3 vNrm; in vec2 vLocal; in vec4 vParam; in float vAge; in float vTone;
uniform float uKind;
const float VEIN_COUNT = 6.;       // side veins per leaf
const float VEIN_DEPTH = 0.2;      // how much darker a vein is than the blade
const vec3 LEAF_FRESH = vec3(0.34,0.50,0.07);   // new spring leaf
const vec3 LEAF_DEEP = vec3(0.065,0.19,0.035);  // mature summer leaf
const vec3 LEAF_YELLOW = vec3(0.78,0.52,0.04);
const vec3 LEAF_ORANGE = vec3(0.72,0.26,0.03);
const vec3 LEAF_RED = vec3(0.45,0.07,0.03);
const vec3 LEAF_BROWN = vec3(0.19,0.105,0.05);  // dry leaf on the ground
const vec3 PETAL_EDGE = vec3(0.98,0.95,0.94);
const vec3 PETAL_HEART = vec3(0.93,0.78,0.83);
const float TRANSLUCENCY = 0.85;   // light let through a leaf when the sun is behind it
const float LEAF_GLOSS = 0.2;      // strength of the waxy highlight
void main(){
  vec3 N=normalize(vNrm);
  if(!gl_FrontFacing) N=-N;
  vec3 V=normalize(uCam-vWorld);
  vec3 L=uSunDir;
  vec3 base; vec3 through; float trans; float gloss;
  float turn=vParam.x, landed=vParam.w;
  if(uKind<0.5){
    // Colour creeps in from the edges and tip, so half-turned leaves are two-tone.
    float t=clamp(turn+(abs(vLocal.x)*0.6+vLocal.y*0.3-0.45)*0.7*sin(turn*3.14159),0.,1.);
    float mature=smoothstep(0.14,0.36,uYear);
    vec3 green=mix(LEAF_FRESH,LEAF_DEEP,mature)*(0.78+0.44*vParam.y);
    green=mix(green*0.72, green*vec3(1.35,1.22,0.9), smoothstep(0.25,0.75,vTone));   // whole sprays are darker or yellower
    float r=clamp(vParam.y*0.6+vTone*0.6-0.1,0.,1.);                                 // and turn similar colours together
    vec3 aut=r<0.5 ? mix(LEAF_YELLOW,LEAF_ORANGE,r*2.) : mix(LEAF_ORANGE,LEAF_RED,(r-0.5)*2.);
    base=mix(green, mix(vec3(0.50,0.52,0.06),aut,smoothstep(0.35,1.,t)), smoothstep(0.,0.5,t));
    base=mix(base,LEAF_BROWN*(0.7+0.6*r),vAge*0.85);
    float rib=smoothstep(0.07,0.,abs(vLocal.x));
    float vein=smoothstep(0.07,0.,abs(fract(vLocal.y*VEIN_COUNT-abs(vLocal.x)*1.8)-0.5));
    vein*=clamp(1.-fwidth(vLocal.y)*VEIN_COUNT*2.5,0.,1.);   // fades out when a leaf is only a few pixels long
    base*=1.-0.22*rib-VEIN_DEPTH*vein*(1.-rib);
    through=pow(base,vec3(0.75))*vec3(1.15,1.2,0.55);
    trans=TRANSLUCENCY*(1.-0.6*vAge);
    gloss=LEAF_GLOSS*(1.-turn);
  } else {
    float r=length(vLocal);
    float a=atan(vLocal.y,vLocal.x);
    float petal=0.62+0.38*abs(cos(a*2.5+vParam.y*6.));
    if(r>petal) discard;
    base=mix(PETAL_HEART,PETAL_EDGE,smoothstep(0.1,0.7,r));
    base=mix(base,vec3(0.85,0.62,0.12),smoothstep(0.2,0.06,r));
    through=base; trans=0.9; gloss=0.;
  }
  float ndl=dot(N,L);
  float sh=shadowAt4(vWorld+N*0.06,1.6);
  float ao=mix(vParam.z,1.,landed);
  vec3 direct=uSunCol*sh;
  vec3 amb=mix(uGroundAmb,uSkyAmb,N.y*0.5+0.5)*ao;
  if(uKind>0.5) amb=uSkyAmb*1.2;   // petals are thin and bright from every side
  vec3 col=base*(max(ndl,0.)*direct+amb);
  float towardSun=pow(max(dot(-V,L),0.),2.);
  col+=through*max(-ndl,0.)*direct*trans*(0.55+1.2*towardSun);
  vec3 H=normalize(L+V);
  col+=direct*pow(max(dot(N,H),0.),48.)*gloss*max(ndl,0.);
  // Lying leaves are dusted, then buried, by snow.
  vec3 snowLit=SNOW_ALBEDO*(max(L.y,0.)*direct*0.9+uSkyAmb);
  col=mix(col,snowLit,clamp(uSnow*1.6,0.,1.)*landed*smoothstep(0.,0.6,N.y));
  fragColor=encodeOut(applyFog(col,vWorld));
}
`;

// ---------------------------------------------------------------------------------------------
// Ground.
const GROUND_VS = HEAD + SHARED + `
layout(location=0) in vec2 aPos;
out vec3 vWorld;
void main(){
  vWorld=vec3(aPos.x,0.,aPos.y);
  gl_Position=uViewProj*vec4(vWorld,1.);
}
`;

const GROUND_FS = HEAD + SHARED + NOISE + SNOW_MASK + GUST + SHADOW + OUTPUT + `
in vec3 vWorld;
uniform vec3 uGrassA; uniform vec3 uGrassB; uniform vec3 uHill;
uniform float uCanopy;
uniform float uFlowers;    // 0 none .. 1 the meadow in full flower
const vec3 DRIFT_YELLOW = vec3(0.62,0.55,0.08);   // far buttercups
const vec3 DRIFT_PALE = vec3(0.62,0.60,0.56);     // far daisies and clover
const float GROUND_HAZE = 0.3;   // the meadow hazes more slowly than the air above it, so no white band at the horizon
const vec3 SOIL = vec3(0.07,0.05,0.035);   // worn earth at the foot of the trunk
const float SNOW_DRIFT_SCALE = 0.22;  // size of snow drifts; smaller = broader
const float SNOW_RELIEF = 3.2;        // steepness of the drifts
const float SHADE_UNDER_CROWN = 0.25;       // how much skylight the full crown blocks
void main(){
  vec2 p=vWorld.xz;
  float d=length(vWorld-uCam);
  float big=fbm2x2(p*0.07);
  float mid=fbm2x2(p*0.9+3.);
  float fine=noise2(p*38.)*0.6+noise2(p*90.)*0.4;
  fine=mix(0.5,fine,exp(-d*0.02));
  vec3 col=mix(uGrassA,uGrassB,clamp(big*0.7+mid*0.5+(fine-0.5)*0.5,0.,1.));
  float r=length(p);
  // Beyond the blades the meadow is paint: combed by the wind, crossed by gusts, and in the
  // warm months washed with drifts of flowers too far off to see one by one.
  float nearish=exp(-d*0.012);
  vec2 across=vec2(dot(p,uWindDir)*0.06, dot(p,vec2(-uWindDir.y,uWindDir.x))*0.5);
  col*=mix(1.,0.88+0.24*noise2(across+13.),nearish);
  col*=1.+0.20*(gustAt(p)-0.3)*uWind*(1.-uSnow);
  if(uFlowers>0.01){
    float out2=smoothstep(14.,30.,r)*exp(-d*0.004)*uFlowers;
    float speck=mix(1.,0.4+1.2*fine,exp(-d*0.03));
    col=mix(col,DRIFT_YELLOW,smoothstep(0.62,0.88,noise2(p*0.11+31.))*0.42*out2*speck);
    col=mix(col,DRIFT_PALE,smoothstep(0.64,0.90,noise2(p*0.16+57.))*0.30*out2*speck);
  }
  float bare=smoothstep(1.5,0.5,r+(mid-0.5)*0.8);
  col=mix(col,SOIL,bare*0.75);
  float sh=shadowAt(vWorld+vec3(0.,0.03,0.),3.5);
  float ao=mix(1., 1.-SHADE_UNDER_CROWN*(1.-smoothstep(1.,7.5,r)), uCanopy);
  ao*=0.55+0.45*smoothstep(0.25,1.3,r);     // contact shadow at the trunk
  float ndl=max(uSunDir.y,0.);
  vec3 lit=col*(ndl*sh*uSunCol*0.9+uSkyAmb*1.4*ao);
  if(uSnow>0.001){   // the snow maths is skipped for three seasons of the year
    float sn=snowMask(p);
    // Soft drifts: tilt the snow surface by the slope of a broad noise, so the low sun rakes across it.
    float h0=fbm2x2h(p*SNOW_DRIFT_SCALE+4.);
    float hx=fbm2x2h((p+vec2(0.35,0.))*SNOW_DRIFT_SCALE+4.);
    float hz=fbm2x2h((p+vec2(0.,0.35))*SNOW_DRIFT_SCALE+4.);
    vec3 ns=normalize(vec3((h0-hx)*SNOW_RELIEF,1.,(h0-hz)*SNOW_RELIEF));
    float nds=max(dot(ns,uSunDir),0.);
    float sparkle=step(0.985,hash21(floor(p*220.)))*exp(-d*0.03);
    vec3 snowLit=SNOW_ALBEDO*(nds*sh*uSunCol*(1.1+sparkle*2.)+uSkyAmb*ao*(0.9+0.2*h0));
    lit=mix(lit,snowLit,sn);
  }
  float haze=1.-exp(-max(d-FOG_START,0.)*uFogDensity*GROUND_HAZE);
  fragColor=encodeOut(mix(lit,mix(uFogCol,uHill,0.25),haze));
}
`;

// ---------------------------------------------------------------------------------------------
// Grass blades around the tree.
const GRASS_VS = HEAD + SHARED + NOISE + SNOW_MASK + GUST + `
layout(location=0) in vec2 aBlade;   // x: -1..1 across, y: 0..1 up
layout(location=1) in vec4 iPos;     // x, z, height in metres, turn in radians
layout(location=2) in vec2 iRnd;
uniform float uGrassH;
const float BLADE_WIDTH = 0.016;     // half width at the base in metres
out float vT; out vec3 vWorld; out float vRnd; out float vSnow; out float vGust;
const float GUST_BOW = 0.55;         // how much further a blade leans as a gust passes
void main(){
  vec2 base=iPos.xy;
  float sn=uSnow>0.001 ? snowMask(base) : 0.;
  float h=iPos.z*uGrassH*(1.-0.8*sn);
  float c=cos(iPos.w), s=sin(iPos.w);
  float t=aBlade.y;
  float ph=uTime*1.6+base.x*0.35+base.y*0.27;
  float gust=gustAt(base)*uWind;
  float bend=0.18+0.25*iRnd.x+uWind*0.22*(sin(ph)+0.5*sin(ph*2.7+iRnd.y*6.))+GUST_BOW*gust;
  vec3 side=vec3(c,0.,s), fwd=vec3(-s,0.,c);
  vec3 lean=vec3(uWindDir.x,0.,uWindDir.y)*bend+fwd*0.3*(iRnd.y-0.5);
  vec3 p=vec3(base.x,0.,base.y);
  p+=side*aBlade.x*BLADE_WIDTH*(1.-t*0.85)+vec3(0.,1.,0.)*t*h*(1.-0.3*t*bend*bend)+lean*t*t*h;
  vT=t; vWorld=p; vRnd=iRnd.x; vSnow=sn; vGust=gust;
  gl_Position=uViewProj*vec4(p,1.);
}
`;

const GRASS_FS = HEAD + SHARED + NOISE + SHADOW + OUTPUT + `
in float vT; in vec3 vWorld; in float vRnd; in float vSnow; in float vGust;
uniform vec3 uGrassA; uniform vec3 uGrassB;
void main(){
  vec3 col=mix(uGrassA*0.75,uGrassB*1.15,vT)*(0.8+0.4*vRnd);
  col*=1.+0.4*vGust*vT;   // bowed blades show their pale, shiny sides
  float sh=shadowAt4(vWorld+vec3(0.,0.03,0.),3.);
  vec3 V=normalize(uCam-vWorld);
  float back=pow(max(dot(-V,uSunDir),0.),3.);
  vec3 lit=col*(uSunCol*sh*(0.35+0.45*uSunDir.y+0.9*back*vT)+uSkyAmb*(0.6+0.6*vT));
  vec3 snowLit=SNOW_ALBEDO*(max(uSunDir.y,0.)*sh*uSunCol+uSkyAmb);
  lit=mix(lit,snowLit,vSnow*(1.-vT)*0.7);
  fragColor=encodeOut(applyFog(lit,vWorld));
}
`;

// ---------------------------------------------------------------------------------------------
// Sky, clouds and far hills. Drawn first, as one big triangle.
const SCREEN_VS = HEAD + `
out vec2 vUv;
uniform float uZ;   // 1 puts the triangle on the far plane, so it only fills pixels nothing else covered
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
  vUv=p;
  gl_Position=vec4(p*2.-1.,uZ,1.);
}
`;

const SKY_FS = HEAD + SHARED + NOISE + OUTPUT + `
in vec2 vUv;
uniform mat4 uInvViewProj;
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uHill;
uniform vec3 uWood;        // colour of the wood on the near ridge at this time of year
uniform float uWoodBare;   // 1 when its trees are leafless
const float CLOUD_RING = 3.0;        // size of cloud banks round the horizon; bigger = more, smaller banks
const float CLOUD_RISE = 12.;        // vertical squash; bigger = flatter clouds
const float CLOUD_LIGHT_STEP = 0.02; // how far up to look when shading cloud tops
const float CLOUD_DRIFT = 0.008;     // speed of drift across the sky
const float CLOUD_WISP = 0.16;       // how ragged the cloud edges are
const float WOOD_HEIGHT = 0.026;     // how tall the wood on the near ridge stands (about 1.5 degrees)
// Clouds live on a cylinder round the viewer, so they wrap without a seam and do not smear at the horizon.
float cloudDensity(vec2 n2, float el){
  vec3 q=vec3(n2.x*CLOUD_RING+uTime*CLOUD_DRIFT, el*CLOUD_RISE, n2.y*CLOUD_RING);
  return noise3(q)*0.55+noise3(q*2.1+3.7)*0.28+noise3(q*4.3+9.1)*0.17;
}
void main(){
  vec4 farPt=uInvViewProj*vec4(vUv*2.-1.,1.,1.);
  vec3 dir=normalize(farPt.xyz/farPt.w-uCam);
  float el=dir.y;
  vec3 col=mix(uHorizon,uZenith,pow(clamp(el*2.2,0.,1.),0.45));
  float sd=max(dot(dir,uSunDir),0.);
  col+=uSunCol*(pow(sd,700.)*6.+pow(sd,14.)*0.22+pow(sd,3.)*0.07)*(1.-0.6*uCloud);
  vec2 n2=normalize(dir.xz+1e-5);
  // A band of warm, bright air low on the horizon, strongest towards the sun.
  col=mix(col,uHorizon*1.12,exp(-max(el,0.)*14.)*0.5);
  col+=uSunCol*0.05*exp(-max(el,0.)*9.)*pow(sd,1.5);
  if(el>-0.02){
    float d0=cloudDensity(n2,el);
    float d1=cloudDensity(n2,el+CLOUD_LIGHT_STEP);
    // Two finer layers break the edges into wisps. They are left out of the lighting sample.
    vec3 q=vec3(n2.x*CLOUD_RING+uTime*CLOUD_DRIFT, el*CLOUD_RISE, n2.y*CLOUD_RING);
    d0+=(noise3(q*8.7+2.3)-0.5)*CLOUD_WISP+(noise3(q*17.3+5.1)-0.5)*CLOUD_WISP*0.5;
    float lo=mix(0.56,0.28,uCloud);
    float cover=smoothstep(lo,lo+0.16,d0)*smoothstep(-0.02,0.03,el);
    float thick=smoothstep(lo+0.05,lo+0.4,d0);
    float top=smoothstep(-0.04,0.10,d0-d1);          // bright where there is less cloud above
    vec3 sunTint=uSunCol/max(max(uSunCol.r,uSunCol.g),uSunCol.b);
    vec3 bright=mix(vec3(1.),sunTint,0.6)*(0.86+0.25*uSunDir.y+0.5*pow(sd,2.));
    vec3 base=mix(uZenith,uHorizon,0.55)*0.74+uSkyAmb*0.08;   // the grey-blue underside
    vec3 cloudCol=mix(base,bright,clamp(top*(1.15-0.5*thick),0.,1.)*(1.-0.45*uCloud));
    cloudCol+=bright*0.3*(1.-thick)*(0.3+0.7*pow(sd,3.));    // thin edges let the light through
    col=mix(col,cloudCol,cover*0.95);
  }
  // Far hills and a nearer wood. Sampled on a circle so there is no seam. Skipped high in the sky.
  if(el<0.1){
  float h1=0.022+0.030*fbm2x2(n2*2.6+1.3)+0.016*noise2(n2*8.+4.)+0.005*noise2(n2*37.+1.);
  // Haze gathers in the valleys: the hills pale towards their feet.
  vec3 hillFar=mix(uHill*vec3(0.85,1.,1.3),uFogCol,0.5+0.25*smoothstep(h1,0.,el));
  col=mix(col,hillFar,smoothstep(h1+0.004,h1-0.002,el));
  // A wood along the near ridge: rounded crowns in clumps with gaps of hedge between, each
  // crown its own shade, brighter on top. It turns with the seasons like the tree in front.
  float clump=smoothstep(0.3,0.7,noise2(n2*21.+4.));
  float crown=smoothstep(0.2,0.8,noise2(n2*64.+9.));
  float h2=0.006+WOOD_HEIGHT*(0.25+0.75*clump)*(0.45+0.55*crown)+0.003*noise2(n2*310.+2.);
  float tone=noise2(n2*64.+31.)*0.6+noise2(vec2(n2.x*230.,el*420.)+n2.y*190.)*0.4;
  vec3 woodCol=uWood*(0.62+0.7*tone)*(0.8+0.5*smoothstep(h2*0.3,h2,el));
  woodCol+=uSunCol*uWood*0.06*smoothstep(h2*0.5,h2,el);
  woodCol=mix(woodCol,uFogCol,0.22+0.3*smoothstep(h2*0.6,0.,el));
  float edge=mix(0.0015,0.006,uWoodBare);            // bare tops are thin and twiggy
  col=mix(col,woodCol,smoothstep(h2+edge,h2-edge,el)*mix(1.,0.8,uWoodBare));
  }
  if(el<0.) col=mix(uFogCol,uHill,0.25);
  fragColor=encodeOut(col);
}
`;

// ---------------------------------------------------------------------------------------------
// Falling snow.
const FLAKE_VS = HEAD + SHARED + `
layout(location=0) in vec4 aSeed;
uniform vec3 uFlakeCentre;
uniform float uPixels;       // screen height in pixels
uniform float uFovScale;     // 1 / tan(fov / 2)
uniform float uFlakeFall;    // 1 = falling snow, about 0.03 = pollen and seed fluff hanging in the air
uniform float uFlakeScale;   // size against a snowflake
const vec3 FLAKE_BOX = vec3(90.,24.,90.);  // metres; flakes wrap round inside this box
const float FLAKE_SIZE = 0.055;            // metres
out float vFade;
void main(){
  vec3 p=aSeed.xyz*FLAKE_BOX;
  p.y=mod(p.y-uTime*(1.1+aSeed.w*0.9)*uFlakeFall,FLAKE_BOX.y);
  p.xz=mod(p.xz+uWindDir*uTime*0.8+vec2(sin(uTime*0.7+aSeed.w*30.),cos(uTime*0.6+aSeed.w*17.))*0.5,FLAKE_BOX.xz)-FLAKE_BOX.xz*0.5+uFlakeCentre.xz;
  gl_Position=uViewProj*vec4(p,1.);
  float px=FLAKE_SIZE*uFlakeScale*(0.6+0.8*aSeed.w)*uFovScale*uPixels/max(gl_Position.w,0.1);
  vFade=clamp(px,0.,1.);
  gl_PointSize=clamp(px,1.,24.);
}
`;

const FLAKE_FS = HEAD + SHARED + OUTPUT + `
in float vFade;
uniform float uFlakes;
uniform vec3 uFlakeTint;
void main(){
  float a=smoothstep(0.5,0.15,length(gl_PointCoord-0.5))*uFlakes*vFade;
  vec3 c=uFlakeTint*(uSkyAmb*1.25+uSunCol*0.22);
  fragColor=vec4(uLdr>0.5 ? c/(1.+c) : c, a);
}
`;

// ---------------------------------------------------------------------------------------------
// Small animals (birds, squirrel). One mesh per kind, drawn once per animal with its own matrix.
const CRITTER_VS_BODY = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aInfo;   // part (0 body, 1 left wing, 2 right wing, 3 tail), colour region
uniform mat4 uModel;
uniform float uFlap;   // wing angle in radians (0 = level, positive = up)
uniform float uFold;   // 1 = wings shut against the body
uniform float uTail;   // tail swing in radians
const vec2 WING_ROOT = vec2(0.040, 0.016);   // height and half width of the wing joint in the bird model
const vec2 TAIL_ROOT = vec2(-0.095, 0.050);  // where the squirrel's tail joins the body (x, y)
#ifndef SHADOW_PASS
out vec3 vWorld; out vec3 vNrm; out vec3 vLocal; out float vRegion;
#endif
void main(){
  vec3 p=aPos, n=aNrm;
  if(aInfo.x>0.5 && aInfo.x<2.5){
    float side=aInfo.x<1.5 ? 1. : -1.;
    float up=p.y-WING_ROOT.x;
    float outw=(p.z-side*WING_ROOT.y)*side;
    p.x-=uFold*outw*0.45;                 // a shut wing lies back along the body
    outw*=mix(1.,0.12,uFold);
    float a=uFlap*(1.-uFold);
    float c=cos(a), s=sin(a);
    p.y=WING_ROOT.x+up*c+outw*s;
    p.z=side*(WING_ROOT.y+outw*c-up*s);
    n=normalize(vec3(0.,c,-side*s));
  } else if(aInfo.x>2.5){
    vec2 d=p.xy-TAIL_ROOT;
    float a=uTail*min(length(d)*7.,1.5);  // the tip swings further than the root
    float c=cos(a), s=sin(a);
    p.xy=TAIL_ROOT+vec2(d.x*c-d.y*s, d.x*s+d.y*c);
  }
  vec4 w=uModel*vec4(p,1.);
  gl_Position=uViewProj*w;
#ifndef SHADOW_PASS
  vWorld=w.xyz; vNrm=mat3(uModel)*n; vLocal=aPos; vRegion=aInfo.y;
#endif
}
`;

const CRITTER_FS = HEAD + SHARED + NOISE + SHADOW + OUTPUT + `
in vec3 vWorld; in vec3 vNrm; in vec3 vLocal; in float vRegion;
uniform vec3 uColA;   // back
uniform vec3 uColB;   // belly and breast
uniform vec3 uColC;   // beak, feet
uniform vec3 uColD;   // wings and tail
const float COAT_GRAIN = 220.;   // fineness of the fur or feather speckle
void main(){
  vec3 N=normalize(vNrm);
  if(!gl_FrontFacing) N=-N;
  vec3 base=vRegion<0.5 ? uColA : vRegion<1.5 ? uColB : vRegion<2.5 ? uColC : uColD;
  base*=0.82+0.36*noise3(vLocal*COAT_GRAIN);
  float sh=shadowAt4(vWorld+N*0.03,1.5);
  float ndl=max(dot(N,uSunDir),0.);
  vec3 lit=base*(ndl*sh*uSunCol*0.85+mix(uGroundAmb,uSkyAmb,N.y*0.5+0.5)*1.1);
  vec3 V=normalize(uCam-vWorld);
  lit+=uSunCol*0.05*pow(1.-max(dot(N,V),0.),3.)*sh;   // a thin rim so small animals read against the grass
  fragColor=encodeOut(applyFog(lit,vWorld));
}
`;

// ---------------------------------------------------------------------------------------------
// The squirrel. Its body is rebuilt in its pose every frame (engine/squirrel.js), so the vertex
// stage only places it. The work here is the fur.
const FUR_VS_BODY = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCoat;   // a coordinate that stays with the skin, so the fur pattern does not swim
layout(location=3) in vec2 aInfo;   // kind (0 body, 2 eye, 3 tail, 4 ear tuft, 5 nut), belly 0..1
uniform mat4 uModel;
#ifndef SHADOW_PASS
out vec3 vWorld; out vec3 vNrm; out vec3 vCoat; out vec2 vInfo;
#endif
void main(){
  vec4 w=uModel*vec4(aPos,1.);
  gl_Position=uViewProj*w;
#ifndef SHADOW_PASS
  vWorld=w.xyz; vNrm=mat3(uModel)*aNrm; vCoat=aCoat; vInfo=aInfo;
#endif
}
`;

const FUR_FS = HEAD + SHARED + NOISE + SHADOW + OUTPUT + `
in vec3 vWorld; in vec3 vNrm; in vec3 vCoat; in vec2 vInfo;
uniform vec3 uColA;   // back
uniform vec3 uColB;   // belly
uniform vec3 uColC;   // eyes
uniform vec3 uColD;   // tail
const float FUR_STRANDS = 420.;  // fineness of the hairs across the body
const float FUR_GLOW = 0.7;      // how brightly the tips of the fur catch the light at the outline
void main(){
  vec3 N=normalize(vNrm);
  vec3 V=normalize(uCam-vWorld);
  vec3 L=uSunDir;
  float kind=vInfo.x;
  vec3 base=mix(uColA,uColB,smoothstep(0.2,0.7,vInfo.y));
  float fuzz=0.45;
  if(kind>4.5){ base=vec3(0.26,0.15,0.06); fuzz=0.; }
  else if(kind>3.5){ base=uColA*0.45; fuzz=0.9; }
  else if(kind>2.5){ base=uColD; fuzz=1.; }
  else if(kind>1.5){ base=uColC; fuzz=0.; }
  // Hairs lie along the body: fine across it, long along it.
  float strand=noise3(vCoat*vec3(90.,FUR_STRANDS,FUR_STRANDS));
  float blotch=noise3(vCoat*38.+5.);
  base*=0.70+0.42*strand*step(0.01,fuzz)+0.18*blotch;
  float sh=shadowAt4(vWorld+N*0.03,1.5);
  float wrap=clamp((dot(N,L)+0.4)/1.4,0.,1.);              // fur scatters light, so shade creeps round softly
  vec3 amb=mix(uGroundAmb,uSkyAmb,N.y*0.5+0.5)*1.1;
  vec3 lit=base*(wrap*sh*uSunCol*0.9+amb);
  float facing=max(dot(N,V),0.);
  // A ragged outline: hairs, not a smooth skin. The tail is the bushiest.
  if(fuzz>0. && facing<fuzz*0.42*noise3(vCoat*vec3(160.,900.,900.))) discard;
  float edge=pow(1.-facing,2.5);
  float behind=pow(max(dot(-V,L),0.),2.);                  // strongest when the sun is behind the animal
  lit+=base*FUR_GLOW*edge*fuzz*(uSunCol*sh*(0.22+0.9*behind)+uSkyAmb*0.3);
  if(kind>1.5 && kind<2.5) lit+=uSunCol*sh*pow(max(dot(N,normalize(L+V)),0.),30.)*0.8+uSkyAmb*0.25*edge;   // a bright wet eye
  fragColor=encodeOut(applyFog(lit,vWorld));
}
`;

// ---------------------------------------------------------------------------------------------
// Butterflies: each is two flapping quads, its whole flight worked out here from time and a seed.
const FLY_VS = HEAD + SHARED + `
layout(location=0) in vec3 aWing;   // x: along the body -1..1, y: out along the wing 0..1, z: side -1 or 1
layout(location=1) in vec4 iSeed;
uniform float uPresence;            // 0 none .. 1 all of them out
const float FLY_SIZE = 0.10;        // length of one wing in metres (larger than life, to read from far off)
const float FLY_FLAP_HZ = 8.;       // wingbeats per second
const float FLY_ROAM = 1.5;         // metres a butterfly wanders from its home spot
out vec2 vUv; out vec3 vWorld; out float vKind; out float vFacing;
vec3 flyPath(float t, vec4 s){
  float ang=s.x*6.2831+t*0.05*(s.y-0.5);
  float rad=3.0+s.y*9.0;
  // Most stay over the meadow; one in five works the lower edge of the crown.
  vec3 home=vec3(cos(ang)*rad, 0.45+s.z*1.5+step(0.8,s.w)*3.2, sin(ang)*rad);
  vec3 w=vec3(sin(t*0.83+s.x*40.)+0.6*sin(t*1.9+s.y*30.),
              0.45*sin(t*1.31+s.z*50.)+0.25*sin(t*3.7+s.x*9.),
              cos(t*0.71+s.w*40.)+0.6*sin(t*2.3+s.z*20.));
  return home+w*vec3(FLY_ROAM,0.5,FLY_ROAM);
}
void main(){
  float show=smoothstep(0.,0.12,uPresence-iSeed.y*0.85);
  if(show<=0.){ gl_Position=vec4(2.,2.,2.,1.); return; }
  float t=uTime*(0.7+0.5*iSeed.z);
  vec3 p0=flyPath(t,iSeed), p1=flyPath(t+0.08,iSeed);
  vec3 F=normalize(vec3(p1.x-p0.x,0.3*(p1.y-p0.y),p1.z-p0.z)+1e-5);
  vec3 S=normalize(cross(F,vec3(0.,1.,0.)));
  vec3 Up=cross(S,F);
  float ph=uTime*FLY_FLAP_HZ*6.2831*(0.8+0.4*iSeed.w)+iSeed.x*50.;
  float a=0.25+1.05*(0.5+0.5*sin(ph));     // from nearly flat to nearly shut over the back
  p0.y+=0.03*sin(ph);                       // each beat lifts the body a little
  vec3 wingDir=S*aWing.z*cos(a)+Up*sin(a);
  vec3 wp=p0+(F*aWing.x*0.55+wingDir*aWing.y)*FLY_SIZE*show;
  gl_Position=uViewProj*vec4(wp,1.);
  vUv=aWing.xy; vWorld=wp; vKind=iSeed.w;
  vFacing=abs(dot(normalize(cross(F,wingDir)),uSunDir));
}
`;

const FLY_FS = HEAD + SHARED + NOISE + SHADOW + OUTPUT + `
in vec2 vUv; in vec3 vWorld; in float vKind; in float vFacing;
void main(){
  float d=length(vec2(vUv.x*0.9+0.08,(vUv.y-0.5)*1.15));
  if(d>0.6) discard;
  if(vUv.y>0.5 && abs(vUv.x+0.12)<(vUv.y-0.5)*0.22) discard;   // the notch between fore and hind wing
  vec3 base; float border;
  if(vKind<0.35){ base=vec3(0.95,0.95,0.90); border=0.25; }        // white
  else if(vKind<0.6){ base=vec3(0.95,0.84,0.22); border=0.1; }     // yellow
  else if(vKind<0.85){ base=vec3(0.90,0.40,0.07); border=0.95; }   // orange with a dark edge
  else { base=vec3(0.32,0.48,0.95); border=0.6; }                  // blue
  base=mix(base,vec3(0.06,0.05,0.04),smoothstep(0.44,0.58,d)*border);
  float sh=shadowAt4(vWorld,2.);
  vec3 lit=base*(uSunCol*sh*(0.3+0.5*vFacing)+uSkyAmb*1.1);
  fragColor=encodeOut(applyFog(lit,vWorld));
}
`;

// ---------------------------------------------------------------------------------------------
// Meadow flowers: small flower heads that turn to the lens, opening and fading on their own dates.
const FLOWER_VS = HEAD + SHARED + NOISE + GUST + `
layout(location=0) in vec2 aQuad;   // -1..1
layout(location=1) in vec4 iPos;    // x, z, stem height, head size (metres)
layout(location=2) in vec4 iRnd;    // kind, opens (year), fades (year), phase
uniform float uGrassH;
const float FLOWER_SWAY = 0.2;      // how far a flower head leans in the wind, as a share of its height
out vec2 vUv; out float vKind; out vec3 vWorld;
void main(){
  float open=smoothstep(iRnd.y,iRnd.y+0.035,uYear)*(1.-smoothstep(iRnd.z,iRnd.z+0.05,uYear));
  if(open<0.01){ gl_Position=vec4(2.,2.,2.,1.); return; }
  float h=iPos.z*(0.6+0.4*uGrassH);
  float ph=uTime*1.6+iPos.x*0.35+iPos.y*0.27;
  float bend=uWind*(FLOWER_SWAY*(sin(ph)+0.5*sin(ph*2.7+iRnd.w*6.))+0.45*gustAt(iPos.xy));
  vec3 c=vec3(iPos.x,h,iPos.y)+vec3(uWindDir.x,0.,uWindDir.y)*bend*h;
  vec3 toCam=normalize(uCam-c);
  vec3 R=normalize(cross(vec3(0.,1.,0.),toCam));
  vec3 Up=normalize(mix(vec3(0.,1.,0.),cross(toCam,R),0.75));
  vec3 wp=c+(R*aQuad.x+Up*aQuad.y)*iPos.w*open;
  gl_Position=uViewProj*vec4(wp,1.);
  vUv=aQuad; vKind=iRnd.x; vWorld=wp;
}
`;

const FLOWER_FS = HEAD + SHARED + NOISE + SHADOW + OUTPUT + `
in vec2 vUv; in float vKind; in vec3 vWorld;
void main(){
  float r=length(vUv), a=atan(vUv.y,vUv.x);
  vec3 col; float edge;
  if(vKind<0.45){          // daisy: white rays, yellow eye
    edge=0.55+0.45*abs(cos(a*6.));
    col=mix(vec3(0.95,0.78,0.10),vec3(0.97,0.97,0.94),smoothstep(0.2,0.3,r));
  } else if(vKind<0.75){   // buttercup
    edge=0.8+0.2*abs(cos(a*2.5));
    col=vec3(0.98,0.80,0.06)*(0.8+0.2*smoothstep(0.,0.6,r));
  } else if(vKind<0.92){   // red clover
    edge=0.72+0.1*abs(cos(a*9.));
    col=mix(vec3(0.60,0.20,0.48),vec3(0.82,0.48,0.72),r);
  } else if(vKind<0.99){   // poppy
    edge=0.85+0.15*abs(cos(a*2.));
    col=mix(vec3(0.04),vec3(0.85,0.08,0.05),smoothstep(0.12,0.22,r));
  } else {                 // autumn toadstool, seen from the side: a domed cap on a pale stem
    bool cap=vUv.y>0. && length(vec2(vUv.x,vUv.y*1.7))<0.95;
    bool stem=vUv.y<=0.05 && abs(vUv.x)<0.2;
    if(!cap && !stem) discard;
    float spots=step(0.78,fract(sin(dot(floor(vUv*5.+3.),vec2(12.9,78.2)))*43758.5));
    col=cap ? mix(vec3(0.55,0.06,0.03),vec3(0.85,0.82,0.75),spots) : vec3(0.72,0.68,0.58);
    edge=2.;
  }
  if(r>edge) discard;
  float sh=shadowAt4(vWorld,3.);
  vec3 lit=col*(uSunCol*sh*(0.25+0.4*max(uSunDir.y,0.))+uSkyAmb*1.0);
  fragColor=encodeOut(applyFog(lit,vWorld));
}
`;

// ---------------------------------------------------------------------------------------------
// Lens: depth of field, tone curve, grade, vignette, grain.
const POST_FS = HEAD + NOISE + `
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uPx;          // size of one pixel in uv
uniform float uNear; uniform float uFar;
uniform float uFocus;      // distance in metres that is sharp
uniform float uCocScale;   // blur strength; pixels of blur for a point at infinity = uCocScale / uFocus
uniform float uMaxCoc;     // largest blur radius in pixels
uniform float uRadStep;    // sample spacing; smaller = smoother blur, more samples
uniform float uExposure;
uniform float uSat;
uniform vec3 uTint;
uniform float uTime;
uniform float uLdr;
uniform sampler2D uBloom;   // a blurred copy of the brightest parts of the picture
uniform float uBloomAmt;    // how much of that glow is added back (0 = none)
const float VIGNETTE = 0.5;   // darkening at the corners
const float GRAIN = 0.02;     // film grain strength
float linDepth(float d){ float z=d*2.-1.; return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear)); }
float coc(float z){ return clamp(abs(1./uFocus-1./z)*uCocScale,0.,uMaxCoc); }
vec3 fetch(vec2 uv){ vec3 c=texture(uColor,uv).rgb; return uLdr>0.5 ? c/max(1.-c,1e-3) : c; }
void main(){
  float cz=linDepth(texture(uDepth,vUv).r);
  float cs=coc(cz);
  vec3 col=fetch(vUv);
  float tot=1.;
  float rad=uRadStep;
  // One-pass gather: walk a golden-angle spiral and take each sample only if its own blur reaches here.
  for(float ang=0.; rad<uMaxCoc; ang+=2.39996323){
    vec2 tc=vUv+vec2(cos(ang),sin(ang))*uPx*rad;
    vec3 sc=fetch(tc);
    float sz=linDepth(texture(uDepth,tc).r);
    float ss=coc(sz);
    if(sz>cz) ss=clamp(ss,0.,cs*2.);
    float m=smoothstep(rad-0.5,rad+0.5,ss);
    col+=mix(col/tot,sc,m);
    tot+=1.;
    rad+=uRadStep/rad;
  }
  col/=tot;
  col+=texture(uBloom,vUv).rgb*uBloomAmt;
  col*=uExposure;
  float l=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(l),col,uSat)*uTint;
  col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);   // filmic curve (ACES fit)
  col=pow(clamp(col,0.,1.),vec3(1./2.2));
  vec2 q=vUv-0.5;
  col*=1.-dot(q,q)*VIGNETTE;
  col+=(hash21(gl_FragCoord.xy+fract(uTime)*91.7)-0.5)*GRAIN;
  fragColor=vec4(col,1.);
}
`;

// Glow: bright things (snow in sun, blossom, cloud edges) spill a little light round themselves,
// as they do in a camera. BRIGHT keeps only the brightest parts at quarter size; BLUR spreads them.
const BRIGHT_FS = HEAD + `
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uColor;
uniform vec2 uPx;                 // one pixel of the full picture, in uv
const float GLOW_FROM = 1.15;     // brightness where the glow starts (1 = white paper in full sun)
void main(){
  vec3 c=texture(uColor,vUv+uPx*vec2(-1.,-1.)).rgb+texture(uColor,vUv+uPx*vec2(1.,-1.)).rgb
        +texture(uColor,vUv+uPx*vec2(-1.,1.)).rgb+texture(uColor,vUv+uPx*vec2(1.,1.)).rgb;
  c*=0.25;
  float l=max(c.r,max(c.g,c.b));
  fragColor=vec4(min(c,vec3(8.))*smoothstep(GLOW_FROM,GLOW_FROM*2.4,l),1.);
}
`;

const BLUR_FS = HEAD + `
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uColor;
uniform vec2 uDir;                // one step along the blur, in uv
void main(){
  vec3 c=texture(uColor,vUv).rgb*0.227;
  c+=(texture(uColor,vUv+uDir*1.385).rgb+texture(uColor,vUv-uDir*1.385).rgb)*0.316;
  c+=(texture(uColor,vUv+uDir*3.231).rgb+texture(uColor,vUv-uDir*3.231).rgb)*0.070;
  fragColor=vec4(c,1.);
}
`;

const DEPTH_ONLY_FS = HEAD + `void main(){}`;

export const SHADERS = {
  barkVS: HEAD + SHARED + SWAY + BARK_VS_BODY,
  barkShadowVS: HEAD + '#define SHADOW_PASS\n' + SHARED + SWAY + BARK_VS_BODY,
  barkFS: BARK_FS,
  leafVS: HEAD + SHARED + NOISE + SWAY + LEAF_VS_BODY,
  leafShadowVS: HEAD + '#define SHADOW_PASS\n' + SHARED + NOISE + SWAY + LEAF_VS_BODY,
  leafFS: LEAF_FS,
  groundVS: GROUND_VS,
  groundFS: GROUND_FS,
  grassVS: GRASS_VS,
  grassFS: GRASS_FS,
  screenVS: SCREEN_VS,
  skyFS: SKY_FS,
  critterVS: HEAD + SHARED + CRITTER_VS_BODY,
  critterShadowVS: HEAD + '#define SHADOW_PASS\n' + SHARED + CRITTER_VS_BODY,
  critterFS: CRITTER_FS,
  furVS: HEAD + SHARED + FUR_VS_BODY,
  furShadowVS: HEAD + '#define SHADOW_PASS\n' + SHARED + FUR_VS_BODY,
  furFS: FUR_FS,
  flyVS: FLY_VS,
  flyFS: FLY_FS,
  flowerVS: FLOWER_VS,
  flowerFS: FLOWER_FS,
  flakeVS: FLAKE_VS,
  flakeFS: FLAKE_FS,
  postFS: POST_FS,
  brightFS: BRIGHT_FS,
  blurFS: BLUR_FS,
  depthOnlyFS: DEPTH_ONLY_FS,
};
