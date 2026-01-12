import{v as ee,g as m,T as _e,o as kt,O as I,C as g,D as f,d as q,E as S,F as H,c as s,G as c,e as we,N as te,m as U,b as Ct,a as We,n as Ee,u as Ke,S as _,L as x,f as Tt,w as It,Q as At}from"./routing-B7jzI0cA.js";import{a as Pe,W as Et,b as Pt,c as Bt,g as Rt,d as Ft,e as xe,h as B,i as Ge,j as Ot,k as zt,l as ie,m as Dt,n as Yt,o as Mt,p as Lt,q as Nt,f as Vt,r as Ne,s as Ve,u as jt}from"./useMarketRates-JgGS7IfJ.js";import{d as y,a as le,C as de,u as Ut,S as je,b as Xe,c as Je}from"./Skeleton-C1xzzMRx.js";import{c as Ze,B as Ue}from"./Button-BR5GwXUA.js";import{c as qt}from"./AnimatedNumber-8qFdYZUa.js";import{F as et,e as tt,f as nt,g as Ht,h as Qt,i as Wt,j as Kt,u as Gt,k as Xt,l as Jt,S as Zt,a as en,b as tn,c as nn,d as rn}from"./Select-Dp1oBAXh.js";import{e as an,g as sn}from"./QZDH5R5B-6uz7kdzU.js";import{m as Be,l as on,P as rt,b as X,e as at,d as st,_ as ot,B as ln,n as dn,o as cn}from"./UKTBL2JL-BCNO-nq3.js";function un(){const{provider:t,wallet:e,address:n,isConnected:r}=Pe(),[o,a]=ee(null),i=m(()=>({wallet:e(),address:n()}));return _e(()=>{const{wallet:d,address:p}=i();if(!d||!p){a(null);return}let u=!1;Et.connectSilent(t,d).then(h=>{u||a(h)}).catch(h=>{u||(console.error("Failed to create WalletAccount:",h),a(null))}),kt(()=>{u=!0})}),{address:n,isConnected:r,account:o}}const gn=1200;function $e(t){const e=gn;return BigInt(Math.floor(Date.now()/1e3)+e)}function pn(t,e,n,r){const o={buy_pt:{input:e,output:n},sell_pt:{input:n,output:e},buy_yt:{input:e,output:r},sell_yt:{input:r,output:e}};return{inputTokenAddress:o[t].input,outputTokenAddress:o[t].output}}function fn(){const{network:t}=Pe(),{account:e,address:n}=un(),r=Pt(),o=Bt(()=>({mutationFn:async a=>{const i=e(),d=n();if(!i||!d)throw new Error("Wallet not connected");const u=Rt(t).router,h=Ft(i,t),b=[];if(a.direction==="buy_pt"){const w=xe(a.syAddress,i).populate("approve",[u,B.bnToUint256(a.amountIn)]);b.push(w);const k=h.populate("swap_exact_sy_for_pt",[a.marketAddress,d,B.bnToUint256(a.amountIn),B.bnToUint256(a.minAmountOut),$e()]);b.push(k)}else if(a.direction==="sell_pt"){const w=xe(a.ptAddress,i).populate("approve",[u,B.bnToUint256(a.amountIn)]);b.push(w);const k=h.populate("swap_exact_pt_for_sy",[a.marketAddress,d,B.bnToUint256(a.amountIn),B.bnToUint256(a.minAmountOut),$e()]);b.push(k)}else if(a.direction==="buy_yt"){const w=xe(a.syAddress,i).populate("approve",[u,B.bnToUint256(a.amountIn)]);b.push(w);const k=h.populate("swap_exact_sy_for_yt",[a.ytAddress,a.marketAddress,d,B.bnToUint256(a.amountIn),B.bnToUint256(a.minAmountOut),$e()]);b.push(k)}else{const v=xe(a.ytAddress,i),w=xe(a.syAddress,i),k=v.populate("approve",[u,B.bnToUint256(a.amountIn)]);b.push(k);const R=a.amountIn*BigInt(4),M=w.populate("approve",[u,B.bnToUint256(R)]);b.push(M);const Q=h.populate("swap_exact_yt_for_sy",[a.ytAddress,a.marketAddress,d,B.bnToUint256(a.amountIn),B.bnToUint256(R),B.bnToUint256(a.minAmountOut),$e()]);b.push(Q)}return{transactionHash:(await i.execute(b)).transaction_hash,amountOut:a.minAmountOut}},onMutate:async a=>{const i=n(),{inputTokenAddress:d,outputTokenAddress:p}=pn(a.direction,a.syAddress,a.ptAddress,a.ytAddress);await r.cancelQueries({queryKey:["token-balance",d,i]}),await r.cancelQueries({queryKey:["token-balance",p,i]});const u=r.getQueryData(["token-balance",d,i]),h=r.getQueryData(["token-balance",p,i]);if(u!==void 0){const b=BigInt(u)-a.amountIn;r.setQueryData(["token-balance",d,i],(b>0n?b:0n).toString())}if(h!==void 0){const b=BigInt(h)+a.minAmountOut;r.setQueryData(["token-balance",p,i],b.toString())}return{previousInputBalance:u,previousOutputBalance:h,inputTokenAddress:d,outputTokenAddress:p}},onError:(a,i,d)=>{const p=n();d&&(d.previousInputBalance!==void 0&&r.setQueryData(["token-balance",d.inputTokenAddress,p],d.previousInputBalance),d.previousOutputBalance!==void 0&&r.setQueryData(["token-balance",d.outputTokenAddress,p],d.previousOutputBalance))},onSettled:()=>{r.invalidateQueries({queryKey:["market"]}),r.invalidateQueries({queryKey:["token-balance"]}),r.invalidateQueries({queryKey:["token-allowance"]})}}));return{swap:o.mutate,swapAsync:o.mutateAsync,isSwapping:m(()=>o.isPending),isSuccess:m(()=>o.isSuccess),isError:m(()=>o.isError),error:m(()=>o.error),transactionHash:m(()=>o.data?.transactionHash),reset:o.reset}}function mn(t,e){const n=BigInt(1e4-e);return t*n/BigInt(1e4)}const hn={PT:"Principal Token – fixed yield at maturity",YT:"Yield Token – leveraged yield exposure"};function bn(t){return hn[t]}function vn(t){return t==="PT"||t==="YT"}function xn(t){return t==="buy"||t==="sell"}const yn={PT:{buy:"buy_pt",sell:"sell_pt"},YT:{buy:"buy_yt",sell:"sell_yt"}};function wn(t,e){return yn[t][e?"buy":"sell"]}function $n(t,e,n){if(n===0n||e.syReserve===0n||e.ptReserve===0n)return null;try{return _n(t,e,n)}catch{return null}}function _n(t,e,n){switch(t){case"buy_pt":return Ot(e,n);case"sell_pt":return Ge(e,n);case"buy_yt":return Sn(e,n);case"sell_yt":return kn(e,n)}}function Sn(t,e){const n=Ge(t,e);return{amountOut:e,fee:n.fee,newLnImpliedRate:n.newLnImpliedRate,priceImpact:n.priceImpact,effectivePrice:e>0n?(e-n.amountOut)*ie/e:ie,spotPrice:ie-n.spotPrice}}function kn(t,e){const n=e,r=zt(t,n),o=r.amountOut,a=n>o?n-o:0n;return{amountOut:a,fee:r.fee,newLnImpliedRate:r.newLnImpliedRate,priceImpact:r.priceImpact,effectivePrice:a>0n?o*ie/a:ie,spotPrice:ie-r.spotPrice}}function Cn(t){const{state:e,tokenType:n,isBuying:r}=t;return e.isSwapping?{label:"Swapping...",disabled:!0}:e.isConnected?e.isExpired?{label:"Market Expired",disabled:!0}:e.isValidAmount?e.hasInsufficientBalance?{label:"Insufficient Balance",disabled:!0}:e.hasInsufficientCollateral?{label:"Insufficient Collateral",disabled:!0}:e.priceImpactRequiresAck&&!e.priceImpactAcknowledged?{label:"Acknowledge Price Impact",disabled:!0}:e.isSuccess?{label:"Swapped!",disabled:!0}:e.priceImpactCanProceed?{label:`${r?"Buy":"Sell"} ${n}`,disabled:!1}:{label:"Price Impact Too High",disabled:!0}:{label:"Enter Amount",disabled:!0}:{label:"Connect Wallet",disabled:!0}}function Tn(t,e,n){const r=`SY-${t}`,o=`PT-${t}`,a=`YT-${t}`;return{sy:r,pt:o,yt:a,input:n?r:e==="PT"?o:a,output:n?e==="PT"?o:a:r}}function In(t,e){return e?t==="PT"?{containerClass:"bg-primary/10",textClass:"text-primary",displayText:"PT"}:{containerClass:"bg-chart-2/10",textClass:"text-chart-2",displayText:"YT"}:{containerClass:"bg-chart-1/10",textClass:"text-chart-1",displayText:"SY"}}function An(t){const{isBuying:e,hasInsufficientBalance:n,isFlipping:r,isValidAmount:o,priceImpactSeverity:a,direction:i}=t;return{formGradient:e?"primary":"destructive",inputError:n?"Insufficient balance":void 0,flipButtonClass:r?"rotate-180":"",showPriceImpactWarning:o&&a!=="low",showYtCollateralWarning:i==="sell_yt"&&o,sellButtonClass:e?"":"bg-destructive hover:bg-destructive/90 text-destructive-foreground"}}var En=f("<div aria-hidden=true>"),Re=f("<div>"),Pn=f("<div><span></span><span>");function Bn(t){const[e,n]=I(t,["class","gradient","children"]),r=()=>e.gradient??"none";return s(de,S({get class(){return y("relative overflow-hidden",e.class)}},n,{get children(){return[U(()=>U(()=>r()!=="none")()&&(()=>{var o=g(En);return we(()=>te(o,y("pointer-events-none absolute inset-0 transition-all duration-500",r()==="primary"&&"from-primary/5 bg-gradient-to-br via-transparent to-transparent",r()==="destructive"&&"from-destructive/5 bg-gradient-to-br via-transparent to-transparent",r()==="success"&&"from-success/5 bg-gradient-to-br via-transparent to-transparent"))),o})()),s(le,{class:"relative space-y-6 p-5",get children(){return e.children}})]}}))}function Rn(t){const[e,n]=I(t,["class"]);return(()=>{var r=g(Re);return q(r,S({get class(){return y("space-y-4",e.class)}},n),!1,!1),H(),r})()}function Fn(t){const[e,n]=I(t,["class","children"]);return s(de,{get class(){return y("bg-muted/50 overflow-hidden",e.class)},get children(){return s(le,S({class:"space-y-2 p-4"},n,{get children(){return e.children}}))}})}function On(t){const[e,n]=I(t,["class"]);return(()=>{var r=g(Re);return q(r,S({get class(){return y("pt-2",e.class)}},n),!1,!1),H(),r})()}function zn(t){const[e,n]=I(t,["class"]);return(()=>{var r=g(Re);return q(r,S({get class(){return y("relative flex justify-center",e.class)}},n),!1,!1),H(),r})()}function Te(t){const[e,n]=I(t,["class","label","value","labelClass","valueClass"]);return(()=>{var r=g(Pn),o=r.firstChild,a=o.nextSibling;return q(r,S({get class(){return y("flex items-center justify-between gap-2",e.class)}},n),!1,!0),c(o,()=>e.label),c(a,()=>e.value),we(i=>{var d=y("text-muted-foreground",e.labelClass),p=y("text-foreground",e.valueClass);return d!==i.e&&te(o,i.e=d),p!==i.t&&te(a,i.t=p),i},{e:void 0,t:void 0}),H(),r})()}var Dn={};ot(Dn,{Description:()=>nt,ErrorMessage:()=>tt,Input:()=>lt,Label:()=>et,Root:()=>ct,TextArea:()=>ut,TextField:()=>ce,useTextFieldContext:()=>Fe});var it=We();function Fe(){const t=Ke(it);if(t===void 0)throw new Error("[kobalte]: `useTextFieldContext` must be used within a `TextField` component");return t}function lt(t){return s(dt,S({type:"text"},t))}function dt(t){const e=Gt(),n=Fe(),r=Be({id:n.generateId("input")},t),[o,a,i]=I(r,["onInput"],Xt),{fieldProps:d}=Jt(a);return s(rt,S({as:"input",get id(){return d.id()},get name(){return e.name()},get value(){return n.value()},get required(){return e.isRequired()},get disabled(){return e.isDisabled()},get readonly(){return e.isReadOnly()},get"aria-label"(){return d.ariaLabel()},get"aria-labelledby"(){return d.ariaLabelledBy()},get"aria-describedby"(){return d.ariaDescribedBy()},get"aria-invalid"(){return e.validationState()==="invalid"||void 0},get"aria-required"(){return e.isRequired()||void 0},get"aria-disabled"(){return e.isDisabled()||void 0},get"aria-readonly"(){return e.isReadOnly()||void 0},get onInput(){return st([o.onInput,n.onInput])}},()=>e.dataset(),i))}function ct(t){let e;const n=`textfield-${Ct()}`,r=Be({id:n},t),[o,a,i]=I(r,["ref","value","defaultValue","onChange"],Ht),d=o.value,[p,u]=an({value:()=>d===void 0?void 0:o.value??"",defaultValue:()=>o.defaultValue,onChange:v=>o.onChange?.(v)}),{formControlContext:h}=Qt(a);Wt(()=>e,()=>u(o.defaultValue??""));const b=v=>{if(h.isReadOnly()||h.isDisabled())return;const w=v.target;u(w.value),w.value=p()??""},z={value:p,generateId:on(()=>X(a.id)),onInput:b};return s(Kt.Provider,{value:h,get children(){return s(it.Provider,{value:z,get children(){return s(rt,S({as:"div",ref(v){var w=at(k=>e=k,o.ref);typeof w=="function"&&w(v)},role:"group",get id(){return X(a.id)}},()=>h.dataset(),i))}})}})}function ut(t){let e;const n=Fe(),r=Be({id:n.generateId("textarea")},t),[o,a]=I(r,["ref","autoResize","submitOnEnter","onKeyPress"]);_e(Ee([()=>e,()=>o.autoResize,()=>n.value()],([d,p])=>{!d||!p||Yn(d)}));const i=d=>{e&&o.submitOnEnter&&d.key==="Enter"&&!d.shiftKey&&e.form&&(e.form.requestSubmit(),d.preventDefault())};return s(dt,S({as:"textarea",get"aria-multiline"(){return o.submitOnEnter?"false":void 0},get onKeyPress(){return st([o.onKeyPress,i])},ref(d){var p=at(u=>e=u,o.ref);typeof p=="function"&&p(d)}},a))}function Yn(t){const e=t.style.alignSelf,n=t.style.overflow;"MozAppearance"in t.style||(t.style.overflow="hidden"),t.style.alignSelf="start",t.style.height="auto",t.style.height=`${t.scrollHeight+(t.offsetHeight-t.clientHeight)}px`,t.style.overflow=n,t.style.alignSelf=e}var ce=Object.assign(ct,{Description:nt,ErrorMessage:tt,Input:lt,Label:et,TextArea:ut}),Mn=f('<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">'),Ln=f('<div class="absolute inset-y-0 right-0 flex items-center pr-3">'),Nn=f("<div class=relative><!$><!/><!$><!/><!$><!/>");function Vn(t){const[e,n]=I(t,["class"]);return s(ce.Input,S({"data-slot":"input",get class(){return y("bg-input/30 border-input flex h-9 w-full rounded-lg border px-3 py-1 text-base","transition-all duration-150 ease-out","hover:border-input/80 hover:bg-input/40","file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium","placeholder:text-muted-foreground placeholder:transition-opacity focus:placeholder:opacity-70","focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none","focus-visible:bg-input/50","disabled:hover:border-input disabled:hover:bg-input/30 disabled:cursor-not-allowed disabled:opacity-50","aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-destructive/30","md:text-sm",e.class)}},n))}function jn(t){return s(ce,S({"data-slot":"text-field"},t))}function Un(t){const[e,n]=I(t,["class"]);return s(ce.Label,S({"data-slot":"text-field-label",get class(){return y("text-foreground mb-1.5 block text-sm font-medium",e.class)}},n))}function qn(t){const[e,n]=I(t,["class"]);return s(ce.Description,S({"data-slot":"text-field-description",get class(){return y("text-muted-foreground mt-1.5 text-sm",e.class)}},n))}function Hn(t){const[e,n]=I(t,["class"]);return s(ce.ErrorMessage,S({"data-slot":"text-field-error",get class(){return y("text-destructive mt-1.5 text-sm",e.class)}},n))}function Qn(t){const[e,n]=I(t,["label","error","hint","leftElement","rightElement","id","name","class","value","onValueChange"]),r=()=>e.id??e.label?.toLowerCase().replace(/\s+/g,"-");return s(jn,S({class:"w-full"},()=>e.name!==void 0&&{name:e.name},()=>e.value!==void 0&&{value:e.value},()=>e.onValueChange!==void 0&&{onChange:e.onValueChange},()=>e.error!==void 0&&{validationState:"invalid"},{get children(){return[s(_,{get when(){return e.label},get children(){return s(Un,{get for(){return r()},get children(){return e.label}})}}),(()=>{var o=g(Nn),a=o.firstChild,[i,d]=x(a.nextSibling),p=i.nextSibling,[u,h]=x(p.nextSibling),b=u.nextSibling,[z,v]=x(b.nextSibling);return c(o,s(_,{get when(){return e.leftElement},get children(){var w=g(Mn);return c(w,()=>e.leftElement),w}}),i,d),c(o,s(Vn,S({get id(){return r()},get class(){return y(e.leftElement&&"pl-10",e.rightElement&&"pr-20",e.class)}},n)),u,h),c(o,s(_,{get when(){return e.rightElement},get children(){var w=g(Ln);return c(w,()=>e.rightElement),w}}),z,v),o})(),s(_,{get when(){return e.error},get children(){return s(Hn,{get children(){return e.error}})}}),s(_,{get when(){return U(()=>!!e.hint)()&&!e.error},get children(){return s(qn,{get children(){return e.hint}})}})]}}))}function Wn(t){const[e,n]=I(t,["value","onChange","decimals"]),r=()=>e.decimals??18;return s(Qn,S({type:"text",inputMode:"decimal",get value(){return e.value},onInput:a=>{const i=a.currentTarget.value;if(i===""){e.onChange("");return}new RegExp(`^\\d*\\.?\\d{0,${String(r())}}$`).test(i)?e.onChange(i):a.currentTarget.value=e.value}},n))}var Kn=f("<div data-slot=alert role=alert>"),Gn=f("<div data-slot=alert-title>"),Xn=f("<div data-slot=alert-description>");const Jn=Ze('grid gap-0.5 rounded-lg border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*="size-"])]:size-4 w-full relative group/alert',{variants:{variant:{default:"bg-card text-card-foreground",destructive:"text-destructive bg-destructive/10 border-destructive/30 *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",warning:"text-warning bg-warning/10 border-warning/30 *:data-[slot=alert-description]:text-warning/90 *:[svg]:text-current",info:"text-blue-500 bg-blue-500/10 border-blue-500/30 *:data-[slot=alert-description]:text-blue-500/90 *:[svg]:text-current"}},defaultVariants:{variant:"default"}});function Zn(t){const[e,n]=I(t,["class","variant"]);return(()=>{var r=g(Kn);return q(r,S({get class(){return y(Jn({variant:e.variant}),e.class)}},n),!1,!1),H(),r})()}function er(t){const[e,n]=I(t,["class"]);return(()=>{var r=g(Gn);return q(r,S({get class(){return y("[&_a]:hover:text-foreground font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3",e.class)}},n),!1,!1),H(),r})()}function tr(t){const[e,n]=I(t,["class"]);return(()=>{var r=g(Xn);return q(r,S({get class(){return y("text-muted-foreground [&_a]:hover:text-foreground text-sm text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",e.class)}},n),!1,!1),H(),r})()}var nr=f('<svg class=size-4 fill=none viewBox="0 0 24 24"stroke=currentColor aria-hidden=true><path stroke-linecap=round stroke-linejoin=round stroke-width=2 d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z">'),rr=f('<svg class=size-4 fill=none viewBox="0 0 24 24"stroke=currentColor aria-hidden=true><path stroke-linecap=round stroke-linejoin=round stroke-width=2 d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">'),ar=f('<svg class=size-4 fill=none viewBox="0 0 24 24"stroke=currentColor aria-hidden=true><path stroke-linecap=round stroke-linejoin=round stroke-width=2 d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">');const sr=[{days:7,severity:"info"},{days:3,severity:"warning"},{days:1,severity:"critical"}],or={swap:"Trading will cease at expiry.",mint:"Position will mature at expiry.",portfolio:"Claim any accrued yield before expiry."},ir={info:"info",warning:"warning",critical:"destructive"},qe={info:g(nr),warning:g(rr),critical:g(ar)};function lr(t,e){let n=null;for(const r of e)t<=r.days&&(n=r.severity);return n}function dr(t){if(t<1){const n=Math.floor(t*24);return n<=1?"less than 1 hour":`${String(n)} hours`}const e=Math.floor(t);return e===1?"1 day":`${String(e)} days`}function cr(t){const e=()=>t.thresholds??sr,n=()=>t.context??"swap",r=()=>Yt(t.expiryTimestamp),o=()=>lr(r(),e()),a=()=>Mt(t.expiryTimestamp),i=()=>!a()&&o()!==null,d=()=>{const v=o();return v!==null?ir[v]:"info"},p=()=>{const v=o();return v!==null?qe[v]:qe.info},u=()=>or[n()],h=()=>Dt(t.expiryTimestamp),b=()=>dr(r()),z=()=>o()==="critical"?"Expiring very soon":`Expires in ${b()}`;return s(_,{get when(){return i()},get children(){return s(Zn,{get variant(){return d()},get class(){return t.class},get"aria-live"(){return o()==="critical"?"assertive":"polite"},get children(){return[U(()=>p()),s(er,{get children(){return z()}}),s(tr,{get children(){return[U(()=>u())," Expiry date: ",U(()=>h()),"."]}})]}})}})}function ur(t={}){const[e,n]=sn({value:()=>X(t.isSelected),defaultValue:()=>!!X(t.defaultIsSelected),onChange:a=>t.onSelectedChange?.(a)});return{isSelected:e,setIsSelected:a=>{!X(t.isReadOnly)&&!X(t.isDisabled)&&n(a)},toggle:()=>{!X(t.isReadOnly)&&!X(t.isDisabled)&&n(!e())}}}var gr={};ot(gr,{Root:()=>gt,ToggleButton:()=>pt});function gt(t){const[e,n]=I(t,["children","pressed","defaultPressed","onChange","onClick"]),r=ur({isSelected:()=>e.pressed,defaultIsSelected:()=>e.defaultPressed,onSelectedChange:a=>e.onChange?.(a),isDisabled:()=>n.disabled});return s(ln,S({get"aria-pressed"(){return r.isSelected()},get"data-pressed"(){return r.isSelected()?"":void 0},onClick:a=>{cn(a,e.onClick),r.toggle()}},n,{get children(){return s(pr,{get state(){return{pressed:r.isSelected}},get children(){return e.children}})}}))}function pr(t){const e=Tt(()=>{const n=t.children;return dn(n)?n(t.state):n});return U(e)}var pt=gt;const fr=Ze("hover:text-foreground data-[pressed]:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive gap-1 rounded-4xl text-sm font-medium transition-colors [&_svg:not([class*='size-'])]:size-4 group/toggle hover:bg-muted inline-flex items-center justify-center whitespace-nowrap outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",{variants:{variant:{default:"bg-transparent",outline:"border-input hover:bg-muted border bg-transparent"},size:{default:"h-9 min-w-9 rounded-[min(var(--radius-2xl),12px)] px-2.5",sm:"h-8 min-w-8 px-3",lg:"h-10 min-w-10 px-2.5"}},defaultVariants:{variant:"default",size:"default"}});var mr=f("<div data-slot=toggle-group>");const ft=We({size:"default",variant:"default",spacing:0,orientation:"horizontal"});function Ie(t){const[e,n]=I(t,["class","variant","size","spacing","orientation","children"]),r=()=>e.spacing??0,o=()=>e.orientation??"horizontal",a=()=>e.variant??"default",i=()=>e.size??"default";return s(ft.Provider,{value:{get variant(){return a()},get size(){return i()},get spacing(){return r()},get orientation(){return o()}},get children(){var d=g(mr);return q(d,S({get"data-variant"(){return a()},get"data-size"(){return i()},get"data-spacing"(){return r()},get"data-orientation"(){return o()},get style(){return{"--gap":`${r()}px`}},get class(){return y('group/toggle-group flex w-fit flex-row items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[spacing="0"]:data-[variant=outline]:rounded-4xl',e.class)}},n),!1,!0),c(d,()=>e.children),H(),d}})}function ye(t){const e=Ke(ft),[n,r]=I(t,["class","variant","size"]),o=()=>e.variant??n.variant??"default",a=()=>e.size??n.size??"default";return s(pt,S({"data-slot":"toggle-group-item",get"data-variant"(){return o()},get"data-size"(){return a()},get"data-spacing"(){return e.spacing},get class(){return y('data-[pressed]:bg-muted shrink-0 group-data-[spacing="0"]/toggle-group:rounded-none group-data-[spacing="0"]/toggle-group:px-3 group-data-[spacing="0"]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-[orientation=horizontal]/toggle-group:data-[spacing="0"]:first:rounded-l-4xl group-data-[orientation=vertical]/toggle-group:data-[spacing="0"]:first:rounded-t-xl group-data-[orientation=horizontal]/toggle-group:data-[spacing="0"]:last:rounded-r-4xl group-data-[orientation=vertical]/toggle-group:data-[spacing="0"]:last:rounded-b-xl group-data-[orientation=horizontal]/toggle-group:data-[spacing="0"]:data-[variant=outline]:border-l-0 group-data-[orientation=vertical]/toggle-group:data-[spacing="0"]:data-[variant=outline]:border-t-0 group-data-[orientation=horizontal]/toggle-group:data-[spacing="0"]:data-[variant=outline]:first:border-l group-data-[orientation=vertical]/toggle-group:data-[spacing="0"]:data-[variant=outline]:first:border-t',fr({variant:o(),size:a()}),n.class)}},r))}function hr(t,{insertAt:e}={}){if(typeof document>"u")return;const n=document.head||document.getElementsByTagName("head")[0],r=document.createElement("style");r.type="text/css",e==="top"&&n.firstChild?n.insertBefore(r,n.firstChild):n.appendChild(r),r.styleSheet?r.styleSheet.cssText=t:r.appendChild(document.createTextNode(t))}hr(`:where(html[dir=ltr]),
:where([data-sonner-toaster][dir=ltr]) {
  --toast-icon-margin-start: -3px;
  --toast-icon-margin-end: 4px;
  --toast-svg-margin-start: -1px;
  --toast-svg-margin-end: 0px;
  --toast-button-margin-start: auto;
  --toast-button-margin-end: 0;
  --toast-close-button-start: 0;
  --toast-close-button-end: unset;
  --toast-close-button-transform: translate(-35%, -35%);
}
:where(html[dir=rtl]),
:where([data-sonner-toaster][dir=rtl]) {
  --toast-icon-margin-start: 4px;
  --toast-icon-margin-end: -3px;
  --toast-svg-margin-start: 0px;
  --toast-svg-margin-end: -1px;
  --toast-button-margin-start: 0;
  --toast-button-margin-end: auto;
  --toast-close-button-start: unset;
  --toast-close-button-end: 0;
  --toast-close-button-transform: translate(35%, -35%);
}
:where([data-sonner-toaster]) {
  position: fixed;
  width: var(--width);
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    Segoe UI,
    Roboto,
    Helvetica Neue,
    Arial,
    Noto Sans,
    sans-serif,
    Apple Color Emoji,
    Segoe UI Emoji,
    Segoe UI Symbol,
    Noto Color Emoji;
  --gray1: hsl(0, 0%, 99%);
  --gray2: hsl(0, 0%, 97.3%);
  --gray3: hsl(0, 0%, 95.1%);
  --gray4: hsl(0, 0%, 93%);
  --gray5: hsl(0, 0%, 90.9%);
  --gray6: hsl(0, 0%, 88.7%);
  --gray7: hsl(0, 0%, 85.8%);
  --gray8: hsl(0, 0%, 78%);
  --gray9: hsl(0, 0%, 56.1%);
  --gray10: hsl(0, 0%, 52.3%);
  --gray11: hsl(0, 0%, 43.5%);
  --gray12: hsl(0, 0%, 9%);
  --border-radius: 8px;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  list-style: none;
  outline: none;
  z-index: 999999999;
}
:where([data-sonner-toaster][data-x-position=right]) {
  right: max(var(--offset), env(safe-area-inset-right));
}
:where([data-sonner-toaster][data-x-position=left]) {
  left: max(var(--offset), env(safe-area-inset-left));
}
:where([data-sonner-toaster][data-x-position=center]) {
  left: 50%;
  transform: translateX(-50%);
}
:where([data-sonner-toaster][data-y-position=top]) {
  top: max(var(--offset), env(safe-area-inset-top));
}
:where([data-sonner-toaster][data-y-position=bottom]) {
  bottom: max(var(--offset), env(safe-area-inset-bottom));
}
:where([data-sonner-toast]) {
  --y: translateY(100%);
  --lift-amount: calc(var(--lift) * var(--gap));
  z-index: var(--z-index);
  position: absolute;
  opacity: 0;
  transform: var(--y);
  filter: blur(0);
  touch-action: none;
  transition:
    transform 400ms,
    opacity 400ms,
    height 400ms,
    box-shadow 200ms;
  box-sizing: border-box;
  outline: none;
  overflow-wrap: anywhere;
}
:where([data-sonner-toast][data-styled=true]) {
  padding: 16px;
  background: var(--normal-bg);
  border: 1px solid var(--normal-border);
  color: var(--normal-text);
  border-radius: var(--border-radius);
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
  width: var(--width);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
:where([data-sonner-toast]:focus-visible) {
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1), 0 0 0 2px rgba(0, 0, 0, 0.2);
}
:where([data-sonner-toast][data-y-position=top]) {
  top: 0;
  --y: translateY(-100%);
  --lift: 1;
  --lift-amount: calc(1 * var(--gap));
}
:where([data-sonner-toast][data-y-position=bottom]) {
  bottom: 0;
  --y: translateY(100%);
  --lift: -1;
  --lift-amount: calc(var(--lift) * var(--gap));
}
:where([data-sonner-toast]) :where([data-description]) {
  font-weight: 400;
  line-height: 1.4;
  color: inherit;
}
:where([data-sonner-toast]) :where([data-title]) {
  font-weight: 500;
  line-height: 1.5;
  color: inherit;
}
:where([data-sonner-toast]) :where([data-icon]) {
  display: flex;
  height: 16px;
  width: 16px;
  position: relative;
  justify-content: flex-start;
  align-items: center;
  flex-shrink: 0;
  margin-left: var(--toast-icon-margin-start);
  margin-right: var(--toast-icon-margin-end);
}
:where([data-sonner-toast][data-promise=true]) :where([data-icon]) > svg {
  opacity: 0;
  transform: scale(0.8);
  transform-origin: center;
  animation: sonner-fade-in 300ms ease forwards;
}
:where([data-sonner-toast]) :where([data-icon]) > * {
  flex-shrink: 0;
}
:where([data-sonner-toast]) :where([data-icon]) svg {
  margin-left: var(--toast-svg-margin-start);
  margin-right: var(--toast-svg-margin-end);
}
:where([data-sonner-toast]) :where([data-content]) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
[data-sonner-toast][data-styled=true] [data-button] {
  border-radius: 4px;
  padding-left: 8px;
  padding-right: 8px;
  height: 24px;
  font-size: 12px;
  color: var(--normal-bg);
  background: var(--normal-text);
  margin-left: var(--toast-button-margin-start);
  margin-right: var(--toast-button-margin-end);
  border: none;
  cursor: pointer;
  outline: none;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: opacity 400ms, box-shadow 200ms;
}
:where([data-sonner-toast]) :where([data-button]):focus-visible {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.4);
}
:where([data-sonner-toast]) :where([data-button]):first-of-type {
  margin-left: var(--toast-button-margin-start);
  margin-right: var(--toast-button-margin-end);
}
:where([data-sonner-toast]) :where([data-cancel]) {
  color: var(--normal-text);
  background: rgba(0, 0, 0, 0.08);
}
:where([data-sonner-toast][data-theme=dark]) :where([data-cancel]) {
  background: rgba(255, 255, 255, 0.3);
}
:where([data-sonner-toast]) :where([data-close-button]) {
  position: absolute;
  left: var(--toast-close-button-start);
  right: var(--toast-close-button-end);
  top: 0;
  height: 20px;
  width: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  background: var(--gray1);
  color: var(--gray12);
  border: 1px solid var(--gray4);
  transform: var(--toast-close-button-transform);
  border-radius: 50%;
  cursor: pointer;
  z-index: 1;
  transition:
    opacity 100ms,
    background 200ms,
    border-color 200ms;
}
:where([data-sonner-toast]) :where([data-close-button]):focus-visible {
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1), 0 0 0 2px rgba(0, 0, 0, 0.2);
}
:where([data-sonner-toast]) :where([data-disabled=true]) {
  cursor: not-allowed;
}
:where([data-sonner-toast]):hover :where([data-close-button]):hover {
  background: var(--gray2);
  border-color: var(--gray5);
}
:where([data-sonner-toast][data-swiping=true])::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 100%;
  z-index: -1;
}
:where([data-sonner-toast][data-y-position=top][data-swiping=true])::before {
  bottom: 50%;
  transform: scaleY(3) translateY(50%);
}
:where([data-sonner-toast][data-y-position=bottom][data-swiping=true])::before {
  top: 50%;
  transform: scaleY(3) translateY(-50%);
}
:where([data-sonner-toast][data-swiping=false][data-removed=true])::before {
  content: "";
  position: absolute;
  inset: 0;
  transform: scaleY(2);
}
:where([data-sonner-toast])::after {
  content: "";
  position: absolute;
  left: 0;
  height: calc(var(--gap) + 1px);
  bottom: 100%;
  width: 100%;
}
:where([data-sonner-toast][data-mounted=true]) {
  --y: translateY(0);
  opacity: 1;
}
:where([data-sonner-toast][data-expanded=false][data-front=false]) {
  --scale: var(--toasts-before) * 0.05 + 1;
  --y: translateY(calc(var(--lift-amount) * var(--toasts-before))) scale(calc(-1 * var(--scale)));
  height: var(--front-toast-height);
}
:where([data-sonner-toast]) > * {
  transition: opacity 400ms;
}
:where([data-sonner-toast][data-expanded=false][data-front=false][data-styled=true]) > * {
  opacity: 0;
}
:where([data-sonner-toast][data-visible=false]) {
  opacity: 0;
  pointer-events: none;
}
:where([data-sonner-toast][data-mounted=true][data-expanded=true]) {
  --y: translateY(calc(var(--lift) * var(--offset)));
  height: var(--initial-height);
}
:where([data-sonner-toast][data-removed=true][data-front=true][data-swipe-out=false]) {
  --y: translateY(calc(var(--lift) * -100%));
  opacity: 0;
}
:where([data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=true]) {
  --y: translateY(calc(var(--lift) * var(--offset) + var(--lift) * -100%));
  opacity: 0;
}
:where([data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=false]) {
  --y: translateY(40%);
  opacity: 0;
  transition: transform 500ms, opacity 200ms;
}
:where([data-sonner-toast][data-removed=true][data-front=false])::before {
  height: calc(var(--initial-height) + 20%);
}
[data-sonner-toast][data-swiping=true] {
  transform: var(--y) translateY(var(--swipe-amount, 0px));
  transition: none;
}
[data-sonner-toast][data-swipe-out=true][data-y-position=bottom],
[data-sonner-toast][data-swipe-out=true][data-y-position=top] {
  animation: swipe-out 200ms ease-out forwards;
}
@keyframes swipe-out {
  from {
    transform: translateY(calc(var(--lift) * var(--offset) + var(--swipe-amount)));
    opacity: 1;
  }
  to {
    transform: translateY(calc(var(--lift) * var(--offset) + var(--swipe-amount) + var(--lift) * -100%));
    opacity: 0;
  }
}
@media (max-width: 600px) {
  [data-sonner-toaster] {
    position: fixed;
    --mobile-offset: 16px;
    right: var(--mobile-offset);
    left: var(--mobile-offset);
    width: 100%;
  }
  [data-sonner-toaster] [data-sonner-toast] {
    left: 0;
    right: 0;
    width: calc(100% - var(--mobile-offset) * 2);
  }
  [data-sonner-toaster][data-x-position=left] {
    left: var(--mobile-offset);
  }
  [data-sonner-toaster][data-y-position=bottom] {
    bottom: 20px;
  }
  [data-sonner-toaster][data-y-position=top] {
    top: 20px;
  }
  [data-sonner-toaster][data-x-position=center] {
    left: var(--mobile-offset);
    right: var(--mobile-offset);
    transform: none;
  }
}
[data-sonner-toaster][data-theme=light] {
  --normal-bg: #fff;
  --normal-border: var(--gray4);
  --normal-text: var(--gray12);
  --success-bg: hsl(143, 85%, 96%);
  --success-border: hsl(145, 92%, 91%);
  --success-text: hsl(140, 100%, 27%);
  --info-bg: hsl(208, 100%, 97%);
  --info-border: hsl(221, 91%, 91%);
  --info-text: hsl(210, 92%, 45%);
  --warning-bg: hsl(49, 100%, 97%);
  --warning-border: hsl(49, 91%, 91%);
  --warning-text: hsl(31, 92%, 45%);
  --error-bg: hsl(359, 100%, 97%);
  --error-border: hsl(359, 100%, 94%);
  --error-text: hsl(360, 100%, 45%);
}
[data-sonner-toaster][data-theme=light] [data-sonner-toast][data-invert=true] {
  --normal-bg: #000;
  --normal-border: hsl(0, 0%, 20%);
  --normal-text: var(--gray1);
}
[data-sonner-toaster][data-theme=dark] [data-sonner-toast][data-invert=true] {
  --normal-bg: #fff;
  --normal-border: var(--gray3);
  --normal-text: var(--gray12);
}
[data-sonner-toaster][data-theme=dark] {
  --normal-bg: #000;
  --normal-border: hsl(0, 0%, 20%);
  --normal-text: var(--gray1);
  --success-bg: hsl(150, 100%, 6%);
  --success-border: hsl(147, 100%, 12%);
  --success-text: hsl(150, 86%, 65%);
  --info-bg: hsl(215, 100%, 6%);
  --info-border: hsl(223, 100%, 12%);
  --info-text: hsl(216, 87%, 65%);
  --warning-bg: hsl(64, 100%, 6%);
  --warning-border: hsl(60, 100%, 12%);
  --warning-text: hsl(46, 87%, 65%);
  --error-bg: hsl(358, 76%, 10%);
  --error-border: hsl(357, 89%, 16%);
  --error-text: hsl(358, 100%, 81%);
}
[data-rich-colors=true] [data-sonner-toast][data-type=success] {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success-text);
}
[data-rich-colors=true] [data-sonner-toast][data-type=success] [data-close-button] {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success-text);
}
[data-rich-colors=true] [data-sonner-toast][data-type=info] {
  background: var(--info-bg);
  border-color: var(--info-border);
  color: var(--info-text);
}
[data-rich-colors=true] [data-sonner-toast][data-type=info] [data-close-button] {
  background: var(--info-bg);
  border-color: var(--info-border);
  color: var(--info-text);
}
[data-rich-colors=true] [data-sonner-toast][data-type=warning] {
  background: var(--warning-bg);
  border-color: var(--warning-border);
  color: var(--warning-text);
}
[data-rich-colors=true] [data-sonner-toast][data-type=warning] [data-close-button] {
  background: var(--warning-bg);
  border-color: var(--warning-border);
  color: var(--warning-text);
}
[data-rich-colors=true] [data-sonner-toast][data-type=error] {
  background: var(--error-bg);
  border-color: var(--error-border);
  color: var(--error-text);
}
[data-rich-colors=true] [data-sonner-toast][data-type=error] [data-close-button] {
  background: var(--error-bg);
  border-color: var(--error-border);
  color: var(--error-text);
}
.sonner-loading-wrapper {
  --size: 16px;
  height: var(--size);
  width: var(--size);
  position: absolute;
  inset: 0;
  z-index: 10;
}
.sonner-loading-wrapper[data-visible=false] {
  transform-origin: center;
  animation: sonner-fade-out 0.2s ease forwards;
}
.sonner-spinner {
  position: relative;
  top: 50%;
  left: 50%;
  height: var(--size);
  width: var(--size);
}
.sonner-loading-bar {
  animation: sonner-spin 1.2s linear infinite;
  background: var(--gray11);
  border-radius: 6px;
  height: 8%;
  left: -10%;
  position: absolute;
  top: -3.9%;
  width: 24%;
}
.sonner-loading-bar:nth-child(1) {
  animation-delay: -1.2s;
  transform: rotate(0.0001deg) translate(146%);
}
.sonner-loading-bar:nth-child(2) {
  animation-delay: -1.1s;
  transform: rotate(30deg) translate(146%);
}
.sonner-loading-bar:nth-child(3) {
  animation-delay: -1s;
  transform: rotate(60deg) translate(146%);
}
.sonner-loading-bar:nth-child(4) {
  animation-delay: -0.9s;
  transform: rotate(90deg) translate(146%);
}
.sonner-loading-bar:nth-child(5) {
  animation-delay: -0.8s;
  transform: rotate(120deg) translate(146%);
}
.sonner-loading-bar:nth-child(6) {
  animation-delay: -0.7s;
  transform: rotate(150deg) translate(146%);
}
.sonner-loading-bar:nth-child(7) {
  animation-delay: -0.6s;
  transform: rotate(180deg) translate(146%);
}
.sonner-loading-bar:nth-child(8) {
  animation-delay: -0.5s;
  transform: rotate(210deg) translate(146%);
}
.sonner-loading-bar:nth-child(9) {
  animation-delay: -0.4s;
  transform: rotate(240deg) translate(146%);
}
.sonner-loading-bar:nth-child(10) {
  animation-delay: -0.3s;
  transform: rotate(270deg) translate(146%);
}
.sonner-loading-bar:nth-child(11) {
  animation-delay: -0.2s;
  transform: rotate(300deg) translate(146%);
}
.sonner-loading-bar:nth-child(12) {
  animation-delay: -0.1s;
  transform: rotate(330deg) translate(146%);
}
@keyframes sonner-fade-in {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes sonner-fade-out {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
}
@keyframes sonner-spin {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0.15;
  }
}
@media (prefers-reduced-motion) {
  [data-sonner-toast],
  [data-sonner-toast] > *,
  .sonner-loading-bar {
    transition: none !important;
    animation: none !important;
  }
}
.sonner-loader {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transform-origin: center;
  transition: opacity 200ms, transform 200ms;
}
.sonner-loader[data-visible=false] {
  opacity: 0;
  transform: scale(0.8) translate(-50%, -50%);
}
`);Array(12).fill(0);var Ae=0,br=class{subscribers;toasts;constructor(){this.subscribers=[],this.toasts=[]}subscribe=t=>(this.subscribers.push(t),()=>{const e=this.subscribers.indexOf(t);this.subscribers.splice(e,1)});publish=t=>{this.subscribers.forEach(e=>e(t))};addToast=t=>{this.publish(t),this.toasts=[...this.toasts,t]};create=t=>{const{message:e,...n}=t,r=typeof t?.id=="number"||t.id&&t.id?.length>0?t.id:Ae++;return this.toasts.find(a=>a.id===r)?this.toasts=this.toasts.map(a=>a.id===r?(this.publish({...a,...t,id:r,title:e}),{...a,...t,id:r,title:e}):a):this.addToast({title:e,...n,id:r}),r};dismiss=t=>(t||this.toasts.forEach(e=>{this.subscribers.forEach(n=>n({id:e.id,dismiss:!0}))}),this.subscribers.forEach(e=>e({id:t,dismiss:!0})),t);message=(t,e)=>this.create({...e,message:t});error=(t,e)=>this.create({...e,message:t,type:"error"});success=(t,e)=>this.create({...e,type:"success",message:t});info=(t,e)=>this.create({...e,type:"info",message:t});warning=(t,e)=>this.create({...e,type:"warning",message:t});promise=(t,e)=>{if(!e)return;let n;e.loading!==void 0&&(n=this.create({...e,promise:t,type:"loading",message:e.loading}));const r=t instanceof Promise?t:t();let o=n!==void 0;return r.then(a=>{if(a&&typeof a.ok=="boolean"&&!a.ok){o=!1;const i=typeof e.error=="function"?e.error(`HTTP error! status: ${a.status}`):e.error;this.create({id:n,type:"error",message:i})}else if(e.success!==void 0){o=!1;const i=typeof e.success=="function"?e.success(a):e.success;this.create({id:n,type:"success",message:i})}}).catch(a=>{if(e.error!==void 0){o=!1;const i=typeof e.error=="function"?e.error(a):e.error;this.create({id:n,type:"error",message:i})}}).finally(()=>{o&&(this.dismiss(n),n=void 0),e.finally?.()}),n};loading=(t,e)=>this.create({...e,type:"loading",message:t});custom=(t,e)=>{const n=e?.id||Ae++;return this.publish({jsx:t(n),id:n,...e}),n}},N=new br;function vr(t,e){const n=e?.id||Ae++;return N.addToast({title:t,...e,id:n}),n}var xr=vr,He=Object.assign(xr,{success:N.success,info:N.info,warning:N.warning,error:N.error,custom:N.custom,message:N.message,promise:N.promise,dismiss:N.dismiss,loading:N.loading});/*!
 * Original code by Emil Kowalski
 * MIT Licensed, Copyright 2023 Emil Kowalski, see https://github.com/emilkowalski/sonner/blob/main/LICENSE.md for details
 *
 * Credits:
 * https://github.com/emilkowalski/sonner/blob/main/src/index.tsx
 */It(["pointerdown","pointerup","pointermove","click","mousemove"]);var yr=f('<svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="m21 16-4 4-4-4"></path><path d="M17 20V4"></path><path d="m3 8 4-4 4 4"></path><path d="M7 4v16">'),wr=f('<div class="flex flex-wrap items-center justify-between gap-3"><!$><!/><!$><!/>'),$r=f('<div class="bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">'),_r=f('<div class="flex items-center justify-between gap-2"><span class="text-muted-foreground shrink-0 text-sm">You receive</span><span class="text-muted-foreground truncate text-xs">Min: <!$><!/>'),Sr=f('<div class="flex items-center gap-2"><span class="text-foreground min-w-0 flex-1 truncate font-mono text-2xl font-semibold tabular-nums"></span><div><span>'),kr=f("<div class=space-y-2><!$><!/><!$><!/><!$><!/>"),Cr=f('<div><div class="text-muted-foreground mb-2 text-sm">Slippage Tolerance</div><!$><!/>'),Tr=f('<div class="bg-warning/10 border-warning/30 text-warning-foreground rounded-lg border p-3 text-sm"><p class=font-medium>Collateral Required</p><p class="text-warning-foreground/80 mt-1">Selling YT requires <!$><!/> <!$><!/> as collateral. This will be returned after the swap.'),Ir=f('<p class="text-primary font-medium">Transaction pending...'),Ar=f('<p class="text-success font-medium">Swap successful!'),Er=f('<p class="text-success/80 mt-1 truncate text-xs">Tx: <!$><!/>'),Pr=f('<p class="text-destructive font-medium">Transaction failed'),Br=f('<p class="text-destructive/80 mt-1 text-xs">'),Rr=f("<div><!$><!/><!$><!/><!$><!/>"),Fr=f('<span class="text-muted-foreground text-sm font-medium">');const Or=[{label:"0.1%",value:10},{label:"0.5%",value:50},{label:"1%",value:100}];function zr(t){return(()=>{var e=g(yr);return q(e,t,!0,!0),H(),e})()}function Dr(t){const{isConnected:e,network:n}=Pe(),[r,o]=ee("PT"),[a,i]=ee(!0),[d,p]=ee(""),[u,h]=ee(!1),[b,z]=ee(50),v=m(()=>wn(r(),a())),{swap:w,isSwapping:k,isSuccess:R,isError:M,error:Q,transactionHash:J,reset:W}=fn(),ue=()=>t.market.metadata?.yieldTokenSymbol??"Token",K=m(()=>Tn(ue(),r(),a())),ne=()=>K().input,ge=()=>K().output,V=()=>K().sy,L=m(()=>Lt(n)),P=m(()=>{const l=d();if(!l||l==="")return BigInt(0);try{return Nt(l)}catch{return BigInt(0)}}),F=m(()=>P()>0n),Y=m(()=>({syReserve:t.market.state.syReserve,ptReserve:t.market.state.ptReserve,totalLp:t.market.state.totalLpSupply,scalarRoot:L().scalarRoot,initialAnchor:t.market.metadata?.initialAnchor??t.market.state.lnImpliedRate,feeRate:L().feeRate,expiry:BigInt(t.market.expiry),lastLnImpliedRate:t.market.state.lnImpliedRate})),Z=m(()=>$n(v(),Y(),P())),j=m(()=>Z()?.amountOut??BigInt(0)),re=m(()=>Z()?.priceImpact??0),pe=m(()=>Vt(j()).toNumber()),ae=qt(pe,{duration:300,decimals:6}),fe=m(()=>{const l=ae();if(l===0)return"0.000000";const C=l.toFixed(6),$=C.split("."),E=$[0]??"0",A=$[1];if(A!==void 0){const T=A.replace(/0+$/,"").padEnd(2,"0");return`${E}.${T}`}return C}),O=m(()=>{const l=re();return l<.01?"low":l<.03?"medium":l<.05?"high":l<.1?"very-high":"extreme"}),se=m(()=>Ne(t.market.state.lnImpliedRate)),me=m(()=>{const l=Z();return l?Ne(l.newLnImpliedRate):se()}),Se=m(()=>In(r(),a())),Oe=m(()=>mn(j(),b())),ke=m(()=>!1),ze=m(()=>!1),mt=m(()=>v()==="sell_yt"?P()*BigInt(4):BigInt(0)),De=m(()=>O()!=="extreme"),ht=m(()=>O()==="high"||O()==="very-high"),[bt,Ce]=ee(!1),vt=m(()=>e()&&F()&&!ke()&&!ze()&&!k()&&!R()&&!t.market.isExpired&&De()),he=m(()=>An({isBuying:a(),hasInsufficientBalance:ke(),isFlipping:u(),isValidAmount:F(),priceImpactSeverity:O(),direction:v()})),Ye=m(()=>Cn({state:{isConnected:e(),isValidAmount:F(),hasInsufficientBalance:ke(),hasInsufficientCollateral:ze(),isSwapping:k(),isSuccess:R(),isExpired:t.market.isExpired,priceImpactCanProceed:De(),priceImpactRequiresAck:ht(),priceImpactAcknowledged:bt()},tokenType:r(),isBuying:a()})),xt=()=>{vt()&&w({marketAddress:t.market.address,syAddress:t.market.syAddress,ptAddress:t.market.ptAddress,ytAddress:t.market.ytAddress,direction:v(),amountIn:P(),minAmountOut:Oe()})};_e(Ee(R,l=>{l&&p("")}));const yt=()=>{h(!0),setTimeout(()=>{i(l=>!l),p(""),W(),Ce(!1),h(!1)},150)},Me=l=>{vn(l)&&(o(l),p(""),W(),Ce(!1),He.success(`Switched to ${l}`,{description:bn(l),duration:2e3}))},Le=l=>{if(!xn(l))return;const C=l==="buy";i(C),p(""),W(),Ce(!1);const $=C?"Buy mode":"Sell mode",E=C?`Pay SY to receive ${r()}`:`Pay ${r()} to receive SY`;He.success($,{description:E,duration:2e3})};return s(Bn,{get class(){return t.class},get gradient(){return he().formGradient},get children(){return[(()=>{var l=g(wr),C=l.firstChild,[$,E]=x(C.nextSibling),A=$.nextSibling,[T,D]=x(A.nextSibling);return c(l,s(Ie,{class:"bg-muted rounded-lg p-1",get children(){return[s(ye,{get pressed(){return r()==="PT"},onPressedChange:()=>{Me("PT")},class:"data-[pressed]:bg-primary data-[pressed]:text-primary-foreground rounded-md px-4",children:"PT"}),s(ye,{get pressed(){return r()==="YT"},onPressedChange:()=>{Me("YT")},class:"data-[pressed]:bg-chart-2 data-[pressed]:text-foreground rounded-md px-4",children:"YT"})]}}),$,E),c(l,s(Ie,{class:"bg-muted rounded-lg p-1",get children(){return[s(ye,{get pressed(){return a()},onPressedChange:()=>{Le("buy")},class:"data-[pressed]:bg-primary/20 data-[pressed]:text-primary rounded-md px-4",children:"Buy"}),s(ye,{get pressed(){return!a()},onPressedChange:()=>{Le("sell")},class:"data-[pressed]:bg-destructive/20 data-[pressed]:text-destructive rounded-md px-4",children:"Sell"})]}}),T,D),l})(),s(_,{get when(){return!t.market.isExpired},get children(){return s(cr,{get expiryTimestamp(){return t.market.expiry},context:"swap"})}}),s(Rn,{get children(){return s(Wn,{label:"You pay",get value(){return d()},onChange:p,placeholder:"0.00",get error(){return he().inputError},get rightElement(){return(()=>{var l=g(Fr);return c(l,ne),l})()}})}}),s(zn,{get children(){var l=g($r);return c(l,s(Ue,{variant:"outline",size:"icon",onClick:yt,get class(){return y("bg-background h-10 w-10 rounded-full shadow-lg transition-transform duration-300",he().flipButtonClass)},"aria-label":"Toggle swap direction",get children(){return s(zr,{class:"h-4 w-4"})}})),l}}),s(Fn,{get children(){return[(()=>{var l=g(_r),C=l.firstChild,$=C.nextSibling,E=$.firstChild,A=E.nextSibling,[T,D]=x(A.nextSibling);return c($,()=>Ve(Oe(),4),T,D),l})(),(()=>{var l=g(Sr),C=l.firstChild,$=C.nextSibling,E=$.firstChild;return c(C,fe),c(E,()=>Se().displayText),we(A=>{var T=y("flex h-10 shrink-0 items-center justify-center rounded-full px-3","border-border/50 border",Se().containerClass),D=y("font-mono text-sm font-semibold",Se().textClass);return T!==A.e&&te($,A.e=T),D!==A.t&&te(E,A.t=D),A},{e:void 0,t:void 0}),l})()]}}),s(_,{get when(){return F()},get children(){var l=g(kr),C=l.firstChild,[$,E]=x(C.nextSibling),A=$.nextSibling,[T,D]=x(A.nextSibling),be=T.nextSibling,[ve,oe]=x(be.nextSibling);return c(l,s(Te,{label:"Price Impact",labelClass:"text-sm",get valueClass(){return y("text-sm font-medium",O()==="low"&&"text-muted-foreground",O()==="medium"&&"text-warning",O()==="high"&&"text-orange-500",O()==="very-high"&&"text-destructive",O()==="extreme"&&"text-destructive font-bold")},get value(){return`${(re()*100).toFixed(2)}%`}}),$,E),c(l,s(Te,{label:"Rate",labelClass:"text-sm",valueClass:"text-sm text-muted-foreground",get value(){return`1 ${ne()} = ${P()>0n?(Number(j())/Number(P())).toFixed(4):"-"} ${ge()}`}}),T,D),c(l,s(_,{get when(){return v()==="buy_pt"||v()==="sell_pt"},get children(){return s(Te,{label:"Implied APY",labelClass:"text-sm",get valueClass(){return y("text-sm",me()>se()&&"text-primary",me()<se()&&"text-destructive")},get value(){return`${(se()*100).toFixed(2)}% → ${(me()*100).toFixed(2)}%`}})}}),ve,oe),l}}),(()=>{var l=g(Cr),C=l.firstChild,$=C.nextSibling,[E,A]=x($.nextSibling);return c(l,s(Ie,{class:"flex gap-1",get children(){return Or.map(T=>s(ye,{get pressed(){return b()===T.value},onPressedChange:()=>{z(T.value)},variant:"outline",size:"sm",get children(){return T.label}}))}}),E,A),l})(),s(_,{get when(){return he().showYtCollateralWarning},get children(){var l=g(Tr),C=l.firstChild,$=C.nextSibling,E=$.firstChild,A=E.nextSibling,[T,D]=x(A.nextSibling),be=T.nextSibling,ve=be.nextSibling,[oe,G]=x(ve.nextSibling);return oe.nextSibling,c($,()=>Ve(mt(),2),T,D),c($,V,oe,G),l}}),s(_,{get when(){return k()||R()||M()},get children(){var l=g(Rr),C=l.firstChild,[$,E]=x(C.nextSibling),A=$.nextSibling,[T,D]=x(A.nextSibling),be=T.nextSibling,[ve,oe]=x(be.nextSibling);return c(l,s(_,{get when(){return k()},get children(){return g(Ir)}}),$,E),c(l,s(_,{get when(){return R()},get children(){return[g(Ar),s(_,{get when(){return J()},get children(){var G=g(Er),wt=G.firstChild,$t=wt.nextSibling,[_t,St]=x($t.nextSibling);return c(G,J,_t,St),G}})]}}),T,D),c(l,s(_,{get when(){return M()},get children(){return[g(Pr),s(_,{get when(){return Q()},get children(){var G=g(Br);return c(G,()=>Q()?.message),G}})]}}),ve,oe),we(()=>te(l,y("rounded-lg border p-3 text-sm",k()&&"border-primary/30 bg-primary/10",R()&&"border-success/30 bg-success/10",M()&&"border-destructive/30 bg-destructive/10"))),l}}),s(On,{get children(){return s(Ue,{onClick:xt,get disabled(){return Ye().disabled},get loading(){return k()},size:"xl",get class(){return y("w-full",he().sellButtonClass)},get children(){return Ye().label}})}})]}})}var Qe=f('<div class="grid gap-6 lg:grid-cols-3"><div class=lg:col-span-2></div><div>'),Yr=f("<p class=text-destructive>Failed to load markets. Please try again later."),Mr=f("<p class=text-muted-foreground>No active markets available for trading."),Lr=f('<div class="mx-auto max-w-7xl px-4 py-8"><div class=mb-8><h1 class="text-foreground text-3xl font-semibold"></h1><p class="text-muted-foreground mt-2"></p></div><!$><!/><!$><!/><!$><!/><!$><!/>'),Nr=f('<div class="text-muted-foreground py-8 text-center">Select a market to start trading.'),Vr=f('<div class="flex items-center justify-between gap-4"><span class=font-medium></span><span class="text-muted-foreground text-xs"><!$><!/>% APY'),jr=f('<div class="flex items-center justify-between"><span class="text-muted-foreground text-sm"></span><span class="font-mono text-sm"><!$><!/> <!$><!/>'),Ur=f('<div class="bg-destructive/10 text-destructive rounded-lg p-3 text-center text-sm font-medium">This market has expired'),qr=f('<div class="flex items-center justify-between"><span class="text-muted-foreground text-sm">Oracle</span><span><!$><!/><!$><!/><!$><!/>'),Hr=f('<div class=space-y-4><div class="flex items-center justify-between"><span class="text-muted-foreground text-sm">Token</span><span class=font-medium></span></div><div class="flex items-center justify-between"><span class="text-muted-foreground text-sm"></span><span class="text-primary font-mono font-semibold"><!$><!/>%</span></div><div class="flex items-center justify-between"><span class="text-muted-foreground text-sm">Expiry Date</span><span class="font-mono text-sm"></span></div><!$><!/><!$><!/><!$><!/>');function ra(){const{isSimple:t}=Ut(),[e,n]=At(),{markets:r,isLoading:o,isError:a}=jt(),i=m(()=>e.market??null),d=m(()=>{const u=i();return u?r().find(h=>h.address===u)??null:null});_e(Ee(()=>[r(),i()],([u,h])=>{!h&&u.length>0&&u[0]&&n({market:u[0].address},{replace:!0})}));const p=u=>{u&&n({market:u.address})};return(()=>{var u=g(Lr),h=u.firstChild,b=h.firstChild,z=b.nextSibling,v=h.nextSibling,[w,k]=x(v.nextSibling),R=w.nextSibling,[M,Q]=x(R.nextSibling),J=M.nextSibling,[W,ue]=x(J.nextSibling),K=W.nextSibling,[ne,ge]=x(K.nextSibling);return c(b,()=>t()?"Trade":"Swap PT/YT"),c(z,()=>t()?"Buy or sell yield tokens to lock in fixed returns or speculate on rates.":"Trade Principal and Yield tokens. Buy PT to lock in fixed yields, or trade YT to speculate on variable rates."),c(u,s(_,{get when(){return o()},get children(){var V=g(Qe),L=V.firstChild,P=L.nextSibling;return c(L,s(je,{class:"h-[500px] rounded-lg"})),c(P,s(je,{class:"h-[300px] rounded-lg"})),V}}),w,k),c(u,s(_,{get when(){return a()},get children(){return s(de,{get children(){return s(le,{class:"py-8 text-center",get children(){return g(Yr)}})}})}}),M,Q),c(u,s(_,{get when(){return U(()=>!o()&&!a())()&&r().length===0},get children(){return s(de,{get children(){return s(le,{class:"py-8 text-center",get children(){return g(Mr)}})}})}}),W,ue),c(u,s(_,{get when(){return U(()=>!o()&&!a())()&&r().length>0},get children(){var V=g(Qe),L=V.firstChild,P=L.nextSibling;return c(L,s(de,{get children(){return[s(Xe,{class:"flex flex-row items-center justify-between gap-4",get children(){return[s(Je,{get children(){return t()?"Trade Tokens":"Swap"}}),s(Qr,{get markets(){return r()},get selectedMarket(){return d()},onSelect:p})]}}),s(le,{get children(){return s(_,{get when(){return d()},get fallback(){return g(Nr)},children:F=>s(Dr,{get market(){return F()}})})}})]}})),c(P,s(_,{get when(){return d()},children:F=>s(Wr,{get market(){return F()},get isSimple(){return t()}})})),V}}),ne,ge),u})()}function Qr(t){const e=r=>{const o=r.metadata?.yieldTokenSymbol??"Unknown",a=r.impliedApy.multipliedBy(100).toFixed(2);return`${o} (${a}% APY)`},n=m(()=>{const r=t.selectedMarket;return r?e(r):"Select a market"});return s(rn,{get options(){return t.markets},optionValue:"address",optionTextValue:r=>r.metadata?.yieldTokenSymbol??"Unknown",get value(){return t.selectedMarket},get onChange(){return t.onSelect},placeholder:"Select a market",itemComponent:r=>s(nn,{get item(){return r.item},get children(){var o=g(Vr),a=o.firstChild,i=a.nextSibling,d=i.firstChild,[p,u]=x(d.nextSibling);return p.nextSibling,c(a,()=>r.item.rawValue.metadata?.yieldTokenSymbol??"Unknown"),c(i,()=>r.item.rawValue.impliedApy.multipliedBy(100).toFixed(2),p,u),o}}),get children(){return[s(Zt,{class:"w-48",get children(){return s(en,{placeholder:"Select a market",get children(){return n()}})}}),s(tn,{})]}})}function Wr(t){const e=m(()=>t.market.metadata?.yieldTokenSymbol??"Unknown"),n=m(()=>t.market.impliedApy.multipliedBy(100).toNumber()),r=m(()=>t.market.daysToExpiry),o=m(()=>new Date(t.market.expiry*1e3).toLocaleDateString(void 0,{year:"numeric",month:"short",day:"numeric"}));return s(de,{get children(){return[s(Xe,{get children(){return s(Je,{class:"text-lg",children:"Market Info"})}}),s(le,{get children(){var a=g(Hr),i=a.firstChild,d=i.firstChild,p=d.nextSibling,u=i.nextSibling,h=u.firstChild,b=h.nextSibling,z=b.firstChild,[v,w]=x(z.nextSibling);v.nextSibling;var k=u.nextSibling,R=k.firstChild,M=R.nextSibling,Q=k.nextSibling,[J,W]=x(Q.nextSibling),ue=J.nextSibling,[K,ne]=x(ue.nextSibling),ge=K.nextSibling,[V,L]=x(ge.nextSibling);return c(p,e),c(h,()=>t.isSimple?"Fixed Yield":"Implied APY"),c(b,()=>n().toFixed(2),v,w),c(M,o),c(a,s(_,{get when(){return!t.market.isExpired},get children(){var P=g(jr),F=P.firstChild,Y=F.nextSibling,Z=Y.firstChild,[j,re]=x(Z.nextSibling),pe=j.nextSibling,ae=pe.nextSibling,[fe,O]=x(ae.nextSibling);return c(F,()=>t.isSimple?"Time Remaining":"Days to Expiry"),c(Y,r,j,re),c(Y,()=>r()===1?"day":"days",fe,O),P}}),J,W),c(a,s(_,{get when(){return t.market.isExpired},get children(){return g(Ur)}}),K,ne),c(a,s(_,{get when(){return!t.isSimple},get children(){var P=g(qr),F=P.firstChild,Y=F.nextSibling,Z=Y.firstChild,[j,re]=x(Z.nextSibling),pe=j.nextSibling,[ae,fe]=x(pe.nextSibling),O=ae.nextSibling,[se,me]=x(O.nextSibling);return c(Y,()=>t.market.oracleState==="ready"&&"TWAP Ready",j,re),c(Y,()=>t.market.oracleState==="partial"&&"Warming Up",ae,fe),c(Y,()=>t.market.oracleState==="spot-only"&&"Spot Only",se,me),we(()=>te(Y,y("text-xs font-medium",t.market.oracleState==="ready"&&"text-success",t.market.oracleState==="partial"&&"text-warning",t.market.oracleState==="spot-only"&&"text-muted-foreground"))),P}}),V,L),a}})]}})}export{ra as default};
