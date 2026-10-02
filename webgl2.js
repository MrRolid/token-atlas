import {similarityOnMainThread} from './similarity.js';

export const vertexSource = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec4 cameraA;
uniform vec4 cameraB;
uniform vec2 cameraPan;
uniform sampler2D pointData;
uniform sampler2D similarityData;
uniform sampler2D embeddingData;
out vec4 color;
out vec2 uv;
flat out int viewMode;
vec4 project(vec3 p) {
  float cy=cos(cameraA.x), sy=sin(cameraA.x), cp=cos(cameraA.y), sp=sin(cameraA.y);
  float xx=p.x*cy+p.z*sy+cameraPan.x;
  float zz=-p.x*sy+p.z*cy;
  float yy=p.y*cp-zz*sp+cameraPan.y;
  float z=p.y*sp+zz*cp+cameraA.z;
  return vec4(xx*1.9/cameraA.w, yy*1.9, 2.0*(z-0.1)*0.98-z, z);
}
void main() {
  vec2 corners[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
  uv=corners[gl_VertexID];
  int i=gl_InstanceID, selected=int(cameraB.w);
  viewMode=int(cameraB.z);
  vec3 p, rgb;
  if(viewMode==0) {
    vec4 point=texelFetch(pointData,ivec2(i,0),0);
    p=point.xyz;
    rgb=mix(vec3(.35,.87,.82),vec3(.63,.55,.88),point.w);
    float radius=2.0;
    if(i==selected){rgb=vec3(1,.68,.39);radius=6.0;}
    vec4 projected=project(p);
    gl_Position=projected+vec4(uv.x*radius*2.0/cameraB.x*projected.w,uv.y*radius*2.0/cameraB.y*projected.w,0,0);
    color=vec4(rgb,.88);
    return;
  }
  if(viewMode==1) {
    int row=i/1000, col=i%1000;
    float v=texelFetch(similarityData,ivec2(col,row),0).r;
    p=vec3((float(col)/999.0-.5)*6.0,(.5-float(row)/999.0)*6.0,v*.6);
    p+=vec3(uv.x*.003,uv.y*.003,0);
    rgb=mix(vec3(.028,.055,.09),vec3(.43,.94,.83),max(0.0,v));
    rgb=mix(rgb,vec3(.5,.31,.72),max(0.0,-v));
    if(row==selected||col==selected)rgb=mix(rgb,vec3(1,.64,.35),.7);
  } else {
    int row=i/48, col=i%48;
    float v=texelFetch(embeddingData,ivec2(col,row),0).r;
    p=vec3((float(col)/47.0-.5)*6.0,(.5-float(row)/999.0)*6.0,v*.1);
    p+=vec3(uv.x*.059,uv.y*.003,0);
    rgb=mix(vec3(.06,.1,.15),vec3(.43,.94,.83),clamp(v*.5,0.0,1.0));
    rgb=mix(rgb,vec3(.6,.45,.86),clamp(-v*.5,0.0,1.0));
    if(row==selected)rgb=vec3(1,.68,.4);
  }
  gl_Position=project(p);
  color=vec4(rgb,1);
}`;
export const fragmentSource = `#version 300 es
precision highp float;
precision highp int;
in vec4 color;
in vec2 uv;
flat in int viewMode;
out vec4 pixel;
void main() {
  if(viewMode==0) {
    float r=length(uv);
    if(r>1.0)discard;
    pixel=vec4(color.rgb,color.a*(1.0-smoothstep(.35,1.0,r)));
  } else pixel=color;
}`;

async function buildSimilarities(normalized) {
  if (typeof Worker !== 'undefined') {
    let worker;
    try {
      return await new Promise((resolve,reject) => {
        worker=new Worker(new URL('./matrix-worker.js',import.meta.url),{type:'module'});
        const timeout=setTimeout(()=>reject(Error('Matrix worker timeout')),15000);
        worker.onmessage=event=>{clearTimeout(timeout);resolve(new Float32Array(event.data));};
        worker.onerror=event=>{event.preventDefault();clearTimeout(timeout);reject(Error('Matrix worker failed'));};
        const copy=normalized.slice();worker.postMessage(copy.buffer,[copy.buffer]);
      });
    } catch { /* Restrictive CSP or unsupported module workers: keep UI responsive. */ }
    finally { worker?.terminate(); }
  }
  return similarityOnMainThread(normalized);
}

export class WebGL2Renderer {
  constructor(canvas){
    this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});
    if(!this.gl)throw Error('WebGL2 není dostupné');
    this.textures=[];
  }
  async init(scene){
    const gl=this.gl;
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(message);}return shader;};
    let vs,fs;
    try{vs=compile(gl.VERTEX_SHADER,vertexSource);fs=compile(gl.FRAGMENT_SHADER,fragmentSource);this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));}
    finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);gl.useProgram(this.program);
    this.cameraA=gl.getUniformLocation(this.program,'cameraA');this.cameraB=gl.getUniformLocation(this.program,'cameraB');this.cameraPan=gl.getUniformLocation(this.program,'cameraPan');
    const texture=(name,width,height,data,rgba=false)=>{
      const slot=this.textures.length,tex=gl.createTexture();this.textures.push(tex);
      gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,rgba?gl.RGBA32F:gl.R32F,width,height,0,rgba?gl.RGBA:gl.RED,gl.FLOAT,data);
      gl.uniform1i(gl.getUniformLocation(this.program,name),slot);
    };
    const points=new Float32Array(4000);
    for(let i=0;i<1000;i++){points.set(scene.positions[i],4*i);points[i*4+3]=/^\d+$/.test(scene.m.vocab[i])?1:0;}
    texture('pointData',1000,1,points,true);
    texture('embeddingData',48,1000,scene.emb);
    const similarities=await buildSimilarities(scene.normed);
    texture('similarityData',1000,1000,similarities);
    if(gl.isContextLost())throw Error('WebGL2 kontext byl ztracen');
    const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('WebGL2 initialization: '+error);
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  }
  draw(scene){
    const gl=this.gl;gl.viewport(0,0,scene.canvas.width,scene.canvas.height);gl.clearColor(.037,.061,.09,1);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);gl.bindVertexArray(this.vao);
    this.textures.forEach((texture,slot)=>{gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,texture);});
    gl.uniform4f(this.cameraA,scene.yaw,scene.pitch,scene.zoom,scene.width/scene.height);
    gl.uniform4f(this.cameraB,scene.width,scene.height,scene.mode,scene.selected);gl.uniform2f(this.cameraPan,...scene.pan);
    gl.drawArraysInstanced(gl.TRIANGLES,0,6,scene.mode===0?1000:scene.mode===1?1000000:48000);
  }
  destroy(){const gl=this.gl;this.textures.forEach(t=>gl.deleteTexture(t));if(this.vao)gl.deleteVertexArray(this.vao);if(this.program)gl.deleteProgram(this.program);gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
