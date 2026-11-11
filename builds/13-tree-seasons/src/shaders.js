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
`;

const NOISE = `
float hash11(float n){ return fract(sin(n)*43758.5453123); }
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float hash31(vec3 p){ p=fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise2(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y);
}
float noise3(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x), f.y), f.z);
}
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

const SHADOW = `
uniform sampler2DShadow uShadowMap;
// spread = blur radius in shadow texels. Bigger = softer edge.
float shadowAt(vec3 wp, float spread){
  vec3 s=(uShadowMat*vec4(wp,1.)).xyz;
  if(s.x<0.||s.x>1.||s.y<0.||s.y>1.||s.z<0.||s.z>1.) return 1.;
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
  return mix(1., sum/9., uShadowStrength);
}
// Four taps instead of nine: enough for leaves, where the crown's own noise hides the grain.
float shadowAt4(vec3 wp, float spread){
  vec3 s=(uShadowMat*vec4(wp,1.)).xyz;
  if(s.x<0.||s.x>1.||s.y<0.||s.y>1.||s.z<0.||s.z>1.) return 1.;
  float r=spread*uShadowTexel;
  float sum=texture(uShadowMap,vec3(s.xy+vec2(-0.35,-0.35)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2( 0.35,-0.35)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2(-0.35, 0.35)*r,s.z));
  sum+=texture(uShadowMap,vec3(s.xy+vec2( 0.35, 0.35)*r,s.z));
  return mix(1., sum/4., uShadowStrength);
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

const GROUND_FS = HEAD + SHARED + NOISE + SNOW_MASK + SHADOW + OUTPUT + `
in vec3 vWorld;
uniform vec3 uGrassA; uniform vec3 uGrassB; uniform vec3 uHill;
uniform float uCanopy;
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
    float h0=fbm2x2(p*SNOW_DRIFT_SCALE+4.);
    float hx=fbm2x2((p+vec2(0.35,0.))*SNOW_DRIFT_SCALE+4.);
    float hz=fbm2x2((p+vec2(0.,0.35))*SNOW_DRIFT_SCALE+4.);
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
const GRASS_VS = HEAD + SHARED + NOISE + SNOW_MASK + `
layout(location=0) in vec2 aBlade;   // x: -1..1 across, y: 0..1 up
layout(location=1) in vec4 iPos;     // x, z, height in metres, turn in radians
layout(location=2) in vec2 iRnd;
uniform float uGrassH;
const float BLADE_WIDTH = 0.016;     // half width at the base in metres
out float vT; out vec3 vWorld; out float vRnd; out float vSnow;
void main(){
  vec2 base=iPos.xy;
  float sn=uSnow>0.001 ? snowMask(base) : 0.;
  float h=iPos.z*uGrassH*(1.-0.8*sn);
  float c=cos(iPos.w), s=sin(iPos.w);
  float t=aBlade.y;
  float ph=uTime*1.6+base.x*0.35+base.y*0.27;
  float bend=0.18+0.25*iRnd.x+uWind*0.22*(sin(ph)+0.5*sin(ph*2.7+iRnd.y*6.));
  vec3 side=vec3(c,0.,s), fwd=vec3(-s,0.,c);
  vec3 lean=vec3(uWindDir.x,0.,uWindDir.y)*bend+fwd*0.3*(iRnd.y-0.5);
  vec3 p=vec3(base.x,0.,base.y);
  p+=side*aBlade.x*BLADE_WIDTH*(1.-t*0.85)+vec3(0.,1.,0.)*t*h*(1.-0.3*t*bend*bend)+lean*t*t*h;
  vT=t; vWorld=p; vRnd=iRnd.x; vSnow=sn;
  gl_Position=uViewProj*vec4(p,1.);
}
`;

const GRASS_FS = HEAD + SHARED + NOISE + SHADOW + OUTPUT + `
in float vT; in vec3 vWorld; in float vRnd; in float vSnow;
uniform vec3 uGrassA; uniform vec3 uGrassB;
void main(){
  vec3 col=mix(uGrassA*0.75,uGrassB*1.15,vT)*(0.8+0.4*vRnd);
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
uniform float uCloud;
const float CLOUD_RING = 3.0;        // size of cloud banks round the horizon; bigger = more, smaller banks
const float CLOUD_RISE = 12.;        // vertical squash; bigger = flatter clouds
const float CLOUD_LIGHT_STEP = 0.02; // how far up to look when shading cloud tops
const float CLOUD_DRIFT = 0.008;     // speed of drift across the sky
// Clouds live on a cylinder round the viewer, so they wrap without a seam and do not smear at the horizon.
float cloudDensity(vec2 n2, float el){
  vec3 q=vec3(n2.x*CLOUD_RING+uTime*CLOUD_DRIFT, el*CLOUD_RISE, n2.y*CLOUD_RING);
  return noise3(q)*0.55+noise3(q*2.1+3.7)*0.28+noise3(q*4.3+9.1)*0.17;
}
void main(){
  vec4 farPt=uInvViewProj*vec4(vUv*2.-1.,1.,1.);
  vec3 dir=normalize(farPt.xyz/farPt.w-uCam);
  float el=dir.y;
  vec3 col=mix(uHorizon,uZenith,pow(clamp(el,0.,1.),0.38));
  float sd=max(dot(dir,uSunDir),0.);
  col+=uSunCol*(pow(sd,700.)*6.+pow(sd,14.)*0.22+pow(sd,3.)*0.07)*(1.-0.6*uCloud);
  vec2 n2=normalize(dir.xz+1e-5);
  // A band of warm, bright air low on the horizon, strongest towards the sun.
  col=mix(col,uHorizon*1.12,exp(-max(el,0.)*14.)*0.5);
  col+=uSunCol*0.05*exp(-max(el,0.)*9.)*pow(sd,1.5);
  if(el>-0.02){
    float d0=cloudDensity(n2,el);
    float d1=cloudDensity(n2,el+CLOUD_LIGHT_STEP);
    float lo=mix(0.56,0.28,uCloud);
    float cover=smoothstep(lo,lo+0.2,d0)*smoothstep(-0.02,0.03,el);
    float top=smoothstep(-0.04,0.10,d0-d1);          // bright where there is less cloud above
    vec3 sunTint=uSunCol/max(max(uSunCol.r,uSunCol.g),uSunCol.b);
    vec3 bright=mix(vec3(1.),sunTint,0.65)*(0.80+0.25*uSunDir.y+0.45*pow(sd,2.));
    vec3 base=mix(uZenith,uHorizon,0.6)*0.82;
    vec3 cloudCol=mix(base,bright,top*(1.-0.45*uCloud));
    col=mix(col,cloudCol,cover*0.93);
  }
  // Far hills and a nearer tree line. Sampled on a circle so there is no seam.
  float h1=0.020+0.036*fbm2x2(n2*2.6+1.3)+0.008*noise2(n2*11.+4.);
  float h2=0.012+0.020*noise2(n2*17.+9.)+0.008*noise2(n2*80.+2.);
  // Haze gathers in the valleys: both layers pale towards their feet.
  vec3 hillFar=mix(uHill,uFogCol,0.62+0.2*smoothstep(h1,0.,el));
  vec3 hillNear=mix(uHill*0.75,uFogCol,0.30+0.45*smoothstep(h2,0.,el));
  hillNear*=0.9+0.2*noise2(n2*140.+el*300.);
  col=mix(col,hillFar,smoothstep(h1+0.004,h1-0.002,el));
  col=mix(col,hillNear,smoothstep(h2+0.003,h2-0.001,el));
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
const vec3 FLAKE_BOX = vec3(90.,24.,90.);  // metres; flakes wrap round inside this box
const float FLAKE_SIZE = 0.055;            // metres
out float vFade;
void main(){
  vec3 p=aSeed.xyz*FLAKE_BOX;
  p.y=mod(p.y-uTime*(1.1+aSeed.w*0.9),FLAKE_BOX.y);
  p.xz=mod(p.xz+uWindDir*uTime*0.8+vec2(sin(uTime*0.7+aSeed.w*30.),cos(uTime*0.6+aSeed.w*17.))*0.5,FLAKE_BOX.xz)-FLAKE_BOX.xz*0.5+uFlakeCentre.xz;
  gl_Position=uViewProj*vec4(p,1.);
  float px=FLAKE_SIZE*(0.6+0.8*aSeed.w)*uFovScale*uPixels/max(gl_Position.w,0.1);
  vFade=clamp(px,0.,1.);
  gl_PointSize=clamp(px,1.,24.);
}
`;

const FLAKE_FS = HEAD + SHARED + OUTPUT + `
in float vFade;
uniform float uFlakes;
void main(){
  float a=smoothstep(0.5,0.15,length(gl_PointCoord-0.5))*uFlakes*vFade;
  vec3 c=vec3(0.95,0.97,1.)*(uSkyAmb*1.25+uSunCol*0.22);
  fragColor=vec4(uLdr>0.5 ? c/(1.+c) : c, a);
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
  flakeVS: FLAKE_VS,
  flakeFS: FLAKE_FS,
  postFS: POST_FS,
  depthOnlyFS: DEPTH_ONLY_FS,
};
