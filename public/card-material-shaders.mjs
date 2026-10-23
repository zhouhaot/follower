// Shared authored material; original artwork supplies its own relief mask.
export const vertexShader = `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
export const fragmentShader = `
precision highp float;
uniform sampler2D uArt;
uniform vec2 uTexel;
uniform vec2 uTilt;
uniform float uPearl;
uniform float uArtworkMask;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float relief(vec3 c){return smoothstep(0.045,0.48,max(c.r,max(c.g,c.b)));}
void main(){
  vec3 art=texture2D(uArt,vUv).rgb;
  float left=relief(texture2D(uArt,vUv-vec2(uTexel.x*1.8,0.)).rgb);
  float right=relief(texture2D(uArt,vUv+vec2(uTexel.x*1.8,0.)).rgb);
  float down=relief(texture2D(uArt,vUv-vec2(0.,uTexel.y*1.8)).rgb);
  float up=relief(texture2D(uArt,vUv+vec2(0.,uTexel.y*1.8)).rgb);
  float grain=hash(floor(vUv*vec2(1700.,2400.)))-0.5;
  float fiber=hash(vec2(floor(vUv.x*380.),floor(vUv.y*2100.)))-0.5;
  vec3 n=normalize(vec3((left-right)*2.1+grain*0.025,(down-up)*2.1+fiber*0.018,1.));
  vec3 light=normalize(vec3(-0.6+uTilt.x*1.5,0.65+uTilt.y*1.2,1.4));
  vec3 eye=normalize(vec3(-uTilt.x*1.7,uTilt.y*1.7,2.2));
  vec3 halfVector=normalize(light+eye);
  float diffuse=dot(n,light)-dot(vec3(0.,0.,1.),light);
  vec3 paper=art*(0.985+grain*0.035+fiber*0.016)+diffuse*0.16;
  paper*=vec3(1.012,1.,0.982);
  // Colored floral regions only: blue/white petals and green leaves. Dark
  // ground, pink ornaments and gold dots remain diffuse, not a full-face wash.
  float bright=smoothstep(0.08,0.2,max(art.g,art.b));
  float blue=smoothstep(0.005,0.10,art.b-art.r);
  float green=smoothstep(0.012,0.10,art.g-art.r);
  float pale=smoothstep(0.55,0.9,min(art.r,min(art.g,art.b)));
  float lotusMask=bright*max(max(blue,green),pale);
  float pigment=smoothstep(0.055,0.28,max(art.r,max(art.g,art.b)));
  float mask=mix(lotusMask,pigment,uArtworkMask);
  float slope=vUv.x*0.82+vUv.y*0.25;
  float center=0.44+uTilt.x*0.9-uTilt.y*0.38;
  float band=exp(-pow((slope-center)/0.105,2.));
  float broad=exp(-pow((slope-center)/0.38,2.));
  float phase=slope*7.2+uTilt.x*9.-uTilt.y*5.;
  vec3 interference=0.53+0.47*cos(phase+vec3(0.,2.1,4.2));
  interference=mix(vec3(0.72,0.85,0.94),interference,0.34);
  float grazing=pow(1.-max(dot(n,eye),0.),2.);
  float emboss=pow(max(dot(n,halfVector),0.),60.);
  vec3 pearl=art*(0.98+grain*0.012)+diffuse*0.18;
  pearl+=mask*(interference*(band*0.32+broad*0.07)+vec3(0.10,0.13,0.14)*grazing+emboss*0.015);
  vec3 color=mix(paper,pearl,uPearl);
  gl_FragColor=vec4(max(color,vec3(0.)),1.);
  #include <colorspace_fragment>
}
`;

