var WasmEncoder1c = function(WasmEncoder1c) {
    WasmEncoder1c = WasmEncoder1c || {};

    var Module = typeof WasmEncoder1c !== 'undefined' ? WasmEncoder1c : {};
    var moduleOverrides = {};
    var key;
    for (key in Module) {
        if (Module.hasOwnProperty(key)) {
            moduleOverrides[key] = Module[key];
        }
    }
    Module['arguments'] = [];
    Module['thisProgram'] = './this.program';
    Module['quit'] = function(status, toThrow) {
        throw toThrow;
    };
    Module['preRun'] = [];
    Module['postRun'] = [];
    var ENVIRONMENT_IS_WEB = false;
    var ENVIRONMENT_IS_WORKER = false;
    var ENVIRONMENT_IS_NODE = false;
    var ENVIRONMENT_IS_SHELL = false;
    if (Module['ENVIRONMENT']) {
        if (Module['ENVIRONMENT'] === 'WEB') {
            ENVIRONMENT_IS_WEB = true;
        } else if (Module['ENVIRONMENT'] === 'WORKER') {
            ENVIRONMENT_IS_WORKER = true;
        } else if (Module['ENVIRONMENT'] === 'NODE') {
            ENVIRONMENT_IS_NODE = true;
        } else if (Module['ENVIRONMENT'] === 'SHELL') {
            ENVIRONMENT_IS_SHELL = true;
        } else {
            throw new Error(
                "Module['ENVIRONMENT'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL."
            );
        }
    } else {
        ENVIRONMENT_IS_WEB = typeof window === 'object';
        ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
        ENVIRONMENT_IS_NODE =
            typeof process === 'object' &&
            typeof require === 'function' &&
            !ENVIRONMENT_IS_WEB &&
            !ENVIRONMENT_IS_WORKER;
        ENVIRONMENT_IS_SHELL =
            !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
    }
    if (ENVIRONMENT_IS_NODE) {
        var nodeFS;
        var nodePath;
        Module['read'] = function shell_read(filename, binary) {
            var ret;
            if (!nodeFS) nodeFS = require('fs');
            if (!nodePath) nodePath = require('path');
            filename = nodePath['normalize'](filename);
            ret = nodeFS['readFileSync'](filename);
            return binary ? ret : ret.toString();
        };
        Module['readBinary'] = function readBinary(filename) {
            var ret = Module['read'](filename, true);
            if (!ret.buffer) {
                ret = new Uint8Array(ret);
            }
            assert(ret.buffer);
            return ret;
        };
        if (process['argv'].length > 1) {
            Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
        }
        Module['arguments'] = process['argv'].slice(2);
        process['on']('uncaughtException', function(ex) {
            if (!(ex instanceof ExitStatus)) {
                throw ex;
            }
        });
        process['on']('unhandledRejection', function(reason, p) {
            process['exit'](1);
        });
        Module['inspect'] = function() {
            return '[Emscripten Module object]';
        };
    } else if (ENVIRONMENT_IS_SHELL) {
        if (typeof read !== 'undefined') {
            Module['read'] = function shell_read(f) {
                return read(f);
            };
        }
        Module['readBinary'] = function readBinary(f) {
            var data;
            if (typeof readbuffer === 'function') {
                return new Uint8Array(readbuffer(f));
            }
            data = read(f, 'binary');
            assert(typeof data === 'object');
            return data;
        };
        if (typeof scriptArgs !== 'undefined') {
            Module['arguments'] = scriptArgs;
        } else if (typeof arguments !== 'undefined') {
            Module['arguments'] = arguments;
        }
        if (typeof quit === 'function') {
            Module['quit'] = function(status, toThrow) {
                quit(status);
            };
        }
    } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
        Module['read'] = function shell_read(url) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            xhr.send(null);
            return xhr.responseText;
        };
        if (ENVIRONMENT_IS_WORKER) {
            Module['readBinary'] = function readBinary(url) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, false);
                xhr.responseType = 'arraybuffer';
                xhr.send(null);
                return new Uint8Array(xhr.response);
            };
        }
        Module['readAsync'] = function readAsync(url, onload, onerror) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function xhr_onload() {
                if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
                    onload(xhr.response);
                    return;
                }
                onerror();
            };
            xhr.onerror = onerror;
            xhr.send(null);
        };
        if (typeof arguments !== 'undefined') {
            Module['arguments'] = arguments;
        }
        Module['setWindowTitle'] = function(title) {
            document.title = title;
        };
    }
    Module['print'] =
        typeof console !== 'undefined'
            ? console.log.bind(console)
            : typeof print !== 'undefined'
            ? print
            : null;
    Module['printErr'] =
        typeof printErr !== 'undefined'
            ? printErr
            : (typeof console !== 'undefined' && console.warn.bind(console)) || Module['print'];
    Module.print = Module['print'];
    Module.printErr = Module['printErr'];
    for (key in moduleOverrides) {
        if (moduleOverrides.hasOwnProperty(key)) {
            Module[key] = moduleOverrides[key];
        }
    }
    moduleOverrides = undefined;
    var STACK_ALIGN = 16;
    function staticAlloc(size) {
        assert(!staticSealed);
        var ret = STATICTOP;
        STATICTOP = (STATICTOP + size + 15) & -16;
        return ret;
    }
    function dynamicAlloc(size) {
        assert(DYNAMICTOP_PTR);
        var ret = HEAP32[DYNAMICTOP_PTR >> 2];
        var end = (ret + size + 15) & -16;
        HEAP32[DYNAMICTOP_PTR >> 2] = end;
        if (end >= TOTAL_MEMORY) {
            var success = enlargeMemory();
            if (!success) {
                HEAP32[DYNAMICTOP_PTR >> 2] = ret;
                return 0;
            }
        }
        return ret;
    }
    function alignMemory(size, factor) {
        if (!factor) factor = STACK_ALIGN;
        var ret = (size = Math.ceil(size / factor) * factor);
        return ret;
    }
    function getNativeTypeSize(type) {
        switch (type) {
            case 'i1':
            case 'i8':
                return 1;
            case 'i16':
                return 2;
            case 'i32':
                return 4;
            case 'i64':
                return 8;
            case 'float':
                return 4;
            case 'double':
                return 8;
            default: {
                if (type[type.length - 1] === '*') {
                    return 4;
                } else if (type[0] === 'i') {
                    var bits = parseInt(type.substr(1));
                    assert(bits % 8 === 0);
                    return bits / 8;
                } else {
                    return 0;
                }
            }
        }
    }
    var functionPointers = new Array(0);
    var GLOBAL_BASE = 1024;
    var ABORT = 0;
    var EXITSTATUS = 0;
    function assert(condition, text) {
        if (!condition) {
            abort('Assertion failed: ' + text);
        }
    }
    function setValue(ptr, value, type, noSafe) {
        type = type || 'i8';
        if (type.charAt(type.length - 1) === '*') type = 'i32';
        switch (type) {
            case 'i1':
                HEAP8[ptr >> 0] = value;
                break;
            case 'i8':
                HEAP8[ptr >> 0] = value;
                break;
            case 'i16':
                HEAP16[ptr >> 1] = value;
                break;
            case 'i32':
                HEAP32[ptr >> 2] = value;
                break;
            case 'i64':
                (tempI64 = [
                    value >>> 0,
                    ((tempDouble = value),
                    +Math_abs(tempDouble) >= 1
                        ? tempDouble > 0
                            ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0
                            : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
                        : 0)
                ]),
                    (HEAP32[ptr >> 2] = tempI64[0]),
                    (HEAP32[(ptr + 4) >> 2] = tempI64[1]);
                break;
            case 'float':
                HEAPF32[ptr >> 2] = value;
                break;
            case 'double':
                HEAPF64[ptr >> 3] = value;
                break;
            default:
                abort('invalid type for setValue: ' + type);
        }
    }
    var ALLOC_NORMAL = 0;
    var ALLOC_STATIC = 2;
    var ALLOC_NONE = 4;
    function allocate(slab, types, allocator, ptr) {
        var zeroinit, size;
        if (typeof slab === 'number') {
            zeroinit = true;
            size = slab;
        } else {
            zeroinit = false;
            size = slab.length;
        }
        var singleType = typeof types === 'string' ? types : null;
        var ret;
        if (allocator == ALLOC_NONE) {
            ret = ptr;
        } else {
            ret = [
                typeof _malloc === 'function' ? _malloc : staticAlloc,
                stackAlloc,
                staticAlloc,
                dynamicAlloc
            ][allocator === undefined ? ALLOC_STATIC : allocator](
                Math.max(size, singleType ? 1 : types.length)
            );
        }
        if (zeroinit) {
            var stop;
            ptr = ret;
            assert((ret & 3) == 0);
            stop = ret + (size & ~3);
            for (; ptr < stop; ptr += 4) {
                HEAP32[ptr >> 2] = 0;
            }
            stop = ret + size;
            while (ptr < stop) {
                HEAP8[ptr++ >> 0] = 0;
            }
            return ret;
        }
        if (singleType === 'i8') {
            if (slab.subarray || slab.slice) {
                HEAPU8.set(slab, ret);
            } else {
                HEAPU8.set(new Uint8Array(slab), ret);
            }
            return ret;
        }
        var i = 0,
            type,
            typeSize,
            previousType;
        while (i < size) {
            var curr = slab[i];
            type = singleType || types[i];
            if (type === 0) {
                i++;
                continue;
            }
            if (type == 'i64') type = 'i32';
            setValue(ret + i, curr, type);
            if (previousType !== type) {
                typeSize = getNativeTypeSize(type);
                previousType = type;
            }
            i += typeSize;
        }
        return ret;
    }
    function Pointer_stringify(ptr, length) {
        if (length === 0 || !ptr) return '';
        var hasUtf = 0;
        var t;
        var i = 0;
        while (1) {
            t = HEAPU8[(ptr + i) >> 0];
            hasUtf |= t;
            if (t == 0 && !length) break;
            i++;
            if (length && i == length) break;
        }
        if (!length) length = i;
        var ret = '';
        if (hasUtf < 128) {
            var MAX_CHUNK = 1024;
            var curr;
            while (length > 0) {
                curr = String.fromCharCode.apply(
                    String,
                    HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK))
                );
                ret = ret ? ret + curr : curr;
                ptr += MAX_CHUNK;
                length -= MAX_CHUNK;
            }
            return ret;
        }
        return UTF8ToString(ptr);
    }
    var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
    function UTF8ArrayToString(u8Array, idx) {
        var endPtr = idx;
        while (u8Array[endPtr]) ++endPtr;
        if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
            return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
        } else {
            var u0, u1, u2, u3, u4, u5;
            var str = '';
            while (1) {
                u0 = u8Array[idx++];
                if (!u0) return str;
                if (!(u0 & 128)) {
                    str += String.fromCharCode(u0);
                    continue;
                }
                u1 = u8Array[idx++] & 63;
                if ((u0 & 224) == 192) {
                    str += String.fromCharCode(((u0 & 31) << 6) | u1);
                    continue;
                }
                u2 = u8Array[idx++] & 63;
                if ((u0 & 240) == 224) {
                    u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
                } else {
                    u3 = u8Array[idx++] & 63;
                    if ((u0 & 248) == 240) {
                        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
                    } else {
                        u4 = u8Array[idx++] & 63;
                        if ((u0 & 252) == 248) {
                            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
                        } else {
                            u5 = u8Array[idx++] & 63;
                            u0 =
                                ((u0 & 1) << 30) |
                                (u1 << 24) |
                                (u2 << 18) |
                                (u3 << 12) |
                                (u4 << 6) |
                                u5;
                        }
                    }
                }
                if (u0 < 65536) {
                    str += String.fromCharCode(u0);
                } else {
                    var ch = u0 - 65536;
                    str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
                }
            }
        }
    }
    function UTF8ToString(ptr) {
        return UTF8ArrayToString(HEAPU8, ptr);
    }
    function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
        if (!(maxBytesToWrite > 0)) return 0;
        var startIdx = outIdx;
        var endIdx = outIdx + maxBytesToWrite - 1;
        for (var i = 0; i < str.length; ++i) {
            var u = str.charCodeAt(i);
            if (u >= 55296 && u <= 57343)
                u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
            if (u <= 127) {
                if (outIdx >= endIdx) break;
                outU8Array[outIdx++] = u;
            } else if (u <= 2047) {
                if (outIdx + 1 >= endIdx) break;
                outU8Array[outIdx++] = 192 | (u >> 6);
                outU8Array[outIdx++] = 128 | (u & 63);
            } else if (u <= 65535) {
                if (outIdx + 2 >= endIdx) break;
                outU8Array[outIdx++] = 224 | (u >> 12);
                outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
                outU8Array[outIdx++] = 128 | (u & 63);
            } else if (u <= 2097151) {
                if (outIdx + 3 >= endIdx) break;
                outU8Array[outIdx++] = 240 | (u >> 18);
                outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
                outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
                outU8Array[outIdx++] = 128 | (u & 63);
            } else if (u <= 67108863) {
                if (outIdx + 4 >= endIdx) break;
                outU8Array[outIdx++] = 248 | (u >> 24);
                outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
                outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
                outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
                outU8Array[outIdx++] = 128 | (u & 63);
            } else {
                if (outIdx + 5 >= endIdx) break;
                outU8Array[outIdx++] = 252 | (u >> 30);
                outU8Array[outIdx++] = 128 | ((u >> 24) & 63);
                outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
                outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
                outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
                outU8Array[outIdx++] = 128 | (u & 63);
            }
        }
        outU8Array[outIdx] = 0;
        return outIdx - startIdx;
    }
    function lengthBytesUTF8(str) {
        var len = 0;
        for (var i = 0; i < str.length; ++i) {
            var u = str.charCodeAt(i);
            if (u >= 55296 && u <= 57343)
                u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
            if (u <= 127) {
                ++len;
            } else if (u <= 2047) {
                len += 2;
            } else if (u <= 65535) {
                len += 3;
            } else if (u <= 2097151) {
                len += 4;
            } else if (u <= 67108863) {
                len += 5;
            } else {
                len += 6;
            }
        }
        return len;
    }
    var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
    function allocateUTF8(str) {
        var size = lengthBytesUTF8(str) + 1;
        var ret = _malloc(size);
        if (ret) stringToUTF8Array(str, HEAP8, ret, size);
        return ret;
    }
    var WASM_PAGE_SIZE = 65536;
    var ASMJS_PAGE_SIZE = 16777216;
    var MIN_TOTAL_MEMORY = 16777216;
    function alignUp(x, multiple) {
        if (x % multiple > 0) {
            x += multiple - (x % multiple);
        }
        return x;
    }
    var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
    function updateGlobalBuffer(buf) {
        Module['buffer'] = buffer = buf;
    }
    function updateGlobalBufferViews() {
        Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
        Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
        Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
        Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
        Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
        Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
        Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
        Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
    }
    var STATIC_BASE, STATICTOP, staticSealed;
    var STACK_BASE, STACKTOP, STACK_MAX;
    var DYNAMIC_BASE, DYNAMICTOP_PTR;
    STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
    staticSealed = false;
    function abortOnCannotGrowMemory() {
        abort(
            'Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' +
                TOTAL_MEMORY +
                ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 '
        );
    }
    if (!Module['reallocBuffer'])
        Module['reallocBuffer'] = function(size) {
            var ret;
            try {
                if (ArrayBuffer.transfer) {
                    ret = ArrayBuffer.transfer(buffer, size);
                } else {
                    var oldHEAP8 = HEAP8;
                    ret = new ArrayBuffer(size);
                    var temp = new Int8Array(ret);
                    temp.set(oldHEAP8);
                }
            } catch (e) {
                return false;
            }
            var success = _emscripten_replace_memory(ret);
            if (!success) return false;
            return ret;
        };
    function enlargeMemory() {
        var PAGE_MULTIPLE = Module['usingWasm'] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
        var LIMIT = 2147483648 - PAGE_MULTIPLE;
        if (HEAP32[DYNAMICTOP_PTR >> 2] > LIMIT) {
            return false;
        }
        var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
        TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY);
        while (TOTAL_MEMORY < HEAP32[DYNAMICTOP_PTR >> 2]) {
            if (TOTAL_MEMORY <= 536870912) {
                TOTAL_MEMORY = alignUp(2 * TOTAL_MEMORY, PAGE_MULTIPLE);
            } else {
                TOTAL_MEMORY = Math.min(
                    alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, PAGE_MULTIPLE),
                    LIMIT
                );
            }
        }
        var replacement = Module['reallocBuffer'](TOTAL_MEMORY);
        if (!replacement || replacement.byteLength != TOTAL_MEMORY) {
            TOTAL_MEMORY = OLD_TOTAL_MEMORY;
            return false;
        }
        updateGlobalBuffer(replacement);
        updateGlobalBufferViews();
        return true;
    }
    var byteLength;
    try {
        byteLength = Function.prototype.call.bind(
            Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get
        );
        byteLength(new ArrayBuffer(4));
    } catch (e) {
        byteLength = function(buffer) {
            return buffer.byteLength;
        };
    }
    var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
    var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
    if (TOTAL_MEMORY < TOTAL_STACK)
        Module.printErr(
            'TOTAL_MEMORY should be larger than TOTAL_STACK, was ' +
                TOTAL_MEMORY +
                '! (TOTAL_STACK=' +
                TOTAL_STACK +
                ')'
        );
    if (Module['buffer']) {
        buffer = Module['buffer'];
    } else {
        if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
            Module['wasmMemory'] = new WebAssembly.Memory({
                initial: TOTAL_MEMORY / WASM_PAGE_SIZE
            });
            buffer = Module['wasmMemory'].buffer;
        } else {
            buffer = new ArrayBuffer(TOTAL_MEMORY);
        }
        Module['buffer'] = buffer;
    }
    updateGlobalBufferViews();
    function getTotalMemory() {
        return TOTAL_MEMORY;
    }
    HEAP32[0] = 1668509029;
    HEAP16[1] = 25459;
    if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99)
        throw 'Runtime error: expected the system to be little-endian!';
    function callRuntimeCallbacks(callbacks) {
        while (callbacks.length > 0) {
            var callback = callbacks.shift();
            if (typeof callback === 'function') {
                callback();
                continue;
            }
            var func = callback.func;
            if (typeof func === 'number') {
                if (callback.arg === undefined) {
                    Module['dynCall_v'](func);
                } else {
                    Module['dynCall_vi'](func, callback.arg);
                }
            } else {
                func(callback.arg === undefined ? null : callback.arg);
            }
        }
    }
    var __ATPRERUN__ = [];
    var __ATINIT__ = [];
    var __ATMAIN__ = [];
    var __ATEXIT__ = [];
    var __ATPOSTRUN__ = [];
    var runtimeInitialized = false;
    var runtimeExited = false;
    function preRun() {
        if (Module['preRun']) {
            if (typeof Module['preRun'] === 'function') Module['preRun'] = [Module['preRun']];
            while (Module['preRun'].length) {
                addOnPreRun(Module['preRun'].shift());
            }
        }
        callRuntimeCallbacks(__ATPRERUN__);
    }
    function ensureInitRuntime() {
        if (runtimeInitialized) return;
        runtimeInitialized = true;
        callRuntimeCallbacks(__ATINIT__);
    }
    function preMain() {
        callRuntimeCallbacks(__ATMAIN__);
    }
    function exitRuntime() {
        callRuntimeCallbacks(__ATEXIT__);
        runtimeExited = true;
    }
    function postRun() {
        if (Module['postRun']) {
            if (typeof Module['postRun'] === 'function') Module['postRun'] = [Module['postRun']];
            while (Module['postRun'].length) {
                addOnPostRun(Module['postRun'].shift());
            }
        }
        callRuntimeCallbacks(__ATPOSTRUN__);
    }
    function addOnPreRun(cb) {
        __ATPRERUN__.unshift(cb);
    }
    function addOnPostRun(cb) {
        __ATPOSTRUN__.unshift(cb);
    }
    function writeArrayToMemory(array, buffer) {
        HEAP8.set(array, buffer);
    }
    function writeAsciiToMemory(str, buffer, dontAddNull) {
        for (var i = 0; i < str.length; ++i) {
            HEAP8[buffer++ >> 0] = str.charCodeAt(i);
        }
        if (!dontAddNull) HEAP8[buffer >> 0] = 0;
    }
    var Math_abs = Math.abs;
    var Math_cos = Math.cos;
    var Math_sin = Math.sin;
    var Math_tan = Math.tan;
    var Math_acos = Math.acos;
    var Math_asin = Math.asin;
    var Math_atan = Math.atan;
    var Math_atan2 = Math.atan2;
    var Math_exp = Math.exp;
    var Math_log = Math.log;
    var Math_sqrt = Math.sqrt;
    var Math_ceil = Math.ceil;
    var Math_floor = Math.floor;
    var Math_pow = Math.pow;
    var Math_imul = Math.imul;
    var Math_fround = Math.fround;
    var Math_round = Math.round;
    var Math_min = Math.min;
    var Math_max = Math.max;
    var Math_clz32 = Math.clz32;
    var Math_trunc = Math.trunc;
    var runDependencies = 0;
    var runDependencyWatcher = null;
    var dependenciesFulfilled = null;
    function addRunDependency(id) {
        runDependencies++;
        if (Module['monitorRunDependencies']) {
            Module['monitorRunDependencies'](runDependencies);
        }
    }
    function removeRunDependency(id) {
        runDependencies--;
        if (Module['monitorRunDependencies']) {
            Module['monitorRunDependencies'](runDependencies);
        }
        if (runDependencies == 0) {
            if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
            }
            if (dependenciesFulfilled) {
                var callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback();
            }
        }
    }
    Module['preloadedImages'] = {};
    Module['preloadedAudios'] = {};
    var dataURIPrefix = 'data:application/octet-stream;base64,';
    function isDataURI(filename) {
        return String.prototype.startsWith
            ? filename.startsWith(dataURIPrefix)
            : filename.indexOf(dataURIPrefix) === 0;
    }
    function integrateWasmJS() {
        var wasmTextFile = 'WasmEncoder1c.wast';
        var wasmBinaryFile = 'WasmEncoder1c.wasm';
        var asmjsCodeFile = 'WasmEncoder1c.temp.asm.js';
        if (typeof Module['locateFile'] === 'function') {
            if (!isDataURI(wasmTextFile)) {
                wasmTextFile = Module['locateFile'](wasmTextFile);
            }
            if (!isDataURI(wasmBinaryFile)) {
                wasmBinaryFile = Module['locateFile'](wasmBinaryFile);
            }
            if (!isDataURI(asmjsCodeFile)) {
                asmjsCodeFile = Module['locateFile'](asmjsCodeFile);
            }
        }
        var wasmPageSize = 64 * 1024;
        var info = {
            global: null,
            env: null,
            asm2wasm: {
                'f64-rem': function(x, y) {
                    return x % y;
                },
                debugger: function() {
                    debugger;
                }
            },
            parent: Module
        };
        var exports = null;
        function mergeMemory(newBuffer) {
            var oldBuffer = Module['buffer'];
            if (newBuffer.byteLength < oldBuffer.byteLength) {
                Module['printErr'](
                    'the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here'
                );
            }
            var oldView = new Int8Array(oldBuffer);
            var newView = new Int8Array(newBuffer);
            newView.set(oldView);
            updateGlobalBuffer(newBuffer);
            updateGlobalBufferViews();
        }
        function fixImports(imports) {
            return imports;
        }
        function getBinary() {
            try {
                if (Module['wasmBinary']) {
                    return new Uint8Array(Module['wasmBinary']);
                }
                if (Module['readBinary']) {
                    return Module['readBinary'](wasmBinaryFile);
                } else {
                    throw "on the web, we need the wasm binary to be preloaded and set on Module['wasmBinary']. emcc.py will do that for you when generating HTML (but not JS)";
                }
            } catch (err) {
                abort(err);
            }
        }
        function getBinaryPromise() {
            if (
                !Module['wasmBinary'] &&
                (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
                typeof fetch === 'function'
            ) {
                return fetch(wasmBinaryFile, { credentials: 'same-origin' })
                    .then(function(response) {
                        if (!response['ok']) {
                            throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
                        }
                        return response['arrayBuffer']();
                    })
                    .catch(function() {
                        return getBinary();
                    });
            }
            return new Promise(function(resolve, reject) {
                resolve(getBinary());
            });
        }
        function doNativeWasm(global, env, providedBuffer) {
            if (typeof WebAssembly !== 'object') {
                Module['printErr']('no native wasm support detected');
                return false;
            }
            if (!(Module['wasmMemory'] instanceof WebAssembly.Memory)) {
                Module['printErr']('no native wasm Memory in use');
                return false;
            }
            env['memory'] = Module['wasmMemory'];
            info['global'] = { NaN: NaN, Infinity: Infinity };
            info['global.Math'] = Math;
            info['env'] = env;
            function receiveInstance(instance, module) {
                exports = instance.exports;
                if (exports.memory) mergeMemory(exports.memory);
                Module['asm'] = exports;
                Module['usingWasm'] = true;
                removeRunDependency('wasm-instantiate');
            }
            addRunDependency('wasm-instantiate');
            if (Module['instantiateWasm']) {
                try {
                    return Module['instantiateWasm'](info, receiveInstance);
                } catch (e) {
                    Module['printErr']('Module.instantiateWasm callback failed with error: ' + e);
                    return false;
                }
            }
            function receiveInstantiatedSource(output) {
                receiveInstance(output['instance'], output['module']);
            }
            function instantiateArrayBuffer(receiver) {
                getBinaryPromise()
                    .then(function(binary) {
                        return WebAssembly.instantiate(binary, info);
                    })
                    .then(receiver)
                    .catch(function(reason) {
                        Module['printErr']('failed to asynchronously prepare wasm: ' + reason);
                        abort(reason);
                    });
            }
            if (
                !Module['wasmBinary'] &&
                typeof WebAssembly.instantiateStreaming === 'function' &&
                !isDataURI(wasmBinaryFile) &&
                typeof fetch === 'function'
            ) {
                WebAssembly.instantiateStreaming(
                    fetch(wasmBinaryFile, { credentials: 'same-origin' }),
                    info
                )
                    .then(receiveInstantiatedSource)
                    .catch(function(reason) {
                        Module['printErr']('wasm streaming compile failed: ' + reason);
                        Module['printErr']('falling back to ArrayBuffer instantiation');
                        instantiateArrayBuffer(receiveInstantiatedSource);
                    });
            } else {
                instantiateArrayBuffer(receiveInstantiatedSource);
            }
            return {};
        }
        Module['asmPreload'] = Module['asm'];
        var asmjsReallocBuffer = Module['reallocBuffer'];
        var wasmReallocBuffer = function(size) {
            var PAGE_MULTIPLE = Module['usingWasm'] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
            size = alignUp(size, PAGE_MULTIPLE);
            var old = Module['buffer'];
            var oldSize = old.byteLength;
            if (Module['usingWasm']) {
                try {
                    var result = Module['wasmMemory'].grow((size - oldSize) / wasmPageSize);
                    if (result !== (-1 | 0)) {
                        return (Module['buffer'] = Module['wasmMemory'].buffer);
                    } else {
                        return null;
                    }
                } catch (e) {
                    return null;
                }
            }
        };
        Module['reallocBuffer'] = function(size) {
            if (finalMethod === 'asmjs') {
                return asmjsReallocBuffer(size);
            } else {
                return wasmReallocBuffer(size);
            }
        };
        var finalMethod = '';
        Module['asm'] = function(global, env, providedBuffer) {
            env = fixImports(env);
            if (!env['table']) {
                var TABLE_SIZE = Module['wasmTableSize'];
                if (TABLE_SIZE === undefined) TABLE_SIZE = 1024;
                var MAX_TABLE_SIZE = Module['wasmMaxTableSize'];
                if (typeof WebAssembly === 'object' && typeof WebAssembly.Table === 'function') {
                    if (MAX_TABLE_SIZE !== undefined) {
                        env['table'] = new WebAssembly.Table({
                            initial: TABLE_SIZE,
                            maximum: MAX_TABLE_SIZE,
                            element: 'anyfunc'
                        });
                    } else {
                        env['table'] = new WebAssembly.Table({
                            initial: TABLE_SIZE,
                            element: 'anyfunc'
                        });
                    }
                } else {
                    env['table'] = new Array(TABLE_SIZE);
                }
                Module['wasmTable'] = env['table'];
            }
            if (!env['memoryBase']) {
                env['memoryBase'] = Module['STATIC_BASE'];
            }
            if (!env['tableBase']) {
                env['tableBase'] = 0;
            }
            var exports;
            exports = doNativeWasm(global, env, providedBuffer);
            if (!exports)
                abort(
                    'no binaryen method succeeded. consider enabling more options, like interpreting, if you want that: https://github.com/kripken/emscripten/wiki/WebAssembly#binaryen-methods'
                );
            return exports;
        };
    }
    integrateWasmJS();
    STATIC_BASE = GLOBAL_BASE;
    STATICTOP = STATIC_BASE + 1992288;
    __ATINIT__.push();
    var STATIC_BUMP = 1992288;
    Module['STATIC_BASE'] = STATIC_BASE;
    Module['STATIC_BUMP'] = STATIC_BUMP;
    STATICTOP += 16;
    function ___assert_fail(condition, filename, line, func) {
        abort(
            'Assertion failed: ' +
                Pointer_stringify(condition) +
                ', at: ' +
                [
                    filename ? Pointer_stringify(filename) : 'unknown filename',
                    line,
                    func ? Pointer_stringify(func) : 'unknown function'
                ]
        );
    }
    function ___lock() {}
    var SYSCALLS = {
        varargs: 0,
        get: function(varargs) {
            SYSCALLS.varargs += 4;
            var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
            return ret;
        },
        getStr: function() {
            var ret = Pointer_stringify(SYSCALLS.get());
            return ret;
        },
        get64: function() {
            var low = SYSCALLS.get(),
                high = SYSCALLS.get();
            if (low >= 0) assert(high === 0);
            else assert(high === -1);
            return low;
        },
        getZero: function() {
            assert(SYSCALLS.get() === 0);
        }
    };
    function ___syscall140(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.getStreamFromFD(),
                offset_high = SYSCALLS.get(),
                offset_low = SYSCALLS.get(),
                result = SYSCALLS.get(),
                whence = SYSCALLS.get();
            var offset = offset_low;
            FS.llseek(stream, offset, whence);
            HEAP32[result >> 2] = stream.position;
            if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall145(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.getStreamFromFD(),
                iov = SYSCALLS.get(),
                iovcnt = SYSCALLS.get();
            return SYSCALLS.doReadv(stream, iov, iovcnt);
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall146(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.get(),
                iov = SYSCALLS.get(),
                iovcnt = SYSCALLS.get();
            var ret = 0;
            if (!___syscall146.buffers) {
                ___syscall146.buffers = [null, [], []];
                ___syscall146.printChar = function(stream, curr) {
                    var buffer = ___syscall146.buffers[stream];
                    assert(buffer);
                    if (curr === 0 || curr === 10) {
                        (stream === 1 ? Module['print'] : Module['printErr'])(
                            UTF8ArrayToString(buffer, 0)
                        );
                        buffer.length = 0;
                    } else {
                        buffer.push(curr);
                    }
                };
            }
            for (var i = 0; i < iovcnt; i++) {
                var ptr = HEAP32[(iov + i * 8) >> 2];
                var len = HEAP32[(iov + (i * 8 + 4)) >> 2];
                for (var j = 0; j < len; j++) {
                    ___syscall146.printChar(stream, HEAPU8[ptr + j]);
                }
                ret += len;
            }
            return ret;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall195(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var path = SYSCALLS.getStr(),
                buf = SYSCALLS.get();
            return SYSCALLS.doStat(FS.stat, path, buf);
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall197(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.getStreamFromFD(),
                buf = SYSCALLS.get();
            return SYSCALLS.doStat(FS.stat, stream.path, buf);
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall219(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___setErrNo(value) {
        if (Module['___errno_location']) HEAP32[Module['___errno_location']() >> 2] = value;
        return value;
    }
    function ___syscall221(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall3(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.getStreamFromFD(),
                buf = SYSCALLS.get(),
                count = SYSCALLS.get();
            return FS.read(stream, HEAP8, buf, count);
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall38(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var old_path = SYSCALLS.getStr(),
                new_path = SYSCALLS.getStr();
            FS.rename(old_path, new_path);
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall5(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var pathname = SYSCALLS.getStr(),
                flags = SYSCALLS.get(),
                mode = SYSCALLS.get();
            var stream = FS.open(pathname, flags, mode);
            return stream.fd;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall54(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___syscall6(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.getStreamFromFD();
            FS.close(stream);
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
            return -e.errno;
        }
    }
    function ___unlock() {}
    function _abort() {
        Module['abort']();
    }
    function _clock() {
        if (_clock.start === undefined) _clock.start = Date.now();
        return ((Date.now() - _clock.start) * (1e6 / 1e3)) | 0;
    }
    function _emscripten_get_now() {
        abort();
    }
    function _emscripten_get_now_is_monotonic() {
        return (
            ENVIRONMENT_IS_NODE ||
            typeof dateNow !== 'undefined' ||
            ((ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
                self['performance'] &&
                self['performance']['now'])
        );
    }
    var ERRNO_CODES = {
        EPERM: 1,
        ENOENT: 2,
        ESRCH: 3,
        EINTR: 4,
        EIO: 5,
        ENXIO: 6,
        E2BIG: 7,
        ENOEXEC: 8,
        EBADF: 9,
        ECHILD: 10,
        EAGAIN: 11,
        EWOULDBLOCK: 11,
        ENOMEM: 12,
        EACCES: 13,
        EFAULT: 14,
        ENOTBLK: 15,
        EBUSY: 16,
        EEXIST: 17,
        EXDEV: 18,
        ENODEV: 19,
        ENOTDIR: 20,
        EISDIR: 21,
        EINVAL: 22,
        ENFILE: 23,
        EMFILE: 24,
        ENOTTY: 25,
        ETXTBSY: 26,
        EFBIG: 27,
        ENOSPC: 28,
        ESPIPE: 29,
        EROFS: 30,
        EMLINK: 31,
        EPIPE: 32,
        EDOM: 33,
        ERANGE: 34,
        ENOMSG: 42,
        EIDRM: 43,
        ECHRNG: 44,
        EL2NSYNC: 45,
        EL3HLT: 46,
        EL3RST: 47,
        ELNRNG: 48,
        EUNATCH: 49,
        ENOCSI: 50,
        EL2HLT: 51,
        EDEADLK: 35,
        ENOLCK: 37,
        EBADE: 52,
        EBADR: 53,
        EXFULL: 54,
        ENOANO: 55,
        EBADRQC: 56,
        EBADSLT: 57,
        EDEADLOCK: 35,
        EBFONT: 59,
        ENOSTR: 60,
        ENODATA: 61,
        ETIME: 62,
        ENOSR: 63,
        ENONET: 64,
        ENOPKG: 65,
        EREMOTE: 66,
        ENOLINK: 67,
        EADV: 68,
        ESRMNT: 69,
        ECOMM: 70,
        EPROTO: 71,
        EMULTIHOP: 72,
        EDOTDOT: 73,
        EBADMSG: 74,
        ENOTUNIQ: 76,
        EBADFD: 77,
        EREMCHG: 78,
        ELIBACC: 79,
        ELIBBAD: 80,
        ELIBSCN: 81,
        ELIBMAX: 82,
        ELIBEXEC: 83,
        ENOSYS: 38,
        ENOTEMPTY: 39,
        ENAMETOOLONG: 36,
        ELOOP: 40,
        EOPNOTSUPP: 95,
        EPFNOSUPPORT: 96,
        ECONNRESET: 104,
        ENOBUFS: 105,
        EAFNOSUPPORT: 97,
        EPROTOTYPE: 91,
        ENOTSOCK: 88,
        ENOPROTOOPT: 92,
        ESHUTDOWN: 108,
        ECONNREFUSED: 111,
        EADDRINUSE: 98,
        ECONNABORTED: 103,
        ENETUNREACH: 101,
        ENETDOWN: 100,
        ETIMEDOUT: 110,
        EHOSTDOWN: 112,
        EHOSTUNREACH: 113,
        EINPROGRESS: 115,
        EALREADY: 114,
        EDESTADDRREQ: 89,
        EMSGSIZE: 90,
        EPROTONOSUPPORT: 93,
        ESOCKTNOSUPPORT: 94,
        EADDRNOTAVAIL: 99,
        ENETRESET: 102,
        EISCONN: 106,
        ENOTCONN: 107,
        ETOOMANYREFS: 109,
        EUSERS: 87,
        EDQUOT: 122,
        ESTALE: 116,
        ENOTSUP: 95,
        ENOMEDIUM: 123,
        EILSEQ: 84,
        EOVERFLOW: 75,
        ECANCELED: 125,
        ENOTRECOVERABLE: 131,
        EOWNERDEAD: 130,
        ESTRPIPE: 86
    };
    function _clock_gettime(clk_id, tp) {
        var now;
        if (clk_id === 0) {
            now = Date.now();
        } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
            now = _emscripten_get_now();
        } else {
            ___setErrNo(ERRNO_CODES.EINVAL);
            return -1;
        }
        HEAP32[tp >> 2] = (now / 1e3) | 0;
        HEAP32[(tp + 4) >> 2] = ((now % 1e3) * 1e3 * 1e3) | 0;
        return 0;
    }
    function __exit(status) {
        Module['exit'](status);
    }
    function _exit(status) {
        __exit(status);
    }
    var _fabs = Math_abs;
    var _environ = STATICTOP;
    STATICTOP += 16;
    function ___buildEnvironment(env) {
        var MAX_ENV_VALUES = 64;
        var TOTAL_ENV_SIZE = 1024;
        var poolPtr;
        var envPtr;
        if (!___buildEnvironment.called) {
            ___buildEnvironment.called = true;
            ENV['USER'] = ENV['LOGNAME'] = 'web_user';
            ENV['PATH'] = '/';
            ENV['PWD'] = '/';
            ENV['HOME'] = '/home/web_user';
            ENV['LANG'] = 'C.UTF-8';
            ENV['_'] = Module['thisProgram'];
            poolPtr = staticAlloc(TOTAL_ENV_SIZE);
            envPtr = staticAlloc(MAX_ENV_VALUES * 4);
            HEAP32[envPtr >> 2] = poolPtr;
            HEAP32[_environ >> 2] = envPtr;
        } else {
            envPtr = HEAP32[_environ >> 2];
            poolPtr = HEAP32[envPtr >> 2];
        }
        var strings = [];
        var totalSize = 0;
        for (var key in env) {
            if (typeof env[key] === 'string') {
                var line = key + '=' + env[key];
                strings.push(line);
                totalSize += line.length;
            }
        }
        if (totalSize > TOTAL_ENV_SIZE) {
            throw new Error('Environment size exceeded TOTAL_ENV_SIZE!');
        }
        var ptrSize = 4;
        for (var i = 0; i < strings.length; i++) {
            var line = strings[i];
            writeAsciiToMemory(line, poolPtr);
            HEAP32[(envPtr + i * ptrSize) >> 2] = poolPtr;
            poolPtr += line.length + 1;
        }
        HEAP32[(envPtr + strings.length * ptrSize) >> 2] = 0;
    }
    var ENV = {};
    function _getenv(name) {
        if (name === 0) return 0;
        name = Pointer_stringify(name);
        if (!ENV.hasOwnProperty(name)) return 0;
        if (_getenv.ret) _free(_getenv.ret);
        _getenv.ret = allocateUTF8(ENV[name]);
        return _getenv.ret;
    }
    function _gettimeofday(ptr) {
        var now = Date.now();
        HEAP32[ptr >> 2] = (now / 1e3) | 0;
        HEAP32[(ptr + 4) >> 2] = ((now % 1e3) * 1e3) | 0;
        return 0;
    }
    var ___tm_timezone = allocate(intArrayFromString('GMT'), 'i8', ALLOC_STATIC);
    function _gmtime_r(time, tmPtr) {
        var date = new Date(HEAP32[time >> 2] * 1e3);
        HEAP32[tmPtr >> 2] = date.getUTCSeconds();
        HEAP32[(tmPtr + 4) >> 2] = date.getUTCMinutes();
        HEAP32[(tmPtr + 8) >> 2] = date.getUTCHours();
        HEAP32[(tmPtr + 12) >> 2] = date.getUTCDate();
        HEAP32[(tmPtr + 16) >> 2] = date.getUTCMonth();
        HEAP32[(tmPtr + 20) >> 2] = date.getUTCFullYear() - 1900;
        HEAP32[(tmPtr + 24) >> 2] = date.getUTCDay();
        HEAP32[(tmPtr + 36) >> 2] = 0;
        HEAP32[(tmPtr + 32) >> 2] = 0;
        var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
        var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
        HEAP32[(tmPtr + 28) >> 2] = yday;
        HEAP32[(tmPtr + 40) >> 2] = ___tm_timezone;
        return tmPtr;
    }
    var cttz_i8 = allocate(
        [
            8,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            4,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            5,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            4,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            6,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            4,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            5,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            4,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            7,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            4,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            5,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            4,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            6,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            4,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            5,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            4,
            0,
            1,
            0,
            2,
            0,
            1,
            0,
            3,
            0,
            1,
            0,
            2,
            0,
            1,
            0
        ],
        'i8',
        ALLOC_STATIC
    );
    function _llvm_exp2_f32(x) {
        return Math.pow(2, x);
    }
    function _llvm_exp2_f64() {
        return _llvm_exp2_f32.apply(null, arguments);
    }
    var _llvm_trunc_f64 = Math_trunc;
    var _tzname = STATICTOP;
    STATICTOP += 16;
    var _daylight = STATICTOP;
    STATICTOP += 16;
    var _timezone = STATICTOP;
    STATICTOP += 16;
    function _tzset() {
        if (_tzset.called) return;
        _tzset.called = true;
        HEAP32[_timezone >> 2] = new Date().getTimezoneOffset() * 60;
        var winter = new Date(2e3, 0, 1);
        var summer = new Date(2e3, 6, 1);
        HEAP32[_daylight >> 2] = Number(winter.getTimezoneOffset() != summer.getTimezoneOffset());
        function extractZone(date) {
            var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
            return match ? match[1] : 'GMT';
        }
        var winterName = extractZone(winter);
        var summerName = extractZone(summer);
        var winterNamePtr = allocate(intArrayFromString(winterName), 'i8', ALLOC_NORMAL);
        var summerNamePtr = allocate(intArrayFromString(summerName), 'i8', ALLOC_NORMAL);
        if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
            HEAP32[_tzname >> 2] = winterNamePtr;
            HEAP32[(_tzname + 4) >> 2] = summerNamePtr;
        } else {
            HEAP32[_tzname >> 2] = summerNamePtr;
            HEAP32[(_tzname + 4) >> 2] = winterNamePtr;
        }
    }
    function _localtime_r(time, tmPtr) {
        _tzset();
        var date = new Date(HEAP32[time >> 2] * 1e3);
        HEAP32[tmPtr >> 2] = date.getSeconds();
        HEAP32[(tmPtr + 4) >> 2] = date.getMinutes();
        HEAP32[(tmPtr + 8) >> 2] = date.getHours();
        HEAP32[(tmPtr + 12) >> 2] = date.getDate();
        HEAP32[(tmPtr + 16) >> 2] = date.getMonth();
        HEAP32[(tmPtr + 20) >> 2] = date.getFullYear() - 1900;
        HEAP32[(tmPtr + 24) >> 2] = date.getDay();
        var start = new Date(date.getFullYear(), 0, 1);
        var yday = ((date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24)) | 0;
        HEAP32[(tmPtr + 28) >> 2] = yday;
        HEAP32[(tmPtr + 36) >> 2] = -(date.getTimezoneOffset() * 60);
        var summerOffset = new Date(2e3, 6, 1).getTimezoneOffset();
        var winterOffset = start.getTimezoneOffset();
        var dst =
            (summerOffset != winterOffset &&
                date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
        HEAP32[(tmPtr + 32) >> 2] = dst;
        var zonePtr = HEAP32[(_tzname + (dst ? 4 : 0)) >> 2];
        HEAP32[(tmPtr + 40) >> 2] = zonePtr;
        return tmPtr;
    }
    function _emscripten_memcpy_big(dest, src, num) {
        HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
        return dest;
    }
    function _mktime(tmPtr) {
        _tzset();
        var date = new Date(
            HEAP32[(tmPtr + 20) >> 2] + 1900,
            HEAP32[(tmPtr + 16) >> 2],
            HEAP32[(tmPtr + 12) >> 2],
            HEAP32[(tmPtr + 8) >> 2],
            HEAP32[(tmPtr + 4) >> 2],
            HEAP32[tmPtr >> 2],
            0
        );
        var dst = HEAP32[(tmPtr + 32) >> 2];
        var guessedOffset = date.getTimezoneOffset();
        var start = new Date(date.getFullYear(), 0, 1);
        var summerOffset = new Date(2e3, 6, 1).getTimezoneOffset();
        var winterOffset = start.getTimezoneOffset();
        var dstOffset = Math.min(winterOffset, summerOffset);
        if (dst < 0) {
            HEAP32[(tmPtr + 32) >> 2] = Number(
                summerOffset != winterOffset && dstOffset == guessedOffset
            );
        } else if (dst > 0 != (dstOffset == guessedOffset)) {
            var nonDstOffset = Math.max(winterOffset, summerOffset);
            var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
            date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4);
        }
        HEAP32[(tmPtr + 24) >> 2] = date.getDay();
        var yday = ((date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24)) | 0;
        HEAP32[(tmPtr + 28) >> 2] = yday;
        return (date.getTime() / 1e3) | 0;
    }
    function _usleep(useconds) {
        var msec = useconds / 1e3;
        if (
            (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
            self['performance'] &&
            self['performance']['now']
        ) {
            var start = self['performance']['now']();
            while (self['performance']['now']() - start < msec) {}
        } else {
            var start = Date.now();
            while (Date.now() - start < msec) {}
        }
        return 0;
    }
    function _nanosleep(rqtp, rmtp) {
        var seconds = HEAP32[rqtp >> 2];
        var nanoseconds = HEAP32[(rqtp + 4) >> 2];
        if (rmtp !== 0) {
            HEAP32[rmtp >> 2] = 0;
            HEAP32[(rmtp + 4) >> 2] = 0;
        }
        return _usleep(seconds * 1e6 + nanoseconds / 1e3);
    }
    function __isLeapYear(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    function __arraySum(array, index) {
        var sum = 0;
        for (var i = 0; i <= index; sum += array[i++]);
        return sum;
    }
    var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function __addDays(date, days) {
        var newDate = new Date(date.getTime());
        while (days > 0) {
            var leap = __isLeapYear(newDate.getFullYear());
            var currentMonth = newDate.getMonth();
            var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[
                currentMonth
            ];
            if (days > daysInCurrentMonth - newDate.getDate()) {
                days -= daysInCurrentMonth - newDate.getDate() + 1;
                newDate.setDate(1);
                if (currentMonth < 11) {
                    newDate.setMonth(currentMonth + 1);
                } else {
                    newDate.setMonth(0);
                    newDate.setFullYear(newDate.getFullYear() + 1);
                }
            } else {
                newDate.setDate(newDate.getDate() + days);
                return newDate;
            }
        }
        return newDate;
    }
    function _strftime(s, maxsize, format, tm) {
        var tm_zone = HEAP32[(tm + 40) >> 2];
        var date = {
            tm_sec: HEAP32[tm >> 2],
            tm_min: HEAP32[(tm + 4) >> 2],
            tm_hour: HEAP32[(tm + 8) >> 2],
            tm_mday: HEAP32[(tm + 12) >> 2],
            tm_mon: HEAP32[(tm + 16) >> 2],
            tm_year: HEAP32[(tm + 20) >> 2],
            tm_wday: HEAP32[(tm + 24) >> 2],
            tm_yday: HEAP32[(tm + 28) >> 2],
            tm_isdst: HEAP32[(tm + 32) >> 2],
            tm_gmtoff: HEAP32[(tm + 36) >> 2],
            tm_zone: tm_zone ? Pointer_stringify(tm_zone) : ''
        };
        var pattern = Pointer_stringify(format);
        var EXPANSION_RULES_1 = {
            '%c': '%a %b %d %H:%M:%S %Y',
            '%D': '%m/%d/%y',
            '%F': '%Y-%m-%d',
            '%h': '%b',
            '%r': '%I:%M:%S %p',
            '%R': '%H:%M',
            '%T': '%H:%M:%S',
            '%x': '%m/%d/%y',
            '%X': '%H:%M:%S'
        };
        for (var rule in EXPANSION_RULES_1) {
            pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
        }
        var WEEKDAYS = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        ];
        var MONTHS = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December'
        ];
        function leadingSomething(value, digits, character) {
            var str = typeof value === 'number' ? value.toString() : value || '';
            while (str.length < digits) {
                str = character[0] + str;
            }
            return str;
        }
        function leadingNulls(value, digits) {
            return leadingSomething(value, digits, '0');
        }
        function compareByDay(date1, date2) {
            function sgn(value) {
                return value < 0 ? -1 : value > 0 ? 1 : 0;
            }
            var compare;
            if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
                if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
                    compare = sgn(date1.getDate() - date2.getDate());
                }
            }
            return compare;
        }
        function getFirstWeekStartDate(janFourth) {
            switch (janFourth.getDay()) {
                case 0:
                    return new Date(janFourth.getFullYear() - 1, 11, 29);
                case 1:
                    return janFourth;
                case 2:
                    return new Date(janFourth.getFullYear(), 0, 3);
                case 3:
                    return new Date(janFourth.getFullYear(), 0, 2);
                case 4:
                    return new Date(janFourth.getFullYear(), 0, 1);
                case 5:
                    return new Date(janFourth.getFullYear() - 1, 11, 31);
                case 6:
                    return new Date(janFourth.getFullYear() - 1, 11, 30);
            }
        }
        function getWeekBasedYear(date) {
            var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
            var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
            var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
            var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
            var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
            if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
                if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
                    return thisDate.getFullYear() + 1;
                } else {
                    return thisDate.getFullYear();
                }
            } else {
                return thisDate.getFullYear() - 1;
            }
        }
        var EXPANSION_RULES_2 = {
            '%a': function(date) {
                return WEEKDAYS[date.tm_wday].substring(0, 3);
            },
            '%A': function(date) {
                return WEEKDAYS[date.tm_wday];
            },
            '%b': function(date) {
                return MONTHS[date.tm_mon].substring(0, 3);
            },
            '%B': function(date) {
                return MONTHS[date.tm_mon];
            },
            '%C': function(date) {
                var year = date.tm_year + 1900;
                return leadingNulls((year / 100) | 0, 2);
            },
            '%d': function(date) {
                return leadingNulls(date.tm_mday, 2);
            },
            '%e': function(date) {
                return leadingSomething(date.tm_mday, 2, ' ');
            },
            '%g': function(date) {
                return getWeekBasedYear(date)
                    .toString()
                    .substring(2);
            },
            '%G': function(date) {
                return getWeekBasedYear(date);
            },
            '%H': function(date) {
                return leadingNulls(date.tm_hour, 2);
            },
            '%I': function(date) {
                var twelveHour = date.tm_hour;
                if (twelveHour == 0) twelveHour = 12;
                else if (twelveHour > 12) twelveHour -= 12;
                return leadingNulls(twelveHour, 2);
            },
            '%j': function(date) {
                return leadingNulls(
                    date.tm_mday +
                        __arraySum(
                            __isLeapYear(date.tm_year + 1900)
                                ? __MONTH_DAYS_LEAP
                                : __MONTH_DAYS_REGULAR,
                            date.tm_mon - 1
                        ),
                    3
                );
            },
            '%m': function(date) {
                return leadingNulls(date.tm_mon + 1, 2);
            },
            '%M': function(date) {
                return leadingNulls(date.tm_min, 2);
            },
            '%n': function() {
                return '\n';
            },
            '%p': function(date) {
                if (date.tm_hour >= 0 && date.tm_hour < 12) {
                    return 'AM';
                } else {
                    return 'PM';
                }
            },
            '%S': function(date) {
                return leadingNulls(date.tm_sec, 2);
            },
            '%t': function() {
                return '\t';
            },
            '%u': function(date) {
                var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
                return day.getDay() || 7;
            },
            '%U': function(date) {
                var janFirst = new Date(date.tm_year + 1900, 0, 1);
                var firstSunday =
                    janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
                var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
                if (compareByDay(firstSunday, endDate) < 0) {
                    var februaryFirstUntilEndMonth =
                        __arraySum(
                            __isLeapYear(endDate.getFullYear())
                                ? __MONTH_DAYS_LEAP
                                : __MONTH_DAYS_REGULAR,
                            endDate.getMonth() - 1
                        ) - 31;
                    var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
                    var days =
                        firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
                    return leadingNulls(Math.ceil(days / 7), 2);
                }
                return compareByDay(firstSunday, janFirst) === 0 ? '01' : '00';
            },
            '%V': function(date) {
                var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
                var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
                var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
                var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
                var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
                if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
                    return '53';
                }
                if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
                    return '01';
                }
                var daysDifference;
                if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
                    daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate();
                } else {
                    daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate();
                }
                return leadingNulls(Math.ceil(daysDifference / 7), 2);
            },
            '%w': function(date) {
                var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
                return day.getDay();
            },
            '%W': function(date) {
                var janFirst = new Date(date.tm_year, 0, 1);
                var firstMonday =
                    janFirst.getDay() === 1
                        ? janFirst
                        : __addDays(
                              janFirst,
                              janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1
                          );
                var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
                if (compareByDay(firstMonday, endDate) < 0) {
                    var februaryFirstUntilEndMonth =
                        __arraySum(
                            __isLeapYear(endDate.getFullYear())
                                ? __MONTH_DAYS_LEAP
                                : __MONTH_DAYS_REGULAR,
                            endDate.getMonth() - 1
                        ) - 31;
                    var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
                    var days =
                        firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
                    return leadingNulls(Math.ceil(days / 7), 2);
                }
                return compareByDay(firstMonday, janFirst) === 0 ? '01' : '00';
            },
            '%y': function(date) {
                return (date.tm_year + 1900).toString().substring(2);
            },
            '%Y': function(date) {
                return date.tm_year + 1900;
            },
            '%z': function(date) {
                var off = date.tm_gmtoff;
                var ahead = off >= 0;
                off = Math.abs(off) / 60;
                off = (off / 60) * 100 + (off % 60);
                return (ahead ? '+' : '-') + String('0000' + off).slice(-4);
            },
            '%Z': function(date) {
                return date.tm_zone;
            },
            '%%': function() {
                return '%';
            }
        };
        for (var rule in EXPANSION_RULES_2) {
            if (pattern.indexOf(rule) >= 0) {
                pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
            }
        }
        var bytes = intArrayFromString(pattern, false);
        if (bytes.length > maxsize) {
            return 0;
        }
        writeArrayToMemory(bytes, s);
        return bytes.length - 1;
    }
    if (ENVIRONMENT_IS_NODE) {
        _emscripten_get_now = function _emscripten_get_now_actual() {
            var t = process['hrtime']();
            return t[0] * 1e3 + t[1] / 1e6;
        };
    } else if (typeof dateNow !== 'undefined') {
        _emscripten_get_now = dateNow;
    } else if (
        typeof self === 'object' &&
        self['performance'] &&
        typeof self['performance']['now'] === 'function'
    ) {
        _emscripten_get_now = function() {
            return self['performance']['now']();
        };
    } else if (typeof performance === 'object' && typeof performance['now'] === 'function') {
        _emscripten_get_now = function() {
            return performance['now']();
        };
    } else {
        _emscripten_get_now = Date.now;
    }
    ___buildEnvironment(ENV);
    DYNAMICTOP_PTR = staticAlloc(4);
    STACK_BASE = STACKTOP = alignMemory(STATICTOP);
    STACK_MAX = STACK_BASE + TOTAL_STACK;
    DYNAMIC_BASE = alignMemory(STACK_MAX);
    HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
    staticSealed = true;
    function intArrayFromString(stringy, dontAddNull, length) {
        var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
        var u8array = new Array(len);
        var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
        if (dontAddNull) u8array.length = numBytesWritten;
        return u8array;
    }
    Module['wasmTableSize'] = 1194;
    Module['wasmMaxTableSize'] = 1194;
    Module.asmGlobalArg = {};
    Module.asmLibraryArg = {
        abort: abort,
        enlargeMemory: enlargeMemory,
        getTotalMemory: getTotalMemory,
        abortOnCannotGrowMemory: abortOnCannotGrowMemory,
        ___assert_fail: ___assert_fail,
        ___lock: ___lock,
        ___setErrNo: ___setErrNo,
        ___syscall140: ___syscall140,
        ___syscall145: ___syscall145,
        ___syscall146: ___syscall146,
        ___syscall195: ___syscall195,
        ___syscall197: ___syscall197,
        ___syscall219: ___syscall219,
        ___syscall221: ___syscall221,
        ___syscall3: ___syscall3,
        ___syscall38: ___syscall38,
        ___syscall5: ___syscall5,
        ___syscall54: ___syscall54,
        ___syscall6: ___syscall6,
        ___unlock: ___unlock,
        _abort: _abort,
        _clock: _clock,
        _clock_gettime: _clock_gettime,
        _emscripten_memcpy_big: _emscripten_memcpy_big,
        _exit: _exit,
        _fabs: _fabs,
        _getenv: _getenv,
        _gettimeofday: _gettimeofday,
        _gmtime_r: _gmtime_r,
        _llvm_exp2_f32: _llvm_exp2_f32,
        _llvm_exp2_f64: _llvm_exp2_f64,
        _llvm_trunc_f64: _llvm_trunc_f64,
        _localtime_r: _localtime_r,
        _mktime: _mktime,
        _nanosleep: _nanosleep,
        _strftime: _strftime,
        DYNAMICTOP_PTR: DYNAMICTOP_PTR,
        STACKTOP: STACKTOP
    };
    var asm = Module['asm'](Module.asmGlobalArg, Module.asmLibraryArg, buffer);
    Module['asm'] = asm;
    var _add_audio_frame = (Module['_add_audio_frame'] = function() {
        return Module['asm']['_add_audio_frame'].apply(null, arguments);
    });
    var _add_video_frame = (Module['_add_video_frame'] = function() {
        return Module['asm']['_add_video_frame'].apply(null, arguments);
    });
    var _close_stream = (Module['_close_stream'] = function() {
        return Module['asm']['_close_stream'].apply(null, arguments);
    });
    var _emscripten_replace_memory = (Module['_emscripten_replace_memory'] = function() {
        return Module['asm']['_emscripten_replace_memory'].apply(null, arguments);
    });
    var _free = (Module['_free'] = function() {
        return Module['asm']['_free'].apply(null, arguments);
    });
    var _free_buffer = (Module['_free_buffer'] = function() {
        return Module['asm']['_free_buffer'].apply(null, arguments);
    });
    var _malloc = (Module['_malloc'] = function() {
        return Module['asm']['_malloc'].apply(null, arguments);
    });
    var _open_audio = (Module['_open_audio'] = function() {
        return Module['asm']['_open_audio'].apply(null, arguments);
    });
    var _open_video = (Module['_open_video'] = function() {
        return Module['asm']['_open_video'].apply(null, arguments);
    });
    var _write_header = (Module['_write_header'] = function() {
        return Module['asm']['_write_header'].apply(null, arguments);
    });
    var stackAlloc = (Module['stackAlloc'] = function() {
        return Module['asm']['stackAlloc'].apply(null, arguments);
    });
    var dynCall_v = (Module['dynCall_v'] = function() {
        return Module['asm']['dynCall_v'].apply(null, arguments);
    });
    var dynCall_vi = (Module['dynCall_vi'] = function() {
        return Module['asm']['dynCall_vi'].apply(null, arguments);
    });
    Module['asm'] = asm;
    Module['then'] = function(func) {
        if (Module['calledRun']) {
            func(Module);
        } else {
            var old = Module['onRuntimeInitialized'];
            Module['onRuntimeInitialized'] = function() {
                if (old) old();
                func(Module);
            };
        }
        return Module;
    };
    function ExitStatus(status) {
        this.name = 'ExitStatus';
        this.message = 'Program terminated with exit(' + status + ')';
        this.status = status;
    }
    ExitStatus.prototype = new Error();
    ExitStatus.prototype.constructor = ExitStatus;
    var initialStackTop;
    dependenciesFulfilled = function runCaller() {
        if (!Module['calledRun']) run();
        if (!Module['calledRun']) dependenciesFulfilled = runCaller;
    };
    function run(args) {
        args = args || Module['arguments'];
        if (runDependencies > 0) {
            return;
        }
        preRun();
        if (runDependencies > 0) return;
        if (Module['calledRun']) return;
        function doRun() {
            if (Module['calledRun']) return;
            Module['calledRun'] = true;
            if (ABORT) return;
            ensureInitRuntime();
            preMain();
            if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();
            postRun();
        }
        if (Module['setStatus']) {
            Module['setStatus']('Running...');
            setTimeout(function() {
                setTimeout(function() {
                    Module['setStatus']('');
                }, 1);
                doRun();
            }, 1);
        } else {
            doRun();
        }
    }
    Module['run'] = run;
    function exit(status, implicit) {
        if (implicit && Module['noExitRuntime'] && status === 0) {
            return;
        }
        if (Module['noExitRuntime']) {
        } else {
            ABORT = true;
            EXITSTATUS = status;
            STACKTOP = initialStackTop;
            exitRuntime();
            if (Module['onExit']) Module['onExit'](status);
        }
        if (ENVIRONMENT_IS_NODE) {
            process['exit'](status);
        }
        Module['quit'](status, new ExitStatus(status));
    }
    Module['exit'] = exit;
    function abort(what) {
        if (Module['onAbort']) {
            Module['onAbort'](what);
        }
        if (what !== undefined) {
            Module.print(what);
            Module.printErr(what);
            what = JSON.stringify(what);
        } else {
            what = '';
        }
        ABORT = true;
        EXITSTATUS = 1;
        throw 'abort(' + what + '). Build with -s ASSERTIONS=1 for more info.';
    }
    Module['abort'] = abort;
    if (Module['preInit']) {
        if (typeof Module['preInit'] === 'function') Module['preInit'] = [Module['preInit']];
        while (Module['preInit'].length > 0) {
            Module['preInit'].pop()();
        }
    }
    Module['noExitRuntime'] = true;
    run();

    return WasmEncoder1c;
};

var Module = {};
WasmEncoder1c(Module);

var useAudio = false;

var fileType = 1;
Module['onRuntimeInitialized'] = function() {
    postMessage({ action: 'loaded' });
};

var openVideo = function(config) {
    var { width, height, fps, bitrate, presetIdx } = config;
    Module._open_video(width, height, fps, bitrate, presetIdx, fileType, fileType);
    //frameSize = width * height * 4;
};

var audioFramesRecv = 1,
    left,
    encodeVideo,
    videoFramesEncoded = 0,
    audioFramesEncoded = 0;
var aduioTimeSum = 0,
    videoTimeSum = 0;
var debug = false;

var addAudioFrame = function(buffer) {
    var t = performance.now();
    var left_p = Module._malloc(left.length * 4);
    Module.HEAPF32.set(left, left_p >> 2);
    var right_p = Module._malloc(buffer.length * 4);
    Module.HEAPF32.set(buffer, right_p >> 2);
    Module._add_audio_frame(left_p, right_p, left.length);
    var delta = performance.now() - t;
    aduioTimeSum += delta;
    if (audioFramesEncoded++ % 25 === 0 && debug)
        console.log(
            'Audio added, time taken: ',
            delta,
            ' average: ',
            aduioTimeSum / audioFramesEncoded
        );
    postMessage({ action: 'ready' });
};

var openAudio = function(config) {
    var { bitrate, samplerate } = config;
    try {
        Module._open_audio(samplerate, 2, bitrate, 2);
    } catch (err) {
        console.log(err);
    }
};

var writeHeader = function() {
    Module._write_header();
};

var close_stream = function() {
    var video_p, size_p, size;
    video_p = Module._close_stream(size_p);
    size = Module.HEAP32[size_p >> 2];
    return new Uint8Array(Module.HEAPU8.subarray(video_p, video_p + size));
};

var addVideoFrame = function(buffer) {
    var t = performance.now();
    try {
        var encodedBuffer_p = Module._malloc(buffer.length);
        Module.HEAPU8.set(buffer, encodedBuffer_p);
        Module._add_video_frame(encodedBuffer_p);
    } finally {
        Module._free(encodedBuffer_p);
    }
    //hack to avoid memory leaks
    postMessage(buffer.buffer, [buffer.buffer]);
    var delta = performance.now() - t;
    videoTimeSum += delta;
    if (videoFramesEncoded++ % 25 === 0 && debug)
        console.log(
            'Video added, time taken: ',
            delta,
            ' average: ',
            videoTimeSum / videoFramesEncoded
        );
    postMessage({ action: 'ready' });
};

var close = function() {
    var vid = close_stream();
    Module._free_buffer();
    postMessage({ action: 'return', data: vid.buffer });
};

var onmessage = function(e) {
    var { data } = e;
    if (data.action === undefined) {
        if (encodeVideo) {
            addVideoFrame(data);
        } else {
            if (audioFramesRecv === 1) left = data;
            if (audioFramesRecv === 0) addAudioFrame(data);
            audioFramesRecv--;
        }
        return;
    }

    switch (data.action) {
        case 'audio':
            encodeVideo = false;
            audioFramesRecv = 1;
            break;
        case 'video':
            encodeVideo = true;
            break;
        case 'init':
            openVideo(data.data.videoConfig);
            if (data.data.audioConfig) {
                openAudio(data.data.audioConfig);
                useAudio = true;
            } else {
                useAudio = false;
            }
            writeHeader();
            postMessage({ action: 'initialized' });
            initialized = true;
            break;
        case 'addFrame':
            addFrame(data.data);
            break;
        case 'close':
            close(data.data);
            break;
        default:
            console.log('unknown command');
    }
};
