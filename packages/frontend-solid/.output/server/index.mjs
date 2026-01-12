import process from 'node:process';globalThis._importMeta_={url:import.meta.url,env:process.env};import { EventEmitter } from 'node:events';
import { Buffer as Buffer$1 } from 'node:buffer';
import { promises, existsSync } from 'node:fs';
import { resolve as resolve$1, dirname as dirname$1, join } from 'node:path';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import invariant from 'vinxi/lib/invariant';
import { virtualId, handlerModule, join as join$1 } from 'vinxi/lib/path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { fromJSON, crossSerializeStream, getCrossReferenceHeader } from 'seroval';
import { CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin } from 'seroval-plugins/web';
import { sharedConfig, lazy, createComponent, useContext, createMemo, createContext as createContext$1, untrack, createSignal, createRenderEffect, on, runWithOwner, getOwner, startTransition, resetErrorBoundaries, batch, catchError, ErrorBoundary, Suspense, onCleanup, createUniqueId, children, Show, createRoot } from 'solid-js';
import { renderToString, getRequestEvent, isServer, ssrElement, escape, mergeProps, ssr, renderToStream, createComponent as createComponent$1, ssrHydrationKey, NoHydration, useAssets, Hydration, ssrAttribute, HydrationScript, delegateEvents, spread } from 'solid-js/web';
import { provideRequestEvent } from 'solid-js/web/storage';

const suspectProtoRx = /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/;
const suspectConstructorRx = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/;
const JsonSigRx = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
function jsonParseTransform(key, value) {
  if (key === "__proto__" || key === "constructor" && value && typeof value === "object" && "prototype" in value) {
    warnKeyDropped(key);
    return;
  }
  return value;
}
function warnKeyDropped(key) {
  console.warn(`[destr] Dropping "${key}" key to prevent prototype pollution.`);
}
function destr(value, options = {}) {
  if (typeof value !== "string") {
    return value;
  }
  if (value[0] === '"' && value[value.length - 1] === '"' && value.indexOf("\\") === -1) {
    return value.slice(1, -1);
  }
  const _value = value.trim();
  if (_value.length <= 9) {
    switch (_value.toLowerCase()) {
      case "true": {
        return true;
      }
      case "false": {
        return false;
      }
      case "undefined": {
        return void 0;
      }
      case "null": {
        return null;
      }
      case "nan": {
        return Number.NaN;
      }
      case "infinity": {
        return Number.POSITIVE_INFINITY;
      }
      case "-infinity": {
        return Number.NEGATIVE_INFINITY;
      }
    }
  }
  if (!JsonSigRx.test(value)) {
    if (options.strict) {
      throw new SyntaxError("[destr] Invalid JSON");
    }
    return value;
  }
  try {
    if (suspectProtoRx.test(value) || suspectConstructorRx.test(value)) {
      if (options.strict) {
        throw new Error("[destr] Possible prototype pollution");
      }
      return JSON.parse(value, jsonParseTransform);
    }
    return JSON.parse(value);
  } catch (error) {
    if (options.strict) {
      throw error;
    }
    return value;
  }
}

const HASH_RE = /#/g;
const AMPERSAND_RE = /&/g;
const SLASH_RE = /\//g;
const EQUAL_RE = /=/g;
const PLUS_RE = /\+/g;
const ENC_CARET_RE = /%5e/gi;
const ENC_BACKTICK_RE = /%60/gi;
const ENC_PIPE_RE = /%7c/gi;
const ENC_SPACE_RE = /%20/gi;
const ENC_SLASH_RE = /%2f/gi;
function encode(text) {
  return encodeURI("" + text).replace(ENC_PIPE_RE, "|");
}
function encodeQueryValue(input) {
  return encode(typeof input === "string" ? input : JSON.stringify(input)).replace(PLUS_RE, "%2B").replace(ENC_SPACE_RE, "+").replace(HASH_RE, "%23").replace(AMPERSAND_RE, "%26").replace(ENC_BACKTICK_RE, "`").replace(ENC_CARET_RE, "^").replace(SLASH_RE, "%2F");
}
function encodeQueryKey(text) {
  return encodeQueryValue(text).replace(EQUAL_RE, "%3D");
}
function decode$1(text = "") {
  try {
    return decodeURIComponent("" + text);
  } catch {
    return "" + text;
  }
}
function decodePath(text) {
  return decode$1(text.replace(ENC_SLASH_RE, "%252F"));
}
function decodeQueryKey(text) {
  return decode$1(text.replace(PLUS_RE, " "));
}
function decodeQueryValue(text) {
  return decode$1(text.replace(PLUS_RE, " "));
}

function parseQuery(parametersString = "") {
  const object = /* @__PURE__ */ Object.create(null);
  if (parametersString[0] === "?") {
    parametersString = parametersString.slice(1);
  }
  for (const parameter of parametersString.split("&")) {
    const s = parameter.match(/([^=]+)=?(.*)/) || [];
    if (s.length < 2) {
      continue;
    }
    const key = decodeQueryKey(s[1]);
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = decodeQueryValue(s[2] || "");
    if (object[key] === void 0) {
      object[key] = value;
    } else if (Array.isArray(object[key])) {
      object[key].push(value);
    } else {
      object[key] = [object[key], value];
    }
  }
  return object;
}
function encodeQueryItem(key, value) {
  if (typeof value === "number" || typeof value === "boolean") {
    value = String(value);
  }
  if (!value) {
    return encodeQueryKey(key);
  }
  if (Array.isArray(value)) {
    return value.map(
      (_value) => `${encodeQueryKey(key)}=${encodeQueryValue(_value)}`
    ).join("&");
  }
  return `${encodeQueryKey(key)}=${encodeQueryValue(value)}`;
}
function stringifyQuery(query) {
  return Object.keys(query).filter((k) => query[k] !== void 0).map((k) => encodeQueryItem(k, query[k])).filter(Boolean).join("&");
}

const PROTOCOL_STRICT_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{1,2})/;
const PROTOCOL_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{2})?/;
const PROTOCOL_RELATIVE_REGEX = /^([/\\]\s*){2,}[^/\\]/;
const JOIN_LEADING_SLASH_RE = /^\.?\//;
function hasProtocol(inputString, opts = {}) {
  if (typeof opts === "boolean") {
    opts = { acceptRelative: opts };
  }
  if (opts.strict) {
    return PROTOCOL_STRICT_REGEX.test(inputString);
  }
  return PROTOCOL_REGEX.test(inputString) || (opts.acceptRelative ? PROTOCOL_RELATIVE_REGEX.test(inputString) : false);
}
function hasTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return input.endsWith("/");
  }
}
function withoutTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || "/";
  }
}
function withTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return input.endsWith("/") ? input : input + "/";
  }
}
function hasLeadingSlash(input = "") {
  return input.startsWith("/");
}
function withLeadingSlash(input = "") {
  return hasLeadingSlash(input) ? input : "/" + input;
}
function withBase(input, base) {
  if (isEmptyURL(base) || hasProtocol(input)) {
    return input;
  }
  const _base = withoutTrailingSlash(base);
  if (input.startsWith(_base)) {
    return input;
  }
  return joinURL(_base, input);
}
function withoutBase(input, base) {
  if (isEmptyURL(base)) {
    return input;
  }
  const _base = withoutTrailingSlash(base);
  if (!input.startsWith(_base)) {
    return input;
  }
  const trimmed = input.slice(_base.length);
  return trimmed[0] === "/" ? trimmed : "/" + trimmed;
}
function withQuery(input, query) {
  const parsed = parseURL(input);
  const mergedQuery = { ...parseQuery(parsed.search), ...query };
  parsed.search = stringifyQuery(mergedQuery);
  return stringifyParsedURL(parsed);
}
function getQuery(input) {
  return parseQuery(parseURL(input).search);
}
function isEmptyURL(url) {
  return !url || url === "/";
}
function isNonEmptyURL(url) {
  return url && url !== "/";
}
function joinURL(base, ...input) {
  let url = base || "";
  for (const segment of input.filter((url2) => isNonEmptyURL(url2))) {
    if (url) {
      const _segment = segment.replace(JOIN_LEADING_SLASH_RE, "");
      url = withTrailingSlash(url) + _segment;
    } else {
      url = segment;
    }
  }
  return url;
}

const protocolRelative = Symbol.for("ufo:protocolRelative");
function parseURL(input = "", defaultProto) {
  const _specialProtoMatch = input.match(
    /^[\s\0]*(blob:|data:|javascript:|vbscript:)(.*)/i
  );
  if (_specialProtoMatch) {
    const [, _proto, _pathname = ""] = _specialProtoMatch;
    return {
      protocol: _proto.toLowerCase(),
      pathname: _pathname,
      href: _proto + _pathname,
      auth: "",
      host: "",
      search: "",
      hash: ""
    };
  }
  if (!hasProtocol(input, { acceptRelative: true })) {
    return parsePath(input);
  }
  const [, protocol = "", auth, hostAndPath = ""] = input.replace(/\\/g, "/").match(/^[\s\0]*([\w+.-]{2,}:)?\/\/([^/@]+@)?(.*)/) || [];
  let [, host = "", path = ""] = hostAndPath.match(/([^#/?]*)(.*)?/) || [];
  if (protocol === "file:") {
    path = path.replace(/\/(?=[A-Za-z]:)/, "");
  }
  const { pathname, search, hash } = parsePath(path);
  return {
    protocol: protocol.toLowerCase(),
    auth: auth ? auth.slice(0, Math.max(0, auth.length - 1)) : "",
    host,
    pathname,
    search,
    hash,
    [protocolRelative]: !protocol
  };
}
function parsePath(input = "") {
  const [pathname = "", search = "", hash = ""] = (input.match(/([^#?]*)(\?[^#]*)?(#.*)?/) || []).splice(1);
  return {
    pathname,
    search,
    hash
  };
}
function stringifyParsedURL(parsed) {
  const pathname = parsed.pathname || "";
  const search = parsed.search ? (parsed.search.startsWith("?") ? "" : "?") + parsed.search : "";
  const hash = parsed.hash || "";
  const auth = parsed.auth ? parsed.auth + "@" : "";
  const host = parsed.host || "";
  const proto = parsed.protocol || parsed[protocolRelative] ? (parsed.protocol || "") + "//" : "";
  return proto + auth + host + pathname + search + hash;
}

const NODE_TYPES = {
  NORMAL: 0,
  WILDCARD: 1,
  PLACEHOLDER: 2
};

function createRouter$1(options = {}) {
  const ctx = {
    options,
    rootNode: createRadixNode(),
    staticRoutesMap: {}
  };
  const normalizeTrailingSlash = (p) => options.strictTrailingSlash ? p : p.replace(/\/$/, "") || "/";
  if (options.routes) {
    for (const path in options.routes) {
      insert(ctx, normalizeTrailingSlash(path), options.routes[path]);
    }
  }
  return {
    ctx,
    lookup: (path) => lookup(ctx, normalizeTrailingSlash(path)),
    insert: (path, data) => insert(ctx, normalizeTrailingSlash(path), data),
    remove: (path) => remove(ctx, normalizeTrailingSlash(path))
  };
}
function lookup(ctx, path) {
  const staticPathNode = ctx.staticRoutesMap[path];
  if (staticPathNode) {
    return staticPathNode.data;
  }
  const sections = path.split("/");
  const params = {};
  let paramsFound = false;
  let wildcardNode = null;
  let node = ctx.rootNode;
  let wildCardParam = null;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (node.wildcardChildNode !== null) {
      wildcardNode = node.wildcardChildNode;
      wildCardParam = sections.slice(i).join("/");
    }
    const nextNode = node.children.get(section);
    if (nextNode === void 0) {
      if (node && node.placeholderChildren.length > 1) {
        const remaining = sections.length - i;
        node = node.placeholderChildren.find((c) => c.maxDepth === remaining) || null;
      } else {
        node = node.placeholderChildren[0] || null;
      }
      if (!node) {
        break;
      }
      if (node.paramName) {
        params[node.paramName] = section;
      }
      paramsFound = true;
    } else {
      node = nextNode;
    }
  }
  if ((node === null || node.data === null) && wildcardNode !== null) {
    node = wildcardNode;
    params[node.paramName || "_"] = wildCardParam;
    paramsFound = true;
  }
  if (!node) {
    return null;
  }
  if (paramsFound) {
    return {
      ...node.data,
      params: paramsFound ? params : void 0
    };
  }
  return node.data;
}
function insert(ctx, path, data) {
  let isStaticRoute = true;
  const sections = path.split("/");
  let node = ctx.rootNode;
  let _unnamedPlaceholderCtr = 0;
  const matchedNodes = [node];
  for (const section of sections) {
    let childNode;
    if (childNode = node.children.get(section)) {
      node = childNode;
    } else {
      const type = getNodeType(section);
      childNode = createRadixNode({ type, parent: node });
      node.children.set(section, childNode);
      if (type === NODE_TYPES.PLACEHOLDER) {
        childNode.paramName = section === "*" ? `_${_unnamedPlaceholderCtr++}` : section.slice(1);
        node.placeholderChildren.push(childNode);
        isStaticRoute = false;
      } else if (type === NODE_TYPES.WILDCARD) {
        node.wildcardChildNode = childNode;
        childNode.paramName = section.slice(
          3
          /* "**:" */
        ) || "_";
        isStaticRoute = false;
      }
      matchedNodes.push(childNode);
      node = childNode;
    }
  }
  for (const [depth, node2] of matchedNodes.entries()) {
    node2.maxDepth = Math.max(matchedNodes.length - depth, node2.maxDepth || 0);
  }
  node.data = data;
  if (isStaticRoute === true) {
    ctx.staticRoutesMap[path] = node;
  }
  return node;
}
function remove(ctx, path) {
  let success = false;
  const sections = path.split("/");
  let node = ctx.rootNode;
  for (const section of sections) {
    node = node.children.get(section);
    if (!node) {
      return success;
    }
  }
  if (node.data) {
    const lastSection = sections.at(-1) || "";
    node.data = null;
    if (Object.keys(node.children).length === 0 && node.parent) {
      node.parent.children.delete(lastSection);
      node.parent.wildcardChildNode = null;
      node.parent.placeholderChildren = [];
    }
    success = true;
  }
  return success;
}
function createRadixNode(options = {}) {
  return {
    type: options.type || NODE_TYPES.NORMAL,
    maxDepth: 0,
    parent: options.parent || null,
    children: /* @__PURE__ */ new Map(),
    data: options.data || null,
    paramName: options.paramName || null,
    wildcardChildNode: null,
    placeholderChildren: []
  };
}
function getNodeType(str) {
  if (str.startsWith("**")) {
    return NODE_TYPES.WILDCARD;
  }
  if (str[0] === ":" || str === "*") {
    return NODE_TYPES.PLACEHOLDER;
  }
  return NODE_TYPES.NORMAL;
}

function toRouteMatcher(router) {
  const table = _routerNodeToTable("", router.ctx.rootNode);
  return _createMatcher(table, router.ctx.options.strictTrailingSlash);
}
function _createMatcher(table, strictTrailingSlash) {
  return {
    ctx: { table },
    matchAll: (path) => _matchRoutes(path, table, strictTrailingSlash)
  };
}
function _createRouteTable() {
  return {
    static: /* @__PURE__ */ new Map(),
    wildcard: /* @__PURE__ */ new Map(),
    dynamic: /* @__PURE__ */ new Map()
  };
}
function _matchRoutes(path, table, strictTrailingSlash) {
  if (strictTrailingSlash !== true && path.endsWith("/")) {
    path = path.slice(0, -1) || "/";
  }
  const matches = [];
  for (const [key, value] of _sortRoutesMap(table.wildcard)) {
    if (path === key || path.startsWith(key + "/")) {
      matches.push(value);
    }
  }
  for (const [key, value] of _sortRoutesMap(table.dynamic)) {
    if (path.startsWith(key + "/")) {
      const subPath = "/" + path.slice(key.length).split("/").splice(2).join("/");
      matches.push(..._matchRoutes(subPath, value));
    }
  }
  const staticMatch = table.static.get(path);
  if (staticMatch) {
    matches.push(staticMatch);
  }
  return matches.filter(Boolean);
}
function _sortRoutesMap(m) {
  return [...m.entries()].sort((a, b) => a[0].length - b[0].length);
}
function _routerNodeToTable(initialPath, initialNode) {
  const table = _createRouteTable();
  function _addNode(path, node) {
    if (path) {
      if (node.type === NODE_TYPES.NORMAL && !(path.includes("*") || path.includes(":"))) {
        if (node.data) {
          table.static.set(path, node.data);
        }
      } else if (node.type === NODE_TYPES.WILDCARD) {
        table.wildcard.set(path.replace("/**", ""), node.data);
      } else if (node.type === NODE_TYPES.PLACEHOLDER) {
        const subTable = _routerNodeToTable("", node);
        if (node.data) {
          subTable.static.set("/", node.data);
        }
        table.dynamic.set(path.replace(/\/\*|\/:\w+/, ""), subTable);
        return;
      }
    }
    for (const [childPath, child] of node.children.entries()) {
      _addNode(`${path}/${childPath}`.replace("//", "/"), child);
    }
  }
  _addNode(initialPath, initialNode);
  return table;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
    return false;
  }
  if (Symbol.iterator in value) {
    return false;
  }
  if (Symbol.toStringTag in value) {
    return Object.prototype.toString.call(value) === "[object Module]";
  }
  return true;
}

function _defu(baseObject, defaults, namespace = ".", merger) {
  if (!isPlainObject(defaults)) {
    return _defu(baseObject, {}, namespace, merger);
  }
  const object = Object.assign({}, defaults);
  for (const key in baseObject) {
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = baseObject[key];
    if (value === null || value === void 0) {
      continue;
    }
    if (merger && merger(object, key, value, namespace)) {
      continue;
    }
    if (Array.isArray(value) && Array.isArray(object[key])) {
      object[key] = [...value, ...object[key]];
    } else if (isPlainObject(value) && isPlainObject(object[key])) {
      object[key] = _defu(
        value,
        object[key],
        (namespace ? `${namespace}.` : "") + key.toString(),
        merger
      );
    } else {
      object[key] = value;
    }
  }
  return object;
}
function createDefu(merger) {
  return (...arguments_) => (
    // eslint-disable-next-line unicorn/no-array-reduce
    arguments_.reduce((p, c) => _defu(p, c, "", merger), {})
  );
}
const defu = createDefu();
const defuFn = createDefu((object, key, currentValue) => {
  if (object[key] !== void 0 && typeof currentValue === "function") {
    object[key] = currentValue(object[key]);
    return true;
  }
});

function o(n){throw new Error(`${n} is not implemented yet!`)}class i extends EventEmitter{__unenv__={};readableEncoding=null;readableEnded=true;readableFlowing=false;readableHighWaterMark=0;readableLength=0;readableObjectMode=false;readableAborted=false;readableDidRead=false;closed=false;errored=null;readable=false;destroyed=false;static from(e,t){return new i(t)}constructor(e){super();}_read(e){}read(e){}setEncoding(e){return this}pause(){return this}resume(){return this}isPaused(){return  true}unpipe(e){return this}unshift(e,t){}wrap(e){return this}push(e,t){return  false}_destroy(e,t){this.removeAllListeners();}destroy(e){return this.destroyed=true,this._destroy(e),this}pipe(e,t){return {}}compose(e,t){throw new Error("Method not implemented.")}[Symbol.asyncDispose](){return this.destroy(),Promise.resolve()}async*[Symbol.asyncIterator](){throw o("Readable.asyncIterator")}iterator(e){throw o("Readable.iterator")}map(e,t){throw o("Readable.map")}filter(e,t){throw o("Readable.filter")}forEach(e,t){throw o("Readable.forEach")}reduce(e,t,r){throw o("Readable.reduce")}find(e,t){throw o("Readable.find")}findIndex(e,t){throw o("Readable.findIndex")}some(e,t){throw o("Readable.some")}toArray(e){throw o("Readable.toArray")}every(e,t){throw o("Readable.every")}flatMap(e,t){throw o("Readable.flatMap")}drop(e,t){throw o("Readable.drop")}take(e,t){throw o("Readable.take")}asIndexedPairs(e){throw o("Readable.asIndexedPairs")}}class l extends EventEmitter{__unenv__={};writable=true;writableEnded=false;writableFinished=false;writableHighWaterMark=0;writableLength=0;writableObjectMode=false;writableCorked=0;closed=false;errored=null;writableNeedDrain=false;writableAborted=false;destroyed=false;_data;_encoding="utf8";constructor(e){super();}pipe(e,t){return {}}_write(e,t,r){if(this.writableEnded){r&&r();return}if(this._data===void 0)this._data=e;else {const s=typeof this._data=="string"?Buffer$1.from(this._data,this._encoding||t||"utf8"):this._data,a=typeof e=="string"?Buffer$1.from(e,t||this._encoding||"utf8"):e;this._data=Buffer$1.concat([s,a]);}this._encoding=t,r&&r();}_writev(e,t){}_destroy(e,t){}_final(e){}write(e,t,r){const s=typeof t=="string"?this._encoding:"utf8",a=typeof t=="function"?t:typeof r=="function"?r:void 0;return this._write(e,s,a),true}setDefaultEncoding(e){return this}end(e,t,r){const s=typeof e=="function"?e:typeof t=="function"?t:typeof r=="function"?r:void 0;if(this.writableEnded)return s&&s(),this;const a=e===s?void 0:e;if(a){const u=t===s?void 0:t;this.write(a,u,s);}return this.writableEnded=true,this.writableFinished=true,this.emit("close"),this.emit("finish"),this}cork(){}uncork(){}destroy(e){return this.destroyed=true,delete this._data,this.removeAllListeners(),this}compose(e,t){throw new Error("Method not implemented.")}[Symbol.asyncDispose](){return Promise.resolve()}}const c=class{allowHalfOpen=true;_destroy;constructor(e=new i,t=new l){Object.assign(this,e),Object.assign(this,t),this._destroy=m(e._destroy,t._destroy);}};function _$1(){return Object.assign(c.prototype,i.prototype),Object.assign(c.prototype,l.prototype),c}function m(...n){return function(...e){for(const t of n)t(...e);}}const g=_$1();class A extends g{__unenv__={};bufferSize=0;bytesRead=0;bytesWritten=0;connecting=false;destroyed=false;pending=false;localAddress="";localPort=0;remoteAddress="";remoteFamily="";remotePort=0;autoSelectFamilyAttemptedAddresses=[];readyState="readOnly";constructor(e){super();}write(e,t,r){return  false}connect(e,t,r){return this}end(e,t,r){return this}setEncoding(e){return this}pause(){return this}resume(){return this}setTimeout(e,t){return this}setNoDelay(e){return this}setKeepAlive(e,t){return this}address(){return {}}unref(){return this}ref(){return this}destroySoon(){this.destroy();}resetAndDestroy(){const e=new Error("ERR_SOCKET_CLOSED");return e.code="ERR_SOCKET_CLOSED",this.destroy(e),this}}let y$2 = class y extends i{aborted=false;httpVersion="1.1";httpVersionMajor=1;httpVersionMinor=1;complete=true;connection;socket;headers={};trailers={};method="GET";url="/";statusCode=200;statusMessage="";closed=false;errored=null;readable=false;constructor(e){super(),this.socket=this.connection=e||new A;}get rawHeaders(){const e=this.headers,t=[];for(const r in e)if(Array.isArray(e[r]))for(const s of e[r])t.push(r,s);else t.push(r,e[r]);return t}get rawTrailers(){return []}setTimeout(e,t){return this}get headersDistinct(){return p(this.headers)}get trailersDistinct(){return p(this.trailers)}};function p(n){const e={};for(const[t,r]of Object.entries(n))t&&(e[t]=(Array.isArray(r)?r:[r]).filter(Boolean));return e}class w extends l{statusCode=200;statusMessage="";upgrading=false;chunkedEncoding=false;shouldKeepAlive=false;useChunkedEncodingByDefault=false;sendDate=false;finished=false;headersSent=false;strictContentLength=false;connection=null;socket=null;req;_headers={};constructor(e){super(),this.req=e;}assignSocket(e){e._httpMessage=this,this.socket=e,this.connection=e,this.emit("socket",e),this._flush();}_flush(){this.flushHeaders();}detachSocket(e){}writeContinue(e){}writeHead(e,t,r){e&&(this.statusCode=e),typeof t=="string"&&(this.statusMessage=t,t=void 0);const s=r||t;if(s&&!Array.isArray(s))for(const a in s)this.setHeader(a,s[a]);return this.headersSent=true,this}writeProcessing(){}setTimeout(e,t){return this}appendHeader(e,t){e=e.toLowerCase();const r=this._headers[e],s=[...Array.isArray(r)?r:[r],...Array.isArray(t)?t:[t]].filter(Boolean);return this._headers[e]=s.length>1?s:s[0],this}setHeader(e,t){return this._headers[e.toLowerCase()]=t,this}setHeaders(e){for(const[t,r]of Object.entries(e))this.setHeader(t,r);return this}getHeader(e){return this._headers[e.toLowerCase()]}getHeaders(){return this._headers}getHeaderNames(){return Object.keys(this._headers)}hasHeader(e){return e.toLowerCase()in this._headers}removeHeader(e){delete this._headers[e.toLowerCase()];}addTrailers(e){}flushHeaders(){}writeEarlyHints(e,t){typeof t=="function"&&t();}}const E$1=(()=>{const n=function(){};return n.prototype=Object.create(null),n})();function R$2(n={}){const e=new E$1,t=Array.isArray(n)||H$1(n)?n:Object.entries(n);for(const[r,s]of t)if(s){if(e[r]===void 0){e[r]=s;continue}e[r]=[...Array.isArray(e[r])?e[r]:[e[r]],...Array.isArray(s)?s:[s]];}return e}function H$1(n){return typeof n?.entries=="function"}function v(n={}){if(n instanceof Headers)return n;const e=new Headers;for(const[t,r]of Object.entries(n))if(r!==void 0){if(Array.isArray(r)){for(const s of r)e.append(t,String(s));continue}e.set(t,String(r));}return e}const S$1=new Set([101,204,205,304]);async function b$1(n,e){const t=new y$2,r=new w(t);t.url=e.url?.toString()||"/";let s;if(!t.url.startsWith("/")){const d=new URL(t.url);s=d.host,t.url=d.pathname+d.search+d.hash;}t.method=e.method||"GET",t.headers=R$2(e.headers||{}),t.headers.host||(t.headers.host=e.host||s||"localhost"),t.connection.encrypted=t.connection.encrypted||e.protocol==="https",t.body=e.body||null,t.__unenv__=e.context,await n(t,r);let a=r._data;(S$1.has(r.statusCode)||t.method.toUpperCase()==="HEAD")&&(a=null,delete r._headers["content-length"]);const u={status:r.statusCode,statusText:r.statusMessage,headers:r._headers,body:a};return t.destroy(),r.destroy(),u}async function C(n,e,t={}){try{const r=await b$1(n,{url:e,...t});return new Response(r.body,{status:r.status,statusText:r.statusText,headers:v(r.headers)})}catch(r){return new Response(r.toString(),{status:Number.parseInt(r.statusCode||r.code)||500,statusText:r.statusText})}}

function hasProp$1(obj, prop) {
  try {
    return prop in obj;
  } catch {
    return false;
  }
}

let H3Error$1 = class H3Error extends Error {
  static __h3_error__ = true;
  statusCode = 500;
  fatal = false;
  unhandled = false;
  statusMessage;
  data;
  cause;
  constructor(message, opts = {}) {
    super(message, opts);
    if (opts.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
  toJSON() {
    const obj = {
      message: this.message,
      statusCode: sanitizeStatusCode$1(this.statusCode, 500)
    };
    if (this.statusMessage) {
      obj.statusMessage = sanitizeStatusMessage$1(this.statusMessage);
    }
    if (this.data !== void 0) {
      obj.data = this.data;
    }
    return obj;
  }
};
function createError$2(input) {
  if (typeof input === "string") {
    return new H3Error$1(input);
  }
  if (isError$1(input)) {
    return input;
  }
  const err = new H3Error$1(input.message ?? input.statusMessage ?? "", {
    cause: input.cause || input
  });
  if (hasProp$1(input, "stack")) {
    try {
      Object.defineProperty(err, "stack", {
        get() {
          return input.stack;
        }
      });
    } catch {
      try {
        err.stack = input.stack;
      } catch {
      }
    }
  }
  if (input.data) {
    err.data = input.data;
  }
  if (input.statusCode) {
    err.statusCode = sanitizeStatusCode$1(input.statusCode, err.statusCode);
  } else if (input.status) {
    err.statusCode = sanitizeStatusCode$1(input.status, err.statusCode);
  }
  if (input.statusMessage) {
    err.statusMessage = input.statusMessage;
  } else if (input.statusText) {
    err.statusMessage = input.statusText;
  }
  if (err.statusMessage) {
    const originalMessage = err.statusMessage;
    const sanitizedMessage = sanitizeStatusMessage$1(err.statusMessage);
    if (sanitizedMessage !== originalMessage) {
      console.warn(
        "[h3] Please prefer using `message` for longer error messages instead of `statusMessage`. In the future, `statusMessage` will be sanitized by default."
      );
    }
  }
  if (input.fatal !== void 0) {
    err.fatal = input.fatal;
  }
  if (input.unhandled !== void 0) {
    err.unhandled = input.unhandled;
  }
  return err;
}
function sendError(event, error, debug) {
  if (event.handled) {
    return;
  }
  const h3Error = isError$1(error) ? error : createError$2(error);
  const responseBody = {
    statusCode: h3Error.statusCode,
    statusMessage: h3Error.statusMessage,
    stack: [],
    data: h3Error.data
  };
  if (debug) {
    responseBody.stack = (h3Error.stack || "").split("\n").map((l) => l.trim());
  }
  if (event.handled) {
    return;
  }
  const _code = Number.parseInt(h3Error.statusCode);
  setResponseStatus$1(event, _code, h3Error.statusMessage);
  event.node.res.setHeader("content-type", MIMES$1.json);
  event.node.res.end(JSON.stringify(responseBody, void 0, 2));
}
function isError$1(input) {
  return input?.constructor?.__h3_error__ === true;
}
function isMethod$1(event, expected, allowHead) {
  if (typeof expected === "string") {
    if (event.method === expected) {
      return true;
    }
  } else if (expected.includes(event.method)) {
    return true;
  }
  return false;
}
function assertMethod$1(event, expected, allowHead) {
  if (!isMethod$1(event, expected)) {
    throw createError$2({
      statusCode: 405,
      statusMessage: "HTTP method is not allowed."
    });
  }
}
function getRequestHeaders$1(event) {
  const _headers = {};
  for (const key in event.node.req.headers) {
    const val = event.node.req.headers[key];
    _headers[key] = Array.isArray(val) ? val.filter(Boolean).join(", ") : val;
  }
  return _headers;
}
function getRequestHeader$1(event, name) {
  const headers = getRequestHeaders$1(event);
  const value = headers[name.toLowerCase()];
  return value;
}
function getRequestHost$1(event, opts = {}) {
  if (opts.xForwardedHost) {
    const _header = event.node.req.headers["x-forwarded-host"];
    const xForwardedHost = (_header || "").split(",").shift()?.trim();
    if (xForwardedHost) {
      return xForwardedHost;
    }
  }
  return event.node.req.headers.host || "localhost";
}
function getRequestProtocol$1(event, opts = {}) {
  if (opts.xForwardedProto !== false && event.node.req.headers["x-forwarded-proto"] === "https") {
    return "https";
  }
  return event.node.req.connection?.encrypted ? "https" : "http";
}
function getRequestURL$1(event, opts = {}) {
  const host = getRequestHost$1(event, opts);
  const protocol = getRequestProtocol$1(event, opts);
  const path = (event.node.req.originalUrl || event.path).replace(
    /^[/\\]+/g,
    "/"
  );
  return new URL(path, `${protocol}://${host}`);
}

const RawBodySymbol$1 = Symbol.for("h3RawBody");
const PayloadMethods$1$1 = ["PATCH", "POST", "PUT", "DELETE"];
function readRawBody$1(event, encoding = "utf8") {
  assertMethod$1(event, PayloadMethods$1$1);
  const _rawBody = event._requestBody || event.web?.request?.body || event.node.req[RawBodySymbol$1] || event.node.req.rawBody || event.node.req.body;
  if (_rawBody) {
    const promise2 = Promise.resolve(_rawBody).then((_resolved) => {
      if (Buffer.isBuffer(_resolved)) {
        return _resolved;
      }
      if (typeof _resolved.pipeTo === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.pipeTo(
            new WritableStream({
              write(chunk) {
                chunks.push(chunk);
              },
              close() {
                resolve(Buffer.concat(chunks));
              },
              abort(reason) {
                reject(reason);
              }
            })
          ).catch(reject);
        });
      } else if (typeof _resolved.pipe === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.on("data", (chunk) => {
            chunks.push(chunk);
          }).on("end", () => {
            resolve(Buffer.concat(chunks));
          }).on("error", reject);
        });
      }
      if (_resolved.constructor === Object) {
        return Buffer.from(JSON.stringify(_resolved));
      }
      if (_resolved instanceof URLSearchParams) {
        return Buffer.from(_resolved.toString());
      }
      if (_resolved instanceof FormData) {
        return new Response(_resolved).bytes().then((uint8arr) => Buffer.from(uint8arr));
      }
      return Buffer.from(_resolved);
    });
    return encoding ? promise2.then((buff) => buff.toString(encoding)) : promise2;
  }
  if (!Number.parseInt(event.node.req.headers["content-length"] || "") && !String(event.node.req.headers["transfer-encoding"] ?? "").split(",").map((e) => e.trim()).filter(Boolean).includes("chunked")) {
    return Promise.resolve(void 0);
  }
  const promise = event.node.req[RawBodySymbol$1] = new Promise(
    (resolve, reject) => {
      const bodyData = [];
      event.node.req.on("error", (err) => {
        reject(err);
      }).on("data", (chunk) => {
        bodyData.push(chunk);
      }).on("end", () => {
        resolve(Buffer.concat(bodyData));
      });
    }
  );
  const result = encoding ? promise.then((buff) => buff.toString(encoding)) : promise;
  return result;
}
function getRequestWebStream$1(event) {
  if (!PayloadMethods$1$1.includes(event.method)) {
    return;
  }
  const bodyStream = event.web?.request?.body || event._requestBody;
  if (bodyStream) {
    return bodyStream;
  }
  const _hasRawBody = RawBodySymbol$1 in event.node.req || "rawBody" in event.node.req || "body" in event.node.req || "__unenv__" in event.node.req;
  if (_hasRawBody) {
    return new ReadableStream({
      async start(controller) {
        const _rawBody = await readRawBody$1(event, false);
        if (_rawBody) {
          controller.enqueue(_rawBody);
        }
        controller.close();
      }
    });
  }
  return new ReadableStream({
    start: (controller) => {
      event.node.req.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      event.node.req.on("end", () => {
        controller.close();
      });
      event.node.req.on("error", (err) => {
        controller.error(err);
      });
    }
  });
}

function handleCacheHeaders(event, opts) {
  const cacheControls = ["public", ...opts.cacheControls || []];
  let cacheMatched = false;
  if (opts.maxAge !== void 0) {
    cacheControls.push(`max-age=${+opts.maxAge}`, `s-maxage=${+opts.maxAge}`);
  }
  if (opts.modifiedTime) {
    const modifiedTime = new Date(opts.modifiedTime);
    const ifModifiedSince = event.node.req.headers["if-modified-since"];
    event.node.res.setHeader("last-modified", modifiedTime.toUTCString());
    if (ifModifiedSince && new Date(ifModifiedSince) >= modifiedTime) {
      cacheMatched = true;
    }
  }
  if (opts.etag) {
    event.node.res.setHeader("etag", opts.etag);
    const ifNonMatch = event.node.req.headers["if-none-match"];
    if (ifNonMatch === opts.etag) {
      cacheMatched = true;
    }
  }
  event.node.res.setHeader("cache-control", cacheControls.join(", "));
  if (cacheMatched) {
    event.node.res.statusCode = 304;
    if (!event.handled) {
      event.node.res.end();
    }
    return true;
  }
  return false;
}

const MIMES$1 = {
  html: "text/html",
  json: "application/json"
};

const DISALLOWED_STATUS_CHARS$1 = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage$1(statusMessage = "") {
  return statusMessage.replace(DISALLOWED_STATUS_CHARS$1, "");
}
function sanitizeStatusCode$1(statusCode, defaultStatusCode = 200) {
  if (!statusCode) {
    return defaultStatusCode;
  }
  if (typeof statusCode === "string") {
    statusCode = Number.parseInt(statusCode, 10);
  }
  if (statusCode < 100 || statusCode > 999) {
    return defaultStatusCode;
  }
  return statusCode;
}
function splitCookiesString$1(cookiesString) {
  if (Array.isArray(cookiesString)) {
    return cookiesString.flatMap((c) => splitCookiesString$1(c));
  }
  if (typeof cookiesString !== "string") {
    return [];
  }
  const cookiesStrings = [];
  let pos = 0;
  let start;
  let ch;
  let lastComma;
  let nextStart;
  let cookiesSeparatorFound;
  const skipWhitespace = () => {
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
      pos += 1;
    }
    return pos < cookiesString.length;
  };
  const notSpecialChar = () => {
    ch = cookiesString.charAt(pos);
    return ch !== "=" && ch !== ";" && ch !== ",";
  };
  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;
    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        lastComma = pos;
        pos += 1;
        skipWhitespace();
        nextStart = pos;
        while (pos < cookiesString.length && notSpecialChar()) {
          pos += 1;
        }
        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          cookiesSeparatorFound = true;
          pos = nextStart;
          cookiesStrings.push(cookiesString.slice(start, lastComma));
          start = pos;
        } else {
          pos = lastComma + 1;
        }
      } else {
        pos += 1;
      }
    }
    if (!cookiesSeparatorFound || pos >= cookiesString.length) {
      cookiesStrings.push(cookiesString.slice(start));
    }
  }
  return cookiesStrings;
}

const defer$1 = typeof setImmediate === "undefined" ? (fn) => fn() : setImmediate;
function send$1(event, data, type) {
  if (type) {
    defaultContentType$1(event, type);
  }
  return new Promise((resolve) => {
    defer$1(() => {
      if (!event.handled) {
        event.node.res.end(data);
      }
      resolve();
    });
  });
}
function sendNoContent(event, code) {
  if (event.handled) {
    return;
  }
  if (!code && event.node.res.statusCode !== 200) {
    code = event.node.res.statusCode;
  }
  const _code = sanitizeStatusCode$1(code, 204);
  if (_code === 204) {
    event.node.res.removeHeader("content-length");
  }
  event.node.res.writeHead(_code);
  event.node.res.end();
}
function setResponseStatus$1(event, code, text) {
  if (code) {
    event.node.res.statusCode = sanitizeStatusCode$1(
      code,
      event.node.res.statusCode
    );
  }
  if (text) {
    event.node.res.statusMessage = sanitizeStatusMessage$1(text);
  }
}
function defaultContentType$1(event, type) {
  if (type && event.node.res.statusCode !== 304 && !event.node.res.getHeader("content-type")) {
    event.node.res.setHeader("content-type", type);
  }
}
function sendRedirect$1(event, location, code = 302) {
  event.node.res.statusCode = sanitizeStatusCode$1(
    code,
    event.node.res.statusCode
  );
  event.node.res.setHeader("location", location);
  const encodedLoc = location.replace(/"/g, "%22");
  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`;
  return send$1(event, html, MIMES$1.html);
}
function getResponseHeader$1(event, name) {
  return event.node.res.getHeader(name);
}
function setResponseHeaders(event, headers) {
  for (const [name, value] of Object.entries(headers)) {
    event.node.res.setHeader(
      name,
      value
    );
  }
}
const setHeaders = setResponseHeaders;
function setResponseHeader$1(event, name, value) {
  event.node.res.setHeader(name, value);
}
function appendResponseHeader$1(event, name, value) {
  let current = event.node.res.getHeader(name);
  if (!current) {
    event.node.res.setHeader(name, value);
    return;
  }
  if (!Array.isArray(current)) {
    current = [current.toString()];
  }
  event.node.res.setHeader(name, [...current, value]);
}
function removeResponseHeader$1(event, name) {
  return event.node.res.removeHeader(name);
}
function isStream(data) {
  if (!data || typeof data !== "object") {
    return false;
  }
  if (typeof data.pipe === "function") {
    if (typeof data._read === "function") {
      return true;
    }
    if (typeof data.abort === "function") {
      return true;
    }
  }
  if (typeof data.pipeTo === "function") {
    return true;
  }
  return false;
}
function isWebResponse(data) {
  return typeof Response !== "undefined" && data instanceof Response;
}
function sendStream$1(event, stream) {
  if (!stream || typeof stream !== "object") {
    throw new Error("[h3] Invalid stream provided.");
  }
  event.node.res._data = stream;
  if (!event.node.res.socket) {
    event._handled = true;
    return Promise.resolve();
  }
  if (hasProp$1(stream, "pipeTo") && typeof stream.pipeTo === "function") {
    return stream.pipeTo(
      new WritableStream({
        write(chunk) {
          event.node.res.write(chunk);
        }
      })
    ).then(() => {
      event.node.res.end();
    });
  }
  if (hasProp$1(stream, "pipe") && typeof stream.pipe === "function") {
    return new Promise((resolve, reject) => {
      stream.pipe(event.node.res);
      if (stream.on) {
        stream.on("end", () => {
          event.node.res.end();
          resolve();
        });
        stream.on("error", (error) => {
          reject(error);
        });
      }
      event.node.res.on("close", () => {
        if (stream.abort) {
          stream.abort();
        }
      });
    });
  }
  throw new Error("[h3] Invalid or incompatible stream provided.");
}
function sendWebResponse$1(event, response) {
  for (const [key, value] of response.headers) {
    if (key === "set-cookie") {
      event.node.res.appendHeader(key, splitCookiesString$1(value));
    } else {
      event.node.res.setHeader(key, value);
    }
  }
  if (response.status) {
    event.node.res.statusCode = sanitizeStatusCode$1(
      response.status,
      event.node.res.statusCode
    );
  }
  if (response.statusText) {
    event.node.res.statusMessage = sanitizeStatusMessage$1(response.statusText);
  }
  if (response.redirected) {
    event.node.res.setHeader("location", response.url);
  }
  if (!response.body) {
    event.node.res.end();
    return;
  }
  return sendStream$1(event, response.body);
}

const PayloadMethods = /* @__PURE__ */ new Set(["PATCH", "POST", "PUT", "DELETE"]);
const ignoredHeaders = /* @__PURE__ */ new Set([
  "transfer-encoding",
  "accept-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "expect",
  "host",
  "accept"
]);
async function proxyRequest(event, target, opts = {}) {
  let body;
  let duplex;
  if (PayloadMethods.has(event.method)) {
    if (opts.streamRequest) {
      body = getRequestWebStream$1(event);
      duplex = "half";
    } else {
      body = await readRawBody$1(event, false).catch(() => void 0);
    }
  }
  const method = opts.fetchOptions?.method || event.method;
  const fetchHeaders = mergeHeaders$1(
    getProxyRequestHeaders(event, { host: target.startsWith("/") }),
    opts.fetchOptions?.headers,
    opts.headers
  );
  return sendProxy(event, target, {
    ...opts,
    fetchOptions: {
      method,
      body,
      duplex,
      ...opts.fetchOptions,
      headers: fetchHeaders
    }
  });
}
async function sendProxy(event, target, opts = {}) {
  let response;
  try {
    response = await _getFetch(opts.fetch)(target, {
      headers: opts.headers,
      ignoreResponseError: true,
      // make $ofetch.raw transparent
      ...opts.fetchOptions
    });
  } catch (error) {
    throw createError$2({
      status: 502,
      statusMessage: "Bad Gateway",
      cause: error
    });
  }
  event.node.res.statusCode = sanitizeStatusCode$1(
    response.status,
    event.node.res.statusCode
  );
  event.node.res.statusMessage = sanitizeStatusMessage$1(response.statusText);
  const cookies = [];
  for (const [key, value] of response.headers.entries()) {
    if (key === "content-encoding") {
      continue;
    }
    if (key === "content-length") {
      continue;
    }
    if (key === "set-cookie") {
      cookies.push(...splitCookiesString$1(value));
      continue;
    }
    event.node.res.setHeader(key, value);
  }
  if (cookies.length > 0) {
    event.node.res.setHeader(
      "set-cookie",
      cookies.map((cookie) => {
        if (opts.cookieDomainRewrite) {
          cookie = rewriteCookieProperty(
            cookie,
            opts.cookieDomainRewrite,
            "domain"
          );
        }
        if (opts.cookiePathRewrite) {
          cookie = rewriteCookieProperty(
            cookie,
            opts.cookiePathRewrite,
            "path"
          );
        }
        return cookie;
      })
    );
  }
  if (opts.onResponse) {
    await opts.onResponse(event, response);
  }
  if (response._data !== void 0) {
    return response._data;
  }
  if (event.handled) {
    return;
  }
  if (opts.sendStream === false) {
    const data = new Uint8Array(await response.arrayBuffer());
    return event.node.res.end(data);
  }
  if (response.body) {
    for await (const chunk of response.body) {
      event.node.res.write(chunk);
    }
  }
  return event.node.res.end();
}
function getProxyRequestHeaders(event, opts) {
  const headers = /* @__PURE__ */ Object.create(null);
  const reqHeaders = getRequestHeaders$1(event);
  for (const name in reqHeaders) {
    if (!ignoredHeaders.has(name) || name === "host" && opts?.host) {
      headers[name] = reqHeaders[name];
    }
  }
  return headers;
}
function fetchWithEvent(event, req, init, options) {
  return _getFetch(options?.fetch)(req, {
    ...init,
    context: init?.context || event.context,
    headers: {
      ...getProxyRequestHeaders(event, {
        host: typeof req === "string" && req.startsWith("/")
      }),
      ...init?.headers
    }
  });
}
function _getFetch(_fetch) {
  if (_fetch) {
    return _fetch;
  }
  if (globalThis.fetch) {
    return globalThis.fetch;
  }
  throw new Error(
    "fetch is not available. Try importing `node-fetch-native/polyfill` for Node.js."
  );
}
function rewriteCookieProperty(header, map, property) {
  const _map = typeof map === "string" ? { "*": map } : map;
  return header.replace(
    new RegExp(`(;\\s*${property}=)([^;]+)`, "gi"),
    (match, prefix, previousValue) => {
      let newValue;
      if (previousValue in _map) {
        newValue = _map[previousValue];
      } else if ("*" in _map) {
        newValue = _map["*"];
      } else {
        return match;
      }
      return newValue ? prefix + newValue : "";
    }
  );
}
function mergeHeaders$1(defaults, ...inputs) {
  const _inputs = inputs.filter(Boolean);
  if (_inputs.length === 0) {
    return defaults;
  }
  const merged = new Headers(defaults);
  for (const input of _inputs) {
    const entries = Array.isArray(input) ? input : typeof input.entries === "function" ? input.entries() : Object.entries(input);
    for (const [key, value] of entries) {
      if (value !== void 0) {
        merged.set(key, value);
      }
    }
  }
  return merged;
}

let H3Event$1 = class H3Event {
  "__is_event__" = true;
  // Context
  node;
  // Node
  web;
  // Web
  context = {};
  // Shared
  // Request
  _method;
  _path;
  _headers;
  _requestBody;
  // Response
  _handled = false;
  // Hooks
  _onBeforeResponseCalled;
  _onAfterResponseCalled;
  constructor(req, res) {
    this.node = { req, res };
  }
  // --- Request ---
  get method() {
    if (!this._method) {
      this._method = (this.node.req.method || "GET").toUpperCase();
    }
    return this._method;
  }
  get path() {
    return this._path || this.node.req.url || "/";
  }
  get headers() {
    if (!this._headers) {
      this._headers = _normalizeNodeHeaders$1(this.node.req.headers);
    }
    return this._headers;
  }
  // --- Respoonse ---
  get handled() {
    return this._handled || this.node.res.writableEnded || this.node.res.headersSent;
  }
  respondWith(response) {
    return Promise.resolve(response).then(
      (_response) => sendWebResponse$1(this, _response)
    );
  }
  // --- Utils ---
  toString() {
    return `[${this.method}] ${this.path}`;
  }
  toJSON() {
    return this.toString();
  }
  // --- Deprecated ---
  /** @deprecated Please use `event.node.req` instead. */
  get req() {
    return this.node.req;
  }
  /** @deprecated Please use `event.node.res` instead. */
  get res() {
    return this.node.res;
  }
};
function isEvent(input) {
  return hasProp$1(input, "__is_event__");
}
function createEvent(req, res) {
  return new H3Event$1(req, res);
}
function _normalizeNodeHeaders$1(nodeHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

function defineEventHandler$1(handler) {
  if (typeof handler === "function") {
    handler.__is_handler__ = true;
    return handler;
  }
  const _hooks = {
    onRequest: _normalizeArray$1(handler.onRequest),
    onBeforeResponse: _normalizeArray$1(handler.onBeforeResponse)
  };
  const _handler = (event) => {
    return _callHandler$1(event, handler.handler, _hooks);
  };
  _handler.__is_handler__ = true;
  _handler.__resolve__ = handler.handler.__resolve__;
  _handler.__websocket__ = handler.websocket;
  return _handler;
}
function _normalizeArray$1(input) {
  return input ? Array.isArray(input) ? input : [input] : void 0;
}
async function _callHandler$1(event, handler, hooks) {
  if (hooks.onRequest) {
    for (const hook of hooks.onRequest) {
      await hook(event);
      if (event.handled) {
        return;
      }
    }
  }
  const body = await handler(event);
  const response = { body };
  if (hooks.onBeforeResponse) {
    for (const hook of hooks.onBeforeResponse) {
      await hook(event, response);
    }
  }
  return response.body;
}
const eventHandler$1 = defineEventHandler$1;
function isEventHandler(input) {
  return hasProp$1(input, "__is_handler__");
}
function toEventHandler(input, _, _route) {
  if (!isEventHandler(input)) {
    console.warn(
      "[h3] Implicit event handler conversion is deprecated. Use `eventHandler()` or `fromNodeMiddleware()` to define event handlers.",
      _route && _route !== "/" ? `
     Route: ${_route}` : "",
      `
     Handler: ${input}`
    );
  }
  return input;
}
function defineLazyEventHandler(factory) {
  let _promise;
  let _resolved;
  const resolveHandler = () => {
    if (_resolved) {
      return Promise.resolve(_resolved);
    }
    if (!_promise) {
      _promise = Promise.resolve(factory()).then((r) => {
        const handler2 = r.default || r;
        if (typeof handler2 !== "function") {
          throw new TypeError(
            "Invalid lazy handler result. It should be a function:",
            handler2
          );
        }
        _resolved = { handler: toEventHandler(r.default || r) };
        return _resolved;
      });
    }
    return _promise;
  };
  const handler = eventHandler$1((event) => {
    if (_resolved) {
      return _resolved.handler(event);
    }
    return resolveHandler().then((r) => r.handler(event));
  });
  handler.__resolve__ = resolveHandler;
  return handler;
}
const lazyEventHandler = defineLazyEventHandler;

function createApp(options = {}) {
  const stack = [];
  const handler = createAppEventHandler(stack, options);
  const resolve = createResolver(stack);
  handler.__resolve__ = resolve;
  const getWebsocket = cachedFn(() => websocketOptions(resolve, options));
  const app = {
    // @ts-expect-error
    use: (arg1, arg2, arg3) => use(app, arg1, arg2, arg3),
    resolve,
    handler,
    stack,
    options,
    get websocket() {
      return getWebsocket();
    }
  };
  return app;
}
function use(app, arg1, arg2, arg3) {
  if (Array.isArray(arg1)) {
    for (const i of arg1) {
      use(app, i, arg2, arg3);
    }
  } else if (Array.isArray(arg2)) {
    for (const i of arg2) {
      use(app, arg1, i, arg3);
    }
  } else if (typeof arg1 === "string") {
    app.stack.push(
      normalizeLayer({ ...arg3, route: arg1, handler: arg2 })
    );
  } else if (typeof arg1 === "function") {
    app.stack.push(normalizeLayer({ ...arg2, handler: arg1 }));
  } else {
    app.stack.push(normalizeLayer({ ...arg1 }));
  }
  return app;
}
function createAppEventHandler(stack, options) {
  const spacing = options.debug ? 2 : void 0;
  return eventHandler$1(async (event) => {
    event.node.req.originalUrl = event.node.req.originalUrl || event.node.req.url || "/";
    const _reqPath = event._path || event.node.req.url || "/";
    let _layerPath;
    if (options.onRequest) {
      await options.onRequest(event);
    }
    for (const layer of stack) {
      if (layer.route.length > 1) {
        if (!_reqPath.startsWith(layer.route)) {
          continue;
        }
        _layerPath = _reqPath.slice(layer.route.length) || "/";
      } else {
        _layerPath = _reqPath;
      }
      if (layer.match && !layer.match(_layerPath, event)) {
        continue;
      }
      event._path = _layerPath;
      event.node.req.url = _layerPath;
      const val = await layer.handler(event);
      const _body = val === void 0 ? void 0 : await val;
      if (_body !== void 0) {
        const _response = { body: _body };
        if (options.onBeforeResponse) {
          event._onBeforeResponseCalled = true;
          await options.onBeforeResponse(event, _response);
        }
        await handleHandlerResponse(event, _response.body, spacing);
        if (options.onAfterResponse) {
          event._onAfterResponseCalled = true;
          await options.onAfterResponse(event, _response);
        }
        return;
      }
      if (event.handled) {
        if (options.onAfterResponse) {
          event._onAfterResponseCalled = true;
          await options.onAfterResponse(event, void 0);
        }
        return;
      }
    }
    if (!event.handled) {
      throw createError$2({
        statusCode: 404,
        statusMessage: `Cannot find any path matching ${event.path || "/"}.`
      });
    }
    if (options.onAfterResponse) {
      event._onAfterResponseCalled = true;
      await options.onAfterResponse(event, void 0);
    }
  });
}
function createResolver(stack) {
  return async (path) => {
    let _layerPath;
    for (const layer of stack) {
      if (layer.route === "/" && !layer.handler.__resolve__) {
        continue;
      }
      if (!path.startsWith(layer.route)) {
        continue;
      }
      _layerPath = path.slice(layer.route.length) || "/";
      if (layer.match && !layer.match(_layerPath, void 0)) {
        continue;
      }
      let res = { route: layer.route, handler: layer.handler };
      if (res.handler.__resolve__) {
        const _res = await res.handler.__resolve__(_layerPath);
        if (!_res) {
          continue;
        }
        res = {
          ...res,
          ..._res,
          route: joinURL(res.route || "/", _res.route || "/")
        };
      }
      return res;
    }
  };
}
function normalizeLayer(input) {
  let handler = input.handler;
  if (handler.handler) {
    handler = handler.handler;
  }
  if (input.lazy) {
    handler = lazyEventHandler(handler);
  } else if (!isEventHandler(handler)) {
    handler = toEventHandler(handler, void 0, input.route);
  }
  return {
    route: withoutTrailingSlash(input.route),
    match: input.match,
    handler
  };
}
function handleHandlerResponse(event, val, jsonSpace) {
  if (val === null) {
    return sendNoContent(event);
  }
  if (val) {
    if (isWebResponse(val)) {
      return sendWebResponse$1(event, val);
    }
    if (isStream(val)) {
      return sendStream$1(event, val);
    }
    if (val.buffer) {
      return send$1(event, val);
    }
    if (val.arrayBuffer && typeof val.arrayBuffer === "function") {
      return val.arrayBuffer().then((arrayBuffer) => {
        return send$1(event, Buffer.from(arrayBuffer), val.type);
      });
    }
    if (val instanceof Error) {
      throw createError$2(val);
    }
    if (typeof val.end === "function") {
      return true;
    }
  }
  const valType = typeof val;
  if (valType === "string") {
    return send$1(event, val, MIMES$1.html);
  }
  if (valType === "object" || valType === "boolean" || valType === "number") {
    return send$1(event, JSON.stringify(val, void 0, jsonSpace), MIMES$1.json);
  }
  if (valType === "bigint") {
    return send$1(event, val.toString(), MIMES$1.json);
  }
  throw createError$2({
    statusCode: 500,
    statusMessage: `[h3] Cannot send ${valType} as response.`
  });
}
function cachedFn(fn) {
  let cache;
  return () => {
    if (!cache) {
      cache = fn();
    }
    return cache;
  };
}
function websocketOptions(evResolver, appOptions) {
  return {
    ...appOptions.websocket,
    async resolve(info) {
      const url = info.request?.url || info.url || "/";
      const { pathname } = typeof url === "string" ? parseURL(url) : url;
      const resolved = await evResolver(pathname);
      return resolved?.handler?.__websocket__ || {};
    }
  };
}

const RouterMethods = [
  "connect",
  "delete",
  "get",
  "head",
  "options",
  "post",
  "put",
  "trace",
  "patch"
];
function createRouter(opts = {}) {
  const _router = createRouter$1({});
  const routes = {};
  let _matcher;
  const router = {};
  const addRoute = (path, handler, method) => {
    let route = routes[path];
    if (!route) {
      routes[path] = route = { path, handlers: {} };
      _router.insert(path, route);
    }
    if (Array.isArray(method)) {
      for (const m of method) {
        addRoute(path, handler, m);
      }
    } else {
      route.handlers[method] = toEventHandler(handler, void 0, path);
    }
    return router;
  };
  router.use = router.add = (path, handler, method) => addRoute(path, handler, method || "all");
  for (const method of RouterMethods) {
    router[method] = (path, handle) => router.add(path, handle, method);
  }
  const matchHandler = (path = "/", method = "get") => {
    const qIndex = path.indexOf("?");
    if (qIndex !== -1) {
      path = path.slice(0, Math.max(0, qIndex));
    }
    const matched = _router.lookup(path);
    if (!matched || !matched.handlers) {
      return {
        error: createError$2({
          statusCode: 404,
          name: "Not Found",
          statusMessage: `Cannot find any route matching ${path || "/"}.`
        })
      };
    }
    let handler = matched.handlers[method] || matched.handlers.all;
    if (!handler) {
      if (!_matcher) {
        _matcher = toRouteMatcher(_router);
      }
      const _matches = _matcher.matchAll(path).reverse();
      for (const _match of _matches) {
        if (_match.handlers[method]) {
          handler = _match.handlers[method];
          matched.handlers[method] = matched.handlers[method] || handler;
          break;
        }
        if (_match.handlers.all) {
          handler = _match.handlers.all;
          matched.handlers.all = matched.handlers.all || handler;
          break;
        }
      }
    }
    if (!handler) {
      return {
        error: createError$2({
          statusCode: 405,
          name: "Method Not Allowed",
          statusMessage: `Method ${method} is not allowed on this route.`
        })
      };
    }
    return { matched, handler };
  };
  const isPreemptive = opts.preemptive || opts.preemtive;
  router.handler = eventHandler$1((event) => {
    const match = matchHandler(
      event.path,
      event.method.toLowerCase()
    );
    if ("error" in match) {
      if (isPreemptive) {
        throw match.error;
      } else {
        return;
      }
    }
    event.context.matchedRoute = match.matched;
    const params = match.matched.params || {};
    event.context.params = params;
    return Promise.resolve(match.handler(event)).then((res) => {
      if (res === void 0 && isPreemptive) {
        return null;
      }
      return res;
    });
  });
  router.handler.__resolve__ = async (path) => {
    path = withLeadingSlash(path);
    const match = matchHandler(path);
    if ("error" in match) {
      return;
    }
    let res = {
      route: match.matched.path,
      handler: match.handler
    };
    if (match.handler.__resolve__) {
      const _res = await match.handler.__resolve__(path);
      if (!_res) {
        return;
      }
      res = { ...res, ..._res };
    }
    return res;
  };
  return router;
}
function toNodeListener(app) {
  const toNodeHandle = async function(req, res) {
    const event = createEvent(req, res);
    try {
      await app.handler(event);
    } catch (_error) {
      const error = createError$2(_error);
      if (!isError$1(_error)) {
        error.unhandled = true;
      }
      setResponseStatus$1(event, error.statusCode, error.statusMessage);
      if (app.options.onError) {
        await app.options.onError(error, event);
      }
      if (event.handled) {
        return;
      }
      if (error.unhandled || error.fatal) {
        console.error("[h3]", error.fatal ? "[fatal]" : "[unhandled]", error);
      }
      if (app.options.onBeforeResponse && !event._onBeforeResponseCalled) {
        await app.options.onBeforeResponse(event, { body: error });
      }
      await sendError(event, error, !!app.options.debug);
      if (app.options.onAfterResponse && !event._onAfterResponseCalled) {
        await app.options.onAfterResponse(event, { body: error });
      }
    }
  };
  return toNodeHandle;
}

function flatHooks(configHooks, hooks = {}, parentName) {
  for (const key in configHooks) {
    const subHook = configHooks[key];
    const name = parentName ? `${parentName}:${key}` : key;
    if (typeof subHook === "object" && subHook !== null) {
      flatHooks(subHook, hooks, name);
    } else if (typeof subHook === "function") {
      hooks[name] = subHook;
    }
  }
  return hooks;
}
const defaultTask = { run: (function_) => function_() };
const _createTask = () => defaultTask;
const createTask = typeof console.createTask !== "undefined" ? console.createTask : _createTask;
function serialTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return hooks.reduce(
    (promise, hookFunction) => promise.then(() => task.run(() => hookFunction(...args))),
    Promise.resolve()
  );
}
function parallelTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
}
function callEachWith(callbacks, arg0) {
  for (const callback of [...callbacks]) {
    callback(arg0);
  }
}

class Hookable {
  constructor() {
    this._hooks = {};
    this._before = void 0;
    this._after = void 0;
    this._deprecatedMessages = void 0;
    this._deprecatedHooks = {};
    this.hook = this.hook.bind(this);
    this.callHook = this.callHook.bind(this);
    this.callHookWith = this.callHookWith.bind(this);
  }
  hook(name, function_, options = {}) {
    if (!name || typeof function_ !== "function") {
      return () => {
      };
    }
    const originalName = name;
    let dep;
    while (this._deprecatedHooks[name]) {
      dep = this._deprecatedHooks[name];
      name = dep.to;
    }
    if (dep && !options.allowDeprecated) {
      let message = dep.message;
      if (!message) {
        message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
      }
      if (!this._deprecatedMessages) {
        this._deprecatedMessages = /* @__PURE__ */ new Set();
      }
      if (!this._deprecatedMessages.has(message)) {
        console.warn(message);
        this._deprecatedMessages.add(message);
      }
    }
    if (!function_.name) {
      try {
        Object.defineProperty(function_, "name", {
          get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
          configurable: true
        });
      } catch {
      }
    }
    this._hooks[name] = this._hooks[name] || [];
    this._hooks[name].push(function_);
    return () => {
      if (function_) {
        this.removeHook(name, function_);
        function_ = void 0;
      }
    };
  }
  hookOnce(name, function_) {
    let _unreg;
    let _function = (...arguments_) => {
      if (typeof _unreg === "function") {
        _unreg();
      }
      _unreg = void 0;
      _function = void 0;
      return function_(...arguments_);
    };
    _unreg = this.hook(name, _function);
    return _unreg;
  }
  removeHook(name, function_) {
    if (this._hooks[name]) {
      const index = this._hooks[name].indexOf(function_);
      if (index !== -1) {
        this._hooks[name].splice(index, 1);
      }
      if (this._hooks[name].length === 0) {
        delete this._hooks[name];
      }
    }
  }
  deprecateHook(name, deprecated) {
    this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
    const _hooks = this._hooks[name] || [];
    delete this._hooks[name];
    for (const hook of _hooks) {
      this.hook(name, hook);
    }
  }
  deprecateHooks(deprecatedHooks) {
    Object.assign(this._deprecatedHooks, deprecatedHooks);
    for (const name in deprecatedHooks) {
      this.deprecateHook(name, deprecatedHooks[name]);
    }
  }
  addHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    const removeFns = Object.keys(hooks).map(
      (key) => this.hook(key, hooks[key])
    );
    return () => {
      for (const unreg of removeFns.splice(0, removeFns.length)) {
        unreg();
      }
    };
  }
  removeHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    for (const key in hooks) {
      this.removeHook(key, hooks[key]);
    }
  }
  removeAllHooks() {
    for (const key in this._hooks) {
      delete this._hooks[key];
    }
  }
  callHook(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(serialTaskCaller, name, ...arguments_);
  }
  callHookParallel(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(parallelTaskCaller, name, ...arguments_);
  }
  callHookWith(caller, name, ...arguments_) {
    const event = this._before || this._after ? { name, args: arguments_, context: {} } : void 0;
    if (this._before) {
      callEachWith(this._before, event);
    }
    const result = caller(
      name in this._hooks ? [...this._hooks[name]] : [],
      arguments_
    );
    if (result instanceof Promise) {
      return result.finally(() => {
        if (this._after && event) {
          callEachWith(this._after, event);
        }
      });
    }
    if (this._after && event) {
      callEachWith(this._after, event);
    }
    return result;
  }
  beforeEach(function_) {
    this._before = this._before || [];
    this._before.push(function_);
    return () => {
      if (this._before !== void 0) {
        const index = this._before.indexOf(function_);
        if (index !== -1) {
          this._before.splice(index, 1);
        }
      }
    };
  }
  afterEach(function_) {
    this._after = this._after || [];
    this._after.push(function_);
    return () => {
      if (this._after !== void 0) {
        const index = this._after.indexOf(function_);
        if (index !== -1) {
          this._after.splice(index, 1);
        }
      }
    };
  }
}
function createHooks() {
  return new Hookable();
}

class FetchError extends Error {
  constructor(message, opts) {
    super(message, opts);
    this.name = "FetchError";
    if (opts?.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
}
function createFetchError(ctx) {
  const errorMessage = ctx.error?.message || ctx.error?.toString() || "";
  const method = ctx.request?.method || ctx.options?.method || "GET";
  const url = ctx.request?.url || String(ctx.request) || "/";
  const requestStr = `[${method}] ${JSON.stringify(url)}`;
  const statusStr = ctx.response ? `${ctx.response.status} ${ctx.response.statusText}` : "<no response>";
  const message = `${requestStr}: ${statusStr}${errorMessage ? ` ${errorMessage}` : ""}`;
  const fetchError = new FetchError(
    message,
    ctx.error ? { cause: ctx.error } : void 0
  );
  for (const key of ["request", "options", "response"]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx[key];
      }
    });
  }
  for (const [key, refKey] of [
    ["data", "_data"],
    ["status", "status"],
    ["statusCode", "status"],
    ["statusText", "statusText"],
    ["statusMessage", "statusText"]
  ]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx.response && ctx.response[refKey];
      }
    });
  }
  return fetchError;
}

const payloadMethods = new Set(
  Object.freeze(["PATCH", "POST", "PUT", "DELETE"])
);
function isPayloadMethod(method = "GET") {
  return payloadMethods.has(method.toUpperCase());
}
function isJSONSerializable(value) {
  if (value === void 0) {
    return false;
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === null) {
    return true;
  }
  if (t !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value.buffer) {
    return false;
  }
  if (value instanceof FormData || value instanceof URLSearchParams) {
    return false;
  }
  return value.constructor && value.constructor.name === "Object" || typeof value.toJSON === "function";
}
const textTypes = /* @__PURE__ */ new Set([
  "image/svg",
  "application/xml",
  "application/xhtml",
  "application/html"
]);
const JSON_RE = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;
function detectResponseType(_contentType = "") {
  if (!_contentType) {
    return "json";
  }
  const contentType = _contentType.split(";").shift() || "";
  if (JSON_RE.test(contentType)) {
    return "json";
  }
  if (contentType === "text/event-stream") {
    return "stream";
  }
  if (textTypes.has(contentType) || contentType.startsWith("text/")) {
    return "text";
  }
  return "blob";
}
function resolveFetchOptions(request, input, defaults, Headers) {
  const headers = mergeHeaders(
    input?.headers ?? request?.headers,
    defaults?.headers,
    Headers
  );
  let query;
  if (defaults?.query || defaults?.params || input?.params || input?.query) {
    query = {
      ...defaults?.params,
      ...defaults?.query,
      ...input?.params,
      ...input?.query
    };
  }
  return {
    ...defaults,
    ...input,
    query,
    params: query,
    headers
  };
}
function mergeHeaders(input, defaults, Headers) {
  if (!defaults) {
    return new Headers(input);
  }
  const headers = new Headers(defaults);
  if (input) {
    for (const [key, value] of Symbol.iterator in input || Array.isArray(input) ? input : new Headers(input)) {
      headers.set(key, value);
    }
  }
  return headers;
}
async function callHooks(context, hooks) {
  if (hooks) {
    if (Array.isArray(hooks)) {
      for (const hook of hooks) {
        await hook(context);
      }
    } else {
      await hooks(context);
    }
  }
}

const retryStatusCodes = /* @__PURE__ */ new Set([
  408,
  // Request Timeout
  409,
  // Conflict
  425,
  // Too Early (Experimental)
  429,
  // Too Many Requests
  500,
  // Internal Server Error
  502,
  // Bad Gateway
  503,
  // Service Unavailable
  504
  // Gateway Timeout
]);
const nullBodyResponses = /* @__PURE__ */ new Set([101, 204, 205, 304]);
function createFetch(globalOptions = {}) {
  const {
    fetch = globalThis.fetch,
    Headers = globalThis.Headers,
    AbortController = globalThis.AbortController
  } = globalOptions;
  async function onError(context) {
    const isAbort = context.error && context.error.name === "AbortError" && !context.options.timeout || false;
    if (context.options.retry !== false && !isAbort) {
      let retries;
      if (typeof context.options.retry === "number") {
        retries = context.options.retry;
      } else {
        retries = isPayloadMethod(context.options.method) ? 0 : 1;
      }
      const responseCode = context.response && context.response.status || 500;
      if (retries > 0 && (Array.isArray(context.options.retryStatusCodes) ? context.options.retryStatusCodes.includes(responseCode) : retryStatusCodes.has(responseCode))) {
        const retryDelay = typeof context.options.retryDelay === "function" ? context.options.retryDelay(context) : context.options.retryDelay || 0;
        if (retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
        return $fetchRaw(context.request, {
          ...context.options,
          retry: retries - 1
        });
      }
    }
    const error = createFetchError(context);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error, $fetchRaw);
    }
    throw error;
  }
  const $fetchRaw = async function $fetchRaw2(_request, _options = {}) {
    const context = {
      request: _request,
      options: resolveFetchOptions(
        _request,
        _options,
        globalOptions.defaults,
        Headers
      ),
      response: void 0,
      error: void 0
    };
    if (context.options.method) {
      context.options.method = context.options.method.toUpperCase();
    }
    if (context.options.onRequest) {
      await callHooks(context, context.options.onRequest);
      if (!(context.options.headers instanceof Headers)) {
        context.options.headers = new Headers(
          context.options.headers || {}
          /* compat */
        );
      }
    }
    if (typeof context.request === "string") {
      if (context.options.baseURL) {
        context.request = withBase(context.request, context.options.baseURL);
      }
      if (context.options.query) {
        context.request = withQuery(context.request, context.options.query);
        delete context.options.query;
      }
      if ("query" in context.options) {
        delete context.options.query;
      }
      if ("params" in context.options) {
        delete context.options.params;
      }
    }
    if (context.options.body && isPayloadMethod(context.options.method)) {
      if (isJSONSerializable(context.options.body)) {
        const contentType = context.options.headers.get("content-type");
        if (typeof context.options.body !== "string") {
          context.options.body = contentType === "application/x-www-form-urlencoded" ? new URLSearchParams(
            context.options.body
          ).toString() : JSON.stringify(context.options.body);
        }
        if (!contentType) {
          context.options.headers.set("content-type", "application/json");
        }
        if (!context.options.headers.has("accept")) {
          context.options.headers.set("accept", "application/json");
        }
      } else if (
        // ReadableStream Body
        "pipeTo" in context.options.body && typeof context.options.body.pipeTo === "function" || // Node.js Stream Body
        typeof context.options.body.pipe === "function"
      ) {
        if (!("duplex" in context.options)) {
          context.options.duplex = "half";
        }
      }
    }
    let abortTimeout;
    if (!context.options.signal && context.options.timeout) {
      const controller = new AbortController();
      abortTimeout = setTimeout(() => {
        const error = new Error(
          "[TimeoutError]: The operation was aborted due to timeout"
        );
        error.name = "TimeoutError";
        error.code = 23;
        controller.abort(error);
      }, context.options.timeout);
      context.options.signal = controller.signal;
    }
    try {
      context.response = await fetch(
        context.request,
        context.options
      );
    } catch (error) {
      context.error = error;
      if (context.options.onRequestError) {
        await callHooks(
          context,
          context.options.onRequestError
        );
      }
      return await onError(context);
    } finally {
      if (abortTimeout) {
        clearTimeout(abortTimeout);
      }
    }
    const hasBody = (context.response.body || // https://github.com/unjs/ofetch/issues/324
    // https://github.com/unjs/ofetch/issues/294
    // https://github.com/JakeChampion/fetch/issues/1454
    context.response._bodyInit) && !nullBodyResponses.has(context.response.status) && context.options.method !== "HEAD";
    if (hasBody) {
      const responseType = (context.options.parseResponse ? "json" : context.options.responseType) || detectResponseType(context.response.headers.get("content-type") || "");
      switch (responseType) {
        case "json": {
          const data = await context.response.text();
          const parseFunction = context.options.parseResponse || destr;
          context.response._data = parseFunction(data);
          break;
        }
        case "stream": {
          context.response._data = context.response.body || context.response._bodyInit;
          break;
        }
        default: {
          context.response._data = await context.response[responseType]();
        }
      }
    }
    if (context.options.onResponse) {
      await callHooks(
        context,
        context.options.onResponse
      );
    }
    if (!context.options.ignoreResponseError && context.response.status >= 400 && context.response.status < 600) {
      if (context.options.onResponseError) {
        await callHooks(
          context,
          context.options.onResponseError
        );
      }
      return await onError(context);
    }
    return context.response;
  };
  const $fetch = async function $fetch2(request, options) {
    const r = await $fetchRaw(request, options);
    return r._data;
  };
  $fetch.raw = $fetchRaw;
  $fetch.native = (...args) => fetch(...args);
  $fetch.create = (defaultOptions = {}, customGlobalOptions = {}) => createFetch({
    ...globalOptions,
    ...customGlobalOptions,
    defaults: {
      ...globalOptions.defaults,
      ...customGlobalOptions.defaults,
      ...defaultOptions
    }
  });
  return $fetch;
}

const _globalThis$1 = (function() {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw new Error("unable to locate global object");
})();
const fetch = _globalThis$1.fetch ? (...args) => _globalThis$1.fetch(...args) : () => Promise.reject(new Error("[ofetch] global.fetch is not supported!"));
const Headers$1 = _globalThis$1.Headers;
const AbortController = _globalThis$1.AbortController;
createFetch({ fetch, Headers: Headers$1, AbortController });

function wrapToPromise(value) {
  if (!value || typeof value.then !== "function") {
    return Promise.resolve(value);
  }
  return value;
}
function asyncCall(function_, ...arguments_) {
  try {
    return wrapToPromise(function_(...arguments_));
  } catch (error) {
    return Promise.reject(error);
  }
}
function isPrimitive(value) {
  const type = typeof value;
  return value === null || type !== "object" && type !== "function";
}
function isPureObject(value) {
  const proto = Object.getPrototypeOf(value);
  return !proto || proto.isPrototypeOf(Object);
}
function stringify(value) {
  if (isPrimitive(value)) {
    return String(value);
  }
  if (isPureObject(value) || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value.toJSON === "function") {
    return stringify(value.toJSON());
  }
  throw new Error("[unstorage] Cannot stringify value!");
}
const BASE64_PREFIX = "base64:";
function serializeRaw(value) {
  if (typeof value === "string") {
    return value;
  }
  return BASE64_PREFIX + base64Encode(value);
}
function deserializeRaw(value) {
  if (typeof value !== "string") {
    return value;
  }
  if (!value.startsWith(BASE64_PREFIX)) {
    return value;
  }
  return base64Decode(value.slice(BASE64_PREFIX.length));
}
function base64Decode(input) {
  if (globalThis.Buffer) {
    return Buffer.from(input, "base64");
  }
  return Uint8Array.from(
    globalThis.atob(input),
    (c) => c.codePointAt(0)
  );
}
function base64Encode(input) {
  if (globalThis.Buffer) {
    return Buffer.from(input).toString("base64");
  }
  return globalThis.btoa(String.fromCodePoint(...input));
}

const storageKeyProperties = [
  "has",
  "hasItem",
  "get",
  "getItem",
  "getItemRaw",
  "set",
  "setItem",
  "setItemRaw",
  "del",
  "remove",
  "removeItem",
  "getMeta",
  "setMeta",
  "removeMeta",
  "getKeys",
  "clear",
  "mount",
  "unmount"
];
function prefixStorage(storage, base) {
  base = normalizeBaseKey(base);
  if (!base) {
    return storage;
  }
  const nsStorage = { ...storage };
  for (const property of storageKeyProperties) {
    nsStorage[property] = (key = "", ...args) => (
      // @ts-ignore
      storage[property](base + key, ...args)
    );
  }
  nsStorage.getKeys = (key = "", ...arguments_) => storage.getKeys(base + key, ...arguments_).then((keys) => keys.map((key2) => key2.slice(base.length)));
  nsStorage.keys = nsStorage.getKeys;
  nsStorage.getItems = async (items, commonOptions) => {
    const prefixedItems = items.map(
      (item) => typeof item === "string" ? base + item : { ...item, key: base + item.key }
    );
    const results = await storage.getItems(prefixedItems, commonOptions);
    return results.map((entry) => ({
      key: entry.key.slice(base.length),
      value: entry.value
    }));
  };
  nsStorage.setItems = async (items, commonOptions) => {
    const prefixedItems = items.map((item) => ({
      key: base + item.key,
      value: item.value,
      options: item.options
    }));
    return storage.setItems(prefixedItems, commonOptions);
  };
  return nsStorage;
}
function normalizeKey$1(key) {
  if (!key) {
    return "";
  }
  return key.split("?")[0]?.replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "") || "";
}
function joinKeys(...keys) {
  return normalizeKey$1(keys.join(":"));
}
function normalizeBaseKey(base) {
  base = normalizeKey$1(base);
  return base ? base + ":" : "";
}
function filterKeyByDepth(key, depth) {
  if (depth === void 0) {
    return true;
  }
  let substrCount = 0;
  let index = key.indexOf(":");
  while (index > -1) {
    substrCount++;
    index = key.indexOf(":", index + 1);
  }
  return substrCount <= depth;
}
function filterKeyByBase(key, base) {
  if (base) {
    return key.startsWith(base) && key[key.length - 1] !== "$";
  }
  return key[key.length - 1] !== "$";
}

function defineDriver$1(factory) {
  return factory;
}

const DRIVER_NAME$1 = "memory";
const memory = defineDriver$1(() => {
  const data = /* @__PURE__ */ new Map();
  return {
    name: DRIVER_NAME$1,
    getInstance: () => data,
    hasItem(key) {
      return data.has(key);
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    getItemRaw(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    setItemRaw(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    getKeys() {
      return [...data.keys()];
    },
    clear() {
      data.clear();
    },
    dispose() {
      data.clear();
    }
  };
});

function createStorage(options = {}) {
  const context = {
    mounts: { "": options.driver || memory() },
    mountpoints: [""],
    watching: false,
    watchListeners: [],
    unwatch: {}
  };
  const getMount = (key) => {
    for (const base of context.mountpoints) {
      if (key.startsWith(base)) {
        return {
          base,
          relativeKey: key.slice(base.length),
          driver: context.mounts[base]
        };
      }
    }
    return {
      base: "",
      relativeKey: key,
      driver: context.mounts[""]
    };
  };
  const getMounts = (base, includeParent) => {
    return context.mountpoints.filter(
      (mountpoint) => mountpoint.startsWith(base) || includeParent && base.startsWith(mountpoint)
    ).map((mountpoint) => ({
      relativeBase: base.length > mountpoint.length ? base.slice(mountpoint.length) : void 0,
      mountpoint,
      driver: context.mounts[mountpoint]
    }));
  };
  const onChange = (event, key) => {
    if (!context.watching) {
      return;
    }
    key = normalizeKey$1(key);
    for (const listener of context.watchListeners) {
      listener(event, key);
    }
  };
  const startWatch = async () => {
    if (context.watching) {
      return;
    }
    context.watching = true;
    for (const mountpoint in context.mounts) {
      context.unwatch[mountpoint] = await watch(
        context.mounts[mountpoint],
        onChange,
        mountpoint
      );
    }
  };
  const stopWatch = async () => {
    if (!context.watching) {
      return;
    }
    for (const mountpoint in context.unwatch) {
      await context.unwatch[mountpoint]();
    }
    context.unwatch = {};
    context.watching = false;
  };
  const runBatch = (items, commonOptions, cb) => {
    const batches = /* @__PURE__ */ new Map();
    const getBatch = (mount) => {
      let batch = batches.get(mount.base);
      if (!batch) {
        batch = {
          driver: mount.driver,
          base: mount.base,
          items: []
        };
        batches.set(mount.base, batch);
      }
      return batch;
    };
    for (const item of items) {
      const isStringItem = typeof item === "string";
      const key = normalizeKey$1(isStringItem ? item : item.key);
      const value = isStringItem ? void 0 : item.value;
      const options2 = isStringItem || !item.options ? commonOptions : { ...commonOptions, ...item.options };
      const mount = getMount(key);
      getBatch(mount).items.push({
        key,
        value,
        relativeKey: mount.relativeKey,
        options: options2
      });
    }
    return Promise.all([...batches.values()].map((batch) => cb(batch))).then(
      (r) => r.flat()
    );
  };
  const storage = {
    // Item
    hasItem(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.hasItem, relativeKey, opts);
    },
    getItem(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => destr(value)
      );
    },
    getItems(items, commonOptions = {}) {
      return runBatch(items, commonOptions, (batch) => {
        if (batch.driver.getItems) {
          return asyncCall(
            batch.driver.getItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              options: item.options
            })),
            commonOptions
          ).then(
            (r) => r.map((item) => ({
              key: joinKeys(batch.base, item.key),
              value: destr(item.value)
            }))
          );
        }
        return Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.getItem,
              item.relativeKey,
              item.options
            ).then((value) => ({
              key: item.key,
              value: destr(value)
            }));
          })
        );
      });
    },
    getItemRaw(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.getItemRaw) {
        return asyncCall(driver.getItemRaw, relativeKey, opts);
      }
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => deserializeRaw(value)
      );
    },
    async setItem(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key);
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.setItem) {
        return;
      }
      await asyncCall(driver.setItem, relativeKey, stringify(value), opts);
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async setItems(items, commonOptions) {
      await runBatch(items, commonOptions, async (batch) => {
        if (batch.driver.setItems) {
          return asyncCall(
            batch.driver.setItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              value: stringify(item.value),
              options: item.options
            })),
            commonOptions
          );
        }
        if (!batch.driver.setItem) {
          return;
        }
        await Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.setItem,
              item.relativeKey,
              stringify(item.value),
              item.options
            );
          })
        );
      });
    },
    async setItemRaw(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key, opts);
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.setItemRaw) {
        await asyncCall(driver.setItemRaw, relativeKey, value, opts);
      } else if (driver.setItem) {
        await asyncCall(driver.setItem, relativeKey, serializeRaw(value), opts);
      } else {
        return;
      }
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async removeItem(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { removeMeta: opts };
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.removeItem) {
        return;
      }
      await asyncCall(driver.removeItem, relativeKey, opts);
      if (opts.removeMeta || opts.removeMata) {
        await asyncCall(driver.removeItem, relativeKey + "$", opts);
      }
      if (!driver.watch) {
        onChange("remove", key);
      }
    },
    // Meta
    async getMeta(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { nativeOnly: opts };
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      const meta = /* @__PURE__ */ Object.create(null);
      if (driver.getMeta) {
        Object.assign(meta, await asyncCall(driver.getMeta, relativeKey, opts));
      }
      if (!opts.nativeOnly) {
        const value = await asyncCall(
          driver.getItem,
          relativeKey + "$",
          opts
        ).then((value_) => destr(value_));
        if (value && typeof value === "object") {
          if (typeof value.atime === "string") {
            value.atime = new Date(value.atime);
          }
          if (typeof value.mtime === "string") {
            value.mtime = new Date(value.mtime);
          }
          Object.assign(meta, value);
        }
      }
      return meta;
    },
    setMeta(key, value, opts = {}) {
      return this.setItem(key + "$", value, opts);
    },
    removeMeta(key, opts = {}) {
      return this.removeItem(key + "$", opts);
    },
    // Keys
    async getKeys(base, opts = {}) {
      base = normalizeBaseKey(base);
      const mounts = getMounts(base, true);
      let maskedMounts = [];
      const allKeys = [];
      let allMountsSupportMaxDepth = true;
      for (const mount of mounts) {
        if (!mount.driver.flags?.maxDepth) {
          allMountsSupportMaxDepth = false;
        }
        const rawKeys = await asyncCall(
          mount.driver.getKeys,
          mount.relativeBase,
          opts
        );
        for (const key of rawKeys) {
          const fullKey = mount.mountpoint + normalizeKey$1(key);
          if (!maskedMounts.some((p) => fullKey.startsWith(p))) {
            allKeys.push(fullKey);
          }
        }
        maskedMounts = [
          mount.mountpoint,
          ...maskedMounts.filter((p) => !p.startsWith(mount.mountpoint))
        ];
      }
      const shouldFilterByDepth = opts.maxDepth !== void 0 && !allMountsSupportMaxDepth;
      return allKeys.filter(
        (key) => (!shouldFilterByDepth || filterKeyByDepth(key, opts.maxDepth)) && filterKeyByBase(key, base)
      );
    },
    // Utils
    async clear(base, opts = {}) {
      base = normalizeBaseKey(base);
      await Promise.all(
        getMounts(base, false).map(async (m) => {
          if (m.driver.clear) {
            return asyncCall(m.driver.clear, m.relativeBase, opts);
          }
          if (m.driver.removeItem) {
            const keys = await m.driver.getKeys(m.relativeBase || "", opts);
            return Promise.all(
              keys.map((key) => m.driver.removeItem(key, opts))
            );
          }
        })
      );
    },
    async dispose() {
      await Promise.all(
        Object.values(context.mounts).map((driver) => dispose(driver))
      );
    },
    async watch(callback) {
      await startWatch();
      context.watchListeners.push(callback);
      return async () => {
        context.watchListeners = context.watchListeners.filter(
          (listener) => listener !== callback
        );
        if (context.watchListeners.length === 0) {
          await stopWatch();
        }
      };
    },
    async unwatch() {
      context.watchListeners = [];
      await stopWatch();
    },
    // Mount
    mount(base, driver) {
      base = normalizeBaseKey(base);
      if (base && context.mounts[base]) {
        throw new Error(`already mounted at ${base}`);
      }
      if (base) {
        context.mountpoints.push(base);
        context.mountpoints.sort((a, b) => b.length - a.length);
      }
      context.mounts[base] = driver;
      if (context.watching) {
        Promise.resolve(watch(driver, onChange, base)).then((unwatcher) => {
          context.unwatch[base] = unwatcher;
        }).catch(console.error);
      }
      return storage;
    },
    async unmount(base, _dispose = true) {
      base = normalizeBaseKey(base);
      if (!base || !context.mounts[base]) {
        return;
      }
      if (context.watching && base in context.unwatch) {
        context.unwatch[base]?.();
        delete context.unwatch[base];
      }
      if (_dispose) {
        await dispose(context.mounts[base]);
      }
      context.mountpoints = context.mountpoints.filter((key) => key !== base);
      delete context.mounts[base];
    },
    getMount(key = "") {
      key = normalizeKey$1(key) + ":";
      const m = getMount(key);
      return {
        driver: m.driver,
        base: m.base
      };
    },
    getMounts(base = "", opts = {}) {
      base = normalizeKey$1(base);
      const mounts = getMounts(base, opts.parents);
      return mounts.map((m) => ({
        driver: m.driver,
        base: m.mountpoint
      }));
    },
    // Aliases
    keys: (base, opts = {}) => storage.getKeys(base, opts),
    get: (key, opts = {}) => storage.getItem(key, opts),
    set: (key, value, opts = {}) => storage.setItem(key, value, opts),
    has: (key, opts = {}) => storage.hasItem(key, opts),
    del: (key, opts = {}) => storage.removeItem(key, opts),
    remove: (key, opts = {}) => storage.removeItem(key, opts)
  };
  return storage;
}
function watch(driver, onChange, base) {
  return driver.watch ? driver.watch((event, key) => onChange(event, base + key)) : () => {
  };
}
async function dispose(driver) {
  if (typeof driver.dispose === "function") {
    await asyncCall(driver.dispose);
  }
}

const _assets = {

};

const normalizeKey = function normalizeKey(key) {
  if (!key) {
    return "";
  }
  return key.split("?")[0]?.replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "") || "";
};

const assets$1 = {
  getKeys() {
    return Promise.resolve(Object.keys(_assets))
  },
  hasItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(id in _assets)
  },
  getItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].import() : null)
  },
  getMeta (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].meta : {})
  }
};

function defineDriver(factory) {
  return factory;
}
function createError$1(driver, message, opts) {
  const err = new Error(`[unstorage] [${driver}] ${message}`, opts);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(err, createError$1);
  }
  return err;
}
function createRequiredError(driver, name) {
  if (Array.isArray(name)) {
    return createError$1(
      driver,
      `Missing some of the required options ${name.map((n) => "`" + n + "`").join(", ")}`
    );
  }
  return createError$1(driver, `Missing required option \`${name}\`.`);
}

function ignoreNotfound(err) {
  return err.code === "ENOENT" || err.code === "EISDIR" ? null : err;
}
function ignoreExists(err) {
  return err.code === "EEXIST" ? null : err;
}
async function writeFile(path, data, encoding) {
  await ensuredir(dirname$1(path));
  return promises.writeFile(path, data, encoding);
}
function readFile(path, encoding) {
  return promises.readFile(path, encoding).catch(ignoreNotfound);
}
function unlink(path) {
  return promises.unlink(path).catch(ignoreNotfound);
}
function readdir(dir) {
  return promises.readdir(dir, { withFileTypes: true }).catch(ignoreNotfound).then((r) => r || []);
}
async function ensuredir(dir) {
  if (existsSync(dir)) {
    return;
  }
  await ensuredir(dirname$1(dir)).catch(ignoreExists);
  await promises.mkdir(dir).catch(ignoreExists);
}
async function readdirRecursive(dir, ignore, maxDepth) {
  if (ignore && ignore(dir)) {
    return [];
  }
  const entries = await readdir(dir);
  const files = [];
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve$1(dir, entry.name);
      if (entry.isDirectory()) {
        if (maxDepth === void 0 || maxDepth > 0) {
          const dirFiles = await readdirRecursive(
            entryPath,
            ignore,
            maxDepth === void 0 ? void 0 : maxDepth - 1
          );
          files.push(...dirFiles.map((f) => entry.name + "/" + f));
        }
      } else {
        if (!(ignore && ignore(entry.name))) {
          files.push(entry.name);
        }
      }
    })
  );
  return files;
}
async function rmRecursive(dir) {
  const entries = await readdir(dir);
  await Promise.all(
    entries.map((entry) => {
      const entryPath = resolve$1(dir, entry.name);
      if (entry.isDirectory()) {
        return rmRecursive(entryPath).then(() => promises.rmdir(entryPath));
      } else {
        return promises.unlink(entryPath);
      }
    })
  );
}

const PATH_TRAVERSE_RE = /\.\.:|\.\.$/;
const DRIVER_NAME = "fs-lite";
const unstorage_47drivers_47fs_45lite = defineDriver((opts = {}) => {
  if (!opts.base) {
    throw createRequiredError(DRIVER_NAME, "base");
  }
  opts.base = resolve$1(opts.base);
  const r = (key) => {
    if (PATH_TRAVERSE_RE.test(key)) {
      throw createError$1(
        DRIVER_NAME,
        `Invalid key: ${JSON.stringify(key)}. It should not contain .. segments`
      );
    }
    const resolved = join(opts.base, key.replace(/:/g, "/"));
    return resolved;
  };
  return {
    name: DRIVER_NAME,
    options: opts,
    flags: {
      maxDepth: true
    },
    hasItem(key) {
      return existsSync(r(key));
    },
    getItem(key) {
      return readFile(r(key), "utf8");
    },
    getItemRaw(key) {
      return readFile(r(key));
    },
    async getMeta(key) {
      const { atime, mtime, size, birthtime, ctime } = await promises.stat(r(key)).catch(() => ({}));
      return { atime, mtime, size, birthtime, ctime };
    },
    setItem(key, value) {
      if (opts.readOnly) {
        return;
      }
      return writeFile(r(key), value, "utf8");
    },
    setItemRaw(key, value) {
      if (opts.readOnly) {
        return;
      }
      return writeFile(r(key), value);
    },
    removeItem(key) {
      if (opts.readOnly) {
        return;
      }
      return unlink(r(key));
    },
    getKeys(_base, topts) {
      return readdirRecursive(r("."), opts.ignore, topts?.maxDepth);
    },
    async clear() {
      if (opts.readOnly || opts.noClear) {
        return;
      }
      await rmRecursive(r("."));
    }
  };
});

const storage = createStorage({});

storage.mount('/assets', assets$1);

storage.mount('data', unstorage_47drivers_47fs_45lite({"driver":"fsLite","base":"./.data/kv"}));

function useStorage(base = "") {
  return base ? prefixStorage(storage, base) : storage;
}

const e=globalThis.process?.getBuiltinModule?.("crypto")?.hash,r="sha256",s="base64url";function digest(t){if(e)return e(r,t,s);const o=createHash(r).update(t);return globalThis.process?.versions?.webcontainer?o.digest().toString(s):o.digest(s)}

const Hasher = /* @__PURE__ */ (() => {
  class Hasher2 {
    buff = "";
    #context = /* @__PURE__ */ new Map();
    write(str) {
      this.buff += str;
    }
    dispatch(value) {
      const type = value === null ? "null" : typeof value;
      return this[type](value);
    }
    object(object) {
      if (object && typeof object.toJSON === "function") {
        return this.object(object.toJSON());
      }
      const objString = Object.prototype.toString.call(object);
      let objType = "";
      const objectLength = objString.length;
      objType = objectLength < 10 ? "unknown:[" + objString + "]" : objString.slice(8, objectLength - 1);
      objType = objType.toLowerCase();
      let objectNumber = null;
      if ((objectNumber = this.#context.get(object)) === void 0) {
        this.#context.set(object, this.#context.size);
      } else {
        return this.dispatch("[CIRCULAR:" + objectNumber + "]");
      }
      if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(object)) {
        this.write("buffer:");
        return this.write(object.toString("utf8"));
      }
      if (objType !== "object" && objType !== "function" && objType !== "asyncfunction") {
        if (this[objType]) {
          this[objType](object);
        } else {
          this.unknown(object, objType);
        }
      } else {
        const keys = Object.keys(object).sort();
        const extraKeys = [];
        this.write("object:" + (keys.length + extraKeys.length) + ":");
        const dispatchForKey = (key) => {
          this.dispatch(key);
          this.write(":");
          this.dispatch(object[key]);
          this.write(",");
        };
        for (const key of keys) {
          dispatchForKey(key);
        }
        for (const key of extraKeys) {
          dispatchForKey(key);
        }
      }
    }
    array(arr, unordered) {
      unordered = unordered === void 0 ? false : unordered;
      this.write("array:" + arr.length + ":");
      if (!unordered || arr.length <= 1) {
        for (const entry of arr) {
          this.dispatch(entry);
        }
        return;
      }
      const contextAdditions = /* @__PURE__ */ new Map();
      const entries = arr.map((entry) => {
        const hasher = new Hasher2();
        hasher.dispatch(entry);
        for (const [key, value] of hasher.#context) {
          contextAdditions.set(key, value);
        }
        return hasher.toString();
      });
      this.#context = contextAdditions;
      entries.sort();
      return this.array(entries, false);
    }
    date(date) {
      return this.write("date:" + date.toJSON());
    }
    symbol(sym) {
      return this.write("symbol:" + sym.toString());
    }
    unknown(value, type) {
      this.write(type);
      if (!value) {
        return;
      }
      this.write(":");
      if (value && typeof value.entries === "function") {
        return this.array(
          [...value.entries()],
          true
          /* ordered */
        );
      }
    }
    error(err) {
      return this.write("error:" + err.toString());
    }
    boolean(bool) {
      return this.write("bool:" + bool);
    }
    string(string) {
      this.write("string:" + string.length + ":");
      this.write(string);
    }
    function(fn) {
      this.write("fn:");
      if (isNativeFunction(fn)) {
        this.dispatch("[native]");
      } else {
        this.dispatch(fn.toString());
      }
    }
    number(number) {
      return this.write("number:" + number);
    }
    null() {
      return this.write("Null");
    }
    undefined() {
      return this.write("Undefined");
    }
    regexp(regex) {
      return this.write("regex:" + regex.toString());
    }
    arraybuffer(arr) {
      this.write("arraybuffer:");
      return this.dispatch(new Uint8Array(arr));
    }
    url(url) {
      return this.write("url:" + url.toString());
    }
    map(map) {
      this.write("map:");
      const arr = [...map];
      return this.array(arr, false);
    }
    set(set) {
      this.write("set:");
      const arr = [...set];
      return this.array(arr, false);
    }
    bigint(number) {
      return this.write("bigint:" + number.toString());
    }
  }
  for (const type of [
    "uint8array",
    "uint8clampedarray",
    "unt8array",
    "uint16array",
    "unt16array",
    "uint32array",
    "unt32array",
    "float32array",
    "float64array"
  ]) {
    Hasher2.prototype[type] = function(arr) {
      this.write(type + ":");
      return this.array([...arr], false);
    };
  }
  function isNativeFunction(f) {
    if (typeof f !== "function") {
      return false;
    }
    return Function.prototype.toString.call(f).slice(
      -15
      /* "[native code] }".length */
    ) === "[native code] }";
  }
  return Hasher2;
})();
function serialize$1(object) {
  const hasher = new Hasher();
  hasher.dispatch(object);
  return hasher.buff;
}
function hash(value) {
  return digest(typeof value === "string" ? value : serialize$1(value)).replace(/[-_]/g, "").slice(0, 10);
}

function defaultCacheOptions() {
  return {
    name: "_",
    base: "/cache",
    swr: true,
    maxAge: 1
  };
}
function defineCachedFunction(fn, opts = {}) {
  opts = { ...defaultCacheOptions(), ...opts };
  const pending = {};
  const group = opts.group || "nitro/functions";
  const name = opts.name || fn.name || "_";
  const integrity = opts.integrity || hash([fn, opts]);
  const validate = opts.validate || ((entry) => entry.value !== void 0);
  async function get(key, resolver, shouldInvalidateCache, event) {
    const cacheKey = [opts.base, group, name, key + ".json"].filter(Boolean).join(":").replace(/:\/$/, ":index");
    let entry = await useStorage().getItem(cacheKey).catch((error) => {
      console.error(`[cache] Cache read error.`, error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }) || {};
    if (typeof entry !== "object") {
      entry = {};
      const error = new Error("Malformed data read from cache.");
      console.error("[cache]", error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }
    const ttl = (opts.maxAge ?? 0) * 1e3;
    if (ttl) {
      entry.expires = Date.now() + ttl;
    }
    const expired = shouldInvalidateCache || entry.integrity !== integrity || ttl && Date.now() - (entry.mtime || 0) > ttl || validate(entry) === false;
    const _resolve = async () => {
      const isPending = pending[key];
      if (!isPending) {
        if (entry.value !== void 0 && (opts.staleMaxAge || 0) >= 0 && opts.swr === false) {
          entry.value = void 0;
          entry.integrity = void 0;
          entry.mtime = void 0;
          entry.expires = void 0;
        }
        pending[key] = Promise.resolve(resolver());
      }
      try {
        entry.value = await pending[key];
      } catch (error) {
        if (!isPending) {
          delete pending[key];
        }
        throw error;
      }
      if (!isPending) {
        entry.mtime = Date.now();
        entry.integrity = integrity;
        delete pending[key];
        if (validate(entry) !== false) {
          let setOpts;
          if (opts.maxAge && !opts.swr) {
            setOpts = { ttl: opts.maxAge };
          }
          const promise = useStorage().setItem(cacheKey, entry, setOpts).catch((error) => {
            console.error(`[cache] Cache write error.`, error);
            useNitroApp().captureError(error, { event, tags: ["cache"] });
          });
          if (event?.waitUntil) {
            event.waitUntil(promise);
          }
        }
      }
    };
    const _resolvePromise = expired ? _resolve() : Promise.resolve();
    if (entry.value === void 0) {
      await _resolvePromise;
    } else if (expired && event && event.waitUntil) {
      event.waitUntil(_resolvePromise);
    }
    if (opts.swr && validate(entry) !== false) {
      _resolvePromise.catch((error) => {
        console.error(`[cache] SWR handler error.`, error);
        useNitroApp().captureError(error, { event, tags: ["cache"] });
      });
      return entry;
    }
    return _resolvePromise.then(() => entry);
  }
  return async (...args) => {
    const shouldBypassCache = await opts.shouldBypassCache?.(...args);
    if (shouldBypassCache) {
      return fn(...args);
    }
    const key = await (opts.getKey || getKey)(...args);
    const shouldInvalidateCache = await opts.shouldInvalidateCache?.(...args);
    const entry = await get(
      key,
      () => fn(...args),
      shouldInvalidateCache,
      args[0] && isEvent(args[0]) ? args[0] : void 0
    );
    let value = entry.value;
    if (opts.transform) {
      value = await opts.transform(entry, ...args) || value;
    }
    return value;
  };
}
function cachedFunction(fn, opts = {}) {
  return defineCachedFunction(fn, opts);
}
function getKey(...args) {
  return args.length > 0 ? hash(args) : "";
}
function escapeKey(key) {
  return String(key).replace(/\W/g, "");
}
function defineCachedEventHandler(handler, opts = defaultCacheOptions()) {
  const variableHeaderNames = (opts.varies || []).filter(Boolean).map((h) => h.toLowerCase()).sort();
  const _opts = {
    ...opts,
    getKey: async (event) => {
      const customKey = await opts.getKey?.(event);
      if (customKey) {
        return escapeKey(customKey);
      }
      const _path = event.node.req.originalUrl || event.node.req.url || event.path;
      let _pathname;
      try {
        _pathname = escapeKey(decodeURI(parseURL(_path).pathname)).slice(0, 16) || "index";
      } catch {
        _pathname = "-";
      }
      const _hashedPath = `${_pathname}.${hash(_path)}`;
      const _headers = variableHeaderNames.map((header) => [header, event.node.req.headers[header]]).map(([name, value]) => `${escapeKey(name)}.${hash(value)}`);
      return [_hashedPath, ..._headers].join(":");
    },
    validate: (entry) => {
      if (!entry.value) {
        return false;
      }
      if (entry.value.code >= 400) {
        return false;
      }
      if (entry.value.body === void 0) {
        return false;
      }
      if (entry.value.headers.etag === "undefined" || entry.value.headers["last-modified"] === "undefined") {
        return false;
      }
      return true;
    },
    group: opts.group || "nitro/handlers",
    integrity: opts.integrity || hash([handler, opts])
  };
  const _cachedHandler = cachedFunction(
    async (incomingEvent) => {
      const variableHeaders = {};
      for (const header of variableHeaderNames) {
        const value = incomingEvent.node.req.headers[header];
        if (value !== void 0) {
          variableHeaders[header] = value;
        }
      }
      const reqProxy = cloneWithProxy(incomingEvent.node.req, {
        headers: variableHeaders
      });
      const resHeaders = {};
      let _resSendBody;
      const resProxy = cloneWithProxy(incomingEvent.node.res, {
        statusCode: 200,
        writableEnded: false,
        writableFinished: false,
        headersSent: false,
        closed: false,
        getHeader(name) {
          return resHeaders[name];
        },
        setHeader(name, value) {
          resHeaders[name] = value;
          return this;
        },
        getHeaderNames() {
          return Object.keys(resHeaders);
        },
        hasHeader(name) {
          return name in resHeaders;
        },
        removeHeader(name) {
          delete resHeaders[name];
        },
        getHeaders() {
          return resHeaders;
        },
        end(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2();
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return this;
        },
        write(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2(void 0);
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return true;
        },
        writeHead(statusCode, headers2) {
          this.statusCode = statusCode;
          if (headers2) {
            if (Array.isArray(headers2) || typeof headers2 === "string") {
              throw new TypeError("Raw headers  is not supported.");
            }
            for (const header in headers2) {
              const value = headers2[header];
              if (value !== void 0) {
                this.setHeader(
                  header,
                  value
                );
              }
            }
          }
          return this;
        }
      });
      const event = createEvent(reqProxy, resProxy);
      event.fetch = (url, fetchOptions) => fetchWithEvent(event, url, fetchOptions, {
        fetch: useNitroApp().localFetch
      });
      event.$fetch = (url, fetchOptions) => fetchWithEvent(event, url, fetchOptions, {
        fetch: globalThis.$fetch
      });
      event.waitUntil = incomingEvent.waitUntil;
      event.context = incomingEvent.context;
      event.context.cache = {
        options: _opts
      };
      const body = await handler(event) || _resSendBody;
      const headers = event.node.res.getHeaders();
      headers.etag = String(
        headers.Etag || headers.etag || `W/"${hash(body)}"`
      );
      headers["last-modified"] = String(
        headers["Last-Modified"] || headers["last-modified"] || (/* @__PURE__ */ new Date()).toUTCString()
      );
      const cacheControl = [];
      if (opts.swr) {
        if (opts.maxAge) {
          cacheControl.push(`s-maxage=${opts.maxAge}`);
        }
        if (opts.staleMaxAge) {
          cacheControl.push(`stale-while-revalidate=${opts.staleMaxAge}`);
        } else {
          cacheControl.push("stale-while-revalidate");
        }
      } else if (opts.maxAge) {
        cacheControl.push(`max-age=${opts.maxAge}`);
      }
      if (cacheControl.length > 0) {
        headers["cache-control"] = cacheControl.join(", ");
      }
      const cacheEntry = {
        code: event.node.res.statusCode,
        headers,
        body
      };
      return cacheEntry;
    },
    _opts
  );
  return defineEventHandler$1(async (event) => {
    if (opts.headersOnly) {
      if (handleCacheHeaders(event, { maxAge: opts.maxAge })) {
        return;
      }
      return handler(event);
    }
    const response = await _cachedHandler(
      event
    );
    if (event.node.res.headersSent || event.node.res.writableEnded) {
      return response.body;
    }
    if (handleCacheHeaders(event, {
      modifiedTime: new Date(response.headers["last-modified"]),
      etag: response.headers.etag,
      maxAge: opts.maxAge
    })) {
      return;
    }
    event.node.res.statusCode = response.code;
    for (const name in response.headers) {
      const value = response.headers[name];
      if (name === "set-cookie") {
        event.node.res.appendHeader(
          name,
          splitCookiesString$1(value)
        );
      } else {
        if (value !== void 0) {
          event.node.res.setHeader(name, value);
        }
      }
    }
    return response.body;
  });
}
function cloneWithProxy(obj, overrides) {
  return new Proxy(obj, {
    get(target, property, receiver) {
      if (property in overrides) {
        return overrides[property];
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property in overrides) {
        overrides[property] = value;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    }
  });
}
const cachedEventHandler = defineCachedEventHandler;

function klona(x) {
	if (typeof x !== 'object') return x;

	var k, tmp, str=Object.prototype.toString.call(x);

	if (str === '[object Object]') {
		if (x.constructor !== Object && typeof x.constructor === 'function') {
			tmp = new x.constructor();
			for (k in x) {
				if (x.hasOwnProperty(k) && tmp[k] !== x[k]) {
					tmp[k] = klona(x[k]);
				}
			}
		} else {
			tmp = {}; // null
			for (k in x) {
				if (k === '__proto__') {
					Object.defineProperty(tmp, k, {
						value: klona(x[k]),
						configurable: true,
						enumerable: true,
						writable: true,
					});
				} else {
					tmp[k] = klona(x[k]);
				}
			}
		}
		return tmp;
	}

	if (str === '[object Array]') {
		k = x.length;
		for (tmp=Array(k); k--;) {
			tmp[k] = klona(x[k]);
		}
		return tmp;
	}

	if (str === '[object Set]') {
		tmp = new Set;
		x.forEach(function (val) {
			tmp.add(klona(val));
		});
		return tmp;
	}

	if (str === '[object Map]') {
		tmp = new Map;
		x.forEach(function (val, key) {
			tmp.set(klona(key), klona(val));
		});
		return tmp;
	}

	if (str === '[object Date]') {
		return new Date(+x);
	}

	if (str === '[object RegExp]') {
		tmp = new RegExp(x.source, x.flags);
		tmp.lastIndex = x.lastIndex;
		return tmp;
	}

	if (str === '[object DataView]') {
		return new x.constructor( klona(x.buffer) );
	}

	if (str === '[object ArrayBuffer]') {
		return x.slice(0);
	}

	// ArrayBuffer.isView(x)
	// ~> `new` bcuz `Buffer.slice` => ref
	if (str.slice(-6) === 'Array]') {
		return new x.constructor(x);
	}

	return x;
}

const inlineAppConfig = {};



const appConfig$1 = defuFn(inlineAppConfig);

const NUMBER_CHAR_RE = /\d/;
const STR_SPLITTERS = ["-", "_", "/", "."];
function isUppercase(char = "") {
  if (NUMBER_CHAR_RE.test(char)) {
    return void 0;
  }
  return char !== char.toLowerCase();
}
function splitByCase(str, separators) {
  const splitters = STR_SPLITTERS;
  const parts = [];
  if (!str || typeof str !== "string") {
    return parts;
  }
  let buff = "";
  let previousUpper;
  let previousSplitter;
  for (const char of str) {
    const isSplitter = splitters.includes(char);
    if (isSplitter === true) {
      parts.push(buff);
      buff = "";
      previousUpper = void 0;
      continue;
    }
    const isUpper = isUppercase(char);
    if (previousSplitter === false) {
      if (previousUpper === false && isUpper === true) {
        parts.push(buff);
        buff = char;
        previousUpper = isUpper;
        continue;
      }
      if (previousUpper === true && isUpper === false && buff.length > 1) {
        const lastChar = buff.at(-1);
        parts.push(buff.slice(0, Math.max(0, buff.length - 1)));
        buff = lastChar + char;
        previousUpper = isUpper;
        continue;
      }
    }
    buff += char;
    previousUpper = isUpper;
    previousSplitter = isSplitter;
  }
  parts.push(buff);
  return parts;
}
function kebabCase(str, joiner) {
  return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => p.toLowerCase()).join(joiner) : "";
}
function snakeCase(str) {
  return kebabCase(str || "", "_");
}

function getEnv(key, opts) {
  const envKey = snakeCase(key).toUpperCase();
  return destr(
    process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey]
  );
}
function _isObject(input) {
  return typeof input === "object" && !Array.isArray(input);
}
function applyEnv(obj, opts, parentKey = "") {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey, opts);
    if (_isObject(obj[key])) {
      if (_isObject(envValue)) {
        obj[key] = { ...obj[key], ...envValue };
        applyEnv(obj[key], opts, subKey);
      } else if (envValue === void 0) {
        applyEnv(obj[key], opts, subKey);
      } else {
        obj[key] = envValue ?? obj[key];
      }
    } else {
      obj[key] = envValue ?? obj[key];
    }
    if (opts.envExpansion && typeof obj[key] === "string") {
      obj[key] = _expandFromEnv(obj[key]);
    }
  }
  return obj;
}
const envExpandRx = /\{\{([^{}]*)\}\}/g;
function _expandFromEnv(value) {
  return value.replace(envExpandRx, (match, key) => {
    return process.env[key] || match;
  });
}

const _inlineRuntimeConfig = {
  "app": {
    "baseURL": "/"
  },
  "nitro": {
    "routeRules": {
      "/_build/assets/**": {
        "headers": {
          "cache-control": "public, immutable, max-age=31536000"
        }
      }
    }
  }
};
const envOptions = {
  prefix: "NITRO_",
  altPrefix: _inlineRuntimeConfig.nitro.envPrefix ?? process.env.NITRO_ENV_PREFIX ?? "_",
  envExpansion: _inlineRuntimeConfig.nitro.envExpansion ?? process.env.NITRO_ENV_EXPANSION ?? false
};
const _sharedRuntimeConfig = _deepFreeze(
  applyEnv(klona(_inlineRuntimeConfig), envOptions)
);
function useRuntimeConfig(event) {
  {
    return _sharedRuntimeConfig;
  }
}
_deepFreeze(klona(appConfig$1));
function _deepFreeze(object) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];
    if (value && typeof value === "object") {
      _deepFreeze(value);
    }
  }
  return Object.freeze(object);
}
new Proxy(/* @__PURE__ */ Object.create(null), {
  get: (_, prop) => {
    console.warn(
      "Please use `useRuntimeConfig()` instead of accessing config directly."
    );
    const runtimeConfig = useRuntimeConfig();
    if (prop in runtimeConfig) {
      return runtimeConfig[prop];
    }
    return void 0;
  }
});

function createContext(opts = {}) {
  let currentInstance;
  let isSingleton = false;
  const checkConflict = (instance) => {
    if (currentInstance && currentInstance !== instance) {
      throw new Error("Context conflict");
    }
  };
  let als;
  if (opts.asyncContext) {
    const _AsyncLocalStorage = opts.AsyncLocalStorage || globalThis.AsyncLocalStorage;
    if (_AsyncLocalStorage) {
      als = new _AsyncLocalStorage();
    } else {
      console.warn("[unctx] `AsyncLocalStorage` is not provided.");
    }
  }
  const _getCurrentInstance = () => {
    if (als) {
      const instance = als.getStore();
      if (instance !== void 0) {
        return instance;
      }
    }
    return currentInstance;
  };
  return {
    use: () => {
      const _instance = _getCurrentInstance();
      if (_instance === void 0) {
        throw new Error("Context is not available");
      }
      return _instance;
    },
    tryUse: () => {
      return _getCurrentInstance();
    },
    set: (instance, replace) => {
      if (!replace) {
        checkConflict(instance);
      }
      currentInstance = instance;
      isSingleton = true;
    },
    unset: () => {
      currentInstance = void 0;
      isSingleton = false;
    },
    call: (instance, callback) => {
      checkConflict(instance);
      currentInstance = instance;
      try {
        return als ? als.run(instance, callback) : callback();
      } finally {
        if (!isSingleton) {
          currentInstance = void 0;
        }
      }
    },
    async callAsync(instance, callback) {
      currentInstance = instance;
      const onRestore = () => {
        currentInstance = instance;
      };
      const onLeave = () => currentInstance === instance ? onRestore : void 0;
      asyncHandlers.add(onLeave);
      try {
        const r = als ? als.run(instance, callback) : callback();
        if (!isSingleton) {
          currentInstance = void 0;
        }
        return await r;
      } finally {
        asyncHandlers.delete(onLeave);
      }
    }
  };
}
function createNamespace(defaultOpts = {}) {
  const contexts = {};
  return {
    get(key, opts = {}) {
      if (!contexts[key]) {
        contexts[key] = createContext({ ...defaultOpts, ...opts });
      }
      return contexts[key];
    }
  };
}
const _globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
const globalKey = "__unctx__";
const defaultNamespace = _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace());
const getContext = (key, opts = {}) => defaultNamespace.get(key, opts);
const asyncHandlersKey = "__unctx_async_handlers__";
const asyncHandlers = _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = /* @__PURE__ */ new Set());

const nitroAsyncContext = getContext("nitro-app", {
  asyncContext: true,
  AsyncLocalStorage: AsyncLocalStorage 
});

const config = useRuntimeConfig();
const _routeRulesMatcher = toRouteMatcher(
  createRouter$1({ routes: config.nitro.routeRules })
);
function createRouteRulesHandler(ctx) {
  return eventHandler$1((event) => {
    const routeRules = getRouteRules(event);
    if (routeRules.headers) {
      setHeaders(event, routeRules.headers);
    }
    if (routeRules.redirect) {
      let target = routeRules.redirect.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.redirect._redirectStripBase;
        if (strpBase) {
          targetPath = withoutBase(targetPath, strpBase);
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery(event.path);
        target = withQuery(target, query);
      }
      return sendRedirect$1(event, target, routeRules.redirect.statusCode);
    }
    if (routeRules.proxy) {
      let target = routeRules.proxy.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.proxy._proxyStripBase;
        if (strpBase) {
          targetPath = withoutBase(targetPath, strpBase);
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery(event.path);
        target = withQuery(target, query);
      }
      return proxyRequest(event, target, {
        fetch: ctx.localFetch,
        ...routeRules.proxy
      });
    }
  });
}
function getRouteRules(event) {
  event.context._nitro = event.context._nitro || {};
  if (!event.context._nitro.routeRules) {
    event.context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(event.path.split("?")[0], useRuntimeConfig().app.baseURL)
    );
  }
  return event.context._nitro.routeRules;
}
function getRouteRulesForPath(path) {
  return defu({}, ..._routeRulesMatcher.matchAll(path).reverse());
}

function joinHeaders(value) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}
function normalizeFetchResponse(response) {
  if (!response.headers.has("set-cookie")) {
    return response;
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: normalizeCookieHeaders(response.headers)
  });
}
function normalizeCookieHeader(header = "") {
  return splitCookiesString$1(joinHeaders(header));
}
function normalizeCookieHeaders(headers) {
  const outgoingHeaders = new Headers();
  for (const [name, header] of headers) {
    if (name === "set-cookie") {
      for (const cookie of normalizeCookieHeader(header)) {
        outgoingHeaders.append("set-cookie", cookie);
      }
    } else {
      outgoingHeaders.set(name, joinHeaders(header));
    }
  }
  return outgoingHeaders;
}

function defineNitroErrorHandler(handler) {
  return handler;
}

const errorHandler$0 = defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const res = defaultHandler(error, event);
    setResponseHeaders(event, res.headers);
    setResponseStatus$1(event, res.status, res.statusText);
    return send$1(event, JSON.stringify(res.body, null, 2));
  }
);
function defaultHandler(error, event, opts) {
  const isSensitive = error.unhandled || error.fatal;
  const statusCode = error.statusCode || 500;
  const statusMessage = error.statusMessage || "Server Error";
  const url = getRequestURL$1(event, { xForwardedHost: true, xForwardedProto: true });
  if (statusCode === 404) {
    const baseURL = "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      const redirectTo = `${baseURL}${url.pathname.slice(1)}${url.search}`;
      return {
        status: 302,
        statusText: "Found",
        headers: { location: redirectTo },
        body: `Redirecting...`
      };
    }
  }
  if (isSensitive && !opts?.silent) {
    const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ");
    console.error(`[request error] ${tags} [${event.method}] ${url}
`, error);
  }
  const headers = {
    "content-type": "application/json",
    // Prevent browser from guessing the MIME types of resources.
    "x-content-type-options": "nosniff",
    // Prevent error page from being embedded in an iframe
    "x-frame-options": "DENY",
    // Prevent browsers from sending the Referer header
    "referrer-policy": "no-referrer",
    // Disable the execution of any js
    "content-security-policy": "script-src 'none'; frame-ancestors 'none';"
  };
  setResponseStatus$1(event, statusCode, statusMessage);
  if (statusCode === 404 || !getResponseHeader$1(event, "cache-control")) {
    headers["cache-control"] = "no-cache";
  }
  const body = {
    error: true,
    url: url.href,
    statusCode,
    statusMessage,
    message: isSensitive ? "Server Error" : error.message,
    data: isSensitive ? void 0 : error.data
  };
  return {
    status: statusCode,
    statusText: statusMessage,
    headers,
    body
  };
}

const errorHandlers = [errorHandler$0];

async function errorHandler(error, event) {
  for (const handler of errorHandlers) {
    try {
      await handler(error, event, { defaultHandler });
      if (event.handled) {
        return; // Response handled
      }
    } catch(error) {
      // Handler itself thrown, log and continue
      console.error(error);
    }
  }
  // H3 will handle fallback
}

const appConfig = {"name":"vinxi","routers":[{"name":"public","type":"static","base":"/","dir":"./public","root":"/home/ametel/source/horizon-starknet/packages/frontend-solid","order":0,"outDir":"/home/ametel/source/horizon-starknet/packages/frontend-solid/.vinxi/build/public"},{"name":"ssr","type":"http","link":{"client":"client"},"handler":"src/entry-server.tsx","extensions":["js","jsx","ts","tsx"],"target":"server","root":"/home/ametel/source/horizon-starknet/packages/frontend-solid","base":"/","outDir":"/home/ametel/source/horizon-starknet/packages/frontend-solid/.vinxi/build/ssr","order":1},{"name":"client","type":"client","base":"/_build","handler":"src/entry-client.tsx","extensions":["js","jsx","ts","tsx"],"target":"browser","root":"/home/ametel/source/horizon-starknet/packages/frontend-solid","outDir":"/home/ametel/source/horizon-starknet/packages/frontend-solid/.vinxi/build/client","order":2},{"name":"server-fns","type":"http","base":"/_server","handler":"node_modules/@solidjs/start/dist/runtime/server-handler.js","target":"server","root":"/home/ametel/source/horizon-starknet/packages/frontend-solid","outDir":"/home/ametel/source/horizon-starknet/packages/frontend-solid/.vinxi/build/server-fns","order":3}],"server":{"compressPublicAssets":{"brotli":true},"routeRules":{"/_build/assets/**":{"headers":{"cache-control":"public, immutable, max-age=31536000"}}},"experimental":{"asyncContext":true},"preset":"bun"},"root":"/home/ametel/source/horizon-starknet/packages/frontend-solid"};
					const buildManifest = {"ssr":{"_AnimatedNumber-MVMTghX7.js":{"file":"assets/AnimatedNumber-MVMTghX7.js","name":"AnimatedNumber","imports":["_Card-DIY1xhm3.js"]},"_Card-DIY1xhm3.js":{"file":"assets/Card-DIY1xhm3.js","name":"Card"},"_QZDH5R5B-BkcYwWOp.js":{"file":"assets/QZDH5R5B-BkcYwWOp.js","name":"QZDH5R5B","imports":["_Card-DIY1xhm3.js"]},"_Select-CvlpjCeG.js":{"file":"assets/Select-CvlpjCeG.js","name":"Select","imports":["_QZDH5R5B-BkcYwWOp.js","_Card-DIY1xhm3.js"]},"_Skeleton-Df4Cx_x0.js":{"file":"assets/Skeleton-Df4Cx_x0.js","name":"Skeleton","imports":["_Card-DIY1xhm3.js"]},"_Tabs-DkcVhKHk.js":{"file":"assets/Tabs-DkcVhKHk.js","name":"Tabs","imports":["_QZDH5R5B-BkcYwWOp.js","_Card-DIY1xhm3.js"]},"_components-D9GQto5d.js":{"file":"assets/components-D9GQto5d.js","name":"components","imports":["_routing-_VU7kOBo.js"]},"_routing-_VU7kOBo.js":{"file":"assets/routing-_VU7kOBo.js","name":"routing"},"_useAccount-DvnSQ5kx.js":{"file":"assets/useAccount-DvnSQ5kx.js","name":"useAccount","imports":["_useStarknet-CfTQugTo.js"]},"_useMarketRates-BiLc0097.js":{"file":"assets/useMarketRates-BiLc0097.js","name":"useMarketRates","imports":["_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js"]},"_useStarknet-CfTQugTo.js":{"file":"assets/useStarknet-CfTQugTo.js","name":"useStarknet"},"src/routes/analytics.tsx?pick=default&pick=$css":{"file":"analytics.js","name":"analytics","src":"src/routes/analytics.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_Skeleton-Df4Cx_x0.js","_AnimatedNumber-MVMTghX7.js","_components-D9GQto5d.js","_routing-_VU7kOBo.js"]},"src/routes/api/rpc.ts?pick=POST":{"file":"rpc.js","name":"rpc","src":"src/routes/api/rpc.ts?pick=POST","isEntry":true,"isDynamicEntry":true},"src/routes/faucet.tsx?pick=default&pick=$css":{"file":"faucet.js","name":"faucet","src":"src/routes/faucet.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useStarknet-CfTQugTo.js","_useAccount-DvnSQ5kx.js","_Card-DIY1xhm3.js"]},"src/routes/index.tsx?pick=default&pick=$css":{"file":"index.js","name":"index","src":"src/routes/index.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_Skeleton-Df4Cx_x0.js","_AnimatedNumber-MVMTghX7.js","_components-D9GQto5d.js","_routing-_VU7kOBo.js"]},"src/routes/mint.tsx?pick=default&pick=$css":{"file":"mint.js","name":"mint","src":"src/routes/mint.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_Skeleton-Df4Cx_x0.js","_Select-CvlpjCeG.js","_routing-_VU7kOBo.js","_QZDH5R5B-BkcYwWOp.js"]},"src/routes/pools.tsx?pick=default&pick=$css":{"file":"pools.js","name":"pools","src":"src/routes/pools.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_Skeleton-Df4Cx_x0.js","_Select-CvlpjCeG.js","_Tabs-DkcVhKHk.js","_routing-_VU7kOBo.js","_QZDH5R5B-BkcYwWOp.js"]},"src/routes/portfolio.tsx?pick=default&pick=$css":{"file":"portfolio.js","name":"portfolio","src":"src/routes/portfolio.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_Skeleton-Df4Cx_x0.js","_Card-DIY1xhm3.js","_Tabs-DkcVhKHk.js","_components-D9GQto5d.js","_QZDH5R5B-BkcYwWOp.js","_routing-_VU7kOBo.js"]},"src/routes/trade.tsx?pick=default&pick=$css":{"file":"trade.js","name":"trade","src":"src/routes/trade.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_AnimatedNumber-MVMTghX7.js","_Select-CvlpjCeG.js","_QZDH5R5B-BkcYwWOp.js","_useAccount-DvnSQ5kx.js","_Skeleton-Df4Cx_x0.js","_routing-_VU7kOBo.js"]},"virtual:$vinxi/handler/ssr":{"file":"ssr.js","name":"ssr","src":"virtual:$vinxi/handler/ssr","isEntry":true,"imports":["_routing-_VU7kOBo.js"],"dynamicImports":["src/routes/analytics.tsx?pick=default&pick=$css","src/routes/analytics.tsx?pick=default&pick=$css","src/routes/api/rpc.ts?pick=POST","src/routes/api/rpc.ts?pick=POST","src/routes/faucet.tsx?pick=default&pick=$css","src/routes/faucet.tsx?pick=default&pick=$css","src/routes/index.tsx?pick=default&pick=$css","src/routes/index.tsx?pick=default&pick=$css","src/routes/mint.tsx?pick=default&pick=$css","src/routes/mint.tsx?pick=default&pick=$css","src/routes/pools.tsx?pick=default&pick=$css","src/routes/pools.tsx?pick=default&pick=$css","src/routes/portfolio.tsx?pick=default&pick=$css","src/routes/portfolio.tsx?pick=default&pick=$css","src/routes/trade.tsx?pick=default&pick=$css","src/routes/trade.tsx?pick=default&pick=$css"],"css":["assets/ssr-CCo7mTVC.css"]}},"client":{"_AnimatedNumber-DOsjBCgV.js":{"file":"assets/AnimatedNumber-DOsjBCgV.js","name":"AnimatedNumber","imports":["_web-Cp7SlEtS.js","_Card-BsHHyVDc.js"]},"_Button-C4r4Bxue.js":{"file":"assets/Button-C4r4Bxue.js","name":"Button","imports":["_web-Cp7SlEtS.js","_UKTBL2JL-BxipwWHR.js","_Card-BsHHyVDc.js"]},"_Card-BsHHyVDc.js":{"file":"assets/Card-BsHHyVDc.js","name":"Card","imports":["_web-Cp7SlEtS.js"]},"_QZDH5R5B-CESpOJLJ.js":{"file":"assets/QZDH5R5B-CESpOJLJ.js","name":"QZDH5R5B","imports":["_web-Cp7SlEtS.js","_UKTBL2JL-BxipwWHR.js"]},"_Select-BZZGaJT2.js":{"file":"assets/Select-BZZGaJT2.js","name":"Select","imports":["_web-Cp7SlEtS.js","_QZDH5R5B-CESpOJLJ.js","_UKTBL2JL-BxipwWHR.js","_Card-BsHHyVDc.js"]},"_Skeleton-C5ntl6fs.js":{"file":"assets/Skeleton-C5ntl6fs.js","name":"Skeleton","imports":["_web-Cp7SlEtS.js","_Card-BsHHyVDc.js"]},"_Tabs-Bx1x2wmT.js":{"file":"assets/Tabs-Bx1x2wmT.js","name":"Tabs","imports":["_web-Cp7SlEtS.js","_QZDH5R5B-CESpOJLJ.js","_UKTBL2JL-BxipwWHR.js","_Card-BsHHyVDc.js","_Button-C4r4Bxue.js"]},"_UKTBL2JL-BxipwWHR.js":{"file":"assets/UKTBL2JL-BxipwWHR.js","name":"UKTBL2JL","imports":["_web-Cp7SlEtS.js"]},"_components-C6uahRJb.js":{"file":"assets/components-C6uahRJb.js","name":"components","imports":["_web-Cp7SlEtS.js","_routing-BSuJdqCI.js"]},"_routing-BSuJdqCI.js":{"file":"assets/routing-BSuJdqCI.js","name":"routing","imports":["_web-Cp7SlEtS.js"]},"_useAccount-BvqtcMl3.js":{"file":"assets/useAccount-BvqtcMl3.js","name":"useAccount","imports":["_web-Cp7SlEtS.js","_useStarknet-cGeIN0U1.js"]},"_useMarketRates-DWopi9e-.js":{"file":"assets/useMarketRates-DWopi9e-.js","name":"useMarketRates","imports":["_useStarknet-cGeIN0U1.js","_web-Cp7SlEtS.js"]},"_useStarknet-cGeIN0U1.js":{"file":"assets/useStarknet-cGeIN0U1.js","name":"useStarknet","imports":["_web-Cp7SlEtS.js"]},"_web-Cp7SlEtS.js":{"file":"assets/web-Cp7SlEtS.js","name":"web"},"src/routes/analytics.tsx?pick=default&pick=$css":{"file":"assets/analytics-qd6PgYg3.js","name":"analytics","src":"src/routes/analytics.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_web-Cp7SlEtS.js","_useMarketRates-DWopi9e-.js","_useStarknet-cGeIN0U1.js","_Card-BsHHyVDc.js","_Skeleton-C5ntl6fs.js","_AnimatedNumber-DOsjBCgV.js","_components-C6uahRJb.js","_routing-BSuJdqCI.js"]},"src/routes/faucet.tsx?pick=default&pick=$css":{"file":"assets/faucet-3OYqo7C1.js","name":"faucet","src":"src/routes/faucet.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_web-Cp7SlEtS.js","_useStarknet-cGeIN0U1.js","_useAccount-BvqtcMl3.js","_Button-C4r4Bxue.js","_Card-BsHHyVDc.js","_UKTBL2JL-BxipwWHR.js"]},"src/routes/index.tsx?pick=default&pick=$css":{"file":"assets/index-DCEe8Zza.js","name":"index","src":"src/routes/index.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_web-Cp7SlEtS.js","_useMarketRates-DWopi9e-.js","_useStarknet-cGeIN0U1.js","_Button-C4r4Bxue.js","_Card-BsHHyVDc.js","_Skeleton-C5ntl6fs.js","_AnimatedNumber-DOsjBCgV.js","_components-C6uahRJb.js","_UKTBL2JL-BxipwWHR.js","_routing-BSuJdqCI.js"]},"src/routes/mint.tsx?pick=default&pick=$css":{"file":"assets/mint-sf87tZif.js","name":"mint","src":"src/routes/mint.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_web-Cp7SlEtS.js","_useMarketRates-DWopi9e-.js","_useStarknet-cGeIN0U1.js","_Card-BsHHyVDc.js","_Skeleton-C5ntl6fs.js","_Select-BZZGaJT2.js","_routing-BSuJdqCI.js","_QZDH5R5B-CESpOJLJ.js","_UKTBL2JL-BxipwWHR.js"]},"src/routes/pools.tsx?pick=default&pick=$css":{"file":"assets/pools-Cy0ALQxQ.js","name":"pools","src":"src/routes/pools.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_web-Cp7SlEtS.js","_useMarketRates-DWopi9e-.js","_useStarknet-cGeIN0U1.js","_Button-C4r4Bxue.js","_Card-BsHHyVDc.js","_Skeleton-C5ntl6fs.js","_Select-BZZGaJT2.js","_Tabs-Bx1x2wmT.js","_routing-BSuJdqCI.js","_UKTBL2JL-BxipwWHR.js","_QZDH5R5B-CESpOJLJ.js"]},"src/routes/portfolio.tsx?pick=default&pick=$css":{"file":"assets/portfolio-DduW7rue.js","name":"portfolio","src":"src/routes/portfolio.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_web-Cp7SlEtS.js","_Skeleton-C5ntl6fs.js","_Button-C4r4Bxue.js","_Card-BsHHyVDc.js","_Tabs-Bx1x2wmT.js","_components-C6uahRJb.js","_UKTBL2JL-BxipwWHR.js","_QZDH5R5B-CESpOJLJ.js","_routing-BSuJdqCI.js"]},"src/routes/trade.tsx?pick=default&pick=$css":{"file":"assets/trade-DjZxkzWB.js","name":"trade","src":"src/routes/trade.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_web-Cp7SlEtS.js","_useMarketRates-DWopi9e-.js","_useStarknet-cGeIN0U1.js","_Card-BsHHyVDc.js","_Button-C4r4Bxue.js","_AnimatedNumber-DOsjBCgV.js","_Select-BZZGaJT2.js","_QZDH5R5B-CESpOJLJ.js","_UKTBL2JL-BxipwWHR.js","_useAccount-BvqtcMl3.js","_Skeleton-C5ntl6fs.js","_routing-BSuJdqCI.js"]},"virtual:$vinxi/handler/client":{"file":"assets/client-C0d1f3lB.js","name":"client","src":"virtual:$vinxi/handler/client","isEntry":true,"imports":["_web-Cp7SlEtS.js","_routing-BSuJdqCI.js"],"dynamicImports":["src/routes/analytics.tsx?pick=default&pick=$css","src/routes/faucet.tsx?pick=default&pick=$css","src/routes/index.tsx?pick=default&pick=$css","src/routes/mint.tsx?pick=default&pick=$css","src/routes/pools.tsx?pick=default&pick=$css","src/routes/portfolio.tsx?pick=default&pick=$css","src/routes/trade.tsx?pick=default&pick=$css"],"css":["assets/client-CCo7mTVC.css"]}},"server-fns":{"_AnimatedNumber-MVMTghX7.js":{"file":"assets/AnimatedNumber-MVMTghX7.js","name":"AnimatedNumber","imports":["_Card-DIY1xhm3.js"]},"_Card-DIY1xhm3.js":{"file":"assets/Card-DIY1xhm3.js","name":"Card"},"_QZDH5R5B-BkcYwWOp.js":{"file":"assets/QZDH5R5B-BkcYwWOp.js","name":"QZDH5R5B","imports":["_Card-DIY1xhm3.js"]},"_Select-CvlpjCeG.js":{"file":"assets/Select-CvlpjCeG.js","name":"Select","imports":["_QZDH5R5B-BkcYwWOp.js","_Card-DIY1xhm3.js"]},"_Skeleton-Df4Cx_x0.js":{"file":"assets/Skeleton-Df4Cx_x0.js","name":"Skeleton","imports":["_Card-DIY1xhm3.js"]},"_Tabs-DkcVhKHk.js":{"file":"assets/Tabs-DkcVhKHk.js","name":"Tabs","imports":["_QZDH5R5B-BkcYwWOp.js","_Card-DIY1xhm3.js"]},"_components-DqrvAkuN.js":{"file":"assets/components-DqrvAkuN.js","name":"components","imports":["_routing-DHl2GUl2.js"]},"_routing-DHl2GUl2.js":{"file":"assets/routing-DHl2GUl2.js","name":"routing"},"_server-fns-BexvJxsF.js":{"file":"assets/server-fns-BexvJxsF.js","name":"server-fns","dynamicImports":["src/routes/analytics.tsx?pick=default&pick=$css","src/routes/analytics.tsx?pick=default&pick=$css","src/routes/api/rpc.ts?pick=POST","src/routes/api/rpc.ts?pick=POST","src/routes/faucet.tsx?pick=default&pick=$css","src/routes/faucet.tsx?pick=default&pick=$css","src/routes/index.tsx?pick=default&pick=$css","src/routes/index.tsx?pick=default&pick=$css","src/routes/mint.tsx?pick=default&pick=$css","src/routes/mint.tsx?pick=default&pick=$css","src/routes/pools.tsx?pick=default&pick=$css","src/routes/pools.tsx?pick=default&pick=$css","src/routes/portfolio.tsx?pick=default&pick=$css","src/routes/portfolio.tsx?pick=default&pick=$css","src/routes/trade.tsx?pick=default&pick=$css","src/routes/trade.tsx?pick=default&pick=$css","src/app.tsx"]},"_useAccount-DvnSQ5kx.js":{"file":"assets/useAccount-DvnSQ5kx.js","name":"useAccount","imports":["_useStarknet-CfTQugTo.js"]},"_useMarketRates-BiLc0097.js":{"file":"assets/useMarketRates-BiLc0097.js","name":"useMarketRates","imports":["_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js"]},"_useStarknet-CfTQugTo.js":{"file":"assets/useStarknet-CfTQugTo.js","name":"useStarknet"},"src/app.tsx":{"file":"assets/app-DWU6Z7KW.js","name":"app","src":"src/app.tsx","isDynamicEntry":true,"imports":["_server-fns-BexvJxsF.js","_routing-DHl2GUl2.js"],"css":["assets/app-CCo7mTVC.css"]},"src/routes/analytics.tsx?pick=default&pick=$css":{"file":"analytics.js","name":"analytics","src":"src/routes/analytics.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_Skeleton-Df4Cx_x0.js","_AnimatedNumber-MVMTghX7.js","_components-DqrvAkuN.js","_routing-DHl2GUl2.js"]},"src/routes/api/rpc.ts?pick=POST":{"file":"rpc.js","name":"rpc","src":"src/routes/api/rpc.ts?pick=POST","isEntry":true,"isDynamicEntry":true},"src/routes/faucet.tsx?pick=default&pick=$css":{"file":"faucet.js","name":"faucet","src":"src/routes/faucet.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useStarknet-CfTQugTo.js","_useAccount-DvnSQ5kx.js","_Card-DIY1xhm3.js"]},"src/routes/index.tsx?pick=default&pick=$css":{"file":"index.js","name":"index","src":"src/routes/index.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_Skeleton-Df4Cx_x0.js","_AnimatedNumber-MVMTghX7.js","_components-DqrvAkuN.js","_routing-DHl2GUl2.js"]},"src/routes/mint.tsx?pick=default&pick=$css":{"file":"mint.js","name":"mint","src":"src/routes/mint.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_Skeleton-Df4Cx_x0.js","_Select-CvlpjCeG.js","_routing-DHl2GUl2.js","_QZDH5R5B-BkcYwWOp.js"]},"src/routes/pools.tsx?pick=default&pick=$css":{"file":"pools.js","name":"pools","src":"src/routes/pools.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_Skeleton-Df4Cx_x0.js","_Select-CvlpjCeG.js","_Tabs-DkcVhKHk.js","_routing-DHl2GUl2.js","_QZDH5R5B-BkcYwWOp.js"]},"src/routes/portfolio.tsx?pick=default&pick=$css":{"file":"portfolio.js","name":"portfolio","src":"src/routes/portfolio.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_Skeleton-Df4Cx_x0.js","_Card-DIY1xhm3.js","_Tabs-DkcVhKHk.js","_components-DqrvAkuN.js","_QZDH5R5B-BkcYwWOp.js","_routing-DHl2GUl2.js"]},"src/routes/trade.tsx?pick=default&pick=$css":{"file":"trade.js","name":"trade","src":"src/routes/trade.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_useMarketRates-BiLc0097.js","_useStarknet-CfTQugTo.js","_Card-DIY1xhm3.js","_AnimatedNumber-MVMTghX7.js","_Select-CvlpjCeG.js","_QZDH5R5B-BkcYwWOp.js","_useAccount-DvnSQ5kx.js","_Skeleton-Df4Cx_x0.js","_routing-DHl2GUl2.js"]},"virtual:$vinxi/handler/server-fns":{"file":"server-fns.js","name":"server-fns","src":"virtual:$vinxi/handler/server-fns","isEntry":true,"imports":["_server-fns-BexvJxsF.js"]}}};

					const routeManifest = {"ssr":{},"client":{},"server-fns":{}};

        function createProdApp(appConfig) {
          return {
            config: { ...appConfig, buildManifest, routeManifest },
            getRouter(name) {
              return appConfig.routers.find(router => router.name === name)
            }
          }
        }

        function plugin$2(app) {
          const prodApp = createProdApp(appConfig);
          globalThis.app = prodApp;
        }

function plugin$1(app) {
	globalThis.$handle = (event) => app.h3App.handler(event);
}

/**
 * Traverses the module graph and collects assets for a given chunk
 *
 * @param {any} manifest Client manifest
 * @param {string} id Chunk id
 * @param {Map<string, string[]>} assetMap Cache of assets
 * @param {string[]} stack Stack of chunk ids to prevent circular dependencies
 * @returns Array of asset URLs
 */
function findAssetsInViteManifest(manifest, id, assetMap = new Map(), stack = []) {
	if (stack.includes(id)) {
		return [];
	}

	const cached = assetMap.get(id);
	if (cached) {
		return cached;
	}
	const chunk = manifest[id];
	if (!chunk) {
		return [];
	}

	const assets = [
		...(chunk.assets?.filter(Boolean) || []),
		...(chunk.css?.filter(Boolean) || [])
	];
	if (chunk.imports) {
		stack.push(id);
		for (let i = 0, l = chunk.imports.length; i < l; i++) {
			assets.push(...findAssetsInViteManifest(manifest, chunk.imports[i], assetMap, stack));
		}
		stack.pop();
	}
	assets.push(chunk.file);
	const all = Array.from(new Set(assets));
	assetMap.set(id, all);

	return all;
}

/** @typedef {import("../app.js").App & { config: { buildManifest: { [key:string]: any } }}} ProdApp */

function createHtmlTagsForAssets(router, app, assets) {
	return assets
		.filter(
			(asset) =>
				asset.endsWith(".css") ||
				asset.endsWith(".js") ||
				asset.endsWith(".mjs"),
		)
		.map((asset) => ({
			tag: "link",
			attrs: {
				href: joinURL(app.config.server.baseURL ?? "/", router.base, asset),
				key: join$1(app.config.server.baseURL ?? "", router.base, asset),
				...(asset.endsWith(".css")
					? { rel: "stylesheet", fetchPriority: "high" }
					: { rel: "modulepreload" }),
			},
		}));
}

/**
 *
 * @param {ProdApp} app
 * @returns
 */
function createProdManifest(app) {
	const manifest = new Proxy(
		{},
		{
			get(target, routerName) {
				invariant(typeof routerName === "string", "Bundler name expected");
				const router = app.getRouter(routerName);
				const bundlerManifest = app.config.buildManifest[routerName];

				invariant(
					router.type !== "static",
					"manifest not available for static router",
				);
				return {
					handler: router.handler,
					async assets() {
						/** @type {{ [key: string]: string[] }} */
						let assets = {};
						assets[router.handler] = await this.inputs[router.handler].assets();
						for (const route of (await router.internals.routes?.getRoutes()) ??
							[]) {
							assets[route.filePath] = await this.inputs[
								route.filePath
							].assets();
						}
						return assets;
					},
					async routes() {
						return (await router.internals.routes?.getRoutes()) ?? [];
					},
					async json() {
						/** @type {{ [key: string]: { output: string; assets: string[]} }} */
						let json = {};
						for (const input of Object.keys(this.inputs)) {
							json[input] = {
								output: this.inputs[input].output.path,
								assets: await this.inputs[input].assets(),
							};
						}
						return json;
					},
					chunks: new Proxy(
						{},
						{
							get(target, chunk) {
								invariant(typeof chunk === "string", "Chunk expected");
								const chunkPath = join$1(
									router.outDir,
									router.base,
									chunk + ".mjs",
								);
								return {
									import() {
										if (globalThis.$$chunks[chunk + ".mjs"]) {
											return globalThis.$$chunks[chunk + ".mjs"];
										}
										return import(
											/* @vite-ignore */ pathToFileURL(chunkPath).href
										);
									},
									output: {
										path: chunkPath,
									},
								};
							},
						},
					),
					inputs: new Proxy(
						{},
						{
							ownKeys(target) {
								const keys = Object.keys(bundlerManifest)
									.filter((id) => bundlerManifest[id].isEntry)
									.map((id) => id);
								return keys;
							},
							getOwnPropertyDescriptor(k) {
								return {
									enumerable: true,
									configurable: true,
								};
							},
							get(target, input) {
								invariant(typeof input === "string", "Input expected");
								if (router.target === "server") {
									const id =
										input === router.handler
											? virtualId(handlerModule(router))
											: input;
									return {
										assets() {
											return createHtmlTagsForAssets(
												router,
												app,
												findAssetsInViteManifest(bundlerManifest, id),
											);
										},
										output: {
											path: join$1(
												router.outDir,
												router.base,
												bundlerManifest[id].file,
											),
										},
									};
								} else if (router.target === "browser") {
									const id =
										input === router.handler && !input.endsWith(".html")
											? virtualId(handlerModule(router))
											: input;
									return {
										import() {
											return import(
												/* @vite-ignore */ joinURL(
													app.config.server.baseURL ?? "",
													router.base,
													bundlerManifest[id].file,
												)
											);
										},
										assets() {
											return createHtmlTagsForAssets(
												router,
												app,
												findAssetsInViteManifest(bundlerManifest, id),
											);
										},
										output: {
											path: joinURL(
												app.config.server.baseURL ?? "",
												router.base,
												bundlerManifest[id].file,
											),
										},
									};
								}
							},
						},
					),
				};
			},
		},
	);

	return manifest;
}

function plugin() {
	globalThis.MANIFEST =
		createProdManifest(globalThis.app)
			;
}

const chunks = {};
			 



			 function app() {
				 globalThis.$$chunks = chunks;
			 }

const plugins = [
  plugin$2,
plugin$1,
plugin,
app
];

const assets = {
  "/_build/.vite/manifest.json": {
    "type": "application/json",
    "encoding": null,
    "etag": "\"1b2a-pyUzJt9HB1wOpXVXFzg7URQpWo0\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 6954,
    "path": "../public/_build/.vite/manifest.json"
  },
  "/assets/ssr-CCo7mTVC.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"48a5-f0ZW0fh84Yss774/GqAhCJJM1xk\"",
    "mtime": "2026-01-12T22:53:19.290Z",
    "size": 18597,
    "path": "../public/assets/ssr-CCo7mTVC.css.gz"
  },
  "/assets/ssr-CCo7mTVC.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"3cec-IZwZUG4EyOyPdzYZjj5USfTe5TM\"",
    "mtime": "2026-01-12T22:53:19.402Z",
    "size": 15596,
    "path": "../public/assets/ssr-CCo7mTVC.css.br"
  },
  "/_build/.vite/manifest.json.br": {
    "type": "application/json",
    "encoding": "br",
    "etag": "\"351-2wHjfPb+fv52+3cMtqcgVDpTrcQ\"",
    "mtime": "2026-01-12T22:53:19.339Z",
    "size": 849,
    "path": "../public/_build/.vite/manifest.json.br"
  },
  "/_build/.vite/manifest.json.gz": {
    "type": "application/json",
    "encoding": "gzip",
    "etag": "\"3b4-PpVXIZ1RGvQiHaqJwvc8ihMArGY\"",
    "mtime": "2026-01-12T22:53:19.320Z",
    "size": 948,
    "path": "../public/_build/.vite/manifest.json.gz"
  },
  "/assets/ssr-CCo7mTVC.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"1dee9-AXH5mr0kXDoHbdgGNsFz51i/Idg\"",
    "mtime": "2026-01-12T22:53:19.247Z",
    "size": 122601,
    "path": "../public/assets/ssr-CCo7mTVC.css"
  },
  "/_server/assets/app-CCo7mTVC.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"3cec-IZwZUG4EyOyPdzYZjj5USfTe5TM\"",
    "mtime": "2026-01-12T22:53:19.604Z",
    "size": 15596,
    "path": "../public/_server/assets/app-CCo7mTVC.css.br"
  },
  "/_build/assets/AnimatedNumber-DOsjBCgV.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"5cd-JOL3TBlf2Hb3euDgC5FmZo3OJ1M\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 1485,
    "path": "../public/_build/assets/AnimatedNumber-DOsjBCgV.js"
  },
  "/_server/assets/app-CCo7mTVC.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"48a5-f0ZW0fh84Yss774/GqAhCJJM1xk\"",
    "mtime": "2026-01-12T22:53:19.528Z",
    "size": 18597,
    "path": "../public/_server/assets/app-CCo7mTVC.css.gz"
  },
  "/_build/assets/AnimatedNumber-DOsjBCgV.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"2db-0y/LuCu8OH0MuubumEkwkekH62E\"",
    "mtime": "2026-01-12T22:53:19.339Z",
    "size": 731,
    "path": "../public/_build/assets/AnimatedNumber-DOsjBCgV.js.br"
  },
  "/_build/assets/AnimatedNumber-DOsjBCgV.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"320-bGO+5bz7kI8pWfD9B2/U0UBrc98\"",
    "mtime": "2026-01-12T22:53:19.339Z",
    "size": 800,
    "path": "../public/_build/assets/AnimatedNumber-DOsjBCgV.js.gz"
  },
  "/_build/assets/Button-C4r4Bxue.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"112d-4k8N4/DuMj61ekYLMXITdzoijv0\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 4397,
    "path": "../public/_build/assets/Button-C4r4Bxue.js"
  },
  "/_build/assets/Button-C4r4Bxue.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"60b-NFxh6jo2xvV+LySYiNuF8tgCiCs\"",
    "mtime": "2026-01-12T22:53:19.339Z",
    "size": 1547,
    "path": "../public/_build/assets/Button-C4r4Bxue.js.br"
  },
  "/_server/assets/app-CCo7mTVC.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"1dee9-AXH5mr0kXDoHbdgGNsFz51i/Idg\"",
    "mtime": "2026-01-12T22:53:19.255Z",
    "size": 122601,
    "path": "../public/_server/assets/app-CCo7mTVC.css"
  },
  "/_build/assets/Button-C4r4Bxue.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"6ce-HcDnhrBRPOMOLff84lMgLqAGdJ8\"",
    "mtime": "2026-01-12T22:53:19.339Z",
    "size": 1742,
    "path": "../public/_build/assets/Button-C4r4Bxue.js.gz"
  },
  "/_build/assets/Card-BsHHyVDc.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"6ba6-ceDB05snYGYvh9Z/V4KeR4Id/MA\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 27558,
    "path": "../public/_build/assets/Card-BsHHyVDc.js"
  },
  "/_build/assets/Card-BsHHyVDc.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"1e5c-BjeJMpudCaDQHMvD0H6VA4x9FMI\"",
    "mtime": "2026-01-12T22:53:19.356Z",
    "size": 7772,
    "path": "../public/_build/assets/Card-BsHHyVDc.js.br"
  },
  "/_build/assets/Card-BsHHyVDc.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"2290-CDO9IeRkOESxw0wRUW6wFCyx5ew\"",
    "mtime": "2026-01-12T22:53:19.339Z",
    "size": 8848,
    "path": "../public/_build/assets/Card-BsHHyVDc.js.gz"
  },
  "/_build/assets/QZDH5R5B-CESpOJLJ.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"43cf-YgNHt396UB26/7AY1Q9uUe4ufNc\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 17359,
    "path": "../public/_build/assets/QZDH5R5B-CESpOJLJ.js"
  },
  "/_build/assets/QZDH5R5B-CESpOJLJ.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"144b-fmOuj89IG614KCZ3DQSPMG6E9Wo\"",
    "mtime": "2026-01-12T22:53:19.339Z",
    "size": 5195,
    "path": "../public/_build/assets/QZDH5R5B-CESpOJLJ.js.br"
  },
  "/_build/assets/QZDH5R5B-CESpOJLJ.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"1645-QfBsIqNN9eUwm+wkL1rjJHB1lbc\"",
    "mtime": "2026-01-12T22:53:19.339Z",
    "size": 5701,
    "path": "../public/_build/assets/QZDH5R5B-CESpOJLJ.js.gz"
  },
  "/_build/assets/Select-BZZGaJT2.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"fbbb-PrGAZzWz0+lqy1ynpI2/W3uTiKU\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 64443,
    "path": "../public/_build/assets/Select-BZZGaJT2.js"
  },
  "/_build/assets/Select-BZZGaJT2.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"4cb1-XN1CL0y3YaurDaDoaeuzo393Zr0\"",
    "mtime": "2026-01-12T22:53:19.403Z",
    "size": 19633,
    "path": "../public/_build/assets/Select-BZZGaJT2.js.br"
  },
  "/_build/assets/Select-BZZGaJT2.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"55cd-pACE3g9P1qlWQTfD3vhSkhk/TOk\"",
    "mtime": "2026-01-12T22:53:19.356Z",
    "size": 21965,
    "path": "../public/_build/assets/Select-BZZGaJT2.js.gz"
  },
  "/_build/assets/Skeleton-C5ntl6fs.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"26a-WyE5GQsi04SdH+lzGiW0fw4jiNs\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 618,
    "path": "../public/_build/assets/Skeleton-C5ntl6fs.js"
  },
  "/_build/assets/Tabs-Bx1x2wmT.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"3297-vsk29mX634wMN6xwl/HMbUcLoLk\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 12951,
    "path": "../public/_build/assets/Tabs-Bx1x2wmT.js"
  },
  "/_build/assets/Tabs-Bx1x2wmT.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"fe9-UGg67yY4B09hBiHm9GVkWNiD2oE\"",
    "mtime": "2026-01-12T22:53:19.356Z",
    "size": 4073,
    "path": "../public/_build/assets/Tabs-Bx1x2wmT.js.br"
  },
  "/_build/assets/UKTBL2JL-BxipwWHR.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"1e35-/zPp5XB4agsUwE4RCK0LyjuNHeQ\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 7733,
    "path": "../public/_build/assets/UKTBL2JL-BxipwWHR.js"
  },
  "/_build/assets/Tabs-Bx1x2wmT.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"1175-zARIPVm99zjUoYQeuuq7d2MaXgc\"",
    "mtime": "2026-01-12T22:53:19.356Z",
    "size": 4469,
    "path": "../public/_build/assets/Tabs-Bx1x2wmT.js.gz"
  },
  "/_build/assets/UKTBL2JL-BxipwWHR.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"b63-EXkkeX4Eg+04zws2ZS+UFK+ULao\"",
    "mtime": "2026-01-12T22:53:19.386Z",
    "size": 2915,
    "path": "../public/_build/assets/UKTBL2JL-BxipwWHR.js.br"
  },
  "/_build/assets/UKTBL2JL-BxipwWHR.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"cf0-D17hluiBgrAxKKKn3ya2MqyP+6A\"",
    "mtime": "2026-01-12T22:53:19.386Z",
    "size": 3312,
    "path": "../public/_build/assets/UKTBL2JL-BxipwWHR.js.gz"
  },
  "/_build/assets/analytics-qd6PgYg3.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"26fa-s1A8gVLIzGSfOsidiu8ry8k4VvA\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 9978,
    "path": "../public/_build/assets/analytics-qd6PgYg3.js"
  },
  "/_build/assets/analytics-qd6PgYg3.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"a6d-Btp9RDnhDqBY8YHmR2Sxj37pbps\"",
    "mtime": "2026-01-12T22:53:19.386Z",
    "size": 2669,
    "path": "../public/_build/assets/analytics-qd6PgYg3.js.br"
  },
  "/_build/assets/analytics-qd6PgYg3.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"bb5-uA6yaf9t66hBfmgbqsau74jbkD4\"",
    "mtime": "2026-01-12T22:53:19.386Z",
    "size": 2997,
    "path": "../public/_build/assets/analytics-qd6PgYg3.js.gz"
  },
  "/_build/assets/client-C0d1f3lB.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"4b6b-vQZFSRkI7/G3KEdC58T9N8aY+Ik\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 19307,
    "path": "../public/_build/assets/client-C0d1f3lB.js"
  },
  "/_build/assets/client-C0d1f3lB.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"19dc-rxYLuRPFeI4bs1JSwFzHxqNP4lU\"",
    "mtime": "2026-01-12T22:53:19.386Z",
    "size": 6620,
    "path": "../public/_build/assets/client-C0d1f3lB.js.br"
  },
  "/_build/assets/client-C0d1f3lB.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"1cb0-ErYH9mkZAjSXw5Hti77HsvmYzCQ\"",
    "mtime": "2026-01-12T22:53:19.386Z",
    "size": 7344,
    "path": "../public/_build/assets/client-C0d1f3lB.js.gz"
  },
  "/_build/assets/client-CCo7mTVC.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"3cec-IZwZUG4EyOyPdzYZjj5USfTe5TM\"",
    "mtime": "2026-01-12T22:53:19.494Z",
    "size": 15596,
    "path": "../public/_build/assets/client-CCo7mTVC.css.br"
  },
  "/_build/assets/client-CCo7mTVC.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"1dee9-AXH5mr0kXDoHbdgGNsFz51i/Idg\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 122601,
    "path": "../public/_build/assets/client-CCo7mTVC.css"
  },
  "/_build/assets/components-C6uahRJb.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"343-Q+WUZHDLr8F3g2BkDgkAZZ2tfzo\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 835,
    "path": "../public/_build/assets/components-C6uahRJb.js"
  },
  "/_build/assets/client-CCo7mTVC.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"48a5-f0ZW0fh84Yss774/GqAhCJJM1xk\"",
    "mtime": "2026-01-12T22:53:19.387Z",
    "size": 18597,
    "path": "../public/_build/assets/client-CCo7mTVC.css.gz"
  },
  "/_build/assets/faucet-3OYqo7C1.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"1c33-MIrmgOOp7cJ1wuO3w4gpjmSA0HY\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 7219,
    "path": "../public/_build/assets/faucet-3OYqo7C1.js"
  },
  "/_build/assets/faucet-3OYqo7C1.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"9a0-5Vr+oLiOWFDfQ2rltWIEJWYQEYk\"",
    "mtime": "2026-01-12T22:53:19.402Z",
    "size": 2464,
    "path": "../public/_build/assets/faucet-3OYqo7C1.js.br"
  },
  "/_build/assets/faucet-3OYqo7C1.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"b0e-HK9WFfsvsiQjavByUHuEEH67ssg\"",
    "mtime": "2026-01-12T22:53:19.402Z",
    "size": 2830,
    "path": "../public/_build/assets/faucet-3OYqo7C1.js.gz"
  },
  "/_build/assets/index-DCEe8Zza.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"32d6-IZZcNTmjfNoPkfox+AYAmM1syMg\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 13014,
    "path": "../public/_build/assets/index-DCEe8Zza.js"
  },
  "/_build/assets/index-DCEe8Zza.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"f2d-BLbFnihJITJB/3EcZnwiVE+piTw\"",
    "mtime": "2026-01-12T22:53:19.409Z",
    "size": 3885,
    "path": "../public/_build/assets/index-DCEe8Zza.js.br"
  },
  "/_build/assets/index-DCEe8Zza.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"1161-TPnklPvhznz5XPAnLwJ9tC+Mj/o\"",
    "mtime": "2026-01-12T22:53:19.402Z",
    "size": 4449,
    "path": "../public/_build/assets/index-DCEe8Zza.js.gz"
  },
  "/_build/assets/mint-sf87tZif.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"2641-5JkVbmAKga+OLviv/5IJxflp0l8\"",
    "mtime": "2026-01-12T22:53:19.252Z",
    "size": 9793,
    "path": "../public/_build/assets/mint-sf87tZif.js"
  },
  "/_build/assets/mint-sf87tZif.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"af6-ywQPnHFEVBRphTEr9KCogc1yVsk\"",
    "mtime": "2026-01-12T22:53:19.410Z",
    "size": 2806,
    "path": "../public/_build/assets/mint-sf87tZif.js.br"
  },
  "/_build/assets/mint-sf87tZif.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"c59-iEN7dE/7dN9TGpnXzd8eLq/nHzY\"",
    "mtime": "2026-01-12T22:53:19.402Z",
    "size": 3161,
    "path": "../public/_build/assets/mint-sf87tZif.js.gz"
  },
  "/_build/assets/pools-Cy0ALQxQ.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"3859-MS9ASN3r4vmbMuMUr8C6lE2mpnM\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 14425,
    "path": "../public/_build/assets/pools-Cy0ALQxQ.js"
  },
  "/_build/assets/pools-Cy0ALQxQ.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"d38-2fyH7CJdAAKgJ0S06o2eMFDKWUQ\"",
    "mtime": "2026-01-12T22:53:19.457Z",
    "size": 3384,
    "path": "../public/_build/assets/pools-Cy0ALQxQ.js.br"
  },
  "/_build/assets/pools-Cy0ALQxQ.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"ef2-UYPqYtxc0BOi6Z2/n1ExhEQcwTI\"",
    "mtime": "2026-01-12T22:53:19.410Z",
    "size": 3826,
    "path": "../public/_build/assets/pools-Cy0ALQxQ.js.gz"
  },
  "/_build/assets/portfolio-DduW7rue.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"1dc9-7X2EIngbkpF89b2OzFRKy4wjzhQ\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 7625,
    "path": "../public/_build/assets/portfolio-DduW7rue.js"
  },
  "/_build/assets/portfolio-DduW7rue.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"84d-mkqcF7H+GsJuhTsxHeguh1DfsNc\"",
    "mtime": "2026-01-12T22:53:19.410Z",
    "size": 2125,
    "path": "../public/_build/assets/portfolio-DduW7rue.js.br"
  },
  "/_build/assets/portfolio-DduW7rue.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"945-QiyYFzYtgld1CUji1vNdIEi/VBM\"",
    "mtime": "2026-01-12T22:53:19.410Z",
    "size": 2373,
    "path": "../public/_build/assets/portfolio-DduW7rue.js.gz"
  },
  "/_build/assets/routing-BSuJdqCI.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"1eb0-28oGxcEY1LxLmDYjffuM/ASDL4c\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 7856,
    "path": "../public/_build/assets/routing-BSuJdqCI.js"
  },
  "/_build/assets/routing-BSuJdqCI.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"d0c-oPfkadmj7+aaXAbo2fn+2tRGvK8\"",
    "mtime": "2026-01-12T22:53:19.410Z",
    "size": 3340,
    "path": "../public/_build/assets/routing-BSuJdqCI.js.br"
  },
  "/_build/assets/routing-BSuJdqCI.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"e4a-Z0P68ZjI1JT/S2tELtkmMcuIlTE\"",
    "mtime": "2026-01-12T22:53:19.410Z",
    "size": 3658,
    "path": "../public/_build/assets/routing-BSuJdqCI.js.gz"
  },
  "/_build/assets/trade-DjZxkzWB.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"d982-V1YdBI7io2xLsRJqvcKRACJtnPQ\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 55682,
    "path": "../public/_build/assets/trade-DjZxkzWB.js"
  },
  "/_build/assets/trade-DjZxkzWB.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"3627-rm5LAlRUy2j2VaDjfbztpzbWMT4\"",
    "mtime": "2026-01-12T22:53:19.457Z",
    "size": 13863,
    "path": "../public/_build/assets/trade-DjZxkzWB.js.br"
  },
  "/_build/assets/useAccount-BvqtcMl3.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1ed-X/5Kq6et9mWfcgAVVmb1iAX84iY\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 493,
    "path": "../public/_build/assets/useAccount-BvqtcMl3.js"
  },
  "/_build/assets/trade-DjZxkzWB.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"3dc6-rRqlMMq/Hza7AvGaHdKpIvkfanE\"",
    "mtime": "2026-01-12T22:53:19.410Z",
    "size": 15814,
    "path": "../public/_build/assets/trade-DjZxkzWB.js.gz"
  },
  "/_build/assets/useMarketRates-DWopi9e-.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"380a-jpcb8DpoX6KMvrYxKUzZrGSxSsY\"",
    "mtime": "2026-01-12T22:53:19.501Z",
    "size": 14346,
    "path": "../public/_build/assets/useMarketRates-DWopi9e-.js.br"
  },
  "/_build/assets/useMarketRates-DWopi9e-.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"4209-JppEWaa7faaKTkRnDi1A93oMyPA\"",
    "mtime": "2026-01-12T22:53:19.480Z",
    "size": 16905,
    "path": "../public/_build/assets/useMarketRates-DWopi9e-.js.gz"
  },
  "/_build/assets/useMarketRates-DWopi9e-.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"1bc09-eB3A6qINckSNP1dHGZIZpAzkgi8\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 113673,
    "path": "../public/_build/assets/useMarketRates-DWopi9e-.js"
  },
  "/_build/assets/web-Cp7SlEtS.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"7263-H2lsAKgSKDdRXr9MCwprbRmDbU4\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 29283,
    "path": "../public/_build/assets/web-Cp7SlEtS.js"
  },
  "/_build/assets/web-Cp7SlEtS.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"2837-OPIV/gGnY5WLMCK3RD/vXQhHqio\"",
    "mtime": "2026-01-12T22:53:19.495Z",
    "size": 10295,
    "path": "../public/_build/assets/web-Cp7SlEtS.js.br"
  },
  "/_build/assets/web-Cp7SlEtS.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"2c33-vUcyTyV7V6nROOm+Z7sixVvlIiU\"",
    "mtime": "2026-01-12T22:53:19.494Z",
    "size": 11315,
    "path": "../public/_build/assets/web-Cp7SlEtS.js.gz"
  },
  "/_build/assets/useStarknet-cGeIN0U1.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"23790-76onj6OoqR45Qqih5hkHVw2wNn0\"",
    "mtime": "2026-01-12T22:53:19.501Z",
    "size": 145296,
    "path": "../public/_build/assets/useStarknet-cGeIN0U1.js.gz"
  },
  "/_build/assets/useStarknet-cGeIN0U1.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"1dd16-nLI/ubx6z/+UcgohkFWee4QJtFU\"",
    "mtime": "2026-01-12T22:53:19.939Z",
    "size": 122134,
    "path": "../public/_build/assets/useStarknet-cGeIN0U1.js.br"
  },
  "/_build/assets/useStarknet-cGeIN0U1.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"770af-M9Z7HwRhKGg4qZERc/s5SlBO20M\"",
    "mtime": "2026-01-12T22:53:19.253Z",
    "size": 487599,
    "path": "../public/_build/assets/useStarknet-cGeIN0U1.js"
  }
};

const _DRIVE_LETTER_START_RE = /^[A-Za-z]:\//;
function normalizeWindowsPath(input = "") {
  if (!input) {
    return input;
  }
  return input.replace(/\\/g, "/").replace(_DRIVE_LETTER_START_RE, (r) => r.toUpperCase());
}
const _IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/;
const _DRIVE_LETTER_RE = /^[A-Za-z]:$/;
function cwd() {
  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    return process.cwd().replace(/\\/g, "/");
  }
  return "/";
}
const resolve = function(...arguments_) {
  arguments_ = arguments_.map((argument) => normalizeWindowsPath(argument));
  let resolvedPath = "";
  let resolvedAbsolute = false;
  for (let index = arguments_.length - 1; index >= -1 && !resolvedAbsolute; index--) {
    const path = index >= 0 ? arguments_[index] : cwd();
    if (!path || path.length === 0) {
      continue;
    }
    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = isAbsolute(path);
  }
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);
  if (resolvedAbsolute && !isAbsolute(resolvedPath)) {
    return `/${resolvedPath}`;
  }
  return resolvedPath.length > 0 ? resolvedPath : ".";
};
function normalizeString(path, allowAboveRoot) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let char = null;
  for (let index = 0; index <= path.length; ++index) {
    if (index < path.length) {
      char = path[index];
    } else if (char === "/") {
      break;
    } else {
      char = "/";
    }
    if (char === "/") {
      if (lastSlash === index - 1 || dots === 1) ; else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res[res.length - 1] !== "." || res[res.length - 2] !== ".") {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
            }
            lastSlash = index;
            dots = 0;
            continue;
          } else if (res.length > 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = index;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) {
          res += `/${path.slice(lastSlash + 1, index)}`;
        } else {
          res = path.slice(lastSlash + 1, index);
        }
        lastSegmentLength = index - lastSlash - 1;
      }
      lastSlash = index;
      dots = 0;
    } else if (char === "." && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}
const isAbsolute = function(p) {
  return _IS_ABSOLUTE_RE.test(p);
};
const dirname = function(p) {
  const segments = normalizeWindowsPath(p).replace(/\/$/, "").split("/").slice(0, -1);
  if (segments.length === 1 && _DRIVE_LETTER_RE.test(segments[0])) {
    segments[0] += "/";
  }
  return segments.join("/") || (isAbsolute(p) ? "/" : ".");
};

function readAsset (id) {
  const serverDir = dirname(fileURLToPath(globalThis._importMeta_.url));
  return promises.readFile(resolve(serverDir, assets[id].path))
}

const publicAssetBases = {};

function isPublicAssetURL(id = '') {
  if (assets[id]) {
    return true
  }
  for (const base in publicAssetBases) {
    if (id.startsWith(base)) { return true }
  }
  return false
}

function getAsset (id) {
  return assets[id]
}

const METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
const EncodingMap = { gzip: ".gz", br: ".br" };
const _5h9zpK = eventHandler$1((event) => {
  if (event.method && !METHODS.has(event.method)) {
    return;
  }
  let id = decodePath(
    withLeadingSlash(withoutTrailingSlash(parseURL(event.path).pathname))
  );
  let asset;
  const encodingHeader = String(
    getRequestHeader$1(event, "accept-encoding") || ""
  );
  const encodings = [
    ...encodingHeader.split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(),
    ""
  ];
  for (const encoding of encodings) {
    for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
      const _asset = getAsset(_id);
      if (_asset) {
        asset = _asset;
        id = _id;
        break;
      }
    }
  }
  if (!asset) {
    if (isPublicAssetURL(id)) {
      removeResponseHeader$1(event, "Cache-Control");
      throw createError$2({ statusCode: 404 });
    }
    return;
  }
  if (asset.encoding !== void 0) {
    appendResponseHeader$1(event, "Vary", "Accept-Encoding");
  }
  const ifNotMatch = getRequestHeader$1(event, "if-none-match") === asset.etag;
  if (ifNotMatch) {
    setResponseStatus$1(event, 304, "Not Modified");
    return "";
  }
  const ifModifiedSinceH = getRequestHeader$1(event, "if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
    setResponseStatus$1(event, 304, "Not Modified");
    return "";
  }
  if (asset.type && !getResponseHeader$1(event, "Content-Type")) {
    setResponseHeader$1(event, "Content-Type", asset.type);
  }
  if (asset.etag && !getResponseHeader$1(event, "ETag")) {
    setResponseHeader$1(event, "ETag", asset.etag);
  }
  if (asset.mtime && !getResponseHeader$1(event, "Last-Modified")) {
    setResponseHeader$1(event, "Last-Modified", mtimeDate.toUTCString());
  }
  if (asset.encoding && !getResponseHeader$1(event, "Content-Encoding")) {
    setResponseHeader$1(event, "Content-Encoding", asset.encoding);
  }
  if (asset.size > 0 && !getResponseHeader$1(event, "Content-Length")) {
    setResponseHeader$1(event, "Content-Length", asset.size);
  }
  return readAsset(id);
});

function parseSetCookie$1(setCookieValue, options) {
  const parts = (setCookieValue || "").split(";").filter((str) => typeof str === "string" && !!str.trim());
  const nameValuePairStr = parts.shift() || "";
  const parsed = _parseNameValuePair$1(nameValuePairStr);
  const name = parsed.name;
  let value = parsed.value;
  try {
    value = options?.decode === false ? value : (options?.decode || decodeURIComponent)(value);
  } catch {
  }
  const cookie = {
    name,
    value
  };
  for (const part of parts) {
    const sides = part.split("=");
    const partKey = (sides.shift() || "").trimStart().toLowerCase();
    const partValue = sides.join("=");
    switch (partKey) {
      case "expires": {
        cookie.expires = new Date(partValue);
        break;
      }
      case "max-age": {
        cookie.maxAge = Number.parseInt(partValue, 10);
        break;
      }
      case "secure": {
        cookie.secure = true;
        break;
      }
      case "httponly": {
        cookie.httpOnly = true;
        break;
      }
      case "samesite": {
        cookie.sameSite = partValue;
        break;
      }
      default: {
        cookie[partKey] = partValue;
      }
    }
  }
  return cookie;
}
function _parseNameValuePair$1(nameValuePairStr) {
  let name = "";
  let value = "";
  const nameValueArr = nameValuePairStr.split("=");
  if (nameValueArr.length > 1) {
    name = nameValueArr.shift();
    value = nameValueArr.join("=");
  } else {
    value = nameValuePairStr;
  }
  return { name, value };
}

function parse(str, options) {
  if (typeof str !== "string") {
    throw new TypeError("argument str must be a string");
  }
  const obj = {};
  const opt = {};
  const dec = opt.decode || decode;
  let index = 0;
  while (index < str.length) {
    const eqIdx = str.indexOf("=", index);
    if (eqIdx === -1) {
      break;
    }
    let endIdx = str.indexOf(";", index);
    if (endIdx === -1) {
      endIdx = str.length;
    } else if (endIdx < eqIdx) {
      index = str.lastIndexOf(";", eqIdx - 1) + 1;
      continue;
    }
    const key = str.slice(index, eqIdx).trim();
    if (opt?.filter && !opt?.filter(key)) {
      index = endIdx + 1;
      continue;
    }
    if (void 0 === obj[key]) {
      let val = str.slice(eqIdx + 1, endIdx).trim();
      if (val.codePointAt(0) === 34) {
        val = val.slice(1, -1);
      }
      obj[key] = tryDecode(val, dec);
    }
    index = endIdx + 1;
  }
  return obj;
}
function decode(str) {
  return str.includes("%") ? decodeURIComponent(str) : str;
}
function tryDecode(str, decode2) {
  try {
    return decode2(str);
  } catch {
    return str;
  }
}

const fieldContentRegExp = /^[\u0009\u0020-\u007E\u0080-\u00FF]+$/;
function serialize(name, value, options) {
  const opt = options || {};
  const enc = opt.encode || encodeURIComponent;
  if (typeof enc !== "function") {
    throw new TypeError("option encode is invalid");
  }
  if (!fieldContentRegExp.test(name)) {
    throw new TypeError("argument name is invalid");
  }
  const encodedValue = enc(value);
  if (encodedValue && !fieldContentRegExp.test(encodedValue)) {
    throw new TypeError("argument val is invalid");
  }
  let str = name + "=" + encodedValue;
  if (void 0 !== opt.maxAge && opt.maxAge !== null) {
    const maxAge = opt.maxAge - 0;
    if (Number.isNaN(maxAge) || !Number.isFinite(maxAge)) {
      throw new TypeError("option maxAge is invalid");
    }
    str += "; Max-Age=" + Math.floor(maxAge);
  }
  if (opt.domain) {
    if (!fieldContentRegExp.test(opt.domain)) {
      throw new TypeError("option domain is invalid");
    }
    str += "; Domain=" + opt.domain;
  }
  if (opt.path) {
    if (!fieldContentRegExp.test(opt.path)) {
      throw new TypeError("option path is invalid");
    }
    str += "; Path=" + opt.path;
  }
  if (opt.expires) {
    if (!isDate(opt.expires) || Number.isNaN(opt.expires.valueOf())) {
      throw new TypeError("option expires is invalid");
    }
    str += "; Expires=" + opt.expires.toUTCString();
  }
  if (opt.httpOnly) {
    str += "; HttpOnly";
  }
  if (opt.secure) {
    str += "; Secure";
  }
  if (opt.priority) {
    const priority = typeof opt.priority === "string" ? opt.priority.toLowerCase() : opt.priority;
    switch (priority) {
      case "low": {
        str += "; Priority=Low";
        break;
      }
      case "medium": {
        str += "; Priority=Medium";
        break;
      }
      case "high": {
        str += "; Priority=High";
        break;
      }
      default: {
        throw new TypeError("option priority is invalid");
      }
    }
  }
  if (opt.sameSite) {
    const sameSite = typeof opt.sameSite === "string" ? opt.sameSite.toLowerCase() : opt.sameSite;
    switch (sameSite) {
      case true: {
        str += "; SameSite=Strict";
        break;
      }
      case "lax": {
        str += "; SameSite=Lax";
        break;
      }
      case "strict": {
        str += "; SameSite=Strict";
        break;
      }
      case "none": {
        str += "; SameSite=None";
        break;
      }
      default: {
        throw new TypeError("option sameSite is invalid");
      }
    }
  }
  if (opt.partitioned) {
    str += "; Partitioned";
  }
  return str;
}
function isDate(val) {
  return Object.prototype.toString.call(val) === "[object Date]" || val instanceof Date;
}

function parseSetCookie(setCookieValue, options) {
  const parts = (setCookieValue || "").split(";").filter((str) => typeof str === "string" && !!str.trim());
  const nameValuePairStr = parts.shift() || "";
  const parsed = _parseNameValuePair(nameValuePairStr);
  const name = parsed.name;
  let value = parsed.value;
  try {
    value = options?.decode === false ? value : (options?.decode || decodeURIComponent)(value);
  } catch {
  }
  const cookie = {
    name,
    value
  };
  for (const part of parts) {
    const sides = part.split("=");
    const partKey = (sides.shift() || "").trimStart().toLowerCase();
    const partValue = sides.join("=");
    switch (partKey) {
      case "expires": {
        cookie.expires = new Date(partValue);
        break;
      }
      case "max-age": {
        cookie.maxAge = Number.parseInt(partValue, 10);
        break;
      }
      case "secure": {
        cookie.secure = true;
        break;
      }
      case "httponly": {
        cookie.httpOnly = true;
        break;
      }
      case "samesite": {
        cookie.sameSite = partValue;
        break;
      }
      default: {
        cookie[partKey] = partValue;
      }
    }
  }
  return cookie;
}
function _parseNameValuePair(nameValuePairStr) {
  let name = "";
  let value = "";
  const nameValueArr = nameValuePairStr.split("=");
  if (nameValueArr.length > 1) {
    name = nameValueArr.shift();
    value = nameValueArr.join("=");
  } else {
    value = nameValuePairStr;
  }
  return { name, value };
}

function hasProp(obj, prop) {
  try {
    return prop in obj;
  } catch {
    return false;
  }
}

class H3Error extends Error {
  static __h3_error__ = true;
  statusCode = 500;
  fatal = false;
  unhandled = false;
  statusMessage;
  data;
  cause;
  constructor(message, opts = {}) {
    super(message, opts);
    if (opts.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
  toJSON() {
    const obj = {
      message: this.message,
      statusCode: sanitizeStatusCode(this.statusCode, 500)
    };
    if (this.statusMessage) {
      obj.statusMessage = sanitizeStatusMessage(this.statusMessage);
    }
    if (this.data !== void 0) {
      obj.data = this.data;
    }
    return obj;
  }
}
function createError(input) {
  if (typeof input === "string") {
    return new H3Error(input);
  }
  if (isError(input)) {
    return input;
  }
  const err = new H3Error(input.message ?? input.statusMessage ?? "", {
    cause: input.cause || input
  });
  if (hasProp(input, "stack")) {
    try {
      Object.defineProperty(err, "stack", {
        get() {
          return input.stack;
        }
      });
    } catch {
      try {
        err.stack = input.stack;
      } catch {
      }
    }
  }
  if (input.data) {
    err.data = input.data;
  }
  if (input.statusCode) {
    err.statusCode = sanitizeStatusCode(input.statusCode, err.statusCode);
  } else if (input.status) {
    err.statusCode = sanitizeStatusCode(input.status, err.statusCode);
  }
  if (input.statusMessage) {
    err.statusMessage = input.statusMessage;
  } else if (input.statusText) {
    err.statusMessage = input.statusText;
  }
  if (err.statusMessage) {
    const originalMessage = err.statusMessage;
    const sanitizedMessage = sanitizeStatusMessage(err.statusMessage);
    if (sanitizedMessage !== originalMessage) {
      console.warn(
        "[h3] Please prefer using `message` for longer error messages instead of `statusMessage`. In the future, `statusMessage` will be sanitized by default."
      );
    }
  }
  if (input.fatal !== void 0) {
    err.fatal = input.fatal;
  }
  if (input.unhandled !== void 0) {
    err.unhandled = input.unhandled;
  }
  return err;
}
function isError(input) {
  return input?.constructor?.__h3_error__ === true;
}
function isMethod(event, expected, allowHead) {
  if (typeof expected === "string") {
    if (event.method === expected) {
      return true;
    }
  } else if (expected.includes(event.method)) {
    return true;
  }
  return false;
}
function assertMethod(event, expected, allowHead) {
  if (!isMethod(event, expected)) {
    throw createError({
      statusCode: 405,
      statusMessage: "HTTP method is not allowed."
    });
  }
}
function getRequestHeaders(event) {
  const _headers = {};
  for (const key in event.node.req.headers) {
    const val = event.node.req.headers[key];
    _headers[key] = Array.isArray(val) ? val.filter(Boolean).join(", ") : val;
  }
  return _headers;
}
function getRequestHeader(event, name) {
  const headers = getRequestHeaders(event);
  const value = headers[name.toLowerCase()];
  return value;
}
function getRequestHost(event, opts = {}) {
  if (opts.xForwardedHost) {
    const xForwardedHost = event.node.req.headers["x-forwarded-host"];
    if (xForwardedHost) {
      return xForwardedHost;
    }
  }
  return event.node.req.headers.host || "localhost";
}
function getRequestProtocol(event, opts = {}) {
  if (opts.xForwardedProto !== false && event.node.req.headers["x-forwarded-proto"] === "https") {
    return "https";
  }
  return event.node.req.connection?.encrypted ? "https" : "http";
}
function getRequestURL(event, opts = {}) {
  const host = getRequestHost(event, opts);
  const protocol = getRequestProtocol(event, opts);
  const path = (event.node.req.originalUrl || event.path).replace(
    /^[/\\]+/g,
    "/"
  );
  return new URL(path, `${protocol}://${host}`);
}
function getRequestIP(event, opts = {}) {
  if (event.context.clientAddress) {
    return event.context.clientAddress;
  }
  if (opts.xForwardedFor) {
    const xForwardedFor = getRequestHeader(event, "x-forwarded-for")?.split(",").shift()?.trim();
    if (xForwardedFor) {
      return xForwardedFor;
    }
  }
  if (event.node.req.socket.remoteAddress) {
    return event.node.req.socket.remoteAddress;
  }
}

const RawBodySymbol = Symbol.for("h3RawBody");
const PayloadMethods$1 = ["PATCH", "POST", "PUT", "DELETE"];
function readRawBody(event, encoding = "utf8") {
  assertMethod(event, PayloadMethods$1);
  const _rawBody = event._requestBody || event.web?.request?.body || event.node.req[RawBodySymbol] || event.node.req.rawBody || event.node.req.body;
  if (_rawBody) {
    const promise2 = Promise.resolve(_rawBody).then((_resolved) => {
      if (Buffer.isBuffer(_resolved)) {
        return _resolved;
      }
      if (typeof _resolved.pipeTo === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.pipeTo(
            new WritableStream({
              write(chunk) {
                chunks.push(chunk);
              },
              close() {
                resolve(Buffer.concat(chunks));
              },
              abort(reason) {
                reject(reason);
              }
            })
          ).catch(reject);
        });
      } else if (typeof _resolved.pipe === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.on("data", (chunk) => {
            chunks.push(chunk);
          }).on("end", () => {
            resolve(Buffer.concat(chunks));
          }).on("error", reject);
        });
      }
      if (_resolved.constructor === Object) {
        return Buffer.from(JSON.stringify(_resolved));
      }
      if (_resolved instanceof URLSearchParams) {
        return Buffer.from(_resolved.toString());
      }
      if (_resolved instanceof FormData) {
        return new Response(_resolved).bytes().then((uint8arr) => Buffer.from(uint8arr));
      }
      return Buffer.from(_resolved);
    });
    return encoding ? promise2.then((buff) => buff.toString(encoding)) : promise2;
  }
  if (!Number.parseInt(event.node.req.headers["content-length"] || "") && !String(event.node.req.headers["transfer-encoding"] ?? "").split(",").map((e) => e.trim()).filter(Boolean).includes("chunked")) {
    return Promise.resolve(void 0);
  }
  const promise = event.node.req[RawBodySymbol] = new Promise(
    (resolve, reject) => {
      const bodyData = [];
      event.node.req.on("error", (err) => {
        reject(err);
      }).on("data", (chunk) => {
        bodyData.push(chunk);
      }).on("end", () => {
        resolve(Buffer.concat(bodyData));
      });
    }
  );
  const result = encoding ? promise.then((buff) => buff.toString(encoding)) : promise;
  return result;
}
function getRequestWebStream(event) {
  if (!PayloadMethods$1.includes(event.method)) {
    return;
  }
  const bodyStream = event.web?.request?.body || event._requestBody;
  if (bodyStream) {
    return bodyStream;
  }
  const _hasRawBody = RawBodySymbol in event.node.req || "rawBody" in event.node.req || "body" in event.node.req || "__unenv__" in event.node.req;
  if (_hasRawBody) {
    return new ReadableStream({
      async start(controller) {
        const _rawBody = await readRawBody(event, false);
        if (_rawBody) {
          controller.enqueue(_rawBody);
        }
        controller.close();
      }
    });
  }
  return new ReadableStream({
    start: (controller) => {
      event.node.req.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      event.node.req.on("end", () => {
        controller.close();
      });
      event.node.req.on("error", (err) => {
        controller.error(err);
      });
    }
  });
}

const MIMES = {
  html: "text/html"};

const DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
  return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
  if (!statusCode) {
    return defaultStatusCode;
  }
  if (typeof statusCode === "string") {
    statusCode = Number.parseInt(statusCode, 10);
  }
  if (statusCode < 100 || statusCode > 999) {
    return defaultStatusCode;
  }
  return statusCode;
}

function getDistinctCookieKey(name, opts) {
  return [name, opts.domain || "", opts.path || "/"].join(";");
}

function parseCookies(event) {
  return parse(event.node.req.headers.cookie || "");
}
function getCookie(event, name) {
  return parseCookies(event)[name];
}
function setCookie(event, name, value, serializeOptions = {}) {
  if (!serializeOptions.path) {
    serializeOptions = { path: "/", ...serializeOptions };
  }
  const newCookie = serialize(name, value, serializeOptions);
  const currentCookies = splitCookiesString(
    event.node.res.getHeader("set-cookie")
  );
  if (currentCookies.length === 0) {
    event.node.res.setHeader("set-cookie", newCookie);
    return;
  }
  const newCookieKey = getDistinctCookieKey(name, serializeOptions);
  event.node.res.removeHeader("set-cookie");
  for (const cookie of currentCookies) {
    const parsed = parseSetCookie(cookie);
    const key = getDistinctCookieKey(parsed.name, parsed);
    if (key === newCookieKey) {
      continue;
    }
    event.node.res.appendHeader("set-cookie", cookie);
  }
  event.node.res.appendHeader("set-cookie", newCookie);
}
function splitCookiesString(cookiesString) {
  if (Array.isArray(cookiesString)) {
    return cookiesString.flatMap((c) => splitCookiesString(c));
  }
  if (typeof cookiesString !== "string") {
    return [];
  }
  const cookiesStrings = [];
  let pos = 0;
  let start;
  let ch;
  let lastComma;
  let nextStart;
  let cookiesSeparatorFound;
  const skipWhitespace = () => {
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
      pos += 1;
    }
    return pos < cookiesString.length;
  };
  const notSpecialChar = () => {
    ch = cookiesString.charAt(pos);
    return ch !== "=" && ch !== ";" && ch !== ",";
  };
  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;
    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        lastComma = pos;
        pos += 1;
        skipWhitespace();
        nextStart = pos;
        while (pos < cookiesString.length && notSpecialChar()) {
          pos += 1;
        }
        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          cookiesSeparatorFound = true;
          pos = nextStart;
          cookiesStrings.push(cookiesString.slice(start, lastComma));
          start = pos;
        } else {
          pos = lastComma + 1;
        }
      } else {
        pos += 1;
      }
    }
    if (!cookiesSeparatorFound || pos >= cookiesString.length) {
      cookiesStrings.push(cookiesString.slice(start));
    }
  }
  return cookiesStrings;
}

const defer = typeof setImmediate === "undefined" ? (fn) => fn() : setImmediate;
function send(event, data, type) {
  {
    defaultContentType(event, type);
  }
  return new Promise((resolve) => {
    defer(() => {
      if (!event.handled) {
        event.node.res.end(data);
      }
      resolve();
    });
  });
}
function setResponseStatus(event, code, text) {
  if (code) {
    event.node.res.statusCode = sanitizeStatusCode(
      code,
      event.node.res.statusCode
    );
  }
  if (text) {
    event.node.res.statusMessage = sanitizeStatusMessage(text);
  }
}
function getResponseStatus(event) {
  return event.node.res.statusCode;
}
function getResponseStatusText(event) {
  return event.node.res.statusMessage;
}
function defaultContentType(event, type) {
  if (event.node.res.statusCode !== 304 && !event.node.res.getHeader("content-type")) {
    event.node.res.setHeader("content-type", type);
  }
}
function sendRedirect(event, location, code = 302) {
  event.node.res.statusCode = sanitizeStatusCode(
    code,
    event.node.res.statusCode
  );
  event.node.res.setHeader("location", location);
  const encodedLoc = location.replace(/"/g, "%22");
  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`;
  return send(event, html, MIMES.html);
}
function getResponseHeaders(event) {
  return event.node.res.getHeaders();
}
function getResponseHeader(event, name) {
  return event.node.res.getHeader(name);
}
function setResponseHeader(event, name, value) {
  event.node.res.setHeader(name, value);
}
const setHeader = setResponseHeader;
function appendResponseHeader(event, name, value) {
  let current = event.node.res.getHeader(name);
  if (!current) {
    event.node.res.setHeader(name, value);
    return;
  }
  if (!Array.isArray(current)) {
    current = [current.toString()];
  }
  event.node.res.setHeader(name, [...current, value]);
}
function removeResponseHeader(event, name) {
  return event.node.res.removeHeader(name);
}
function sendStream(event, stream) {
  if (!stream || typeof stream !== "object") {
    throw new Error("[h3] Invalid stream provided.");
  }
  event.node.res._data = stream;
  if (!event.node.res.socket) {
    event._handled = true;
    return Promise.resolve();
  }
  if (hasProp(stream, "pipeTo") && typeof stream.pipeTo === "function") {
    return stream.pipeTo(
      new WritableStream({
        write(chunk) {
          event.node.res.write(chunk);
        }
      })
    ).then(() => {
      event.node.res.end();
    });
  }
  if (hasProp(stream, "pipe") && typeof stream.pipe === "function") {
    return new Promise((resolve, reject) => {
      stream.pipe(event.node.res);
      if (stream.on) {
        stream.on("end", () => {
          event.node.res.end();
          resolve();
        });
        stream.on("error", (error) => {
          reject(error);
        });
      }
      event.node.res.on("close", () => {
        if (stream.abort) {
          stream.abort();
        }
      });
    });
  }
  throw new Error("[h3] Invalid or incompatible stream provided.");
}
function sendWebResponse(event, response) {
  for (const [key, value] of response.headers) {
    if (key === "set-cookie") {
      event.node.res.appendHeader(key, splitCookiesString(value));
    } else {
      event.node.res.setHeader(key, value);
    }
  }
  if (response.status) {
    event.node.res.statusCode = sanitizeStatusCode(
      response.status,
      event.node.res.statusCode
    );
  }
  if (response.statusText) {
    event.node.res.statusMessage = sanitizeStatusMessage(response.statusText);
  }
  if (response.redirected) {
    event.node.res.setHeader("location", response.url);
  }
  if (!response.body) {
    event.node.res.end();
    return;
  }
  return sendStream(event, response.body);
}

class H3Event {
  "__is_event__" = true;
  // Context
  node;
  // Node
  web;
  // Web
  context = {};
  // Shared
  // Request
  _method;
  _path;
  _headers;
  _requestBody;
  // Response
  _handled = false;
  // Hooks
  _onBeforeResponseCalled;
  _onAfterResponseCalled;
  constructor(req, res) {
    this.node = { req, res };
  }
  // --- Request ---
  get method() {
    if (!this._method) {
      this._method = (this.node.req.method || "GET").toUpperCase();
    }
    return this._method;
  }
  get path() {
    return this._path || this.node.req.url || "/";
  }
  get headers() {
    if (!this._headers) {
      this._headers = _normalizeNodeHeaders(this.node.req.headers);
    }
    return this._headers;
  }
  // --- Respoonse ---
  get handled() {
    return this._handled || this.node.res.writableEnded || this.node.res.headersSent;
  }
  respondWith(response) {
    return Promise.resolve(response).then(
      (_response) => sendWebResponse(this, _response)
    );
  }
  // --- Utils ---
  toString() {
    return `[${this.method}] ${this.path}`;
  }
  toJSON() {
    return this.toString();
  }
  // --- Deprecated ---
  /** @deprecated Please use `event.node.req` instead. */
  get req() {
    return this.node.req;
  }
  /** @deprecated Please use `event.node.res` instead. */
  get res() {
    return this.node.res;
  }
}
function _normalizeNodeHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

function defineEventHandler(handler) {
  if (typeof handler === "function") {
    handler.__is_handler__ = true;
    return handler;
  }
  const _hooks = {
    onRequest: _normalizeArray(handler.onRequest),
    onBeforeResponse: _normalizeArray(handler.onBeforeResponse)
  };
  const _handler = (event) => {
    return _callHandler(event, handler.handler, _hooks);
  };
  _handler.__is_handler__ = true;
  _handler.__resolve__ = handler.handler.__resolve__;
  _handler.__websocket__ = handler.websocket;
  return _handler;
}
function _normalizeArray(input) {
  return input ? Array.isArray(input) ? input : [input] : void 0;
}
async function _callHandler(event, handler, hooks) {
  if (hooks.onRequest) {
    for (const hook of hooks.onRequest) {
      await hook(event);
      if (event.handled) {
        return;
      }
    }
  }
  const body = await handler(event);
  const response = { body };
  if (hooks.onBeforeResponse) {
    for (const hook of hooks.onBeforeResponse) {
      await hook(event, response);
    }
  }
  return response.body;
}
const eventHandler = defineEventHandler;

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
function Ce$1(e) {
  let r;
  const t = G$1(e), n = { duplex: "half", method: e.method, headers: e.headers };
  return e.node.req.body instanceof ArrayBuffer ? new Request(t, { ...n, body: e.node.req.body }) : new Request(t, { ...n, get body() {
    return r || (r = ze$1(e), r);
  } });
}
function Ae$1(e) {
  var _a;
  return (_a = e.web) != null ? _a : e.web = { request: Ce$1(e), url: G$1(e) }, e.web.request;
}
function Fe$1() {
  return De$1();
}
const J$1 = /* @__PURE__ */ Symbol("$HTTPEvent");
function Le$1(e) {
  return typeof e == "object" && (e instanceof H3Event || (e == null ? void 0 : e[J$1]) instanceof H3Event || (e == null ? void 0 : e.__is_event__) === true);
}
function u(e) {
  return function(...r) {
    var _a;
    let t = r[0];
    if (Le$1(t)) r[0] = t instanceof H3Event || t.__is_event__ ? t : t[J$1];
    else {
      if (!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext)) throw new Error("AsyncLocalStorage was not enabled. Use the `server.experimental.asyncContext: true` option in your app configuration to enable it. Or, pass the instance of HTTPEvent that you have as the first argument to the function.");
      if (t = Fe$1(), !t) throw new Error("No HTTPEvent found in AsyncLocalStorage. Make sure you are using the function within the server runtime.");
      r.unshift(t);
    }
    return e(...r);
  };
}
const G$1 = u(getRequestURL), Oe$1 = u(getRequestIP), S = u(setResponseStatus), _ = u(getResponseStatus), Ie$1 = u(getResponseStatusText), y$1 = u(getResponseHeaders), j$1 = u(getResponseHeader), Ue$1 = u(setResponseHeader), K$1 = u(appendResponseHeader), _e$1 = u(parseCookies), je$1 = u(getCookie), Me$1 = u(setCookie), R$1 = u(setHeader), ze$1 = u(getRequestWebStream), We$1 = u(removeResponseHeader), Ne = u(Ae$1);
function Be$1() {
  var _a;
  return getContext("nitro-app", { asyncContext: !!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext), AsyncLocalStorage: AsyncLocalStorage });
}
function De$1() {
  return Be$1().use().event;
}
const k$1 = "Invariant Violation", { setPrototypeOf: Xe = function(e, r) {
  return e.__proto__ = r, e;
} } = Object;
let L$1 = class L extends Error {
  constructor(r = k$1) {
    super(typeof r == "number" ? `${k$1}: ${r} (see https://github.com/apollographql/invariant-packages)` : r);
    __publicField$1(this, "framesToPop", 1);
    __publicField$1(this, "name", k$1);
    Xe(this, L.prototype);
  }
};
function Je(e, r) {
  if (!e) throw new L$1(r);
}
const $$1 = "solidFetchEvent";
function Ge(e) {
  return { request: Ne(e), response: Ye(e), clientAddress: Oe$1(e), locals: {}, nativeEvent: e };
}
function Ke$1(e) {
  return { ...e };
}
function Ve(e) {
  if (!e.context[$$1]) {
    const r = Ge(e);
    e.context[$$1] = r;
  }
  return e.context[$$1];
}
function M$2(e, r) {
  for (const [t, n] of r.entries()) K$1(e, t, n);
}
class Qe {
  constructor(r) {
    __publicField$1(this, "event");
    this.event = r;
  }
  get(r) {
    const t = j$1(this.event, r);
    return Array.isArray(t) ? t.join(", ") : t || null;
  }
  has(r) {
    return this.get(r) !== null;
  }
  set(r, t) {
    return Ue$1(this.event, r, t);
  }
  delete(r) {
    return We$1(this.event, r);
  }
  append(r, t) {
    K$1(this.event, r, t);
  }
  getSetCookie() {
    const r = j$1(this.event, "Set-Cookie");
    return Array.isArray(r) ? r : [r];
  }
  forEach(r) {
    return Object.entries(y$1(this.event)).forEach(([t, n]) => r(Array.isArray(n) ? n.join(", ") : n, t, this));
  }
  entries() {
    return Object.entries(y$1(this.event)).map(([r, t]) => [r, Array.isArray(t) ? t.join(", ") : t])[Symbol.iterator]();
  }
  keys() {
    return Object.keys(y$1(this.event))[Symbol.iterator]();
  }
  values() {
    return Object.values(y$1(this.event)).map((r) => Array.isArray(r) ? r.join(", ") : r)[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
}
function Ye(e) {
  return { get status() {
    return _(e);
  }, set status(r) {
    S(e, r);
  }, get statusText() {
    return Ie$1(e);
  }, set statusText(r) {
    S(e, _(e), r);
  }, headers: new Qe(e) };
}
const V$1 = [{ page: true, $component: { src: "src/routes/analytics.tsx?pick=default&pick=$css", build: () => import('./chunks/build/analytics.mjs'), import: () => import('./chunks/build/analytics.mjs') }, path: "/analytics", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/analytics.tsx" }, { page: false, $POST: { src: "src/routes/api/rpc.ts?pick=POST", build: () => import('./chunks/build/rpc.mjs'), import: () => import('./chunks/build/rpc.mjs') }, path: "/api/rpc", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/api/rpc.ts" }, { page: true, $component: { src: "src/routes/faucet.tsx?pick=default&pick=$css", build: () => import('./chunks/build/faucet.mjs'), import: () => import('./chunks/build/faucet.mjs') }, path: "/faucet", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/faucet.tsx" }, { page: true, $component: { src: "src/routes/index.tsx?pick=default&pick=$css", build: () => import('./chunks/build/index.mjs'), import: () => import('./chunks/build/index.mjs') }, path: "/", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/index.tsx" }, { page: true, $component: { src: "src/routes/mint.tsx?pick=default&pick=$css", build: () => import('./chunks/build/mint.mjs'), import: () => import('./chunks/build/mint.mjs') }, path: "/mint", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/mint.tsx" }, { page: true, $component: { src: "src/routes/pools.tsx?pick=default&pick=$css", build: () => import('./chunks/build/pools.mjs'), import: () => import('./chunks/build/pools.mjs') }, path: "/pools", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/pools.tsx" }, { page: true, $component: { src: "src/routes/portfolio.tsx?pick=default&pick=$css", build: () => import('./chunks/build/portfolio.mjs'), import: () => import('./chunks/build/portfolio.mjs') }, path: "/portfolio", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/portfolio.tsx" }, { page: true, $component: { src: "src/routes/trade.tsx?pick=default&pick=$css", build: () => import('./chunks/build/trade.mjs'), import: () => import('./chunks/build/trade.mjs') }, path: "/trade", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/trade.tsx" }], Ze = et(V$1.filter((e) => e.page));
function et(e) {
  function r(t, n, o, a) {
    const i = Object.values(t).find((c) => o.startsWith(c.id + "/"));
    return i ? (r(i.children || (i.children = []), n, o.slice(i.id.length)), t) : (t.push({ ...n, id: o, path: o.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/") }), t);
  }
  return e.sort((t, n) => t.path.length - n.path.length).reduce((t, n) => r(t, n, n.path, n.path), []);
}
function tt(e) {
  return e.$HEAD || e.$GET || e.$POST || e.$PUT || e.$PATCH || e.$DELETE;
}
createRouter$1({ routes: V$1.reduce((e, r) => {
  if (!tt(r)) return e;
  let t = r.path.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/").replace(/\*([^/]*)/g, (n, o) => `**:${o}`).split("/").map((n) => n.startsWith(":") || n.startsWith("*") ? n : encodeURIComponent(n)).join("/");
  if (/:[^/]*\?/g.test(t)) throw new Error(`Optional parameters are not supported in API routes: ${t}`);
  if (e[t]) throw new Error(`Duplicate API routes for "${t}" found at "${e[t].route.path}" and "${r.path}"`);
  return e[t] = { route: r }, e;
}, {}) });
var st = " ";
const nt = { style: (e) => ssrElement("style", e.attrs, () => e.children, true), link: (e) => ssrElement("link", e.attrs, void 0, true), script: (e) => e.attrs.src ? ssrElement("script", mergeProps(() => e.attrs, { get id() {
  return e.key;
} }), () => ssr(st), true) : null, noscript: (e) => ssrElement("noscript", e.attrs, () => escape(e.children), true) };
function ot(e, r) {
  let { tag: t, attrs: { key: n, ...o } = { key: void 0 }, children: a } = e;
  return nt[t]({ attrs: { ...o, nonce: r }, key: n, children: a });
}
function at(e, r, t, n = "default") {
  return lazy(async () => {
    var _a;
    {
      const a = (await e.import())[n], c = (await ((_a = r.inputs) == null ? void 0 : _a[e.src].assets())).filter((p) => p.tag === "style" || p.attrs.rel === "stylesheet");
      return { default: (p) => [...c.map((h) => ot(h)), createComponent(a, p)] };
    }
  });
}
function Q$1() {
  function e(t) {
    return { ...t, ...t.$$route ? t.$$route.require().route : void 0, info: { ...t.$$route ? t.$$route.require().route.info : {}, filesystem: true }, component: t.$component && at(t.$component, globalThis.MANIFEST.client, globalThis.MANIFEST.ssr), children: t.children ? t.children.map(e) : void 0 };
  }
  return Ze.map(e);
}
let z;
const xt$1 = isServer ? () => getRequestEvent().routes : () => z || (z = Q$1());
function it(e) {
  const r = je$1(e.nativeEvent, "flash");
  if (r) try {
    let t = JSON.parse(r);
    if (!t || !t.result) return;
    const n = [...t.input.slice(0, -1), new Map(t.input[t.input.length - 1])], o = t.error ? new Error(t.result) : t.result;
    return { input: n, url: t.url, pending: false, result: t.thrown ? void 0 : o, error: t.thrown ? o : void 0 };
  } catch (t) {
    console.error(t);
  } finally {
    Me$1(e.nativeEvent, "flash", "", { maxAge: 0 });
  }
}
async function ct(e) {
  const r = globalThis.MANIFEST.client;
  return globalThis.MANIFEST.ssr, e.response.headers.set("Content-Type", "text/html"), Object.assign(e, { manifest: await r.json(), assets: [...await r.inputs[r.handler].assets()], router: { submission: it(e) }, routes: Q$1(), complete: false, $islands: /* @__PURE__ */ new Set() });
}
const ut = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function lt$1(e) {
  return e.status && ut.has(e.status) ? e.status : 302;
}
const pt$1 = {};
function dt$1(e) {
  const r = new TextEncoder().encode(e), t = r.length, n = t.toString(16), o = "00000000".substring(0, 8 - n.length) + n, a = new TextEncoder().encode(`;0x${o};`), i = new Uint8Array(12 + t);
  return i.set(a), i.set(r, 12), i;
}
function W$1(e, r) {
  return new ReadableStream({ start(t) {
    crossSerializeStream(r, { scopeId: e, plugins: [CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin], onSerialize(n, o) {
      t.enqueue(dt$1(o ? `(${getCrossReferenceHeader(e)},${n})` : n));
    }, onDone() {
      t.close();
    }, onError(n) {
      t.error(n);
    } });
  } });
}
async function ft$1(e) {
  const r = Ve(e), t = r.request, n = t.headers.get("X-Server-Id"), o = t.headers.get("X-Server-Instance"), a = t.headers.has("X-Single-Flight"), i = new URL(t.url);
  let c, d;
  if (n) Je(typeof n == "string", "Invalid server function"), [c, d] = n.split("#");
  else if (c = i.searchParams.get("id"), d = i.searchParams.get("name"), !c || !d) return new Response(null, { status: 404 });
  const p = pt$1[c];
  let h;
  if (!p) return new Response(null, { status: 404 });
  h = await p.importer();
  const Y = h[p.functionName];
  let f = [];
  if (!o || e.method === "GET") {
    const s = i.searchParams.get("args");
    if (s) {
      const l = JSON.parse(s);
      (l.t ? fromJSON(l, { plugins: [CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin] }) : l).forEach((m) => f.push(m));
    }
  }
  if (e.method === "POST") {
    const s = t.headers.get("content-type"), l = e.node.req, m = l instanceof ReadableStream, Z = l.body instanceof ReadableStream, O = m && l.locked || Z && l.body.locked, I = m ? l : l.body;
    if ((s == null ? void 0 : s.startsWith("multipart/form-data")) || (s == null ? void 0 : s.startsWith("application/x-www-form-urlencoded"))) f.push(await (O ? t : new Request(t, { ...t, body: I })).formData());
    else if (s == null ? void 0 : s.startsWith("application/json")) {
      const ee = O ? t : new Request(t, { ...t, body: I });
      f = fromJSON(await ee.json(), { plugins: [CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin] });
    }
  }
  try {
    let s = await provideRequestEvent(r, async () => (sharedConfig.context = { event: r }, r.locals.serverFunctionMeta = { id: c + "#" + d }, Y(...f)));
    if (a && o && (s = await B(r, s)), s instanceof Response) {
      if (s.headers && s.headers.has("X-Content-Raw")) return s;
      o && (s.headers && M$2(e, s.headers), s.status && (s.status < 300 || s.status >= 400) && S(e, s.status), s.customBody ? s = await s.customBody() : s.body == null && (s = null));
    }
    return o ? (R$1(e, "content-type", "text/javascript"), W$1(o, s)) : N(s, t, f);
  } catch (s) {
    if (s instanceof Response) a && o && (s = await B(r, s)), s.headers && M$2(e, s.headers), s.status && (!o || s.status < 300 || s.status >= 400) && S(e, s.status), s.customBody ? s = s.customBody() : s.body == null && (s = null), R$1(e, "X-Error", "true");
    else if (o) {
      const l = s instanceof Error ? s.message : typeof s == "string" ? s : "true";
      R$1(e, "X-Error", l.replace(/[\r\n]+/g, ""));
    } else s = N(s, t, f, true);
    return o ? (R$1(e, "content-type", "text/javascript"), W$1(o, s)) : s;
  }
}
function N(e, r, t, n) {
  const o = new URL(r.url), a = e instanceof Error;
  let i = 302, c;
  return e instanceof Response ? (c = new Headers(e.headers), e.headers.has("Location") && (c.set("Location", new URL(e.headers.get("Location"), o.origin + "").toString()), i = lt$1(e))) : c = new Headers({ Location: new URL(r.headers.get("referer")).toString() }), e && c.append("Set-Cookie", `flash=${encodeURIComponent(JSON.stringify({ url: o.pathname + o.search, result: a ? e.message : e, thrown: n, error: a, input: [...t.slice(0, -1), [...t[t.length - 1].entries()]] }))}; Secure; HttpOnly;`), new Response(null, { status: i, headers: c });
}
let b;
function ht$1(e) {
  var _a;
  const r = new Headers(e.request.headers), t = _e$1(e.nativeEvent), n = e.response.headers.getSetCookie();
  r.delete("cookie");
  let o = false;
  return ((_a = e.nativeEvent.node) == null ? void 0 : _a.req) && (o = true, e.nativeEvent.node.req.headers.cookie = ""), n.forEach((a) => {
    if (!a) return;
    const { maxAge: i, expires: c, name: d, value: p } = parseSetCookie$1(a);
    if (i != null && i <= 0) {
      delete t[d];
      return;
    }
    if (c != null && c.getTime() <= Date.now()) {
      delete t[d];
      return;
    }
    t[d] = p;
  }), Object.entries(t).forEach(([a, i]) => {
    r.append("cookie", `${a}=${i}`), o && (e.nativeEvent.node.req.headers.cookie += `${a}=${i};`);
  }), r;
}
async function B(e, r) {
  let t, n = new URL(e.request.headers.get("referer")).toString();
  r instanceof Response && (r.headers.has("X-Revalidate") && (t = r.headers.get("X-Revalidate").split(",")), r.headers.has("Location") && (n = new URL(r.headers.get("Location"), new URL(e.request.url).origin + "").toString()));
  const o = Ke$1(e);
  return o.request = new Request(n, { headers: ht$1(e) }), await provideRequestEvent(o, async () => {
    await ct(o), b || (b = (await import('./chunks/build/app-DWU6Z7KW.mjs')).default), o.router.dataOnly = t || true, o.router.previousUrl = e.request.headers.get("referer");
    try {
      renderToString(() => {
        sharedConfig.context.event = o, b();
      });
    } catch (c) {
      console.log(c);
    }
    const a = o.router.data;
    if (!a) return r;
    let i = false;
    for (const c in a) a[c] === void 0 ? delete a[c] : i = true;
    return i && (r instanceof Response ? r.customBody && (a._$value = r.customBody()) : (a._$value = r, r = new Response(null, { status: 200 })), r.customBody = () => a, r.headers.set("X-Single-Flight", "true")), r;
  });
}
const Pt$1 = eventHandler(ft$1);

function ge() {
  let t = /* @__PURE__ */ new Set();
  function e(r) {
    return t.add(r), () => t.delete(r);
  }
  let n = false;
  function s(r, o) {
    if (n) return !(n = false);
    const a = { to: r, options: o, defaultPrevented: false, preventDefault: () => a.defaultPrevented = true };
    for (const i of t) i.listener({ ...a, from: i.location, retry: (f) => {
      f && (n = true), i.navigate(r, { ...o, resolve: false });
    } });
    return !a.defaultPrevented;
  }
  return { subscribe: e, confirm: s };
}
let M$1;
function Y$1() {
  (!window.history.state || window.history.state._depth == null) && window.history.replaceState({ ...window.history.state, _depth: window.history.length - 1 }, ""), M$1 = window.history.state._depth;
}
isServer || Y$1();
function We(t) {
  return { ...t, _depth: window.history.state && window.history.state._depth };
}
function Ie(t, e) {
  let n = false;
  return () => {
    const s = M$1;
    Y$1();
    const r = s == null ? null : M$1 - s;
    if (n) {
      n = false;
      return;
    }
    r && e(r) ? (n = true, window.history.go(-r)) : t();
  };
}
const ye = /^(?:[a-z0-9]+:)?\/\//i, we = /^\/+|(\/)\/+$/g, ve = "http://sr";
function E(t, e = false) {
  const n = t.replace(we, "$1");
  return n ? e || /^[?#]/.test(n) ? n : "/" + n : "";
}
function q(t, e, n) {
  if (ye.test(e)) return;
  const s = E(t), r = n && E(n);
  let o = "";
  return !r || e.startsWith("/") ? o = s : r.toLowerCase().indexOf(s.toLowerCase()) !== 0 ? o = s + r : o = r, (o || "/") + E(e, !o);
}
function Re(t, e) {
  if (t == null) throw new Error(e);
  return t;
}
function Pe(t, e) {
  return E(t).replace(/\/*(\*.*)?$/g, "") + E(e);
}
function Z$1(t) {
  const e = {};
  return t.searchParams.forEach((n, s) => {
    s in e ? Array.isArray(e[s]) ? e[s].push(n) : e[s] = [e[s], n] : e[s] = n;
  }), e;
}
function xe(t, e, n) {
  const [s, r] = t.split("/*", 2), o = s.split("/").filter(Boolean), a = o.length;
  return (i) => {
    const f = i.split("/").filter(Boolean), h = f.length - a;
    if (h < 0 || h > 0 && r === void 0 && !e) return null;
    const l = { path: a ? "" : "/", params: {} }, m = (d) => n === void 0 ? void 0 : n[d];
    for (let d = 0; d < a; d++) {
      const p = o[d], y = p[0] === ":", v = y ? f[d] : f[d].toLowerCase(), A = y ? p.slice(1) : p.toLowerCase();
      if (y && W(v, m(A))) l.params[A] = v;
      else if (y || !W(v, A)) return null;
      l.path += `/${v}`;
    }
    if (r) {
      const d = h ? f.slice(-h).join("/") : "";
      if (W(d, m(r))) l.params[r] = d;
      else return null;
    }
    return l;
  };
}
function W(t, e) {
  const n = (s) => s === t;
  return e === void 0 ? true : typeof e == "string" ? n(e) : typeof e == "function" ? e(t) : Array.isArray(e) ? e.some(n) : e instanceof RegExp ? e.test(t) : false;
}
function be(t) {
  const [e, n] = t.pattern.split("/*", 2), s = e.split("/").filter(Boolean);
  return s.reduce((r, o) => r + (o.startsWith(":") ? 2 : 3), s.length - (n === void 0 ? 0 : 1));
}
function k(t) {
  const e = /* @__PURE__ */ new Map(), n = getOwner();
  return new Proxy({}, { get(s, r) {
    return e.has(r) || runWithOwner(n, () => e.set(r, createMemo(() => t()[r]))), e.get(r)();
  }, getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  }, ownKeys() {
    return Reflect.ownKeys(t());
  }, has(s, r) {
    return r in t();
  } });
}
function Se(t, e) {
  const n = new URLSearchParams(t);
  Object.entries(e).forEach(([r, o]) => {
    o == null || o === "" || o instanceof Array && !o.length ? n.delete(r) : o instanceof Array ? (n.delete(r), o.forEach((a) => {
      n.append(r, String(a));
    })) : n.set(r, String(o));
  });
  const s = n.toString();
  return s ? `?${s}` : "";
}
function ee(t) {
  let e = /(\/?\:[^\/]+)\?/.exec(t);
  if (!e) return [t];
  let n = t.slice(0, e.index), s = t.slice(e.index + e[0].length);
  const r = [n, n += e[1]];
  for (; e = /^(\/\:[^\/]+)\?/.exec(s); ) r.push(n += e[1]), s = s.slice(e[0].length);
  return ee(s).reduce((o, a) => [...o, ...r.map((i) => i + a)], []);
}
const Ae = 100, Ee = createContext$1(), te = createContext$1(), $ = () => Re(useContext(Ee), "<A> and 'use' router primitives can be only used inside a Route."), Ce = () => useContext(te) || $().base, Me = (t) => {
  const e = Ce();
  return createMemo(() => e.resolvePath(t()));
}, Ue = (t) => {
  const e = $();
  return createMemo(() => {
    const n = t();
    return n !== void 0 ? e.renderPath(n) : n;
  });
}, Le = () => $().navigatorFactory(), Oe = () => $().location, De = () => {
  const t = Oe(), e = Le(), n = (s, r) => {
    const o = untrack(() => Se(t.search, s) + t.hash);
    e(o, { scroll: false, resolve: false, ...r });
  };
  return [t.query, n];
};
function je(t, e = "") {
  const { component: n, preload: s, load: r, children: o, info: a } = t, i = !o || Array.isArray(o) && !o.length, f = { key: t, component: n, preload: s || r, info: a };
  return ne$1(t.path).reduce((h, l) => {
    for (const m of ee(l)) {
      const d = Pe(e, m);
      let p = i ? d : d.split("/*", 1)[0];
      p = p.split("/").map((y) => y.startsWith(":") || y.startsWith("*") ? y : encodeURIComponent(y)).join("/"), h.push({ ...f, originalPath: l, pattern: p, matcher: xe(p, !i, t.matchFilters) });
    }
    return h;
  }, []);
}
function Fe(t, e = 0) {
  return { routes: t, score: be(t[t.length - 1]) * 1e4 - e, matcher(n) {
    const s = [];
    for (let r = t.length - 1; r >= 0; r--) {
      const o = t[r], a = o.matcher(n);
      if (!a) return null;
      s.unshift({ ...a, route: o });
    }
    return s;
  } };
}
function ne$1(t) {
  return Array.isArray(t) ? t : [t];
}
function _e(t, e = "", n = [], s = []) {
  const r = ne$1(t);
  for (let o = 0, a = r.length; o < a; o++) {
    const i = r[o];
    if (i && typeof i == "object") {
      i.hasOwnProperty("path") || (i.path = "");
      const f = je(i, e);
      for (const h of f) {
        n.push(h);
        const l = Array.isArray(i.children) && i.children.length === 0;
        if (i.children && !l) _e(i.children, h.pattern, n, s);
        else {
          const m = Fe([...n], s.length);
          s.push(m);
        }
        n.pop();
      }
    }
  }
  return n.length ? s : s.sort((o, a) => a.score - o.score);
}
function I$1(t, e) {
  for (let n = 0, s = t.length; n < s; n++) {
    const r = t[n].matcher(e);
    if (r) return r;
  }
  return [];
}
function Be(t, e, n) {
  const s = new URL(ve), r = createMemo((l) => {
    const m = t();
    try {
      return new URL(m, s);
    } catch {
      return console.error(`Invalid path ${m}`), l;
    }
  }, s, { equals: (l, m) => l.href === m.href }), o = createMemo(() => r().pathname), a = createMemo(() => r().search, true), i = createMemo(() => r().hash), f = () => "", h = on(a, () => Z$1(r()));
  return { get pathname() {
    return o();
  }, get search() {
    return a();
  }, get hash() {
    return i();
  }, get state() {
    return e();
  }, get key() {
    return f();
  }, query: n ? n(h) : k(h) };
}
let R;
function ze() {
  return R;
}
function He(t, e, n, s = {}) {
  const { signal: [r, o], utils: a = {} } = t, i = a.parsePath || ((c) => c), f = a.renderPath || ((c) => c), h = a.beforeLeave || ge(), l = q("", s.base || "");
  if (l === void 0) throw new Error(`${l} is not a valid base path`);
  l && !r().value && o({ value: l, replace: true, scroll: false });
  const [m, d] = createSignal(false);
  let p;
  const y = (c, u) => {
    u.value === v() && u.state === C() || (p === void 0 && d(true), R = c, p = u, startTransition(() => {
      p === u && (A(p.value), re(p.state), resetErrorBoundaries(), isServer || D[1]((g) => g.filter((P) => P.pending)));
    }).finally(() => {
      p === u && batch(() => {
        R = void 0, c === "navigate" && ce(p), d(false), p = void 0;
      });
    }));
  }, [v, A] = createSignal(r().value), [C, re] = createSignal(r().state), L = Be(v, C, a.queryWrapper), O = [], D = createSignal(isServer ? ue() : []), z = createMemo(() => typeof s.transformUrl == "function" ? I$1(e(), s.transformUrl(L.pathname)) : I$1(e(), L.pathname)), H = () => {
    const c = z(), u = {};
    for (let g = 0; g < c.length; g++) Object.assign(u, c[g].params);
    return u;
  }, se = a.paramsWrapper ? a.paramsWrapper(H, e) : k(H), K = { pattern: l, path: () => l, outlet: () => null, resolvePath(c) {
    return q(l, c);
  } };
  return createRenderEffect(on(r, (c) => y("native", c), { defer: true })), { base: K, location: L, params: se, isRouting: m, renderPath: f, parsePath: i, navigatorFactory: ae, matches: z, beforeLeave: h, preloadRoute: ie, singleFlight: s.singleFlight === void 0 ? true : s.singleFlight, submissions: D };
  function oe(c, u, g) {
    untrack(() => {
      if (typeof u == "number") {
        u && (a.go ? a.go(u) : console.warn("Router integration does not support relative routing"));
        return;
      }
      const P = !u || u[0] === "?", { replace: j, resolve: x, scroll: F, state: b } = { replace: false, resolve: !P, scroll: true, ...g }, S = x ? c.resolvePath(u) : q(P && L.pathname || "", u);
      if (S === void 0) throw new Error(`Path '${u}' is not a routable path`);
      if (O.length >= Ae) throw new Error("Too many redirects");
      const N = v();
      if (S !== N || b !== C()) if (isServer) {
        const T = getRequestEvent();
        T && (T.response = { status: 302, headers: new Headers({ Location: S }) }), o({ value: S, replace: j, scroll: F, state: b });
      } else h.confirm(S, g) && (O.push({ value: N, replace: j, scroll: F, state: C() }), y("navigate", { value: S, state: b }));
    });
  }
  function ae(c) {
    return c = c || useContext(te) || K, (u, g) => oe(c, u, g);
  }
  function ce(c) {
    const u = O[0];
    u && (o({ ...c, replace: u.replace, scroll: u.scroll }), O.length = 0);
  }
  function ie(c, u) {
    const g = I$1(e(), c.pathname), P = R;
    R = "preload";
    for (let j in g) {
      const { route: x, params: F } = g[j];
      x.component && x.component.preload && x.component.preload();
      const { preload: b } = x;
      u && b && runWithOwner(n(), () => b({ params: F, location: { pathname: c.pathname, search: c.search, hash: c.hash, query: Z$1(c), state: null, key: "" }, intent: "preload" }));
    }
    R = P;
  }
  function ue() {
    const c = getRequestEvent();
    return c && c.router && c.router.submission ? [c.router.submission] : [];
  }
}
function Ke(t, e, n, s) {
  const { base: r, location: o, params: a } = t, { pattern: i, component: f, preload: h } = s().route, l = createMemo(() => s().path);
  f && f.preload && f.preload();
  const m = h ? h({ params: a, location: o, intent: R || "initial" }) : void 0;
  return { parent: e, pattern: i, path: l, outlet: () => f ? createComponent(f, { params: a, location: o, data: m, get children() {
    return n();
  } }) : n(), resolvePath(p) {
    return q(r.path(), p, l());
  } };
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, key + "" , value);
function lt(e) {
  let r;
  const t = oe(e), n = { duplex: "half", method: e.method, headers: e.headers };
  return e.node.req.body instanceof ArrayBuffer ? new Request(t, { ...n, body: e.node.req.body }) : new Request(t, { ...n, get body() {
    return r || (r = Rt(e), r);
  } });
}
function dt(e) {
  var _a;
  return (_a = e.web) != null ? _a : e.web = { request: lt(e), url: oe(e) }, e.web.request;
}
function pt() {
  return kt();
}
const ne = /* @__PURE__ */ Symbol("$HTTPEvent");
function ht(e) {
  return typeof e == "object" && (e instanceof H3Event || (e == null ? void 0 : e[ne]) instanceof H3Event || (e == null ? void 0 : e.__is_event__) === true);
}
function y(e) {
  return function(...r) {
    var _a;
    let t = r[0];
    if (ht(t)) r[0] = t instanceof H3Event || t.__is_event__ ? t : t[ne];
    else {
      if (!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext)) throw new Error("AsyncLocalStorage was not enabled. Use the `server.experimental.asyncContext: true` option in your app configuration to enable it. Or, pass the instance of HTTPEvent that you have as the first argument to the function.");
      if (t = pt(), !t) throw new Error("No HTTPEvent found in AsyncLocalStorage. Make sure you are using the function within the server runtime.");
      r.unshift(t);
    }
    return e(...r);
  };
}
const oe = y(getRequestURL), ft = y(getRequestIP), I = y(setResponseStatus), K = y(getResponseStatus), mt = y(getResponseStatusText), H = y(getResponseHeaders), J = y(getResponseHeader), gt = y(setResponseHeader), yt = y(appendResponseHeader), G = y(sendRedirect), wt = y(getCookie), bt = y(setCookie), vt = y(setHeader), Rt = y(getRequestWebStream), $t = y(removeResponseHeader), St = y(dt);
function Et() {
  var _a;
  return getContext("nitro-app", { asyncContext: !!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext), AsyncLocalStorage: AsyncLocalStorage });
}
function kt() {
  return Et().use().event;
}
const se = [{ page: true, $component: { src: "src/routes/analytics.tsx?pick=default&pick=$css", build: () => import('./chunks/build/analytics2.mjs'), import: () => import('./chunks/build/analytics2.mjs') }, path: "/analytics", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/analytics.tsx" }, { page: false, $POST: { src: "src/routes/api/rpc.ts?pick=POST", build: () => import('./chunks/build/rpc2.mjs'), import: () => import('./chunks/build/rpc2.mjs') }, path: "/api/rpc", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/api/rpc.ts" }, { page: true, $component: { src: "src/routes/faucet.tsx?pick=default&pick=$css", build: () => import('./chunks/build/faucet2.mjs'), import: () => import('./chunks/build/faucet2.mjs') }, path: "/faucet", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/faucet.tsx" }, { page: true, $component: { src: "src/routes/index.tsx?pick=default&pick=$css", build: () => import('./chunks/build/index2.mjs'), import: () => import('./chunks/build/index2.mjs') }, path: "/", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/index.tsx" }, { page: true, $component: { src: "src/routes/mint.tsx?pick=default&pick=$css", build: () => import('./chunks/build/mint2.mjs'), import: () => import('./chunks/build/mint2.mjs') }, path: "/mint", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/mint.tsx" }, { page: true, $component: { src: "src/routes/pools.tsx?pick=default&pick=$css", build: () => import('./chunks/build/pools2.mjs'), import: () => import('./chunks/build/pools2.mjs') }, path: "/pools", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/pools.tsx" }, { page: true, $component: { src: "src/routes/portfolio.tsx?pick=default&pick=$css", build: () => import('./chunks/build/portfolio2.mjs'), import: () => import('./chunks/build/portfolio2.mjs') }, path: "/portfolio", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/portfolio.tsx" }, { page: true, $component: { src: "src/routes/trade.tsx?pick=default&pick=$css", build: () => import('./chunks/build/trade2.mjs'), import: () => import('./chunks/build/trade2.mjs') }, path: "/trade", filePath: "/home/ametel/source/horizon-starknet/packages/frontend-solid/src/routes/trade.tsx" }], Tt = At(se.filter((e) => e.page));
function At(e) {
  function r(t, n, o, s) {
    const a = Object.values(t).find((i) => o.startsWith(i.id + "/"));
    return a ? (r(a.children || (a.children = []), n, o.slice(a.id.length)), t) : (t.push({ ...n, id: o, path: o.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/") }), t);
  }
  return e.sort((t, n) => t.path.length - n.path.length).reduce((t, n) => r(t, n, n.path, n.path), []);
}
function Ct(e, r) {
  const t = Pt.lookup(e);
  if (t && t.route) {
    const n = t.route, o = r === "HEAD" ? n.$HEAD || n.$GET : n[`$${r}`];
    if (o === void 0) return;
    const s = n.page === true && n.$component !== void 0;
    return { handler: o, params: t.params, isPage: s };
  }
}
function xt(e) {
  return e.$HEAD || e.$GET || e.$POST || e.$PUT || e.$PATCH || e.$DELETE;
}
const Pt = createRouter$1({ routes: se.reduce((e, r) => {
  if (!xt(r)) return e;
  let t = r.path.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/").replace(/\*([^/]*)/g, (n, o) => `**:${o}`).split("/").map((n) => n.startsWith(":") || n.startsWith("*") ? n : encodeURIComponent(n)).join("/");
  if (/:[^/]*\?/g.test(t)) throw new Error(`Optional parameters are not supported in API routes: ${t}`);
  if (e[t]) throw new Error(`Duplicate API routes for "${t}" found at "${e[t].route.path}" and "${r.path}"`);
  return e[t] = { route: r }, e;
}, {}) }), O = "solidFetchEvent";
function Ht(e) {
  return { request: St(e), response: Ot(e), clientAddress: ft(e), locals: {}, nativeEvent: e };
}
function Lt(e) {
  if (!e.context[O]) {
    const r = Ht(e);
    e.context[O] = r;
  }
  return e.context[O];
}
class qt {
  constructor(r) {
    __publicField(this, "event");
    this.event = r;
  }
  get(r) {
    const t = J(this.event, r);
    return Array.isArray(t) ? t.join(", ") : t || null;
  }
  has(r) {
    return this.get(r) !== null;
  }
  set(r, t) {
    return gt(this.event, r, t);
  }
  delete(r) {
    return $t(this.event, r);
  }
  append(r, t) {
    yt(this.event, r, t);
  }
  getSetCookie() {
    const r = J(this.event, "Set-Cookie");
    return Array.isArray(r) ? r : [r];
  }
  forEach(r) {
    return Object.entries(H(this.event)).forEach(([t, n]) => r(Array.isArray(n) ? n.join(", ") : n, t, this));
  }
  entries() {
    return Object.entries(H(this.event)).map(([r, t]) => [r, Array.isArray(t) ? t.join(", ") : t])[Symbol.iterator]();
  }
  keys() {
    return Object.keys(H(this.event))[Symbol.iterator]();
  }
  values() {
    return Object.values(H(this.event)).map((r) => Array.isArray(r) ? r.join(", ") : r)[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
}
function Ot(e) {
  return { get status() {
    return K(e);
  }, set status(r) {
    I(e, r);
  }, get statusText() {
    return mt(e);
  }, set statusText(r) {
    I(e, K(e), r);
  }, headers: new qt(e) };
}
var It = " ";
const Mt = { style: (e) => ssrElement("style", e.attrs, () => e.children, true), link: (e) => ssrElement("link", e.attrs, void 0, true), script: (e) => e.attrs.src ? ssrElement("script", mergeProps(() => e.attrs, { get id() {
  return e.key;
} }), () => ssr(It), true) : null, noscript: (e) => ssrElement("noscript", e.attrs, () => escape(e.children), true) };
function M(e, r) {
  let { tag: t, attrs: { key: n, ...o } = { key: void 0 }, children: s } = e;
  return Mt[t]({ attrs: { ...o, nonce: r }, key: n, children: s });
}
function jt(e, r, t, n = "default") {
  return lazy(async () => {
    var _a;
    {
      const s = (await e.import())[n], i = (await ((_a = r.inputs) == null ? void 0 : _a[e.src].assets())).filter((u) => u.tag === "style" || u.attrs.rel === "stylesheet");
      return { default: (u) => [...i.map((f) => M(f)), createComponent(s, u)] };
    }
  });
}
function ae() {
  function e(t) {
    return { ...t, ...t.$$route ? t.$$route.require().route : void 0, info: { ...t.$$route ? t.$$route.require().route.info : {}, filesystem: true }, component: t.$component && jt(t.$component, globalThis.MANIFEST.client, globalThis.MANIFEST.ssr), children: t.children ? t.children.map(e) : void 0 };
  }
  return Tt.map(e);
}
let V;
const Ft = isServer ? () => getRequestEvent().routes : () => V || (V = ae());
function Ut(e) {
  const r = wt(e.nativeEvent, "flash");
  if (r) try {
    let t = JSON.parse(r);
    if (!t || !t.result) return;
    const n = [...t.input.slice(0, -1), new Map(t.input[t.input.length - 1])], o = t.error ? new Error(t.result) : t.result;
    return { input: n, url: t.url, pending: false, result: t.thrown ? void 0 : o, error: t.thrown ? o : void 0 };
  } catch (t) {
    console.error(t);
  } finally {
    bt(e.nativeEvent, "flash", "", { maxAge: 0 });
  }
}
async function _t(e) {
  const r = globalThis.MANIFEST.client;
  return globalThis.MANIFEST.ssr, e.response.headers.set("Content-Type", "text/html"), Object.assign(e, { manifest: await r.json(), assets: [...await r.inputs[r.handler].assets()], router: { submission: Ut(e) }, routes: ae(), complete: false, $islands: /* @__PURE__ */ new Set() });
}
const zt = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function j(e) {
  return e.status && zt.has(e.status) ? e.status : 302;
}
function Bt(e, r, t = {}, n) {
  return eventHandler({ handler: (o) => {
    const s = Lt(o);
    return provideRequestEvent(s, async () => {
      const a = Ct(new URL(s.request.url).pathname, s.request.method);
      if (a) {
        const m = await a.handler.import(), w = s.request.method === "HEAD" ? m.HEAD || m.GET : m[s.request.method];
        s.params = a.params || {}, sharedConfig.context = { event: s };
        const l = await w(s);
        if (l !== void 0) return l;
        if (s.request.method !== "GET") throw new Error(`API handler for ${s.request.method} "${s.request.url}" did not return a response.`);
        if (!a.isPage) return;
      }
      const i = await r(s), c = typeof t == "function" ? await t(i) : { ...t }, u = c.mode || "stream";
      if (c.nonce && (i.nonce = c.nonce), u === "sync") {
        const m = renderToString(() => (sharedConfig.context.event = i, e(i)), c);
        if (i.complete = true, i.response && i.response.headers.get("Location")) {
          const w = j(i.response);
          return G(o, i.response.headers.get("Location"), w);
        }
        return m;
      }
      if (c.onCompleteAll) {
        const m = c.onCompleteAll;
        c.onCompleteAll = (w) => {
          Q(i)(w), m(w);
        };
      } else c.onCompleteAll = Q(i);
      if (c.onCompleteShell) {
        const m = c.onCompleteShell;
        c.onCompleteShell = (w) => {
          Y(i, o)(), m(w);
        };
      } else c.onCompleteShell = Y(i, o);
      const f = renderToStream(() => (sharedConfig.context.event = i, e(i)), c);
      if (i.response && i.response.headers.get("Location")) {
        const m = j(i.response);
        return G(o, i.response.headers.get("Location"), m);
      }
      if (u === "async") return f;
      const { writable: $, readable: R } = new TransformStream();
      return f.pipeTo($), R;
    });
  } });
}
function Y(e, r) {
  return () => {
    if (e.response && e.response.headers.get("Location")) {
      const t = j(e.response);
      I(r, t), vt(r, "Location", e.response.headers.get("Location"));
    }
  };
}
function Q(e) {
  return ({ write: r }) => {
    e.complete = true;
    const t = e.response && e.response.headers.get("Location");
    t && r(`<script>window.location="${t}"<\/script>`);
  };
}
function Wt(e, r, t) {
  return Bt(e, _t, r);
}
const ie = createContext$1(), ce = ["title", "meta"], F = [], U = ["name", "http-equiv", "content", "charset", "media"].concat(["property"]), L = (e, r) => {
  const t = Object.fromEntries(Object.entries(e.props).filter(([n]) => r.includes(n)).sort());
  return (Object.hasOwn(t, "name") || Object.hasOwn(t, "property")) && (t.name = t.name || t.property, delete t.property), e.tag + JSON.stringify(t);
};
function Dt() {
  if (!sharedConfig.context) {
    const t = document.head.querySelectorAll("[data-sm]");
    Array.prototype.forEach.call(t, (n) => n.parentNode.removeChild(n));
  }
  const e = /* @__PURE__ */ new Map();
  function r(t) {
    if (t.ref) return t.ref;
    let n = document.querySelector(`[data-sm="${t.id}"]`);
    return n ? (n.tagName.toLowerCase() !== t.tag && (n.parentNode && n.parentNode.removeChild(n), n = document.createElement(t.tag)), n.removeAttribute("data-sm")) : n = document.createElement(t.tag), n;
  }
  return { addTag(t) {
    if (ce.indexOf(t.tag) !== -1) {
      const s = t.tag === "title" ? F : U, a = L(t, s);
      e.has(a) || e.set(a, []);
      let i = e.get(a), c = i.length;
      i = [...i, t], e.set(a, i);
      let u = r(t);
      t.ref = u, spread(u, t.props);
      let f = null;
      for (var n = c - 1; n >= 0; n--) if (i[n] != null) {
        f = i[n];
        break;
      }
      return u.parentNode != document.head && document.head.appendChild(u), f && f.ref && f.ref.parentNode && document.head.removeChild(f.ref), c;
    }
    let o = r(t);
    return t.ref = o, spread(o, t.props), o.parentNode != document.head && document.head.appendChild(o), -1;
  }, removeTag(t, n) {
    const o = t.tag === "title" ? F : U, s = L(t, o);
    if (t.ref) {
      const a = e.get(s);
      if (a) {
        if (t.ref.parentNode) {
          t.ref.parentNode.removeChild(t.ref);
          for (let i = n - 1; i >= 0; i--) a[i] != null && document.head.appendChild(a[i].ref);
        }
        a[n] = null, e.set(s, a);
      } else t.ref.parentNode && t.ref.parentNode.removeChild(t.ref);
    }
  } };
}
function Kt() {
  const e = [];
  return useAssets(() => ssr(Yt(e))), { addTag(r) {
    if (ce.indexOf(r.tag) !== -1) {
      const t = r.tag === "title" ? F : U, n = L(r, t), o = e.findIndex((s) => s.tag === r.tag && L(s, t) === n);
      o !== -1 && e.splice(o, 1);
    }
    return e.push(r), e.length;
  }, removeTag(r, t) {
  } };
}
const Jt = (e) => {
  const r = isServer ? Kt() : Dt();
  return createComponent$1(ie.Provider, { value: r, get children() {
    return e.children;
  } });
}, Gt = (e, r, t) => (Vt({ tag: e, props: r, setting: t, id: createUniqueId(), get name() {
  return r.name || r.property;
} }), null);
function Vt(e) {
  const r = useContext(ie);
  if (!r) throw new Error("<MetaProvider /> should be in the tree");
  createRenderEffect(() => {
    const t = r.addTag(e);
    onCleanup(() => r.removeTag(e, t));
  });
}
function Yt(e) {
  return e.map((r) => {
    var _a, _b;
    const n = Object.keys(r.props).map((s) => s === "children" ? "" : ` ${s}="${escape(r.props[s], true)}"`).join("");
    let o = r.props.children;
    return Array.isArray(o) && (o = o.join("")), ((_a = r.setting) == null ? void 0 : _a.close) ? `<${r.tag} data-sm="${r.id}"${n}>${((_b = r.setting) == null ? void 0 : _b.escape) ? escape(o) : o || ""}</${r.tag}>` : `<${r.tag} data-sm="${r.id}"${n}/>`;
  }).join("");
}
const Qt = (e) => Gt("title", e, { escape: true, close: true }), ue = (e) => (r) => {
  const { base: t } = r, n = children(() => r.children), o = createMemo(() => _e(n(), r.base || ""));
  let s;
  const a = He(e, o, () => s, { base: t, singleFlight: r.singleFlight, transformUrl: r.transformUrl });
  return e.create && e.create(a), createComponent$1(Ee.Provider, { value: a, get children() {
    return createComponent$1(Xt, { routerState: a, get root() {
      return r.root;
    }, get preload() {
      return r.rootPreload || r.rootLoad;
    }, get children() {
      return [(s = getOwner()) && null, createComponent$1(Zt, { routerState: a, get branches() {
        return o();
      } })];
    } });
  } });
};
function Xt(e) {
  const r = e.routerState.location, t = e.routerState.params, n = createMemo(() => e.preload && untrack(() => {
    e.preload({ params: t, location: r, intent: ze() || "initial" });
  }));
  return createComponent$1(Show, { get when() {
    return e.root;
  }, keyed: true, get fallback() {
    return e.children;
  }, children: (o) => createComponent$1(o, { params: t, location: r, get data() {
    return n();
  }, get children() {
    return e.children;
  } }) });
}
function Zt(e) {
  if (isServer) {
    const o = getRequestEvent();
    if (o && o.router && o.router.dataOnly) {
      er(o, e.routerState, e.branches);
      return;
    }
    o && ((o.router || (o.router = {})).matches || (o.router.matches = e.routerState.matches().map(({ route: s, path: a, params: i }) => ({ path: s.originalPath, pattern: s.pattern, match: a, params: i, info: s.info }))));
  }
  const r = [];
  let t;
  const n = createMemo(on(e.routerState.matches, (o, s, a) => {
    let i = s && o.length === s.length;
    const c = [];
    for (let u = 0, f = o.length; u < f; u++) {
      const $ = s && s[u], R = o[u];
      a && $ && R.route.key === $.route.key ? c[u] = a[u] : (i = false, r[u] && r[u](), createRoot((m) => {
        r[u] = m, c[u] = Ke(e.routerState, c[u - 1] || e.routerState.base, X(() => n()[u + 1]), () => {
          var _a;
          const w = e.routerState.matches();
          return (_a = w[u]) != null ? _a : w[0];
        });
      }));
    }
    return r.splice(o.length).forEach((u) => u()), a && i ? a : (t = c[0], c);
  }));
  return X(() => n() && t)();
}
const X = (e) => () => createComponent$1(Show, { get when() {
  return e();
}, keyed: true, children: (r) => createComponent$1(te.Provider, { value: r, get children() {
  return r.outlet();
} }) });
function er(e, r, t) {
  const n = new URL(e.request.url), o = I$1(t, new URL(e.router.previousUrl || e.request.url).pathname), s = I$1(t, n.pathname);
  for (let a = 0; a < s.length; a++) {
    (!o[a] || s[a].route !== o[a].route) && (e.router.dataOnly = true);
    const { route: i, params: c } = s[a];
    i.preload && i.preload({ params: c, location: r.location, intent: "preload" });
  }
}
function tr([e, r], t, n) {
  return [e, n ? (o) => r(n(o)) : r];
}
function rr(e) {
  let r = false;
  const t = (o) => typeof o == "string" ? { value: o } : o, n = tr(createSignal(t(e.get()), { equals: (o, s) => o.value === s.value && o.state === s.state }), void 0, (o) => (!r && e.set(o), sharedConfig.registry && !sharedConfig.done && (sharedConfig.done = true), o));
  return e.init && onCleanup(e.init((o = e.get()) => {
    r = true, n[1](t(o)), r = false;
  })), ue({ signal: n, create: e.create, utils: e.utils });
}
function nr(e, r, t) {
  return e.addEventListener(r, t), () => e.removeEventListener(r, t);
}
function or(e, r) {
  const t = e && document.getElementById(e);
  t ? t.scrollIntoView() : r && window.scrollTo(0, 0);
}
function sr(e) {
  const r = new URL(e);
  return r.pathname + r.search;
}
function ar(e) {
  let r;
  const t = { value: e.url || (r = getRequestEvent()) && sr(r.request.url) || "" };
  return ue({ signal: [() => t, (n) => Object.assign(t, n)] })(e);
}
const ir = /* @__PURE__ */ new Map();
function cr(e = true, r = false, t = "/_server", n) {
  return (o) => {
    const s = o.base.path(), a = o.navigatorFactory(o.base);
    let i, c;
    function u(l) {
      return l.namespaceURI === "http://www.w3.org/2000/svg";
    }
    function f(l) {
      if (l.defaultPrevented || l.button !== 0 || l.metaKey || l.altKey || l.ctrlKey || l.shiftKey) return;
      const d = l.composedPath().find((B) => B instanceof Node && B.nodeName.toUpperCase() === "A");
      if (!d || r && !d.hasAttribute("link")) return;
      const g = u(d), h = g ? d.href.baseVal : d.href;
      if ((g ? d.target.baseVal : d.target) || !h && !d.hasAttribute("state")) return;
      const T = (d.getAttribute("rel") || "").split(/\s+/);
      if (d.hasAttribute("download") || T && T.includes("external")) return;
      const C = g ? new URL(h, document.baseURI) : new URL(h);
      if (!(C.origin !== window.location.origin || s && C.pathname && !C.pathname.toLowerCase().startsWith(s.toLowerCase()))) return [d, C];
    }
    function $(l) {
      const d = f(l);
      if (!d) return;
      const [g, h] = d, z = o.parsePath(h.pathname + h.search + h.hash), T = g.getAttribute("state");
      l.preventDefault(), a(z, { resolve: false, replace: g.hasAttribute("replace"), scroll: !g.hasAttribute("noscroll"), state: T ? JSON.parse(T) : void 0 });
    }
    function R(l) {
      const d = f(l);
      if (!d) return;
      const [g, h] = d;
      n && (h.pathname = n(h.pathname)), o.preloadRoute(h, g.getAttribute("preload") !== "false");
    }
    function m(l) {
      clearTimeout(i);
      const d = f(l);
      if (!d) return c = null;
      const [g, h] = d;
      c !== g && (n && (h.pathname = n(h.pathname)), i = setTimeout(() => {
        o.preloadRoute(h, g.getAttribute("preload") !== "false"), c = g;
      }, 20));
    }
    function w(l) {
      if (l.defaultPrevented) return;
      let d = l.submitter && l.submitter.hasAttribute("formaction") ? l.submitter.getAttribute("formaction") : l.target.getAttribute("action");
      if (!d) return;
      if (!d.startsWith("https://action/")) {
        const h = new URL(d, ve);
        if (d = o.parsePath(h.pathname + h.search), !d.startsWith(t)) return;
      }
      if (l.target.method.toUpperCase() !== "POST") throw new Error("Only POST forms are supported for Actions");
      const g = ir.get(d);
      if (g) {
        l.preventDefault();
        const h = new FormData(l.target, l.submitter);
        g.call({ r: o, f: l.target }, l.target.enctype === "multipart/form-data" ? h : new URLSearchParams(h));
      }
    }
    delegateEvents(["click", "submit"]), document.addEventListener("click", $), e && (document.addEventListener("mousemove", m, { passive: true }), document.addEventListener("focusin", R, { passive: true }), document.addEventListener("touchstart", R, { passive: true })), document.addEventListener("submit", w), onCleanup(() => {
      document.removeEventListener("click", $), e && (document.removeEventListener("mousemove", m), document.removeEventListener("focusin", R), document.removeEventListener("touchstart", R)), document.removeEventListener("submit", w);
    });
  };
}
function ur(e) {
  if (isServer) return ar(e);
  const r = () => {
    const n = window.location.pathname.replace(/^\/+/, "/") + window.location.search, o = window.history.state && window.history.state._depth && Object.keys(window.history.state).length === 1 ? void 0 : window.history.state;
    return { value: n + window.location.hash, state: o };
  }, t = ge();
  return rr({ get: r, set({ value: n, replace: o, scroll: s, state: a }) {
    o ? window.history.replaceState(We(a), "", n) : window.history.pushState(a, "", n), or(decodeURIComponent(window.location.hash.slice(1)), s), Y$1();
  }, init: (n) => nr(window, "popstate", Ie(n, (o) => {
    if (o) return !t.confirm(o);
    {
      const s = r();
      return !t.confirm(s.value, { state: s.state });
    }
  })), create: cr(e.preload, e.explicitLinks, e.actionBase, e.transformUrl), utils: { go: (n) => window.history.go(n), beforeLeave: t } })(e);
}
function lr() {
  return createComponent$1(ur, { root: (e) => createComponent$1(Jt, { get children() {
    return [createComponent$1(Qt, { children: "Horizon Protocol" }), createComponent$1(Suspense, { get children() {
      return e.children;
    } })];
  } }), get children() {
    return createComponent$1(Ft, {});
  } });
}
const le = isServer ? (e) => {
  const r = getRequestEvent();
  return r.response.status = e.code, r.response.statusText = e.text, onCleanup(() => !r.nativeEvent.handled && !r.complete && (r.response.status = 200)), null;
} : (e) => null;
var dr = ["<span", ' style="font-size:1.5em;text-align:center;position:fixed;left:0px;bottom:55%;width:100%;">', "</span>"], pr = ["<span", ' style="font-size:1.5em;text-align:center;position:fixed;left:0px;bottom:55%;width:100%;">500 | Internal Server Error</span>'];
const hr = (e) => {
  const r = isServer ? "500 | Internal Server Error" : "Error | Uncaught Client Exception";
  return createComponent$1(ErrorBoundary, { fallback: (t) => (console.error(t), [ssr(dr, ssrHydrationKey(), escape(r)), createComponent$1(le, { code: 500 })]), get children() {
    return e.children;
  } });
}, fr = (e) => {
  let r = false;
  const t = catchError(() => e.children, (n) => {
    console.error(n), r = !!n;
  });
  return r ? [ssr(pr, ssrHydrationKey()), createComponent$1(le, { code: 500 })] : t;
};
var Z = ["<script", ">", "<\/script>"], mr = ["<script", ' type="module"', " async", "><\/script>"], gr = ["<script", ' type="module" async', "><\/script>"];
const yr = ssr("<!DOCTYPE html>");
function de(e, r, t = []) {
  for (let n = 0; n < r.length; n++) {
    const o = r[n];
    if (o.path !== e[0].path) continue;
    let s = [...t, o];
    if (o.children) {
      const a = e.slice(1);
      if (a.length === 0 || (s = de(a, o.children, s), !s)) continue;
    }
    return s;
  }
}
function wr(e) {
  const r = getRequestEvent(), t = r.nonce;
  let n = [];
  return Promise.resolve().then(async () => {
    let o = [];
    if (r.router && r.router.matches) {
      const s = [...r.router.matches];
      for (; s.length && (!s[0].info || !s[0].info.filesystem); ) s.shift();
      const a = s.length && de(s, r.routes);
      if (a) {
        const i = globalThis.MANIFEST.client.inputs;
        for (let c = 0; c < a.length; c++) {
          const u = a[c], f = i[u.$component.src];
          o.push(f.assets());
        }
      }
    }
    n = await Promise.all(o).then((s) => [...new Map(s.flat().map((a) => [a.attrs.key, a])).values()].filter((a) => a.attrs.rel === "modulepreload" && !r.assets.find((i) => i.attrs.key === a.attrs.key)));
  }), useAssets(() => n.length ? n.map((o) => M(o)) : void 0), createComponent$1(NoHydration, { get children() {
    return [yr, createComponent$1(fr, { get children() {
      return createComponent$1(e.document, { get assets() {
        return [createComponent$1(HydrationScript, {}), r.assets.map((o) => M(o, t))];
      }, get scripts() {
        return t ? [ssr(Z, ssrHydrationKey() + ssrAttribute("nonce", escape(t, true), false), `window.manifest = ${JSON.stringify(r.manifest)}`), ssr(mr, ssrHydrationKey(), ssrAttribute("nonce", escape(t, true), false), ssrAttribute("src", escape(globalThis.MANIFEST.client.inputs[globalThis.MANIFEST.client.handler].output.path, true), false))] : [ssr(Z, ssrHydrationKey(), `window.manifest = ${JSON.stringify(r.manifest)}`), ssr(gr, ssrHydrationKey(), ssrAttribute("src", escape(globalThis.MANIFEST.client.inputs[globalThis.MANIFEST.client.handler].output.path, true), false))];
      }, get children() {
        return createComponent$1(Hydration, { get children() {
          return createComponent$1(hr, { get children() {
            return createComponent$1(lr, {});
          } });
        } });
      } });
    } })];
  } });
}
var br = ['<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Yield tokenization protocol on Starknet"><link rel="icon" href="/favicon.ico"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;family=Sora:wght@400;500;600;700&amp;display=swap" rel="stylesheet">', "</head>"], vr = ["<html", ' lang="en" class="dark">', '<body class="font-sans antialiased"><div id="app">', "</div><!--$-->", "<!--/--></body></html>"];
const xr = Wt(() => createComponent$1(wr, { document: ({ assets: e, children: r, scripts: t }) => ssr(vr, ssrHydrationKey(), createComponent$1(NoHydration, { get children() {
  return ssr(br, escape(e));
} }), escape(r), escape(t)) }));

const handlers = [
  { route: '', handler: _5h9zpK, lazy: false, middleware: true, method: undefined },
  { route: '/_server', handler: Pt$1, lazy: false, middleware: true, method: undefined },
  { route: '/', handler: xr, lazy: false, middleware: true, method: undefined }
];

function createNitroApp() {
  const config = useRuntimeConfig();
  const hooks = createHooks();
  const captureError = (error, context = {}) => {
    const promise = hooks.callHookParallel("error", error, context).catch((error_) => {
      console.error("Error while capturing another error", error_);
    });
    if (context.event && isEvent(context.event)) {
      const errors = context.event.context.nitro?.errors;
      if (errors) {
        errors.push({ error, context });
      }
      if (context.event.waitUntil) {
        context.event.waitUntil(promise);
      }
    }
  };
  const h3App = createApp({
    debug: destr(false),
    onError: (error, event) => {
      captureError(error, { event, tags: ["request"] });
      return errorHandler(error, event);
    },
    onRequest: async (event) => {
      event.context.nitro = event.context.nitro || { errors: [] };
      const fetchContext = event.node.req?.__unenv__;
      if (fetchContext?._platform) {
        event.context = {
          _platform: fetchContext?._platform,
          // #3335
          ...fetchContext._platform,
          ...event.context
        };
      }
      if (!event.context.waitUntil && fetchContext?.waitUntil) {
        event.context.waitUntil = fetchContext.waitUntil;
      }
      event.fetch = (req, init) => fetchWithEvent(event, req, init, { fetch: localFetch });
      event.$fetch = (req, init) => fetchWithEvent(event, req, init, {
        fetch: $fetch
      });
      event.waitUntil = (promise) => {
        if (!event.context.nitro._waitUntilPromises) {
          event.context.nitro._waitUntilPromises = [];
        }
        event.context.nitro._waitUntilPromises.push(promise);
        if (event.context.waitUntil) {
          event.context.waitUntil(promise);
        }
      };
      event.captureError = (error, context) => {
        captureError(error, { event, ...context });
      };
      await nitroApp$1.hooks.callHook("request", event).catch((error) => {
        captureError(error, { event, tags: ["request"] });
      });
    },
    onBeforeResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("beforeResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    },
    onAfterResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("afterResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    }
  });
  const router = createRouter({
    preemptive: true
  });
  const nodeHandler = toNodeListener(h3App);
  const localCall = (aRequest) => b$1(
    nodeHandler,
    aRequest
  );
  const localFetch = (input, init) => {
    if (!input.toString().startsWith("/")) {
      return globalThis.fetch(input, init);
    }
    return C(
      nodeHandler,
      input,
      init
    ).then((response) => normalizeFetchResponse(response));
  };
  const $fetch = createFetch({
    fetch: localFetch,
    Headers: Headers$1,
    defaults: { baseURL: config.app.baseURL }
  });
  globalThis.$fetch = $fetch;
  h3App.use(createRouteRulesHandler({ localFetch }));
  for (const h of handlers) {
    let handler = h.lazy ? lazyEventHandler(h.handler) : h.handler;
    if (h.middleware || !h.route) {
      const middlewareBase = (config.app.baseURL + (h.route || "/")).replace(
        /\/+/g,
        "/"
      );
      h3App.use(middlewareBase, handler);
    } else {
      const routeRules = getRouteRulesForPath(
        h.route.replace(/:\w+|\*\*/g, "_")
      );
      if (routeRules.cache) {
        handler = cachedEventHandler(handler, {
          group: "nitro/routes",
          ...routeRules.cache
        });
      }
      router.use(h.route, handler, h.method);
    }
  }
  h3App.use(config.app.baseURL, router.handler);
  {
    const _handler = h3App.handler;
    h3App.handler = (event) => {
      const ctx = { event };
      return nitroAsyncContext.callAsync(ctx, () => _handler(event));
    };
  }
  const app = {
    hooks,
    h3App,
    router,
    localCall,
    localFetch,
    captureError
  };
  return app;
}
function runNitroPlugins(nitroApp2) {
  for (const plugin of plugins) {
    try {
      plugin(nitroApp2);
    } catch (error) {
      nitroApp2.captureError(error, { tags: ["plugin"] });
      throw error;
    }
  }
}
const nitroApp$1 = createNitroApp();
function useNitroApp() {
  return nitroApp$1;
}
runNitroPlugins(nitroApp$1);

const nitroApp = useNitroApp();
const server = Bun.serve({
  port: process.env.NITRO_PORT || process.env.PORT || 3e3,
  host: process.env.NITRO_HOST || process.env.HOST,
  idleTimeout: Number.parseInt(process.env.NITRO_BUN_IDLE_TIMEOUT) || void 0,
  websocket: void 0,
  async fetch(req, server2) {
    const url = new URL(req.url);
    let body;
    if (req.body) {
      body = await req.arrayBuffer();
    }
    return nitroApp.localFetch(url.pathname + url.search, {
      host: url.hostname,
      protocol: url.protocol,
      headers: req.headers,
      method: req.method,
      redirect: req.redirect,
      body
    });
  }
});
console.log(`Listening on ${server.url}...`);

export { De as D, E, Me as M, Oe as O, Ue as U, xt$1 as x };
//# sourceMappingURL=index.mjs.map
