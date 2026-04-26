import{r as G,j as ue}from"./index-BPfu8E-i.js";function tt({SIM_RESOLUTION:ce=128,DYE_RESOLUTION:le=1440,CAPTURE_RESOLUTION:Qe=512,DENSITY_DISSIPATION:se=3.5,VELOCITY_DISSIPATION:fe=2,PRESSURE:ve=.1,PRESSURE_ITERATIONS:de=20,CURL:me=3,SPLAT_RADIUS:he=.2,SPLAT_FORCE:xe=6e3,SHADING:Te=!0,COLOR_UPDATE_SPEED:ge=10,BACK_COLOR:Ze={r:0,g:0,b:0},TRANSPARENT:$e=!0}){const Y=G.useRef(null),w=G.useRef(null);return G.useEffect(()=>{const l=Y.current;if(!l)return;let V=!0;function Re(){this.id=-1,this.texcoordX=0,this.texcoordY=0,this.prevTexcoordX=0,this.prevTexcoordY=0,this.deltaX=0,this.deltaY=0,this.down=!1,this.moved=!1,this.color=[0,0,0]}let s={SIM_RESOLUTION:ce,DYE_RESOLUTION:le,DENSITY_DISSIPATION:se,VELOCITY_DISSIPATION:fe,PRESSURE:ve,PRESSURE_ITERATIONS:de,CURL:me,SPLAT_RADIUS:he,SPLAT_FORCE:xe,SHADING:Te,COLOR_UPDATE_SPEED:ge},y=[new Re];const{gl:t,ext:R}=Ee(l);R.supportLinearFiltering||(s.DYE_RESOLUTION=256,s.SHADING=!1);function Ee(e){const r={alpha:!0,depth:!1,stencil:!1,antialias:!1,preserveDrawingBuffer:!1};let i=e.getContext("webgl2",r);const o=!!i;o||(i=e.getContext("webgl",r)||e.getContext("experimental-webgl",r));let n,c;o?(i.getExtension("EXT_color_buffer_float"),c=i.getExtension("OES_texture_float_linear")):(n=i.getExtension("OES_texture_half_float"),c=i.getExtension("OES_texture_half_float_linear")),i.clearColor(0,0,0,1);const u=o?i.HALF_FLOAT:n&&n.HALF_FLOAT_OES;let f,x,F;return o?(f=p(i,i.RGBA16F,i.RGBA,u),x=p(i,i.RG16F,i.RG,u),F=p(i,i.R16F,i.RED,u)):(f=p(i,i.RGBA,i.RGBA,u),x=p(i,i.RGBA,i.RGBA,u),F=p(i,i.RGBA,i.RGBA,u)),{gl:i,ext:{formatRGBA:f,formatRG:x,formatR:F,halfFloatTexType:u,supportLinearFiltering:c}}}function p(e,r,i,o){if(!pe(e,r,i,o))switch(r){case e.R16F:return p(e,e.RG16F,e.RG,o);case e.RG16F:return p(e,e.RGBA16F,e.RGBA,o);default:return null}return{internalFormat:r,format:i}}function pe(e,r,i,o){const n=e.createTexture();e.bindTexture(e.TEXTURE_2D,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,r,4,4,0,i,o,null);const c=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,c),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,n,0),e.checkFramebufferStatus(e.FRAMEBUFFER)===e.FRAMEBUFFER_COMPLETE}class Se{constructor(r,i){this.vertexShader=r,this.fragmentShaderSource=i,this.programs=[],this.activeProgram=null,this.uniforms=[]}setKeywords(r){let i=0;for(let n=0;n<r.length;n++)i+=Je(r[n]);let o=this.programs[i];if(o==null){let n=m(t.FRAGMENT_SHADER,this.fragmentShaderSource,r);o=H(this.vertexShader,n),this.programs[i]=o}o!==this.activeProgram&&(this.uniforms=W(o),this.activeProgram=o)}bind(){t.useProgram(this.activeProgram)}}class E{constructor(r,i){this.uniforms={},this.program=H(r,i),this.uniforms=W(this.program)}bind(){t.useProgram(this.program)}}function H(e,r){let i=t.createProgram();return t.attachShader(i,e),t.attachShader(i,r),t.linkProgram(i),t.getProgramParameter(i,t.LINK_STATUS)||console.trace(t.getProgramInfoLog(i)),i}function W(e){let r=[],i=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let o=0;o<i;o++){let n=t.getActiveUniform(e,o).name;r[n]=t.getUniformLocation(e,n)}return r}function m(e,r,i){r=De(r,i);const o=t.createShader(e);return t.shaderSource(o,r),t.compileShader(o),t.getShaderParameter(o,t.COMPILE_STATUS)||console.trace(t.getShaderInfoLog(o)),o}function De(e,r){if(!r)return e;let i="";return r.forEach(o=>{i+="#define "+o+`
`}),i+e}const T=m(t.VERTEX_SHADER,`
        precision highp float;
        attribute vec2 aPosition;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform vec2 texelSize;

        void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `),ye=m(t.FRAGMENT_SHADER,`
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;

        void main () {
            gl_FragColor = texture2D(uTexture, vUv);
        }
      `),Ae=m(t.FRAGMENT_SHADER,`
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;
        uniform float value;

        void main () {
            gl_FragColor = value * texture2D(uTexture, vUv);
        }
      `),_e=`
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform sampler2D uDithering;
      uniform vec2 ditherScale;
      uniform vec2 texelSize;

      vec3 linearToGamma (vec3 color) {
          color = max(color, vec3(0));
          return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
      }

      void main () {
          vec3 c = texture2D(uTexture, vUv).rgb;

          #ifdef SHADING
              vec3 lc = texture2D(uTexture, vL).rgb;
              vec3 rc = texture2D(uTexture, vR).rgb;
              vec3 tc = texture2D(uTexture, vT).rgb;
              vec3 bc = texture2D(uTexture, vB).rgb;

              float dx = length(rc) - length(lc);
              float dy = length(tc) - length(bc);

              vec3 n = normalize(vec3(dx, dy, length(texelSize)));
              vec3 l = vec3(0.0, 0.0, 1.0);

              float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
              c *= diffuse;
          #endif

          float a = max(c.r, max(c.g, c.b));
          gl_FragColor = vec4(c, a);
      }
    `,Fe=m(t.FRAGMENT_SHADER,`
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;

        void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
        }
      `),we=m(t.FRAGMENT_SHADER,`
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform vec2 dyeTexelSize;
        uniform float dt;
        uniform float dissipation;

        vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
            vec2 st = uv / tsize - 0.5;
            vec2 iuv = floor(st);
            vec2 fuv = fract(st);

            vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
            vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
            vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
            vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

            return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
        }

        void main () {
            #ifdef MANUAL_FILTERING
                vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
                vec4 result = bilerp(uSource, coord, dyeTexelSize);
            #else
                vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
                vec4 result = texture2D(uSource, coord);
            #endif
            float decay = 1.0 + dissipation * dt;
            gl_FragColor = result / decay;
        }
      `,R.supportLinearFiltering?null:["MANUAL_FILTERING"]),Ue=m(t.FRAGMENT_SHADER,`
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;

        void main () {
            float L = texture2D(uVelocity, vL).x;
            float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y;
            float B = texture2D(uVelocity, vB).y;

            vec2 C = texture2D(uVelocity, vUv).xy;
            if (vL.x < 0.0) { L = -C.x; }
            if (vR.x > 1.0) { R = -C.x; }
            if (vT.y > 1.0) { T = -C.y; }
            if (vB.y < 0.0) { B = -C.y; }

            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
      `),Le=m(t.FRAGMENT_SHADER,`
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;

        void main () {
            float L = texture2D(uVelocity, vL).y;
            float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x;
            float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
      `),be=m(t.FRAGMENT_SHADER,`
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform float curl;
        uniform float dt;

        void main () {
            float L = texture2D(uCurl, vL).x;
            float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x;
            float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;

            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001;
            force *= curl * C;
            force.y *= -1.0;

            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity += force * dt;
            velocity = min(max(velocity, -1000.0), 1000.0);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
      `),Pe=m(t.FRAGMENT_SHADER,`
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;

        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            float C = texture2D(uPressure, vUv).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
      `),Be=m(t.FRAGMENT_SHADER,`
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;

        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
      `),d=(t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,-1,1,1,1,1,-1]),t.STATIC_DRAW),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),t.STATIC_DRAW),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),t.enableVertexAttribArray(0),(e,r=!1)=>{e==null?(t.viewport(0,0,t.drawingBufferWidth,t.drawingBufferHeight),t.bindFramebuffer(t.FRAMEBUFFER,null)):(t.viewport(0,0,e.width,e.height),t.bindFramebuffer(t.FRAMEBUFFER,e.fbo)),r&&(t.clearColor(0,0,0,1),t.clear(t.COLOR_BUFFER_BIT)),t.drawElements(t.TRIANGLES,6,t.UNSIGNED_SHORT,0)});let v,a,X,C,S;const K=new E(T,ye),z=new E(T,Ae),D=new E(T,Fe),h=new E(T,we),M=new E(T,Ue),N=new E(T,Le),A=new E(T,be),U=new E(T,Pe),L=new E(T,Be),b=new Se(T,_e);function j(){let e=$(s.SIM_RESOLUTION),r=$(s.DYE_RESOLUTION);const i=R.halfFloatTexType,o=R.formatRGBA,n=R.formatRG,c=R.formatR,u=R.supportLinearFiltering?t.LINEAR:t.NEAREST;t.disable(t.BLEND),v?v=k(v,r.width,r.height,o.internalFormat,o.format,i,u):v=I(r.width,r.height,o.internalFormat,o.format,i,u),a?a=k(a,e.width,e.height,n.internalFormat,n.format,i,u):a=I(e.width,e.height,n.internalFormat,n.format,i,u),X=_(e.width,e.height,c.internalFormat,c.format,i,t.NEAREST),C=_(e.width,e.height,c.internalFormat,c.format,i,t.NEAREST),S=I(e.width,e.height,c.internalFormat,c.format,i,t.NEAREST)}function _(e,r,i,o,n,c){t.activeTexture(t.TEXTURE0);let u=t.createTexture();t.bindTexture(t.TEXTURE_2D,u),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,c),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,c),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texImage2D(t.TEXTURE_2D,0,i,e,r,0,o,n,null);let f=t.createFramebuffer();t.bindFramebuffer(t.FRAMEBUFFER,f),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,u,0),t.viewport(0,0,e,r),t.clear(t.COLOR_BUFFER_BIT);let x=1/e,F=1/r;return{texture:u,fbo:f,width:e,height:r,texelSizeX:x,texelSizeY:F,attach(ae){return t.activeTexture(t.TEXTURE0+ae),t.bindTexture(t.TEXTURE_2D,u),ae}}}function I(e,r,i,o,n,c){let u=_(e,r,i,o,n,c),f=_(e,r,i,o,n,c);return{width:e,height:r,texelSizeX:u.texelSizeX,texelSizeY:u.texelSizeY,get read(){return u},set read(x){u=x},get write(){return f},set write(x){f=x},swap(){let x=u;u=f,f=x}}}function Xe(e,r,i,o,n,c,u){let f=_(r,i,o,n,c,u);return K.bind(),t.uniform1i(K.uniforms.uTexture,e.attach(0)),d(f),f}function k(e,r,i,o,n,c,u){return e.width===r&&e.height===i||(e.read=Xe(e.read,r,i,o,n,c,u),e.write=_(r,i,o,n,c,u),e.width=r,e.height=i,e.texelSizeX=1/r,e.texelSizeY=1/i),e}function Ce(){let e=[];s.SHADING&&e.push("SHADING"),b.setKeywords(e)}Ce(),j();let q=Date.now(),P=0;function J(){if(!V)return;const e=ze();Me()&&j(),Ne(e),Ie(),Oe(e),Ge(null),w.current=requestAnimationFrame(J)}function ze(){let e=Date.now(),r=(e-q)/1e3;return r=Math.min(r,.016666),q=e,r}function Me(){let e=g(l.clientWidth),r=g(l.clientHeight);return l.width!==e||l.height!==r?(l.width=e,l.height=r,!0):!1}function Ne(e){P+=e*s.COLOR_UPDATE_SPEED,P>=1&&(P=qe(P,0,1),y.forEach(r=>{r.color=B()}))}function Ie(){y.forEach(e=>{e.moved&&(e.moved=!1,Ve(e))})}function Oe(e){t.disable(t.BLEND),N.bind(),t.uniform2f(N.uniforms.texelSize,a.texelSizeX,a.texelSizeY),t.uniform1i(N.uniforms.uVelocity,a.read.attach(0)),d(C),A.bind(),t.uniform2f(A.uniforms.texelSize,a.texelSizeX,a.texelSizeY),t.uniform1i(A.uniforms.uVelocity,a.read.attach(0)),t.uniform1i(A.uniforms.uCurl,C.attach(1)),t.uniform1f(A.uniforms.curl,s.CURL),t.uniform1f(A.uniforms.dt,e),d(a.write),a.swap(),M.bind(),t.uniform2f(M.uniforms.texelSize,a.texelSizeX,a.texelSizeY),t.uniform1i(M.uniforms.uVelocity,a.read.attach(0)),d(X),z.bind(),t.uniform1i(z.uniforms.uTexture,S.read.attach(0)),t.uniform1f(z.uniforms.value,s.PRESSURE),d(S.write),S.swap(),U.bind(),t.uniform2f(U.uniforms.texelSize,a.texelSizeX,a.texelSizeY),t.uniform1i(U.uniforms.uDivergence,X.attach(0));for(let i=0;i<s.PRESSURE_ITERATIONS;i++)t.uniform1i(U.uniforms.uPressure,S.read.attach(1)),d(S.write),S.swap();L.bind(),t.uniform2f(L.uniforms.texelSize,a.texelSizeX,a.texelSizeY),t.uniform1i(L.uniforms.uPressure,S.read.attach(0)),t.uniform1i(L.uniforms.uVelocity,a.read.attach(1)),d(a.write),a.swap(),h.bind(),t.uniform2f(h.uniforms.texelSize,a.texelSizeX,a.texelSizeY),R.supportLinearFiltering||t.uniform2f(h.uniforms.dyeTexelSize,a.texelSizeX,a.texelSizeY);let r=a.read.attach(0);t.uniform1i(h.uniforms.uVelocity,r),t.uniform1i(h.uniforms.uSource,r),t.uniform1f(h.uniforms.dt,e),t.uniform1f(h.uniforms.dissipation,s.VELOCITY_DISSIPATION),d(a.write),a.swap(),R.supportLinearFiltering||t.uniform2f(h.uniforms.dyeTexelSize,v.texelSizeX,v.texelSizeY),t.uniform1i(h.uniforms.uVelocity,a.read.attach(0)),t.uniform1i(h.uniforms.uSource,v.read.attach(1)),t.uniform1f(h.uniforms.dissipation,s.DENSITY_DISSIPATION),d(v.write),v.swap()}function Ge(e){t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.enable(t.BLEND),Ye(e)}function Ye(e){let r=t.drawingBufferWidth,i=t.drawingBufferHeight;b.bind(),s.SHADING&&t.uniform2f(b.uniforms.texelSize,1/r,1/i),t.uniform1i(b.uniforms.uTexture,v.read.attach(0)),d(e)}function Ve(e){let r=e.deltaX*s.SPLAT_FORCE,i=e.deltaY*s.SPLAT_FORCE;Q(e.texcoordX,e.texcoordY,r,i,e.color)}function He(e){const r=B();r.r*=10,r.g*=10,r.b*=10;let i=10*(Math.random()-.5),o=30*(Math.random()-.5);Q(e.texcoordX,e.texcoordY,i,o,r)}function Q(e,r,i,o,n){D.bind(),t.uniform1i(D.uniforms.uTarget,a.read.attach(0)),t.uniform1f(D.uniforms.aspectRatio,l.width/l.height),t.uniform2f(D.uniforms.point,e,r),t.uniform3f(D.uniforms.color,i,o,0),t.uniform1f(D.uniforms.radius,We(s.SPLAT_RADIUS/100)),d(a.write),a.swap(),t.uniform1i(D.uniforms.uTarget,v.read.attach(0)),t.uniform3f(D.uniforms.color,n.r,n.g,n.b),d(v.write),v.swap()}function We(e){let r=l.width/l.height;return r>1&&(e*=r),e}function Z(e,r,i,o){e.id=r,e.down=!0,e.moved=!1,e.texcoordX=i/l.width,e.texcoordY=1-o/l.height,e.prevTexcoordX=e.texcoordX,e.prevTexcoordY=e.texcoordY,e.deltaX=0,e.deltaY=0,e.color=B()}function O(e,r,i,o){e.prevTexcoordX=e.texcoordX,e.prevTexcoordY=e.texcoordY,e.texcoordX=r/l.width,e.texcoordY=1-i/l.height,e.deltaX=je(e.texcoordX-e.prevTexcoordX),e.deltaY=ke(e.texcoordY-e.prevTexcoordY),e.moved=Math.abs(e.deltaX)>0||Math.abs(e.deltaY)>0,e.color=o}function Ke(e){e.down=!1}function je(e){let r=l.width/l.height;return r<1&&(e*=r),e}function ke(e){let r=l.width/l.height;return r>1&&(e/=r),e}function B(){const e=.08+Math.random()*.12;return{r:e,g:e,b:e}}function qe(e,r,i){const o=i-r;return(e-r)%o+r}function $(e){let r=t.drawingBufferWidth/t.drawingBufferHeight;r<1&&(r=1/r);const i=Math.round(e),o=Math.round(e*r);return t.drawingBufferWidth>t.drawingBufferHeight?{width:o,height:i}:{width:i,height:o}}function g(e){const r=window.devicePixelRatio||1;return Math.floor(e*r)}function Je(e){if(e.length===0)return 0;let r=0;for(let i=0;i<e.length;i++)r=(r<<5)-r+e.charCodeAt(i),r|=0;return r}function ee(e){let r=y[0],i=g(e.clientX),o=g(e.clientY);Z(r,-1,i,o),He(r)}let te=!1;function re(e){let r=y[0],i=g(e.clientX),o=g(e.clientY);if(te)O(r,i,o,r.color);else{let n=B();O(r,i,o,n),te=!0}}function ie(e){const r=e.targetTouches;let i=y[0];for(let o=0;o<r.length;o++){let n=g(r[o].clientX),c=g(r[o].clientY);Z(i,r[o].identifier,n,c)}}function oe(e){const r=e.targetTouches;let i=y[0];for(let o=0;o<r.length;o++){let n=g(r[o].clientX),c=g(r[o].clientY);O(i,n,c,i.color)}}function ne(e){const r=e.changedTouches;let i=y[0];for(let o=0;o<r.length;o++)Ke(i)}return window.addEventListener("mousedown",ee),window.addEventListener("mousemove",re),window.addEventListener("touchstart",ie),window.addEventListener("touchmove",oe,!1),window.addEventListener("touchend",ne),J(),()=>{V=!1,w.current&&(cancelAnimationFrame(w.current),w.current=null),window.removeEventListener("mousedown",ee),window.removeEventListener("mousemove",re),window.removeEventListener("touchstart",ie),window.removeEventListener("touchmove",oe),window.removeEventListener("touchend",ne)}},[]),ue.jsx("div",{style:{position:"fixed",top:0,left:0,zIndex:50,pointerEvents:"none",width:"100%",height:"100%"},children:ue.jsx("canvas",{ref:Y,id:"fluid",style:{width:"100vw",height:"100vh",display:"block"}})})}export{tt as default};
