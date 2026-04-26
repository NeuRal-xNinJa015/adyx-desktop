import{r as c,j as s,A as D,m as k}from"./index-BPfu8E-i.js";import{S as L,T as I,a as _,M as O}from"./config-CxKj1KNY.js";let v=!1,o=[],m=null,r=null,E=!1,d=[],y=[];function P(){if(!L.examMode){console.log("[SecureMode] Disabled by config");return}v||(console.log("[SecureMode] Initializing content protection..."),v=!0,d=[],R(),M(),F(),j(),H(),z(),U(),V(),q(),$(),W(),i("SECURE_MODE_START","Content protection activated"),console.log("[SecureMode] All content protections active"))}function N(){v&&(o.forEach(n=>n()),o=[],m&&(clearInterval(m),m=null),A(),document.getElementById("adyx-secure-noselect")?.remove(),document.getElementById("adyx-secure-noprint")?.remove(),v=!1,d=[],y=[],console.log("[SecureMode] Content protection released"))}function K(n){return y.push(n),()=>{y=y.filter(t=>t!==n)}}function B(){const n=document.documentElement,t=n.requestFullscreen||n.webkitRequestFullscreen||n.msRequestFullscreen;return t?t.call(n).then(()=>!0).catch(()=>!1):Promise.resolve(!1)}function i(n,t){const e={type:n,message:t,timestamp:new Date().toISOString()};d.push(e),d.length>100&&(d=d.slice(-100)),y.forEach(a=>{try{a(e)}catch{}}),console.log(`[SecureMode] ${n}: ${t}`)}function R(){r||(r=document.createElement("div"),r.id="adyx-secure-blur",r.style.cssText=`
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.97);
        backdrop-filter: blur(30px);
        display: none;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 20px;
        z-index: 99999;
        cursor: pointer;
        font-family: 'JetBrains Mono', 'SF Mono', monospace;
        transition: opacity 0.2s ease;
    `,r.innerHTML=`
        <div style="font-size: 40px; opacity: 0.5;">LOCKED</div>
        <div style="color: #ffffff; font-size: 14px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 600;">
            CONTENT PROTECTED
        </div>
        <div id="adyx-blur-reason" style="color: #666; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;"></div>
        <div style="color: #333; font-size: 9px; letter-spacing: 0.1em; margin-top: 20px;">
            RETURN TO THIS TAB TO CONTINUE • ALL MESSAGES ARE ENCRYPTED
        </div>
    `,r.addEventListener("click",()=>{document.hidden||l()}),document.body.appendChild(r))}function f(n=""){if(r&&!E){E=!0;const t=r.querySelector("#adyx-blur-reason");t&&(t.textContent=n),r.style.display="flex"}}function l(){r&&E&&(E=!1,r.style.display="none")}function A(){r&&(r.remove(),r=null),E=!1}function M(){const n=e=>{if(e.key==="PrintScreen"||e.code==="PrintScreen"){e.preventDefault(),e.stopImmediatePropagation();try{navigator.clipboard.writeText("").catch(()=>{})}catch{}return f("Screenshot attempt blocked"),setTimeout(()=>{document.hasFocus()&&l()},1500),i("SCREENSHOT_BLOCKED","PrintScreen key intercepted"),!1}if(e.shiftKey&&(e.metaKey||e.key==="Meta")&&(e.key==="s"||e.key==="S"))return e.preventDefault(),e.stopImmediatePropagation(),f("Screen capture blocked"),setTimeout(()=>{document.hasFocus()&&l()},1500),i("SCREENSHOT_BLOCKED","Win+Shift+S intercepted"),!1;if(e.metaKey&&e.shiftKey&&["3","4","5"].includes(e.key))return e.preventDefault(),e.stopImmediatePropagation(),f("Screen capture blocked"),setTimeout(()=>{document.hasFocus()&&l()},1500),i("SCREENSHOT_BLOCKED","macOS screenshot shortcut intercepted"),!1},t=e=>{if(e.key==="PrintScreen"||e.code==="PrintScreen"){e.preventDefault();try{navigator.clipboard.writeText("").catch(()=>{})}catch{}}};document.addEventListener("keydown",n,!0),document.addEventListener("keyup",t,!0),o.push(()=>{document.removeEventListener("keydown",n,!0),document.removeEventListener("keyup",t,!0)})}function F(){const n=()=>{document.hidden?(f("Tab hidden — messages protected"),i("TAB_HIDDEN","Content blurred — tab not visible")):l()};document.addEventListener("visibilitychange",n),o.push(()=>document.removeEventListener("visibilitychange",n));const t=()=>{f("Window not focused — messages hidden"),i("WINDOW_BLUR","Content blurred — window lost focus")},e=()=>{l()};window.addEventListener("blur",t),window.addEventListener("focus",e),o.push(()=>{window.removeEventListener("blur",t),window.removeEventListener("focus",e)})}function j(){const n=e=>{const a=e.key?.toLowerCase();if((e.ctrlKey||e.metaKey)&&["c","x","a"].includes(a))return e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"?void 0:(e.preventDefault(),e.stopImmediatePropagation(),i("CLIPBOARD_BLOCKED",`${e.ctrlKey?"Ctrl":"Cmd"}+${e.key.toUpperCase()} on message content`),!1)};document.addEventListener("keydown",n,!0),o.push(()=>document.removeEventListener("keydown",n,!0));const t=e=>{e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||(e.preventDefault(),e.stopImmediatePropagation())};["copy","cut"].forEach(e=>{document.addEventListener(e,t,!0),o.push(()=>document.removeEventListener(e,t,!0))})}function H(){const n=t=>(t.preventDefault(),t.stopImmediatePropagation(),i("RIGHT_CLICK_BLOCKED","Context menu prevented"),!1);document.addEventListener("contextmenu",n,!0),o.push(()=>document.removeEventListener("contextmenu",n,!0))}function z(){const n=t=>{if((t.ctrlKey||t.metaKey)&&t.key?.toLowerCase()==="p")return t.preventDefault(),t.stopImmediatePropagation(),i("PRINT_BLOCKED","Print attempt prevented"),!1};document.addEventListener("keydown",n,!0),o.push(()=>document.removeEventListener("keydown",n,!0))}function U(){const n=e=>{if(e.key==="F12"||e.keyCode===123)return e.preventDefault(),e.stopImmediatePropagation(),i("DEVTOOLS_BLOCKED","F12 prevented"),!1;if((e.ctrlKey||e.metaKey)&&e.shiftKey){const a=e.key?.toLowerCase();if(["i","j","c"].includes(a))return e.preventDefault(),e.stopImmediatePropagation(),i("DEVTOOLS_BLOCKED",`Ctrl+Shift+${e.key.toUpperCase()} prevented`),!1}if((e.ctrlKey||e.metaKey)&&e.key?.toLowerCase()==="u")return e.preventDefault(),e.stopImmediatePropagation(),i("DEVTOOLS_BLOCKED","View source prevented"),!1};document.addEventListener("keydown",n,!0),o.push(()=>document.removeEventListener("keydown",n,!0));let t=!1;m=setInterval(()=>{const e=window.outerWidth-window.innerWidth>160,a=window.outerHeight-window.innerHeight>160,u=e||a;u&&!t?(t=!0,f("Developer tools detected — content hidden"),i("DEVTOOLS_DETECTED","DevTools open — content blurred")):!u&&t&&(t=!1,document.hidden||l())},1e3),o.push(()=>{clearInterval(m),m=null})}function V(){const n=t=>{if((t.ctrlKey||t.metaKey)&&t.key?.toLowerCase()==="s"&&t.target.tagName!=="INPUT"&&t.target.tagName!=="TEXTAREA"||t.key==="F5"||(t.ctrlKey||t.metaKey)&&t.key?.toLowerCase()==="r")return t.preventDefault(),t.stopImmediatePropagation(),!1};document.addEventListener("keydown",n,!0),o.push(()=>document.removeEventListener("keydown",n,!0))}function W(){const n=t=>{if(v)return t.preventDefault(),t.returnValue="You are in a secure session. Leaving will destroy all messages. Are you sure?",t.returnValue};window.addEventListener("beforeunload",n),o.push(()=>window.removeEventListener("beforeunload",n))}function q(){if(document.getElementById("adyx-secure-noselect"))return;const n=document.createElement("style");n.id="adyx-secure-noselect",n.textContent=`
        /* Disable text selection on messages */
        .chat__messages, .msg__bubble, .msg__time, .msg__delivery,
        .chat__sidebar-content, .chat__sidebar-log {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
        }
        /* Allow selection in input */
        .chat__input, input, textarea {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            user-select: text !important;
        }
        /* Disable drag on all elements in chat */
        .chat img, .chat a, .msg img {
            -webkit-user-drag: none !important;
            user-drag: none !important;
        }
    `,document.head.appendChild(n),o.push(()=>n.remove())}function $(){if(document.getElementById("adyx-secure-noprint"))return;const n=document.createElement("style");n.id="adyx-secure-noprint",n.textContent=`
        @media print {
            html, body, body * {
                display: none !important;
                visibility: hidden !important;
            }
            body::after {
                content: 'CLASSIFIED — PRINTING DISABLED';
                display: block !important;
                visibility: visible !important;
                font-size: 24px;
                text-align: center;
                padding: 100px;
                color: #ff0000;
                font-family: monospace;
            }
        }
    `,document.head.appendChild(n),o.push(()=>n.remove())}function Y({children:n,onForceEnd:t}){const e=L.examMode,[a,u]=c.useState(!1),[b,C]=c.useState(null),[T,S]=c.useState(!1),p=c.useRef(null),g=c.useRef(!1);c.useEffect(()=>(g.current||(g.current=!0,P(),u(!0)),()=>{g.current&&(N(),g.current=!1,u(!1))}),[e?.enabled]),c.useEffect(()=>{const h=K(x=>{(x.type.includes("BLOCKED")||x.type.includes("DETECTED"))&&(C(x),p.current&&clearTimeout(p.current),p.current=setTimeout(()=>C(null),2500))});return()=>{h(),p.current&&clearTimeout(p.current)}},[e?.enabled]),c.useEffect(()=>{const h=()=>S(!!document.fullscreenElement);return document.addEventListener("fullscreenchange",h),()=>document.removeEventListener("fullscreenchange",h)},[]);const w=c.useCallback(()=>{document.fullscreenElement?document.exitFullscreen().catch(()=>{}):B()},[]);return s.jsxs(s.Fragment,{children:[n,s.jsx(D,{children:b&&s.jsxs(k.div,{className:"secure-notif",initial:{y:-60,opacity:0},animate:{y:0,opacity:1},exit:{y:-60,opacity:0},transition:{type:"spring",damping:25,stiffness:300},children:[s.jsx(I,{size:14,className:"secure-notif__icon"}),s.jsx("span",{className:"secure-notif__text",children:b.message})]})}),s.jsxs("div",{className:"secure-badge",children:[s.jsx("span",{className:"secure-badge__dot"}),s.jsx("span",{className:"secure-badge__label",children:"PROTECTED"}),s.jsx("button",{className:"secure-badge__fs-btn",onClick:w,title:T?"Exit fullscreen":"Enter fullscreen for maximum privacy",children:T?s.jsx(_,{size:10}):s.jsx(O,{size:10})})]})]})}export{Y as default};
