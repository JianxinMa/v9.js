/*jslint white:true browser:true maxlen:80*/
/*global FS, cpp_js */

// "use strict";  // emcc might generate some non-strict code

var xvccCore;

var expandedFileSuffix = '.dbg.c';

function mkDirs(path, dir, mkdirImpl) {
    var p;
    for (p in dir) {
        if (dir.hasOwnProperty(p)) {
            if (dir[p] !== 0) {
                mkdirImpl(path + p);
                mkDirs(path + p + '/', dir[p], mkdirImpl);
            }
        }
    }
}

function xvcc(xvccOpt, dirStruct, files, onReturn, printOut) {
    var searchInclude, xvccCaller, cPreProcessor;
    /*jslint unparam:true*/
    searchInclude = function(header, is_global, resumer) {
        var i, j, include, tryMatch, matched;
        tryMatch = function(file) {
            if (!matched) {
                if (file.filename === include + header) {
                    matched = true;
                    resumer(file.content);
                }
            }
        };
        matched = false;
        if (header.endsWith('.c')) {
            include = '';
            files.forEach(tryMatch);
        }
        if (!matched) {
            j = xvccOpt.include.length;
            for (i = 0; i < j; i = i + 1) {
                include = xvccOpt.include[i];
                if (!include.endsWith('/')) {
                    include = include + '/';
                }
                files.forEach(tryMatch);
                if (matched) {
                    break;
                }
            }
        }
        if (!matched) {
            resumer(null);
        }
    };
    /*jslint unparam:false*/
    xvccCaller = function(processed) {
        xvccCore(xvccOpt.sources[0] + expandedFileSuffix, processed,
            xvccOpt.target, dirStruct, onReturn, printOut);
    };
    cPreProcessor = cpp_js({
        signal_char: '#',
        warn_func: printOut,
        error_func: printOut,
        include_func: searchInclude,
        completion_func: xvccCaller
    });
    cPreProcessor.run((function() {
        var i, j, ret;
        ret = '';
        j = xvccOpt.sources.length;
        for (i = 0; i < j; i = i + 1) {
            ret += '#include <';
            ret += xvccOpt.sources[i];
            ret += '>\n';
        }
        return ret;
    }()));
}

xvccCore = function(infile, processed, target,
    dirStruct, onReturn, printOut) {
    var Module;
    (function() {
        var infofile;
        infofile = infile.substr(0, infile.length - 1) + 'd';
        Module = {
            arguments: ["-o", target, infile],
            printErr: printOut,
            preRun: [function() {
                mkDirs('', dirStruct, FS.mkdir);
                FS.writeFile(infile, processed);
            }],
            postRun: [function() {
                var result, info, source;
                result = {
                    filename: target,
                    encoding: 'binary',
                    content: FS.readFile(target, {
                        encoding: 'binary'
                    })
                };
                info = FS.readFile(infofile, {
                    encoding: 'utf8'
                });
                source = {
                    filename: infile,
                    encoding: 'utf8',
                    content: processed
                };
                onReturn(result, info, source);
            }]
        };
    }());
    // The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

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
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
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

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + (assert(DYNAMICTOP > 0),size))|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret;  return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if ((!opts || !opts.async) && typeof EmterpreterAsync === 'object') {
      assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling ccall');
    }
    if (opts && opts.async) assert(!returnType, 'async ccalls cannot return values');
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    funcstr += "if (typeof EmterpreterAsync === 'object') { assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling cwrap') }";
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
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
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
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

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;

  var str = '';
  while (1) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 0xF0) == 0xE0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 0xF8) == 0xF0) {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 0xFC) == 0xF8) {
          u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
        }
      }
    }
    if (u0 < 0x10000) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF16ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

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

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - asm.stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 134217728;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  Module.printErr('increasing TOTAL_MEMORY to ' + totalMemory + ' to be compliant with the asm.js spec (and given that TOTAL_STACK=' + TOTAL_STACK + ')');
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
}
updateGlobalBufferViews();


// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
if (HEAPU8[0] !== 255 || HEAPU8[3] !== 0) throw 'Typed arrays 2 must be run on a little-endian system';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

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
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;





// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 41856;
  /* global initializers */  __ATINIT__.push();
  

/* memory initializer */ allocate([12,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,3,0,0,0,112,159,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,3,0,0,0,120,159,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,124,0,0,0,72,65,76,84,44,69,78,84,32,44,76,69,86,32,44,74,77,80,32,44,74,77,80,73,44,74,83,82,32,44,74,83,82,65,44,76,69,65,32,44,76,69,65,71,44,67,89,67,32,44,77,67,80,89,44,77,67,77,80,44,77,67,72,82,44,77,83,69,84,44,76,76,32,32,44,76,76,83,32,44,76,76,72,32,44,76,76,67,32,44,76,76,66,32,44,76,76,68,32,44,76,76,70,32,44,76,71,32,32,44,76,71,83,32,44,76,71,72,32,44,76,71,67,32,44,76,71,66,32,44,76,71,68,32,44,76,71,70,32,44,76,88,32,32,44,76,88,83,32,44,76,88,72,32,44,76,88,67,32,44,76,88,66,32,44,76,88,68,32,44,76,88,70,32,44,76,73,32,32,44,76,72,73,32,44,76,73,70,32,44,76,66,76,32,44,76,66,76,83,44,76,66,76,72,44,76,66,76,67,44,76,66,76,66,44,76,66,76,68,44,76,66,76,70,44,76,66,71,32,44,76,66,71,83,44,76,66,71,72,44,76,66,71,67,44,76,66,71,66,44,76,66,71,68,44,76,66,71,70,44,76,66,88,32,44,76,66,88,83,44,76,66,88,72,44,76,66,88,67,44,76,66,88,66,44,76,66,88,68,44,76,66,88,70,44,76,66,73,32,44,76,66,72,73,44,76,66,73,70,44,76,66,65,32,44,76,66,65,68,44,83,76,32,32,44,83,76,72,32,44,83,76,66,32,44,83,76,68,32,44,83,76,70,32,44,83,71,32,32,44,83,71,72,32,44,83,71,66,32,44,83,71,68,32,44,83,71,70,32,44,83,88,32,32,44,83,88,72,32,44,83,88,66,32,44,83,88,68,32,44,83,88,70,32,44,65,68,68,70,44,83,85,66,70,44,77,85,76,70,44,68,73,86,70,44,65,68,68,32,44,65,68,68,73,44,65,68,68,76,44,83,85,66,32,44,83,85,66,73,44,83,85,66,76,44,77,85,76,32,44,77,85,76,73,44,77,85,76,76,44,68,73,86,32,44,68,73,86,73,44,68,73,86,76,44,68,86,85,32,44,68,86,85,73,44,68,86,85,76,44,77,79,68,32,44,77,79,68,73,44,77,79,68,76,44,77,68,85,32,44,77,68,85,73,44,77,68,85,76,44,65,78,68,32,44,65,78,68,73,44,65,78,68,76,44,79,82,32,32,44,79,82,73,32,44,79,82,76,32,44,88,79,82,32,44,88,79,82,73,44,88,79,82,76,44,83,72,76,32,44,83,72,76,73,44,83,72,76,76,44,83,72,82,32,44,83,72,82,73,44,83,72,82,76,44,83,82,85,32,44,83,82,85,73,44,83,82,85,76,44,69,81,32,32,44,69,81,70,32,44,78,69,32,32,44,78,69,70,32,44,76,84,32,32,44,76,84,85,32,44,76,84,70,32,44,71,69,32,32,44,71,69,85,32,44,71,69,70,32,44,66,90,32,32,44,66,90,70,32,44,66,78,90,32,44,66,78,90,70,44,66,69,32,32,44,66,69,70,32,44,66,78,69,32,44,66,78,69,70,44,66,76,84,32,44,66,76,84,85,44,66,76,84,70,44,66,71,69,32,44,66,71,69,85,44,66,71,69,70,44,67,73,68,32,44,67,85,68,32,44,67,68,73,32,44,67,68,85,32,44,67,76,73,32,44,83,84,73,32,44,82,84,73,32,44,66,73,78,32,44,66,79,85,84,44,78,79,80,32,44,83,83,80,32,44,80,83,72,65,44,80,83,72,73,44,80,83,72,70,44,80,83,72,66,44,80,79,80,66,44,80,79,80,70,44,80,79,80,65,44,73,86,69,67,44,80,68,73,82,44,83,80,65,71,44,84,73,77,69,44,76,86,65,68,44,84,82,65,80,44,76,85,83,80,44,83,85,83,80,44,76,67,76,32,44,76,67,65,32,44,80,83,72,67,44,80,79,80,67,44,77,83,73,90,44,80,83,72,71,44,80,79,80,71,44,78,69,84,49,44,78,69,84,50,44,78,69,84,51,44,78,69,84,52,44,78,69,84,53,44,78,69,84,54,44,78,69,84,55,44,78,69,84,56,44,78,69,84,57,44,80,79,87,32,44,65,84,78,50,44,70,65,66,83,44,65,84,65,78,44,76,79,71,32,44,76,79,71,84,44,69,88,80,32,44,70,76,79,82,44,67,69,73,76,44,72,89,80,79,44,83,73,78,32,44,67,79,83,32,44,84,65,78,32,44,65,83,73,78,44,65,67,79,83,44,83,73,78,72,44,67,79,83,72,44,84,65,78,72,44,83,81,82,84,44,70,77,79,68,44,73,68,76,69,44,0,37,115,32,58,32,101,114,114,111,114,58,32,115,111,117,114,99,101,32,37,115,32,115,104,111,117,108,100,32,101,110,100,32,119,105,116,104,32,46,99,10,0,119,98,0,37,115,32,58,32,101,114,114,111,114,58,32,99,97,110,39,116,32,111,112,101,110,32,105,110,102,111,32,102,105,108,101,32,37,115,10,0,61,32,37,115,10,0,105,32,48,120,37,48,56,120,32,37,115,32,37,100,10,0,37,46,42,115,0,40,0,37,100,124,0,58,37,43,100,58,0,41,0,100,32,115,116,114,117,99,116,32,0,32,0,10,0,112,116,114,0,99,104,97,114,0,115,104,111,114,116,0,105,110,116,0,117,99,104,97,114,0,117,115,104,111,114,116,0,117,105,110,116,0,102,108,111,97,116,0,100,111,117,98,108,101,0,118,111,105,100,0,102,117,110,0,97,114,114,97,121,0,40,37,100,0,124,37,100,0,115,116,114,117,99,116,0,60,0,62,0,63,63,63,0,119,97,114,110,105,110,103,58,32,100,45,62,116,121,112,101,32,61,61,32,37,100,32,124,32,37,100,10,0,62,32,48,120,37,48,56,120,10,0,108,32,0,32,100,97,116,0,32,37,43,100,0,32,98,115,115,0,32,115,116,107,0,119,97,114,110,105,110,103,58,32,100,45,62,99,108,97,115,115,32,61,61,32,37,100,10,0,103,32,0,35,32,46,116,101,120,116,32,48,120,37,48,56,120,32,40,43,48,120,37,48,56,120,41,32,48,120,37,48,56,120,10,0,35,32,46,100,97,116,97,32,48,120,37,48,56,120,32,40,43,48,120,37,48,56,120,41,32,48,120,37,48,56,120,10,0,35,32,46,98,115,115,32,32,48,120,37,48,56,120,32,40,43,48,120,37,48,56,120,41,32,48,120,37,48,56,120,10,0,46,100,97,116,97,32,48,120,37,48,56,120,10,0,46,98,115,115,32,32,48,120,37,48,56,120,10,0,115,98,114,107,40,105,60,48,41,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,10,0,37,115,32,58,32,102,97,116,97,108,58,32,117,110,97,98,108,101,32,116,111,32,115,98,114,107,40,37,100,41,10,0,37,115,32,58,32,91,37,115,58,37,100,93,32,101,114,114,111,114,58,32,37,115,10,0,37,115,32,58,32,102,97,116,97,108,58,32,109,97,120,105,109,117,109,32,101,114,114,111,114,115,32,101,120,99,101,101,100,101,100,10,0,114,98,0,37,115,32,58,32,91,37,115,58,37,100,93,32,101,114,114,111,114,58,32,99,97,110,39,116,32,111,112,101,110,32,102,105,108,101,32,37,115,10,0,37,115,32,58,32,91,37,115,58,37,100,93,32,101,114,114,111,114,58,32,99,97,110,39,116,32,114,101,97,100,32,102,105,108,101,32,37,115,10,0,35,32,48,120,37,48,56,120,32,48,120,37,48,56,120,37,53,46,52,115,10,0,35,32,48,120,37,48,56,120,32,48,120,37,48,56,120,37,53,46,52,115,32,37,100,10,0,101,109,105,40,41,32,99,111,110,115,116,97,110,116,32,111,117,116,32,111,102,32,98,111,117,110,100,115,0,35,32,48,120,37,48,56,120,32,48,120,37,48,56,120,37,53,46,52,115,32,60,102,119,100,62,10,0,101,109,102,40,41,32,111,102,102,115,101,116,32,111,117,116,32,111,102,32,98,111,117,110,100,115,0,35,32,37,115,32,37,100,58,32,37,46,42,115,10,0,105,110,99,108,117,100,101,0,99,97,110,39,116,32,110,101,115,116,32,105,110,99,108,117,100,101,32,102,105,108,101,115,0,98,97,100,32,105,110,99,108,117,100,101,32,102,105,108,101,32,110,97,109,101,0,37,115,32,58,32,91,37,115,58,37,100,93,32,101,114,114,111,114,58,32,99,97,110,39,116,32,115,116,97,116,32,102,105,108,101,32,37,115,10,0,47,108,105,98,47,0,98,97,100,32,101,115,99,97,112,101,32,115,101,113,117,101,110,99,101,0,117,110,101,120,112,101,99,116,101,100,32,101,111,102,0,98,97,100,32,116,111,107,101,110,0,37,115,32,58,32,91,37,115,58,37,100,93,32,101,114,114,111,114,58,32,39,37,99,39,32,101,120,112,101,99,116,101,100,10,0,98,97,100,32,99,111,110,115,116,97,110,116,32,101,120,112,114,101,115,115,105,111,110,0,98,97,100,32,102,108,111,97,116,32,99,111,110,115,116,97,110,116,32,101,120,112,114,101,115,115,105,111,110,0,99,97,110,39,116,32,99,111,109,112,117,116,101,32,115,105,122,101,32,111,102,32,105,110,99,111,109,112,108,101,116,101,32,115,116,114,117,99,116,0,99,97,110,39,116,32,99,111,109,112,117,116,101,32,97,108,105,103,110,109,101,110,116,32,111,102,32,105,110,99,111,109,112,108,101,116,101,32,115,116,114,117,99,116,0,115,116,114,117,99,116,32,111,114,32,117,110,105,111,110,32,114,101,100,101,102,105,110,105,116,105,111,110,0,98,97,100,32,101,110,117,109,32,105,100,101,110,116,105,102,105,101,114,0,98,97,100,32,97,98,115,116,114,97,99,116,32,102,117,110,99,116,105,111,110,32,116,121,112,101,0,98,97,100,32,97,98,115,116,114,97,99,116,32,116,121,112,101,0,98,97,100,32,102,117,110,99,116,105,111,110,32,112,97,114,97,109,101,116,101,114,0,100,117,112,108,105,99,97,116,101,32,100,101,102,105,110,105,116,105,111,110,0,101,120,112,101,99,116,105,110,103,32,99,108,111,115,101,32,112,97,114,101,110,115,32,97,102,116,101,114,32,100,111,116,115,0,98,97,100,32,97,114,114,97,121,32,115,105,122,101,0,98,97,100,32,100,101,99,108,97,114,97,116,105,111,110,0,98,97,100,32,110,101,115,116,101,100,32,102,117,110,99,116,105,111,110,0,98,97,100,32,102,117,110,99,116,105,111,110,32,100,101,102,105,110,105,116,105,111,110,0,99,111,110,102,108,105,99,116,105,110,103,32,102,111,114,119,97,114,100,32,102,117,110,99,116,105,111,110,32,100,101,99,108,97,114,97,116,105,111,110,0,100,117,112,108,105,99,97,116,101,32,102,117,110,99,116,105,111,110,32,100,101,102,105,110,105,116,105,111,110,0,117,110,114,101,115,111,118,101,100,32,108,97,98,101,108,0,100,117,112,108,105,99,97,116,101,32,102,117,110,99,116,105,111,110,32,100,101,99,108,97,114,97,116,105,111,110,0,98,97,100,32,115,116,114,105,110,103,32,105,110,105,116,105,97,108,105,122,101,114,0,98,97,100,32,97,114,114,97,121,32,105,110,105,116,105,97,108,105,122,101,114,0,98,97,100,32,109,101,109,98,101,114,32,100,101,99,108,97,114,97,116,105,111,110,0,100,117,112,108,105,99,97,116,101,32,109,101,109,98,101,114,32,100,101,99,108,97,114,97,116,105,111,110,0,100,101,114,101,102,101,114,101,110,99,105,110,103,32,97,32,110,111,110,45,112,111,105,110,116,101,114,0,108,118,97,108,117,101,32,101,120,112,101,99,116,101,100,0,117,110,100,101,102,105,110,101,100,32,115,121,109,98,111,108,0,37,115,32,58,32,91,37,115,58,37,100,93,32,119,97,114,110,105,110,103,58,32,117,110,100,101,99,108,97,114,101,100,32,102,117,110,99,116,105,111,110,32,99,97,108,108,101,100,32,104,101,114,101,10,0,98,97,100,32,118,97,95,97,114,103,0,98,97,100,32,111,112,101,114,97,110,100,32,116,111,32,33,0,98,97,100,32,111,112,101,114,97,110,100,32,116,111,32,126,0,98,97,100,32,111,112,101,114,97,110,100,32,116,111,32,43,0,98,97,100,32,111,112,101,114,97,110,100,32,116,111,32,45,0,98,97,100,32,111,112,101,114,97,110,100,32,116,111,32,43,43,0,98,97,100,32,111,112,101,114,97,110,100,32,116,111,32,45,45,0,98,97,100,32,101,120,112,114,101,115,115,105,111,110,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,43,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,45,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,42,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,47,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,37,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,38,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,124,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,94,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,60,60,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,62,62,61,0,98,97,100,32,99,111,110,100,105,116,105,111,110,97,108,32,101,120,112,114,101,115,115,105,111,110,32,116,121,112,101,115,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,124,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,94,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,38,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,61,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,33,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,60,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,62,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,60,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,62,61,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,60,60,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,62,62,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,43,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,45,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,42,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,47,0,98,97,100,32,111,112,101,114,97,110,100,115,32,116,111,32,37,0,101,120,112,101,99,116,101,100,32,115,116,114,117,99,116,117,114,101,32,111,114,32,117,110,105,111,110,0,101,120,112,101,99,116,101,100,32,115,116,114,117,99,116,117,114,101,32,111,114,32,117,110,105,111,110,32,109,101,109,98,101,114,0,115,116,114,117,99,116,32,111,114,32,117,110,105,111,110,32,109,101,109,98,101,114,32,110,111,116,32,102,111,117,110,100,0,98,97,100,32,102,117,110,99,116,105,111,110,32,99,97,108,108,32,116,121,112,101,0,102,97,116,97,108,32,99,111,109,112,105,108,101,114,32,101,114,114,111,114,32,101,120,112,114,40,41,32,116,107,61,37,100,10,0,99,97,110,39,116,32,100,101,114,101,102,101,114,101,110,99,101,32,116,104,97,116,32,116,121,112,101,0,102,97,116,97,108,32,99,111,109,112,105,108,101,114,32,101,114,114,111,114,32,114,118,40,105,110,116,32,42,97,41,32,42,97,61,37,100,10,0,98,97,100,32,108,97,98,101,108,32,110,97,109,101,0,98,97,100,32,103,111,116,111,0,120,118,99,99,0,117,115,97,103,101,58,32,37,115,32,91,45,118,93,32,91,45,115,93,32,91,45,73,112,97,116,104,93,32,45,111,32,101,120,101,102,105,108,101,32,102,105,108,101,32,46,46,46,10,0,37,115,32,58,32,101,114,114,111,114,58,32,110,111,32,111,117,116,112,117,116,32,102,105,108,101,10,0,97,115,109,32,97,117,116,111,32,98,114,101,97,107,32,99,97,115,101,32,99,104,97,114,32,99,111,110,116,105,110,117,101,32,100,101,102,97,117,108,116,32,100,111,32,100,111,117,98,108,101,32,101,108,115,101,32,101,110,117,109,32,102,108,111,97,116,32,102,111,114,32,103,111,116,111,32,105,102,32,105,110,116,32,108,111,110,103,32,114,101,116,117,114,110,32,115,104,111,114,116,32,115,105,122,101,111,102,32,115,116,97,116,105,99,32,115,116,114,117,99,116,32,115,119,105,116,99,104,32,116,121,112,101,100,101,102,32,117,110,105,111,110,32,117,110,115,105,103,110,101,100,32,118,111,105,100,32,119,104,105,108,101,32,118,97,95,108,105,115,116,32,118,97,95,115,116,97,114,116,32,118,97,95,97,114,103,32,109,97,105,110,0,37,115,32,58,32,99,111,109,112,105,108,105,110,103,32,37,115,10,0,117,110,114,101,115,111,108,118,101,100,32,102,111,114,119,97,114,100,32,102,117,110,99,116,105,111,110,32,40,114,101,116,114,121,32,119,105,116,104,32,45,118,41,0,116,101,120,116,32,43,32,100,97,116,97,32,43,32,98,115,115,32,115,101,103,109,101,110,116,32,101,120,99,101,101,100,115,32,109,97,120,105,109,117,109,32,115,105,122,101,0,109,97,105,110,40,41,32,110,111,116,32,100,101,102,105,110,101,100,0,37,115,32,58,32,37,115,32,99,111,109,112,105,108,101,100,32,119,105,116,104,32,37,100,32,101,114,114,111,114,115,10,0,101,110,116,114,121,32,61,32,37,100,32,116,101,120,116,32,61,32,37,100,32,100,97,116,97,32,61,32,37,100,32,98,115,115,32,61,32,37,100,10,0,37,115,32,58,32,101,114,114,111,114,58,32,99,97,110,39,116,32,111,112,101,110,32,111,117,116,112,117,116,32,102,105,108,101,32,37,115,10,0,37,115,32,58,32,101,120,105,116,105,110,103,10,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,45,43,32,32,32,48,88,48,120,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,46,0,114,119,97,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


   
  Module["_i64Subtract"] = _i64Subtract;

   
  Module["_i64Add"] = _i64Add;

   
  Module["_memset"] = _memset;

  function _pthread_cleanup_push(routine, arg) {
      __ATEXIT__.push(function() { Runtime.dynCall('vi', routine, [arg]) })
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _pthread_cleanup_pop() {
      assert(_pthread_cleanup_push.level == __ATEXIT__.length, 'cannot pop if something else added meanwhile!');
      __ATEXIT__.pop();
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function _abort() {
      Module['abort']();
    }

  
  
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};
  
  var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};
  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    }
  
  var PATH={splitPath:function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function (parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up--; up) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function (path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function (path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function (path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function (path) {
        return PATH.splitPath(path)[3];
      },join:function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function (l, r) {
        return PATH.normalize(l + '/' + r);
      },resolve:function () {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = path.charAt(0) === '/';
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
          return !!p;
        }), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },relative:function (from, to) {
        from = PATH.resolve(from).substr(1);
        to = PATH.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      }};
  
  var TTY={ttys:[],init:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process['stdin']['setEncoding']('utf8');
        // }
      },shutdown:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function (dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function (stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function (stream) {
          // flush any pending line data
          stream.tty.ops.flush(stream.tty);
        },flush:function (stream) {
          stream.tty.ops.flush(stream.tty);
        },read:function (stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          for (var i = 0; i < length; i++) {
            try {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function (tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              // we will read data by chunks of BUFSIZE
              var BUFSIZE = 256;
              var buf = new Buffer(BUFSIZE);
              var bytesRead = 0;
  
              var fd = process.stdin.fd;
              // Linux and Mac cannot use process.stdin.fd (which isn't set up as sync)
              var usingDevice = false;
              try {
                fd = fs.openSync('/dev/stdin', 'r');
                usingDevice = true;
              } catch (e) {}
  
              bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
  
              if (usingDevice) { fs.closeSync(fd); }
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString('utf-8');
              } else {
                result = null;
              }
  
            } else if (typeof window != 'undefined' &&
              typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');  // returns null on cancel
              if (result !== null) {
                result += '\n';
              }
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
              if (result !== null) {
                result += '\n';
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }},default_tty1_ops:{put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }}};
  
  var MEMFS={ops_table:null,mount:function (mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createNode:function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.buffer.byteLength which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },getFileDataAsRegularArray:function (node) {
        if (node.contents && node.contents.subarray) {
          var arr = [];
          for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
          return arr; // Returns a copy of the original data.
        }
        return node.contents; // No-op, the file contents are already in a JS array. Return as-is.
      },getFileDataAsTypedArray:function (node) {
        if (!node.contents) return new Uint8Array;
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },expandFileStorage:function (node, newCapacity) {
        // If we are asked to expand the size of a file that already exists, revert to using a standard JS array to store the file
        // instead of a typed array. This makes resizing the array more flexible because we can just .push() elements at the back to
        // increase the size.
        if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
          node.contents = MEMFS.getFileDataAsRegularArray(node);
          node.usedBytes = node.contents.length; // We might be writing to a lazy-loaded file which had overridden this property, so force-reset it.
        }
  
        if (!node.contents || node.contents.subarray) { // Keep using a typed array if creating a new storage, or if old one was a typed array as well.
          var prevCapacity = node.contents ? node.contents.buffer.byteLength : 0;
          if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
          // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
          // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
          // avoid overshooting the allocation cap by a very large margin.
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) | 0);
          if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity); // Allocate new storage.
          if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
          return;
        }
        // Not using a typed array to back the file storage. Use a standard JS array instead.
        if (!node.contents && newCapacity > 0) node.contents = [];
        while (node.contents.length < newCapacity) node.contents.push(0);
      },resizeFileStorage:function (node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
          return;
        }
        if (!node.contents || node.contents.subarray) { // Resize a typed array if that is being used as the backing store.
          var oldContents = node.contents;
          node.contents = new Uint8Array(new ArrayBuffer(newSize)); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
          return;
        }
        // Backing with a JS array.
        if (!node.contents) node.contents = [];
        if (node.contents.length > newSize) node.contents.length = newSize;
        else while (node.contents.length < newSize) node.contents.push(0);
        node.usedBytes = newSize;
      },node_ops:{getattr:function (node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },lookup:function (parent, name) {
          throw FS.genericErrors[ERRNO_CODES.ENOENT];
        },mknod:function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function (old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },unlink:function (parent, name) {
          delete parent.contents[name];
        },rmdir:function (parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
          }
          delete parent.contents[name];
        },readdir:function (node) {
          var entries = ['.', '..']
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return node.link;
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },write:function (stream, buffer, offset, length, position, canOwn) {
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) { // Can we just reuse the buffer we are given?
              assert(position === 0, 'canOwn must imply no weird position inside the file');
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); // Use typed array write if available.
          else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position+length);
          return length;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        },allocate:function (stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },mmap:function (stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if ( !(flags & 2) &&
                (contents.buffer === buffer || contents.buffer === buffer.buffer) ) {
            // We can't emulate MAP_SHARED when the file is not backed by the buffer
            // we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < stream.node.usedBytes) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
            }
            buffer.set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        },msync:function (stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          if (mmapFlags & 2) {
            // MAP_PRIVATE calls need not to be synced back to underlying fs
            return 0;
          }
  
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        }}};
  
  var IDBFS={dbs:{},indexedDB:function () {
        if (typeof indexedDB !== 'undefined') return indexedDB;
        var ret = null;
        if (typeof window === 'object') ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        assert(ret, 'IDBFS used, but indexedDB not supported');
        return ret;
      },DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",mount:function (mount) {
        // reuse all of the core MEMFS functionality
        return MEMFS.mount.apply(null, arguments);
      },syncfs:function (mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
          if (err) return callback(err);
  
          IDBFS.getRemoteSet(mount, function(err, remote) {
            if (err) return callback(err);
  
            var src = populate ? remote : local;
            var dst = populate ? local : remote;
  
            IDBFS.reconcile(src, dst, callback);
          });
        });
      },getDB:function (name, callback) {
        // check the cache first
        var db = IDBFS.dbs[name];
        if (db) {
          return callback(null, db);
        }
  
        var req;
        try {
          req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
          return callback(e);
        }
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          var transaction = e.target.transaction;
  
          var fileStore;
  
          if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
          } else {
            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
          }
  
          if (!fileStore.indexNames.contains('timestamp')) {
            fileStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = function() {
          db = req.result;
  
          // add to the cache
          IDBFS.dbs[name] = db;
          callback(null, db);
        };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },getLocalSet:function (mount, callback) {
        var entries = {};
  
        function isRealDir(p) {
          return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
          return function(p) {
            return PATH.join2(root, p);
          }
        };
  
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  
        while (check.length) {
          var path = check.pop();
          var stat;
  
          try {
            stat = FS.stat(path);
          } catch (e) {
            return callback(e);
          }
  
          if (FS.isDir(stat.mode)) {
            check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
          }
  
          entries[path] = { timestamp: stat.mtime };
        }
  
        return callback(null, { type: 'local', entries: entries });
      },getRemoteSet:function (mount, callback) {
        var entries = {};
  
        IDBFS.getDB(mount.mountpoint, function(err, db) {
          if (err) return callback(err);
  
          var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
          transaction.onerror = function(e) {
            callback(this.error);
            e.preventDefault();
          };
  
          var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
          var index = store.index('timestamp');
  
          index.openKeyCursor().onsuccess = function(event) {
            var cursor = event.target.result;
  
            if (!cursor) {
              return callback(null, { type: 'remote', db: db, entries: entries });
            }
  
            entries[cursor.primaryKey] = { timestamp: cursor.key };
  
            cursor.continue();
          };
        });
      },loadLocalEntry:function (path, callback) {
        var stat, node;
  
        try {
          var lookup = FS.lookupPath(path);
          node = lookup.node;
          stat = FS.stat(path);
        } catch (e) {
          return callback(e);
        }
  
        if (FS.isDir(stat.mode)) {
          return callback(null, { timestamp: stat.mtime, mode: stat.mode });
        } else if (FS.isFile(stat.mode)) {
          // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
          // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
          node.contents = MEMFS.getFileDataAsTypedArray(node);
          return callback(null, { timestamp: stat.mtime, mode: stat.mode, contents: node.contents });
        } else {
          return callback(new Error('node type not supported'));
        }
      },storeLocalEntry:function (path, entry, callback) {
        try {
          if (FS.isDir(entry.mode)) {
            FS.mkdir(path, entry.mode);
          } else if (FS.isFile(entry.mode)) {
            FS.writeFile(path, entry.contents, { encoding: 'binary', canOwn: true });
          } else {
            return callback(new Error('node type not supported'));
          }
  
          FS.chmod(path, entry.mode);
          FS.utime(path, entry.timestamp, entry.timestamp);
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },removeLocalEntry:function (path, callback) {
        try {
          var lookup = FS.lookupPath(path);
          var stat = FS.stat(path);
  
          if (FS.isDir(stat.mode)) {
            FS.rmdir(path);
          } else if (FS.isFile(stat.mode)) {
            FS.unlink(path);
          }
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },loadRemoteEntry:function (store, path, callback) {
        var req = store.get(path);
        req.onsuccess = function(event) { callback(null, event.target.result); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },storeRemoteEntry:function (store, path, entry, callback) {
        var req = store.put(entry, path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },removeRemoteEntry:function (store, path, callback) {
        var req = store.delete(path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },reconcile:function (src, dst, callback) {
        var total = 0;
  
        var create = [];
        Object.keys(src.entries).forEach(function (key) {
          var e = src.entries[key];
          var e2 = dst.entries[key];
          if (!e2 || e.timestamp > e2.timestamp) {
            create.push(key);
            total++;
          }
        });
  
        var remove = [];
        Object.keys(dst.entries).forEach(function (key) {
          var e = dst.entries[key];
          var e2 = src.entries[key];
          if (!e2) {
            remove.push(key);
            total++;
          }
        });
  
        if (!total) {
          return callback(null);
        }
  
        var errored = false;
        var completed = 0;
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return callback(err);
            }
            return;
          }
          if (++completed >= total) {
            return callback(null);
          }
        };
  
        transaction.onerror = function(e) {
          done(this.error);
          e.preventDefault();
        };
  
        // sort paths in ascending order so directory entries are created
        // before the files inside them
        create.sort().forEach(function (path) {
          if (dst.type === 'local') {
            IDBFS.loadRemoteEntry(store, path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeLocalEntry(path, entry, done);
            });
          } else {
            IDBFS.loadLocalEntry(path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeRemoteEntry(store, path, entry, done);
            });
          }
        });
  
        // sort paths in descending order so files are deleted before their
        // parent directories
        remove.sort().reverse().forEach(function(path) {
          if (dst.type === 'local') {
            IDBFS.removeLocalEntry(path, done);
          } else {
            IDBFS.removeRemoteEntry(store, path, done);
          }
        });
      }};
  
  var NODEFS={isWindows:false,staticInit:function () {
        NODEFS.isWindows = !!process.platform.match(/^win/);
      },mount:function (mount) {
        assert(ENVIRONMENT_IS_NODE);
        return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
      },createNode:function (parent, name, mode, dev) {
        if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node = FS.createNode(parent, name, mode);
        node.node_ops = NODEFS.node_ops;
        node.stream_ops = NODEFS.stream_ops;
        return node;
      },getMode:function (path) {
        var stat;
        try {
          stat = fs.lstatSync(path);
          if (NODEFS.isWindows) {
            // On Windows, directories return permission bits 'rw-rw-rw-', even though they have 'rwxrwxrwx', so
            // propagate write bits to execute bits.
            stat.mode = stat.mode | ((stat.mode & 146) >> 1);
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return stat.mode;
      },realPath:function (node) {
        var parts = [];
        while (node.parent !== node) {
          parts.push(node.name);
          node = node.parent;
        }
        parts.push(node.mount.opts.root);
        parts.reverse();
        return PATH.join.apply(null, parts);
      },flagsToPermissionStringMap:{0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},flagsToPermissionString:function (flags) {
        flags &= ~0100000 /*O_LARGEFILE*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~02000000 /*O_CLOEXEC*/; // Some applications may pass it; it makes no sense for a single process.
        if (flags in NODEFS.flagsToPermissionStringMap) {
          return NODEFS.flagsToPermissionStringMap[flags];
        } else {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
      },node_ops:{getattr:function (node) {
          var path = NODEFS.realPath(node);
          var stat;
          try {
            stat = fs.lstatSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          // node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake them with default blksize of 4096.
          // See http://support.microsoft.com/kb/140365
          if (NODEFS.isWindows && !stat.blksize) {
            stat.blksize = 4096;
          }
          if (NODEFS.isWindows && !stat.blocks) {
            stat.blocks = (stat.size+stat.blksize-1)/stat.blksize|0;
          }
          return {
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode,
            nlink: stat.nlink,
            uid: stat.uid,
            gid: stat.gid,
            rdev: stat.rdev,
            size: stat.size,
            atime: stat.atime,
            mtime: stat.mtime,
            ctime: stat.ctime,
            blksize: stat.blksize,
            blocks: stat.blocks
          };
        },setattr:function (node, attr) {
          var path = NODEFS.realPath(node);
          try {
            if (attr.mode !== undefined) {
              fs.chmodSync(path, attr.mode);
              // update the common node structure mode as well
              node.mode = attr.mode;
            }
            if (attr.timestamp !== undefined) {
              var date = new Date(attr.timestamp);
              fs.utimesSync(path, date, date);
            }
            if (attr.size !== undefined) {
              fs.truncateSync(path, attr.size);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },lookup:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          var mode = NODEFS.getMode(path);
          return NODEFS.createNode(parent, name, mode);
        },mknod:function (parent, name, mode, dev) {
          var node = NODEFS.createNode(parent, name, mode, dev);
          // create the backing node for this in the fs root as well
          var path = NODEFS.realPath(node);
          try {
            if (FS.isDir(node.mode)) {
              fs.mkdirSync(path, node.mode);
            } else {
              fs.writeFileSync(path, '', { mode: node.mode });
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return node;
        },rename:function (oldNode, newDir, newName) {
          var oldPath = NODEFS.realPath(oldNode);
          var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },unlink:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.unlinkSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },rmdir:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.rmdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readdir:function (node) {
          var path = NODEFS.realPath(node);
          try {
            return fs.readdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },symlink:function (parent, newName, oldPath) {
          var newPath = PATH.join2(NODEFS.realPath(parent), newName);
          try {
            fs.symlinkSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readlink:function (node) {
          var path = NODEFS.realPath(node);
          try {
            path = fs.readlinkSync(path);
            path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
            return path;
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        }},stream_ops:{open:function (stream) {
          var path = NODEFS.realPath(stream.node);
          try {
            if (FS.isFile(stream.node.mode)) {
              stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags));
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },close:function (stream) {
          try {
            if (FS.isFile(stream.node.mode) && stream.nfd) {
              fs.closeSync(stream.nfd);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },read:function (stream, buffer, offset, length, position) {
          if (length === 0) return 0; // node errors on 0 length reads
          // FIXME this is terrible.
          var nbuffer = new Buffer(length);
          var res;
          try {
            res = fs.readSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          if (res > 0) {
            for (var i = 0; i < res; i++) {
              buffer[offset + i] = nbuffer[i];
            }
          }
          return res;
        },write:function (stream, buffer, offset, length, position) {
          // FIXME this is terrible.
          var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
          var res;
          try {
            res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return res;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              try {
                var stat = fs.fstatSync(stream.nfd);
                position += stat.size;
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code]);
              }
            }
          }
  
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
  
          return position;
        }}};
  
  var WORKERFS={DIR_MODE:16895,FILE_MODE:33279,reader:null,mount:function (mount) {
        assert(ENVIRONMENT_IS_WORKER);
        if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
        var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);
        var createdParents = {};
        function ensureParent(path) {
          // return the parent node, creating subdirs as necessary
          var parts = path.split('/');
          var parent = root;
          for (var i = 0; i < parts.length-1; i++) {
            var curr = parts.slice(0, i+1).join('/');
            // Issue 4254: Using curr as a node name will prevent the node
            // from being found in FS.nameTable when FS.open is called on
            // a path which holds a child of this node,
            // given that all FS functions assume node names
            // are just their corresponding parts within their given path,
            // rather than incremental aggregates which include their parent's
            // directories.
            if (!createdParents[curr]) {
              createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
            }
            parent = createdParents[curr];
          }
          return parent;
        }
        function base(path) {
          var parts = path.split('/');
          return parts[parts.length-1];
        }
        // We also accept FileList here, by using Array.prototype
        Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
          WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
        });
        (mount.opts["blobs"] || []).forEach(function(obj) {
          WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
        });
        (mount.opts["packages"] || []).forEach(function(pack) {
          pack['metadata'].files.forEach(function(file) {
            var name = file.filename.substr(1); // remove initial slash
            WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack['blob'].slice(file.start, file.end));
          });
        });
        return root;
      },createNode:function (parent, name, mode, dev, contents, mtime) {
        var node = FS.createNode(parent, name, mode);
        node.mode = mode;
        node.node_ops = WORKERFS.node_ops;
        node.stream_ops = WORKERFS.stream_ops;
        node.timestamp = (mtime || new Date).getTime();
        assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
        if (mode === WORKERFS.FILE_MODE) {
          node.size = contents.size;
          node.contents = contents;
        } else {
          node.size = 4096;
          node.contents = {};
        }
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },node_ops:{getattr:function (node) {
          return {
            dev: 1,
            ino: undefined,
            mode: node.mode,
            nlink: 1,
            uid: 0,
            gid: 0,
            rdev: undefined,
            size: node.size,
            atime: new Date(node.timestamp),
            mtime: new Date(node.timestamp),
            ctime: new Date(node.timestamp),
            blksize: 4096,
            blocks: Math.ceil(node.size / 4096),
          };
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
        },lookup:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        },mknod:function (parent, name, mode, dev) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rename:function (oldNode, newDir, newName) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },unlink:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rmdir:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readdir:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },symlink:function (parent, newName, oldPath) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readlink:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          if (position >= stream.node.size) return 0;
          var chunk = stream.node.contents.slice(position, position + length);
          var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
          buffer.set(new Uint8Array(ab), offset);
          return chunk.size;
        },write:function (stream, buffer, offset, length, position) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.size;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        }}};
  
  var _stdin=STATICTOP; STATICTOP += 16;;
  
  var _stdout=STATICTOP; STATICTOP += 16;;
  
  var _stderr=STATICTOP; STATICTOP += 16;;var FS={root:null,mounts:[],devices:[null],streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},filesystems:null,syncFSRequests:0,handleFSError:function (e) {
        if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
        return ___setErrNo(e.errno);
      },lookupPath:function (path, opts) {
        path = PATH.resolve(FS.cwd(), path);
        opts = opts || {};
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
        }
  
        // split the path
        var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), false);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },getPath:function (node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
          }
          path = path ? node.name + '/' + path : node.name;
          node = node.parent;
        }
      },hashName:function (parentid, name) {
        var hash = 0;
  
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },lookupNode:function (parent, name) {
        var err = FS.mayLookup(parent);
        if (err) {
          throw new FS.ErrnoError(err, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },createNode:function (parent, name, mode, rdev) {
        if (!FS.FSNode) {
          FS.FSNode = function(parent, name, mode, rdev) {
            if (!parent) {
              parent = this;  // root node sets parent to itself
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
          };
  
          FS.FSNode.prototype = {};
  
          // compatibility
          var readMode = 292 | 73;
          var writeMode = 146;
  
          // NOTE we must use Object.defineProperties instead of individual calls to
          // Object.defineProperty in order to make closure compiler happy
          Object.defineProperties(FS.FSNode.prototype, {
            read: {
              get: function() { return (this.mode & readMode) === readMode; },
              set: function(val) { val ? this.mode |= readMode : this.mode &= ~readMode; }
            },
            write: {
              get: function() { return (this.mode & writeMode) === writeMode; },
              set: function(val) { val ? this.mode |= writeMode : this.mode &= ~writeMode; }
            },
            isFolder: {
              get: function() { return FS.isDir(this.mode); }
            },
            isDevice: {
              get: function() { return FS.isChrdev(this.mode); }
            }
          });
        }
  
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },destroyNode:function (node) {
        FS.hashRemoveNode(node);
      },isRoot:function (node) {
        return node === node.parent;
      },isMountpoint:function (node) {
        return !!node.mounted;
      },isFile:function (mode) {
        return (mode & 61440) === 32768;
      },isDir:function (mode) {
        return (mode & 61440) === 16384;
      },isLink:function (mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function (mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function (mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function (mode) {
        return (mode & 61440) === 4096;
      },isSocket:function (mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function (flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
          return ERRNO_CODES.EACCES;
        }
        return 0;
      },mayLookup:function (dir) {
        var err = FS.nodePermissions(dir, 'x');
        if (err) return err;
        if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
        return 0;
      },mayCreate:function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return ERRNO_CODES.EEXIST;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function (dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var err = FS.nodePermissions(dir, 'wx');
        if (err) {
          return err;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return ERRNO_CODES.ENOTDIR;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return ERRNO_CODES.EBUSY;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return 0;
      },mayOpen:function (node, flags) {
        if (!node) {
          return ERRNO_CODES.ENOENT;
        }
        if (FS.isLink(node.mode)) {
          return ERRNO_CODES.ELOOP;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return ERRNO_CODES.EISDIR;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
      },getStream:function (fd) {
        return FS.streams[fd];
      },createStream:function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function(){};
          FS.FSStream.prototype = {};
          // compatibility
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              get: function() { return this.node; },
              set: function(val) { this.node = val; }
            },
            isRead: {
              get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              get: function() { return (this.flags & 1024); }
            }
          });
        }
        // clone it, so we can return an instance of FSStream
        var newStream = new FS.FSStream();
        for (var p in stream) {
          newStream[p] = stream[p];
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },closeStream:function (fd) {
        FS.streams[fd] = null;
      },chrdev_stream_ops:{open:function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function () {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }},major:function (dev) {
        return ((dev) >> 8);
      },minor:function (dev) {
        return ((dev) & 0xff);
      },makedev:function (ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function (dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function (dev) {
        return FS.devices[dev];
      },getMounts:function (mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },syncfs:function (populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          console.log('warning: ' + FS.syncFSRequests + ' FS.syncfs operations in flight at once, probably just doing extra work');
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(err) {
          assert(FS.syncFSRequests > 0);
          FS.syncFSRequests--;
          return callback(err);
        }
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(err);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },mount:function (type, opts, mountpoint) {
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
          }
        }
  
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },unmount:function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.indexOf(current.mount) !== -1) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },lookup:function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function (path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.mayCreate(parent, name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function (path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function (path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdev:function (path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function (oldpath, newpath) {
        if (!PATH.resolve(oldpath)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var newname = PATH.basename(newpath);
        var err = FS.mayCreate(parent, newname);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
        try {
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        // new path should not be an ancestor of the old path
        relative = PATH.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var err = FS.mayDelete(old_dir, old_name, isdir);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        err = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          err = FS.nodePermissions(old_dir, 'w');
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        try {
          if (FS.trackingDelegate['willMovePath']) {
            FS.trackingDelegate['willMovePath'](old_path, new_path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
        try {
          if (FS.trackingDelegate['onMovePath']) FS.trackingDelegate['onMovePath'](old_path, new_path);
        } catch(e) {
          console.log("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
      },rmdir:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, true);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        return node.node_ops.readdir(node);
      },unlink:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, false);
        if (err) {
          // POSIX says unlink should set EPERM, not EISDIR
          if (err === ERRNO_CODES.EISDIR) err = ERRNO_CODES.EPERM;
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readlink:function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },stat:function (path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return node.node_ops.getattr(node);
      },lstat:function (path) {
        return FS.stat(path, true);
      },chmod:function (path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function (path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chmod(stream.node, mode);
      },chown:function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.nodePermissions(node, 'w');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        FS.truncate(stream.node, len);
      },utime:function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var err = FS.mayOpen(node, flags);
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        // do truncation if necessary
        if ((flags & 512)) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            Module['printErr']('read file: ' + path);
          }
        }
        try {
          if (FS.trackingDelegate['onOpenFile']) {
            var trackingFlags = 0;
            if ((flags & 2097155) !== 1) {
              trackingFlags |= FS.tracking.openFlags.READ;
            }
            if ((flags & 2097155) !== 0) {
              trackingFlags |= FS.tracking.openFlags.WRITE;
            }
            FS.trackingDelegate['onOpenFile'](path, trackingFlags);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: " + e.message);
        }
        return stream;
      },close:function (stream) {
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
      },llseek:function (stream, offset, whence) {
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },read:function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if (stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate['onWriteToFile']) FS.trackingDelegate['onWriteToFile'](stream.path);
        } catch(e) {
          console.log("FS.trackingDelegate['onWriteToFile']('"+path+"') threw an exception: " + e.message);
        }
        return bytesWritten;
      },allocate:function (stream, offset, length) {
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function (stream, buffer, offset, length, position, prot, flags) {
        // TODO if PROT is PROT_WRITE, make sure we have write access
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EACCES);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },msync:function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },munmap:function (stream) {
        return 0;
      },ioctl:function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'r';
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },writeFile:function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'w';
        opts.encoding = opts.encoding || 'utf8';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var stream = FS.open(path, opts.flags, opts.mode);
        if (opts.encoding === 'utf8') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn);
        } else if (opts.encoding === 'binary') {
          FS.write(stream, data, 0, data.length, 0, opts.canOwn);
        }
        FS.close(stream);
      },cwd:function () {
        return FS.currentPath;
      },chdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        var err = FS.nodePermissions(lookup.node, 'x');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function () {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },createDefaultDevices:function () {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: function() { return 0; },
          write: function(stream, buffer, offset, length, pos) { return length; }
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using Module['printErr']
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        var random_device;
        if (typeof crypto !== 'undefined') {
          // for modern web browsers
          var randomBuffer = new Uint8Array(1);
          random_device = function() { crypto.getRandomValues(randomBuffer); return randomBuffer[0]; };
        } else if (ENVIRONMENT_IS_NODE) {
          // for nodejs
          random_device = function() { return require('crypto').randomBytes(1)[0]; };
        } else {
          // default for ES5 platforms
          random_device = function() { return (Math.random()*256)|0; };
        }
        FS.createDevice('/dev', 'random', random_device);
        FS.createDevice('/dev', 'urandom', random_device);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createSpecialDirectories:function () {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount: function() {
            var node = FS.createNode('/proc/self', 'fd', 16384 | 0777, 73);
            node.node_ops = {
              lookup: function(parent, name) {
                var fd = +name;
                var stream = FS.getStream(fd);
                if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: function() { return stream.path } }
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },createStandardStreams:function () {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 'r');
        assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');
  
        var stdout = FS.open('/dev/stdout', 'w');
        assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');
  
        var stderr = FS.open('/dev/stderr', 'w');
        assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
      },ensureErrnoError:function () {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno, node) {
          //Module.printErr(stackTrace()); // useful for debugging
          this.node = node;
          this.setErrno = function(errno) {
            this.errno = errno;
            for (var key in ERRNO_CODES) {
              if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
              }
            }
          };
          this.setErrno(errno);
          this.message = ERRNO_MESSAGES[errno];
          if (this.stack) this.stack = demangleAll(this.stack);
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [ERRNO_CODES.ENOENT].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function () {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
          'IDBFS': IDBFS,
          'NODEFS': NODEFS,
          'WORKERFS': WORKERFS,
        };
      },init:function (input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },quit:function () {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        var fflush = Module['_fflush'];
        if (fflush) fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },getMode:function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },joinPath:function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == '/') path = path.substr(1);
        return path;
      },absolutePath:function (relative, base) {
        return PATH.resolve(base, relative);
      },standardizePath:function (path) {
        return PATH.normalize(path);
      },findObject:function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },analyzePath:function (path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },createFolder:function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },createPath:function (parent, path, canRead, canWrite) {
        parent = typeof parent === 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },createFile:function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 'w');
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },createDevice:function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open: function(stream) {
            stream.seekable = false;
          },
          close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },createLink:function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        }
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        }
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (function(from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || '', true);
            }
          });
          var lazyArray = this;
          lazyArray.setDataGetter(function(chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
  
          if (usesGzip || !datalength) {
            // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
            chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
            datalength = this.getter(0).length;
            chunkSize = datalength;
            console.log("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        }
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init(); // XXX perhaps this method should move onto Browser?
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency('cp ' + fullname); // might have several active requests for the same fullname
        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency(dep);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency(dep);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },indexedDB:function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function () {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          console.log('creating db');
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },loadFilesFromDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror; // no database to load from
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
          } catch(e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }};var SYSCALLS={DEFAULT_POLLMASK:5,mappings:{},umask:511,calculateAt:function (dirfd, path) {
        if (path[0] !== '/') {
          // relative path
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            dir = dirstream.path;
          }
          path = PATH.join2(dir, path);
        }
        return path;
      },doStat:function (func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -ERRNO_CODES.ENOTDIR;
          }
          throw e;
        }
        HEAP32[((buf)>>2)]=stat.dev;
        HEAP32[(((buf)+(4))>>2)]=0;
        HEAP32[(((buf)+(8))>>2)]=stat.ino;
        HEAP32[(((buf)+(12))>>2)]=stat.mode;
        HEAP32[(((buf)+(16))>>2)]=stat.nlink;
        HEAP32[(((buf)+(20))>>2)]=stat.uid;
        HEAP32[(((buf)+(24))>>2)]=stat.gid;
        HEAP32[(((buf)+(28))>>2)]=stat.rdev;
        HEAP32[(((buf)+(32))>>2)]=0;
        HEAP32[(((buf)+(36))>>2)]=stat.size;
        HEAP32[(((buf)+(40))>>2)]=4096;
        HEAP32[(((buf)+(44))>>2)]=stat.blocks;
        HEAP32[(((buf)+(48))>>2)]=(stat.atime.getTime() / 1000)|0;
        HEAP32[(((buf)+(52))>>2)]=0;
        HEAP32[(((buf)+(56))>>2)]=(stat.mtime.getTime() / 1000)|0;
        HEAP32[(((buf)+(60))>>2)]=0;
        HEAP32[(((buf)+(64))>>2)]=(stat.ctime.getTime() / 1000)|0;
        HEAP32[(((buf)+(68))>>2)]=0;
        HEAP32[(((buf)+(72))>>2)]=stat.ino;
        return 0;
      },doMsync:function (addr, stream, len, flags) {
        var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
        FS.msync(stream, buffer, 0, len, flags);
      },doMkdir:function (path, mode) {
        // remove a trailing slash, if one - /a/b/ has basename of '', but
        // we want to create b in the context of this function
        path = PATH.normalize(path);
        if (path[path.length-1] === '/') path = path.substr(0, path.length-1);
        FS.mkdir(path, mode, 0);
        return 0;
      },doMknod:function (path, mode, dev) {
        // we don't want this in the JS API as it uses mknod to create all nodes.
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default: return -ERRNO_CODES.EINVAL;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },doReadlink:function (path, buf, bufsize) {
        if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
        var ret = FS.readlink(path);
        ret = ret.slice(0, Math.max(0, bufsize));
        writeStringToMemory(ret, buf, true);
        return ret.length;
      },doAccess:function (path, amode) {
        if (amode & ~7) {
          // need a valid mode
          return -ERRNO_CODES.EINVAL;
        }
        var node;
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
        var perms = '';
        if (amode & 4) perms += 'r';
        if (amode & 2) perms += 'w';
        if (amode & 1) perms += 'x';
        if (perms /* otherwise, they've just passed F_OK */ && FS.nodePermissions(node, perms)) {
          return -ERRNO_CODES.EACCES;
        }
        return 0;
      },doDup:function (path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },doReadv:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.read(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break; // nothing more to read
        }
        return ret;
      },doWritev:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.write(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },getStreamFromFD:function () {
        var stream = FS.getStream(SYSCALLS.get());
        if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return stream;
      },getSocketFromFD:function () {
        var socket = SOCKFS.getSocket(SYSCALLS.get());
        if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return socket;
      },getSocketAddress:function (allowNull) {
        var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
        if (allowNull && addrp === 0) return null;
        var info = __read_sockaddr(addrp, addrlen);
        if (info.errno) throw new FS.ErrnoError(info.errno);
        info.addr = DNS.lookup_addr(info.addr) || info.addr;
        return info;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall5(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // open
      var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get() // optional TODO
      var stream = FS.open(pathname, flags, mode);
      return stream.fd;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___lock() {}

  function ___unlock() {}

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC); 
  Module["_llvm_cttz_i32"] = _llvm_cttz_i32; 
  Module["___udivmoddi4"] = ___udivmoddi4; 
  Module["___udivdi3"] = ___udivdi3;

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

   
  Module["___uremdi3"] = ___uremdi3;

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  
  function __exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      Module['exit'](status);
    }function _exit(status) {
      __exit(status);
    }

   
  Module["_pthread_self"] = _pthread_self;

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doWritev(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
      switch (op) {
        case 21505: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        case 21506: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          var argp = SYSCALLS.get();
          HEAP32[((argp)>>2)]=0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return -ERRNO_CODES.EINVAL; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.get();
          return FS.ioctl(stream, op, argp);
        }
        default: abort('bad ioctl syscall ' + op);
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall221(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fcntl64
      var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -ERRNO_CODES.EINVAL;
          }
          var newStream;
          newStream = FS.open(stream.path, stream.flags, 0, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = SYSCALLS.get();
          stream.flags |= arg;
          return 0;
        }
        case 12:
        case 12: {
          var arg = SYSCALLS.get();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)]=2;
          return 0;
        }
        case 13:
        case 14:
        case 13:
        case 14:
          return 0; // Pretend that the locking is successful.
        case 16:
        case 8:
          return -ERRNO_CODES.EINVAL; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fnctl() returns that, and we set errno ourselves.
          ___setErrNo(ERRNO_CODES.EINVAL);
          return -1;
        default: {
          return -ERRNO_CODES.EINVAL;
        }
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall145(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // readv
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doReadv(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
FS.staticInit();__ATINIT__.unshift(function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() });__ATMAIN__.push(function() { FS.ignorePermissions = false });__ATEXIT__.push(function() { FS.quit() });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;Module["FS_unlink"] = FS.unlink;;
__ATINIT__.unshift(function() { TTY.init() });__ATEXIT__.push(function() { TTY.shutdown() });;
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); var NODEJS_PATH = require("path"); NODEFS.staticInit(); };
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");



function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { Module["printErr"]("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "abortStackOverflow": abortStackOverflow, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_vi": nullFunc_vi, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_vi": invoke_vi, "_pthread_cleanup_pop": _pthread_cleanup_pop, "___syscall221": ___syscall221, "___lock": ___lock, "_abort": _abort, "___setErrNo": ___setErrNo, "___syscall6": ___syscall6, "_sbrk": _sbrk, "___syscall140": ___syscall140, "___syscall5": ___syscall5, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___unlock": ___unlock, "_exit": _exit, "_pthread_cleanup_push": _pthread_cleanup_push, "__exit": __exit, "___syscall145": ___syscall145, "___syscall146": ___syscall146, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'almost asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_vi=env.nullFunc_vi;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_vi=env.invoke_vi;
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var ___syscall221=env.___syscall221;
  var ___lock=env.___lock;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var ___syscall6=env.___syscall6;
  var _sbrk=env._sbrk;
  var ___syscall140=env.___syscall140;
  var ___syscall5=env.___syscall5;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var _exit=env._exit;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var __exit=env.__exit;
  var ___syscall145=env.___syscall145;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _info_open($c_file) {
 $c_file = $c_file|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_buffer6 = 0, $vararg_ptr1 = 0, $vararg_ptr5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer6 = sp + 16|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = $c_file;
 $1 = $0;
 $2 = (_strlen($1)|0);
 $i = $2;
 $3 = $i;
 $4 = (($3) - 1)|0;
 $5 = $0;
 $6 = (($5) + ($4)|0);
 $7 = HEAP8[$6>>0]|0;
 $8 = $7 << 24 >> 24;
 $9 = ($8|0)!=(99);
 if ($9) {
  $10 = HEAP32[2]|0;
  $11 = HEAP32[1710]|0;
  $12 = $0;
  HEAP32[$vararg_buffer>>2] = $11;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $12;
  (_fprintf($10,1286,$vararg_buffer)|0);
  _exit(-1);
  // unreachable;
 }
 $13 = $i;
 $14 = (($13) - 1)|0;
 $15 = $0;
 $16 = (($15) + ($14)|0);
 HEAP8[$16>>0] = 100;
 $17 = $0;
 $18 = (_fopen($17,1328)|0);
 HEAP32[1711] = $18;
 $19 = HEAP32[1711]|0;
 $20 = ($19>>>0)<(0>>>0);
 if ($20) {
  $21 = HEAP32[2]|0;
  $22 = HEAP32[1710]|0;
  $23 = $0;
  HEAP32[$vararg_buffer2>>2] = $22;
  $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
  HEAP32[$vararg_ptr5>>2] = $23;
  (_fprintf($21,1331,$vararg_buffer2)|0);
  _exit(-1);
  // unreachable;
 } else {
  $24 = $i;
  $25 = (($24) - 1)|0;
  $26 = $0;
  $27 = (($26) + ($25)|0);
  HEAP8[$27>>0] = 99;
  $28 = HEAP32[1711]|0;
  $29 = $0;
  HEAP32[$vararg_buffer6>>2] = $29;
  (_fprintf($28,1368,$vararg_buffer6)|0);
  $30 = HEAP32[1712]|0;
  $31 = $30;
  HEAP32[$31>>2] = -14673921;
  $32 = HEAP32[1712]|0;
  $33 = (($32) + 4)|0;
  HEAP32[1712] = $33;
  $34 = HEAP32[1712]|0;
  $35 = $34;
  $36 = $0;
  (_strcpy($35,$36)|0);
  $37 = $0;
  $38 = (_strlen($37)|0);
  $39 = (($38) + 1)|0;
  $40 = HEAP32[1712]|0;
  $41 = (($40) + ($39))|0;
  HEAP32[1712] = $41;
  $42 = HEAP32[1712]|0;
  $43 = (($42) + 7)|0;
  $44 = $43 & -8;
  HEAP32[1712] = $44;
  STACKTOP = sp;return;
 }
}
function _info_print_current_line() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = HEAP32[1711]|0;
 $1 = HEAP32[1712]|0;
 $2 = HEAP32[1713]|0;
 $3 = (($1) - ($2))|0;
 $4 = HEAP32[1714]|0;
 $5 = HEAP32[1715]|0;
 HEAP32[$vararg_buffer>>2] = $3;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $4;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $5;
 (_fprintf($0,1374,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _info_print_name($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $pos = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = $name;
 $1 = $0;
 $pos = $1;
 L1: while(1) {
  $2 = $pos;
  $3 = HEAP8[$2>>0]|0;
  $4 = $3 << 24 >> 24;
  switch ($4|0) {
  case 122: case 121: case 120: case 119: case 118: case 117: case 116: case 115: case 114: case 113: case 112: case 111: case 110: case 109: case 108: case 107: case 106: case 105: case 104: case 103: case 102: case 101: case 100: case 99: case 98: case 97: case 90: case 89: case 88: case 87: case 86: case 85: case 84: case 83: case 82: case 81: case 80: case 79: case 78: case 77: case 76: case 75: case 74: case 73: case 72: case 71: case 70: case 69: case 68: case 67: case 66: case 65: case 57: case 56: case 55: case 54: case 53: case 52: case 51: case 50: case 49: case 48: case 36: case 95:  {
   break;
  }
  default: {
   break L1;
  }
  }
  $5 = $pos;
  $6 = ((($5)) + 1|0);
  $pos = $6;
 }
 $7 = HEAP32[1711]|0;
 $8 = $pos;
 $9 = $0;
 $10 = $8;
 $11 = $9;
 $12 = (($10) - ($11))|0;
 $13 = $0;
 HEAP32[$vararg_buffer>>2] = $12;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $13;
 (_fprintf($7,1390,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _info_print_struct($s) {
 $s = $s|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $mp = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer10 = 0, $vararg_buffer3 = 0, $vararg_buffer5 = 0, $vararg_buffer8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer10 = sp + 40|0;
 $vararg_buffer8 = sp + 32|0;
 $vararg_buffer5 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = $s;
 $1 = HEAP32[1711]|0;
 (_fprintf($1,1395,$vararg_buffer)|0);
 $2 = HEAP32[1711]|0;
 $3 = $0;
 $4 = ((($3)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer1>>2] = $5;
 (_fprintf($2,1397,$vararg_buffer1)|0);
 $6 = $0;
 $7 = ((($6)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $mp = $8;
 while(1) {
  $9 = $mp;
  $10 = ($9|0)!=(0|0);
  $11 = HEAP32[1711]|0;
  if (!($10)) {
   break;
  }
  (_fprintf($11,1395,$vararg_buffer3)|0);
  $12 = $mp;
  $13 = ((($12)) + 8|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = ((($14)) + 20|0);
  $16 = HEAP32[$15>>2]|0;
  _info_print_name($16);
  $17 = HEAP32[1711]|0;
  $18 = $mp;
  $19 = HEAP32[$18>>2]|0;
  HEAP32[$vararg_buffer5>>2] = $19;
  (_fprintf($17,1401,$vararg_buffer5)|0);
  $20 = $mp;
  $21 = ((($20)) + 4|0);
  $22 = HEAP32[$21>>2]|0;
  _info_print_type_str($22);
  $23 = HEAP32[1711]|0;
  (_fprintf($23,1407,$vararg_buffer8)|0);
  $24 = $mp;
  $25 = ((($24)) + 12|0);
  $26 = HEAP32[$25>>2]|0;
  $mp = $26;
 }
 (_fprintf($11,1407,$vararg_buffer10)|0);
 STACKTOP = sp;return;
}
function _info_print_type_str($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $8 = 0, $9 = 0, $d = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer11 = 0, $vararg_buffer13 = 0, $vararg_buffer15 = 0, $vararg_buffer17 = 0, $vararg_buffer19 = 0, $vararg_buffer21 = 0, $vararg_buffer23 = 0;
 var $vararg_buffer25 = 0, $vararg_buffer27 = 0, $vararg_buffer3 = 0, $vararg_buffer30 = 0, $vararg_buffer32 = 0, $vararg_buffer34 = 0, $vararg_buffer36 = 0, $vararg_buffer38 = 0, $vararg_buffer40 = 0, $vararg_buffer44 = 0, $vararg_buffer5 = 0, $vararg_buffer7 = 0, $vararg_buffer9 = 0, $vararg_ptr43 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 192|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer44 = sp + 168|0;
 $vararg_buffer40 = sp + 160|0;
 $vararg_buffer38 = sp + 152|0;
 $vararg_buffer36 = sp + 144|0;
 $vararg_buffer34 = sp + 136|0;
 $vararg_buffer32 = sp + 128|0;
 $vararg_buffer30 = sp + 120|0;
 $vararg_buffer27 = sp + 112|0;
 $vararg_buffer25 = sp + 104|0;
 $vararg_buffer23 = sp + 96|0;
 $vararg_buffer21 = sp + 88|0;
 $vararg_buffer19 = sp + 80|0;
 $vararg_buffer17 = sp + 72|0;
 $vararg_buffer15 = sp + 64|0;
 $vararg_buffer13 = sp + 56|0;
 $vararg_buffer11 = sp + 48|0;
 $vararg_buffer9 = sp + 40|0;
 $vararg_buffer7 = sp + 32|0;
 $vararg_buffer5 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = $t;
 $1 = HEAP32[1711]|0;
 (_fprintf($1,1395,$vararg_buffer)|0);
 $2 = $0;
 $3 = $2 & 960;
 $4 = ($3|0)!=(0);
 L1: do {
  if ($4) {
   $5 = HEAP32[1711]|0;
   (_fprintf($5,1423,$vararg_buffer1)|0);
   $6 = $0;
   $7 = (($6) - 64)|0;
   _info_print_type_str($7);
  } else {
   $8 = $0;
   $9 = $8 & 1023;
   do {
    switch ($9|0) {
    case 1:  {
     $10 = HEAP32[1711]|0;
     (_fprintf($10,1427,$vararg_buffer3)|0);
     break L1;
     break;
    }
    case 2:  {
     $11 = HEAP32[1711]|0;
     (_fprintf($11,1432,$vararg_buffer5)|0);
     break L1;
     break;
    }
    case 3:  {
     $12 = HEAP32[1711]|0;
     (_fprintf($12,1438,$vararg_buffer7)|0);
     break L1;
     break;
    }
    case 4:  {
     $13 = HEAP32[1711]|0;
     (_fprintf($13,1442,$vararg_buffer9)|0);
     break L1;
     break;
    }
    case 5:  {
     $14 = HEAP32[1711]|0;
     (_fprintf($14,1448,$vararg_buffer11)|0);
     break L1;
     break;
    }
    case 8:  {
     $15 = HEAP32[1711]|0;
     (_fprintf($15,1455,$vararg_buffer13)|0);
     break L1;
     break;
    }
    case 16:  {
     $16 = HEAP32[1711]|0;
     (_fprintf($16,1460,$vararg_buffer15)|0);
     break L1;
     break;
    }
    case 17:  {
     $17 = HEAP32[1711]|0;
     (_fprintf($17,1466,$vararg_buffer17)|0);
     break L1;
     break;
    }
    case 27:  {
     $18 = HEAP32[1711]|0;
     (_fprintf($18,1473,$vararg_buffer19)|0);
     break L1;
     break;
    }
    case 28:  {
     $19 = HEAP32[1711]|0;
     (_fprintf($19,1478,$vararg_buffer21)|0);
     break L1;
     break;
    }
    case 32:  {
     $20 = HEAP32[1711]|0;
     (_fprintf($20,1482,$vararg_buffer23)|0);
     $21 = HEAP32[1711]|0;
     $22 = HEAP32[1717]|0;
     $23 = $0;
     $24 = $23 >>> 10;
     $25 = (($22) + ($24))|0;
     $26 = $25;
     $27 = ((($26)) + 4|0);
     $28 = HEAP32[$27>>2]|0;
     HEAP32[$vararg_buffer25>>2] = $28;
     (_fprintf($21,1488,$vararg_buffer25)|0);
     $29 = HEAP32[1711]|0;
     $30 = HEAP32[1717]|0;
     $31 = $0;
     $32 = $31 >>> 10;
     $33 = (($30) + ($32))|0;
     $34 = $33;
     $35 = HEAP32[$34>>2]|0;
     $36 = (_tsize($35)|0);
     HEAP32[$vararg_buffer27>>2] = $36;
     (_fprintf($29,1492,$vararg_buffer27)|0);
     $37 = HEAP32[1717]|0;
     $38 = $0;
     $39 = $38 >>> 10;
     $40 = (($37) + ($39))|0;
     $41 = $40;
     $42 = HEAP32[$41>>2]|0;
     _info_print_type_str($42);
     $43 = HEAP32[1711]|0;
     (_fprintf($43,1407,$vararg_buffer30)|0);
     break L1;
     break;
    }
    case 26:  {
     $44 = HEAP32[1711]|0;
     (_fprintf($44,1496,$vararg_buffer32)|0);
     $45 = HEAP32[1717]|0;
     $46 = $0;
     $47 = $46 >>> 10;
     $48 = (($45) + ($47))|0;
     $49 = $48;
     $50 = HEAP32[$49>>2]|0;
     $d = $50;
     $51 = $d;
     $52 = ($51|0)!=(0|0);
     if ($52) {
      $53 = HEAP32[1711]|0;
      (_fprintf($53,1503,$vararg_buffer34)|0);
      $54 = $d;
      $55 = ((($54)) + 20|0);
      $56 = HEAP32[$55>>2]|0;
      _info_print_name($56);
      $57 = HEAP32[1711]|0;
      (_fprintf($57,1505,$vararg_buffer36)|0);
      break L1;
     } else {
      $58 = HEAP32[1717]|0;
      $59 = $0;
      $60 = $59 >>> 10;
      $61 = (($58) + ($60))|0;
      $62 = $61;
      _info_print_struct($62);
      break L1;
     }
     break;
    }
    default: {
     $63 = HEAP32[1711]|0;
     (_fprintf($63,1507,$vararg_buffer38)|0);
     $64 = HEAP32[2]|0;
     $65 = $0;
     $66 = $65 >>> 10;
     $67 = $0;
     $68 = $67 & 1023;
     HEAP32[$vararg_buffer40>>2] = $66;
     $vararg_ptr43 = ((($vararg_buffer40)) + 4|0);
     HEAP32[$vararg_ptr43>>2] = $68;
     (_fprintf($64,1511,$vararg_buffer40)|0);
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 $69 = HEAP32[1711]|0;
 (_fprintf($69,1407,$vararg_buffer44)|0);
 STACKTOP = sp;return;
}
function _info_print_structs() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $p = 0, $vararg_buffer = 0, $vararg_buffer1 = 0;
 var $vararg_buffer3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = HEAP32[1716]|0;
 $p = $0;
 while(1) {
  $1 = $p;
  $2 = ($1|0)!=(0|0);
  if (!($2)) {
   break;
  }
  $3 = $p;
  $4 = HEAP32[$3>>2]|0;
  $5 = ($4|0)!=(0|0);
  if ($5) {
   $6 = HEAP32[1711]|0;
   (_fprintf($6,1409,$vararg_buffer)|0);
   $7 = $p;
   $8 = HEAP32[$7>>2]|0;
   $9 = ((($8)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   _info_print_name($10);
   $11 = HEAP32[1711]|0;
   (_fprintf($11,1419,$vararg_buffer1)|0);
   $12 = $p;
   _info_print_struct($12);
   $13 = HEAP32[1711]|0;
   (_fprintf($13,1421,$vararg_buffer3)|0);
  }
  $14 = $p;
  $15 = ((($14)) + 16|0);
  $16 = HEAP32[$15>>2]|0;
  $p = $16;
 }
 STACKTOP = sp;return;
}
function _tsize($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $a = 0, $s = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $t;
 $2 = $1;
 $3 = $2 & 1023;
 L1: do {
  switch ($3|0) {
  case 32:  {
   $4 = HEAP32[1717]|0;
   $5 = $1;
   $6 = $5 >>> 10;
   $7 = (($4) + ($6))|0;
   $8 = $7;
   $a = $8;
   $9 = $a;
   $10 = ((($9)) + 4|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = $a;
   $13 = HEAP32[$12>>2]|0;
   $14 = (_tsize($13)|0);
   $15 = Math_imul($11, $14)|0;
   $0 = $15;
   break;
  }
  case 26:  {
   $16 = HEAP32[1717]|0;
   $17 = $1;
   $18 = $17 >>> 10;
   $19 = (($16) + ($18))|0;
   $20 = $19;
   $s = $20;
   $21 = ((($20)) + 8|0);
   $22 = HEAP32[$21>>2]|0;
   $23 = ($22|0)!=(0);
   if ($23) {
    $24 = $s;
    $25 = ((($24)) + 4|0);
    $26 = HEAP32[$25>>2]|0;
    $0 = $26;
    break L1;
   } else {
    _err(2312);
    label = 6;
    break L1;
   }
   break;
  }
  case 28: case 27: case 4: case 1:  {
   label = 6;
   break;
  }
  case 5: case 2:  {
   $0 = 2;
   break;
  }
  case 17:  {
   $0 = 8;
   break;
  }
  default: {
   $0 = 4;
  }
  }
 } while(0);
 if ((label|0) == 6) {
  $0 = 1;
 }
 $27 = $0;
 STACKTOP = sp;return ($27|0);
}
function _info_print_locals($sp) {
 $sp = $sp|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $d = 0, $v = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer10 = 0, $vararg_buffer13 = 0, $vararg_buffer15 = 0, $vararg_buffer18 = 0, $vararg_buffer21 = 0, $vararg_buffer23 = 0, $vararg_buffer3 = 0, $vararg_buffer5 = 0, $vararg_buffer8 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer23 = sp + 80|0;
 $vararg_buffer21 = sp + 72|0;
 $vararg_buffer18 = sp + 64|0;
 $vararg_buffer15 = sp + 56|0;
 $vararg_buffer13 = sp + 48|0;
 $vararg_buffer10 = sp + 40|0;
 $vararg_buffer8 = sp + 32|0;
 $vararg_buffer5 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = $sp;
 $1 = HEAP32[1711]|0;
 $2 = HEAP32[1712]|0;
 $3 = HEAP32[1713]|0;
 $4 = (($2) - ($3))|0;
 HEAP32[$vararg_buffer>>2] = $4;
 (_fprintf($1,1540,$vararg_buffer)|0);
 $5 = HEAP32[1718]|0;
 $v = $5;
 while(1) {
  $6 = $v;
  $7 = $0;
  $8 = ($6|0)!=($7|0);
  if (!($8)) {
   break;
  }
  $9 = $v;
  $10 = ((($9)) + -16|0);
  $v = $10;
  $11 = $v;
  $12 = ((($11)) + 12|0);
  $13 = HEAP32[$12>>2]|0;
  $d = $13;
  $14 = HEAP32[1711]|0;
  (_fprintf($14,1550,$vararg_buffer1)|0);
  $15 = $d;
  $16 = ((($15)) + 20|0);
  $17 = HEAP32[$16>>2]|0;
  _info_print_name($17);
  $18 = $d;
  $19 = HEAP32[$18>>2]|0;
  L4: do {
   switch ($19|0) {
   case 167: case 149:  {
    $20 = $d;
    $21 = ((($20)) + 8|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = ($22|0)<(268435456);
    $24 = HEAP32[1711]|0;
    if ($23) {
     (_fprintf($24,1553,$vararg_buffer3)|0);
     $25 = HEAP32[1711]|0;
     $26 = $d;
     $27 = ((($26)) + 8|0);
     $28 = HEAP32[$27>>2]|0;
     HEAP32[$vararg_buffer5>>2] = $28;
     (_fprintf($25,1558,$vararg_buffer5)|0);
     break L4;
    } else {
     (_fprintf($24,1563,$vararg_buffer8)|0);
     $29 = HEAP32[1711]|0;
     $30 = $d;
     $31 = ((($30)) + 8|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = (($32) - 268435456)|0;
     HEAP32[$vararg_buffer10>>2] = $33;
     (_fprintf($29,1558,$vararg_buffer10)|0);
     break L4;
    }
    break;
   }
   case 166: case 130:  {
    $34 = HEAP32[1711]|0;
    (_fprintf($34,1568,$vararg_buffer13)|0);
    $35 = HEAP32[1711]|0;
    $36 = $d;
    $37 = ((($36)) + 8|0);
    $38 = HEAP32[$37>>2]|0;
    HEAP32[$vararg_buffer15>>2] = $38;
    (_fprintf($35,1558,$vararg_buffer15)|0);
    break;
   }
   default: {
    $39 = HEAP32[2]|0;
    $40 = $d;
    $41 = HEAP32[$40>>2]|0;
    HEAP32[$vararg_buffer18>>2] = $41;
    (_fprintf($39,1573,$vararg_buffer18)|0);
   }
   }
  } while(0);
  $42 = HEAP32[1711]|0;
  (_fprintf($42,1419,$vararg_buffer21)|0);
  $43 = $d;
  $44 = ((($43)) + 4|0);
  $45 = HEAP32[$44>>2]|0;
  _info_print_type_str($45);
  $46 = HEAP32[1711]|0;
  (_fprintf($46,1421,$vararg_buffer23)|0);
 }
 STACKTOP = sp;return;
}
function _info_print_global($v) {
 $v = $v|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer10 = 0, $vararg_buffer12 = 0, $vararg_buffer3 = 0, $vararg_buffer5 = 0, $vararg_buffer7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer12 = sp + 48|0;
 $vararg_buffer10 = sp + 40|0;
 $vararg_buffer7 = sp + 32|0;
 $vararg_buffer5 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = $v;
 $1 = $0;
 $2 = ((($1)) + 12|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)!=(0);
 if ($4) {
  STACKTOP = sp;return;
 }
 $5 = HEAP32[1711]|0;
 (_fprintf($5,1598,$vararg_buffer)|0);
 $6 = $0;
 $7 = ((($6)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 _info_print_name($8);
 $9 = $0;
 $10 = ((($9)) + 8|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ($11|0)<(268435456);
 $13 = HEAP32[1711]|0;
 if ($12) {
  (_fprintf($13,1553,$vararg_buffer1)|0);
  $14 = HEAP32[1711]|0;
  $15 = $0;
  $16 = ((($15)) + 8|0);
  $17 = HEAP32[$16>>2]|0;
  HEAP32[$vararg_buffer3>>2] = $17;
  (_fprintf($14,1558,$vararg_buffer3)|0);
 } else {
  (_fprintf($13,1563,$vararg_buffer5)|0);
  $18 = HEAP32[1711]|0;
  $19 = $0;
  $20 = ((($19)) + 8|0);
  $21 = HEAP32[$20>>2]|0;
  $22 = (($21) - 268435456)|0;
  HEAP32[$vararg_buffer7>>2] = $22;
  (_fprintf($18,1558,$vararg_buffer7)|0);
 }
 $23 = HEAP32[1711]|0;
 (_fprintf($23,1419,$vararg_buffer10)|0);
 $24 = $0;
 $25 = ((($24)) + 4|0);
 $26 = HEAP32[$25>>2]|0;
 _info_print_type_str($26);
 $27 = HEAP32[1711]|0;
 (_fprintf($27,1421,$vararg_buffer12)|0);
 STACKTOP = sp;return;
}
function _info_close($text) {
 $text = $text|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer13 = 0, $vararg_buffer16 = 0, $vararg_buffer3 = 0, $vararg_buffer8 = 0, $vararg_ptr1 = 0, $vararg_ptr11 = 0, $vararg_ptr12 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer16 = sp + 56|0;
 $vararg_buffer13 = sp + 48|0;
 $vararg_buffer8 = sp + 32|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $0 = $text;
 _info_print_structs();
 $1 = HEAP32[1719]|0;
 $2 = ($1|0)!=(0);
 if ($2) {
  $3 = HEAP32[1711]|0;
  $4 = $0;
  $5 = $0;
  HEAP32[$vararg_buffer>>2] = 0;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $4;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $5;
  (_fprintf($3,1601,$vararg_buffer)|0);
  $6 = HEAP32[1711]|0;
  $7 = $0;
  $8 = HEAP32[1720]|0;
  $9 = $0;
  $10 = HEAP32[1720]|0;
  $11 = (($9) + ($10))|0;
  HEAP32[$vararg_buffer3>>2] = $7;
  $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
  HEAP32[$vararg_ptr6>>2] = $8;
  $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
  HEAP32[$vararg_ptr7>>2] = $11;
  (_fprintf($6,1634,$vararg_buffer3)|0);
  $12 = HEAP32[1711]|0;
  $13 = $0;
  $14 = HEAP32[1720]|0;
  $15 = (($13) + ($14))|0;
  $16 = HEAP32[1721]|0;
  $17 = $0;
  $18 = HEAP32[1720]|0;
  $19 = (($17) + ($18))|0;
  $20 = HEAP32[1721]|0;
  $21 = (($19) + ($20))|0;
  HEAP32[$vararg_buffer8>>2] = $15;
  $vararg_ptr11 = ((($vararg_buffer8)) + 4|0);
  HEAP32[$vararg_ptr11>>2] = $16;
  $vararg_ptr12 = ((($vararg_buffer8)) + 8|0);
  HEAP32[$vararg_ptr12>>2] = $21;
  (_fprintf($12,1667,$vararg_buffer8)|0);
 }
 $22 = HEAP32[1711]|0;
 $23 = $0;
 HEAP32[$vararg_buffer13>>2] = $23;
 (_fprintf($22,1700,$vararg_buffer13)|0);
 $24 = HEAP32[1711]|0;
 $25 = $0;
 $26 = HEAP32[1720]|0;
 $27 = (($25) + ($26))|0;
 HEAP32[$vararg_buffer16>>2] = $27;
 (_fprintf($24,1714,$vararg_buffer16)|0);
 $28 = HEAP32[1711]|0;
 (_fclose($28)|0);
 STACKTOP = sp;return;
}
function _xsbrk($i) {
 $i = $i|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $p = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $1 = $i;
 $2 = $1;
 $3 = ($2|0)!=(0);
 if (!($3)) {
  $4 = HEAP32[1722]|0;
  $5 = $4;
  $0 = $5;
  $19 = $0;
  STACKTOP = sp;return ($19|0);
 }
 $6 = $1;
 $7 = ($6|0)<(0);
 if ($7) {
  $8 = HEAP32[2]|0;
  (_fprintf($8,1728,$vararg_buffer)|0);
  _exit(-1);
  // unreachable;
 }
 $9 = $1;
 $10 = (_malloc($9)|0);
 $p = $10;
 $11 = $p;
 $12 = ($11|0)!=(0|0);
 if ($12) {
  $13 = $p;
  $14 = $1;
  _memset(($13|0),0,($14|0))|0;
  $15 = $1;
  $16 = HEAP32[1722]|0;
  $17 = (($16) + ($15))|0;
  HEAP32[1722] = $17;
  $18 = $p;
  $0 = $18;
  $19 = $0;
  STACKTOP = sp;return ($19|0);
 } else {
  $0 = (-1);
  $19 = $0;
  STACKTOP = sp;return ($19|0);
 }
 return (0)|0;
}
function _alloc($size) {
 $size = $size|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $p = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = $size;
 $1 = $0;
 $2 = (($1) + 7)|0;
 $3 = $2 & -8;
 $4 = (_xsbrk($3)|0);
 $p = $4;
 $5 = ($4|0)==((-1)|0);
 if ($5) {
  $6 = HEAP32[2]|0;
  $7 = HEAP32[1710]|0;
  $8 = $0;
  HEAP32[$vararg_buffer>>2] = $7;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $8;
  (_fprintf($6,1755,$vararg_buffer)|0);
  _exit(-1);
  // unreachable;
 } else {
  $9 = $p;
  $10 = $9;
  $11 = (($10) + 7)|0;
  $12 = $11 & -8;
  $13 = $12;
  STACKTOP = sp;return ($13|0);
 }
 return (0)|0;
}
function _err($msg) {
 $msg = $msg|0;
 var $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer4 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer4 = sp + 16|0;
 $vararg_buffer = sp;
 $0 = $msg;
 $1 = HEAP32[2]|0;
 $2 = HEAP32[1710]|0;
 $3 = HEAP32[1714]|0;
 $4 = HEAP32[1715]|0;
 $5 = $0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $4;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $5;
 (_fprintf($1,1787,$vararg_buffer)|0);
 $6 = HEAP32[1723]|0;
 $7 = (($6) + 1)|0;
 HEAP32[1723] = $7;
 $8 = ($7|0)>(10);
 if ($8) {
  $9 = HEAP32[2]|0;
  $10 = HEAP32[1710]|0;
  HEAP32[$vararg_buffer4>>2] = $10;
  (_fprintf($9,1811,$vararg_buffer4)|0);
  _exit(-1);
  // unreachable;
 } else {
  STACKTOP = sp;return;
 }
}
function _file_exist($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $f = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $name;
 $2 = $1;
 $3 = (_fopen($2,1848)|0);
 $f = $3;
 $4 = ($3|0)!=(0|0);
 if ($4) {
  $5 = $f;
  (_fclose($5)|0);
  $0 = 1;
 } else {
  $0 = 0;
 }
 $6 = $0;
 STACKTOP = sp;return ($6|0);
}
function _mapfile($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $f = 0, $p = 0, $size = 0, $vararg_buffer = 0, $vararg_buffer4 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0;
 var $vararg_ptr7 = 0, $vararg_ptr8 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer4 = sp + 16|0;
 $vararg_buffer = sp;
 $0 = $name;
 $1 = $0;
 $2 = (_fopen($1,1848)|0);
 $f = $2;
 $3 = ($2|0)!=(0|0);
 if (!($3)) {
  $4 = HEAP32[2]|0;
  $5 = HEAP32[1710]|0;
  $6 = HEAP32[1714]|0;
  $7 = HEAP32[1715]|0;
  $8 = $0;
  HEAP32[$vararg_buffer>>2] = $5;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $6;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $7;
  $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
  HEAP32[$vararg_ptr3>>2] = $8;
  (_fprintf($4,1851,$vararg_buffer)|0);
  _exit(-1);
  // unreachable;
 }
 $9 = $f;
 (_fseek($9,0,2)|0);
 $10 = $f;
 $11 = (_ftell($10)|0);
 $size = $11;
 $12 = $f;
 (_fseek($12,0,0)|0);
 $13 = $size;
 $14 = (($13) + 1)|0;
 $15 = (_alloc($14)|0);
 $p = $15;
 $16 = $p;
 $17 = $size;
 $18 = $f;
 $19 = (_fread($16,1,$17,$18)|0);
 $20 = $size;
 $21 = ($19|0)!=($20|0);
 if ($21) {
  $22 = HEAP32[2]|0;
  $23 = HEAP32[1710]|0;
  $24 = HEAP32[1714]|0;
  $25 = HEAP32[1715]|0;
  $26 = $0;
  HEAP32[$vararg_buffer4>>2] = $23;
  $vararg_ptr7 = ((($vararg_buffer4)) + 4|0);
  HEAP32[$vararg_ptr7>>2] = $24;
  $vararg_ptr8 = ((($vararg_buffer4)) + 8|0);
  HEAP32[$vararg_ptr8>>2] = $25;
  $vararg_ptr9 = ((($vararg_buffer4)) + 12|0);
  HEAP32[$vararg_ptr9>>2] = $26;
  (_fprintf($22,1891,$vararg_buffer4)|0);
  _exit(-1);
  // unreachable;
 } else {
  $27 = $f;
  (_fclose($27)|0);
  $28 = $size;
  $29 = $p;
  $30 = (($29) + ($28)|0);
  HEAP8[$30>>0] = 0;
  $31 = $p;
  STACKTOP = sp;return ($31|0);
 }
 return (0)|0;
}
function _em($i) {
 $i = $i|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = $i;
 $1 = HEAP32[1719]|0;
 $2 = ($1|0)!=(0);
 if ($2) {
  $3 = HEAP32[1711]|0;
  $4 = HEAP32[1712]|0;
  $5 = HEAP32[1713]|0;
  $6 = (($4) - ($5))|0;
  $7 = $0;
  $8 = $0;
  $9 = ($8*5)|0;
  $10 = (240 + ($9)|0);
  HEAP32[$vararg_buffer>>2] = $6;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $7;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  (_fprintf($3,1931,$vararg_buffer)|0);
 }
 _info_print_current_line();
 $11 = $0;
 $12 = HEAP32[1712]|0;
 $13 = $12;
 HEAP32[$13>>2] = $11;
 $14 = HEAP32[1712]|0;
 $15 = (($14) + 4)|0;
 HEAP32[1712] = $15;
 STACKTOP = sp;return;
}
function _emi($i,$c) {
 $i = $i|0;
 $c = $c|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = $i;
 $1 = $c;
 $2 = HEAP32[1719]|0;
 $3 = ($2|0)!=(0);
 if ($3) {
  $4 = HEAP32[1711]|0;
  $5 = HEAP32[1712]|0;
  $6 = HEAP32[1713]|0;
  $7 = (($5) - ($6))|0;
  $8 = $0;
  $9 = $1;
  $10 = $9 << 8;
  $11 = $8 | $10;
  $12 = $0;
  $13 = ($12*5)|0;
  $14 = (240 + ($13)|0);
  $15 = $1;
  HEAP32[$vararg_buffer>>2] = $7;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $11;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $14;
  $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
  HEAP32[$vararg_ptr3>>2] = $15;
  (_fprintf($4,1953,$vararg_buffer)|0);
 }
 _info_print_current_line();
 $16 = $1;
 $17 = $16 << 8;
 $18 = $17 >> 8;
 $19 = $1;
 $20 = ($18|0)!=($19|0);
 if ($20) {
  _err(1978);
 }
 $21 = $0;
 $22 = $1;
 $23 = $22 << 8;
 $24 = $21 | $23;
 $25 = HEAP32[1712]|0;
 $26 = $25;
 HEAP32[$26>>2] = $24;
 $27 = HEAP32[1712]|0;
 $28 = (($27) + 4)|0;
 HEAP32[1712] = $28;
 STACKTOP = sp;return;
}
function _emj($i,$c) {
 $i = $i|0;
 $c = $c|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $i;
 $1 = $c;
 $2 = $0;
 $3 = $1;
 $4 = HEAP32[1712]|0;
 $5 = (($3) - ($4))|0;
 $6 = (($5) - 4)|0;
 _emi($2,$6);
 STACKTOP = sp;return;
}
function _eml($i,$c) {
 $i = $i|0;
 $c = $c|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $i;
 $1 = $c;
 $2 = $0;
 $3 = $1;
 $4 = HEAP32[1724]|0;
 $5 = (($3) - ($4))|0;
 _emi($2,$5);
 STACKTOP = sp;return;
}
function _emg($i,$c) {
 $i = $i|0;
 $c = $c|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $i;
 $1 = $c;
 $2 = $1;
 $3 = ($2|0)<(268435456);
 $4 = HEAP32[1712]|0;
 if ($3) {
  $5 = HEAP32[1725]|0;
  $6 = ((($5)) + 4|0);
  HEAP32[1725] = $6;
  HEAP32[$5>>2] = $4;
  $11 = $0;
  $12 = $1;
  _emi($11,$12);
  STACKTOP = sp;return;
 } else {
  $7 = HEAP32[1726]|0;
  $8 = ((($7)) + 4|0);
  HEAP32[1726] = $8;
  HEAP32[$7>>2] = $4;
  $9 = $1;
  $10 = (($9) - 268435456)|0;
  $1 = $10;
  $11 = $0;
  $12 = $1;
  _emi($11,$12);
  STACKTOP = sp;return;
 }
}
function _emf($i,$c) {
 $i = $i|0;
 $c = $c|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = $i;
 $1 = $c;
 $2 = HEAP32[1719]|0;
 $3 = ($2|0)!=(0);
 if ($3) {
  $4 = HEAP32[1711]|0;
  $5 = HEAP32[1712]|0;
  $6 = HEAP32[1713]|0;
  $7 = (($5) - ($6))|0;
  $8 = $0;
  $9 = $1;
  $10 = $9 << 8;
  $11 = $8 | $10;
  $12 = $0;
  $13 = ($12*5)|0;
  $14 = (240 + ($13)|0);
  HEAP32[$vararg_buffer>>2] = $7;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $11;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $14;
  (_fprintf($4,2007,$vararg_buffer)|0);
 }
 _info_print_current_line();
 $15 = $1;
 $16 = $15 << 8;
 $17 = $16 >> 8;
 $18 = $1;
 $19 = ($17|0)!=($18|0);
 if ($19) {
  _err(2035);
 }
 $20 = $0;
 $21 = $1;
 $22 = $21 << 8;
 $23 = $20 | $22;
 $24 = HEAP32[1712]|0;
 $25 = $24;
 HEAP32[$25>>2] = $23;
 $26 = HEAP32[1712]|0;
 $27 = (($26) + 4)|0;
 HEAP32[1712] = $27;
 $28 = HEAP32[1712]|0;
 $29 = (($28) - 4)|0;
 $30 = HEAP32[1713]|0;
 $31 = (($29) - ($30))|0;
 STACKTOP = sp;return ($31|0);
}
function _patch($t,$a) {
 $t = $t|0;
 $a = $a|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $n = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = $a;
 while(1) {
  $2 = $0;
  $3 = ($2|0)!=(0);
  if (!($3)) {
   break;
  }
  $4 = HEAP32[1713]|0;
  $5 = $0;
  $6 = (($5) + ($4))|0;
  $0 = $6;
  $7 = $6;
  $8 = HEAP32[$7>>2]|0;
  $n = $8;
  $9 = $n;
  $10 = $9 & 255;
  $11 = $1;
  $12 = $0;
  $13 = (($11) - ($12))|0;
  $14 = (($13) - 4)|0;
  $15 = $14 << 8;
  $16 = $10 | $15;
  $17 = $0;
  $18 = $17;
  HEAP32[$18>>2] = $16;
  $19 = $n;
  $20 = $19 >> 8;
  $0 = $20;
 }
 STACKTOP = sp;return;
}
function _dline() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $p = 0, $vararg_buffer = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = HEAP32[1727]|0;
 $p = $0;
 while(1) {
  $1 = $p;
  $2 = HEAP8[$1>>0]|0;
  $3 = $2 << 24 >> 24;
  $4 = ($3|0)!=(0);
  if (!($4)) {
   break;
  }
  $5 = $p;
  $6 = HEAP8[$5>>0]|0;
  $7 = $6 << 24 >> 24;
  $8 = ($7|0)!=(10);
  if (!($8)) {
   break;
  }
  $9 = $p;
  $10 = HEAP8[$9>>0]|0;
  $11 = $10 << 24 >> 24;
  $12 = ($11|0)!=(13);
  if (!($12)) {
   break;
  }
  $13 = $p;
  $14 = ((($13)) + 1|0);
  $p = $14;
 }
 $15 = HEAP32[1711]|0;
 $16 = HEAP32[1714]|0;
 $17 = HEAP32[1715]|0;
 $18 = $p;
 $19 = HEAP32[1727]|0;
 $20 = $18;
 $21 = $19;
 $22 = (($20) - ($21))|0;
 $23 = HEAP32[1727]|0;
 HEAP32[$vararg_buffer>>2] = $16;
 $vararg_ptr2 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr2>>2] = $17;
 $vararg_ptr3 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr3>>2] = $22;
 $vararg_ptr4 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr4>>2] = $23;
 (_fprintf($15,2062,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _next() {
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0.0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0.0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0.0, $262 = 0.0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0.0, $269 = 0.0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0.0, $286 = 0, $287 = 0.0, $288 = 0.0, $289 = 0.0, $29 = 0, $290 = 0.0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0;
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0;
 var $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0;
 var $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0;
 var $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0;
 var $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0;
 var $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0;
 var $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0;
 var $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0;
 var $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0;
 var $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0;
 var $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0;
 var $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0;
 var $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0;
 var $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0;
 var $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0;
 var $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0;
 var $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0;
 var $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0;
 var $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0;
 var $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0;
 var $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0;
 var $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0;
 var $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0;
 var $97 = 0, $98 = 0, $99 = 0, $b = 0, $hm = 0, $or$cond = 0, $or$cond15 = 0, $p = 0, $vararg_buffer = 0, $vararg_buffer19 = 0, $vararg_ptr16 = 0, $vararg_ptr17 = 0, $vararg_ptr18 = 0, $vararg_ptr22 = 0, $vararg_ptr23 = 0, $vararg_ptr24 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer19 = sp + 16|0;
 $vararg_buffer = sp;
 L1: while(1) {
  $0 = HEAP32[1727]|0;
  $1 = ((($0)) + 1|0);
  HEAP32[1727] = $1;
  $2 = HEAP8[$0>>0]|0;
  $3 = $2 << 24 >> 24;
  HEAP32[9923] = $3;
  switch ($3|0) {
  case 12: case 13: case 11: case 9: case 32:  {
   continue L1;
   break;
  }
  case 122: case 121: case 120: case 119: case 118: case 117: case 116: case 115: case 114: case 113: case 112: case 111: case 110: case 109: case 108: case 107: case 106: case 105: case 104: case 103: case 102: case 101: case 100: case 99: case 98: case 97: case 90: case 89: case 88: case 87: case 86: case 85: case 84: case 83: case 82: case 81: case 80: case 79: case 78: case 77: case 76: case 75: case 74: case 73: case 72: case 71: case 70: case 69: case 68: case 67: case 66: case 65: case 36: case 95:  {
   label = 49;
   break L1;
   break;
  }
  case 57: case 56: case 55: case 54: case 53: case 52: case 51: case 50: case 49: case 48:  {
   label = 60;
   break L1;
   break;
  }
  case 34: case 39:  {
   label = 119;
   break L1;
   break;
  }
  case 61:  {
   label = 156;
   break L1;
   break;
  }
  case 43:  {
   label = 159;
   break L1;
   break;
  }
  case 45:  {
   label = 164;
   break L1;
   break;
  }
  case 42:  {
   label = 171;
   break L1;
   break;
  }
  case 60:  {
   label = 174;
   break L1;
   break;
  }
  case 62:  {
   label = 181;
   break L1;
   break;
  }
  case 124:  {
   label = 188;
   break L1;
   break;
  }
  case 38:  {
   label = 193;
   break L1;
   break;
  }
  case 33:  {
   label = 198;
   break L1;
   break;
  }
  case 37:  {
   label = 200;
   break L1;
   break;
  }
  case 94:  {
   label = 203;
   break L1;
   break;
  }
  case 44:  {
   label = 206;
   break L1;
   break;
  }
  case 63:  {
   label = 207;
   break L1;
   break;
  }
  case 46:  {
   label = 208;
   break L1;
   break;
  }
  case 40:  {
   label = 215;
   break L1;
   break;
  }
  case 91:  {
   label = 216;
   break L1;
   break;
  }
  case 93: case 41: case 125: case 123: case 58: case 59: case 126:  {
   label = 221;
   break L1;
   break;
  }
  case 10:  {
   $4 = HEAP32[1715]|0;
   $5 = (($4) + 1)|0;
   HEAP32[1715] = $5;
   $6 = HEAP32[1719]|0;
   $7 = ($6|0)!=(0);
   if (!($7)) {
    continue L1;
   }
   _dline();
   continue L1;
   break;
  }
  case 35:  {
   $8 = HEAP32[1727]|0;
   $9 = (_memcmp($8,2077,7)|0);
   $10 = ($9|0)!=(0);
   if ($10) {
    while(1) {
     $143 = HEAP32[1727]|0;
     $144 = HEAP8[$143>>0]|0;
     $145 = $144 << 24 >> 24;
     $146 = ($145|0)!=(0);
     if (!($146)) {
      continue L1;
     }
     $147 = HEAP32[1727]|0;
     $148 = HEAP8[$147>>0]|0;
     $149 = $148 << 24 >> 24;
     $150 = ($149|0)!=(10);
     if (!($150)) {
      continue L1;
     }
     $151 = HEAP32[1727]|0;
     $152 = ((($151)) + 1|0);
     HEAP32[1727] = $152;
    }
   }
   $11 = HEAP32[1728]|0;
   $12 = ($11|0)!=(0|0);
   if ($12) {
    label = 7;
    break L1;
   }
   $13 = HEAP32[1727]|0;
   $14 = ((($13)) + 7|0);
   HEAP32[1727] = $14;
   while(1) {
    $15 = HEAP32[1727]|0;
    $16 = HEAP8[$15>>0]|0;
    $17 = $16 << 24 >> 24;
    $18 = ($17|0)==(32);
    if ($18) {
     $720 = 1;
    } else {
     $19 = HEAP32[1727]|0;
     $20 = HEAP8[$19>>0]|0;
     $21 = $20 << 24 >> 24;
     $22 = ($21|0)==(9);
     $720 = $22;
    }
    $23 = HEAP32[1727]|0;
    if (!($720)) {
     break;
    }
    $24 = ((($23)) + 1|0);
    HEAP32[1727] = $24;
   }
   $25 = HEAP8[$23>>0]|0;
   $26 = $25 << 24 >> 24;
   $27 = ($26|0)!=(34);
   if ($27) {
    $28 = HEAP32[1727]|0;
    $29 = HEAP8[$28>>0]|0;
    $30 = $29 << 24 >> 24;
    $31 = ($30|0)!=(60);
    if ($31) {
     label = 15;
     break L1;
    }
   }
   $32 = HEAP32[1727]|0;
   $33 = ((($32)) + 1|0);
   HEAP32[1727] = $33;
   HEAP32[1729] = $32;
   $34 = HEAP32[1727]|0;
   $35 = HEAP8[$34>>0]|0;
   $36 = $35 << 24 >> 24;
   $37 = ($36|0)==(47);
   L25: do {
    if ($37) {
     $b = 0;
    } else {
     $38 = HEAP32[9924]|0;
     $39 = ($38|0)!=(0|0);
     if ($39) {
      $40 = HEAP32[9924]|0;
      $41 = HEAP32[9924]|0;
      $42 = (_strlen($41)|0);
      $b = $42;
      _memcpy((40296|0),($40|0),($42|0))|0;
      $43 = $b;
      $44 = (($43) + 1)|0;
      $b = $44;
      $45 = (40296 + ($43)|0);
      HEAP8[$45>>0] = 47;
      break;
     }
     $46 = HEAP32[1714]|0;
     $47 = (_strlen($46)|0);
     $b = $47;
     while(1) {
      $48 = $b;
      $49 = ($48|0)!=(0);
      if (!($49)) {
       break L25;
      }
      $50 = $b;
      $51 = (($50) - 1)|0;
      $52 = HEAP32[1714]|0;
      $53 = (($52) + ($51)|0);
      $54 = HEAP8[$53>>0]|0;
      $55 = $54 << 24 >> 24;
      $56 = ($55|0)==(47);
      if ($56) {
       break;
      }
      $59 = $b;
      $60 = (($59) + -1)|0;
      $b = $60;
     }
     $57 = HEAP32[1714]|0;
     $58 = $b;
     _memcpy((40296|0),($57|0),($58|0))|0;
    }
   } while(0);
   while(1) {
    $61 = HEAP32[1727]|0;
    $62 = HEAP8[$61>>0]|0;
    $63 = $62 << 24 >> 24;
    $64 = ($63|0)!=(0);
    if (!($64)) {
     break;
    }
    $65 = HEAP32[1727]|0;
    $66 = HEAP8[$65>>0]|0;
    $67 = $66 << 24 >> 24;
    $68 = ($67|0)!=(62);
    if (!($68)) {
     break;
    }
    $69 = HEAP32[1727]|0;
    $70 = HEAP8[$69>>0]|0;
    $71 = $70 << 24 >> 24;
    $72 = ($71|0)!=(34);
    $73 = $b;
    $74 = ($73>>>0)<(511);
    $or$cond = $72 & $74;
    if (!($or$cond)) {
     break;
    }
    $75 = HEAP32[1727]|0;
    $76 = ((($75)) + 1|0);
    HEAP32[1727] = $76;
    $77 = HEAP8[$75>>0]|0;
    $78 = $b;
    $79 = (($78) + 1)|0;
    $b = $79;
    $80 = (40296 + ($78)|0);
    HEAP8[$80>>0] = $77;
   }
   $81 = $b;
   $82 = (40296 + ($81)|0);
   HEAP8[$82>>0] = 0;
   $83 = (_file_exist(40296)|0);
   $84 = ($83|0)!=(0);
   if (!($84)) {
    $85 = HEAP32[1729]|0;
    $86 = HEAP8[$85>>0]|0;
    $87 = $86 << 24 >> 24;
    $88 = ($87|0)==(34);
    if ($88) {
     label = 32;
     break L1;
    }
    $89 = HEAP32[1729]|0;
    $90 = ((($89)) + 1|0);
    $91 = HEAP8[$90>>0]|0;
    $92 = $91 << 24 >> 24;
    $93 = ($92|0)==(47);
    if ($93) {
     label = 32;
     break L1;
    }
    $b = 5;
    ;HEAP8[40296>>0]=HEAP8[2172>>0]|0;HEAP8[40296+1>>0]=HEAP8[2172+1>>0]|0;HEAP8[40296+2>>0]=HEAP8[2172+2>>0]|0;HEAP8[40296+3>>0]=HEAP8[2172+3>>0]|0;HEAP8[40296+4>>0]=HEAP8[2172+4>>0]|0;
    $98 = HEAP32[1729]|0;
    $99 = ((($98)) + 1|0);
    HEAP32[1727] = $99;
    while(1) {
     $100 = HEAP32[1727]|0;
     $101 = HEAP8[$100>>0]|0;
     $102 = $101 << 24 >> 24;
     $103 = ($102|0)!=(0);
     if (!($103)) {
      break;
     }
     $104 = HEAP32[1727]|0;
     $105 = HEAP8[$104>>0]|0;
     $106 = $105 << 24 >> 24;
     $107 = ($106|0)!=(62);
     if (!($107)) {
      break;
     }
     $108 = HEAP32[1727]|0;
     $109 = HEAP8[$108>>0]|0;
     $110 = $109 << 24 >> 24;
     $111 = ($110|0)!=(34);
     $112 = $b;
     $113 = ($112>>>0)<(511);
     $or$cond15 = $111 & $113;
     if (!($or$cond15)) {
      break;
     }
     $114 = HEAP32[1727]|0;
     $115 = ((($114)) + 1|0);
     HEAP32[1727] = $115;
     $116 = HEAP8[$114>>0]|0;
     $117 = $b;
     $118 = (($117) + 1)|0;
     $b = $118;
     $119 = (40296 + ($117)|0);
     HEAP8[$119>>0] = $116;
    }
    $120 = $b;
    $121 = (40296 + ($120)|0);
    HEAP8[$121>>0] = 0;
    $122 = (_file_exist(40296)|0);
    $123 = ($122|0)!=(0);
    if (!($123)) {
     label = 39;
     break L1;
    }
   }
   while(1) {
    $128 = HEAP32[1727]|0;
    $129 = HEAP8[$128>>0]|0;
    $130 = $129 << 24 >> 24;
    $131 = ($130|0)!=(0);
    if ($131) {
     $132 = HEAP32[1727]|0;
     $133 = HEAP8[$132>>0]|0;
     $134 = $133 << 24 >> 24;
     $135 = ($134|0)!=(10);
     $721 = $135;
    } else {
     $721 = 0;
    }
    $136 = HEAP32[1727]|0;
    if (!($721)) {
     break;
    }
    $137 = ((($136)) + 1|0);
    HEAP32[1727] = $137;
   }
   HEAP32[1729] = $136;
   $138 = (_mapfile(40296)|0);
   HEAP32[1727] = $138;
   $139 = HEAP32[1714]|0;
   HEAP32[1728] = $139;
   HEAP32[1714] = 40296;
   $140 = HEAP32[1715]|0;
   HEAP32[1730] = $140;
   HEAP32[1715] = 1;
   $141 = HEAP32[1719]|0;
   $142 = ($141|0)!=(0);
   if (!($142)) {
    continue L1;
   }
   _dline();
   continue L1;
   break;
  }
  case 47:  {
   $398 = HEAP32[1727]|0;
   $399 = HEAP8[$398>>0]|0;
   $400 = $399 << 24 >> 24;
   $401 = ($400|0)==(47);
   if ($401) {
    while(1) {
     $402 = HEAP32[1727]|0;
     $403 = ((($402)) + 1|0);
     HEAP32[1727] = $403;
     $404 = HEAP8[$403>>0]|0;
     $405 = $404 << 24 >> 24;
     $406 = ($405|0)!=(10);
     if (!($406)) {
      continue L1;
     }
     $407 = HEAP32[1727]|0;
     $408 = HEAP8[$407>>0]|0;
     $409 = $408 << 24 >> 24;
     $410 = ($409|0)!=(0);
     if (!($410)) {
      continue L1;
     }
    }
   }
   $411 = HEAP32[1727]|0;
   $412 = HEAP8[$411>>0]|0;
   $413 = $412 << 24 >> 24;
   $414 = ($413|0)==(42);
   if (!($414)) {
    label = 116;
    break L1;
   }
   while(1) {
    $415 = HEAP32[1727]|0;
    $416 = ((($415)) + 1|0);
    HEAP32[1727] = $416;
    $417 = HEAP8[$416>>0]|0;
    $418 = ($417<<24>>24)!=(0);
    if (!($418)) {
     continue L1;
    }
    $419 = HEAP32[1727]|0;
    $420 = HEAP8[$419>>0]|0;
    $421 = $420 << 24 >> 24;
    $422 = ($421|0)==(42);
    if ($422) {
     $423 = HEAP32[1727]|0;
     $424 = ((($423)) + 1|0);
     $425 = HEAP8[$424>>0]|0;
     $426 = $425 << 24 >> 24;
     $427 = ($426|0)==(47);
     if ($427) {
      break;
     }
    }
    $430 = HEAP32[1727]|0;
    $431 = HEAP8[$430>>0]|0;
    $432 = $431 << 24 >> 24;
    $433 = ($432|0)==(10);
    if (!($433)) {
     continue;
    }
    $434 = HEAP32[1715]|0;
    $435 = (($434) + 1)|0;
    HEAP32[1715] = $435;
    $436 = HEAP32[1719]|0;
    $437 = ($436|0)!=(0);
    if (!($437)) {
     continue;
    }
    $438 = HEAP32[1727]|0;
    $439 = ((($438)) + 1|0);
    HEAP32[1727] = $439;
    _dline();
    $440 = HEAP32[1727]|0;
    $441 = ((($440)) + -1|0);
    HEAP32[1727] = $441;
   }
   $428 = HEAP32[1727]|0;
   $429 = ((($428)) + 2|0);
   HEAP32[1727] = $429;
   continue L1;
   break;
  }
  case 0:  {
   $713 = HEAP32[1728]|0;
   $714 = ($713|0)!=(0|0);
   if (!($714)) {
    label = 218;
    break L1;
   }
   $717 = HEAP32[1728]|0;
   HEAP32[1714] = $717;
   HEAP32[1728] = 0;
   $718 = HEAP32[1729]|0;
   HEAP32[1727] = $718;
   $719 = HEAP32[1730]|0;
   HEAP32[1715] = $719;
   continue L1;
   break;
  }
  default: {
   _err(2213);
   continue L1;
  }
  }
 }
 L77:  switch (label|0) {
  case 7: {
   _err(2085);
   _exit(-1);
   // unreachable;
   break;
  }
  case 15: {
   _err(2110);
   _exit(-1);
   // unreachable;
   break;
  }
  case 32: {
   $94 = HEAP32[2]|0;
   $95 = HEAP32[1710]|0;
   $96 = HEAP32[1714]|0;
   $97 = HEAP32[1715]|0;
   HEAP32[$vararg_buffer>>2] = $95;
   $vararg_ptr16 = ((($vararg_buffer)) + 4|0);
   HEAP32[$vararg_ptr16>>2] = $96;
   $vararg_ptr17 = ((($vararg_buffer)) + 8|0);
   HEAP32[$vararg_ptr17>>2] = $97;
   $vararg_ptr18 = ((($vararg_buffer)) + 12|0);
   HEAP32[$vararg_ptr18>>2] = 40296;
   (_fprintf($94,2132,$vararg_buffer)|0);
   _exit(-1);
   // unreachable;
   break;
  }
  case 39: {
   $124 = HEAP32[2]|0;
   $125 = HEAP32[1710]|0;
   $126 = HEAP32[1714]|0;
   $127 = HEAP32[1715]|0;
   HEAP32[$vararg_buffer19>>2] = $125;
   $vararg_ptr22 = ((($vararg_buffer19)) + 4|0);
   HEAP32[$vararg_ptr22>>2] = $126;
   $vararg_ptr23 = ((($vararg_buffer19)) + 8|0);
   HEAP32[$vararg_ptr23>>2] = $127;
   $vararg_ptr24 = ((($vararg_buffer19)) + 12|0);
   HEAP32[$vararg_ptr24>>2] = 40296;
   (_fprintf($124,2132,$vararg_buffer19)|0);
   _exit(-1);
   // unreachable;
   break;
  }
  case 49: {
   $153 = HEAP32[1727]|0;
   $154 = ((($153)) + -1|0);
   $p = $154;
   L79: while(1) {
    $155 = HEAP32[1727]|0;
    $156 = HEAP8[$155>>0]|0;
    $157 = $156 << 24 >> 24;
    switch ($157|0) {
    case 122: case 121: case 120: case 119: case 118: case 117: case 116: case 115: case 114: case 113: case 112: case 111: case 110: case 109: case 108: case 107: case 106: case 105: case 104: case 103: case 102: case 101: case 100: case 99: case 98: case 97: case 90: case 89: case 88: case 87: case 86: case 85: case 84: case 83: case 82: case 81: case 80: case 79: case 78: case 77: case 76: case 75: case 74: case 73: case 72: case 71: case 70: case 69: case 68: case 67: case 66: case 65: case 57: case 56: case 55: case 54: case 53: case 52: case 51: case 50: case 49: case 48: case 36: case 95:  {
     break;
    }
    default: {
     break L79;
    }
    }
    $158 = HEAP32[9923]|0;
    $159 = ($158*147)|0;
    $160 = HEAP32[1727]|0;
    $161 = ((($160)) + 1|0);
    HEAP32[1727] = $161;
    $162 = HEAP8[$160>>0]|0;
    $163 = $162 << 24 >> 24;
    $164 = (($159) + ($163))|0;
    HEAP32[9923] = $164;
   }
   $165 = HEAP32[9923]|0;
   $166 = $165 & 8191;
   $167 = (6924 + ($166<<2)|0);
   $hm = $167;
   $168 = HEAP32[$167>>2]|0;
   HEAP32[9925] = $168;
   $169 = HEAP32[1727]|0;
   $170 = $p;
   $171 = $169;
   $172 = $170;
   $173 = (($171) - ($172))|0;
   $b = $173;
   $174 = HEAP32[9923]|0;
   $175 = $174 ^ $173;
   HEAP32[9923] = $175;
   while(1) {
    $176 = HEAP32[9925]|0;
    $177 = ($176|0)!=(0|0);
    if (!($177)) {
     label = 59;
     break;
    }
    $178 = HEAP32[9923]|0;
    $179 = HEAP32[9925]|0;
    $180 = ((($179)) + 24|0);
    $181 = HEAP32[$180>>2]|0;
    $182 = ($178|0)==($181|0);
    if ($182) {
     $183 = $b;
     $184 = ($183|0)<(5);
     if ($184) {
      label = 57;
      break;
     }
     $185 = HEAP32[9925]|0;
     $186 = ((($185)) + 20|0);
     $187 = HEAP32[$186>>2]|0;
     $188 = $p;
     $189 = $b;
     $190 = (_memcmp($187,$188,$189)|0);
     $191 = ($190|0)!=(0);
     if (!($191)) {
      label = 57;
      break;
     }
    }
    $195 = HEAP32[9925]|0;
    $196 = ((($195)) + 28|0);
    $197 = HEAP32[$196>>2]|0;
    HEAP32[9925] = $197;
   }
   if ((label|0) == 57) {
    $192 = HEAP32[9925]|0;
    $193 = ((($192)) + 16|0);
    $194 = HEAP32[$193>>2]|0;
    HEAP32[9923] = $194;
    STACKTOP = sp;return;
   }
   else if ((label|0) == 59) {
    $198 = HEAP32[9926]|0;
    $199 = $198;
    HEAP32[9925] = $199;
    $200 = HEAP32[9926]|0;
    $201 = (($200) + 32)|0;
    HEAP32[9926] = $201;
    $202 = $p;
    $203 = HEAP32[9925]|0;
    $204 = ((($203)) + 20|0);
    HEAP32[$204>>2] = $202;
    $205 = HEAP32[9923]|0;
    $206 = HEAP32[9925]|0;
    $207 = ((($206)) + 24|0);
    HEAP32[$207>>2] = $205;
    $208 = $hm;
    $209 = HEAP32[$208>>2]|0;
    $210 = HEAP32[9925]|0;
    $211 = ((($210)) + 28|0);
    HEAP32[$211>>2] = $209;
    $212 = HEAP32[9925]|0;
    $213 = ((($212)) + 16|0);
    HEAP32[$213>>2] = 160;
    HEAP32[9923] = 160;
    $214 = HEAP32[9925]|0;
    $215 = $hm;
    HEAP32[$215>>2] = $214;
    STACKTOP = sp;return;
   }
   break;
  }
  case 60: {
   $216 = HEAP32[1727]|0;
   $217 = HEAP8[$216>>0]|0;
   $218 = $217 << 24 >> 24;
   $219 = ($218|0)==(46);
   if ($219) {
    $220 = HEAP32[1727]|0;
    $221 = ((($220)) + 1|0);
    HEAP32[1727] = $221;
    $222 = HEAP32[9923]|0;
    $223 = (($222) - 48)|0;
    $224 = (+($223|0));
    HEAPF64[854] = $224;
    break;
   }
   $225 = HEAP32[9923]|0;
   $226 = (($225) - 48)|0;
   HEAP32[9927] = $226;
   $227 = ($226|0)!=(0);
   $228 = HEAP32[1727]|0;
   L99: do {
    if ($227) {
     $p = $228;
     while(1) {
      $229 = HEAP32[1727]|0;
      $230 = HEAP8[$229>>0]|0;
      $231 = $230 << 24 >> 24;
      $232 = ($231|0)>=(48);
      if (!($232)) {
       break;
      }
      $233 = HEAP32[1727]|0;
      $234 = HEAP8[$233>>0]|0;
      $235 = $234 << 24 >> 24;
      $236 = ($235|0)<=(57);
      if (!($236)) {
       break;
      }
      $237 = HEAP32[9927]|0;
      $238 = ($237*10)|0;
      $239 = HEAP32[1727]|0;
      $240 = ((($239)) + 1|0);
      HEAP32[1727] = $240;
      $241 = HEAP8[$239>>0]|0;
      $242 = $241 << 24 >> 24;
      $243 = (($238) + ($242))|0;
      $244 = (($243) - 48)|0;
      HEAP32[9927] = $244;
     }
     $245 = HEAP32[1727]|0;
     $246 = HEAP8[$245>>0]|0;
     $247 = $246 << 24 >> 24;
     $248 = ($247|0)==(46);
     if ($248) {
      $249 = $p;
      HEAP32[1727] = $249;
      $250 = HEAP32[9923]|0;
      $251 = (($250) - 48)|0;
      $252 = (+($251|0));
      HEAPF64[854] = $252;
      while(1) {
       $253 = HEAP32[1727]|0;
       $254 = HEAP8[$253>>0]|0;
       $255 = $254 << 24 >> 24;
       $256 = ($255|0)>=(48);
       if (!($256)) {
        break;
       }
       $257 = HEAP32[1727]|0;
       $258 = HEAP8[$257>>0]|0;
       $259 = $258 << 24 >> 24;
       $260 = ($259|0)<=(57);
       if (!($260)) {
        break;
       }
       $261 = +HEAPF64[854];
       $262 = $261 * 10.0;
       $263 = HEAP32[1727]|0;
       $264 = ((($263)) + 1|0);
       HEAP32[1727] = $264;
       $265 = HEAP8[$263>>0]|0;
       $266 = $265 << 24 >> 24;
       $267 = (($266) - 48)|0;
       $268 = (+($267|0));
       $269 = $262 + $268;
       HEAPF64[854] = $269;
      }
      $270 = HEAP32[1727]|0;
      $271 = ((($270)) + 1|0);
      HEAP32[1727] = $271;
      break L77;
     }
    } else {
     $298 = HEAP8[$228>>0]|0;
     $299 = $298 << 24 >> 24;
     $300 = ($299|0)==(120);
     if (!($300)) {
      $301 = HEAP32[1727]|0;
      $302 = HEAP8[$301>>0]|0;
      $303 = $302 << 24 >> 24;
      $304 = ($303|0)==(88);
      if (!($304)) {
       $336 = HEAP32[1727]|0;
       $337 = HEAP8[$336>>0]|0;
       $338 = $337 << 24 >> 24;
       $339 = ($338|0)==(98);
       if (!($339)) {
        $340 = HEAP32[1727]|0;
        $341 = HEAP8[$340>>0]|0;
        $342 = $341 << 24 >> 24;
        $343 = ($342|0)==(66);
        if (!($343)) {
         while(1) {
          $362 = HEAP32[1727]|0;
          $363 = HEAP8[$362>>0]|0;
          $364 = $363 << 24 >> 24;
          $365 = ($364|0)>=(48);
          if (!($365)) {
           break L99;
          }
          $366 = HEAP32[1727]|0;
          $367 = HEAP8[$366>>0]|0;
          $368 = $367 << 24 >> 24;
          $369 = ($368|0)<=(55);
          if (!($369)) {
           break L99;
          }
          $370 = HEAP32[9927]|0;
          $371 = $370<<3;
          $372 = HEAP32[1727]|0;
          $373 = ((($372)) + 1|0);
          HEAP32[1727] = $373;
          $374 = HEAP8[$372>>0]|0;
          $375 = $374 << 24 >> 24;
          $376 = (($371) + ($375))|0;
          $377 = (($376) - 48)|0;
          HEAP32[9927] = $377;
         }
        }
       }
       $344 = HEAP32[1727]|0;
       $345 = ((($344)) + 1|0);
       HEAP32[1727] = $345;
       while(1) {
        $346 = HEAP32[1727]|0;
        $347 = HEAP8[$346>>0]|0;
        $348 = $347 << 24 >> 24;
        $349 = ($348|0)==(48);
        if (!($349)) {
         $350 = HEAP32[1727]|0;
         $351 = HEAP8[$350>>0]|0;
         $352 = $351 << 24 >> 24;
         $353 = ($352|0)==(49);
         if (!($353)) {
          break L99;
         }
        }
        $354 = HEAP32[9927]|0;
        $355 = $354<<1;
        $356 = HEAP32[1727]|0;
        $357 = ((($356)) + 1|0);
        HEAP32[1727] = $357;
        $358 = HEAP8[$356>>0]|0;
        $359 = $358 << 24 >> 24;
        $360 = (($355) + ($359))|0;
        $361 = (($360) - 48)|0;
        HEAP32[9927] = $361;
       }
      }
     }
     $305 = HEAP32[1727]|0;
     $306 = ((($305)) + 1|0);
     HEAP32[1727] = $306;
     L129: while(1) {
      $307 = HEAP32[1727]|0;
      $308 = HEAP8[$307>>0]|0;
      $309 = $308 << 24 >> 24;
      switch ($309|0) {
      case 57: case 56: case 55: case 54: case 53: case 52: case 51: case 50: case 49: case 48:  {
       $310 = HEAP32[9927]|0;
       $311 = $310<<4;
       $312 = HEAP32[1727]|0;
       $313 = ((($312)) + 1|0);
       HEAP32[1727] = $313;
       $314 = HEAP8[$312>>0]|0;
       $315 = $314 << 24 >> 24;
       $316 = (($311) + ($315))|0;
       $317 = (($316) - 48)|0;
       HEAP32[9927] = $317;
       continue L129;
       break;
      }
      case 102: case 101: case 100: case 99: case 98: case 97:  {
       $318 = HEAP32[9927]|0;
       $319 = $318<<4;
       $320 = HEAP32[1727]|0;
       $321 = ((($320)) + 1|0);
       HEAP32[1727] = $321;
       $322 = HEAP8[$320>>0]|0;
       $323 = $322 << 24 >> 24;
       $324 = (($319) + ($323))|0;
       $325 = (($324) - 97)|0;
       $326 = (($325) + 10)|0;
       HEAP32[9927] = $326;
       continue L129;
       break;
      }
      case 70: case 69: case 68: case 67: case 66: case 65:  {
       $327 = HEAP32[9927]|0;
       $328 = $327<<4;
       $329 = HEAP32[1727]|0;
       $330 = ((($329)) + 1|0);
       HEAP32[1727] = $330;
       $331 = HEAP8[$329>>0]|0;
       $332 = $331 << 24 >> 24;
       $333 = (($328) + ($332))|0;
       $334 = (($333) - 65)|0;
       $335 = (($334) + 10)|0;
       HEAP32[9927] = $335;
       continue L129;
       break;
      }
      default: {
       break L99;
      }
      }
     }
    }
   } while(0);
   $378 = HEAP32[1727]|0;
   $379 = HEAP8[$378>>0]|0;
   $380 = $379 << 24 >> 24;
   $381 = ($380|0)==(117);
   if ($381) {
    label = 99;
   } else {
    $382 = HEAP32[1727]|0;
    $383 = HEAP8[$382>>0]|0;
    $384 = $383 << 24 >> 24;
    $385 = ($384|0)==(85);
    if ($385) {
     label = 99;
    } else {
     HEAP32[9928] = 3;
    }
   }
   if ((label|0) == 99) {
    $386 = HEAP32[1727]|0;
    $387 = ((($386)) + 1|0);
    HEAP32[1727] = $387;
    HEAP32[9928] = 8;
   }
   $388 = HEAP32[1727]|0;
   $389 = HEAP8[$388>>0]|0;
   $390 = $389 << 24 >> 24;
   $391 = ($390|0)==(108);
   if ($391) {
    label = 103;
   } else {
    $392 = HEAP32[1727]|0;
    $393 = HEAP8[$392>>0]|0;
    $394 = $393 << 24 >> 24;
    $395 = ($394|0)==(76);
    if ($395) {
     label = 103;
    }
   }
   if ((label|0) == 103) {
    $396 = HEAP32[1727]|0;
    $397 = ((($396)) + 1|0);
    HEAP32[1727] = $397;
   }
   HEAP32[9923] = 128;
   STACKTOP = sp;return;
   break;
  }
  case 116: {
   $442 = HEAP32[1727]|0;
   $443 = HEAP8[$442>>0]|0;
   $444 = $443 << 24 >> 24;
   $445 = ($444|0)==(61);
   if ($445) {
    $446 = HEAP32[1727]|0;
    $447 = ((($446)) + 1|0);
    HEAP32[1727] = $447;
    HEAP32[9923] = 207;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 231;
    STACKTOP = sp;return;
   }
   break;
  }
  case 119: {
   $448 = HEAP32[1720]|0;
   HEAP32[9927] = $448;
   L149: while(1) {
    $449 = HEAP32[1727]|0;
    $450 = ((($449)) + 1|0);
    HEAP32[1727] = $450;
    $451 = HEAP8[$449>>0]|0;
    $452 = $451 << 24 >> 24;
    $b = $452;
    $453 = HEAP32[9923]|0;
    $454 = ($452|0)!=($453|0);
    if (!($454)) {
     break;
    }
    $455 = $b;
    $456 = ($455|0)==(92);
    L152: do {
     if ($456) {
      $457 = HEAP32[1727]|0;
      $458 = ((($457)) + 1|0);
      HEAP32[1727] = $458;
      $459 = HEAP8[$457>>0]|0;
      $460 = $459 << 24 >> 24;
      $b = $460;
      L154: do {
       switch ($460|0) {
       case 92: case 63: case 34: case 39:  {
        break L152;
        break;
       }
       case 97:  {
        $b = 7;
        break L152;
        break;
       }
       case 98:  {
        $b = 8;
        break L152;
        break;
       }
       case 102:  {
        $b = 12;
        break L152;
        break;
       }
       case 110:  {
        $b = 10;
        break L152;
        break;
       }
       case 114:  {
        $b = 13;
        break L152;
        break;
       }
       case 116:  {
        $b = 9;
        break L152;
        break;
       }
       case 118:  {
        $b = 11;
        break L152;
        break;
       }
       case 101:  {
        $b = 27;
        break L152;
        break;
       }
       case 13:  {
        while(1) {
         $461 = HEAP32[1727]|0;
         $462 = HEAP8[$461>>0]|0;
         $463 = $462 << 24 >> 24;
         $464 = ($463|0)==(13);
         if (!($464)) {
          $465 = HEAP32[1727]|0;
          $466 = HEAP8[$465>>0]|0;
          $467 = $466 << 24 >> 24;
          $468 = ($467|0)==(10);
          if (!($468)) {
           break L154;
          }
         }
         $469 = HEAP32[1727]|0;
         $470 = ((($469)) + 1|0);
         HEAP32[1727] = $470;
        }
        break;
       }
       case 10:  {
        break;
       }
       case 120:  {
        $475 = HEAP32[1727]|0;
        $476 = HEAP8[$475>>0]|0;
        $477 = $476 << 24 >> 24;
        switch ($477|0) {
        case 57: case 56: case 55: case 54: case 53: case 52: case 51: case 50: case 49: case 48:  {
         $478 = HEAP32[1727]|0;
         $479 = ((($478)) + 1|0);
         HEAP32[1727] = $479;
         $480 = HEAP8[$478>>0]|0;
         $481 = $480 << 24 >> 24;
         $482 = (($481) - 48)|0;
         $b = $482;
         break;
        }
        case 102: case 101: case 100: case 99: case 98: case 97:  {
         $483 = HEAP32[1727]|0;
         $484 = ((($483)) + 1|0);
         HEAP32[1727] = $484;
         $485 = HEAP8[$483>>0]|0;
         $486 = $485 << 24 >> 24;
         $487 = (($486) - 97)|0;
         $488 = (($487) + 10)|0;
         $b = $488;
         break;
        }
        case 70: case 69: case 68: case 67: case 66: case 65:  {
         $489 = HEAP32[1727]|0;
         $490 = ((($489)) + 1|0);
         HEAP32[1727] = $490;
         $491 = HEAP8[$489>>0]|0;
         $492 = $491 << 24 >> 24;
         $493 = (($492) - 65)|0;
         $494 = (($493) + 10)|0;
         $b = $494;
         break;
        }
        default: {
         $b = 0;
         $495 = HEAP32[1727]|0;
         $496 = ((($495)) + 1|0);
         HEAP32[1727] = $496;
        }
        }
        $497 = HEAP32[1727]|0;
        $498 = HEAP8[$497>>0]|0;
        $499 = $498 << 24 >> 24;
        switch ($499|0) {
        case 57: case 56: case 55: case 54: case 53: case 52: case 51: case 50: case 49: case 48:  {
         $500 = $b;
         $501 = $500<<4;
         $502 = HEAP32[1727]|0;
         $503 = ((($502)) + 1|0);
         HEAP32[1727] = $503;
         $504 = HEAP8[$502>>0]|0;
         $505 = $504 << 24 >> 24;
         $506 = (($501) + ($505))|0;
         $507 = (($506) - 48)|0;
         $b = $507;
         break L152;
         break;
        }
        case 102: case 101: case 100: case 99: case 98: case 97:  {
         $508 = $b;
         $509 = $508<<4;
         $510 = HEAP32[1727]|0;
         $511 = ((($510)) + 1|0);
         HEAP32[1727] = $511;
         $512 = HEAP8[$510>>0]|0;
         $513 = $512 << 24 >> 24;
         $514 = (($509) + ($513))|0;
         $515 = (($514) - 97)|0;
         $516 = (($515) + 10)|0;
         $b = $516;
         break L152;
         break;
        }
        case 70: case 69: case 68: case 67: case 66: case 65:  {
         $517 = $b;
         $518 = $517<<4;
         $519 = HEAP32[1727]|0;
         $520 = ((($519)) + 1|0);
         HEAP32[1727] = $520;
         $521 = HEAP8[$519>>0]|0;
         $522 = $521 << 24 >> 24;
         $523 = (($518) + ($522))|0;
         $524 = (($523) - 65)|0;
         $525 = (($524) + 10)|0;
         $b = $525;
         break L152;
         break;
        }
        default: {
         break L152;
        }
        }
        break;
       }
       case 55: case 54: case 53: case 52: case 51: case 50: case 49: case 48:  {
        $526 = $b;
        $527 = (($526) - 48)|0;
        $b = $527;
        $528 = HEAP32[1727]|0;
        $529 = HEAP8[$528>>0]|0;
        $530 = $529 << 24 >> 24;
        $531 = ($530|0)>=(48);
        if (!($531)) {
         break L152;
        }
        $532 = HEAP32[1727]|0;
        $533 = HEAP8[$532>>0]|0;
        $534 = $533 << 24 >> 24;
        $535 = ($534|0)<=(55);
        if (!($535)) {
         break L152;
        }
        $536 = $b;
        $537 = $536<<3;
        $538 = HEAP32[1727]|0;
        $539 = ((($538)) + 1|0);
        HEAP32[1727] = $539;
        $540 = HEAP8[$538>>0]|0;
        $541 = $540 << 24 >> 24;
        $542 = (($537) + ($541))|0;
        $543 = (($542) - 48)|0;
        $b = $543;
        $544 = HEAP32[1727]|0;
        $545 = HEAP8[$544>>0]|0;
        $546 = $545 << 24 >> 24;
        $547 = ($546|0)>=(48);
        if (!($547)) {
         break L152;
        }
        $548 = HEAP32[1727]|0;
        $549 = HEAP8[$548>>0]|0;
        $550 = $549 << 24 >> 24;
        $551 = ($550|0)<=(55);
        if (!($551)) {
         break L152;
        }
        $552 = $b;
        $553 = $552<<3;
        $554 = HEAP32[1727]|0;
        $555 = ((($554)) + 1|0);
        HEAP32[1727] = $555;
        $556 = HEAP8[$554>>0]|0;
        $557 = $556 << 24 >> 24;
        $558 = (($553) + ($557))|0;
        $559 = (($558) - 48)|0;
        $b = $559;
        break L152;
        break;
       }
       default: {
        _err(2178);
        break L152;
       }
       }
      } while(0);
      $471 = HEAP32[1715]|0;
      $472 = (($471) + 1)|0;
      HEAP32[1715] = $472;
      $473 = HEAP32[1719]|0;
      $474 = ($473|0)!=(0);
      if (!($474)) {
       continue L149;
      }
      _dline();
      continue L149;
     } else {
      $560 = $b;
      $561 = ($560|0)!=(0);
      if (!($561)) {
       label = 152;
       break L149;
      }
     }
    } while(0);
    $562 = $b;
    $563 = $562&255;
    $564 = HEAP32[9929]|0;
    $565 = HEAP32[1720]|0;
    $566 = (($565) + 1)|0;
    HEAP32[1720] = $566;
    $567 = (($564) + ($565))|0;
    $568 = $567;
    HEAP8[$568>>0] = $563;
   }
   if ((label|0) == 152) {
    HEAP32[9923] = 0;
    _err(2198);
    STACKTOP = sp;return;
   }
   $569 = HEAP32[9923]|0;
   $570 = ($569|0)==(39);
   if (!($570)) {
    STACKTOP = sp;return;
   }
   $571 = HEAP32[1720]|0;
   $572 = HEAP32[9927]|0;
   $573 = (($571) - ($572))|0;
   $b = $573;
   $574 = HEAP32[9929]|0;
   $575 = HEAP32[9927]|0;
   HEAP32[1720] = $575;
   $576 = (($574) + ($575))|0;
   $577 = $576;
   ;HEAP8[39708>>0]=HEAP8[$577>>0]|0;HEAP8[39708+1>>0]=HEAP8[$577+1>>0]|0;HEAP8[39708+2>>0]=HEAP8[$577+2>>0]|0;HEAP8[39708+3>>0]=HEAP8[$577+3>>0]|0;
   $578 = HEAP32[9929]|0;
   $579 = HEAP32[1720]|0;
   $580 = (($578) + ($579))|0;
   $581 = $580;
   $582 = $b;
   _memset(($581|0),0,($582|0))|0;
   HEAP32[9928] = 3;
   HEAP32[9923] = 128;
   STACKTOP = sp;return;
   break;
  }
  case 156: {
   $583 = HEAP32[1727]|0;
   $584 = HEAP8[$583>>0]|0;
   $585 = $584 << 24 >> 24;
   $586 = ($585|0)==(61);
   if ($586) {
    $587 = HEAP32[1727]|0;
    $588 = ((($587)) + 1|0);
    HEAP32[1727] = $588;
    HEAP32[9923] = 220;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 203;
    STACKTOP = sp;return;
   }
   break;
  }
  case 159: {
   $589 = HEAP32[1727]|0;
   $590 = HEAP8[$589>>0]|0;
   $591 = $590 << 24 >> 24;
   $592 = ($591|0)==(43);
   $593 = HEAP32[1727]|0;
   if ($592) {
    $594 = ((($593)) + 1|0);
    HEAP32[1727] = $594;
    HEAP32[9923] = 233;
    STACKTOP = sp;return;
   }
   $595 = HEAP8[$593>>0]|0;
   $596 = $595 << 24 >> 24;
   $597 = ($596|0)==(61);
   if ($597) {
    $598 = HEAP32[1727]|0;
    $599 = ((($598)) + 1|0);
    HEAP32[1727] = $599;
    HEAP32[9923] = 204;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 228;
    STACKTOP = sp;return;
   }
   break;
  }
  case 164: {
   $600 = HEAP32[1727]|0;
   $601 = HEAP8[$600>>0]|0;
   $602 = $601 << 24 >> 24;
   $603 = ($602|0)==(45);
   $604 = HEAP32[1727]|0;
   if ($603) {
    $605 = ((($604)) + 1|0);
    HEAP32[1727] = $605;
    HEAP32[9923] = 234;
    STACKTOP = sp;return;
   }
   $606 = HEAP8[$604>>0]|0;
   $607 = $606 << 24 >> 24;
   $608 = ($607|0)==(62);
   $609 = HEAP32[1727]|0;
   if ($608) {
    $610 = ((($609)) + 1|0);
    HEAP32[1727] = $610;
    HEAP32[9923] = 236;
    STACKTOP = sp;return;
   }
   $611 = HEAP8[$609>>0]|0;
   $612 = $611 << 24 >> 24;
   $613 = ($612|0)==(61);
   if ($613) {
    $614 = HEAP32[1727]|0;
    $615 = ((($614)) + 1|0);
    HEAP32[1727] = $615;
    HEAP32[9923] = 205;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 229;
    STACKTOP = sp;return;
   }
   break;
  }
  case 171: {
   $616 = HEAP32[1727]|0;
   $617 = HEAP8[$616>>0]|0;
   $618 = $617 << 24 >> 24;
   $619 = ($618|0)==(61);
   if ($619) {
    $620 = HEAP32[1727]|0;
    $621 = ((($620)) + 1|0);
    HEAP32[1727] = $621;
    HEAP32[9923] = 206;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 230;
    STACKTOP = sp;return;
   }
   break;
  }
  case 174: {
   $622 = HEAP32[1727]|0;
   $623 = HEAP8[$622>>0]|0;
   $624 = $623 << 24 >> 24;
   $625 = ($624|0)==(61);
   $626 = HEAP32[1727]|0;
   if ($625) {
    $627 = ((($626)) + 1|0);
    HEAP32[1727] = $627;
    HEAP32[9923] = 224;
    STACKTOP = sp;return;
   }
   $628 = HEAP8[$626>>0]|0;
   $629 = $628 << 24 >> 24;
   $630 = ($629|0)==(60);
   if (!($630)) {
    HEAP32[9923] = 222;
    STACKTOP = sp;return;
   }
   $631 = HEAP32[1727]|0;
   $632 = ((($631)) + 1|0);
   HEAP32[1727] = $632;
   $633 = HEAP8[$632>>0]|0;
   $634 = $633 << 24 >> 24;
   $635 = ($634|0)==(61);
   if ($635) {
    $636 = HEAP32[1727]|0;
    $637 = ((($636)) + 1|0);
    HEAP32[1727] = $637;
    HEAP32[9923] = 212;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 226;
    STACKTOP = sp;return;
   }
   break;
  }
  case 181: {
   $638 = HEAP32[1727]|0;
   $639 = HEAP8[$638>>0]|0;
   $640 = $639 << 24 >> 24;
   $641 = ($640|0)==(61);
   $642 = HEAP32[1727]|0;
   if ($641) {
    $643 = ((($642)) + 1|0);
    HEAP32[1727] = $643;
    HEAP32[9923] = 225;
    STACKTOP = sp;return;
   }
   $644 = HEAP8[$642>>0]|0;
   $645 = $644 << 24 >> 24;
   $646 = ($645|0)==(62);
   if (!($646)) {
    HEAP32[9923] = 223;
    STACKTOP = sp;return;
   }
   $647 = HEAP32[1727]|0;
   $648 = ((($647)) + 1|0);
   HEAP32[1727] = $648;
   $649 = HEAP8[$648>>0]|0;
   $650 = $649 << 24 >> 24;
   $651 = ($650|0)==(61);
   if ($651) {
    $652 = HEAP32[1727]|0;
    $653 = ((($652)) + 1|0);
    HEAP32[1727] = $653;
    HEAP32[9923] = 213;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 227;
    STACKTOP = sp;return;
   }
   break;
  }
  case 188: {
   $654 = HEAP32[1727]|0;
   $655 = HEAP8[$654>>0]|0;
   $656 = $655 << 24 >> 24;
   $657 = ($656|0)==(124);
   $658 = HEAP32[1727]|0;
   if ($657) {
    $659 = ((($658)) + 1|0);
    HEAP32[1727] = $659;
    HEAP32[9923] = 215;
    STACKTOP = sp;return;
   }
   $660 = HEAP8[$658>>0]|0;
   $661 = $660 << 24 >> 24;
   $662 = ($661|0)==(61);
   if ($662) {
    $663 = HEAP32[1727]|0;
    $664 = ((($663)) + 1|0);
    HEAP32[1727] = $664;
    HEAP32[9923] = 210;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 217;
    STACKTOP = sp;return;
   }
   break;
  }
  case 193: {
   $665 = HEAP32[1727]|0;
   $666 = HEAP8[$665>>0]|0;
   $667 = $666 << 24 >> 24;
   $668 = ($667|0)==(38);
   $669 = HEAP32[1727]|0;
   if ($668) {
    $670 = ((($669)) + 1|0);
    HEAP32[1727] = $670;
    HEAP32[9923] = 216;
    STACKTOP = sp;return;
   }
   $671 = HEAP8[$669>>0]|0;
   $672 = $671 << 24 >> 24;
   $673 = ($672|0)==(61);
   if ($673) {
    $674 = HEAP32[1727]|0;
    $675 = ((($674)) + 1|0);
    HEAP32[1727] = $675;
    HEAP32[9923] = 209;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 219;
    STACKTOP = sp;return;
   }
   break;
  }
  case 198: {
   $676 = HEAP32[1727]|0;
   $677 = HEAP8[$676>>0]|0;
   $678 = $677 << 24 >> 24;
   $679 = ($678|0)==(61);
   if (!($679)) {
    STACKTOP = sp;return;
   }
   $680 = HEAP32[1727]|0;
   $681 = ((($680)) + 1|0);
   HEAP32[1727] = $681;
   HEAP32[9923] = 221;
   STACKTOP = sp;return;
   break;
  }
  case 200: {
   $682 = HEAP32[1727]|0;
   $683 = HEAP8[$682>>0]|0;
   $684 = $683 << 24 >> 24;
   $685 = ($684|0)==(61);
   if ($685) {
    $686 = HEAP32[1727]|0;
    $687 = ((($686)) + 1|0);
    HEAP32[1727] = $687;
    HEAP32[9923] = 208;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 232;
    STACKTOP = sp;return;
   }
   break;
  }
  case 203: {
   $688 = HEAP32[1727]|0;
   $689 = HEAP8[$688>>0]|0;
   $690 = $689 << 24 >> 24;
   $691 = ($690|0)==(61);
   if ($691) {
    $692 = HEAP32[1727]|0;
    $693 = ((($692)) + 1|0);
    HEAP32[1727] = $693;
    HEAP32[9923] = 211;
    STACKTOP = sp;return;
   } else {
    HEAP32[9923] = 218;
    STACKTOP = sp;return;
   }
   break;
  }
  case 206: {
   HEAP32[9923] = 202;
   STACKTOP = sp;return;
   break;
  }
  case 207: {
   HEAP32[9923] = 214;
   STACKTOP = sp;return;
   break;
  }
  case 208: {
   $694 = HEAP32[1727]|0;
   $695 = HEAP8[$694>>0]|0;
   $696 = $695 << 24 >> 24;
   $697 = ($696|0)==(46);
   if ($697) {
    $698 = HEAP32[1727]|0;
    $699 = ((($698)) + 1|0);
    $700 = HEAP8[$699>>0]|0;
    $701 = $700 << 24 >> 24;
    $702 = ($701|0)==(46);
    if ($702) {
     $703 = HEAP32[1727]|0;
     $704 = ((($703)) + 2|0);
     HEAP32[1727] = $704;
     HEAP32[9923] = 181;
     STACKTOP = sp;return;
    }
   }
   $705 = HEAP32[1727]|0;
   $706 = HEAP8[$705>>0]|0;
   $707 = $706 << 24 >> 24;
   $708 = ($707|0)>=(48);
   if ($708) {
    $709 = HEAP32[1727]|0;
    $710 = HEAP8[$709>>0]|0;
    $711 = $710 << 24 >> 24;
    $712 = ($711|0)<=(57);
    if ($712) {
     HEAPF64[854] = 0.0;
     break;
    }
   }
   HEAP32[9923] = 235;
   STACKTOP = sp;return;
   break;
  }
  case 215: {
   HEAP32[9923] = 238;
   STACKTOP = sp;return;
   break;
  }
  case 216: {
   HEAP32[9923] = 237;
   STACKTOP = sp;return;
   break;
  }
  case 218: {
   $715 = HEAP32[1727]|0;
   $716 = ((($715)) + -1|0);
   HEAP32[1727] = $716;
   STACKTOP = sp;return;
   break;
  }
  case 221: {
   STACKTOP = sp;return;
   break;
  }
 }
 $b = 10;
 while(1) {
  $272 = HEAP32[1727]|0;
  $273 = HEAP8[$272>>0]|0;
  $274 = $273 << 24 >> 24;
  $275 = ($274|0)>=(48);
  if ($275) {
   $276 = HEAP32[1727]|0;
   $277 = HEAP8[$276>>0]|0;
   $278 = $277 << 24 >> 24;
   $279 = ($278|0)<=(57);
   $722 = $279;
  } else {
   $722 = 0;
  }
  $280 = HEAP32[1727]|0;
  if (!($722)) {
   break;
  }
  $281 = ((($280)) + 1|0);
  HEAP32[1727] = $281;
  $282 = HEAP8[$280>>0]|0;
  $283 = $282 << 24 >> 24;
  $284 = (($283) - 48)|0;
  $285 = (+($284|0));
  $286 = $b;
  $287 = (+($286|0));
  $288 = $285 / $287;
  $289 = +HEAPF64[854];
  $290 = $289 + $288;
  HEAPF64[854] = $290;
  $291 = $b;
  $292 = ($291*10)|0;
  $b = $292;
 }
 $293 = HEAP8[$280>>0]|0;
 $294 = $293 << 24 >> 24;
 $295 = ($294|0)==(102);
 if ($295) {
  $296 = HEAP32[1727]|0;
  $297 = ((($296)) + 1|0);
  HEAP32[1727] = $297;
 }
 HEAP32[9928] = 17;
 HEAP32[9923] = 161;
 STACKTOP = sp;return;
}
function _skip($c) {
 $c = $c|0;
 var $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = $c;
 $1 = HEAP32[9923]|0;
 $2 = $0;
 $3 = ($1|0)!=($2|0);
 if (!($3)) {
  _next();
  STACKTOP = sp;return;
 }
 $4 = HEAP32[2]|0;
 $5 = HEAP32[1710]|0;
 $6 = HEAP32[1714]|0;
 $7 = HEAP32[1715]|0;
 $8 = $0;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $6;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $7;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $8;
 (_fprintf($4,2223,$vararg_buffer)|0);
 $9 = HEAP32[1723]|0;
 $10 = (($9) + 1)|0;
 HEAP32[1723] = $10;
 _next();
 STACKTOP = sp;return;
}
function _imm() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $b = 0, $c = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = HEAP32[9930]|0;
 $b = $0;
 _expr(214);
 $1 = HEAP32[9930]|0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(128);
 $4 = HEAP32[9930]|0;
 do {
  if ($3) {
   $5 = ((($4)) + 8|0);
   $6 = HEAP32[$5>>2]|0;
   $c = $6;
  } else {
   $7 = HEAP32[$4>>2]|0;
   $8 = ($7|0)==(161);
   if ($8) {
    $9 = HEAP32[9930]|0;
    $10 = ((($9)) + 8|0);
    $11 = +HEAPF64[$10>>3];
    $12 = (~~(($11)));
    $c = $12;
    break;
   } else {
    _err(2258);
    $c = 0;
    break;
   }
  }
 } while(0);
 $13 = $b;
 HEAP32[9930] = $13;
 $14 = $c;
 STACKTOP = sp;return ($14|0);
}
function _expr($lev) {
 $lev = $lev|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0;
 var $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0;
 var $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0;
 var $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0;
 var $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0;
 var $1088 = 0, $1089 = 0, $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0;
 var $1105 = 0, $1106 = 0, $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0;
 var $1123 = 0, $1124 = 0, $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0, $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0;
 var $1141 = 0, $1142 = 0, $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0.0, $1151 = 0, $1152 = 0, $1153 = 0.0, $1154 = 0.0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0;
 var $116 = 0, $1160 = 0, $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0, $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0;
 var $1178 = 0, $1179 = 0, $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0, $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0;
 var $1196 = 0, $1197 = 0, $1198 = 0, $1199 = 0, $12 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0, $1204 = 0, $1205 = 0, $1206 = 0, $1207 = 0, $1208 = 0, $1209 = 0, $121 = 0, $1210 = 0, $1211 = 0, $1212 = 0;
 var $1213 = 0, $1214 = 0, $1215 = 0, $1216 = 0, $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0, $1223 = 0, $1224 = 0, $1225 = 0, $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0;
 var $1231 = 0, $1232 = 0.0, $1233 = 0, $1234 = 0, $1235 = 0.0, $1236 = 0.0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0, $1241 = 0, $1242 = 0, $1243 = 0, $1244 = 0, $1245 = 0, $1246 = 0, $1247 = 0, $1248 = 0, $1249 = 0;
 var $125 = 0, $1250 = 0, $1251 = 0, $1252 = 0, $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0, $126 = 0, $1260 = 0, $1261 = 0, $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0;
 var $1268 = 0, $1269 = 0, $127 = 0, $1270 = 0, $1271 = 0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0.0, $1277 = 0, $1278 = 0, $1279 = 0.0, $128 = 0, $1280 = 0.0, $1281 = 0, $1282 = 0, $1283 = 0, $1284 = 0, $1285 = 0;
 var $1286 = 0, $1287 = 0, $1288 = 0, $1289 = 0, $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0, $1296 = 0, $1297 = 0, $1298 = 0, $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0;
 var $1303 = 0, $1304 = 0, $1305 = 0, $1306 = 0, $1307 = 0, $1308 = 0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0.0, $1312 = 0, $1313 = 0, $1314 = 0, $1315 = 0, $1316 = 0.0, $1317 = 0, $1318 = 0, $1319 = 0.0, $132 = 0, $1320 = 0.0;
 var $1321 = 0, $1322 = 0, $1323 = 0, $1324 = 0, $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0, $1331 = 0, $1332 = 0, $1333 = 0, $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0;
 var $134 = 0, $1340 = 0, $1341 = 0, $1342 = 0, $1343 = 0, $1344 = 0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0, $135 = 0, $1350 = 0, $1351 = 0, $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0;
 var $1358 = 0, $1359 = 0, $136 = 0.0, $1360 = 0, $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0, $1368 = 0, $1369 = 0, $137 = 0.0, $1370 = 0, $1371 = 0, $1372 = 0, $1373 = 0, $1374 = 0, $1375 = 0;
 var $1376 = 0, $1377 = 0, $1378 = 0, $1379 = 0, $138 = 0, $1380 = 0, $1381 = 0, $1382 = 0, $1383 = 0, $1384 = 0, $1385 = 0, $1386 = 0, $1387 = 0, $1388 = 0, $1389 = 0, $139 = 0, $1390 = 0, $1391 = 0, $1392 = 0, $1393 = 0;
 var $1394 = 0, $1395 = 0, $1396 = 0, $1397 = 0, $1398 = 0, $1399 = 0, $14 = 0, $140 = 0, $1400 = 0, $1401 = 0, $1402 = 0, $1403 = 0, $1404 = 0, $1405 = 0, $1406 = 0, $1407 = 0, $1408 = 0, $1409 = 0, $141 = 0, $1410 = 0;
 var $1411 = 0, $1412 = 0, $1413 = 0, $1414 = 0, $1415 = 0, $1416 = 0, $1417 = 0, $1418 = 0, $1419 = 0, $142 = 0, $1420 = 0, $1421 = 0, $1422 = 0, $1423 = 0, $1424 = 0, $1425 = 0, $1426 = 0, $1427 = 0, $1428 = 0, $1429 = 0;
 var $143 = 0, $1430 = 0, $1431 = 0, $1432 = 0, $1433 = 0, $1434 = 0, $1435 = 0, $1436 = 0, $1437 = 0, $1438 = 0, $1439 = 0, $144 = 0, $1440 = 0, $1441 = 0, $1442 = 0, $1443 = 0, $1444 = 0, $1445 = 0, $1446 = 0, $1447 = 0;
 var $1448 = 0, $1449 = 0, $145 = 0, $1450 = 0, $1451 = 0, $1452 = 0, $1453 = 0, $1454 = 0, $1455 = 0, $1456 = 0, $1457 = 0, $1458 = 0, $1459 = 0, $146 = 0, $1460 = 0, $1461 = 0, $1462 = 0, $1463 = 0, $1464 = 0, $1465 = 0;
 var $1466 = 0, $1467 = 0, $1468 = 0, $1469 = 0, $147 = 0, $1470 = 0, $1471 = 0, $1472 = 0, $1473 = 0, $1474 = 0, $1475 = 0, $1476 = 0, $1477 = 0, $1478 = 0, $1479 = 0, $148 = 0, $1480 = 0, $1481 = 0, $1482 = 0, $1483 = 0;
 var $1484 = 0, $1485 = 0, $1486 = 0, $1487 = 0, $1488 = 0, $1489 = 0, $149 = 0, $1490 = 0, $1491 = 0, $1492 = 0, $1493 = 0, $1494 = 0, $1495 = 0, $1496 = 0, $1497 = 0, $1498 = 0, $1499 = 0, $15 = 0, $150 = 0, $1500 = 0;
 var $1501 = 0, $1502 = 0, $1503 = 0, $1504 = 0, $1505 = 0, $1506 = 0, $1507 = 0, $1508 = 0, $1509 = 0, $151 = 0, $1510 = 0, $1511 = 0, $1512 = 0, $1513 = 0, $1514 = 0, $1515 = 0, $1516 = 0, $1517 = 0, $1518 = 0, $1519 = 0;
 var $152 = 0, $1520 = 0, $1521 = 0, $1522 = 0, $1523 = 0, $1524 = 0, $1525 = 0, $1526 = 0, $1527 = 0, $1528 = 0, $1529 = 0, $153 = 0, $1530 = 0, $1531 = 0, $1532 = 0, $1533 = 0, $1534 = 0, $1535 = 0, $1536 = 0, $1537 = 0;
 var $1538 = 0, $1539 = 0, $154 = 0, $1540 = 0, $1541 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0;
 var $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0;
 var $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0;
 var $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0;
 var $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0;
 var $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0;
 var $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0;
 var $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0;
 var $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0;
 var $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0;
 var $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0;
 var $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0;
 var $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0;
 var $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0;
 var $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0;
 var $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0;
 var $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0;
 var $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0;
 var $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0;
 var $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0;
 var $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0;
 var $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0;
 var $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0.0, $558 = 0, $559 = 0, $56 = 0, $560 = 0.0, $561 = 0, $562 = 0, $563 = 0, $564 = 0;
 var $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0;
 var $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0;
 var $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0;
 var $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0.0, $636 = 0;
 var $637 = 0, $638 = 0.0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0;
 var $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0;
 var $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0;
 var $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0;
 var $709 = 0.0, $71 = 0, $710 = 0, $711 = 0, $712 = 0.0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0;
 var $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0;
 var $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0;
 var $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0;
 var $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0;
 var $8 = 0, $80 = 0, $800 = 0, $801 = 0.0, $802 = 0, $803 = 0, $804 = 0.0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0;
 var $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0;
 var $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0;
 var $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0;
 var $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0;
 var $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0.0, $894 = 0, $895 = 0, $896 = 0.0, $897 = 0, $898 = 0, $899 = 0, $9 = 0.0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0;
 var $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0;
 var $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0;
 var $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0;
 var $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0;
 var $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0.0, $986 = 0, $987 = 0, $988 = 0.0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0;
 var $998 = 0, $999 = 0, $b = 0, $d = 0, $dd = 0, $m = 0, $or$cond = 0, $or$cond11 = 0, $or$cond13 = 0, $or$cond15 = 0, $or$cond17 = 0, $or$cond19 = 0, $or$cond21 = 0, $or$cond23 = 0, $or$cond25 = 0, $or$cond27 = 0, $or$cond29 = 0, $or$cond3 = 0, $or$cond31 = 0, $or$cond5 = 0;
 var $or$cond7 = 0, $or$cond9 = 0, $t = 0, $tt = 0, $vararg_buffer = 0, $vararg_buffer34 = 0, $vararg_ptr32 = 0, $vararg_ptr33 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer34 = sp + 16|0;
 $vararg_buffer = sp;
 $t = sp + 28|0;
 $0 = $lev;
 $1 = HEAP32[9923]|0;
 L1: do {
  switch ($1|0) {
  case 128:  {
   $2 = HEAP32[9930]|0;
   $3 = ((($2)) + -16|0);
   HEAP32[9930] = $3;
   HEAP32[$3>>2] = 128;
   $4 = HEAP32[9927]|0;
   $5 = HEAP32[9930]|0;
   $6 = ((($5)) + 8|0);
   HEAP32[$6>>2] = $4;
   _next();
   break;
  }
  case 161:  {
   $7 = HEAP32[9930]|0;
   $8 = ((($7)) + -16|0);
   HEAP32[9930] = $8;
   HEAP32[$8>>2] = 161;
   $9 = +HEAPF64[854];
   $10 = HEAP32[9930]|0;
   $11 = ((($10)) + 8|0);
   HEAPF64[$11>>3] = $9;
   _next();
   break;
  }
  case 34:  {
   HEAP32[9928] = 65;
   $12 = HEAP32[9930]|0;
   $13 = ((($12)) + -16|0);
   HEAP32[9930] = $13;
   HEAP32[$13>>2] = 167;
   $14 = HEAP32[9927]|0;
   $15 = HEAP32[9930]|0;
   $16 = ((($15)) + 8|0);
   HEAP32[$16>>2] = $14;
   _next();
   while(1) {
    $17 = HEAP32[9923]|0;
    $18 = ($17|0)==(34);
    if (!($18)) {
     break;
    }
    _next();
   }
   $19 = HEAP32[1720]|0;
   $20 = (($19) + 1)|0;
   HEAP32[1720] = $20;
   break;
  }
  case 160:  {
   $21 = HEAP32[9925]|0;
   $22 = HEAP32[$21>>2]|0;
   $23 = ($22|0)!=(0);
   $24 = HEAP32[9925]|0;
   if ($23) {
    $25 = HEAP32[$24>>2]|0;
    $26 = HEAP32[9925]|0;
    $27 = ((($26)) + 4|0);
    $28 = HEAP32[$27>>2]|0;
    HEAP32[9928] = $28;
    $29 = $28;
    $30 = HEAP32[9925]|0;
    $31 = HEAP32[$30>>2]|0;
    $32 = ($31|0)==(169);
    $33 = HEAP32[9925]|0;
    if ($32) {
     $37 = $33;
    } else {
     $34 = ((($33)) + 8|0);
     $35 = HEAP32[$34>>2]|0;
     $36 = $35;
     $37 = $36;
    }
    _node($25,$29,$37);
    _next();
    break L1;
   } else {
    HEAP32[$24>>2] = 169;
    $38 = HEAP32[9933]|0;
    $39 = (($38) + 1)|0;
    HEAP32[9933] = $39;
    $40 = HEAP32[9926]|0;
    $41 = HEAP32[1717]|0;
    $42 = (($40) - ($41))|0;
    $43 = $42 << 10;
    $44 = 28 | $43;
    $45 = HEAP32[9925]|0;
    $46 = ((($45)) + 4|0);
    HEAP32[$46>>2] = $44;
    HEAP32[9928] = $44;
    $47 = HEAP32[9926]|0;
    $48 = $47;
    HEAP32[$48>>2] = 3;
    $49 = HEAP32[9926]|0;
    $50 = (($49) + 8)|0;
    HEAP32[9926] = $50;
    $51 = HEAP32[9925]|0;
    _node(169,0,$51);
    _next();
    $52 = HEAP32[9923]|0;
    $53 = ($52|0)!=(238);
    if ($53) {
     _err(2903);
     break L1;
    }
    $54 = HEAP32[9934]|0;
    $55 = ($54|0)!=(0);
    if (!($55)) {
     break L1;
    }
    $56 = HEAP32[2]|0;
    $57 = HEAP32[1710]|0;
    $58 = HEAP32[1714]|0;
    $59 = HEAP32[1715]|0;
    HEAP32[$vararg_buffer>>2] = $57;
    $vararg_ptr32 = ((($vararg_buffer)) + 4|0);
    HEAP32[$vararg_ptr32>>2] = $58;
    $vararg_ptr33 = ((($vararg_buffer)) + 8|0);
    HEAP32[$vararg_ptr33>>2] = $59;
    (_fprintf($56,2920,$vararg_buffer)|0);
    break L1;
   }
   break;
  }
  case 159:  {
   _next();
   _skip(238);
   _expr(203);
   _skip(202);
   $60 = HEAP32[9930]|0;
   $b = $60;
   $61 = HEAP32[9930]|0;
   $62 = ((($61)) + -16|0);
   HEAP32[9930] = $62;
   HEAP32[$62>>2] = 128;
   $63 = HEAP32[9930]|0;
   $64 = ((($63)) + 8|0);
   HEAP32[$64>>2] = 8;
   $65 = HEAP32[9930]|0;
   $66 = ((($65)) + -8|0);
   HEAP32[9930] = $66;
   HEAP32[$66>>2] = 204;
   $67 = $b;
   $68 = $67;
   $69 = HEAP32[9930]|0;
   $70 = ((($69)) + 4|0);
   HEAP32[$70>>2] = $68;
   $71 = (_basetype()|0);
   $tt = $71;
   $72 = ($71|0)!=(0);
   if (!($72)) {
    _err(2975);
    $tt = 3;
   }
   HEAP32[$t>>2] = 0;
   $73 = $tt;
   (_type($t,0,$73)|0);
   _skip(41);
   $74 = HEAP32[$t>>2]|0;
   $75 = (($74) + 64)|0;
   HEAP32[9928] = $75;
   _ind();
   break;
  }
  case 238:  {
   _next();
   $76 = (_basetype()|0);
   $tt = $76;
   $77 = ($76|0)!=(0);
   if ($77) {
    HEAP32[$t>>2] = 0;
    $78 = $tt;
    (_type($t,0,$78)|0);
    _skip(41);
    _expr(233);
    $79 = HEAP32[$t>>2]|0;
    _cast($79);
    $80 = HEAP32[$t>>2]|0;
    HEAP32[9928] = $80;
    break L1;
   } else {
    _expr(202);
    _skip(41);
    break L1;
   }
   break;
  }
  case 230:  {
   _next();
   _expr(233);
   _ind();
   break;
  }
  case 219:  {
   _next();
   _expr(233);
   _addr();
   break;
  }
  case 33:  {
   _next();
   _expr(233);
   $81 = HEAP32[9930]|0;
   $82 = HEAP32[$81>>2]|0;
   do {
    switch ($82|0) {
    case 220:  {
     $83 = HEAP32[9930]|0;
     HEAP32[$83>>2] = 221;
     break L1;
     break;
    }
    case 221:  {
     $84 = HEAP32[9930]|0;
     HEAP32[$84>>2] = 220;
     break L1;
     break;
    }
    case 222:  {
     $85 = HEAP32[9930]|0;
     HEAP32[$85>>2] = 225;
     break L1;
     break;
    }
    case 225:  {
     $86 = HEAP32[9930]|0;
     HEAP32[$86>>2] = 222;
     break L1;
     break;
    }
    case 191:  {
     $87 = HEAP32[9930]|0;
     HEAP32[$87>>2] = 193;
     break L1;
     break;
    }
    case 193:  {
     $88 = HEAP32[9930]|0;
     HEAP32[$88>>2] = 191;
     break L1;
     break;
    }
    case 189:  {
     $89 = HEAP32[9930]|0;
     HEAP32[$89>>2] = 190;
     break L1;
     break;
    }
    case 190:  {
     $90 = HEAP32[9930]|0;
     HEAP32[$90>>2] = 189;
     break L1;
     break;
    }
    case 192:  {
     $91 = HEAP32[9930]|0;
     HEAP32[$91>>2] = 194;
     break L1;
     break;
    }
    case 194:  {
     $92 = HEAP32[9930]|0;
     HEAP32[$92>>2] = 192;
     break L1;
     break;
    }
    default: {
     $93 = HEAP32[9928]|0;
     $94 = ($93>>>0)<(16);
     do {
      if ($94) {
       label = 38;
      } else {
       $95 = HEAP32[9928]|0;
       $96 = $95 & 960;
       $97 = ($96|0)!=(0);
       if ($97) {
        label = 38;
       } else {
        $100 = HEAP32[9928]|0;
        $101 = ($100>>>0)>=(26);
        if ($101) {
         _err(2986);
         break;
        } else {
         $102 = HEAP32[9930]|0;
         $103 = ((($102)) + -8|0);
         HEAP32[9930] = $103;
         HEAP32[$103>>2] = 164;
         break;
        }
       }
      }
     } while(0);
     if ((label|0) == 38) {
      $98 = HEAP32[9930]|0;
      $99 = ((($98)) + -8|0);
      HEAP32[9930] = $99;
      HEAP32[$99>>2] = 163;
     }
     HEAP32[9928] = 3;
     break L1;
    }
    }
   } while(0);
   break;
  }
  case 126:  {
   _next();
   _expr(233);
   $104 = HEAP32[9928]|0;
   $105 = ($104>>>0)>=(16);
   if ($105) {
    _err(3003);
    break L1;
   }
   $106 = HEAP32[9930]|0;
   $107 = HEAP32[$106>>2]|0;
   $108 = ($107|0)==(128);
   $109 = HEAP32[9930]|0;
   if ($108) {
    $110 = ((($109)) + 8|0);
    $111 = HEAP32[$110>>2]|0;
    $112 = $111 ^ -1;
    $113 = HEAP32[9930]|0;
    $114 = ((($113)) + 8|0);
    HEAP32[$114>>2] = $112;
   } else {
    $115 = ((($109)) + -16|0);
    HEAP32[9930] = $115;
    HEAP32[$115>>2] = 128;
    $116 = HEAP32[9930]|0;
    $117 = ((($116)) + 8|0);
    HEAP32[$117>>2] = -1;
    $118 = HEAP32[9930]|0;
    $119 = ((($118)) + 16|0);
    $120 = HEAP32[9930]|0;
    _nodc(218,$119,$120);
   }
   $121 = HEAP32[9928]|0;
   $122 = ($121>>>0)<(8);
   $123 = $122 ? 3 : 8;
   HEAP32[9928] = $123;
   break;
  }
  case 228:  {
   _next();
   _expr(233);
   $124 = HEAP32[9928]|0;
   $125 = ($124>>>0)>=(26);
   if ($125) {
    _err(3020);
   }
   break;
  }
  case 229:  {
   _next();
   _expr(233);
   $126 = HEAP32[9928]|0;
   $127 = ($126>>>0)>=(26);
   if ($127) {
    _err(3037);
    break L1;
   }
   $128 = HEAP32[9928]|0;
   $129 = $128 & 16;
   $130 = ($129|0)!=(0);
   $131 = HEAP32[9930]|0;
   $132 = HEAP32[$131>>2]|0;
   if ($130) {
    $133 = ($132|0)==(161);
    $134 = HEAP32[9930]|0;
    if ($133) {
     $135 = ((($134)) + 8|0);
     $136 = +HEAPF64[$135>>3];
     $137 = $136 * -1.0;
     HEAPF64[$135>>3] = $137;
    } else {
     $138 = ((($134)) + -16|0);
     HEAP32[9930] = $138;
     HEAP32[$138>>2] = 161;
     $139 = HEAP32[9930]|0;
     $140 = ((($139)) + 8|0);
     HEAPF64[$140>>3] = -1.0;
     $141 = HEAP32[9930]|0;
     $142 = ((($141)) + 16|0);
     $143 = HEAP32[9930]|0;
     _nodc(198,$142,$143);
    }
    HEAP32[9928] = 17;
    break L1;
   } else {
    $144 = ($132|0)==(128);
    $145 = HEAP32[9930]|0;
    if ($144) {
     $146 = ((($145)) + 8|0);
     $147 = HEAP32[$146>>2]|0;
     $148 = Math_imul($147, -1)|0;
     HEAP32[$146>>2] = $148;
    } else {
     $149 = ((($145)) + -16|0);
     HEAP32[9930] = $149;
     HEAP32[$149>>2] = 128;
     $150 = HEAP32[9930]|0;
     $151 = ((($150)) + 8|0);
     HEAP32[$151>>2] = -1;
     $152 = HEAP32[9930]|0;
     $153 = ((($152)) + 16|0);
     $154 = HEAP32[9930]|0;
     _nodc(230,$153,$154);
    }
    $155 = HEAP32[9928]|0;
    $156 = ($155>>>0)<(8);
    $157 = $156 ? 3 : 8;
    HEAP32[9928] = $157;
    break L1;
   }
   break;
  }
  case 233:  {
   _next();
   _expr(233);
   $158 = HEAP32[9928]|0;
   $159 = $158 & 960;
   $160 = ($159|0)==(0);
   $161 = HEAP32[9928]|0;
   $162 = ($161>>>0)>=(16);
   $or$cond = $160 & $162;
   if ($or$cond) {
    _err(3054);
    break L1;
   } else {
    $163 = HEAP32[9930]|0;
    $164 = ((($163)) + -16|0);
    HEAP32[9930] = $164;
    HEAP32[$164>>2] = 128;
    $165 = HEAP32[9928]|0;
    $166 = (_tinc($165)|0);
    $167 = HEAP32[9930]|0;
    $168 = ((($167)) + 8|0);
    HEAP32[$168>>2] = $166;
    $169 = HEAP32[9930]|0;
    $170 = ((($169)) + 16|0);
    _assign(204,$170);
    break L1;
   }
   break;
  }
  case 234:  {
   _next();
   _expr(233);
   $171 = HEAP32[9928]|0;
   $172 = $171 & 960;
   $173 = ($172|0)==(0);
   $174 = HEAP32[9928]|0;
   $175 = ($174>>>0)>=(16);
   $or$cond3 = $173 & $175;
   if ($or$cond3) {
    _err(3072);
    break L1;
   } else {
    $176 = HEAP32[9930]|0;
    $177 = ((($176)) + -16|0);
    HEAP32[9930] = $177;
    HEAP32[$177>>2] = 128;
    $178 = HEAP32[9928]|0;
    $179 = (_tinc($178)|0);
    $180 = HEAP32[9930]|0;
    $181 = ((($180)) + 8|0);
    HEAP32[$181>>2] = $179;
    $182 = HEAP32[9930]|0;
    $183 = ((($182)) + 16|0);
    _assign(205,$183);
    break L1;
   }
   break;
  }
  case 148:  {
   _next();
   $184 = HEAP32[9923]|0;
   $185 = ($184|0)==(238);
   $186 = $185&1;
   HEAP32[$t>>2] = $186;
   if ($185) {
    _next();
   }
   $187 = HEAP32[$t>>2]|0;
   $188 = ($187|0)!=(0);
   if ($188) {
    $189 = (_basetype()|0);
    $tt = $189;
    $190 = ($189|0)!=(0);
    if ($190) {
     HEAP32[9928] = 0;
     $191 = $tt;
     (_type(39712,0,$191)|0);
    } else {
     label = 73;
    }
   } else {
    label = 73;
   }
   if ((label|0) == 73) {
    $192 = HEAP32[9930]|0;
    $b = $192;
    _expr(235);
    $193 = $b;
    HEAP32[9930] = $193;
   }
   $194 = HEAP32[9930]|0;
   $195 = ((($194)) + -16|0);
   HEAP32[9930] = $195;
   HEAP32[$195>>2] = 128;
   $196 = HEAP32[9928]|0;
   $197 = (_tsize($196)|0);
   $198 = HEAP32[9930]|0;
   $199 = ((($198)) + 8|0);
   HEAP32[$199>>2] = $197;
   HEAP32[9928] = 3;
   $200 = HEAP32[$t>>2]|0;
   $201 = ($200|0)!=(0);
   if ($201) {
    _skip(41);
   }
   break;
  }
  default: {
   _next();
   _err(3090);
   STACKTOP = sp;return;
  }
  }
 } while(0);
 L99: while(1) {
  $202 = HEAP32[9923]|0;
  $203 = $0;
  $204 = ($202|0)>=($203|0);
  if (!($204)) {
   label = 443;
   break;
  }
  $205 = HEAP32[9930]|0;
  $b = $205;
  $206 = HEAP32[9928]|0;
  HEAP32[$t>>2] = $206;
  $207 = HEAP32[9923]|0;
  do {
   switch ($207|0) {
   case 202:  {
    _trim();
    $208 = HEAP32[9930]|0;
    $b = $208;
    _next();
    _expr(203);
    $209 = HEAP32[9930]|0;
    $210 = ((($209)) + -8|0);
    HEAP32[9930] = $210;
    HEAP32[$210>>2] = 202;
    $211 = $b;
    $212 = $211;
    $213 = HEAP32[9930]|0;
    $214 = ((($213)) + 4|0);
    HEAP32[$214>>2] = $212;
    continue L99;
    break;
   }
   case 203:  {
    _next();
    _expr(203);
    $215 = HEAP32[$t>>2]|0;
    $216 = ($215>>>0)<(8);
    $217 = HEAP32[$t>>2]|0;
    $218 = $216 ? 3 : $217;
    _cast($218);
    $219 = HEAP32[$t>>2]|0;
    HEAP32[9928] = $219;
    $220 = $b;
    _assign(203,$220);
    continue L99;
    break;
   }
   case 204:  {
    _next();
    _expr(203);
    $221 = HEAP32[$t>>2]|0;
    $222 = $221 & 992;
    $223 = ($222|0)!=(0);
    $224 = HEAP32[9928]|0;
    $225 = ($224>>>0)<=(8);
    $or$cond5 = $223 & $225;
    $226 = HEAP32[$t>>2]|0;
    if ($or$cond5) {
     $227 = (_tinc($226)|0);
     $tt = $227;
     $228 = ($227>>>0)>(1);
     if ($228) {
      $229 = HEAP32[9930]|0;
      $230 = ((($229)) + -16|0);
      HEAP32[9930] = $230;
      HEAP32[$230>>2] = 128;
      $231 = $tt;
      $232 = HEAP32[9930]|0;
      $233 = ((($232)) + 8|0);
      HEAP32[$233>>2] = $231;
      $234 = HEAP32[9930]|0;
      $235 = ((($234)) + 16|0);
      _mul($235);
     }
     $236 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $236;
     $237 = $b;
     _assign(204,$237);
     continue L99;
    }
    $238 = HEAP32[9928]|0;
    $239 = $226 | $238;
    $tt = $239;
    $240 = ($239>>>0)>=(26);
    if ($240) {
     _err(3105);
     continue L99;
    }
    $241 = $tt;
    $242 = $241 & 16;
    $243 = ($242|0)!=(0);
    if ($243) {
     $244 = HEAP32[9930]|0;
     $245 = HEAP32[9928]|0;
     $246 = (_flot($244,$245)|0);
     HEAP32[9930] = $246;
     $247 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $247;
     $248 = $b;
     _assign(182,$248);
     continue L99;
    } else {
     $249 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $249;
     $250 = $b;
     _assign(204,$250);
     continue L99;
    }
    break;
   }
   case 205:  {
    _next();
    _expr(203);
    $251 = HEAP32[$t>>2]|0;
    $252 = $251 & 992;
    $253 = ($252|0)!=(0);
    $254 = HEAP32[9928]|0;
    $255 = ($254>>>0)<=(8);
    $or$cond7 = $253 & $255;
    $256 = HEAP32[$t>>2]|0;
    if ($or$cond7) {
     $257 = (_tinc($256)|0);
     $tt = $257;
     $258 = ($257>>>0)>(1);
     if ($258) {
      $259 = HEAP32[9930]|0;
      $260 = ((($259)) + -16|0);
      HEAP32[9930] = $260;
      HEAP32[$260>>2] = 128;
      $261 = $tt;
      $262 = HEAP32[9930]|0;
      $263 = ((($262)) + 8|0);
      HEAP32[$263>>2] = $261;
      $264 = HEAP32[9930]|0;
      $265 = ((($264)) + 16|0);
      _mul($265);
     }
     $266 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $266;
     $267 = $b;
     _assign(205,$267);
     continue L99;
    }
    $268 = HEAP32[9928]|0;
    $269 = $256 | $268;
    $tt = $269;
    $270 = ($269>>>0)>=(26);
    if ($270) {
     _err(3124);
     continue L99;
    }
    $271 = $tt;
    $272 = $271 & 16;
    $273 = ($272|0)!=(0);
    if ($273) {
     $274 = HEAP32[9930]|0;
     $275 = HEAP32[9928]|0;
     $276 = (_flot($274,$275)|0);
     HEAP32[9930] = $276;
     $277 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $277;
     $278 = $b;
     _assign(183,$278);
     continue L99;
    } else {
     $279 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $279;
     $280 = $b;
     _assign(205,$280);
     continue L99;
    }
    break;
   }
   case 206:  {
    _next();
    _expr(203);
    $281 = HEAP32[$t>>2]|0;
    $282 = HEAP32[9928]|0;
    $283 = $281 | $282;
    $tt = $283;
    $284 = ($283>>>0)>=(26);
    if ($284) {
     _err(3143);
     continue L99;
    }
    $285 = $tt;
    $286 = $285 & 16;
    $287 = ($286|0)!=(0);
    if ($287) {
     $288 = HEAP32[9930]|0;
     $289 = HEAP32[9928]|0;
     $290 = (_flot($288,$289)|0);
     HEAP32[9930] = $290;
     $291 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $291;
     $292 = $b;
     _assign(184,$292);
     continue L99;
    } else {
     $293 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $293;
     $294 = $b;
     _assign(206,$294);
     continue L99;
    }
    break;
   }
   case 207:  {
    _next();
    _expr(203);
    $295 = HEAP32[$t>>2]|0;
    $296 = HEAP32[9928]|0;
    $297 = $295 | $296;
    $tt = $297;
    $298 = ($297>>>0)>=(26);
    if ($298) {
     _err(3162);
     continue L99;
    }
    $299 = $tt;
    $300 = $299 & 16;
    $301 = ($300|0)!=(0);
    if ($301) {
     $302 = HEAP32[9930]|0;
     $303 = HEAP32[9928]|0;
     $304 = (_flot($302,$303)|0);
     HEAP32[9930] = $304;
     $305 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $305;
     $306 = $b;
     _assign(186,$306);
     continue L99;
    } else {
     $307 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $307;
     $308 = $tt;
     $309 = $308 & 8;
     $310 = ($309|0)!=(0);
     $311 = $310 ? 185 : 207;
     $312 = $b;
     _assign($311,$312);
     continue L99;
    }
    break;
   }
   case 208:  {
    _next();
    _expr(203);
    $313 = HEAP32[$t>>2]|0;
    $314 = HEAP32[9928]|0;
    $315 = $313 | $314;
    $tt = $315;
    $316 = ($315>>>0)>=(16);
    if ($316) {
     _err(3181);
     continue L99;
    } else {
     $317 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $317;
     $318 = $tt;
     $319 = $318 & 8;
     $320 = ($319|0)!=(0);
     $321 = $320 ? 187 : 208;
     $322 = $b;
     _assign($321,$322);
     continue L99;
    }
    break;
   }
   case 209:  {
    _next();
    _expr(203);
    $323 = HEAP32[$t>>2]|0;
    $324 = HEAP32[9928]|0;
    $325 = $323 | $324;
    $326 = ($325>>>0)>=(16);
    if ($326) {
     _err(3200);
     continue L99;
    } else {
     $327 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $327;
     $328 = $b;
     _assign(209,$328);
     continue L99;
    }
    break;
   }
   case 210:  {
    _next();
    _expr(203);
    $329 = HEAP32[$t>>2]|0;
    $330 = HEAP32[9928]|0;
    $331 = $329 | $330;
    $332 = ($331>>>0)>=(16);
    if ($332) {
     _err(3219);
     continue L99;
    } else {
     $333 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $333;
     $334 = $b;
     _assign(210,$334);
     continue L99;
    }
    break;
   }
   case 211:  {
    _next();
    _expr(203);
    $335 = HEAP32[$t>>2]|0;
    $336 = HEAP32[9928]|0;
    $337 = $335 | $336;
    $338 = ($337>>>0)>=(16);
    if ($338) {
     _err(3238);
     continue L99;
    } else {
     $339 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $339;
     $340 = $b;
     _assign(211,$340);
     continue L99;
    }
    break;
   }
   case 212:  {
    _next();
    _expr(203);
    $341 = HEAP32[$t>>2]|0;
    $342 = HEAP32[9928]|0;
    $343 = $341 | $342;
    $344 = ($343>>>0)>=(16);
    if ($344) {
     _err(3257);
     continue L99;
    } else {
     $345 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $345;
     $346 = $b;
     _assign(212,$346);
     continue L99;
    }
    break;
   }
   case 213:  {
    _next();
    _expr(203);
    $347 = HEAP32[$t>>2]|0;
    $348 = HEAP32[9928]|0;
    $349 = $347 | $348;
    $tt = $349;
    $350 = ($349>>>0)>=(16);
    if ($350) {
     _err(3277);
     continue L99;
    } else {
     $351 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $351;
     $352 = $tt;
     $353 = $352 & 8;
     $354 = ($353|0)!=(0);
     $355 = $354 ? 188 : 213;
     $356 = $b;
     _assign($355,$356);
     continue L99;
    }
    break;
   }
   case 214:  {
    $357 = HEAP32[9928]|0;
    $358 = ($357|0)==(17);
    $359 = HEAP32[9928]|0;
    $360 = ($359|0)==(16);
    $or$cond9 = $358 | $360;
    if ($or$cond9) {
     $361 = HEAP32[9930]|0;
     $362 = ((($361)) + -8|0);
     HEAP32[9930] = $362;
     $b = $362;
     HEAP32[$362>>2] = 165;
    }
    _next();
    _expr(202);
    $363 = HEAP32[9930]|0;
    $d = $363;
    $364 = HEAP32[9928]|0;
    HEAP32[$t>>2] = $364;
    _skip(58);
    _expr(214);
    $365 = HEAP32[9930]|0;
    $dd = $365;
    $366 = HEAP32[9928]|0;
    $367 = $366 & 992;
    $368 = ($367|0)!=(0);
    if ($368) {
     $369 = HEAP32[$t>>2]|0;
     $370 = $369 & 992;
     $371 = ($370|0)!=(0);
     $372 = HEAP32[$t>>2]|0;
     $373 = ($372>>>0)<=(8);
     $or$cond11 = $371 | $373;
     if (!($or$cond11)) {
      label = 131;
     }
    } else {
     label = 131;
    }
    do {
     if ((label|0) == 131) {
      label = 0;
      $374 = HEAP32[$t>>2]|0;
      $375 = $374 & 992;
      $376 = ($375|0)!=(0);
      $377 = HEAP32[9928]|0;
      $378 = ($377>>>0)<=(8);
      $or$cond13 = $376 & $378;
      $379 = HEAP32[$t>>2]|0;
      if ($or$cond13) {
       HEAP32[9928] = $379;
       break;
      }
      $380 = HEAP32[9928]|0;
      $381 = $379 | $380;
      $tt = $381;
      $382 = ($381>>>0)>=(26);
      if ($382) {
       _err(3297);
       break;
      }
      $383 = $tt;
      $384 = $383 & 16;
      $385 = ($384|0)!=(0);
      if ($385) {
       $386 = $dd;
       $387 = HEAP32[9928]|0;
       $388 = (_flot($386,$387)|0);
       $dd = $388;
       $389 = $d;
       $390 = HEAP32[$t>>2]|0;
       $391 = (_flot($389,$390)|0);
       $d = $391;
       HEAP32[9928] = 17;
       break;
      } else {
       $392 = $tt;
       $393 = $392 & 8;
       $394 = ($393|0)!=(0);
       $395 = $394 ? 8 : 3;
       HEAP32[9928] = $395;
       break;
      }
     }
    } while(0);
    $396 = $b;
    $397 = $d;
    _node(214,$396,$397);
    $398 = $dd;
    $399 = $398;
    $400 = HEAP32[9930]|0;
    $401 = ((($400)) + 12|0);
    HEAP32[$401>>2] = $399;
    continue L99;
    break;
   }
   case 215:  {
    $402 = HEAP32[9928]|0;
    $403 = ($402|0)==(17);
    $404 = HEAP32[9928]|0;
    $405 = ($404|0)==(16);
    $or$cond15 = $403 | $405;
    if ($or$cond15) {
     $406 = HEAP32[9930]|0;
     $407 = ((($406)) + -8|0);
     HEAP32[9930] = $407;
     $b = $407;
     HEAP32[$407>>2] = 165;
    }
    _next();
    _expr(216);
    $408 = HEAP32[9928]|0;
    $409 = ($408|0)==(17);
    $410 = HEAP32[9928]|0;
    $411 = ($410|0)==(16);
    $or$cond17 = $409 | $411;
    if ($or$cond17) {
     $412 = HEAP32[9930]|0;
     $413 = ((($412)) + -8|0);
     HEAP32[9930] = $413;
     HEAP32[$413>>2] = 165;
    }
    $414 = HEAP32[9930]|0;
    $415 = ((($414)) + -8|0);
    HEAP32[9930] = $415;
    HEAP32[$415>>2] = 215;
    $416 = $b;
    $417 = $416;
    $418 = HEAP32[9930]|0;
    $419 = ((($418)) + 4|0);
    HEAP32[$419>>2] = $417;
    HEAP32[9928] = 3;
    continue L99;
    break;
   }
   case 216:  {
    $420 = HEAP32[9928]|0;
    $421 = ($420|0)==(17);
    $422 = HEAP32[9928]|0;
    $423 = ($422|0)==(16);
    $or$cond19 = $421 | $423;
    if ($or$cond19) {
     $424 = HEAP32[9930]|0;
     $425 = ((($424)) + -8|0);
     HEAP32[9930] = $425;
     $b = $425;
     HEAP32[$425>>2] = 165;
    }
    _next();
    _expr(217);
    $426 = HEAP32[9928]|0;
    $427 = ($426|0)==(17);
    $428 = HEAP32[9928]|0;
    $429 = ($428|0)==(16);
    $or$cond21 = $427 | $429;
    if ($or$cond21) {
     $430 = HEAP32[9930]|0;
     $431 = ((($430)) + -8|0);
     HEAP32[9930] = $431;
     HEAP32[$431>>2] = 165;
    }
    $432 = HEAP32[9930]|0;
    $433 = ((($432)) + -8|0);
    HEAP32[9930] = $433;
    HEAP32[$433>>2] = 216;
    $434 = $b;
    $435 = $434;
    $436 = HEAP32[9930]|0;
    $437 = ((($436)) + 4|0);
    HEAP32[$437>>2] = $435;
    HEAP32[9928] = 3;
    continue L99;
    break;
   }
   case 217:  {
    _next();
    _expr(218);
    $438 = HEAP32[$t>>2]|0;
    $439 = HEAP32[9928]|0;
    $440 = $438 | $439;
    $tt = $440;
    $441 = ($440>>>0)>=(16);
    if ($441) {
     _err(3330);
     continue L99;
    }
    $442 = $b;
    $443 = HEAP32[$442>>2]|0;
    $444 = ($443|0)==(128);
    if ($444) {
     $445 = HEAP32[9930]|0;
     $446 = HEAP32[$445>>2]|0;
     $447 = ($446|0)==(128);
     if ($447) {
      $448 = $b;
      $449 = ((($448)) + 8|0);
      $450 = HEAP32[$449>>2]|0;
      $451 = HEAP32[9930]|0;
      $452 = ((($451)) + 8|0);
      $453 = HEAP32[$452>>2]|0;
      $454 = $453 | $450;
      HEAP32[$452>>2] = $454;
     } else {
      label = 154;
     }
    } else {
     label = 154;
    }
    if ((label|0) == 154) {
     label = 0;
     $455 = $b;
     $456 = HEAP32[9930]|0;
     _nodc(217,$455,$456);
    }
    $457 = $tt;
    $458 = $457 & 8;
    $459 = ($458|0)!=(0);
    $460 = $459 ? 8 : 3;
    HEAP32[9928] = $460;
    continue L99;
    break;
   }
   case 218:  {
    _next();
    _expr(219);
    $461 = HEAP32[$t>>2]|0;
    $462 = HEAP32[9928]|0;
    $463 = $461 | $462;
    $tt = $463;
    $464 = ($463>>>0)>=(16);
    if ($464) {
     _err(3348);
     continue L99;
    }
    $465 = $b;
    $466 = HEAP32[$465>>2]|0;
    $467 = ($466|0)==(128);
    if ($467) {
     $468 = HEAP32[9930]|0;
     $469 = HEAP32[$468>>2]|0;
     $470 = ($469|0)==(128);
     if ($470) {
      $471 = $b;
      $472 = ((($471)) + 8|0);
      $473 = HEAP32[$472>>2]|0;
      $474 = HEAP32[9930]|0;
      $475 = ((($474)) + 8|0);
      $476 = HEAP32[$475>>2]|0;
      $477 = $476 ^ $473;
      HEAP32[$475>>2] = $477;
     } else {
      label = 161;
     }
    } else {
     label = 161;
    }
    if ((label|0) == 161) {
     label = 0;
     $478 = $b;
     $479 = HEAP32[9930]|0;
     _nodc(218,$478,$479);
    }
    $480 = $tt;
    $481 = $480 & 8;
    $482 = ($481|0)!=(0);
    $483 = $482 ? 8 : 3;
    HEAP32[9928] = $483;
    continue L99;
    break;
   }
   case 219:  {
    _next();
    _expr(220);
    $484 = HEAP32[$t>>2]|0;
    $485 = HEAP32[9928]|0;
    $486 = $484 | $485;
    $tt = $486;
    $487 = ($486>>>0)>=(16);
    if ($487) {
     _err(3366);
     continue L99;
    }
    $488 = $b;
    $489 = HEAP32[$488>>2]|0;
    $490 = ($489|0)==(128);
    if ($490) {
     $491 = HEAP32[9930]|0;
     $492 = HEAP32[$491>>2]|0;
     $493 = ($492|0)==(128);
     if ($493) {
      $494 = $b;
      $495 = ((($494)) + 8|0);
      $496 = HEAP32[$495>>2]|0;
      $497 = HEAP32[9930]|0;
      $498 = ((($497)) + 8|0);
      $499 = HEAP32[$498>>2]|0;
      $500 = $499 & $496;
      HEAP32[$498>>2] = $500;
     } else {
      label = 168;
     }
    } else {
     label = 168;
    }
    if ((label|0) == 168) {
     label = 0;
     $501 = $b;
     $502 = HEAP32[9930]|0;
     _nodc(219,$501,$502);
    }
    $503 = $tt;
    $504 = $503 & 8;
    $505 = ($504|0)!=(0);
    $506 = $505 ? 8 : 3;
    HEAP32[9928] = $506;
    continue L99;
    break;
   }
   case 220:  {
    _next();
    _expr(222);
    $507 = HEAP32[$t>>2]|0;
    $508 = ($507>>>0)<(16);
    if ($508) {
     label = 172;
    } else {
     $509 = HEAP32[$t>>2]|0;
     $510 = $509 & 992;
     $511 = ($510|0)!=(0);
     if ($511) {
      label = 172;
     } else {
      label = 178;
     }
    }
    do {
     if ((label|0) == 172) {
      label = 0;
      $512 = HEAP32[9928]|0;
      $513 = ($512>>>0)<(16);
      if (!($513)) {
       $514 = HEAP32[9928]|0;
       $515 = $514 & 992;
       $516 = ($515|0)!=(0);
       if (!($516)) {
        label = 178;
        break;
       }
      }
      $517 = $b;
      $518 = HEAP32[$517>>2]|0;
      $519 = ($518|0)==(128);
      if ($519) {
       $520 = HEAP32[9930]|0;
       $521 = HEAP32[$520>>2]|0;
       $522 = ($521|0)==(128);
       if ($522) {
        $523 = $b;
        $524 = ((($523)) + 8|0);
        $525 = HEAP32[$524>>2]|0;
        $526 = HEAP32[9930]|0;
        $527 = ((($526)) + 8|0);
        $528 = HEAP32[$527>>2]|0;
        $529 = ($525|0)==($528|0);
        $530 = $529&1;
        $531 = HEAP32[9930]|0;
        $532 = ((($531)) + 8|0);
        HEAP32[$532>>2] = $530;
        break;
       }
      }
      $533 = $b;
      $534 = HEAP32[9930]|0;
      _nodc(220,$533,$534);
     }
    } while(0);
    do {
     if ((label|0) == 178) {
      label = 0;
      $535 = HEAP32[$t>>2]|0;
      $536 = HEAP32[9928]|0;
      $537 = $535 | $536;
      $tt = $537;
      $538 = ($537>>>0)>=(26);
      if ($538) {
       _err(3384);
       break;
      }
      $539 = $tt;
      $540 = $539 & 16;
      $541 = ($540|0)!=(0);
      if ($541) {
       $542 = HEAP32[9930]|0;
       $543 = HEAP32[9928]|0;
       $544 = (_flot($542,$543)|0);
       $d = $544;
       $545 = $b;
       $546 = HEAP32[$t>>2]|0;
       $547 = (_flot($545,$546)|0);
       $b = $547;
       $548 = $b;
       $549 = HEAP32[$548>>2]|0;
       $550 = ($549|0)==(161);
       if ($550) {
        $551 = $d;
        $552 = HEAP32[$551>>2]|0;
        $553 = ($552|0)==(161);
        if ($553) {
         $554 = HEAP32[9930]|0;
         HEAP32[$554>>2] = 128;
         $555 = $b;
         $556 = ((($555)) + 8|0);
         $557 = +HEAPF64[$556>>3];
         $558 = $d;
         $559 = ((($558)) + 8|0);
         $560 = +HEAPF64[$559>>3];
         $561 = $557 == $560;
         $562 = $561&1;
         $563 = HEAP32[9930]|0;
         $564 = ((($563)) + 8|0);
         HEAP32[$564>>2] = $562;
         break;
        }
       }
       $565 = $b;
       $566 = $d;
       _nodc(189,$565,$566);
       break;
      } else {
       $567 = $b;
       $568 = HEAP32[$567>>2]|0;
       $569 = ($568|0)==(128);
       if ($569) {
        $570 = HEAP32[9930]|0;
        $571 = HEAP32[$570>>2]|0;
        $572 = ($571|0)==(128);
        if ($572) {
         $573 = $b;
         $574 = ((($573)) + 8|0);
         $575 = HEAP32[$574>>2]|0;
         $576 = HEAP32[9930]|0;
         $577 = ((($576)) + 8|0);
         $578 = HEAP32[$577>>2]|0;
         $579 = ($575|0)==($578|0);
         $580 = $579&1;
         $581 = HEAP32[9930]|0;
         $582 = ((($581)) + 8|0);
         HEAP32[$582>>2] = $580;
         break;
        }
       }
       $583 = $b;
       $584 = HEAP32[9930]|0;
       _nodc(220,$583,$584);
       break;
      }
     }
    } while(0);
    HEAP32[9928] = 3;
    continue L99;
    break;
   }
   case 221:  {
    _next();
    _expr(222);
    $585 = HEAP32[$t>>2]|0;
    $586 = ($585>>>0)<(16);
    if ($586) {
     label = 192;
    } else {
     $587 = HEAP32[$t>>2]|0;
     $588 = $587 & 992;
     $589 = ($588|0)!=(0);
     if ($589) {
      label = 192;
     } else {
      label = 198;
     }
    }
    do {
     if ((label|0) == 192) {
      label = 0;
      $590 = HEAP32[9928]|0;
      $591 = ($590>>>0)<(16);
      if (!($591)) {
       $592 = HEAP32[9928]|0;
       $593 = $592 & 992;
       $594 = ($593|0)!=(0);
       if (!($594)) {
        label = 198;
        break;
       }
      }
      $595 = $b;
      $596 = HEAP32[$595>>2]|0;
      $597 = ($596|0)==(128);
      if ($597) {
       $598 = HEAP32[9930]|0;
       $599 = HEAP32[$598>>2]|0;
       $600 = ($599|0)==(128);
       if ($600) {
        $601 = $b;
        $602 = ((($601)) + 8|0);
        $603 = HEAP32[$602>>2]|0;
        $604 = HEAP32[9930]|0;
        $605 = ((($604)) + 8|0);
        $606 = HEAP32[$605>>2]|0;
        $607 = ($603|0)!=($606|0);
        $608 = $607&1;
        $609 = HEAP32[9930]|0;
        $610 = ((($609)) + 8|0);
        HEAP32[$610>>2] = $608;
        break;
       }
      }
      $611 = $b;
      $612 = HEAP32[9930]|0;
      _nodc(221,$611,$612);
     }
    } while(0);
    do {
     if ((label|0) == 198) {
      label = 0;
      $613 = HEAP32[$t>>2]|0;
      $614 = HEAP32[9928]|0;
      $615 = $613 | $614;
      $tt = $615;
      $616 = ($615>>>0)>=(26);
      if ($616) {
       _err(3403);
       break;
      }
      $617 = $tt;
      $618 = $617 & 16;
      $619 = ($618|0)!=(0);
      if ($619) {
       $620 = HEAP32[9930]|0;
       $621 = HEAP32[9928]|0;
       $622 = (_flot($620,$621)|0);
       $d = $622;
       $623 = $b;
       $624 = HEAP32[$t>>2]|0;
       $625 = (_flot($623,$624)|0);
       $b = $625;
       $626 = $b;
       $627 = HEAP32[$626>>2]|0;
       $628 = ($627|0)==(161);
       if ($628) {
        $629 = $d;
        $630 = HEAP32[$629>>2]|0;
        $631 = ($630|0)==(161);
        if ($631) {
         $632 = HEAP32[9930]|0;
         HEAP32[$632>>2] = 128;
         $633 = $b;
         $634 = ((($633)) + 8|0);
         $635 = +HEAPF64[$634>>3];
         $636 = $d;
         $637 = ((($636)) + 8|0);
         $638 = +HEAPF64[$637>>3];
         $639 = $635 != $638;
         $640 = $639&1;
         $641 = HEAP32[9930]|0;
         $642 = ((($641)) + 8|0);
         HEAP32[$642>>2] = $640;
         break;
        }
       }
       $643 = $b;
       $644 = $d;
       _nodc(190,$643,$644);
       break;
      } else {
       $645 = $b;
       $646 = HEAP32[$645>>2]|0;
       $647 = ($646|0)==(128);
       if ($647) {
        $648 = HEAP32[9930]|0;
        $649 = HEAP32[$648>>2]|0;
        $650 = ($649|0)==(128);
        if ($650) {
         $651 = $b;
         $652 = ((($651)) + 8|0);
         $653 = HEAP32[$652>>2]|0;
         $654 = HEAP32[9930]|0;
         $655 = ((($654)) + 8|0);
         $656 = HEAP32[$655>>2]|0;
         $657 = ($653|0)!=($656|0);
         $658 = $657&1;
         $659 = HEAP32[9930]|0;
         $660 = ((($659)) + 8|0);
         HEAP32[$660>>2] = $658;
         break;
        }
       }
       $661 = $b;
       $662 = HEAP32[9930]|0;
       _nodc(221,$661,$662);
       break;
      }
     }
    } while(0);
    HEAP32[9928] = 3;
    continue L99;
    break;
   }
   case 222:  {
    _next();
    _expr(226);
    $663 = HEAP32[$t>>2]|0;
    $664 = $663 & 992;
    $665 = ($664|0)!=(0);
    do {
     if ($665) {
      $666 = HEAP32[9928]|0;
      $667 = $666 & 992;
      $668 = ($667|0)!=(0);
      if ($668) {
       $669 = $b;
       $670 = HEAP32[$669>>2]|0;
       $671 = ($670|0)==(128);
       if ($671) {
        $672 = HEAP32[9930]|0;
        $673 = HEAP32[$672>>2]|0;
        $674 = ($673|0)==(128);
        if ($674) {
         $675 = $b;
         $676 = ((($675)) + 8|0);
         $677 = HEAP32[$676>>2]|0;
         $678 = HEAP32[9930]|0;
         $679 = ((($678)) + 8|0);
         $680 = HEAP32[$679>>2]|0;
         $681 = ($677>>>0)<($680>>>0);
         $682 = $681&1;
         $683 = HEAP32[9930]|0;
         $684 = ((($683)) + 8|0);
         HEAP32[$684>>2] = $682;
         break;
        }
       }
       $685 = $b;
       $686 = HEAP32[9930]|0;
       _node(191,$685,$686);
      } else {
       label = 216;
      }
     } else {
      label = 216;
     }
    } while(0);
    do {
     if ((label|0) == 216) {
      label = 0;
      $687 = HEAP32[$t>>2]|0;
      $688 = HEAP32[9928]|0;
      $689 = $687 | $688;
      $tt = $689;
      $690 = ($689>>>0)>=(26);
      if ($690) {
       _err(3422);
       break;
      }
      $691 = $tt;
      $692 = $691 & 16;
      $693 = ($692|0)!=(0);
      if ($693) {
       $694 = HEAP32[9930]|0;
       $695 = HEAP32[9928]|0;
       $696 = (_flot($694,$695)|0);
       $d = $696;
       $697 = $b;
       $698 = HEAP32[$t>>2]|0;
       $699 = (_flot($697,$698)|0);
       $b = $699;
       $700 = $b;
       $701 = HEAP32[$700>>2]|0;
       $702 = ($701|0)==(161);
       if ($702) {
        $703 = $d;
        $704 = HEAP32[$703>>2]|0;
        $705 = ($704|0)==(161);
        if ($705) {
         $706 = HEAP32[9930]|0;
         HEAP32[$706>>2] = 128;
         $707 = $b;
         $708 = ((($707)) + 8|0);
         $709 = +HEAPF64[$708>>3];
         $710 = $d;
         $711 = ((($710)) + 8|0);
         $712 = +HEAPF64[$711>>3];
         $713 = $709 < $712;
         $714 = $713&1;
         $715 = HEAP32[9930]|0;
         $716 = ((($715)) + 8|0);
         HEAP32[$716>>2] = $714;
         break;
        }
       }
       $717 = $b;
       $718 = $d;
       _node(192,$717,$718);
       break;
      }
      $719 = $tt;
      $720 = $719 & 8;
      $721 = ($720|0)!=(0);
      $722 = $b;
      $723 = HEAP32[$722>>2]|0;
      $724 = ($723|0)==(128);
      if ($721) {
       if ($724) {
        $725 = HEAP32[9930]|0;
        $726 = HEAP32[$725>>2]|0;
        $727 = ($726|0)==(128);
        if ($727) {
         $728 = $b;
         $729 = ((($728)) + 8|0);
         $730 = HEAP32[$729>>2]|0;
         $731 = HEAP32[9930]|0;
         $732 = ((($731)) + 8|0);
         $733 = HEAP32[$732>>2]|0;
         $734 = ($730>>>0)<($733>>>0);
         $735 = $734&1;
         $736 = HEAP32[9930]|0;
         $737 = ((($736)) + 8|0);
         HEAP32[$737>>2] = $735;
         break;
        }
       }
       $738 = $b;
       $739 = HEAP32[9930]|0;
       _node(191,$738,$739);
       break;
      } else {
       if ($724) {
        $740 = HEAP32[9930]|0;
        $741 = HEAP32[$740>>2]|0;
        $742 = ($741|0)==(128);
        if ($742) {
         $743 = $b;
         $744 = ((($743)) + 8|0);
         $745 = HEAP32[$744>>2]|0;
         $746 = HEAP32[9930]|0;
         $747 = ((($746)) + 8|0);
         $748 = HEAP32[$747>>2]|0;
         $749 = ($745|0)<($748|0);
         $750 = $749&1;
         $751 = HEAP32[9930]|0;
         $752 = ((($751)) + 8|0);
         HEAP32[$752>>2] = $750;
         break;
        }
       }
       $753 = $b;
       $754 = HEAP32[9930]|0;
       _node(222,$753,$754);
       break;
      }
     }
    } while(0);
    HEAP32[9928] = 3;
    continue L99;
    break;
   }
   case 223:  {
    _next();
    _expr(226);
    $755 = HEAP32[$t>>2]|0;
    $756 = $755 & 992;
    $757 = ($756|0)!=(0);
    do {
     if ($757) {
      $758 = HEAP32[9928]|0;
      $759 = $758 & 992;
      $760 = ($759|0)!=(0);
      if ($760) {
       $761 = $b;
       $762 = HEAP32[$761>>2]|0;
       $763 = ($762|0)==(128);
       if ($763) {
        $764 = HEAP32[9930]|0;
        $765 = HEAP32[$764>>2]|0;
        $766 = ($765|0)==(128);
        if ($766) {
         $767 = $b;
         $768 = ((($767)) + 8|0);
         $769 = HEAP32[$768>>2]|0;
         $770 = HEAP32[9930]|0;
         $771 = ((($770)) + 8|0);
         $772 = HEAP32[$771>>2]|0;
         $773 = ($769>>>0)>($772>>>0);
         $774 = $773&1;
         $775 = HEAP32[9930]|0;
         $776 = ((($775)) + 8|0);
         HEAP32[$776>>2] = $774;
         break;
        }
       }
       $777 = HEAP32[9930]|0;
       $778 = $b;
       _node(191,$777,$778);
      } else {
       label = 239;
      }
     } else {
      label = 239;
     }
    } while(0);
    do {
     if ((label|0) == 239) {
      label = 0;
      $779 = HEAP32[$t>>2]|0;
      $780 = HEAP32[9928]|0;
      $781 = $779 | $780;
      $tt = $781;
      $782 = ($781>>>0)>=(26);
      if ($782) {
       _err(3440);
       break;
      }
      $783 = $tt;
      $784 = $783 & 16;
      $785 = ($784|0)!=(0);
      if ($785) {
       $786 = HEAP32[9930]|0;
       $787 = HEAP32[9928]|0;
       $788 = (_flot($786,$787)|0);
       $d = $788;
       $789 = $b;
       $790 = HEAP32[$t>>2]|0;
       $791 = (_flot($789,$790)|0);
       $b = $791;
       $792 = $b;
       $793 = HEAP32[$792>>2]|0;
       $794 = ($793|0)==(161);
       if ($794) {
        $795 = $d;
        $796 = HEAP32[$795>>2]|0;
        $797 = ($796|0)==(161);
        if ($797) {
         $798 = HEAP32[9930]|0;
         HEAP32[$798>>2] = 128;
         $799 = $b;
         $800 = ((($799)) + 8|0);
         $801 = +HEAPF64[$800>>3];
         $802 = $d;
         $803 = ((($802)) + 8|0);
         $804 = +HEAPF64[$803>>3];
         $805 = $801 > $804;
         $806 = $805&1;
         $807 = HEAP32[9930]|0;
         $808 = ((($807)) + 8|0);
         HEAP32[$808>>2] = $806;
         break;
        }
       }
       $809 = $d;
       $810 = $b;
       _node(192,$809,$810);
       break;
      }
      $811 = $tt;
      $812 = $811 & 8;
      $813 = ($812|0)!=(0);
      $814 = $b;
      $815 = HEAP32[$814>>2]|0;
      $816 = ($815|0)==(128);
      if ($813) {
       if ($816) {
        $817 = HEAP32[9930]|0;
        $818 = HEAP32[$817>>2]|0;
        $819 = ($818|0)==(128);
        if ($819) {
         $820 = $b;
         $821 = ((($820)) + 8|0);
         $822 = HEAP32[$821>>2]|0;
         $823 = HEAP32[9930]|0;
         $824 = ((($823)) + 8|0);
         $825 = HEAP32[$824>>2]|0;
         $826 = ($822>>>0)>($825>>>0);
         $827 = $826&1;
         $828 = HEAP32[9930]|0;
         $829 = ((($828)) + 8|0);
         HEAP32[$829>>2] = $827;
         break;
        }
       }
       $830 = HEAP32[9930]|0;
       $831 = $b;
       _node(191,$830,$831);
       break;
      } else {
       if ($816) {
        $832 = HEAP32[9930]|0;
        $833 = HEAP32[$832>>2]|0;
        $834 = ($833|0)==(128);
        if ($834) {
         $835 = $b;
         $836 = ((($835)) + 8|0);
         $837 = HEAP32[$836>>2]|0;
         $838 = HEAP32[9930]|0;
         $839 = ((($838)) + 8|0);
         $840 = HEAP32[$839>>2]|0;
         $841 = ($837|0)>($840|0);
         $842 = $841&1;
         $843 = HEAP32[9930]|0;
         $844 = ((($843)) + 8|0);
         HEAP32[$844>>2] = $842;
         break;
        }
       }
       $845 = HEAP32[9930]|0;
       $846 = $b;
       _node(222,$845,$846);
       break;
      }
     }
    } while(0);
    HEAP32[9928] = 3;
    continue L99;
    break;
   }
   case 224:  {
    _next();
    _expr(226);
    $847 = HEAP32[$t>>2]|0;
    $848 = $847 & 992;
    $849 = ($848|0)!=(0);
    do {
     if ($849) {
      $850 = HEAP32[9928]|0;
      $851 = $850 & 992;
      $852 = ($851|0)!=(0);
      if ($852) {
       $853 = $b;
       $854 = HEAP32[$853>>2]|0;
       $855 = ($854|0)==(128);
       if ($855) {
        $856 = HEAP32[9930]|0;
        $857 = HEAP32[$856>>2]|0;
        $858 = ($857|0)==(128);
        if ($858) {
         $859 = $b;
         $860 = ((($859)) + 8|0);
         $861 = HEAP32[$860>>2]|0;
         $862 = HEAP32[9930]|0;
         $863 = ((($862)) + 8|0);
         $864 = HEAP32[$863>>2]|0;
         $865 = ($861>>>0)<=($864>>>0);
         $866 = $865&1;
         $867 = HEAP32[9930]|0;
         $868 = ((($867)) + 8|0);
         HEAP32[$868>>2] = $866;
         break;
        }
       }
       $869 = HEAP32[9930]|0;
       $870 = $b;
       _node(193,$869,$870);
      } else {
       label = 262;
      }
     } else {
      label = 262;
     }
    } while(0);
    do {
     if ((label|0) == 262) {
      label = 0;
      $871 = HEAP32[$t>>2]|0;
      $872 = HEAP32[9928]|0;
      $873 = $871 | $872;
      $tt = $873;
      $874 = ($873>>>0)>=(26);
      if ($874) {
       _err(3458);
       break;
      }
      $875 = $tt;
      $876 = $875 & 16;
      $877 = ($876|0)!=(0);
      if ($877) {
       $878 = HEAP32[9930]|0;
       $879 = HEAP32[9928]|0;
       $880 = (_flot($878,$879)|0);
       $d = $880;
       $881 = $b;
       $882 = HEAP32[$t>>2]|0;
       $883 = (_flot($881,$882)|0);
       $b = $883;
       $884 = $b;
       $885 = HEAP32[$884>>2]|0;
       $886 = ($885|0)==(161);
       if ($886) {
        $887 = $d;
        $888 = HEAP32[$887>>2]|0;
        $889 = ($888|0)==(161);
        if ($889) {
         $890 = HEAP32[9930]|0;
         HEAP32[$890>>2] = 128;
         $891 = $b;
         $892 = ((($891)) + 8|0);
         $893 = +HEAPF64[$892>>3];
         $894 = $d;
         $895 = ((($894)) + 8|0);
         $896 = +HEAPF64[$895>>3];
         $897 = $893 <= $896;
         $898 = $897&1;
         $899 = HEAP32[9930]|0;
         $900 = ((($899)) + 8|0);
         HEAP32[$900>>2] = $898;
         break;
        }
       }
       $901 = $d;
       $902 = $b;
       _node(194,$901,$902);
       break;
      }
      $903 = $tt;
      $904 = $903 & 8;
      $905 = ($904|0)!=(0);
      $906 = $b;
      $907 = HEAP32[$906>>2]|0;
      $908 = ($907|0)==(128);
      if ($905) {
       if ($908) {
        $909 = HEAP32[9930]|0;
        $910 = HEAP32[$909>>2]|0;
        $911 = ($910|0)==(128);
        if ($911) {
         $912 = $b;
         $913 = ((($912)) + 8|0);
         $914 = HEAP32[$913>>2]|0;
         $915 = HEAP32[9930]|0;
         $916 = ((($915)) + 8|0);
         $917 = HEAP32[$916>>2]|0;
         $918 = ($914>>>0)<=($917>>>0);
         $919 = $918&1;
         $920 = HEAP32[9930]|0;
         $921 = ((($920)) + 8|0);
         HEAP32[$921>>2] = $919;
         break;
        }
       }
       $922 = HEAP32[9930]|0;
       $923 = $b;
       _node(193,$922,$923);
       break;
      } else {
       if ($908) {
        $924 = HEAP32[9930]|0;
        $925 = HEAP32[$924>>2]|0;
        $926 = ($925|0)==(128);
        if ($926) {
         $927 = $b;
         $928 = ((($927)) + 8|0);
         $929 = HEAP32[$928>>2]|0;
         $930 = HEAP32[9930]|0;
         $931 = ((($930)) + 8|0);
         $932 = HEAP32[$931>>2]|0;
         $933 = ($929|0)<=($932|0);
         $934 = $933&1;
         $935 = HEAP32[9930]|0;
         $936 = ((($935)) + 8|0);
         HEAP32[$936>>2] = $934;
         break;
        }
       }
       $937 = HEAP32[9930]|0;
       $938 = $b;
       _node(225,$937,$938);
       break;
      }
     }
    } while(0);
    HEAP32[9928] = 3;
    continue L99;
    break;
   }
   case 225:  {
    _next();
    _expr(226);
    $939 = HEAP32[$t>>2]|0;
    $940 = $939 & 992;
    $941 = ($940|0)!=(0);
    do {
     if ($941) {
      $942 = HEAP32[9928]|0;
      $943 = $942 & 992;
      $944 = ($943|0)!=(0);
      if ($944) {
       $945 = $b;
       $946 = HEAP32[$945>>2]|0;
       $947 = ($946|0)==(128);
       if ($947) {
        $948 = HEAP32[9930]|0;
        $949 = HEAP32[$948>>2]|0;
        $950 = ($949|0)==(128);
        if ($950) {
         $951 = $b;
         $952 = ((($951)) + 8|0);
         $953 = HEAP32[$952>>2]|0;
         $954 = HEAP32[9930]|0;
         $955 = ((($954)) + 8|0);
         $956 = HEAP32[$955>>2]|0;
         $957 = ($953>>>0)>=($956>>>0);
         $958 = $957&1;
         $959 = HEAP32[9930]|0;
         $960 = ((($959)) + 8|0);
         HEAP32[$960>>2] = $958;
         break;
        }
       }
       $961 = $b;
       $962 = HEAP32[9930]|0;
       _node(193,$961,$962);
      } else {
       label = 285;
      }
     } else {
      label = 285;
     }
    } while(0);
    do {
     if ((label|0) == 285) {
      label = 0;
      $963 = HEAP32[$t>>2]|0;
      $964 = HEAP32[9928]|0;
      $965 = $963 | $964;
      $tt = $965;
      $966 = ($965>>>0)>=(26);
      if ($966) {
       _err(3477);
       break;
      }
      $967 = $tt;
      $968 = $967 & 16;
      $969 = ($968|0)!=(0);
      if ($969) {
       $970 = HEAP32[9930]|0;
       $971 = HEAP32[9928]|0;
       $972 = (_flot($970,$971)|0);
       $d = $972;
       $973 = $b;
       $974 = HEAP32[$t>>2]|0;
       $975 = (_flot($973,$974)|0);
       $b = $975;
       $976 = $b;
       $977 = HEAP32[$976>>2]|0;
       $978 = ($977|0)==(161);
       if ($978) {
        $979 = $d;
        $980 = HEAP32[$979>>2]|0;
        $981 = ($980|0)==(161);
        if ($981) {
         $982 = HEAP32[9930]|0;
         HEAP32[$982>>2] = 128;
         $983 = $b;
         $984 = ((($983)) + 8|0);
         $985 = +HEAPF64[$984>>3];
         $986 = $d;
         $987 = ((($986)) + 8|0);
         $988 = +HEAPF64[$987>>3];
         $989 = $985 >= $988;
         $990 = $989&1;
         $991 = HEAP32[9930]|0;
         $992 = ((($991)) + 8|0);
         HEAP32[$992>>2] = $990;
         break;
        }
       }
       $993 = $b;
       $994 = $d;
       _node(194,$993,$994);
       break;
      }
      $995 = $tt;
      $996 = $995 & 8;
      $997 = ($996|0)!=(0);
      $998 = $b;
      $999 = HEAP32[$998>>2]|0;
      $1000 = ($999|0)==(128);
      if ($997) {
       if ($1000) {
        $1001 = HEAP32[9930]|0;
        $1002 = HEAP32[$1001>>2]|0;
        $1003 = ($1002|0)==(128);
        if ($1003) {
         $1004 = $b;
         $1005 = ((($1004)) + 8|0);
         $1006 = HEAP32[$1005>>2]|0;
         $1007 = HEAP32[9930]|0;
         $1008 = ((($1007)) + 8|0);
         $1009 = HEAP32[$1008>>2]|0;
         $1010 = ($1006>>>0)>=($1009>>>0);
         $1011 = $1010&1;
         $1012 = HEAP32[9930]|0;
         $1013 = ((($1012)) + 8|0);
         HEAP32[$1013>>2] = $1011;
         break;
        }
       }
       $1014 = $b;
       $1015 = HEAP32[9930]|0;
       _node(193,$1014,$1015);
       break;
      } else {
       if ($1000) {
        $1016 = HEAP32[9930]|0;
        $1017 = HEAP32[$1016>>2]|0;
        $1018 = ($1017|0)==(128);
        if ($1018) {
         $1019 = $b;
         $1020 = ((($1019)) + 8|0);
         $1021 = HEAP32[$1020>>2]|0;
         $1022 = HEAP32[9930]|0;
         $1023 = ((($1022)) + 8|0);
         $1024 = HEAP32[$1023>>2]|0;
         $1025 = ($1021|0)>=($1024|0);
         $1026 = $1025&1;
         $1027 = HEAP32[9930]|0;
         $1028 = ((($1027)) + 8|0);
         HEAP32[$1028>>2] = $1026;
         break;
        }
       }
       $1029 = $b;
       $1030 = HEAP32[9930]|0;
       _node(225,$1029,$1030);
       break;
      }
     }
    } while(0);
    HEAP32[9928] = 3;
    continue L99;
    break;
   }
   case 226:  {
    _next();
    _expr(228);
    $1031 = HEAP32[$t>>2]|0;
    $1032 = HEAP32[9928]|0;
    $1033 = $1031 | $1032;
    $tt = $1033;
    $1034 = ($1033>>>0)>=(16);
    if ($1034) {
     _err(3496);
     continue L99;
    }
    $1035 = $b;
    $1036 = HEAP32[$1035>>2]|0;
    $1037 = ($1036|0)==(128);
    if ($1037) {
     $1038 = HEAP32[9930]|0;
     $1039 = HEAP32[$1038>>2]|0;
     $1040 = ($1039|0)==(128);
     if ($1040) {
      $1041 = $b;
      $1042 = ((($1041)) + 8|0);
      $1043 = HEAP32[$1042>>2]|0;
      $1044 = HEAP32[9930]|0;
      $1045 = ((($1044)) + 8|0);
      $1046 = HEAP32[$1045>>2]|0;
      $1047 = $1043 << $1046;
      $1048 = HEAP32[9930]|0;
      $1049 = ((($1048)) + 8|0);
      HEAP32[$1049>>2] = $1047;
     } else {
      label = 307;
     }
    } else {
     label = 307;
    }
    if ((label|0) == 307) {
     label = 0;
     $1050 = $b;
     $1051 = HEAP32[9930]|0;
     _node(226,$1050,$1051);
    }
    $1052 = $tt;
    $1053 = $1052 & 8;
    $1054 = ($1053|0)!=(0);
    $1055 = $1054 ? 8 : 3;
    HEAP32[9928] = $1055;
    continue L99;
    break;
   }
   case 227:  {
    _next();
    _expr(228);
    $1056 = HEAP32[$t>>2]|0;
    $1057 = HEAP32[9928]|0;
    $1058 = $1056 | $1057;
    $tt = $1058;
    $1059 = ($1058>>>0)>=(16);
    if ($1059) {
     _err(3515);
     continue L99;
    }
    $1060 = $tt;
    $1061 = $1060 & 8;
    $1062 = ($1061|0)!=(0);
    $1063 = $b;
    $1064 = HEAP32[$1063>>2]|0;
    $1065 = ($1064|0)==(128);
    if ($1062) {
     if ($1065) {
      $1066 = HEAP32[9930]|0;
      $1067 = HEAP32[$1066>>2]|0;
      $1068 = ($1067|0)==(128);
      if ($1068) {
       $1069 = $b;
       $1070 = ((($1069)) + 8|0);
       $1071 = HEAP32[$1070>>2]|0;
       $1072 = HEAP32[9930]|0;
       $1073 = ((($1072)) + 8|0);
       $1074 = HEAP32[$1073>>2]|0;
       $1075 = $1071 >>> $1074;
       $1076 = HEAP32[9930]|0;
       $1077 = ((($1076)) + 8|0);
       HEAP32[$1077>>2] = $1075;
      } else {
       label = 315;
      }
     } else {
      label = 315;
     }
     if ((label|0) == 315) {
      label = 0;
      $1078 = $b;
      $1079 = HEAP32[9930]|0;
      _node(195,$1078,$1079);
     }
     HEAP32[9928] = 8;
     continue L99;
    } else {
     if ($1065) {
      $1080 = HEAP32[9930]|0;
      $1081 = HEAP32[$1080>>2]|0;
      $1082 = ($1081|0)==(128);
      if ($1082) {
       $1083 = $b;
       $1084 = ((($1083)) + 8|0);
       $1085 = HEAP32[$1084>>2]|0;
       $1086 = HEAP32[9930]|0;
       $1087 = ((($1086)) + 8|0);
       $1088 = HEAP32[$1087>>2]|0;
       $1089 = $1085 >> $1088;
       $1090 = HEAP32[9930]|0;
       $1091 = ((($1090)) + 8|0);
       HEAP32[$1091>>2] = $1089;
      } else {
       label = 320;
      }
     } else {
      label = 320;
     }
     if ((label|0) == 320) {
      label = 0;
      $1092 = $b;
      $1093 = HEAP32[9930]|0;
      _node(227,$1092,$1093);
     }
     HEAP32[9928] = 3;
     continue L99;
    }
    break;
   }
   case 228:  {
    _next();
    _expr(230);
    $1094 = HEAP32[$t>>2]|0;
    $1095 = $1094 & 992;
    $1096 = ($1095|0)!=(0);
    $1097 = HEAP32[9928]|0;
    $1098 = ($1097>>>0)<=(8);
    $or$cond23 = $1096 & $1098;
    if ($or$cond23) {
     $1099 = HEAP32[$t>>2]|0;
     $1100 = (_tinc($1099)|0);
     $tt = $1100;
     $1101 = ($1100>>>0)>(1);
     if ($1101) {
      $1102 = HEAP32[9930]|0;
      $1103 = ((($1102)) + -16|0);
      HEAP32[9930] = $1103;
      HEAP32[$1103>>2] = 128;
      $1104 = $tt;
      $1105 = HEAP32[9930]|0;
      $1106 = ((($1105)) + 8|0);
      HEAP32[$1106>>2] = $1104;
      $1107 = HEAP32[9930]|0;
      $1108 = ((($1107)) + 16|0);
      _mul($1108);
     }
     $1109 = $b;
     _add($1109);
     $1110 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $1110;
     continue L99;
    }
    $1111 = HEAP32[9928]|0;
    $1112 = $1111 & 992;
    $1113 = ($1112|0)!=(0);
    $1114 = HEAP32[$t>>2]|0;
    $1115 = ($1114>>>0)<=(8);
    $or$cond25 = $1113 & $1115;
    if ($or$cond25) {
     $1116 = HEAP32[9928]|0;
     $1117 = (_tinc($1116)|0);
     $tt = $1117;
     $1118 = ($1117>>>0)>(1);
     if ($1118) {
      $1119 = HEAP32[9930]|0;
      $d = $1119;
      $1120 = HEAP32[9930]|0;
      $1121 = ((($1120)) + -16|0);
      HEAP32[9930] = $1121;
      HEAP32[$1121>>2] = 128;
      $1122 = $tt;
      $1123 = HEAP32[9930]|0;
      $1124 = ((($1123)) + 8|0);
      HEAP32[$1124>>2] = $1122;
      $1125 = $b;
      _mul($1125);
      $1126 = $d;
      _add($1126);
      continue L99;
     } else {
      $1127 = $b;
      _add($1127);
      continue L99;
     }
    }
    $1128 = HEAP32[$t>>2]|0;
    $1129 = HEAP32[9928]|0;
    $1130 = $1128 | $1129;
    $tt = $1130;
    $1131 = ($1130>>>0)>=(26);
    if ($1131) {
     _err(3534);
     continue L99;
    }
    $1132 = $tt;
    $1133 = $1132 & 16;
    $1134 = ($1133|0)!=(0);
    if (!($1134)) {
     $1159 = $b;
     _add($1159);
     $1160 = $tt;
     $1161 = $1160 & 8;
     $1162 = ($1161|0)!=(0);
     $1163 = $1162 ? 8 : 3;
     HEAP32[9928] = $1163;
     continue L99;
    }
    $1135 = HEAP32[9930]|0;
    $1136 = HEAP32[9928]|0;
    $1137 = (_flot($1135,$1136)|0);
    $d = $1137;
    $1138 = $b;
    $1139 = HEAP32[$t>>2]|0;
    $1140 = (_flot($1138,$1139)|0);
    $b = $1140;
    $1141 = $b;
    $1142 = HEAP32[$1141>>2]|0;
    $1143 = ($1142|0)==(161);
    if ($1143) {
     $1144 = $d;
     $1145 = HEAP32[$1144>>2]|0;
     $1146 = ($1145|0)==(161);
     if ($1146) {
      $1147 = HEAP32[9930]|0;
      HEAP32[$1147>>2] = 161;
      $1148 = $b;
      $1149 = ((($1148)) + 8|0);
      $1150 = +HEAPF64[$1149>>3];
      $1151 = $d;
      $1152 = ((($1151)) + 8|0);
      $1153 = +HEAPF64[$1152>>3];
      $1154 = $1150 + $1153;
      $1155 = HEAP32[9930]|0;
      $1156 = ((($1155)) + 8|0);
      HEAPF64[$1156>>3] = $1154;
     } else {
      label = 336;
     }
    } else {
     label = 336;
    }
    if ((label|0) == 336) {
     label = 0;
     $1157 = $b;
     $1158 = $d;
     _nodc(196,$1157,$1158);
    }
    HEAP32[9928] = 17;
    continue L99;
    break;
   }
   case 229:  {
    _next();
    _expr(230);
    $1164 = HEAP32[$t>>2]|0;
    $1165 = $1164 & 992;
    $1166 = ($1165|0)!=(0);
    if ($1166) {
     $1167 = HEAP32[9928]|0;
     $1168 = $1167 & 992;
     $1169 = ($1168|0)!=(0);
     if ($1169) {
      $1170 = HEAP32[$t>>2]|0;
      $1171 = (_tinc($1170)|0);
      $tt = $1171;
      $1172 = HEAP32[9928]|0;
      $1173 = (_tinc($1172)|0);
      $1174 = ($1171|0)==($1173|0);
      if ($1174) {
       $1175 = $b;
       $1176 = HEAP32[9930]|0;
       _node(229,$1175,$1176);
       $1177 = HEAP32[9930]|0;
       $d = $1177;
       $1178 = HEAP32[9930]|0;
       $1179 = ((($1178)) + -16|0);
       HEAP32[9930] = $1179;
       HEAP32[$1179>>2] = 128;
       $1180 = $tt;
       $1181 = HEAP32[9930]|0;
       $1182 = ((($1181)) + 8|0);
       HEAP32[$1182>>2] = $1180;
       $1183 = $d;
       $1184 = HEAP32[9930]|0;
       _node(231,$1183,$1184);
       HEAP32[9928] = 3;
       continue L99;
      }
     }
    }
    $1185 = HEAP32[$t>>2]|0;
    $1186 = $1185 & 992;
    $1187 = ($1186|0)!=(0);
    $1188 = HEAP32[9928]|0;
    $1189 = ($1188>>>0)<=(8);
    $or$cond27 = $1187 & $1189;
    $1190 = HEAP32[$t>>2]|0;
    if ($or$cond27) {
     $1191 = (_tinc($1190)|0);
     $tt = $1191;
     $1192 = ($1191>>>0)>(1);
     if ($1192) {
      $1193 = HEAP32[9930]|0;
      $1194 = ((($1193)) + -16|0);
      HEAP32[9930] = $1194;
      HEAP32[$1194>>2] = 128;
      $1195 = $tt;
      $1196 = HEAP32[9930]|0;
      $1197 = ((($1196)) + 8|0);
      HEAP32[$1197>>2] = $1195;
      $1198 = HEAP32[9930]|0;
      $1199 = ((($1198)) + 16|0);
      _mul($1199);
     }
     $1200 = HEAP32[9930]|0;
     $1201 = HEAP32[$1200>>2]|0;
     $1202 = ($1201|0)==(128);
     if ($1202) {
      $1203 = HEAP32[9930]|0;
      $1204 = ((($1203)) + 8|0);
      $1205 = HEAP32[$1204>>2]|0;
      $1206 = Math_imul($1205, -1)|0;
      HEAP32[$1204>>2] = $1206;
      $1207 = $b;
      _add($1207);
     } else {
      $1208 = $b;
      $1209 = HEAP32[9930]|0;
      _node(229,$1208,$1209);
     }
     $1210 = HEAP32[$t>>2]|0;
     HEAP32[9928] = $1210;
     continue L99;
    }
    $1211 = HEAP32[9928]|0;
    $1212 = $1190 | $1211;
    $tt = $1212;
    $1213 = ($1212>>>0)>=(26);
    if ($1213) {
     _err(3552);
     continue L99;
    }
    $1214 = $tt;
    $1215 = $1214 & 16;
    $1216 = ($1215|0)!=(0);
    $1217 = HEAP32[9930]|0;
    if (!($1216)) {
     $1241 = HEAP32[$1217>>2]|0;
     $1242 = ($1241|0)==(128);
     if ($1242) {
      $1243 = HEAP32[9930]|0;
      $1244 = ((($1243)) + 8|0);
      $1245 = HEAP32[$1244>>2]|0;
      $1246 = Math_imul($1245, -1)|0;
      HEAP32[$1244>>2] = $1246;
      $1247 = $b;
      _add($1247);
     } else {
      $1248 = $b;
      $1249 = HEAP32[9930]|0;
      _node(229,$1248,$1249);
     }
     $1250 = $tt;
     $1251 = $1250 & 8;
     $1252 = ($1251|0)!=(0);
     $1253 = $1252 ? 8 : 3;
     HEAP32[9928] = $1253;
     continue L99;
    }
    $1218 = HEAP32[9928]|0;
    $1219 = (_flot($1217,$1218)|0);
    $d = $1219;
    $1220 = $b;
    $1221 = HEAP32[$t>>2]|0;
    $1222 = (_flot($1220,$1221)|0);
    $b = $1222;
    $1223 = $b;
    $1224 = HEAP32[$1223>>2]|0;
    $1225 = ($1224|0)==(161);
    if ($1225) {
     $1226 = $d;
     $1227 = HEAP32[$1226>>2]|0;
     $1228 = ($1227|0)==(161);
     if ($1228) {
      $1229 = HEAP32[9930]|0;
      HEAP32[$1229>>2] = 161;
      $1230 = $b;
      $1231 = ((($1230)) + 8|0);
      $1232 = +HEAPF64[$1231>>3];
      $1233 = $d;
      $1234 = ((($1233)) + 8|0);
      $1235 = +HEAPF64[$1234>>3];
      $1236 = $1232 - $1235;
      $1237 = HEAP32[9930]|0;
      $1238 = ((($1237)) + 8|0);
      HEAPF64[$1238>>3] = $1236;
     } else {
      label = 356;
     }
    } else {
     label = 356;
    }
    if ((label|0) == 356) {
     label = 0;
     $1239 = $b;
     $1240 = $d;
     _node(197,$1239,$1240);
    }
    HEAP32[9928] = 17;
    continue L99;
    break;
   }
   case 230:  {
    _next();
    _expr(233);
    $1254 = HEAP32[$t>>2]|0;
    $1255 = HEAP32[9928]|0;
    $1256 = $1254 | $1255;
    $tt = $1256;
    $1257 = ($1256>>>0)>=(26);
    if ($1257) {
     _err(3570);
     continue L99;
    }
    $1258 = $tt;
    $1259 = $1258 & 16;
    $1260 = ($1259|0)!=(0);
    if (!($1260)) {
     $1285 = $b;
     _mul($1285);
     $1286 = $tt;
     $1287 = $1286 & 8;
     $1288 = ($1287|0)!=(0);
     $1289 = $1288 ? 8 : 3;
     HEAP32[9928] = $1289;
     continue L99;
    }
    $1261 = HEAP32[9930]|0;
    $1262 = HEAP32[9928]|0;
    $1263 = (_flot($1261,$1262)|0);
    $d = $1263;
    $1264 = $b;
    $1265 = HEAP32[$t>>2]|0;
    $1266 = (_flot($1264,$1265)|0);
    $b = $1266;
    $1267 = $b;
    $1268 = HEAP32[$1267>>2]|0;
    $1269 = ($1268|0)==(161);
    if ($1269) {
     $1270 = $d;
     $1271 = HEAP32[$1270>>2]|0;
     $1272 = ($1271|0)==(161);
     if ($1272) {
      $1273 = HEAP32[9930]|0;
      HEAP32[$1273>>2] = 161;
      $1274 = $b;
      $1275 = ((($1274)) + 8|0);
      $1276 = +HEAPF64[$1275>>3];
      $1277 = $d;
      $1278 = ((($1277)) + 8|0);
      $1279 = +HEAPF64[$1278>>3];
      $1280 = $1276 * $1279;
      $1281 = HEAP32[9930]|0;
      $1282 = ((($1281)) + 8|0);
      HEAPF64[$1282>>3] = $1280;
     } else {
      label = 368;
     }
    } else {
     label = 368;
    }
    if ((label|0) == 368) {
     label = 0;
     $1283 = $b;
     $1284 = $d;
     _nodc(198,$1283,$1284);
    }
    HEAP32[9928] = 17;
    continue L99;
    break;
   }
   case 231:  {
    _next();
    _expr(233);
    $1290 = HEAP32[$t>>2]|0;
    $1291 = HEAP32[9928]|0;
    $1292 = $1290 | $1291;
    $tt = $1292;
    $1293 = ($1292>>>0)>=(26);
    if ($1293) {
     _err(3588);
     continue L99;
    }
    $1294 = $tt;
    $1295 = $1294 & 16;
    $1296 = ($1295|0)!=(0);
    if ($1296) {
     $1297 = HEAP32[9930]|0;
     $1298 = HEAP32[9928]|0;
     $1299 = (_flot($1297,$1298)|0);
     $d = $1299;
     $1300 = $b;
     $1301 = HEAP32[$t>>2]|0;
     $1302 = (_flot($1300,$1301)|0);
     $b = $1302;
     $1303 = $b;
     $1304 = HEAP32[$1303>>2]|0;
     $1305 = ($1304|0)==(161);
     if ($1305) {
      $1306 = $d;
      $1307 = HEAP32[$1306>>2]|0;
      $1308 = ($1307|0)==(161);
      if ($1308) {
       $1309 = $d;
       $1310 = ((($1309)) + 8|0);
       $1311 = +HEAPF64[$1310>>3];
       $1312 = $1311 != 0.0;
       if ($1312) {
        $1313 = HEAP32[9930]|0;
        HEAP32[$1313>>2] = 161;
        $1314 = $b;
        $1315 = ((($1314)) + 8|0);
        $1316 = +HEAPF64[$1315>>3];
        $1317 = $d;
        $1318 = ((($1317)) + 8|0);
        $1319 = +HEAPF64[$1318>>3];
        $1320 = $1316 / $1319;
        $1321 = HEAP32[9930]|0;
        $1322 = ((($1321)) + 8|0);
        HEAPF64[$1322>>3] = $1320;
       } else {
        label = 378;
       }
      } else {
       label = 378;
      }
     } else {
      label = 378;
     }
     if ((label|0) == 378) {
      label = 0;
      $1323 = $b;
      $1324 = $d;
      _node(200,$1323,$1324);
     }
     HEAP32[9928] = 17;
     continue L99;
    }
    $1325 = $tt;
    $1326 = $1325 & 8;
    $1327 = ($1326|0)!=(0);
    $1328 = $b;
    $1329 = HEAP32[$1328>>2]|0;
    $1330 = ($1329|0)==(128);
    if ($1327) {
     if ($1330) {
      $1331 = HEAP32[9930]|0;
      $1332 = HEAP32[$1331>>2]|0;
      $1333 = ($1332|0)==(128);
      if ($1333) {
       $1334 = HEAP32[9930]|0;
       $1335 = ((($1334)) + 8|0);
       $1336 = HEAP32[$1335>>2]|0;
       $1337 = ($1336|0)!=(0);
       if ($1337) {
        $1338 = $b;
        $1339 = ((($1338)) + 8|0);
        $1340 = HEAP32[$1339>>2]|0;
        $1341 = HEAP32[9930]|0;
        $1342 = ((($1341)) + 8|0);
        $1343 = HEAP32[$1342>>2]|0;
        $1344 = (($1340>>>0) / ($1343>>>0))&-1;
        $1345 = HEAP32[9930]|0;
        $1346 = ((($1345)) + 8|0);
        HEAP32[$1346>>2] = $1344;
       } else {
        label = 385;
       }
      } else {
       label = 385;
      }
     } else {
      label = 385;
     }
     if ((label|0) == 385) {
      label = 0;
      $1347 = $b;
      $1348 = HEAP32[9930]|0;
      _node(199,$1347,$1348);
     }
     HEAP32[9928] = 8;
     continue L99;
    } else {
     if ($1330) {
      $1349 = HEAP32[9930]|0;
      $1350 = HEAP32[$1349>>2]|0;
      $1351 = ($1350|0)==(128);
      if ($1351) {
       $1352 = HEAP32[9930]|0;
       $1353 = ((($1352)) + 8|0);
       $1354 = HEAP32[$1353>>2]|0;
       $1355 = ($1354|0)!=(0);
       if ($1355) {
        $1356 = $b;
        $1357 = ((($1356)) + 8|0);
        $1358 = HEAP32[$1357>>2]|0;
        $1359 = HEAP32[9930]|0;
        $1360 = ((($1359)) + 8|0);
        $1361 = HEAP32[$1360>>2]|0;
        $1362 = (($1358|0) / ($1361|0))&-1;
        $1363 = HEAP32[9930]|0;
        $1364 = ((($1363)) + 8|0);
        HEAP32[$1364>>2] = $1362;
       } else {
        label = 391;
       }
      } else {
       label = 391;
      }
     } else {
      label = 391;
     }
     if ((label|0) == 391) {
      label = 0;
      $1365 = $b;
      $1366 = HEAP32[9930]|0;
      _node(231,$1365,$1366);
     }
     HEAP32[9928] = 3;
     continue L99;
    }
    break;
   }
   case 232:  {
    _next();
    _expr(233);
    $1367 = HEAP32[$t>>2]|0;
    $1368 = HEAP32[9928]|0;
    $1369 = $1367 | $1368;
    $tt = $1369;
    $1370 = ($1369>>>0)>=(16);
    if ($1370) {
     _err(3606);
     continue L99;
    }
    $1371 = $tt;
    $1372 = $1371 & 8;
    $1373 = ($1372|0)!=(0);
    $1374 = $b;
    $1375 = HEAP32[$1374>>2]|0;
    $1376 = ($1375|0)==(128);
    if ($1373) {
     if ($1376) {
      $1377 = HEAP32[9930]|0;
      $1378 = HEAP32[$1377>>2]|0;
      $1379 = ($1378|0)==(128);
      if ($1379) {
       $1380 = HEAP32[9930]|0;
       $1381 = ((($1380)) + 8|0);
       $1382 = HEAP32[$1381>>2]|0;
       $1383 = ($1382|0)!=(0);
       if ($1383) {
        $1384 = $b;
        $1385 = ((($1384)) + 8|0);
        $1386 = HEAP32[$1385>>2]|0;
        $1387 = HEAP32[9930]|0;
        $1388 = ((($1387)) + 8|0);
        $1389 = HEAP32[$1388>>2]|0;
        $1390 = (($1386>>>0) % ($1389>>>0))&-1;
        $1391 = HEAP32[9930]|0;
        $1392 = ((($1391)) + 8|0);
        HEAP32[$1392>>2] = $1390;
       } else {
        label = 400;
       }
      } else {
       label = 400;
      }
     } else {
      label = 400;
     }
     if ((label|0) == 400) {
      label = 0;
      $1393 = $b;
      $1394 = HEAP32[9930]|0;
      _node(201,$1393,$1394);
     }
     HEAP32[9928] = 8;
     continue L99;
    } else {
     if ($1376) {
      $1395 = HEAP32[9930]|0;
      $1396 = HEAP32[$1395>>2]|0;
      $1397 = ($1396|0)==(128);
      if ($1397) {
       $1398 = HEAP32[9930]|0;
       $1399 = ((($1398)) + 8|0);
       $1400 = HEAP32[$1399>>2]|0;
       $1401 = ($1400|0)!=(0);
       if ($1401) {
        $1402 = $b;
        $1403 = ((($1402)) + 8|0);
        $1404 = HEAP32[$1403>>2]|0;
        $1405 = HEAP32[9930]|0;
        $1406 = ((($1405)) + 8|0);
        $1407 = HEAP32[$1406>>2]|0;
        $1408 = (($1404|0) % ($1407|0))&-1;
        $1409 = HEAP32[9930]|0;
        $1410 = ((($1409)) + 8|0);
        HEAP32[$1410>>2] = $1408;
       } else {
        label = 406;
       }
      } else {
       label = 406;
      }
     } else {
      label = 406;
     }
     if ((label|0) == 406) {
      label = 0;
      $1411 = $b;
      $1412 = HEAP32[9930]|0;
      _node(232,$1411,$1412);
     }
     HEAP32[9928] = 3;
     continue L99;
    }
    break;
   }
   case 233:  {
    _next();
    $1413 = HEAP32[9928]|0;
    $1414 = $1413 & 960;
    $1415 = ($1414|0)==(0);
    $1416 = HEAP32[9928]|0;
    $1417 = ($1416>>>0)>=(16);
    $or$cond29 = $1415 & $1417;
    if ($or$cond29) {
     _err(3054);
     continue L99;
    } else {
     $1418 = HEAP32[9930]|0;
     $1419 = ((($1418)) + -16|0);
     HEAP32[9930] = $1419;
     HEAP32[$1419>>2] = 128;
     $1420 = HEAP32[9928]|0;
     $1421 = (_tinc($1420)|0);
     $1422 = (0 - ($1421))|0;
     $1423 = HEAP32[9930]|0;
     $1424 = ((($1423)) + 8|0);
     HEAP32[$1424>>2] = $1422;
     $1425 = HEAP32[9930]|0;
     $1426 = ((($1425)) + -8|0);
     HEAP32[9930] = $1426;
     HEAP32[$1426>>2] = 205;
     $1427 = $b;
     $1428 = $1427;
     $1429 = HEAP32[9930]|0;
     $1430 = ((($1429)) + 4|0);
     HEAP32[$1430>>2] = $1428;
     $1431 = HEAP32[9930]|0;
     $1432 = ((($1431)) + 8|0);
     _add($1432);
     continue L99;
    }
    break;
   }
   case 234:  {
    _next();
    $1433 = HEAP32[9928]|0;
    $1434 = $1433 & 960;
    $1435 = ($1434|0)==(0);
    $1436 = HEAP32[9928]|0;
    $1437 = ($1436>>>0)>=(16);
    $or$cond31 = $1435 & $1437;
    if ($or$cond31) {
     _err(3072);
     continue L99;
    } else {
     $1438 = HEAP32[9930]|0;
     $1439 = ((($1438)) + -16|0);
     HEAP32[9930] = $1439;
     HEAP32[$1439>>2] = 128;
     $1440 = HEAP32[9928]|0;
     $1441 = (_tinc($1440)|0);
     $1442 = HEAP32[9930]|0;
     $1443 = ((($1442)) + 8|0);
     HEAP32[$1443>>2] = $1441;
     $1444 = HEAP32[9930]|0;
     $1445 = ((($1444)) + -8|0);
     HEAP32[9930] = $1445;
     HEAP32[$1445>>2] = 205;
     $1446 = $b;
     $1447 = $1446;
     $1448 = HEAP32[9930]|0;
     $1449 = ((($1448)) + 4|0);
     HEAP32[$1449>>2] = $1447;
     $1450 = HEAP32[9930]|0;
     $1451 = ((($1450)) + 8|0);
     _add($1451);
     continue L99;
    }
    break;
   }
   case 235:  {
    _addr();
    break;
   }
   case 236:  {
    break;
   }
   case 237:  {
    _next();
    _expr(202);
    _skip(93);
    $1491 = HEAP32[9930]|0;
    $d = $1491;
    $1492 = HEAP32[9930]|0;
    $1493 = ((($1492)) + -16|0);
    HEAP32[9930] = $1493;
    HEAP32[$1493>>2] = 128;
    $1494 = HEAP32[$t>>2]|0;
    $1495 = (_tinc($1494)|0);
    $1496 = HEAP32[9930]|0;
    $1497 = ((($1496)) + 8|0);
    HEAP32[$1497>>2] = $1495;
    $1498 = $d;
    _mul($1498);
    $1499 = $b;
    _add($1499);
    $1500 = HEAP32[$t>>2]|0;
    HEAP32[9928] = $1500;
    _ind();
    continue L99;
    break;
   }
   case 238:  {
    $1501 = HEAP32[9928]|0;
    $1502 = $1501 & 1023;
    $1503 = ($1502|0)!=(28);
    if ($1503) {
     $1504 = HEAP32[9928]|0;
     $1505 = $1504 & 1023;
     $1506 = ($1505|0)!=(92);
     if ($1506) {
      _err(3720);
     } else {
      label = 432;
     }
    } else {
     label = 432;
    }
    if ((label|0) == 432) {
     label = 0;
     $1507 = HEAP32[1717]|0;
     $1508 = HEAP32[9928]|0;
     $1509 = $1508 >>> 10;
     $1510 = (($1507) + ($1509))|0;
     $1511 = $1510;
     $1512 = HEAP32[$1511>>2]|0;
     HEAP32[$t>>2] = $1512;
     $1513 = HEAP32[1717]|0;
     $1514 = HEAP32[9928]|0;
     $1515 = $1514 >>> 10;
     $1516 = (($1513) + ($1515))|0;
     $1517 = (($1516) + 4)|0;
     $1518 = $1517;
     $1519 = HEAP32[$1518>>2]|0;
     $tt = $1519;
    }
    _next();
    $1520 = HEAP32[9930]|0;
    $d = $1520;
    $b = 0;
    while(1) {
     $1521 = HEAP32[9923]|0;
     $1522 = ($1521|0)!=(41);
     if (!($1522)) {
      break;
     }
     _expr(203);
     $1523 = $tt;
     $1524 = $1523 & 3;
     switch ($1524|0) {
     case 1:  {
      _cast(17);
      HEAP32[9928] = 17;
      break;
     }
     case 2:  {
      _cast(3);
      HEAP32[9928] = 3;
      break;
     }
     case 3:  {
      _cast(8);
      HEAP32[9928] = 8;
      break;
     }
     default: {
     }
     }
     $1525 = $tt;
     $1526 = $1525 >>> 2;
     $tt = $1526;
     $1527 = $b;
     $1528 = $1527;
     $1529 = HEAP32[9930]|0;
     $1530 = ((($1529)) + -8|0);
     HEAP32[9930] = $1530;
     HEAP32[$1530>>2] = $1528;
     $1531 = HEAP32[9928]|0;
     $1532 = HEAP32[9930]|0;
     $1533 = ((($1532)) + 4|0);
     HEAP32[$1533>>2] = $1531;
     $1534 = HEAP32[9930]|0;
     $b = $1534;
     $1535 = HEAP32[9923]|0;
     $1536 = ($1535|0)==(202);
     if (!($1536)) {
      continue;
     }
     _next();
    }
    _skip(41);
    $1537 = $d;
    $1538 = $b;
    _node(170,$1537,$1538);
    $1539 = HEAP32[$t>>2]|0;
    HEAP32[9928] = $1539;
    continue L99;
    break;
   }
   default: {
    label = 442;
    break L99;
   }
   }
  } while(0);
  $1452 = HEAP32[9928]|0;
  $1453 = $1452 & 1023;
  $1454 = ($1453|0)!=(90);
  if ($1454) {
   _err(3624);
  }
  _next();
  $1455 = HEAP32[9923]|0;
  $1456 = ($1455|0)!=(160);
  if ($1456) {
   _err(3652);
   continue;
  }
  $1457 = HEAP32[1717]|0;
  $1458 = HEAP32[9928]|0;
  $1459 = $1458 >>> 10;
  $1460 = (($1457) + ($1459))|0;
  $1461 = $1460;
  $1462 = ((($1461)) + 12|0);
  $1463 = HEAP32[$1462>>2]|0;
  $m = $1463;
  while(1) {
   $1464 = $m;
   $1465 = ($1464|0)!=(0|0);
   if (!($1465)) {
    label = 423;
    break;
   }
   $1466 = $m;
   $1467 = ((($1466)) + 8|0);
   $1468 = HEAP32[$1467>>2]|0;
   $1469 = HEAP32[9925]|0;
   $1470 = ($1468|0)==($1469|0);
   if ($1470) {
    break;
   }
   $1471 = $m;
   $1472 = ((($1471)) + 12|0);
   $1473 = HEAP32[$1472>>2]|0;
   $m = $1473;
  }
  if ((label|0) == 423) {
   label = 0;
   _err(3687);
   _next();
   continue;
  }
  $1474 = HEAP32[9930]|0;
  $1475 = ((($1474)) + -16|0);
  HEAP32[9930] = $1475;
  HEAP32[$1475>>2] = 128;
  $1476 = $m;
  $1477 = HEAP32[$1476>>2]|0;
  $1478 = HEAP32[9930]|0;
  $1479 = ((($1478)) + 8|0);
  HEAP32[$1479>>2] = $1477;
  $1480 = HEAP32[9930]|0;
  $1481 = ((($1480)) + 16|0);
  _add($1481);
  $1482 = $m;
  $1483 = ((($1482)) + 4|0);
  $1484 = HEAP32[$1483>>2]|0;
  $1485 = $1484 & 1023;
  $1486 = ($1485|0)==(32);
  $1487 = $m;
  $1488 = ((($1487)) + 4|0);
  $1489 = HEAP32[$1488>>2]|0;
  if ($1486) {
   HEAP32[9928] = $1489;
  } else {
   $1490 = (($1489) + 64)|0;
   HEAP32[9928] = $1490;
   _ind();
  }
  _next();
 }
 if ((label|0) == 442) {
  $1540 = HEAP32[2]|0;
  $1541 = HEAP32[9923]|0;
  HEAP32[$vararg_buffer34>>2] = $1541;
  (_fprintf($1540,3743,$vararg_buffer34)|0);
  _exit(-1);
  // unreachable;
 }
 else if ((label|0) == 443) {
  STACKTOP = sp;return;
 }
}
function _immf() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0, $b = 0, $c = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = HEAP32[9930]|0;
 $b = $0;
 _expr(214);
 $1 = HEAP32[9930]|0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(128);
 $4 = HEAP32[9930]|0;
 do {
  if ($3) {
   $5 = ((($4)) + 8|0);
   $6 = HEAP32[$5>>2]|0;
   $7 = (+($6|0));
   $c = $7;
  } else {
   $8 = HEAP32[$4>>2]|0;
   $9 = ($8|0)==(161);
   if ($9) {
    $10 = HEAP32[9930]|0;
    $11 = ((($10)) + 8|0);
    $12 = +HEAPF64[$11>>3];
    $c = $12;
    break;
   } else {
    _err(2282);
    $c = 0.0;
    break;
   }
  }
 } while(0);
 $13 = $b;
 HEAP32[9930] = $13;
 $14 = $c;
 STACKTOP = sp;return (+$14);
}
function _tinc($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $t;
 $2 = $1;
 $3 = $2 & 960;
 $4 = ($3|0)!=(0);
 $5 = $1;
 do {
  if ($4) {
   $6 = (($5) - 64)|0;
   $7 = (_tsize($6)|0);
   $0 = $7;
  } else {
   $8 = $5 & 32;
   $9 = ($8|0)!=(0);
   if ($9) {
    $10 = HEAP32[1717]|0;
    $11 = $1;
    $12 = $11 >>> 10;
    $13 = (($10) + ($12))|0;
    $14 = $13;
    $15 = HEAP32[$14>>2]|0;
    $16 = (_tsize($15)|0);
    $0 = $16;
    break;
   } else {
    $0 = 1;
    break;
   }
  }
 } while(0);
 $17 = $0;
 STACKTOP = sp;return ($17|0);
}
function _talign($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $a = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $t;
 $2 = $1;
 $3 = $2 & 1023;
 L1: do {
  switch ($3|0) {
  case 32:  {
   $4 = HEAP32[1717]|0;
   $5 = $1;
   $6 = $5 >>> 10;
   $7 = (($4) + ($6))|0;
   $8 = $7;
   $9 = HEAP32[$8>>2]|0;
   $10 = (_talign($9)|0);
   $0 = $10;
   break;
  }
  case 26:  {
   $11 = HEAP32[1717]|0;
   $12 = $1;
   $13 = $12 >>> 10;
   $14 = (($11) + ($13))|0;
   $15 = $14;
   $16 = ((($15)) + 8|0);
   $17 = HEAP32[$16>>2]|0;
   $a = $17;
   $18 = ($17|0)!=(0);
   if ($18) {
    $19 = $a;
    $0 = $19;
    break L1;
   } else {
    _err(2352);
    label = 6;
    break L1;
   }
   break;
  }
  case 4: case 1:  {
   label = 6;
   break;
  }
  case 5: case 2:  {
   $0 = 2;
   break;
  }
  case 17:  {
   $0 = 8;
   break;
  }
  default: {
   $0 = 4;
  }
  }
 } while(0);
 if ((label|0) == 6) {
  $0 = 1;
 }
 $20 = $0;
 STACKTOP = sp;return ($20|0);
}
function _basetype() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $m = 0, $n = 0;
 var $s = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = HEAP32[9923]|0;
 L1: do {
  switch ($1|0) {
  case 155:  {
   _next();
   $0 = 27;
   break;
  }
  case 157:  {
   _next();
   $0 = 65;
   break;
  }
  case 154:  {
   _next();
   $2 = HEAP32[9923]|0;
   $3 = ($2|0)==(133);
   if ($3) {
    _next();
    $0 = 4;
    break L1;
   }
   $4 = HEAP32[9923]|0;
   $5 = ($4|0)==(147);
   if ($5) {
    _next();
    $6 = HEAP32[9923]|0;
    $7 = ($6|0)==(144);
    if ($7) {
     _next();
    }
    $0 = 5;
    break L1;
   }
   $8 = HEAP32[9923]|0;
   $9 = ($8|0)==(145);
   if ($9) {
    _next();
   }
   $10 = HEAP32[9923]|0;
   $11 = ($10|0)==(144);
   if ($11) {
    _next();
   }
   $0 = 8;
   break;
  }
  case 133:  {
   _next();
   $0 = 1;
   break;
  }
  case 147:  {
   _next();
   $12 = HEAP32[9923]|0;
   $13 = ($12|0)==(144);
   if ($13) {
    _next();
   }
   $0 = 2;
   break;
  }
  case 145:  {
   _next();
   $14 = HEAP32[9923]|0;
   $15 = ($14|0)==(144);
   if ($15) {
    _next();
   }
   $0 = 3;
   break;
  }
  case 144:  {
   _next();
   $0 = 3;
   break;
  }
  case 140:  {
   _next();
   $0 = 16;
   break;
  }
  case 137:  {
   _next();
   $0 = 17;
   break;
  }
  case 150: case 153:  {
   $16 = HEAP32[9923]|0;
   $m = $16;
   _next();
   $17 = HEAP32[9923]|0;
   $18 = ($17|0)==(160);
   if ($18) {
    $19 = HEAP32[1716]|0;
    $s = $19;
    while(1) {
     $20 = $s;
     $21 = ($20|0)!=(0|0);
     if (!($21)) {
      label = 30;
      break;
     }
     $22 = $s;
     $23 = HEAP32[$22>>2]|0;
     $24 = HEAP32[9925]|0;
     $25 = ($23|0)==($24|0);
     if ($25) {
      break;
     }
     $26 = $s;
     $27 = ((($26)) + 16|0);
     $28 = HEAP32[$27>>2]|0;
     $s = $28;
    }
    if ((label|0) == 30) {
     $29 = HEAP32[9926]|0;
     $30 = $29;
     $s = $30;
     $31 = HEAP32[9926]|0;
     $32 = (($31) + 24)|0;
     HEAP32[9926] = $32;
     $33 = HEAP32[9925]|0;
     $34 = $s;
     HEAP32[$34>>2] = $33;
     $35 = HEAP32[1716]|0;
     $36 = $s;
     $37 = ((($36)) + 16|0);
     HEAP32[$37>>2] = $35;
     $38 = $s;
     HEAP32[1716] = $38;
    }
    _next();
    $39 = HEAP32[9923]|0;
    $40 = ($39|0)!=(123);
    $41 = $s;
    if ($40) {
     $42 = $41;
     $43 = HEAP32[1717]|0;
     $44 = (($42) - ($43))|0;
     $45 = $44 << 10;
     $46 = 26 | $45;
     $0 = $46;
     break L1;
    }
    $47 = ((($41)) + 8|0);
    $48 = HEAP32[$47>>2]|0;
    $49 = ($48|0)!=(0);
    if ($49) {
     _err(2397);
    }
    _next();
   } else {
    _skip(123);
    $50 = HEAP32[9926]|0;
    $51 = $50;
    $s = $51;
    $52 = HEAP32[9926]|0;
    $53 = (($52) + 24)|0;
    HEAP32[9926] = $53;
    $54 = HEAP32[1716]|0;
    $55 = $s;
    $56 = ((($55)) + 16|0);
    HEAP32[$56>>2] = $54;
    $57 = $s;
    HEAP32[1716] = $57;
   }
   $58 = $m;
   $59 = $s;
   _member($58,$59);
   _skip(125);
   $60 = $s;
   $61 = $60;
   $62 = HEAP32[1717]|0;
   $63 = (($61) - ($62))|0;
   $64 = $63 << 10;
   $65 = 26 | $64;
   $0 = $65;
   break;
  }
  case 139:  {
   _next();
   $66 = HEAP32[9923]|0;
   $67 = ($66|0)!=(123);
   if ($67) {
    _next();
   }
   $68 = HEAP32[9923]|0;
   $69 = ($68|0)==(123);
   if ($69) {
    _next();
    $m = 0;
    while(1) {
     $70 = HEAP32[9923]|0;
     $71 = ($70|0)!=(0);
     $72 = HEAP32[9923]|0;
     $73 = ($72|0)!=(125);
     $74 = $71 ? $73 : 0;
     if (!($74)) {
      break;
     }
     $75 = HEAP32[9923]|0;
     $76 = ($75|0)!=(160);
     if ($76) {
      label = 44;
      break;
     }
     $77 = HEAP32[9925]|0;
     $n = $77;
     _next();
     $78 = HEAP32[9923]|0;
     $79 = ($78|0)==(203);
     if ($79) {
      _next();
      $80 = (_imm()|0);
      $m = $80;
     }
     $81 = $n;
     HEAP32[$81>>2] = 128;
     $82 = $n;
     $83 = ((($82)) + 4|0);
     HEAP32[$83>>2] = 3;
     $84 = $m;
     $85 = (($84) + 1)|0;
     $m = $85;
     $86 = $n;
     $87 = ((($86)) + 8|0);
     HEAP32[$87>>2] = $84;
     $88 = HEAP32[9923]|0;
     $89 = ($88|0)!=(202);
     if ($89) {
      break;
     }
     _next();
    }
    if ((label|0) == 44) {
     _err(2426);
    }
    _skip(125);
   }
   $0 = 3;
   break;
  }
  case 160:  {
   $90 = HEAP32[9925]|0;
   $91 = HEAP32[$90>>2]|0;
   $92 = ($91|0)==(152);
   if ($92) {
    $93 = HEAP32[9925]|0;
    $94 = ((($93)) + 4|0);
    $95 = HEAP32[$94>>2]|0;
    $m = $95;
    _next();
    $96 = $m;
    $0 = $96;
   } else {
    label = 53;
   }
   break;
  }
  default: {
   label = 53;
  }
  }
 } while(0);
 if ((label|0) == 53) {
  $0 = 0;
 }
 $97 = $0;
 STACKTOP = sp;return ($97|0);
}
function _member($stype,$s) {
 $stype = $stype|0;
 $s = $s|0;
 var $$ = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $8 = 0, $9 = 0, $align = 0, $bt = 0;
 var $m = 0, $mp = 0, $salign = 0, $size = 0, $ssize = 0, $t = 0, $v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $t = sp + 12|0;
 $v = sp + 8|0;
 $0 = $stype;
 $1 = $s;
 $ssize = 0;
 $salign = 1;
 while(1) {
  $2 = HEAP32[9923]|0;
  $3 = ($2|0)!=(0);
  $4 = HEAP32[9923]|0;
  $5 = ($4|0)!=(125);
  $6 = $3 ? $5 : 0;
  if (!($6)) {
   label = 22;
   break;
  }
  $7 = (_basetype()|0);
  $bt = $7;
  $8 = ($7|0)!=(0);
  $$ = $8 ? $7 : 3;
  $bt = $$;
  $9 = HEAP32[9923]|0;
  $10 = ($9|0)!=(0);
  if (!($10)) {
   label = 22;
   break;
  }
  $11 = HEAP32[9923]|0;
  $12 = ($11|0)==(59);
  if ($12) {
   _next();
   continue;
  }
  while(1) {
   HEAP32[$v>>2] = 0;
   HEAP32[$t>>2] = 0;
   $13 = $bt;
   (_type($t,$v,$13)|0);
   $14 = HEAP32[$v>>2]|0;
   $15 = ($14|0)!=(0|0);
   if ($15) {
    $16 = $1;
    $17 = ((($16)) + 12|0);
    $mp = $17;
    while(1) {
     $18 = $mp;
     $19 = HEAP32[$18>>2]|0;
     $m = $19;
     $20 = ($19|0)!=(0|0);
     if (!($20)) {
      break;
     }
     $21 = $m;
     $22 = ((($21)) + 8|0);
     $23 = HEAP32[$22>>2]|0;
     $24 = HEAP32[$v>>2]|0;
     $25 = ($23|0)==($24|0);
     if ($25) {
      _err(2830);
     }
     $26 = $m;
     $27 = ((($26)) + 12|0);
     $mp = $27;
    }
    $28 = HEAP32[9926]|0;
    $29 = $28;
    $m = $29;
    $30 = $mp;
    HEAP32[$30>>2] = $29;
    $31 = HEAP32[9926]|0;
    $32 = (($31) + 16)|0;
    HEAP32[9926] = $32;
    $33 = HEAP32[$v>>2]|0;
    $34 = $m;
    $35 = ((($34)) + 8|0);
    HEAP32[$35>>2] = $33;
    $36 = HEAP32[$t>>2]|0;
    $37 = $m;
    $38 = ((($37)) + 4|0);
    HEAP32[$38>>2] = $36;
    $39 = HEAP32[$t>>2]|0;
    $40 = (_tsize($39)|0);
    $size = $40;
    $41 = HEAP32[$t>>2]|0;
    $42 = (_talign($41)|0);
    $align = $42;
    $43 = $0;
    $44 = ($43|0)==(150);
    if ($44) {
     $45 = $ssize;
     $46 = $align;
     $47 = (($45) + ($46))|0;
     $48 = (($47) - 1)|0;
     $49 = $align;
     $50 = (0 - ($49))|0;
     $51 = $48 & $50;
     $52 = $m;
     HEAP32[$52>>2] = $51;
     $53 = $size;
     $54 = (($51) + ($53))|0;
     $ssize = $54;
    } else {
     $55 = $size;
     $56 = $ssize;
     $57 = ($55|0)>($56|0);
     if ($57) {
      $58 = $size;
      $ssize = $58;
     }
    }
    $59 = $align;
    $60 = $salign;
    $61 = ($59|0)>($60|0);
    if ($61) {
     $62 = $align;
     $salign = $62;
    }
   } else {
    _err(2807);
   }
   $63 = HEAP32[9923]|0;
   $64 = ($63|0)!=(202);
   if ($64) {
    break;
   }
   _next();
  }
  _skip(59);
 }
 if ((label|0) == 22) {
  $65 = $salign;
  $66 = $1;
  $67 = ((($66)) + 8|0);
  HEAP32[$67>>2] = $65;
  $68 = $ssize;
  $69 = $salign;
  $70 = (($68) + ($69))|0;
  $71 = (($70) - 1)|0;
  $72 = $salign;
  $73 = (0 - ($72))|0;
  $74 = $71 & $73;
  $75 = $1;
  $76 = ((($75)) + 4|0);
  HEAP32[$76>>2] = $74;
  STACKTOP = sp;return;
 }
}
function _type($t,$v,$bt) {
 $t = $t|0;
 $v = $v|0;
 $bt = $bt|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $a = 0, $ap = 0, $d = 0, $n = 0, $or$cond = 0, $p = 0, $pt = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $d = sp + 8|0;
 $n = sp + 4|0;
 $1 = $t;
 $2 = $v;
 $3 = $bt;
 while(1) {
  $4 = HEAP32[9923]|0;
  $5 = ($4|0)==(230);
  if (!($5)) {
   break;
  }
  _next();
  $6 = $3;
  $7 = (($6) + 64)|0;
  $3 = $7;
 }
 $8 = HEAP32[9923]|0;
 $9 = ($8|0)==(238);
 do {
  if ($9) {
   _next();
   $10 = HEAP32[9923]|0;
   $11 = ($10|0)==(41);
   if (!($11)) {
    $29 = $1;
    $30 = $2;
    $31 = (_type($29,$30,0)|0);
    $1 = $31;
    _skip(41);
    break;
   }
   $12 = $2;
   $13 = ($12|0)!=(0|0);
   if ($13) {
    _err(2446);
   }
   _next();
   $14 = HEAP32[9926]|0;
   $15 = HEAP32[1717]|0;
   $16 = (($14) - ($15))|0;
   $17 = $16 << 10;
   $18 = 28 | $17;
   $19 = $1;
   $20 = HEAP32[$19>>2]|0;
   $21 = $20 | $18;
   HEAP32[$19>>2] = $21;
   $22 = HEAP32[9926]|0;
   $23 = $22;
   $1 = $23;
   $24 = HEAP32[9926]|0;
   $25 = (($24) + 8)|0;
   HEAP32[9926] = $25;
   $26 = $3;
   $27 = $1;
   HEAP32[$27>>2] = $26;
   $28 = $1;
   $0 = $28;
   $180 = $0;
   STACKTOP = sp;return ($180|0);
  } else {
   $32 = HEAP32[9923]|0;
   $33 = ($32|0)==(160);
   if ($33) {
    $34 = $2;
    $35 = ($34|0)!=(0|0);
    if ($35) {
     $36 = HEAP32[9925]|0;
     $37 = $2;
     HEAP32[$37>>2] = $36;
    } else {
     _err(2473);
    }
    _next();
   }
  }
 } while(0);
 $38 = HEAP32[9923]|0;
 $39 = ($38|0)==(238);
 L21: do {
  if ($39) {
   _next();
   $p = 0;
   $pt = 0;
   L23: while(1) {
    $40 = HEAP32[9923]|0;
    $41 = ($40|0)!=(41);
    if (!($41)) {
     break;
    }
    HEAP32[$n>>2] = 0;
    $42 = (_basetype()|0);
    $a = $42;
    $43 = ($42|0)!=(0);
    $44 = HEAP32[9923]|0;
    do {
     if ($43) {
      $45 = ($44|0)==(41);
      $46 = $a;
      $47 = ($46|0)==(27);
      $or$cond = $45 & $47;
      if ($or$cond) {
       break L23;
      }
      HEAP32[$d>>2] = 0;
      $48 = $a;
      (_type($d,$n,$48)|0);
      $49 = HEAP32[$d>>2]|0;
      $50 = ($49|0)==(16);
      if ($50) {
       HEAP32[$d>>2] = 17;
       label = 25;
      } else {
       label = 25;
      }
     } else {
      $51 = ($44|0)==(160);
      if ($51) {
       HEAP32[$d>>2] = 3;
       $52 = HEAP32[9925]|0;
       HEAP32[$n>>2] = $52;
       _next();
       label = 25;
       break;
      } else {
       _err(2491);
       _next();
       break;
      }
     }
    } while(0);
    if ((label|0) == 25) {
     label = 0;
     $53 = HEAP32[$n>>2]|0;
     $54 = ($53|0)!=(0|0);
     L36: do {
      if ($54) {
       $55 = HEAP32[$n>>2]|0;
       $56 = HEAP32[$55>>2]|0;
       $57 = ($56|0)!=(0);
       if ($57) {
        $58 = HEAP32[$n>>2]|0;
        $59 = ((($58)) + 12|0);
        $60 = HEAP32[$59>>2]|0;
        $61 = ($60|0)!=(0);
        if ($61) {
         _err(2514);
        }
       }
       $62 = $2;
       $63 = HEAP32[$62>>2]|0;
       $64 = HEAP32[$n>>2]|0;
       $65 = ($63|0)==($64|0);
       if ($65) {
        $66 = HEAP32[1718]|0;
        $67 = $2;
        HEAP32[$67>>2] = $66;
       }
       $68 = HEAP32[$n>>2]|0;
       $69 = HEAP32[$68>>2]|0;
       $70 = HEAP32[1718]|0;
       HEAP32[$70>>2] = $69;
       $71 = HEAP32[$n>>2]|0;
       $72 = ((($71)) + 4|0);
       $73 = HEAP32[$72>>2]|0;
       $74 = HEAP32[1718]|0;
       $75 = ((($74)) + 4|0);
       HEAP32[$75>>2] = $73;
       $76 = HEAP32[$n>>2]|0;
       $77 = ((($76)) + 8|0);
       $78 = HEAP32[$77>>2]|0;
       $79 = HEAP32[1718]|0;
       $80 = ((($79)) + 8|0);
       HEAP32[$80>>2] = $78;
       $81 = HEAP32[$n>>2]|0;
       $82 = HEAP32[1718]|0;
       $83 = ((($82)) + 12|0);
       HEAP32[$83>>2] = $81;
       $84 = HEAP32[1718]|0;
       $85 = ((($84)) + 16|0);
       HEAP32[1718] = $85;
       $86 = HEAP32[$d>>2]|0;
       $87 = $86 & 1023;
       $88 = ($87|0)==(32);
       if ($88) {
        $89 = HEAP32[1717]|0;
        $90 = HEAP32[$d>>2]|0;
        $91 = $90 >>> 10;
        $92 = (($89) + ($91))|0;
        $93 = $92;
        $94 = HEAP32[$93>>2]|0;
        $95 = (($94) + 64)|0;
        HEAP32[$d>>2] = $95;
       }
       $96 = HEAP32[$n>>2]|0;
       $97 = ((($96)) + 12|0);
       HEAP32[$97>>2] = 1;
       $98 = HEAP32[$n>>2]|0;
       HEAP32[$98>>2] = 130;
       $99 = HEAP32[$d>>2]|0;
       $100 = HEAP32[$n>>2]|0;
       $101 = ((($100)) + 4|0);
       HEAP32[$101>>2] = $99;
       $102 = $p;
       $103 = $102<<3;
       $104 = (($103) + 8)|0;
       $105 = HEAP32[$n>>2]|0;
       $106 = ((($105)) + 8|0);
       HEAP32[$106>>2] = $104;
       $107 = HEAP32[9931]|0;
       $108 = ($107|0)!=(0);
       if ($108) {
        $109 = HEAP32[$d>>2]|0;
        switch ($109|0) {
        case 4: case 1:  {
         $110 = HEAP32[$n>>2]|0;
         $111 = ((($110)) + 8|0);
         $112 = HEAP32[$111>>2]|0;
         $113 = (($112) + 3)|0;
         HEAP32[$111>>2] = $113;
         break L36;
         break;
        }
        case 5: case 2:  {
         $114 = HEAP32[$n>>2]|0;
         $115 = ((($114)) + 8|0);
         $116 = HEAP32[$115>>2]|0;
         $117 = (($116) + 2)|0;
         HEAP32[$115>>2] = $117;
         break L36;
         break;
        }
        default: {
         break L36;
        }
        }
       }
      }
     } while(0);
     $118 = HEAP32[$d>>2]|0;
     $119 = ($118|0)==(17);
     if ($119) {
      $126 = 1;
     } else {
      $120 = HEAP32[$d>>2]|0;
      $121 = ($120>>>0)<(8);
      $122 = $121 ? 2 : 3;
      $126 = $122;
     }
     $123 = $p;
     $124 = $123<<1;
     $125 = $126 << $124;
     $127 = $pt;
     $128 = $127 | $125;
     $pt = $128;
     $129 = HEAP32[9923]|0;
     $130 = ($129|0)==(202);
     if ($130) {
      _next();
     }
     $131 = HEAP32[9923]|0;
     $132 = ($131|0)==(181);
     if ($132) {
      label = 42;
      break;
     }
    }
    $135 = $p;
    $136 = (($135) + 1)|0;
    $p = $136;
   }
   if ((label|0) == 42) {
    _next();
    $133 = HEAP32[9923]|0;
    $134 = ($133|0)!=(41);
    if ($134) {
     _err(2535);
    }
   }
   _next();
   $137 = HEAP32[9926]|0;
   $138 = HEAP32[1717]|0;
   $139 = (($137) - ($138))|0;
   $140 = $139 << 10;
   $141 = 28 | $140;
   $142 = $1;
   $143 = HEAP32[$142>>2]|0;
   $144 = $143 | $141;
   HEAP32[$142>>2] = $144;
   $145 = HEAP32[9926]|0;
   $146 = $145;
   $1 = $146;
   $147 = $pt;
   $148 = HEAP32[9926]|0;
   $149 = (($148) + 4)|0;
   $150 = $149;
   HEAP32[$150>>2] = $147;
   $151 = HEAP32[9926]|0;
   $152 = (($151) + 8)|0;
   HEAP32[9926] = $152;
  } else {
   while(1) {
    $153 = HEAP32[9923]|0;
    $154 = ($153|0)==(237);
    if (!($154)) {
     break L21;
    }
    _next();
    $a = 0;
    $155 = HEAP32[9923]|0;
    $156 = ($155|0)!=(93);
    if ($156) {
     $157 = (_imm()|0);
     $a = $157;
     $158 = ($157|0)<(0);
     if ($158) {
      _err(2569);
     }
    }
    _skip(93);
    $159 = HEAP32[9926]|0;
    $160 = HEAP32[1717]|0;
    $161 = (($159) - ($160))|0;
    $162 = $161 << 10;
    $163 = 32 | $162;
    $164 = $1;
    $165 = HEAP32[$164>>2]|0;
    $166 = $165 | $163;
    HEAP32[$164>>2] = $166;
    $167 = HEAP32[9926]|0;
    $168 = $167;
    $ap = $168;
    $169 = HEAP32[9926]|0;
    $170 = (($169) + 8)|0;
    HEAP32[9926] = $170;
    $171 = $a;
    $172 = $ap;
    $173 = ((($172)) + 4|0);
    HEAP32[$173>>2] = $171;
    $174 = $ap;
    $1 = $174;
   }
  }
 } while(0);
 $175 = $3;
 $176 = $1;
 $177 = HEAP32[$176>>2]|0;
 $178 = (($177) + ($175))|0;
 HEAP32[$176>>2] = $178;
 $179 = $1;
 $0 = $179;
 $180 = $0;
 STACKTOP = sp;return ($180|0);
}
function _decl($bc) {
 $bc = $bc|0;
 var $$ = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0;
 var $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0;
 var $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0;
 var $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0;
 var $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0;
 var $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0;
 var $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0;
 var $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0;
 var $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0;
 var $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0;
 var $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0;
 var $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0.0, $304 = 0.0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0.0, $312 = 0;
 var $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0;
 var $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0;
 var $35 = 0, $350 = 0.0, $351 = 0.0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0.0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0;
 var $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0;
 var $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0;
 var $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $align = 0, $b = 0, $bt = 0, $c = 0, $hglo = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $sc = 0;
 var $size = 0, $sp = 0, $t = 0, $v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $t = sp + 8|0;
 $v = sp + 4|0;
 $0 = $bc;
 $c = 0;
 while(1) {
  $1 = HEAP32[9923]|0;
  $2 = ($1|0)==(149);
  $3 = HEAP32[9923]|0;
  $4 = ($3|0)==(152);
  $or$cond = $2 | $4;
  if ($or$cond) {
   label = 4;
  } else {
   $5 = HEAP32[9923]|0;
   $6 = ($5|0)==(130);
   $7 = $0;
   $8 = ($7|0)==(130);
   $or$cond3 = $6 & $8;
   if ($or$cond3) {
    label = 4;
   } else {
    $12 = (_basetype()|0);
    $bt = $12;
    $13 = ($12|0)!=(0);
    if (!($13)) {
     $14 = $0;
     $15 = ($14|0)==(130);
     if ($15) {
      label = 94;
      break;
     }
     $bt = 3;
    }
    $16 = $0;
    $sc = $16;
   }
  }
  if ((label|0) == 4) {
   label = 0;
   $9 = HEAP32[9923]|0;
   $sc = $9;
   _next();
   $10 = (_basetype()|0);
   $bt = $10;
   $11 = ($10|0)!=(0);
   $$ = $11 ? $10 : 3;
   $bt = $$;
  }
  $17 = HEAP32[9923]|0;
  $18 = ($17|0)!=(0);
  if (!($18)) {
   label = 94;
   break;
  }
  $19 = HEAP32[9923]|0;
  $20 = ($19|0)==(59);
  if ($20) {
   _next();
   continue;
  }
  L16: while(1) {
   HEAP32[$v>>2] = 0;
   HEAP32[$t>>2] = 0;
   $21 = HEAP32[1718]|0;
   $sp = $21;
   $22 = $bt;
   (_type($t,$v,$22)|0);
   $23 = HEAP32[$v>>2]|0;
   $24 = ($23|0)!=(0|0);
   L18: do {
    if ($24) {
     $25 = HEAP32[9923]|0;
     $26 = ($25|0)==(123);
     if ($26) {
      break L16;
     }
     $127 = HEAP32[$t>>2]|0;
     $128 = $127 & 1023;
     $129 = ($128|0)==(28);
     if ($129) {
      $130 = HEAP32[$v>>2]|0;
      $131 = HEAP32[$130>>2]|0;
      $132 = ($131|0)!=(0);
      if ($132) {
       _err(2731);
      }
      $133 = HEAP32[$v>>2]|0;
      HEAP32[$133>>2] = 169;
      $134 = HEAP32[$t>>2]|0;
      $135 = HEAP32[$v>>2]|0;
      $136 = ((($135)) + 4|0);
      HEAP32[$136>>2] = $134;
      $137 = HEAP32[9933]|0;
      $138 = (($137) + 1)|0;
      HEAP32[9933] = $138;
      while(1) {
       $139 = HEAP32[1718]|0;
       $140 = $sp;
       $141 = ($139|0)!=($140|0);
       if (!($141)) {
        break L18;
       }
       $142 = HEAP32[1718]|0;
       $143 = ((($142)) + -16|0);
       HEAP32[1718] = $143;
       $144 = HEAP32[1718]|0;
       $145 = ((($144)) + 12|0);
       $146 = HEAP32[$145>>2]|0;
       HEAP32[$v>>2] = $146;
       $147 = HEAP32[1718]|0;
       $148 = ((($147)) + 8|0);
       $149 = HEAP32[$148>>2]|0;
       $150 = HEAP32[$v>>2]|0;
       $151 = ((($150)) + 8|0);
       HEAP32[$151>>2] = $149;
       $152 = HEAP32[1718]|0;
       $153 = ((($152)) + 4|0);
       $154 = HEAP32[$153>>2]|0;
       $155 = HEAP32[$v>>2]|0;
       $156 = ((($155)) + 4|0);
       HEAP32[$156>>2] = $154;
       $157 = HEAP32[1718]|0;
       $158 = HEAP32[$157>>2]|0;
       $159 = HEAP32[$v>>2]|0;
       HEAP32[$159>>2] = $158;
       $160 = HEAP32[$v>>2]|0;
       $161 = ((($160)) + 12|0);
       HEAP32[$161>>2] = 0;
      }
     }
     $162 = $0;
     $163 = ($162|0)==(130);
     $164 = HEAP32[$v>>2]|0;
     $165 = HEAP32[$164>>2]|0;
     $166 = ($165|0)!=(0);
     if ($163) {
      if ($166) {
       $167 = HEAP32[$v>>2]|0;
       $168 = ((($167)) + 12|0);
       $169 = HEAP32[$168>>2]|0;
       $170 = ($169|0)!=(0);
       if ($170) {
        _err(2514);
       }
      }
      $171 = HEAP32[$v>>2]|0;
      $172 = HEAP32[$171>>2]|0;
      $173 = HEAP32[1718]|0;
      HEAP32[$173>>2] = $172;
      $174 = HEAP32[$v>>2]|0;
      $175 = ((($174)) + 4|0);
      $176 = HEAP32[$175>>2]|0;
      $177 = HEAP32[1718]|0;
      $178 = ((($177)) + 4|0);
      HEAP32[$178>>2] = $176;
      $179 = HEAP32[$v>>2]|0;
      $180 = ((($179)) + 8|0);
      $181 = HEAP32[$180>>2]|0;
      $182 = HEAP32[1718]|0;
      $183 = ((($182)) + 8|0);
      HEAP32[$183>>2] = $181;
      $184 = HEAP32[$v>>2]|0;
      $185 = HEAP32[1718]|0;
      $186 = ((($185)) + 12|0);
      HEAP32[$186>>2] = $184;
      $187 = HEAP32[1718]|0;
      $188 = ((($187)) + 16|0);
      HEAP32[1718] = $188;
      $189 = HEAP32[$v>>2]|0;
      $190 = ((($189)) + 12|0);
      HEAP32[$190>>2] = 1;
     } else {
      if ($166) {
       _err(2514);
      }
     }
     $191 = $sc;
     $192 = HEAP32[$v>>2]|0;
     HEAP32[$192>>2] = $191;
     $193 = HEAP32[$t>>2]|0;
     $194 = HEAP32[$v>>2]|0;
     $195 = ((($194)) + 4|0);
     HEAP32[$195>>2] = $193;
     $196 = $sc;
     $197 = ($196|0)!=(152);
     if ($197) {
      $198 = HEAP32[$t>>2]|0;
      $199 = $198 & 1023;
      $200 = ($199|0)==(32);
      if ($200) {
       $201 = $sc;
       $202 = ($201|0)==(130);
       $203 = $202 ? 166 : 167;
       $204 = HEAP32[$v>>2]|0;
       HEAP32[$204>>2] = $203;
      }
      $205 = HEAP32[$t>>2]|0;
      $206 = (_tsize($205)|0);
      $size = $206;
      $207 = HEAP32[$t>>2]|0;
      $208 = (_talign($207)|0);
      $align = $208;
      $209 = $sc;
      $210 = ($209|0)==(130);
      if ($210) {
       $211 = HEAP32[1724]|0;
       $212 = $size;
       $213 = (($211) - ($212))|0;
       $214 = $align;
       $215 = (0 - ($214))|0;
       $216 = $213 & $215;
       HEAP32[1724] = $216;
       $217 = HEAP32[$v>>2]|0;
       $218 = ((($217)) + 8|0);
       HEAP32[$218>>2] = $216;
       $219 = HEAP32[9923]|0;
       $220 = ($219|0)==(203);
       if (!($220)) {
        break;
       }
       $221 = HEAP32[$t>>2]|0;
       $222 = $221;
       $223 = HEAP32[$v>>2]|0;
       $224 = ((($223)) + 8|0);
       $225 = HEAP32[$224>>2]|0;
       $226 = $225;
       _node(130,$222,$226);
       $227 = HEAP32[9930]|0;
       $b = $227;
       _next();
       _expr(214);
       $228 = HEAP32[$t>>2]|0;
       $229 = ($228>>>0)<(8);
       $230 = HEAP32[$t>>2]|0;
       $231 = $229 ? 3 : $230;
       _cast($231);
       $232 = HEAP32[9930]|0;
       $233 = ((($232)) + -8|0);
       HEAP32[9930] = $233;
       HEAP32[$233>>2] = 203;
       $234 = $b;
       $235 = $234;
       $236 = HEAP32[9930]|0;
       $237 = ((($236)) + 4|0);
       HEAP32[$237>>2] = $235;
       $238 = $c;
       $239 = ($238|0)!=(0|0);
       if ($239) {
        $240 = HEAP32[9930]|0;
        $241 = ((($240)) + -8|0);
        HEAP32[9930] = $241;
        HEAP32[$241>>2] = 202;
        $242 = $c;
        $243 = $242;
        $244 = HEAP32[9930]|0;
        $245 = ((($244)) + 4|0);
        HEAP32[$245>>2] = $243;
       }
       $246 = HEAP32[9930]|0;
       $c = $246;
       break;
      }
      $247 = HEAP32[9923]|0;
      $248 = ($247|0)==(203);
      if (!($248)) {
       $373 = HEAP32[1721]|0;
       $374 = $align;
       $375 = (($373) + ($374))|0;
       $376 = (($375) - 1)|0;
       $377 = $align;
       $378 = (0 - ($377))|0;
       $379 = $376 & $378;
       HEAP32[1721] = $379;
       $380 = HEAP32[1721]|0;
       $381 = (($380) + 268435456)|0;
       $382 = HEAP32[$v>>2]|0;
       $383 = ((($382)) + 8|0);
       HEAP32[$383>>2] = $381;
       $384 = $size;
       $385 = HEAP32[1721]|0;
       $386 = (($385) + ($384))|0;
       HEAP32[1721] = $386;
       $387 = HEAP32[$v>>2]|0;
       _info_print_global($387);
       break;
      }
      $249 = HEAP32[1720]|0;
      $250 = $align;
      $251 = (($249) + ($250))|0;
      $252 = (($251) - 1)|0;
      $253 = $align;
      $254 = (0 - ($253))|0;
      $255 = $252 & $254;
      HEAP32[1720] = $255;
      $256 = HEAP32[$v>>2]|0;
      $257 = ((($256)) + 8|0);
      HEAP32[$257>>2] = $255;
      $258 = HEAP32[1720]|0;
      $hglo = $258;
      _next();
      $259 = HEAP32[9923]|0;
      $260 = ($259|0)==(34);
      L53: do {
       if ($260) {
        $261 = HEAP32[$t>>2]|0;
        $262 = $261 & 1023;
        $263 = ($262|0)!=(32);
        if ($263) {
         _err(2762);
        }
        _next();
        while(1) {
         $264 = HEAP32[9923]|0;
         $265 = ($264|0)==(34);
         if (!($265)) {
          break;
         }
         _next();
        }
        $266 = $size;
        $267 = ($266|0)!=(0);
        if ($267) {
         $268 = $hglo;
         $269 = $size;
         $270 = (($268) + ($269))|0;
         $273 = $270;
        } else {
         $271 = HEAP32[1720]|0;
         $272 = (($271) + 1)|0;
         $273 = $272;
        }
        HEAP32[1720] = $273;
       } else {
        $274 = HEAP32[9923]|0;
        $275 = ($274|0)==(123);
        $276 = HEAP32[$t>>2]|0;
        if (!($275)) {
         switch ($276|0) {
         case 1: case 4:  {
          $334 = (_imm()|0);
          $335 = $334&255;
          $336 = HEAP32[9929]|0;
          $337 = HEAP32[1720]|0;
          $338 = (($336) + ($337))|0;
          $339 = $338;
          HEAP8[$339>>0] = $335;
          $340 = HEAP32[1720]|0;
          $341 = (($340) + 1)|0;
          HEAP32[1720] = $341;
          break L53;
          break;
         }
         case 2: case 5:  {
          $342 = (_imm()|0);
          $343 = $342&65535;
          $344 = HEAP32[9929]|0;
          $345 = HEAP32[1720]|0;
          $346 = (($344) + ($345))|0;
          $347 = $346;
          HEAP16[$347>>1] = $343;
          $348 = HEAP32[1720]|0;
          $349 = (($348) + 2)|0;
          HEAP32[1720] = $349;
          break L53;
          break;
         }
         case 16:  {
          $350 = (+_immf());
          $351 = $350;
          $352 = HEAP32[9929]|0;
          $353 = HEAP32[1720]|0;
          $354 = (($352) + ($353))|0;
          $355 = $354;
          HEAPF32[$355>>2] = $351;
          $356 = HEAP32[1720]|0;
          $357 = (($356) + 4)|0;
          HEAP32[1720] = $357;
          break L53;
          break;
         }
         case 17:  {
          $358 = (+_immf());
          $359 = HEAP32[9929]|0;
          $360 = HEAP32[1720]|0;
          $361 = (($359) + ($360))|0;
          $362 = $361;
          HEAPF64[$362>>3] = $358;
          $363 = HEAP32[1720]|0;
          $364 = (($363) + 8)|0;
          HEAP32[1720] = $364;
          break L53;
          break;
         }
         default: {
          $365 = (_imm()|0);
          $366 = HEAP32[9929]|0;
          $367 = HEAP32[1720]|0;
          $368 = (($366) + ($367))|0;
          $369 = $368;
          HEAP32[$369>>2] = $365;
          $370 = HEAP32[1720]|0;
          $371 = (($370) + 4)|0;
          HEAP32[1720] = $371;
          break L53;
         }
         }
        }
        $277 = $276 & 1023;
        $278 = ($277|0)!=(32);
        if ($278) {
         _err(2785);
        }
        _next();
        while(1) {
         $279 = HEAP32[9923]|0;
         $280 = ($279|0)!=(125);
         if (!($280)) {
          break;
         }
         $281 = HEAP32[1717]|0;
         $282 = HEAP32[$t>>2]|0;
         $283 = $282 >>> 10;
         $284 = (($281) + ($283))|0;
         $285 = $284;
         $286 = HEAP32[$285>>2]|0;
         switch ($286|0) {
         case 1: case 4:  {
          $287 = (_imm()|0);
          $288 = $287&255;
          $289 = HEAP32[9929]|0;
          $290 = HEAP32[1720]|0;
          $291 = (($289) + ($290))|0;
          $292 = $291;
          HEAP8[$292>>0] = $288;
          $293 = HEAP32[1720]|0;
          $294 = (($293) + 1)|0;
          HEAP32[1720] = $294;
          break;
         }
         case 2: case 5:  {
          $295 = (_imm()|0);
          $296 = $295&65535;
          $297 = HEAP32[9929]|0;
          $298 = HEAP32[1720]|0;
          $299 = (($297) + ($298))|0;
          $300 = $299;
          HEAP16[$300>>1] = $296;
          $301 = HEAP32[1720]|0;
          $302 = (($301) + 2)|0;
          HEAP32[1720] = $302;
          break;
         }
         case 16:  {
          $303 = (+_immf());
          $304 = $303;
          $305 = HEAP32[9929]|0;
          $306 = HEAP32[1720]|0;
          $307 = (($305) + ($306))|0;
          $308 = $307;
          HEAPF32[$308>>2] = $304;
          $309 = HEAP32[1720]|0;
          $310 = (($309) + 4)|0;
          HEAP32[1720] = $310;
          break;
         }
         case 17:  {
          $311 = (+_immf());
          $312 = HEAP32[9929]|0;
          $313 = HEAP32[1720]|0;
          $314 = (($312) + ($313))|0;
          $315 = $314;
          HEAPF64[$315>>3] = $311;
          $316 = HEAP32[1720]|0;
          $317 = (($316) + 8)|0;
          HEAP32[1720] = $317;
          break;
         }
         default: {
          $318 = (_imm()|0);
          $319 = HEAP32[9929]|0;
          $320 = HEAP32[1720]|0;
          $321 = (($319) + ($320))|0;
          $322 = $321;
          HEAP32[$322>>2] = $318;
          $323 = HEAP32[1720]|0;
          $324 = (($323) + 4)|0;
          HEAP32[1720] = $324;
         }
         }
         $325 = HEAP32[9923]|0;
         $326 = ($325|0)==(202);
         if (!($326)) {
          continue;
         }
         _next();
        }
        _next();
        $327 = $size;
        $328 = ($327|0)!=(0);
        if ($328) {
         $329 = $hglo;
         $330 = $size;
         $331 = $align;
         $332 = Math_imul($330, $331)|0;
         $333 = (($329) + ($332))|0;
         HEAP32[1720] = $333;
        }
       }
      } while(0);
      $372 = HEAP32[$v>>2]|0;
      _info_print_global($372);
     }
    } else {
     _err(2584);
    }
   } while(0);
   $388 = HEAP32[9923]|0;
   $389 = ($388|0)!=(202);
   if ($389) {
    label = 92;
    break;
   }
   _next();
  }
  if ((label|0) == 92) {
   label = 0;
   _skip(59);
   continue;
  }
  $27 = $0;
  $28 = ($27|0)!=(149);
  $29 = $sc;
  $30 = ($29|0)!=(149);
  $or$cond5 = $28 | $30;
  if ($or$cond5) {
   _err(2600);
  }
  $31 = HEAP32[$t>>2]|0;
  $32 = $31 & 1023;
  $33 = ($32|0)!=(28);
  if ($33) {
   _err(2620);
  }
  $34 = HEAP32[1717]|0;
  $35 = HEAP32[$t>>2]|0;
  $36 = $35 >>> 10;
  $37 = (($34) + ($36))|0;
  $38 = $37;
  $39 = HEAP32[$38>>2]|0;
  HEAP32[9932] = $39;
  $40 = HEAP32[$v>>2]|0;
  $41 = HEAP32[$40>>2]|0;
  $42 = ($41|0)==(169);
  $43 = HEAP32[$v>>2]|0;
  do {
   if ($42) {
    $44 = ((($43)) + 8|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = HEAP32[1712]|0;
    _patch($45,$46);
    $47 = HEAP32[9933]|0;
    $48 = (($47) + -1)|0;
    HEAP32[9933] = $48;
    $49 = HEAP32[9932]|0;
    $50 = HEAP32[1717]|0;
    $51 = HEAP32[$v>>2]|0;
    $52 = ((($51)) + 4|0);
    $53 = HEAP32[$52>>2]|0;
    $54 = $53 >>> 10;
    $55 = (($50) + ($54))|0;
    $56 = $55;
    $57 = HEAP32[$56>>2]|0;
    $58 = ($49|0)!=($57|0);
    if (!($58)) {
     $59 = HEAP32[1717]|0;
     $60 = HEAP32[$v>>2]|0;
     $61 = ((($60)) + 4|0);
     $62 = HEAP32[$61>>2]|0;
     $63 = $62 >>> 10;
     $64 = (($59) + ($63))|0;
     $65 = (($64) + 4)|0;
     $66 = $65;
     $67 = HEAP32[$66>>2]|0;
     $bt = $67;
     $68 = ($67|0)!=(0);
     if (!($68)) {
      break;
     }
     $69 = $bt;
     $70 = HEAP32[1717]|0;
     $71 = HEAP32[$t>>2]|0;
     $72 = $71 >>> 10;
     $73 = (($70) + ($72))|0;
     $74 = (($73) + 4)|0;
     $75 = $74;
     $76 = HEAP32[$75>>2]|0;
     $77 = ($69|0)!=($76|0);
     if (!($77)) {
      break;
     }
    }
    _err(2644);
   } else {
    $78 = HEAP32[$43>>2]|0;
    $79 = ($78|0)!=(0);
    if ($79) {
     _err(2685);
    }
   }
  } while(0);
  $80 = HEAP32[$v>>2]|0;
  HEAP32[$80>>2] = 168;
  $81 = HEAP32[$t>>2]|0;
  $82 = HEAP32[$v>>2]|0;
  $83 = ((($82)) + 4|0);
  HEAP32[$83>>2] = $81;
  $84 = HEAP32[1712]|0;
  $85 = HEAP32[$v>>2]|0;
  $86 = ((($85)) + 8|0);
  HEAP32[$86>>2] = $84;
  HEAP32[1724] = 0;
  _next();
  $87 = HEAP32[9930]|0;
  $b = $87;
  _decl(130);
  $88 = HEAP32[1724]|0;
  $89 = $88 & -8;
  HEAP32[1724] = $89;
  $90 = $sp;
  _info_print_locals($90);
  $91 = HEAP32[1724]|0;
  _emi(1,$91);
  $92 = HEAP32[9930]|0;
  $93 = $b;
  $94 = ($92|0)!=($93|0);
  if ($94) {
   $95 = HEAP32[9930]|0;
   _rv($95);
   $96 = $b;
   HEAP32[9930] = $96;
  }
  while(1) {
   $97 = HEAP32[9923]|0;
   $98 = ($97|0)!=(125);
   if (!($98)) {
    break;
   }
   _stmt();
  }
  $99 = HEAP32[1724]|0;
  $100 = (0 - ($99))|0;
  _emi(2,$100);
  while(1) {
   $101 = HEAP32[1718]|0;
   $102 = $sp;
   $103 = ($101|0)!=($102|0);
   if (!($103)) {
    break;
   }
   $104 = HEAP32[1718]|0;
   $105 = ((($104)) + -16|0);
   HEAP32[1718] = $105;
   $106 = HEAP32[1718]|0;
   $107 = ((($106)) + 12|0);
   $108 = HEAP32[$107>>2]|0;
   HEAP32[$v>>2] = $108;
   $109 = HEAP32[1718]|0;
   $110 = ((($109)) + 8|0);
   $111 = HEAP32[$110>>2]|0;
   $112 = HEAP32[$v>>2]|0;
   $113 = ((($112)) + 8|0);
   HEAP32[$113>>2] = $111;
   $114 = HEAP32[1718]|0;
   $115 = ((($114)) + 4|0);
   $116 = HEAP32[$115>>2]|0;
   $117 = HEAP32[$v>>2]|0;
   $118 = ((($117)) + 4|0);
   HEAP32[$118>>2] = $116;
   $119 = HEAP32[$v>>2]|0;
   $120 = HEAP32[$119>>2]|0;
   $121 = ($120|0)==(172);
   if ($121) {
    _err(2715);
   }
   $122 = HEAP32[1718]|0;
   $123 = HEAP32[$122>>2]|0;
   $124 = HEAP32[$v>>2]|0;
   HEAP32[$124>>2] = $123;
   $125 = HEAP32[$v>>2]|0;
   $126 = ((($125)) + 12|0);
   HEAP32[$126>>2] = 0;
  }
  _next();
 }
 if ((label|0) == 94) {
  STACKTOP = sp;return;
 }
}
function _rv($a) {
 $a = $a|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0.0, $204 = 0.0, $205 = 0.0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0.0, $21 = 0, $210 = 0.0, $211 = 0.0, $212 = 0, $213 = 0.0, $214 = 0.0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0.0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0;
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0;
 var $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0;
 var $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0;
 var $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0;
 var $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $b = 0, $c = 0, $d = 0.0, $n = 0, $t = 0;
 var $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp + 8|0;
 $0 = $a;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 do {
  switch ($2|0) {
  case 182:  {
   $3 = $0;
   _opaf($3,79,1);
   STACKTOP = sp;return;
   break;
  }
  case 183:  {
   $4 = $0;
   _opaf($4,80,0);
   STACKTOP = sp;return;
   break;
  }
  case 184:  {
   $5 = $0;
   _opaf($5,81,1);
   STACKTOP = sp;return;
   break;
  }
  case 186:  {
   $6 = $0;
   _opaf($6,82,0);
   STACKTOP = sp;return;
   break;
  }
  case 204:  {
   $7 = $0;
   _opa($7,83,1);
   STACKTOP = sp;return;
   break;
  }
  case 205:  {
   $8 = $0;
   _opa($8,86,0);
   STACKTOP = sp;return;
   break;
  }
  case 206:  {
   $9 = $0;
   _opa($9,89,1);
   STACKTOP = sp;return;
   break;
  }
  case 207:  {
   $10 = $0;
   _opa($10,92,0);
   STACKTOP = sp;return;
   break;
  }
  case 185:  {
   $11 = $0;
   _opa($11,95,0);
   STACKTOP = sp;return;
   break;
  }
  case 208:  {
   $12 = $0;
   _opa($12,98,0);
   STACKTOP = sp;return;
   break;
  }
  case 187:  {
   $13 = $0;
   _opa($13,101,0);
   STACKTOP = sp;return;
   break;
  }
  case 209:  {
   $14 = $0;
   _opa($14,104,1);
   STACKTOP = sp;return;
   break;
  }
  case 210:  {
   $15 = $0;
   _opa($15,107,1);
   STACKTOP = sp;return;
   break;
  }
  case 211:  {
   $16 = $0;
   _opa($16,110,1);
   STACKTOP = sp;return;
   break;
  }
  case 212:  {
   $17 = $0;
   _opa($17,113,0);
   STACKTOP = sp;return;
   break;
  }
  case 213:  {
   $18 = $0;
   _opa($18,116,0);
   STACKTOP = sp;return;
   break;
  }
  case 188:  {
   $19 = $0;
   _opa($19,119,0);
   STACKTOP = sp;return;
   break;
  }
  case 203:  {
   $20 = $0;
   $21 = ((($20)) + 8|0);
   $b = $21;
   $22 = $0;
   $23 = ((($22)) + 4|0);
   $24 = HEAP32[$23>>2]|0;
   $25 = $24;
   $0 = $25;
   $26 = $0;
   $27 = HEAP32[$26>>2]|0;
   switch ($27|0) {
   case 130:  {
    $28 = $b;
    _rv($28);
    $29 = $0;
    $30 = ((($29)) + 4|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = (_smod($31)|0);
    $33 = (64 + ($32))|0;
    $34 = $0;
    $35 = ((($34)) + 8|0);
    $36 = HEAP32[$35>>2]|0;
    _eml($33,$36);
    STACKTOP = sp;return;
    break;
   }
   case 149:  {
    $37 = $b;
    _rv($37);
    $38 = $0;
    $39 = ((($38)) + 4|0);
    $40 = HEAP32[$39>>2]|0;
    $41 = (_smod($40)|0);
    $42 = (69 + ($41))|0;
    $43 = $0;
    $44 = ((($43)) + 8|0);
    $45 = HEAP32[$44>>2]|0;
    _emg($42,$45);
    STACKTOP = sp;return;
    break;
   }
   case 162:  {
    $46 = $0;
    $47 = ((($46)) + 8|0);
    $48 = HEAP32[$47>>2]|0;
    L46: do {
     switch ($48|0) {
     case 130:  {
      $49 = $b;
      _rv($49);
      $50 = $0;
      $51 = ((($50)) + 12|0);
      $52 = HEAP32[$51>>2]|0;
      $53 = (_lmod($52)|0);
      $54 = (38 + ($53))|0;
      $55 = $0;
      $56 = ((($55)) + 16|0);
      $57 = HEAP32[$56>>2]|0;
      _eml($54,$57);
      break;
     }
     case 149:  {
      $58 = $b;
      _rv($58);
      $59 = $0;
      $60 = ((($59)) + 12|0);
      $61 = HEAP32[$60>>2]|0;
      $62 = (_lmod($61)|0);
      $63 = (45 + ($62))|0;
      $64 = $0;
      $65 = ((($64)) + 16|0);
      $66 = HEAP32[$65>>2]|0;
      _emg($63,$66);
      break;
     }
     default: {
      $67 = $0;
      $68 = ((($67)) + 8|0);
      _rv($68);
      $69 = $b;
      $70 = HEAP32[$69>>2]|0;
      switch ($70|0) {
      case 161: case 128: case 130: case 149:  {
       _em(62);
       $71 = $b;
       _rv($71);
       break L46;
       break;
      }
      default: {
       $72 = HEAP32[1724]|0;
       $73 = (($72) - 8)|0;
       HEAP32[1724] = $73;
       _em(157);
       $74 = $b;
       _rv($74);
       _em(161);
       $75 = HEAP32[1724]|0;
       $76 = (($75) + 8)|0;
       HEAP32[1724] = $76;
       break L46;
      }
      }
     }
     }
    } while(0);
    $77 = $0;
    $78 = ((($77)) + 4|0);
    $79 = HEAP32[$78>>2]|0;
    $80 = (_smod($79)|0);
    $81 = (74 + ($80))|0;
    _em($81);
    STACKTOP = sp;return;
    break;
   }
   default: {
    _err(2887);
    STACKTOP = sp;return;
   }
   }
   break;
  }
  case 196:  {
   $82 = $0;
   _opf($82);
   _em(79);
   STACKTOP = sp;return;
   break;
  }
  case 197:  {
   $83 = $0;
   _opf($83);
   _em(80);
   STACKTOP = sp;return;
   break;
  }
  case 198:  {
   $84 = $0;
   _opf($84);
   _em(81);
   STACKTOP = sp;return;
   break;
  }
  case 200:  {
   $85 = $0;
   _opf($85);
   _em(82);
   STACKTOP = sp;return;
   break;
  }
  case 228:  {
   $86 = $0;
   _op($86,83);
   STACKTOP = sp;return;
   break;
  }
  case 229:  {
   $87 = $0;
   _op($87,86);
   STACKTOP = sp;return;
   break;
  }
  case 230:  {
   $88 = $0;
   _op($88,89);
   STACKTOP = sp;return;
   break;
  }
  case 231:  {
   $89 = $0;
   _op($89,92);
   STACKTOP = sp;return;
   break;
  }
  case 199:  {
   $90 = $0;
   _op($90,95);
   STACKTOP = sp;return;
   break;
  }
  case 232:  {
   $91 = $0;
   _op($91,98);
   STACKTOP = sp;return;
   break;
  }
  case 201:  {
   $92 = $0;
   _op($92,101);
   STACKTOP = sp;return;
   break;
  }
  case 219:  {
   $93 = $0;
   _op($93,104);
   STACKTOP = sp;return;
   break;
  }
  case 217:  {
   $94 = $0;
   _op($94,107);
   STACKTOP = sp;return;
   break;
  }
  case 218:  {
   $95 = $0;
   _op($95,110);
   STACKTOP = sp;return;
   break;
  }
  case 226:  {
   $96 = $0;
   _op($96,113);
   STACKTOP = sp;return;
   break;
  }
  case 227:  {
   $97 = $0;
   _op($97,116);
   STACKTOP = sp;return;
   break;
  }
  case 195:  {
   $98 = $0;
   _op($98,119);
   STACKTOP = sp;return;
   break;
  }
  case 220:  {
   $99 = $0;
   _opt($99);
   _em(122);
   STACKTOP = sp;return;
   break;
  }
  case 221:  {
   $100 = $0;
   _opt($100);
   _em(124);
   STACKTOP = sp;return;
   break;
  }
  case 222:  {
   $101 = $0;
   _opt($101);
   _em(126);
   STACKTOP = sp;return;
   break;
  }
  case 225:  {
   $102 = $0;
   _opt($102);
   _em(129);
   STACKTOP = sp;return;
   break;
  }
  case 191:  {
   $103 = $0;
   _opt($103);
   _em(127);
   STACKTOP = sp;return;
   break;
  }
  case 193:  {
   $104 = $0;
   _opt($104);
   _em(130);
   STACKTOP = sp;return;
   break;
  }
  case 189:  {
   $105 = $0;
   _opf($105);
   _em(123);
   STACKTOP = sp;return;
   break;
  }
  case 190:  {
   $106 = $0;
   _opf($106);
   _em(125);
   STACKTOP = sp;return;
   break;
  }
  case 192:  {
   $107 = $0;
   _opf($107);
   _em(128);
   STACKTOP = sp;return;
   break;
  }
  case 194:  {
   $108 = $0;
   _opf($108);
   _em(131);
   STACKTOP = sp;return;
   break;
  }
  case 173:  {
   $109 = $0;
   $110 = ((($109)) + 4|0);
   $111 = HEAP32[$110>>2]|0;
   $112 = $111;
   _rv($112);
   _em(146);
   STACKTOP = sp;return;
   break;
  }
  case 174:  {
   $113 = $0;
   $114 = ((($113)) + 4|0);
   $115 = HEAP32[$114>>2]|0;
   $116 = $115;
   _rv($116);
   _em(147);
   STACKTOP = sp;return;
   break;
  }
  case 175:  {
   $117 = $0;
   $118 = ((($117)) + 8|0);
   _rv($118);
   _em(148);
   STACKTOP = sp;return;
   break;
  }
  case 176:  {
   $119 = $0;
   $120 = ((($119)) + 8|0);
   _rv($120);
   _em(149);
   STACKTOP = sp;return;
   break;
  }
  case 177:  {
   $121 = $0;
   $122 = ((($121)) + 8|0);
   _rv($122);
   _emi(114,24);
   _emi(117,24);
   STACKTOP = sp;return;
   break;
  }
  case 178:  {
   $123 = $0;
   $124 = ((($123)) + 8|0);
   _rv($124);
   _emi(105,255);
   STACKTOP = sp;return;
   break;
  }
  case 179:  {
   $125 = $0;
   $126 = ((($125)) + 8|0);
   _rv($126);
   _emi(114,16);
   _emi(117,16);
   STACKTOP = sp;return;
   break;
  }
  case 180:  {
   $127 = $0;
   $128 = ((($127)) + 8|0);
   _rv($128);
   _emi(105,65535);
   STACKTOP = sp;return;
   break;
  }
  case 202:  {
   $129 = $0;
   $130 = ((($129)) + 4|0);
   $131 = HEAP32[$130>>2]|0;
   $132 = $131;
   _rv($132);
   $133 = $0;
   $134 = ((($133)) + 8|0);
   _rv($134);
   STACKTOP = sp;return;
   break;
  }
  case 214:  {
   $135 = $0;
   $136 = ((($135)) + 4|0);
   $137 = HEAP32[$136>>2]|0;
   $138 = $137;
   $139 = (_testnot($138,0)|0);
   $t = $139;
   $140 = $0;
   $141 = ((($140)) + 8|0);
   $142 = HEAP32[$141>>2]|0;
   $143 = $142;
   _rv($143);
   $144 = (_emf(3,0)|0);
   $c = $144;
   $145 = $t;
   $146 = HEAP32[1712]|0;
   _patch($145,$146);
   $147 = $0;
   $148 = ((($147)) + 12|0);
   $149 = HEAP32[$148>>2]|0;
   $150 = $149;
   _rv($150);
   $151 = $c;
   $152 = HEAP32[1712]|0;
   _patch($151,$152);
   STACKTOP = sp;return;
   break;
  }
  case 215:  {
   $153 = $0;
   $154 = ((($153)) + 8|0);
   $155 = $0;
   $156 = ((($155)) + 4|0);
   $157 = HEAP32[$156>>2]|0;
   $158 = $157;
   $159 = (_test($158,0)|0);
   $160 = (_test($154,$159)|0);
   $t = $160;
   _emi(35,0);
   $161 = (_emf(3,0)|0);
   $c = $161;
   $162 = $t;
   $163 = HEAP32[1712]|0;
   _patch($162,$163);
   _emi(35,1);
   $164 = $c;
   $165 = HEAP32[1712]|0;
   _patch($164,$165);
   STACKTOP = sp;return;
   break;
  }
  case 216:  {
   $166 = $0;
   $167 = ((($166)) + 8|0);
   $168 = $0;
   $169 = ((($168)) + 4|0);
   $170 = HEAP32[$169>>2]|0;
   $171 = $170;
   $172 = (_testnot($171,0)|0);
   $173 = (_testnot($167,$172)|0);
   $t = $173;
   _emi(35,1);
   $174 = (_emf(3,0)|0);
   $c = $174;
   $175 = $t;
   $176 = HEAP32[1712]|0;
   _patch($175,$176);
   _emi(35,0);
   $177 = $c;
   $178 = HEAP32[1712]|0;
   _patch($177,$178);
   STACKTOP = sp;return;
   break;
  }
  case 163:  {
   $179 = $0;
   $180 = ((($179)) + 8|0);
   _rv($180);
   _emi(59,0);
   _em(122);
   STACKTOP = sp;return;
   break;
  }
  case 164:  {
   $181 = $0;
   $182 = ((($181)) + 8|0);
   _rv($182);
   _emi(61,0);
   _em(123);
   STACKTOP = sp;return;
   break;
  }
  case 128:  {
   $183 = $0;
   $184 = ((($183)) + 8|0);
   $185 = HEAP32[$184>>2]|0;
   $186 = $185 << 8;
   $187 = $186 >> 8;
   $188 = $0;
   $189 = ((($188)) + 8|0);
   $190 = HEAP32[$189>>2]|0;
   $191 = ($187|0)==($190|0);
   $192 = $0;
   $193 = ((($192)) + 8|0);
   $194 = HEAP32[$193>>2]|0;
   if ($191) {
    _emi(35,$194);
    STACKTOP = sp;return;
   } else {
    $195 = $194 >> 24;
    _emi(35,$195);
    $196 = $0;
    $197 = ((($196)) + 8|0);
    $198 = HEAP32[$197>>2]|0;
    $199 = $198 << 8;
    $200 = $199 >> 8;
    _emi(36,$200);
    STACKTOP = sp;return;
   }
   break;
  }
  case 161:  {
   $201 = $0;
   $202 = ((($201)) + 8|0);
   $203 = +HEAPF64[$202>>3];
   $d = $203;
   $204 = $d;
   $205 = $204 * 256.0;
   $206 = (~~(($205)));
   $207 = $206 << 8;
   $208 = $207 >> 8;
   $209 = (+($208|0));
   $210 = $209 / 256.0;
   $211 = $d;
   $212 = $210 == $211;
   if ($212) {
    $213 = $d;
    $214 = $213 * 256.0;
    $215 = (~~(($214)));
    _emi(37,$215);
    STACKTOP = sp;return;
   } else {
    $216 = HEAP32[1720]|0;
    $217 = (($216) + 7)|0;
    $218 = $217 & -8;
    HEAP32[1720] = $218;
    $219 = $d;
    $220 = HEAP32[9929]|0;
    $221 = HEAP32[1720]|0;
    $222 = (($220) + ($221))|0;
    $223 = $222;
    HEAPF64[$223>>3] = $219;
    $224 = HEAP32[1720]|0;
    _emg(26,$224);
    $225 = HEAP32[1720]|0;
    $226 = (($225) + 8)|0;
    HEAP32[1720] = $226;
    STACKTOP = sp;return;
   }
   break;
  }
  case 162:  {
   $227 = $0;
   $228 = ((($227)) + 4|0);
   $229 = HEAP32[$228>>2]|0;
   $t = $229;
   $230 = $0;
   $231 = ((($230)) + 8|0);
   $232 = HEAP32[$231>>2]|0;
   $233 = ($232|0)==(228);
   if ($233) {
    $234 = $0;
    $235 = ((($234)) + 16|0);
    $236 = HEAP32[$235>>2]|0;
    $237 = $236;
    $238 = HEAP32[$237>>2]|0;
    $239 = ($238|0)==(128);
    if ($239) {
     $240 = $0;
     $241 = ((($240)) + 16|0);
     $242 = HEAP32[$241>>2]|0;
     $243 = $242;
     $244 = ((($243)) + 8|0);
     $245 = HEAP32[$244>>2]|0;
     $c = $245;
     $246 = $c;
     $247 = $246 << 8;
     $248 = $247 >> 8;
     $249 = $c;
     $250 = ($248|0)==($249|0);
     if ($250) {
      $251 = $0;
      $252 = ((($251)) + 12|0);
      $253 = HEAP32[$252>>2]|0;
      $254 = $253;
      _rv($254);
      $255 = $t;
      $256 = (_lmod($255)|0);
      $257 = (28 + ($256))|0;
      $258 = $c;
      _emi($257,$258);
      STACKTOP = sp;return;
     }
    }
   }
   $259 = $0;
   $260 = ((($259)) + 8|0);
   _rv($260);
   $261 = $t;
   $262 = (_lmod($261)|0);
   $263 = (28 + ($262))|0;
   _em($263);
   STACKTOP = sp;return;
   break;
  }
  case 166:  {
   $264 = $0;
   $265 = ((($264)) + 8|0);
   $266 = HEAP32[$265>>2]|0;
   _eml(7,$266);
   STACKTOP = sp;return;
   break;
  }
  case 167:  {
   $267 = $0;
   $268 = ((($267)) + 8|0);
   $269 = HEAP32[$268>>2]|0;
   _emg(8,$269);
   STACKTOP = sp;return;
   break;
  }
  case 130:  {
   $270 = $0;
   $271 = ((($270)) + 4|0);
   $272 = HEAP32[$271>>2]|0;
   $273 = (_lmod($272)|0);
   $274 = (14 + ($273))|0;
   $275 = $0;
   $276 = ((($275)) + 8|0);
   $277 = HEAP32[$276>>2]|0;
   _eml($274,$277);
   STACKTOP = sp;return;
   break;
  }
  case 149:  {
   $278 = $0;
   $279 = ((($278)) + 4|0);
   $280 = HEAP32[$279>>2]|0;
   $281 = (_lmod($280)|0);
   $282 = (21 + ($281))|0;
   $283 = $0;
   $284 = ((($283)) + 8|0);
   $285 = HEAP32[$284>>2]|0;
   _emg($282,$285);
   STACKTOP = sp;return;
   break;
  }
  case 168:  {
   $286 = $0;
   $287 = ((($286)) + 8|0);
   $288 = HEAP32[$287>>2]|0;
   _emj(8,$288);
   STACKTOP = sp;return;
   break;
  }
  case 169:  {
   $289 = $0;
   $290 = ((($289)) + 8|0);
   $291 = HEAP32[$290>>2]|0;
   $292 = $291;
   $n = $292;
   $293 = $n;
   $294 = ((($293)) + 8|0);
   $295 = HEAP32[$294>>2]|0;
   $296 = (_emf(8,$295)|0);
   $297 = $n;
   $298 = ((($297)) + 8|0);
   HEAP32[$298>>2] = $296;
   STACKTOP = sp;return;
   break;
  }
  case 170:  {
   $299 = $0;
   $300 = ((($299)) + 8|0);
   $301 = HEAP32[$300>>2]|0;
   $302 = $301;
   $b = $302;
   $303 = $0;
   $304 = ((($303)) + 4|0);
   $305 = HEAP32[$304>>2]|0;
   $306 = $305;
   $0 = $306;
   $t = 0;
   while(1) {
    $307 = $b;
    $308 = ($307|0)!=(0|0);
    if (!($308)) {
     break;
    }
    $309 = $b;
    $310 = ((($309)) + 4|0);
    $311 = HEAP32[$310>>2]|0;
    $312 = ($311|0)==(17);
    do {
     if ($312) {
      label = 92;
     } else {
      $313 = $b;
      $314 = ((($313)) + 4|0);
      $315 = HEAP32[$314>>2]|0;
      $316 = ($315|0)==(16);
      if ($316) {
       label = 92;
      } else {
       $321 = $b;
       $322 = ((($321)) + 8|0);
       $323 = HEAP32[$322>>2]|0;
       $324 = ($323|0)==(128);
       if ($324) {
        $325 = $b;
        $326 = ((($325)) + 16|0);
        $327 = HEAP32[$326>>2]|0;
        $328 = $327 << 8;
        $329 = $328 >> 8;
        $330 = $b;
        $331 = ((($330)) + 16|0);
        $332 = HEAP32[$331>>2]|0;
        $333 = ($329|0)==($332|0);
        if ($333) {
         $334 = HEAP32[1724]|0;
         $335 = (($334) - 8)|0;
         HEAP32[1724] = $335;
         $336 = $b;
         $337 = ((($336)) + 16|0);
         $338 = HEAP32[$337>>2]|0;
         _emi(158,$338);
         break;
        }
       }
       $339 = $b;
       $340 = ((($339)) + 8|0);
       _rv($340);
       $341 = HEAP32[1724]|0;
       $342 = (($341) - 8)|0;
       HEAP32[1724] = $342;
       _em(157);
      }
     }
    } while(0);
    if ((label|0) == 92) {
     label = 0;
     $317 = $b;
     $318 = ((($317)) + 8|0);
     _rv($318);
     $319 = HEAP32[1724]|0;
     $320 = (($319) - 8)|0;
     HEAP32[1724] = $320;
     _em(159);
    }
    $343 = $b;
    $344 = HEAP32[$343>>2]|0;
    $345 = $344;
    $b = $345;
    $346 = $t;
    $347 = (($346) + 8)|0;
    $t = $347;
   }
   $348 = $0;
   $349 = HEAP32[$348>>2]|0;
   $350 = ($349|0)==(169);
   $351 = $0;
   do {
    if ($350) {
     $352 = ((($351)) + 8|0);
     $353 = HEAP32[$352>>2]|0;
     $354 = $353;
     $n = $354;
     $355 = $n;
     $356 = ((($355)) + 8|0);
     $357 = HEAP32[$356>>2]|0;
     $358 = (_emf(5,$357)|0);
     $359 = $n;
     $360 = ((($359)) + 8|0);
     HEAP32[$360>>2] = $358;
    } else {
     $361 = HEAP32[$351>>2]|0;
     $362 = ($361|0)==(168);
     $363 = $0;
     if ($362) {
      $364 = ((($363)) + 8|0);
      $365 = HEAP32[$364>>2]|0;
      _emj(5,$365);
      break;
     } else {
      _rv($363);
      _em(6);
      break;
     }
    }
   } while(0);
   $366 = $t;
   $367 = ($366|0)!=(0);
   if (!($367)) {
    STACKTOP = sp;return;
   }
   $368 = $t;
   _emi(1,$368);
   $369 = $t;
   $370 = HEAP32[1724]|0;
   $371 = (($370) + ($369))|0;
   HEAP32[1724] = $371;
   STACKTOP = sp;return;
   break;
  }
  default: {
   $372 = HEAP32[2]|0;
   $373 = $0;
   $374 = HEAP32[$373>>2]|0;
   HEAP32[$vararg_buffer>>2] = $374;
   (_fprintf($372,3806,$vararg_buffer)|0);
   _exit(-1);
   // unreachable;
  }
  }
 } while(0);
}
function _node($n,$a,$b) {
 $n = $n|0;
 $a = $a|0;
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $n;
 $1 = $a;
 $2 = $b;
 $3 = $0;
 $4 = HEAP32[9930]|0;
 $5 = ((($4)) + -16|0);
 HEAP32[9930] = $5;
 HEAP32[$5>>2] = $3;
 $6 = $1;
 $7 = $6;
 $8 = HEAP32[9930]|0;
 $9 = ((($8)) + 4|0);
 HEAP32[$9>>2] = $7;
 $10 = $2;
 $11 = $10;
 $12 = HEAP32[9930]|0;
 $13 = ((($12)) + 8|0);
 HEAP32[$13>>2] = $11;
 STACKTOP = sp;return;
}
function _cast($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0.0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $12 = 0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = $0;
 $2 = ($1|0)==(17);
 $3 = $0;
 $4 = ($3|0)==(16);
 $or$cond = $2 | $4;
 if ($or$cond) {
  $5 = HEAP32[9928]|0;
  $6 = ($5>>>0)<(8);
  if ($6) {
   $7 = HEAP32[9930]|0;
   $8 = HEAP32[$7>>2]|0;
   $9 = ($8|0)==(128);
   $10 = HEAP32[9930]|0;
   if ($9) {
    HEAP32[$10>>2] = 161;
    $11 = HEAP32[9930]|0;
    $12 = ((($11)) + 8|0);
    $13 = HEAP32[$12>>2]|0;
    $14 = (+($13|0));
    $15 = HEAP32[9930]|0;
    $16 = ((($15)) + 8|0);
    HEAPF64[$16>>3] = $14;
    STACKTOP = sp;return;
   } else {
    $17 = ((($10)) + -8|0);
    HEAP32[9930] = $17;
    HEAP32[$17>>2] = 173;
    $18 = HEAP32[9930]|0;
    $19 = ((($18)) + 8|0);
    $20 = $19;
    $21 = HEAP32[9930]|0;
    $22 = ((($21)) + 4|0);
    HEAP32[$22>>2] = $20;
    STACKTOP = sp;return;
   }
  }
  $23 = HEAP32[9928]|0;
  $24 = ($23|0)!=(17);
  $25 = HEAP32[9928]|0;
  $26 = ($25|0)!=(16);
  $or$cond3 = $24 & $26;
  if (!($or$cond3)) {
   STACKTOP = sp;return;
  }
  $27 = HEAP32[9930]|0;
  $28 = HEAP32[$27>>2]|0;
  $29 = ($28|0)==(128);
  $30 = HEAP32[9930]|0;
  if ($29) {
   HEAP32[$30>>2] = 161;
   $31 = HEAP32[9930]|0;
   $32 = ((($31)) + 8|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = (+($33>>>0));
   $35 = HEAP32[9930]|0;
   $36 = ((($35)) + 8|0);
   HEAPF64[$36>>3] = $34;
   STACKTOP = sp;return;
  } else {
   $37 = ((($30)) + -8|0);
   HEAP32[9930] = $37;
   HEAP32[$37>>2] = 174;
   $38 = HEAP32[9930]|0;
   $39 = ((($38)) + 8|0);
   $40 = $39;
   $41 = HEAP32[9930]|0;
   $42 = ((($41)) + 4|0);
   HEAP32[$42>>2] = $40;
   STACKTOP = sp;return;
  }
 }
 $43 = $0;
 $44 = ($43>>>0)<(8);
 $45 = HEAP32[9928]|0;
 $46 = ($45|0)==(17);
 $47 = HEAP32[9928]|0;
 $48 = ($47|0)==(16);
 $or$cond5 = $46 | $48;
 if (!($44)) {
  if (!($or$cond5)) {
   STACKTOP = sp;return;
  }
  $105 = HEAP32[9930]|0;
  $106 = HEAP32[$105>>2]|0;
  $107 = ($106|0)==(161);
  $108 = HEAP32[9930]|0;
  if ($107) {
   HEAP32[$108>>2] = 128;
   $109 = HEAP32[9930]|0;
   $110 = ((($109)) + 8|0);
   $111 = +HEAPF64[$110>>3];
   $112 = (~~(($111))>>>0);
   $113 = HEAP32[9930]|0;
   $114 = ((($113)) + 8|0);
   HEAP32[$114>>2] = $112;
   STACKTOP = sp;return;
  } else {
   $115 = ((($108)) + -8|0);
   HEAP32[9930] = $115;
   HEAP32[$115>>2] = 176;
   STACKTOP = sp;return;
  }
 }
 do {
  if ($or$cond5) {
   $49 = HEAP32[9930]|0;
   $50 = HEAP32[$49>>2]|0;
   $51 = ($50|0)==(161);
   $52 = HEAP32[9930]|0;
   if ($51) {
    HEAP32[$52>>2] = 128;
    $53 = HEAP32[9930]|0;
    $54 = ((($53)) + 8|0);
    $55 = +HEAPF64[$54>>3];
    $56 = (~~(($55)));
    $57 = HEAP32[9930]|0;
    $58 = ((($57)) + 8|0);
    HEAP32[$58>>2] = $56;
    break;
   } else {
    $59 = ((($52)) + -8|0);
    HEAP32[9930] = $59;
    HEAP32[$59>>2] = 175;
    break;
   }
  }
 } while(0);
 $60 = $0;
 switch ($60|0) {
 case 1:  {
  $61 = HEAP32[9930]|0;
  $62 = HEAP32[$61>>2]|0;
  $63 = ($62|0)==(128);
  $64 = HEAP32[9930]|0;
  if ($63) {
   $65 = ((($64)) + 8|0);
   $66 = HEAP32[$65>>2]|0;
   $67 = $66&255;
   $68 = $67 << 24 >> 24;
   $69 = HEAP32[9930]|0;
   $70 = ((($69)) + 8|0);
   HEAP32[$70>>2] = $68;
   STACKTOP = sp;return;
  } else {
   $71 = ((($64)) + -8|0);
   HEAP32[9930] = $71;
   HEAP32[$71>>2] = 177;
   STACKTOP = sp;return;
  }
  break;
 }
 case 4:  {
  $72 = HEAP32[9930]|0;
  $73 = HEAP32[$72>>2]|0;
  $74 = ($73|0)==(128);
  $75 = HEAP32[9930]|0;
  if ($74) {
   $76 = ((($75)) + 8|0);
   $77 = HEAP32[$76>>2]|0;
   $78 = $77&255;
   $79 = $78&255;
   $80 = HEAP32[9930]|0;
   $81 = ((($80)) + 8|0);
   HEAP32[$81>>2] = $79;
   STACKTOP = sp;return;
  } else {
   $82 = ((($75)) + -8|0);
   HEAP32[9930] = $82;
   HEAP32[$82>>2] = 178;
   STACKTOP = sp;return;
  }
  break;
 }
 case 2:  {
  $83 = HEAP32[9930]|0;
  $84 = HEAP32[$83>>2]|0;
  $85 = ($84|0)==(128);
  $86 = HEAP32[9930]|0;
  if ($85) {
   $87 = ((($86)) + 8|0);
   $88 = HEAP32[$87>>2]|0;
   $89 = $88&65535;
   $90 = $89 << 16 >> 16;
   $91 = HEAP32[9930]|0;
   $92 = ((($91)) + 8|0);
   HEAP32[$92>>2] = $90;
   STACKTOP = sp;return;
  } else {
   $93 = ((($86)) + -8|0);
   HEAP32[9930] = $93;
   HEAP32[$93>>2] = 179;
   STACKTOP = sp;return;
  }
  break;
 }
 case 5:  {
  $94 = HEAP32[9930]|0;
  $95 = HEAP32[$94>>2]|0;
  $96 = ($95|0)==(128);
  $97 = HEAP32[9930]|0;
  if ($96) {
   $98 = ((($97)) + 8|0);
   $99 = HEAP32[$98>>2]|0;
   $100 = $99&65535;
   $101 = $100&65535;
   $102 = HEAP32[9930]|0;
   $103 = ((($102)) + 8|0);
   HEAP32[$103>>2] = $101;
   STACKTOP = sp;return;
  } else {
   $104 = ((($97)) + -8|0);
   HEAP32[9930] = $104;
   HEAP32[$104>>2] = 180;
   STACKTOP = sp;return;
  }
  break;
 }
 default: {
  STACKTOP = sp;return;
 }
 }
}
function _nodc($n,$a,$b) {
 $n = $n|0;
 $a = $a|0;
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $n;
 $1 = $a;
 $2 = $b;
 $3 = $0;
 $4 = HEAP32[9930]|0;
 $5 = ((($4)) + -16|0);
 HEAP32[9930] = $5;
 HEAP32[$5>>2] = $3;
 $6 = $1;
 $7 = HEAP32[$6>>2]|0;
 $8 = $2;
 $9 = HEAP32[$8>>2]|0;
 $10 = ($7|0)<($9|0);
 if ($10) {
  $11 = $2;
  $12 = $11;
  $13 = HEAP32[9930]|0;
  $14 = ((($13)) + 4|0);
  HEAP32[$14>>2] = $12;
  $15 = $1;
  $16 = $15;
  $17 = HEAP32[9930]|0;
  $18 = ((($17)) + 8|0);
  HEAP32[$18>>2] = $16;
  STACKTOP = sp;return;
 } else {
  $19 = $1;
  $20 = $19;
  $21 = HEAP32[9930]|0;
  $22 = ((($21)) + 4|0);
  HEAP32[$22>>2] = $20;
  $23 = $2;
  $24 = $23;
  $25 = HEAP32[9930]|0;
  $26 = ((($25)) + 8|0);
  HEAP32[$26>>2] = $24;
  STACKTOP = sp;return;
 }
}
function _mul($b) {
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $b;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(128);
 do {
  if ($3) {
   $4 = HEAP32[9930]|0;
   $5 = HEAP32[$4>>2]|0;
   $6 = ($5|0)==(128);
   $7 = $0;
   $8 = ((($7)) + 8|0);
   $9 = HEAP32[$8>>2]|0;
   if ($6) {
    $10 = HEAP32[9930]|0;
    $11 = ((($10)) + 8|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = Math_imul($12, $9)|0;
    HEAP32[$11>>2] = $13;
    STACKTOP = sp;return;
   } else {
    $14 = ($9|0)==(1);
    if (!($14)) {
     break;
    }
    STACKTOP = sp;return;
   }
  }
 } while(0);
 $15 = HEAP32[9930]|0;
 $16 = HEAP32[$15>>2]|0;
 $17 = ($16|0)==(128);
 if ($17) {
  $18 = HEAP32[9930]|0;
  $19 = ((($18)) + 8|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ($20|0)==(1);
  if ($21) {
   $22 = $0;
   HEAP32[9930] = $22;
   STACKTOP = sp;return;
  }
 }
 $23 = HEAP32[9930]|0;
 $24 = $0;
 _nodc(230,$23,$24);
 STACKTOP = sp;return;
}
function _add($b) {
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $b;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(128);
 do {
  if ($3) {
   $4 = HEAP32[9930]|0;
   $5 = HEAP32[$4>>2]|0;
   $6 = ($5|0)==(128);
   if (!($6)) {
    $7 = HEAP32[9930]|0;
    $8 = HEAP32[$7>>2]|0;
    $9 = ($8|0)==(166);
    if (!($9)) {
     $10 = HEAP32[9930]|0;
     $11 = HEAP32[$10>>2]|0;
     $12 = ($11|0)==(167);
     if (!($12)) {
      $20 = $0;
      $21 = ((($20)) + 8|0);
      $22 = HEAP32[$21>>2]|0;
      $23 = ($22|0)!=(0);
      if ($23) {
       break;
      }
      STACKTOP = sp;return;
     }
    }
   }
   $13 = $0;
   $14 = ((($13)) + 8|0);
   $15 = HEAP32[$14>>2]|0;
   $16 = HEAP32[9930]|0;
   $17 = ((($16)) + 8|0);
   $18 = HEAP32[$17>>2]|0;
   $19 = (($18) + ($15))|0;
   HEAP32[$17>>2] = $19;
   STACKTOP = sp;return;
  }
 } while(0);
 $24 = HEAP32[9930]|0;
 $25 = HEAP32[$24>>2]|0;
 $26 = ($25|0)==(128);
 if ($26) {
  $27 = $0;
  $28 = HEAP32[$27>>2]|0;
  $29 = ($28|0)==(166);
  $30 = $0;
  if ($29) {
   $31 = ((($30)) + 8|0);
   $32 = HEAP32[$31>>2]|0;
   $33 = HEAP32[9930]|0;
   $34 = ((($33)) + 8|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = (($35) + ($32))|0;
   HEAP32[$34>>2] = $36;
   $37 = HEAP32[9930]|0;
   HEAP32[$37>>2] = 166;
   STACKTOP = sp;return;
  }
  $38 = HEAP32[$30>>2]|0;
  $39 = ($38|0)==(167);
  if ($39) {
   $40 = $0;
   $41 = ((($40)) + 8|0);
   $42 = HEAP32[$41>>2]|0;
   $43 = HEAP32[9930]|0;
   $44 = ((($43)) + 8|0);
   $45 = HEAP32[$44>>2]|0;
   $46 = (($45) + ($42))|0;
   HEAP32[$44>>2] = $46;
   $47 = HEAP32[9930]|0;
   HEAP32[$47>>2] = 167;
   STACKTOP = sp;return;
  }
  $48 = HEAP32[9930]|0;
  $49 = ((($48)) + 8|0);
  $50 = HEAP32[$49>>2]|0;
  $51 = ($50|0)!=(0);
  if (!($51)) {
   $52 = $0;
   HEAP32[9930] = $52;
   STACKTOP = sp;return;
  }
 }
 $53 = $0;
 $54 = HEAP32[9930]|0;
 _nodc(228,$53,$54);
 STACKTOP = sp;return;
}
function _flot($b,$t) {
 $b = $b|0;
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $b;
 $2 = $t;
 $3 = $2;
 $4 = ($3|0)==(17);
 $5 = $2;
 $6 = ($5|0)==(16);
 $or$cond = $4 | $6;
 $7 = $1;
 if ($or$cond) {
  $0 = $7;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 }
 $8 = HEAP32[$7>>2]|0;
 $9 = ($8|0)==(128);
 if ($9) {
  $10 = $1;
  HEAP32[$10>>2] = 161;
  $11 = $2;
  $12 = ($11>>>0)<(8);
  $13 = $1;
  $14 = ((($13)) + 8|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = (+($15|0));
  $17 = (+($15>>>0));
  $18 = $12 ? $16 : $17;
  $19 = $1;
  $20 = ((($19)) + 8|0);
  HEAPF64[$20>>3] = $18;
  $21 = $1;
  $0 = $21;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 } else {
  $22 = $2;
  $23 = ($22>>>0)<(8);
  $24 = $23 ? 173 : 174;
  $25 = HEAP32[9930]|0;
  $26 = ((($25)) + -8|0);
  HEAP32[9930] = $26;
  HEAP32[$26>>2] = $24;
  $27 = $1;
  $28 = $27;
  $29 = HEAP32[9930]|0;
  $30 = ((($29)) + 4|0);
  HEAP32[$30>>2] = $28;
  $31 = HEAP32[9930]|0;
  $0 = $31;
  $32 = $0;
  STACKTOP = sp;return ($32|0);
 }
 return (0)|0;
}
function _ind() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[9928]|0;
 $1 = $0 & 960;
 $2 = ($1|0)!=(0);
 $3 = HEAP32[9928]|0;
 do {
  if ($2) {
   $4 = (($3) - 64)|0;
   HEAP32[9928] = $4;
  } else {
   $5 = $3 & 32;
   $6 = ($5|0)!=(0);
   if (!($6)) {
    _err(2859);
    break;
   }
   $7 = HEAP32[1717]|0;
   $8 = HEAP32[9928]|0;
   $9 = $8 >>> 10;
   $10 = (($7) + ($9))|0;
   $11 = $10;
   $12 = HEAP32[$11>>2]|0;
   HEAP32[9928] = $12;
   $13 = HEAP32[9928]|0;
   $14 = $13 & 1023;
   $15 = ($14|0)==(32);
   if ($15) {
    return;
   }
  }
 } while(0);
 $16 = HEAP32[9928]|0;
 $17 = $16 & 1023;
 $18 = ($17|0)==(28);
 if ($18) {
  return;
 }
 $19 = HEAP32[9930]|0;
 $20 = HEAP32[$19>>2]|0;
 switch ($20|0) {
 case 167:  {
  $21 = HEAP32[9930]|0;
  HEAP32[$21>>2] = 149;
  $22 = HEAP32[9928]|0;
  $23 = HEAP32[9930]|0;
  $24 = ((($23)) + 4|0);
  HEAP32[$24>>2] = $22;
  return;
  break;
 }
 case 166:  {
  $25 = HEAP32[9930]|0;
  HEAP32[$25>>2] = 130;
  $26 = HEAP32[9928]|0;
  $27 = HEAP32[9930]|0;
  $28 = ((($27)) + 4|0);
  HEAP32[$28>>2] = $26;
  return;
  break;
 }
 default: {
  $29 = HEAP32[9930]|0;
  $30 = ((($29)) + -8|0);
  HEAP32[9930] = $30;
  HEAP32[$30>>2] = 162;
  $31 = HEAP32[9928]|0;
  $32 = HEAP32[9930]|0;
  $33 = ((($32)) + 4|0);
  HEAP32[$33>>2] = $31;
  return;
 }
 }
}
function _addr() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[9928]|0;
 $1 = (($0) + 64)|0;
 HEAP32[9928] = $1;
 $2 = HEAP32[9930]|0;
 $3 = HEAP32[$2>>2]|0;
 switch ($3|0) {
 case 149:  {
  $4 = HEAP32[9930]|0;
  HEAP32[$4>>2] = 167;
  return;
  break;
 }
 case 130:  {
  $5 = HEAP32[9930]|0;
  HEAP32[$5>>2] = 166;
  return;
  break;
 }
 case 162:  {
  $6 = HEAP32[9930]|0;
  $7 = ((($6)) + 8|0);
  HEAP32[9930] = $7;
  return;
  break;
 }
 case 166: case 167: case 168:  {
  return;
  break;
 }
 default: {
  _err(2887);
  return;
 }
 }
}
function _assign($n,$b) {
 $n = $n|0;
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $n;
 $1 = $b;
 $2 = $0;
 $3 = HEAP32[9930]|0;
 $4 = ((($3)) + -8|0);
 HEAP32[9930] = $4;
 HEAP32[$4>>2] = $2;
 $5 = $1;
 $6 = $5;
 $7 = HEAP32[9930]|0;
 $8 = ((($7)) + 4|0);
 HEAP32[$8>>2] = $6;
 $9 = HEAP32[9928]|0;
 switch ($9|0) {
 case 1:  {
  $10 = HEAP32[9930]|0;
  $11 = ((($10)) + -8|0);
  HEAP32[9930] = $11;
  HEAP32[$11>>2] = 177;
  STACKTOP = sp;return;
  break;
 }
 case 4:  {
  $12 = HEAP32[9930]|0;
  $13 = ((($12)) + -8|0);
  HEAP32[9930] = $13;
  HEAP32[$13>>2] = 178;
  STACKTOP = sp;return;
  break;
 }
 case 2:  {
  $14 = HEAP32[9930]|0;
  $15 = ((($14)) + -8|0);
  HEAP32[9930] = $15;
  HEAP32[$15>>2] = 179;
  STACKTOP = sp;return;
  break;
 }
 case 5:  {
  $16 = HEAP32[9930]|0;
  $17 = ((($16)) + -8|0);
  HEAP32[9930] = $17;
  HEAP32[$17>>2] = 180;
  STACKTOP = sp;return;
  break;
 }
 default: {
  STACKTOP = sp;return;
 }
 }
}
function _trim() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[9930]|0;
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)>=(177);
 if ($2) {
  $3 = HEAP32[9930]|0;
  $4 = HEAP32[$3>>2]|0;
  $5 = ($4|0)<=(180);
  if ($5) {
   $6 = HEAP32[9930]|0;
   $7 = ((($6)) + 8|0);
   HEAP32[9930] = $7;
  }
 }
 $8 = HEAP32[9930]|0;
 $9 = HEAP32[$8>>2]|0;
 $10 = ($9|0)==(228);
 if (!($10)) {
  return;
 }
 $11 = HEAP32[9930]|0;
 $12 = ((($11)) + 8|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = $13;
 $15 = HEAP32[$14>>2]|0;
 $16 = ($15|0)==(128);
 if (!($16)) {
  return;
 }
 $17 = HEAP32[9930]|0;
 $18 = ((($17)) + 4|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = $19;
 HEAP32[9930] = $20;
 return;
}
function _lmod($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $t;
 $2 = $1;
 switch ($2|0) {
 case 8: case 3:  {
  label = 5;
  break;
 }
 case 2:  {
  $0 = 1;
  break;
 }
 case 5:  {
  $0 = 2;
  break;
 }
 case 1:  {
  $0 = 3;
  break;
 }
 case 4:  {
  $0 = 4;
  break;
 }
 case 17:  {
  $0 = 5;
  break;
 }
 case 16:  {
  $0 = 6;
  break;
 }
 default: {
  $3 = $1;
  $4 = $3 & 960;
  $5 = ($4|0)!=(0);
  if ($5) {
   label = 5;
  } else {
   $6 = $1;
   $7 = $6 & 1023;
   $8 = ($7|0)!=(28);
   if ($8) {
    _err(3778);
    label = 5;
   } else {
    label = 5;
   }
  }
 }
 }
 if ((label|0) == 5) {
  $0 = 0;
 }
 $9 = $0;
 STACKTOP = sp;return ($9|0);
}
function _smod($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $t;
 $2 = $1;
 switch ($2|0) {
 case 8: case 3:  {
  label = 4;
  break;
 }
 case 5: case 2:  {
  $0 = 1;
  break;
 }
 case 4: case 1:  {
  $0 = 2;
  break;
 }
 case 17:  {
  $0 = 3;
  break;
 }
 case 16:  {
  $0 = 4;
  break;
 }
 default: {
  $3 = $1;
  $4 = $3 & 960;
  $5 = ($4|0)!=(0);
  if ($5) {
   label = 4;
  } else {
   _err(3778);
   label = 4;
  }
 }
 }
 if ((label|0) == 4) {
  $0 = 0;
 }
 $6 = $0;
 STACKTOP = sp;return ($6|0);
}
function _lbf($b) {
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0.0, $28 = 0.0, $29 = 0.0, $3 = 0, $30 = 0, $31 = 0.0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $d = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $b;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 switch ($2|0) {
 case 130:  {
  $3 = $0;
  $4 = ((($3)) + 4|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = (_lmod($5)|0);
  $7 = (38 + ($6))|0;
  $8 = $0;
  $9 = ((($8)) + 8|0);
  $10 = HEAP32[$9>>2]|0;
  _eml($7,$10);
  STACKTOP = sp;return;
  break;
 }
 case 149:  {
  $11 = $0;
  $12 = ((($11)) + 4|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = (_lmod($13)|0);
  $15 = (45 + ($14))|0;
  $16 = $0;
  $17 = ((($16)) + 8|0);
  $18 = HEAP32[$17>>2]|0;
  _emg($15,$18);
  STACKTOP = sp;return;
  break;
 }
 case 161:  {
  $19 = $0;
  $20 = ((($19)) + 8|0);
  $21 = +HEAPF64[$20>>3];
  $d = $21;
  $22 = $d;
  $23 = $22 * 256.0;
  $24 = (~~(($23)));
  $25 = $24 << 8;
  $26 = $25 >> 8;
  $27 = (+($26|0));
  $28 = $27 / 256.0;
  $29 = $d;
  $30 = $28 == $29;
  if ($30) {
   $31 = $d;
   $32 = $31 * 256.0;
   $33 = (~~(($32)));
   _emi(61,$33);
   STACKTOP = sp;return;
  } else {
   $34 = HEAP32[1720]|0;
   $35 = (($34) + 7)|0;
   $36 = $35 & -8;
   HEAP32[1720] = $36;
   $37 = $d;
   $38 = HEAP32[9929]|0;
   $39 = HEAP32[1720]|0;
   $40 = (($38) + ($39))|0;
   $41 = $40;
   HEAPF64[$41>>3] = $37;
   $42 = HEAP32[1720]|0;
   _emg(50,$42);
   $43 = HEAP32[1720]|0;
   $44 = (($43) + 8)|0;
   HEAP32[1720] = $44;
   STACKTOP = sp;return;
  }
  break;
 }
 default: {
  $45 = $0;
  _rv($45);
  _em(63);
  STACKTOP = sp;return;
 }
 }
}
function _opf($a) {
 $a = $a|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $b = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $0;
 $2 = ((($1)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = $3;
 $b = $4;
 $5 = $b;
 $6 = HEAP32[$5>>2]|0;
 switch ($6|0) {
 case 161: case 149: case 130:  {
  $7 = $0;
  $8 = ((($7)) + 4|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $9;
  _rv($10);
  $11 = $b;
  _lbf($11);
  STACKTOP = sp;return;
  break;
 }
 default: {
 }
 }
 $12 = $b;
 _rv($12);
 $13 = $0;
 $14 = ((($13)) + 4|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = $15;
 $0 = $16;
 $17 = HEAP32[$16>>2]|0;
 switch ($17|0) {
 case 161: case 149: case 130:  {
  _em(63);
  $18 = $0;
  _rv($18);
  STACKTOP = sp;return;
  break;
 }
 default: {
  $19 = HEAP32[1724]|0;
  $20 = (($19) - 8)|0;
  HEAP32[1724] = $20;
  _em(159);
  $21 = $0;
  _rv($21);
  _em(178);
  $22 = HEAP32[1724]|0;
  $23 = (($22) + 8)|0;
  HEAP32[1724] = $23;
  STACKTOP = sp;return;
 }
 }
}
function _opaf($a,$o,$comm) {
 $a = $a|0;
 $o = $o|0;
 $comm = $comm|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
 var $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0;
 var $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0;
 var $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0;
 var $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $b = 0, $or$cond = 0, $or$cond3 = 0, $t = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $o;
 $2 = $comm;
 $3 = $0;
 $4 = ((($3)) + 8|0);
 $b = $4;
 $5 = $0;
 $6 = ((($5)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = $7;
 $0 = $8;
 $9 = $0;
 $10 = ((($9)) + 4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ($11|0)==(16);
 if ($12) {
  $18 = 1;
 } else {
  $13 = $0;
  $14 = ((($13)) + 4|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = ($15|0)==(17);
  $18 = $16;
 }
 $17 = $18&1;
 $t = $17;
 $19 = $0;
 $20 = HEAP32[$19>>2]|0;
 switch ($20|0) {
 case 130:  {
  $21 = $2;
  $22 = ($21|0)!=(0);
  $23 = $t;
  $24 = ($23|0)!=(0);
  $or$cond = $22 & $24;
  $25 = $b;
  if ($or$cond) {
   _rv($25);
   $26 = $0;
   $27 = ((($26)) + 4|0);
   $28 = HEAP32[$27>>2]|0;
   $29 = (_lmod($28)|0);
   $30 = (38 + ($29))|0;
   $31 = $0;
   $32 = ((($31)) + 8|0);
   $33 = HEAP32[$32>>2]|0;
   _eml($30,$33);
  } else {
   _lbf($25);
   $34 = $0;
   $35 = ((($34)) + 4|0);
   $36 = HEAP32[$35>>2]|0;
   $37 = (_lmod($36)|0);
   $38 = (14 + ($37))|0;
   $39 = $0;
   $40 = ((($39)) + 8|0);
   $41 = HEAP32[$40>>2]|0;
   _eml($38,$41);
   $42 = $t;
   $43 = ($42|0)!=(0);
   if (!($43)) {
    $44 = $0;
    $45 = ((($44)) + 4|0);
    $46 = HEAP32[$45>>2]|0;
    $47 = ($46|0)<(8);
    $48 = $47 ? 146 : 147;
    _em($48);
   }
  }
  $49 = $1;
  _em($49);
  $50 = $t;
  $51 = ($50|0)!=(0);
  if (!($51)) {
   $52 = $0;
   $53 = ((($52)) + 4|0);
   $54 = HEAP32[$53>>2]|0;
   $55 = ($54|0)<(8);
   $56 = $55 ? 148 : 149;
   _em($56);
  }
  $57 = $0;
  $58 = ((($57)) + 4|0);
  $59 = HEAP32[$58>>2]|0;
  $60 = (_smod($59)|0);
  $61 = (64 + ($60))|0;
  $62 = $0;
  $63 = ((($62)) + 8|0);
  $64 = HEAP32[$63>>2]|0;
  _eml($61,$64);
  STACKTOP = sp;return;
  break;
 }
 case 149:  {
  $65 = $2;
  $66 = ($65|0)!=(0);
  $67 = $t;
  $68 = ($67|0)!=(0);
  $or$cond3 = $66 & $68;
  $69 = $b;
  if ($or$cond3) {
   _rv($69);
   $70 = $0;
   $71 = ((($70)) + 4|0);
   $72 = HEAP32[$71>>2]|0;
   $73 = (_lmod($72)|0);
   $74 = (45 + ($73))|0;
   $75 = $0;
   $76 = ((($75)) + 8|0);
   $77 = HEAP32[$76>>2]|0;
   _emg($74,$77);
  } else {
   _lbf($69);
   $78 = $0;
   $79 = ((($78)) + 4|0);
   $80 = HEAP32[$79>>2]|0;
   $81 = (_lmod($80)|0);
   $82 = (21 + ($81))|0;
   $83 = $0;
   $84 = ((($83)) + 8|0);
   $85 = HEAP32[$84>>2]|0;
   _emg($82,$85);
   $86 = $t;
   $87 = ($86|0)!=(0);
   if (!($87)) {
    $88 = $0;
    $89 = ((($88)) + 4|0);
    $90 = HEAP32[$89>>2]|0;
    $91 = ($90|0)<(8);
    $92 = $91 ? 146 : 147;
    _em($92);
   }
  }
  $93 = $1;
  _em($93);
  $94 = $t;
  $95 = ($94|0)!=(0);
  if (!($95)) {
   $96 = $0;
   $97 = ((($96)) + 4|0);
   $98 = HEAP32[$97>>2]|0;
   $99 = ($98|0)<(8);
   $100 = $99 ? 148 : 149;
   _em($100);
  }
  $101 = $0;
  $102 = ((($101)) + 4|0);
  $103 = HEAP32[$102>>2]|0;
  $104 = (_smod($103)|0);
  $105 = (69 + ($104))|0;
  $106 = $0;
  $107 = ((($106)) + 8|0);
  $108 = HEAP32[$107>>2]|0;
  _emg($105,$108);
  STACKTOP = sp;return;
  break;
 }
 case 162:  {
  $109 = $b;
  $110 = HEAP32[$109>>2]|0;
  switch ($110|0) {
  case 161: case 149: case 130:  {
   $111 = $0;
   $112 = ((($111)) + 8|0);
   _rv($112);
   $113 = $b;
   _lbf($113);
   $114 = HEAP32[1724]|0;
   $115 = (($114) - 8)|0;
   HEAP32[1724] = $115;
   break;
  }
  default: {
   $116 = $b;
   _rv($116);
   $117 = HEAP32[1724]|0;
   $118 = (($117) - 8)|0;
   HEAP32[1724] = $118;
   _em(159);
   $119 = $0;
   $120 = ((($119)) + 8|0);
   _rv($120);
   _em(178);
  }
  }
  _em(157);
  $121 = $0;
  $122 = ((($121)) + 4|0);
  $123 = HEAP32[$122>>2]|0;
  $124 = (_lmod($123)|0);
  $125 = (28 + ($124))|0;
  _em($125);
  $126 = $t;
  $127 = ($126|0)!=(0);
  if (!($127)) {
   $128 = $0;
   $129 = ((($128)) + 4|0);
   $130 = HEAP32[$129>>2]|0;
   $131 = ($130|0)<(8);
   $132 = $131 ? 146 : 147;
   _em($132);
  }
  $133 = $1;
  _em($133);
  _em(161);
  $134 = HEAP32[1724]|0;
  $135 = (($134) + 8)|0;
  HEAP32[1724] = $135;
  $136 = $t;
  $137 = ($136|0)!=(0);
  if (!($137)) {
   $138 = $0;
   $139 = ((($138)) + 4|0);
   $140 = HEAP32[$139>>2]|0;
   $141 = ($140|0)<(8);
   $142 = $141 ? 148 : 149;
   _em($142);
  }
  $143 = $0;
  $144 = ((($143)) + 4|0);
  $145 = HEAP32[$144>>2]|0;
  $146 = (_smod($145)|0);
  $147 = (74 + ($146))|0;
  _em($147);
  STACKTOP = sp;return;
  break;
 }
 default: {
  _err(2887);
  STACKTOP = sp;return;
 }
 }
}
function _lbi($i) {
 $i = $i|0;
 var $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $i;
 $1 = $0;
 $2 = $1 << 8;
 $3 = $2 >> 8;
 $4 = $0;
 $5 = ($3|0)==($4|0);
 $6 = $0;
 if ($5) {
  _emi(59,$6);
  STACKTOP = sp;return;
 } else {
  $7 = $6 >> 24;
  _emi(59,$7);
  $8 = $0;
  $9 = $8 << 8;
  $10 = $9 >> 8;
  _emi(60,$10);
  STACKTOP = sp;return;
 }
}
function _lb($b) {
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $b;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 switch ($2|0) {
 case 130:  {
  $3 = $0;
  $4 = ((($3)) + 4|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = (_lmod($5)|0);
  $7 = (38 + ($6))|0;
  $8 = $0;
  $9 = ((($8)) + 8|0);
  $10 = HEAP32[$9>>2]|0;
  _eml($7,$10);
  STACKTOP = sp;return;
  break;
 }
 case 149:  {
  $11 = $0;
  $12 = ((($11)) + 4|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = (_lmod($13)|0);
  $15 = (45 + ($14))|0;
  $16 = $0;
  $17 = ((($16)) + 8|0);
  $18 = HEAP32[$17>>2]|0;
  _emg($15,$18);
  STACKTOP = sp;return;
  break;
 }
 case 128:  {
  $19 = $0;
  $20 = ((($19)) + 8|0);
  $21 = HEAP32[$20>>2]|0;
  _lbi($21);
  STACKTOP = sp;return;
  break;
 }
 default: {
  $22 = $0;
  _rv($22);
  _em(62);
  STACKTOP = sp;return;
 }
 }
}
function _opt($a) {
 $a = $a|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $b = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $0;
 $2 = ((($1)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = $3;
 $b = $4;
 $5 = $b;
 $6 = HEAP32[$5>>2]|0;
 switch ($6|0) {
 case 128: case 149: case 130:  {
  $7 = $0;
  $8 = ((($7)) + 4|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $9;
  _rv($10);
  $11 = $b;
  _lb($11);
  STACKTOP = sp;return;
  break;
 }
 default: {
 }
 }
 $12 = $b;
 _rv($12);
 $13 = $0;
 $14 = ((($13)) + 4|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = $15;
 $0 = $16;
 $17 = HEAP32[$16>>2]|0;
 switch ($17|0) {
 case 128: case 149: case 130:  {
  _em(62);
  $18 = $0;
  _rv($18);
  STACKTOP = sp;return;
  break;
 }
 default: {
  $19 = HEAP32[1724]|0;
  $20 = (($19) - 8)|0;
  HEAP32[1724] = $20;
  _em(157);
  $21 = $0;
  _rv($21);
  _em(161);
  $22 = HEAP32[1724]|0;
  $23 = (($22) + 8)|0;
  HEAP32[1724] = $23;
  STACKTOP = sp;return;
 }
 }
}
function _opi($o,$i) {
 $o = $o|0;
 $i = $i|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $o;
 $1 = $i;
 $2 = $1;
 $3 = $2 << 8;
 $4 = $3 >> 8;
 $5 = $1;
 $6 = ($4|0)==($5|0);
 if ($6) {
  $7 = $0;
  $8 = (($7) + 1)|0;
  $9 = $1;
  _emi($8,$9);
  STACKTOP = sp;return;
 } else {
  $10 = $1;
  $11 = $10 >> 24;
  _emi(59,$11);
  $12 = $1;
  $13 = $12 << 8;
  $14 = $13 >> 8;
  _emi(60,$14);
  $15 = $0;
  _em($15);
  STACKTOP = sp;return;
 }
}
function _op($a,$o) {
 $a = $a|0;
 $o = $o|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $b = 0, $t = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $o;
 $2 = $0;
 $3 = ((($2)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = $4;
 $b = $5;
 $6 = $b;
 $7 = HEAP32[$6>>2]|0;
 switch ($7|0) {
 case 130:  {
  $8 = $0;
  $9 = ((($8)) + 4|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = $10;
  _rv($11);
  $12 = $b;
  $13 = ((($12)) + 4|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = (_lmod($14)|0);
  $t = $15;
  $16 = ($15|0)!=(0);
  if ($16) {
   $17 = $t;
   $18 = (38 + ($17))|0;
   $19 = $b;
   $20 = ((($19)) + 8|0);
   $21 = HEAP32[$20>>2]|0;
   _eml($18,$21);
   $22 = $1;
   _em($22);
   STACKTOP = sp;return;
  } else {
   $23 = $1;
   $24 = (($23) + 2)|0;
   $25 = $b;
   $26 = ((($25)) + 8|0);
   $27 = HEAP32[$26>>2]|0;
   _eml($24,$27);
   STACKTOP = sp;return;
  }
  break;
 }
 case 149:  {
  $28 = $0;
  $29 = ((($28)) + 4|0);
  $30 = HEAP32[$29>>2]|0;
  $31 = $30;
  _rv($31);
  $32 = $b;
  $33 = ((($32)) + 4|0);
  $34 = HEAP32[$33>>2]|0;
  $35 = (_lmod($34)|0);
  $36 = (45 + ($35))|0;
  $37 = $b;
  $38 = ((($37)) + 8|0);
  $39 = HEAP32[$38>>2]|0;
  _emg($36,$39);
  $40 = $1;
  _em($40);
  STACKTOP = sp;return;
  break;
 }
 case 128:  {
  $41 = $0;
  $42 = ((($41)) + 4|0);
  $43 = HEAP32[$42>>2]|0;
  $44 = $43;
  _rv($44);
  $45 = $1;
  $46 = $b;
  $47 = ((($46)) + 8|0);
  $48 = HEAP32[$47>>2]|0;
  _opi($45,$48);
  STACKTOP = sp;return;
  break;
 }
 default: {
  $49 = $b;
  _rv($49);
  $50 = $0;
  $51 = ((($50)) + 4|0);
  $52 = HEAP32[$51>>2]|0;
  $53 = $52;
  $0 = $53;
  $54 = HEAP32[$53>>2]|0;
  switch ($54|0) {
  case 128: case 149: case 130:  {
   _em(62);
   $55 = $0;
   _rv($55);
   $56 = $1;
   _em($56);
   STACKTOP = sp;return;
   break;
  }
  default: {
   $57 = HEAP32[1724]|0;
   $58 = (($57) - 8)|0;
   HEAP32[1724] = $58;
   _em(157);
   $59 = $0;
   _rv($59);
   _em(161);
   $60 = $1;
   _em($60);
   $61 = HEAP32[1724]|0;
   $62 = (($61) + 8)|0;
   HEAP32[1724] = $62;
   STACKTOP = sp;return;
  }
  }
 }
 }
}
function _opa($a,$o,$comm) {
 $a = $a|0;
 $o = $o|0;
 $comm = $comm|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0;
 var $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0;
 var $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0;
 var $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $b = 0, $t = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $o;
 $2 = $comm;
 $3 = $0;
 $4 = ((($3)) + 8|0);
 $b = $4;
 $5 = $0;
 $6 = ((($5)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = $7;
 $0 = $8;
 $9 = $0;
 $10 = HEAP32[$9>>2]|0;
 switch ($10|0) {
 case 130:  {
  $11 = $b;
  $12 = HEAP32[$11>>2]|0;
  $13 = ($12|0)==(128);
  if ($13) {
   $14 = $b;
   $15 = ((($14)) + 8|0);
   $16 = HEAP32[$15>>2]|0;
   $17 = $16 << 8;
   $18 = $17 >> 8;
   $19 = $b;
   $20 = ((($19)) + 8|0);
   $21 = HEAP32[$20>>2]|0;
   $22 = ($18|0)==($21|0);
   if ($22) {
    $23 = $0;
    $24 = ((($23)) + 4|0);
    $25 = HEAP32[$24>>2]|0;
    $26 = (_lmod($25)|0);
    $27 = (14 + ($26))|0;
    $28 = $0;
    $29 = ((($28)) + 8|0);
    $30 = HEAP32[$29>>2]|0;
    _eml($27,$30);
    $31 = $1;
    $32 = (($31) + 1)|0;
    $33 = $b;
    $34 = ((($33)) + 8|0);
    $35 = HEAP32[$34>>2]|0;
    _emi($32,$35);
   } else {
    label = 5;
   }
  } else {
   label = 5;
  }
  do {
   if ((label|0) == 5) {
    $36 = $b;
    $37 = HEAP32[$36>>2]|0;
    $38 = ($37|0)==(130);
    if ($38) {
     $39 = $b;
     $40 = ((($39)) + 4|0);
     $41 = HEAP32[$40>>2]|0;
     $42 = (_lmod($41)|0);
     $43 = ($42|0)!=(0);
     if (!($43)) {
      $44 = $0;
      $45 = ((($44)) + 4|0);
      $46 = HEAP32[$45>>2]|0;
      $47 = (_lmod($46)|0);
      $48 = (14 + ($47))|0;
      $49 = $0;
      $50 = ((($49)) + 8|0);
      $51 = HEAP32[$50>>2]|0;
      _eml($48,$51);
      $52 = $1;
      $53 = (($52) + 2)|0;
      $54 = $b;
      $55 = ((($54)) + 8|0);
      $56 = HEAP32[$55>>2]|0;
      _eml($53,$56);
      break;
     }
    }
    $57 = $2;
    $58 = ($57|0)!=(0);
    $59 = $b;
    if (!($58)) {
     _lb($59);
     $76 = $0;
     $77 = ((($76)) + 4|0);
     $78 = HEAP32[$77>>2]|0;
     $79 = (_lmod($78)|0);
     $80 = (14 + ($79))|0;
     $81 = $0;
     $82 = ((($81)) + 8|0);
     $83 = HEAP32[$82>>2]|0;
     _eml($80,$83);
     $84 = $1;
     _em($84);
     break;
    }
    _rv($59);
    $60 = $0;
    $61 = ((($60)) + 4|0);
    $62 = HEAP32[$61>>2]|0;
    $63 = (_lmod($62)|0);
    $t = $63;
    $64 = ($63|0)!=(0);
    if ($64) {
     $65 = $t;
     $66 = (38 + ($65))|0;
     $67 = $0;
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     _eml($66,$69);
     $70 = $1;
     _em($70);
     break;
    } else {
     $71 = $1;
     $72 = (($71) + 2)|0;
     $73 = $0;
     $74 = ((($73)) + 8|0);
     $75 = HEAP32[$74>>2]|0;
     _eml($72,$75);
     break;
    }
   }
  } while(0);
  $85 = $0;
  $86 = ((($85)) + 4|0);
  $87 = HEAP32[$86>>2]|0;
  $88 = (_smod($87)|0);
  $89 = (64 + ($88))|0;
  $90 = $0;
  $91 = ((($90)) + 8|0);
  $92 = HEAP32[$91>>2]|0;
  _eml($89,$92);
  STACKTOP = sp;return;
  break;
 }
 case 149:  {
  $93 = $b;
  $94 = HEAP32[$93>>2]|0;
  $95 = ($94|0)==(128);
  if ($95) {
   $96 = $b;
   $97 = ((($96)) + 8|0);
   $98 = HEAP32[$97>>2]|0;
   $99 = $98 << 8;
   $100 = $99 >> 8;
   $101 = $b;
   $102 = ((($101)) + 8|0);
   $103 = HEAP32[$102>>2]|0;
   $104 = ($100|0)==($103|0);
   if ($104) {
    $105 = $0;
    $106 = ((($105)) + 4|0);
    $107 = HEAP32[$106>>2]|0;
    $108 = (_lmod($107)|0);
    $109 = (21 + ($108))|0;
    $110 = $0;
    $111 = ((($110)) + 8|0);
    $112 = HEAP32[$111>>2]|0;
    _emg($109,$112);
    $113 = $1;
    $114 = (($113) + 1)|0;
    $115 = $b;
    $116 = ((($115)) + 8|0);
    $117 = HEAP32[$116>>2]|0;
    _emi($114,$117);
   } else {
    label = 17;
   }
  } else {
   label = 17;
  }
  do {
   if ((label|0) == 17) {
    $118 = $b;
    $119 = HEAP32[$118>>2]|0;
    $120 = ($119|0)==(130);
    if ($120) {
     $121 = $b;
     $122 = ((($121)) + 4|0);
     $123 = HEAP32[$122>>2]|0;
     $124 = (_lmod($123)|0);
     $125 = ($124|0)!=(0);
     if (!($125)) {
      $126 = $0;
      $127 = ((($126)) + 4|0);
      $128 = HEAP32[$127>>2]|0;
      $129 = (_lmod($128)|0);
      $130 = (21 + ($129))|0;
      $131 = $0;
      $132 = ((($131)) + 8|0);
      $133 = HEAP32[$132>>2]|0;
      _emg($130,$133);
      $134 = $1;
      $135 = (($134) + 2)|0;
      $136 = $b;
      $137 = ((($136)) + 8|0);
      $138 = HEAP32[$137>>2]|0;
      _eml($135,$138);
      break;
     }
    }
    $139 = $2;
    $140 = ($139|0)!=(0);
    $141 = $b;
    if ($140) {
     _rv($141);
     $142 = $0;
     $143 = ((($142)) + 4|0);
     $144 = HEAP32[$143>>2]|0;
     $145 = (_lmod($144)|0);
     $146 = (45 + ($145))|0;
     $147 = $0;
     $148 = ((($147)) + 8|0);
     $149 = HEAP32[$148>>2]|0;
     _emg($146,$149);
     $150 = $1;
     _em($150);
     break;
    } else {
     _lb($141);
     $151 = $0;
     $152 = ((($151)) + 4|0);
     $153 = HEAP32[$152>>2]|0;
     $154 = (_lmod($153)|0);
     $155 = (21 + ($154))|0;
     $156 = $0;
     $157 = ((($156)) + 8|0);
     $158 = HEAP32[$157>>2]|0;
     _emg($155,$158);
     $159 = $1;
     _em($159);
     break;
    }
   }
  } while(0);
  $160 = $0;
  $161 = ((($160)) + 4|0);
  $162 = HEAP32[$161>>2]|0;
  $163 = (_smod($162)|0);
  $164 = (69 + ($163))|0;
  $165 = $0;
  $166 = ((($165)) + 8|0);
  $167 = HEAP32[$166>>2]|0;
  _emg($164,$167);
  STACKTOP = sp;return;
  break;
 }
 case 162:  {
  $168 = $b;
  $169 = HEAP32[$168>>2]|0;
  $170 = ($169|0)==(128);
  if ($170) {
   $171 = $b;
   $172 = ((($171)) + 8|0);
   $173 = HEAP32[$172>>2]|0;
   $174 = $173 << 8;
   $175 = $174 >> 8;
   $176 = $b;
   $177 = ((($176)) + 8|0);
   $178 = HEAP32[$177>>2]|0;
   $179 = ($175|0)==($178|0);
   if ($179) {
    $180 = $0;
    $181 = ((($180)) + 8|0);
    _rv($181);
    _em(62);
    $182 = $0;
    $183 = ((($182)) + 4|0);
    $184 = HEAP32[$183>>2]|0;
    $185 = (_lmod($184)|0);
    $186 = (28 + ($185))|0;
    _em($186);
    $187 = $1;
    $188 = (($187) + 1)|0;
    $189 = $b;
    $190 = ((($189)) + 8|0);
    $191 = HEAP32[$190>>2]|0;
    _emi($188,$191);
   } else {
    label = 27;
   }
  } else {
   label = 27;
  }
  L41: do {
   if ((label|0) == 27) {
    $192 = $b;
    $193 = HEAP32[$192>>2]|0;
    $194 = ($193|0)==(130);
    if ($194) {
     $195 = $b;
     $196 = ((($195)) + 4|0);
     $197 = HEAP32[$196>>2]|0;
     $198 = (_lmod($197)|0);
     $199 = ($198|0)!=(0);
     if (!($199)) {
      $200 = $0;
      $201 = ((($200)) + 8|0);
      _rv($201);
      _em(62);
      $202 = $0;
      $203 = ((($202)) + 4|0);
      $204 = HEAP32[$203>>2]|0;
      $205 = (_lmod($204)|0);
      $206 = (28 + ($205))|0;
      _em($206);
      $207 = $1;
      $208 = (($207) + 2)|0;
      $209 = $b;
      $210 = ((($209)) + 8|0);
      $211 = HEAP32[$210>>2]|0;
      _eml($208,$211);
      break;
     }
    }
    $212 = $b;
    $213 = HEAP32[$212>>2]|0;
    switch ($213|0) {
    case 128: case 149: case 130:  {
     $214 = $0;
     $215 = ((($214)) + 8|0);
     _rv($215);
     $216 = $b;
     _lb($216);
     $217 = HEAP32[1724]|0;
     $218 = (($217) - 8)|0;
     HEAP32[1724] = $218;
     _em(157);
     $219 = $0;
     $220 = ((($219)) + 4|0);
     $221 = HEAP32[$220>>2]|0;
     $222 = (_lmod($221)|0);
     $223 = (28 + ($222))|0;
     _em($223);
     $224 = $1;
     _em($224);
     _em(161);
     $225 = HEAP32[1724]|0;
     $226 = (($225) + 8)|0;
     HEAP32[1724] = $226;
     break L41;
     break;
    }
    default: {
     $227 = $b;
     _rv($227);
     $228 = HEAP32[1724]|0;
     $229 = (($228) - 8)|0;
     HEAP32[1724] = $229;
     _em(157);
     $230 = $0;
     $231 = ((($230)) + 8|0);
     _rv($231);
     _em(62);
     $232 = $0;
     $233 = ((($232)) + 4|0);
     $234 = HEAP32[$233>>2]|0;
     $235 = (_lmod($234)|0);
     $236 = (28 + ($235))|0;
     _em($236);
     $237 = $1;
     $238 = (($237) + 2)|0;
     _em($238);
     _emi(1,8);
     $239 = HEAP32[1724]|0;
     $240 = (($239) + 8)|0;
     HEAP32[1724] = $240;
     break L41;
    }
    }
   }
  } while(0);
  $241 = $0;
  $242 = ((($241)) + 4|0);
  $243 = HEAP32[$242>>2]|0;
  $244 = (_smod($243)|0);
  $245 = (74 + ($244))|0;
  _em($245);
  STACKTOP = sp;return;
  break;
 }
 default: {
  _err(2887);
  STACKTOP = sp;return;
 }
 }
}
function _test($a,$t) {
 $a = $a|0;
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0.0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $9 = 0, $b = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $a;
 $2 = $t;
 $3 = $1;
 $4 = HEAP32[$3>>2]|0;
 L1: do {
  switch ($4|0) {
  case 220:  {
   $5 = $1;
   _opt($5);
   $6 = $2;
   $7 = (_emf(136,$6)|0);
   $0 = $7;
   break;
  }
  case 221:  {
   $8 = $1;
   _opt($8);
   $9 = $2;
   $10 = (_emf(138,$9)|0);
   $0 = $10;
   break;
  }
  case 222:  {
   $11 = $1;
   _opt($11);
   $12 = $2;
   $13 = (_emf(140,$12)|0);
   $0 = $13;
   break;
  }
  case 225:  {
   $14 = $1;
   _opt($14);
   $15 = $2;
   $16 = (_emf(143,$15)|0);
   $0 = $16;
   break;
  }
  case 191:  {
   $17 = $1;
   _opt($17);
   $18 = $2;
   $19 = (_emf(141,$18)|0);
   $0 = $19;
   break;
  }
  case 193:  {
   $20 = $1;
   _opt($20);
   $21 = $2;
   $22 = (_emf(144,$21)|0);
   $0 = $22;
   break;
  }
  case 189:  {
   $23 = $1;
   _opf($23);
   $24 = $2;
   $25 = (_emf(137,$24)|0);
   $0 = $25;
   break;
  }
  case 190:  {
   $26 = $1;
   _opf($26);
   $27 = $2;
   $28 = (_emf(139,$27)|0);
   $0 = $28;
   break;
  }
  case 192:  {
   $29 = $1;
   _opf($29);
   $30 = $2;
   $31 = (_emf(142,$30)|0);
   $0 = $31;
   break;
  }
  case 194:  {
   $32 = $1;
   _opf($32);
   $33 = $2;
   $34 = (_emf(145,$33)|0);
   $0 = $34;
   break;
  }
  case 215:  {
   $35 = $1;
   $36 = ((($35)) + 8|0);
   $37 = $1;
   $38 = ((($37)) + 4|0);
   $39 = HEAP32[$38>>2]|0;
   $40 = $39;
   $41 = $2;
   $42 = (_test($40,$41)|0);
   $43 = (_test($36,$42)|0);
   $0 = $43;
   break;
  }
  case 216:  {
   $44 = $1;
   $45 = ((($44)) + 4|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = $46;
   $48 = (_testnot($47,0)|0);
   $b = $48;
   $49 = $1;
   $50 = ((($49)) + 8|0);
   $51 = $2;
   $52 = (_test($50,$51)|0);
   $2 = $52;
   $53 = $b;
   $54 = HEAP32[1712]|0;
   _patch($53,$54);
   $55 = $2;
   $0 = $55;
   break;
  }
  case 163:  {
   $56 = $1;
   $57 = ((($56)) + 8|0);
   $58 = $2;
   $59 = (_testnot($57,$58)|0);
   $0 = $59;
   break;
  }
  case 164:  {
   $60 = $1;
   $61 = ((($60)) + 8|0);
   _rv($61);
   $62 = $2;
   $63 = (_emf(133,$62)|0);
   $0 = $63;
   break;
  }
  case 165:  {
   $64 = $1;
   $65 = ((($64)) + 8|0);
   _rv($65);
   $66 = $2;
   $67 = (_emf(135,$66)|0);
   $0 = $67;
   break;
  }
  case 128:  {
   $68 = $1;
   $69 = ((($68)) + 8|0);
   $70 = HEAP32[$69>>2]|0;
   $71 = ($70|0)!=(0);
   $72 = $2;
   if ($71) {
    $73 = (_emf(3,$72)|0);
    $0 = $73;
    break L1;
   } else {
    $0 = $72;
    break L1;
   }
   break;
  }
  case 161:  {
   $74 = $1;
   $75 = ((($74)) + 8|0);
   $76 = +HEAPF64[$75>>3];
   $77 = $76 != 0.0;
   $78 = $2;
   if ($77) {
    $79 = (_emf(3,$78)|0);
    $0 = $79;
    break L1;
   } else {
    $0 = $78;
    break L1;
   }
   break;
  }
  default: {
   $80 = $1;
   _rv($80);
   $81 = $2;
   $82 = (_emf(134,$81)|0);
   $0 = $82;
  }
  }
 } while(0);
 $83 = $0;
 STACKTOP = sp;return ($83|0);
}
function _testnot($a,$t) {
 $a = $a|0;
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0.0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $9 = 0, $b = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $a;
 $2 = $t;
 $3 = $1;
 $4 = HEAP32[$3>>2]|0;
 L1: do {
  switch ($4|0) {
  case 220:  {
   $5 = $1;
   _opt($5);
   $6 = $2;
   $7 = (_emf(138,$6)|0);
   $0 = $7;
   break;
  }
  case 221:  {
   $8 = $1;
   _opt($8);
   $9 = $2;
   $10 = (_emf(136,$9)|0);
   $0 = $10;
   break;
  }
  case 222:  {
   $11 = $1;
   _opt($11);
   $12 = $2;
   $13 = (_emf(143,$12)|0);
   $0 = $13;
   break;
  }
  case 225:  {
   $14 = $1;
   _opt($14);
   $15 = $2;
   $16 = (_emf(140,$15)|0);
   $0 = $16;
   break;
  }
  case 191:  {
   $17 = $1;
   _opt($17);
   $18 = $2;
   $19 = (_emf(144,$18)|0);
   $0 = $19;
   break;
  }
  case 193:  {
   $20 = $1;
   _opt($20);
   $21 = $2;
   $22 = (_emf(141,$21)|0);
   $0 = $22;
   break;
  }
  case 189:  {
   $23 = $1;
   _opf($23);
   $24 = $2;
   $25 = (_emf(139,$24)|0);
   $0 = $25;
   break;
  }
  case 190:  {
   $26 = $1;
   _opf($26);
   $27 = $2;
   $28 = (_emf(137,$27)|0);
   $0 = $28;
   break;
  }
  case 192:  {
   $29 = $1;
   _opf($29);
   $30 = $2;
   $31 = (_emf(145,$30)|0);
   $0 = $31;
   break;
  }
  case 194:  {
   $32 = $1;
   _opf($32);
   $33 = $2;
   $34 = (_emf(142,$33)|0);
   $0 = $34;
   break;
  }
  case 215:  {
   $35 = $1;
   $36 = ((($35)) + 4|0);
   $37 = HEAP32[$36>>2]|0;
   $38 = $37;
   $39 = (_test($38,0)|0);
   $b = $39;
   $40 = $1;
   $41 = ((($40)) + 8|0);
   $42 = $2;
   $43 = (_testnot($41,$42)|0);
   $2 = $43;
   $44 = $b;
   $45 = HEAP32[1712]|0;
   _patch($44,$45);
   $46 = $2;
   $0 = $46;
   break;
  }
  case 216:  {
   $47 = $1;
   $48 = ((($47)) + 8|0);
   $49 = $1;
   $50 = ((($49)) + 4|0);
   $51 = HEAP32[$50>>2]|0;
   $52 = $51;
   $53 = $2;
   $54 = (_testnot($52,$53)|0);
   $55 = (_testnot($48,$54)|0);
   $0 = $55;
   break;
  }
  case 163:  {
   $56 = $1;
   $57 = ((($56)) + 8|0);
   $58 = $2;
   $59 = (_test($57,$58)|0);
   $0 = $59;
   break;
  }
  case 164:  {
   $60 = $1;
   $61 = ((($60)) + 8|0);
   _rv($61);
   $62 = $2;
   $63 = (_emf(135,$62)|0);
   $0 = $63;
   break;
  }
  case 165:  {
   $64 = $1;
   $65 = ((($64)) + 8|0);
   _rv($65);
   $66 = $2;
   $67 = (_emf(133,$66)|0);
   $0 = $67;
   break;
  }
  case 128:  {
   $68 = $1;
   $69 = ((($68)) + 8|0);
   $70 = HEAP32[$69>>2]|0;
   $71 = ($70|0)!=(0);
   $72 = $2;
   if ($71) {
    $0 = $72;
    break L1;
   } else {
    $73 = (_emf(3,$72)|0);
    $0 = $73;
    break L1;
   }
   break;
  }
  case 161:  {
   $74 = $1;
   $75 = ((($74)) + 8|0);
   $76 = +HEAPF64[$75>>3];
   $77 = $76 != 0.0;
   $78 = $2;
   if ($77) {
    $0 = $78;
    break L1;
   } else {
    $79 = (_emf(3,$78)|0);
    $0 = $79;
    break L1;
   }
   break;
  }
  default: {
   $80 = $1;
   _rv($80);
   $81 = $2;
   $82 = (_emf(132,$81)|0);
   $0 = $82;
  }
  }
 } while(0);
 $83 = $0;
 STACKTOP = sp;return ($83|0);
}
function _stmt() {
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0;
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0;
 var $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0;
 var $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0;
 var $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0;
 var $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $a = 0, $b = 0, $c = 0, $cmax = 0, $cmin = 0, $d = 0, $es = 0, $et = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $or$cond7 = 0, $or$cond9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = HEAP32[9923]|0;
 L1: do {
  switch ($0|0) {
  case 143:  {
   _next();
   _skip(238);
   $1 = HEAP32[9930]|0;
   $es = $1;
   _expr(202);
   $2 = HEAP32[9928]|0;
   $3 = ($2|0)==(17);
   $4 = HEAP32[9928]|0;
   $5 = ($4|0)==(16);
   $or$cond = $3 | $5;
   if ($or$cond) {
    $6 = HEAP32[9930]|0;
    $7 = ((($6)) + -8|0);
    HEAP32[9930] = $7;
    HEAP32[$7>>2] = 165;
   }
   $8 = HEAP32[9930]|0;
   $9 = (_testnot($8,0)|0);
   $a = $9;
   $10 = $es;
   HEAP32[9930] = $10;
   _skip(41);
   _stmt();
   $11 = HEAP32[9923]|0;
   $12 = ($11|0)==(138);
   if ($12) {
    _next();
    $13 = (_emf(3,0)|0);
    $b = $13;
    $14 = $a;
    $15 = HEAP32[1712]|0;
    _patch($14,$15);
    _stmt();
    $16 = $b;
    $a = $16;
   }
   $17 = $a;
   $18 = HEAP32[1712]|0;
   _patch($17,$18);
   STACKTOP = sp;return;
   break;
  }
  case 156:  {
   $19 = HEAP32[9935]|0;
   $b = $19;
   HEAP32[9935] = 0;
   $20 = HEAP32[9936]|0;
   $c = $20;
   $21 = (_emf(3,0)|0);
   HEAP32[9936] = $21;
   $22 = HEAP32[1712]|0;
   $a = $22;
   $23 = HEAP32[9930]|0;
   $es = $23;
   _next();
   _skip(238);
   _expr(202);
   $24 = HEAP32[9928]|0;
   $25 = ($24|0)==(17);
   $26 = HEAP32[9928]|0;
   $27 = ($26|0)==(16);
   $or$cond3 = $25 | $27;
   if ($or$cond3) {
    $28 = HEAP32[9930]|0;
    $29 = ((($28)) + -8|0);
    HEAP32[9930] = $29;
    HEAP32[$29>>2] = 165;
   }
   _skip(41);
   _stmt();
   $30 = HEAP32[9936]|0;
   $31 = HEAP32[1712]|0;
   _patch($30,$31);
   $32 = $c;
   HEAP32[9936] = $32;
   $33 = HEAP32[9930]|0;
   $34 = (_test($33,0)|0);
   $35 = $a;
   _patch($34,$35);
   $36 = $es;
   HEAP32[9930] = $36;
   $37 = HEAP32[9935]|0;
   $38 = HEAP32[1712]|0;
   _patch($37,$38);
   $39 = $b;
   HEAP32[9935] = $39;
   STACKTOP = sp;return;
   break;
  }
  case 146:  {
   _next();
   $40 = HEAP32[9923]|0;
   $41 = ($40|0)!=(59);
   if ($41) {
    $42 = HEAP32[9930]|0;
    $es = $42;
    _expr(202);
    $43 = HEAP32[9932]|0;
    _cast($43);
    $44 = HEAP32[9930]|0;
    _rv($44);
    $45 = $es;
    HEAP32[9930] = $45;
   }
   $46 = HEAP32[1724]|0;
   $47 = (0 - ($46))|0;
   _emi(2,$47);
   _skip(59);
   STACKTOP = sp;return;
   break;
  }
  case 131:  {
   $48 = HEAP32[9935]|0;
   $49 = (_emf(3,$48)|0);
   HEAP32[9935] = $49;
   _next();
   _skip(59);
   STACKTOP = sp;return;
   break;
  }
  case 134:  {
   $50 = HEAP32[9936]|0;
   $51 = (_emf(3,$50)|0);
   HEAP32[9936] = $51;
   _next();
   _skip(59);
   STACKTOP = sp;return;
   break;
  }
  case 141:  {
   _next();
   _skip(238);
   $52 = HEAP32[9923]|0;
   $53 = ($52|0)!=(59);
   if ($53) {
    $54 = HEAP32[9930]|0;
    $es = $54;
    _expr(202);
    _trim();
    $55 = HEAP32[9930]|0;
    _rv($55);
    $56 = $es;
    HEAP32[9930] = $56;
   }
   _skip(59);
   $et = 0;
   $es = 0;
   $57 = HEAP32[9923]|0;
   $58 = ($57|0)!=(59);
   if ($58) {
    $59 = HEAP32[9930]|0;
    $es = $59;
    _expr(202);
    $60 = HEAP32[9928]|0;
    $61 = ($60|0)==(17);
    $62 = HEAP32[9928]|0;
    $63 = ($62|0)==(16);
    $or$cond5 = $61 | $63;
    if ($or$cond5) {
     $64 = HEAP32[9930]|0;
     $65 = ((($64)) + -8|0);
     HEAP32[9930] = $65;
     HEAP32[$65>>2] = 165;
    }
   }
   _skip(59);
   $66 = HEAP32[9923]|0;
   $67 = ($66|0)!=(41);
   if ($67) {
    $68 = HEAP32[9930]|0;
    $et = $68;
    _expr(202);
   }
   _skip(41);
   $69 = $es;
   $70 = ($69|0)!=(0|0);
   if ($70) {
    $71 = (_emf(3,0)|0);
    $d = $71;
   }
   $72 = HEAP32[1712]|0;
   $a = $72;
   $73 = HEAP32[9935]|0;
   $b = $73;
   HEAP32[9935] = 0;
   $74 = HEAP32[9936]|0;
   $c = $74;
   HEAP32[9936] = 0;
   _stmt();
   $75 = HEAP32[9936]|0;
   $76 = $es;
   $77 = ($76|0)!=(0|0);
   $78 = $et;
   $79 = ($78|0)!=(0|0);
   $or$cond7 = $77 | $79;
   $80 = HEAP32[1712]|0;
   $81 = $a;
   $82 = $or$cond7 ? $80 : $81;
   _patch($75,$82);
   $83 = $c;
   HEAP32[9936] = $83;
   $84 = $et;
   $85 = ($84|0)!=(0|0);
   if ($85) {
    _trim();
    $86 = HEAP32[9930]|0;
    _rv($86);
    $87 = $et;
    HEAP32[9930] = $87;
   }
   $88 = $es;
   $89 = ($88|0)!=(0|0);
   if ($89) {
    $90 = $d;
    $91 = HEAP32[1712]|0;
    _patch($90,$91);
    $92 = HEAP32[9930]|0;
    $93 = (_test($92,0)|0);
    $94 = $a;
    _patch($93,$94);
    $95 = $es;
    HEAP32[9930] = $95;
   } else {
    $96 = $a;
    _emj(3,$96);
   }
   $97 = HEAP32[9935]|0;
   $98 = HEAP32[1712]|0;
   _patch($97,$98);
   $99 = $b;
   HEAP32[9935] = $99;
   STACKTOP = sp;return;
   break;
  }
  case 136:  {
   _next();
   $100 = HEAP32[9935]|0;
   $b = $100;
   HEAP32[9935] = 0;
   $101 = HEAP32[9936]|0;
   $c = $101;
   HEAP32[9936] = 0;
   $102 = HEAP32[1712]|0;
   $a = $102;
   _stmt();
   $103 = HEAP32[9936]|0;
   $104 = HEAP32[1712]|0;
   _patch($103,$104);
   $105 = $c;
   HEAP32[9936] = $105;
   _skip(156);
   _skip(238);
   $106 = HEAP32[9930]|0;
   $es = $106;
   _expr(202);
   $107 = HEAP32[9928]|0;
   $108 = ($107|0)==(17);
   $109 = HEAP32[9928]|0;
   $110 = ($109|0)==(16);
   $or$cond9 = $108 | $110;
   if ($or$cond9) {
    $111 = HEAP32[9930]|0;
    $112 = ((($111)) + -8|0);
    HEAP32[9930] = $112;
    HEAP32[$112>>2] = 165;
   }
   $113 = HEAP32[9930]|0;
   $114 = (_test($113,0)|0);
   $115 = $a;
   _patch($114,$115);
   $116 = $es;
   HEAP32[9930] = $116;
   _skip(41);
   _skip(59);
   $117 = HEAP32[9935]|0;
   $118 = HEAP32[1712]|0;
   _patch($117,$118);
   $119 = $b;
   HEAP32[9935] = $119;
   STACKTOP = sp;return;
   break;
  }
  case 151:  {
   _next();
   _skip(238);
   $120 = HEAP32[9930]|0;
   $es = $120;
   _expr(202);
   $121 = HEAP32[9930]|0;
   _rv($121);
   $122 = $es;
   HEAP32[9930] = $122;
   $123 = (_emf(3,0)|0);
   $a = $123;
   _skip(41);
   $124 = HEAP32[9935]|0;
   $b = $124;
   HEAP32[9935] = 0;
   $125 = HEAP32[9937]|0;
   $d = $125;
   HEAP32[9937] = 0;
   $126 = HEAP32[9930]|0;
   $es = $126;
   _stmt();
   $127 = HEAP32[9935]|0;
   $128 = (_emf(3,$127)|0);
   HEAP32[9935] = $128;
   $129 = $a;
   $130 = HEAP32[1712]|0;
   _patch($129,$130);
   $131 = $es;
   $132 = HEAP32[9930]|0;
   $133 = ($131|0)==($132|0);
   do {
    if ($133) {
     $134 = HEAP32[9937]|0;
     $135 = ($134|0)!=(0);
     if ($135) {
      $136 = HEAP32[9937]|0;
      _emj(3,$136);
     }
    } else {
     $137 = $es;
     $138 = ((($137)) + -8|0);
     $et = $138;
     $139 = HEAP32[$138>>2]|0;
     $cmax = $139;
     $cmin = $139;
     while(1) {
      $140 = $et;
      $141 = HEAP32[9930]|0;
      $142 = ($140>>>0)>($141>>>0);
      if (!($142)) {
       break;
      }
      $143 = $et;
      $144 = ((($143)) + -8|0);
      $et = $144;
      $145 = $et;
      $146 = HEAP32[$145>>2]|0;
      $c = $146;
      $147 = $cmax;
      $148 = ($146|0)>($147|0);
      $149 = $c;
      if ($148) {
       $cmax = $149;
       continue;
      }
      $150 = $cmin;
      $151 = ($149|0)<($150|0);
      if (!($151)) {
       continue;
      }
      $152 = $c;
      $cmin = $152;
     }
     $153 = $es;
     $et = $153;
     $154 = $cmax;
     $155 = $cmin;
     $156 = (($154) - ($155))|0;
     $157 = $es;
     $158 = $157;
     $159 = HEAP32[9930]|0;
     $160 = $159;
     $161 = (($158) - ($160))|0;
     $162 = $161<<1;
     $163 = ($156>>>0)<=($162>>>0);
     if (!($163)) {
      while(1) {
       $228 = $et;
       $229 = HEAP32[9930]|0;
       $230 = ($228>>>0)>($229>>>0);
       if (!($230)) {
        break;
       }
       $231 = $et;
       $232 = ((($231)) + -8|0);
       $et = $232;
       $233 = $et;
       $234 = HEAP32[$233>>2]|0;
       _lbi($234);
       $235 = $et;
       $236 = ((($235)) + 4|0);
       $237 = HEAP32[$236>>2]|0;
       _emj(136,$237);
      }
      $238 = HEAP32[9937]|0;
      $239 = ($238|0)!=(0);
      if (!($239)) {
       break;
      }
      $240 = HEAP32[9937]|0;
      _emj(3,$240);
      break;
     }
     $164 = $cmin;
     $165 = ($164|0)>(0);
     if ($165) {
      $166 = $cmax;
      $167 = $es;
      $168 = $167;
      $169 = HEAP32[9930]|0;
      $170 = $169;
      $171 = (($168) - ($170))|0;
      $172 = ($166|0)<=($171|0);
      if ($172) {
       $cmin = 0;
      } else {
       label = 46;
      }
     } else {
      label = 46;
     }
     if ((label|0) == 46) {
      $173 = $cmin;
      $174 = ($173|0)!=(0);
      if ($174) {
       $175 = $cmin;
       _opi(86,$175);
       $176 = $cmin;
       $177 = $cmax;
       $178 = (($177) - ($176))|0;
       $cmax = $178;
      }
     }
     $179 = $cmax;
     $180 = (($179) + 1)|0;
     $cmax = $180;
     _lbi($180);
     $181 = HEAP32[1720]|0;
     $182 = (($181) + 3)|0;
     $183 = $182 & -4;
     HEAP32[1720] = $183;
     $184 = HEAP32[9937]|0;
     $185 = ($184|0)!=(0);
     if ($185) {
      $186 = HEAP32[9937]|0;
      _emj(144,$186);
      $187 = HEAP32[1720]|0;
      _emg(4,$187);
      $188 = HEAP32[1712]|0;
      $189 = HEAP32[9937]|0;
      $190 = (($189) - ($188))|0;
      HEAP32[9937] = $190;
     } else {
      $191 = HEAP32[9935]|0;
      $192 = (_emf(144,$191)|0);
      HEAP32[9935] = $192;
      $193 = HEAP32[1720]|0;
      _emg(4,$193);
     }
     $c = 0;
     while(1) {
      $194 = $c;
      $195 = $cmax;
      $196 = ($194|0)<($195|0);
      if (!($196)) {
       break;
      }
      $197 = HEAP32[9937]|0;
      $198 = $c;
      $199 = (($198) + 1)|0;
      $c = $199;
      $200 = HEAP32[9929]|0;
      $201 = HEAP32[1720]|0;
      $202 = (($200) + ($201))|0;
      $203 = $202;
      $204 = (($203) + ($198<<2)|0);
      HEAP32[$204>>2] = $197;
     }
     while(1) {
      $205 = $et;
      $206 = HEAP32[9930]|0;
      $207 = ($205>>>0)>($206>>>0);
      if (!($207)) {
       break;
      }
      $208 = $et;
      $209 = ((($208)) + -8|0);
      $et = $209;
      $210 = $et;
      $211 = ((($210)) + 4|0);
      $212 = HEAP32[$211>>2]|0;
      $213 = HEAP32[1712]|0;
      $214 = (($212) - ($213))|0;
      $215 = $et;
      $216 = HEAP32[$215>>2]|0;
      $217 = $cmin;
      $218 = (($216) - ($217))|0;
      $219 = HEAP32[9929]|0;
      $220 = HEAP32[1720]|0;
      $221 = (($219) + ($220))|0;
      $222 = $221;
      $223 = (($222) + ($218<<2)|0);
      HEAP32[$223>>2] = $214;
     }
     $224 = $cmax;
     $225 = $224<<2;
     $226 = HEAP32[1720]|0;
     $227 = (($226) + ($225))|0;
     HEAP32[1720] = $227;
    }
   } while(0);
   $241 = $d;
   HEAP32[9937] = $241;
   $242 = $es;
   HEAP32[9930] = $242;
   $243 = HEAP32[9935]|0;
   $244 = HEAP32[1712]|0;
   _patch($243,$244);
   $245 = $b;
   HEAP32[9935] = $245;
   STACKTOP = sp;return;
   break;
  }
  case 132:  {
   _next();
   $246 = (_imm()|0);
   $247 = HEAP32[9930]|0;
   $248 = ((($247)) + -8|0);
   HEAP32[9930] = $248;
   HEAP32[$248>>2] = $246;
   $a = $246;
   $249 = HEAP32[1712]|0;
   $250 = HEAP32[9930]|0;
   $251 = ((($250)) + 4|0);
   HEAP32[$251>>2] = $249;
   $252 = HEAP32[9923]|0;
   $253 = ($252|0)==(181);
   L92: do {
    if ($253) {
     _next();
     $254 = (_imm()|0);
     $b = $254;
     while(1) {
      $255 = $a;
      $256 = $b;
      $257 = ($255|0)<($256|0);
      if (!($257)) {
       break L92;
      }
      $258 = $a;
      $259 = (($258) + 1)|0;
      $a = $259;
      $260 = HEAP32[9930]|0;
      $261 = ((($260)) + -8|0);
      HEAP32[9930] = $261;
      HEAP32[$261>>2] = $259;
      $262 = HEAP32[1712]|0;
      $263 = HEAP32[9930]|0;
      $264 = ((($263)) + 4|0);
      HEAP32[$264>>2] = $262;
     }
    }
   } while(0);
   _skip(58);
   _stmt();
   STACKTOP = sp;return;
   break;
  }
  case 129:  {
   _next();
   _skip(238);
   $265 = (_imm()|0);
   $a = $265;
   $266 = HEAP32[9923]|0;
   $267 = ($266|0)==(202);
   if ($267) {
    _next();
    $268 = $a;
    $269 = (_imm()|0);
    _emi($268,$269);
   } else {
    $270 = $a;
    _em($270);
   }
   _skip(41);
   _skip(59);
   STACKTOP = sp;return;
   break;
  }
  case 158:  {
   _next();
   _skip(238);
   $271 = HEAP32[9930]|0;
   $es = $271;
   _expr(203);
   $272 = HEAP32[9930]|0;
   $273 = $272;
   $b = $273;
   _skip(202);
   _expr(203);
   _addr();
   $274 = HEAP32[9930]|0;
   $275 = ((($274)) + -8|0);
   HEAP32[9930] = $275;
   HEAP32[$275>>2] = 203;
   $276 = $b;
   $277 = HEAP32[9930]|0;
   $278 = ((($277)) + 4|0);
   HEAP32[$278>>2] = $276;
   $279 = HEAP32[9930]|0;
   _rv($279);
   $280 = $es;
   HEAP32[9930] = $280;
   _skip(41);
   _skip(59);
   STACKTOP = sp;return;
   break;
  }
  case 135:  {
   _next();
   _skip(58);
   $281 = HEAP32[1712]|0;
   HEAP32[9937] = $281;
   _stmt();
   STACKTOP = sp;return;
   break;
  }
  case 142:  {
   _next();
   $282 = HEAP32[9923]|0;
   $283 = ($282|0)==(160);
   do {
    if ($283) {
     $284 = HEAP32[9925]|0;
     $285 = HEAP32[$284>>2]|0;
     $286 = ($285|0)!=(0);
     if (!($286)) {
      $287 = HEAP32[1718]|0;
      HEAP32[$287>>2] = 0;
      $288 = HEAP32[9925]|0;
      $289 = HEAP32[1718]|0;
      $290 = ((($289)) + 12|0);
      HEAP32[$290>>2] = $288;
      $291 = HEAP32[1718]|0;
      $292 = ((($291)) + 16|0);
      HEAP32[1718] = $292;
      $293 = HEAP32[9925]|0;
      HEAP32[$293>>2] = 172;
      $294 = (_emf(3,0)|0);
      $295 = HEAP32[9925]|0;
      $296 = ((($295)) + 8|0);
      HEAP32[$296>>2] = $294;
      break;
     }
     $297 = HEAP32[9925]|0;
     $298 = HEAP32[$297>>2]|0;
     $299 = ($298|0)==(172);
     $300 = HEAP32[9925]|0;
     if ($299) {
      $301 = ((($300)) + 8|0);
      $302 = HEAP32[$301>>2]|0;
      $303 = (_emf(3,$302)|0);
      $304 = HEAP32[9925]|0;
      $305 = ((($304)) + 8|0);
      HEAP32[$305>>2] = $303;
      break;
     }
     $306 = HEAP32[$300>>2]|0;
     $307 = ($306|0)==(171);
     if ($307) {
      $308 = HEAP32[9925]|0;
      $309 = ((($308)) + 8|0);
      $310 = HEAP32[$309>>2]|0;
      _emj(3,$310);
      break;
     } else {
      _err(3845);
      break;
     }
    } else {
     _err(3860);
    }
   } while(0);
   _next();
   _skip(59);
   STACKTOP = sp;return;
   break;
  }
  case 123:  {
   _next();
   while(1) {
    $311 = HEAP32[9923]|0;
    $312 = ($311|0)!=(125);
    if (!($312)) {
     label = 86;
     break L1;
    }
    _stmt();
   }
   break;
  }
  case 59:  {
   label = 86;
   break;
  }
  case 160:  {
   $313 = HEAP32[1727]|0;
   $314 = HEAP8[$313>>0]|0;
   $315 = $314 << 24 >> 24;
   $316 = ($315|0)==(58);
   if ($316) {
    $317 = HEAP32[1727]|0;
    $318 = ((($317)) + 1|0);
    HEAP32[1727] = $318;
    $319 = HEAP32[9925]|0;
    $320 = HEAP32[$319>>2]|0;
    $321 = ($320|0)!=(0);
    do {
     if ($321) {
      $332 = HEAP32[9925]|0;
      $333 = HEAP32[$332>>2]|0;
      $334 = ($333|0)==(172);
      if ($334) {
       $335 = HEAP32[9925]|0;
       $336 = ((($335)) + 8|0);
       $337 = HEAP32[$336>>2]|0;
       $338 = HEAP32[1712]|0;
       _patch($337,$338);
       $339 = HEAP32[9925]|0;
       HEAP32[$339>>2] = 171;
       $340 = HEAP32[1712]|0;
       $341 = HEAP32[9925]|0;
       $342 = ((($341)) + 8|0);
       HEAP32[$342>>2] = $340;
       break;
      } else {
       _err(3845);
       break;
      }
     } else {
      $322 = HEAP32[1718]|0;
      HEAP32[$322>>2] = 0;
      $323 = HEAP32[9925]|0;
      $324 = HEAP32[1718]|0;
      $325 = ((($324)) + 12|0);
      HEAP32[$325>>2] = $323;
      $326 = HEAP32[1718]|0;
      $327 = ((($326)) + 16|0);
      HEAP32[1718] = $327;
      $328 = HEAP32[9925]|0;
      HEAP32[$328>>2] = 171;
      $329 = HEAP32[1712]|0;
      $330 = HEAP32[9925]|0;
      $331 = ((($330)) + 8|0);
      HEAP32[$331>>2] = $329;
     }
    } while(0);
    _next();
    _stmt();
    STACKTOP = sp;return;
   } else {
    label = 94;
   }
   break;
  }
  default: {
   label = 94;
  }
  }
 } while(0);
 if ((label|0) == 86) {
  _next();
  STACKTOP = sp;return;
 }
 else if ((label|0) == 94) {
  $343 = HEAP32[9930]|0;
  $es = $343;
  _expr(202);
  _trim();
  $344 = HEAP32[9930]|0;
  _rv($344);
  $345 = $es;
  HEAP32[9930] = $345;
  _skip(59);
  STACKTOP = sp;return;
 }
}
function _main($argc,$argv) {
 $argc = $argc|0;
 $argv = $argv|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $amain = 0, $fd = 0, $hdr = 0;
 var $i = 0, $or$cond = 0, $or$cond3 = 0, $outfile = 0, $patchbss = 0, $patchdata = 0, $text = 0, $tmain = 0, $vararg_buffer = 0, $vararg_buffer11 = 0, $vararg_buffer16 = 0, $vararg_buffer22 = 0, $vararg_buffer26 = 0, $vararg_buffer4 = 0, $vararg_buffer7 = 0, $vararg_ptr10 = 0, $vararg_ptr14 = 0, $vararg_ptr15 = 0, $vararg_ptr19 = 0, $vararg_ptr20 = 0;
 var $vararg_ptr21 = 0, $vararg_ptr25 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer26 = sp + 64|0;
 $vararg_buffer22 = sp + 56|0;
 $vararg_buffer16 = sp + 40|0;
 $vararg_buffer11 = sp + 24|0;
 $vararg_buffer7 = sp + 16|0;
 $vararg_buffer4 = sp + 8|0;
 $vararg_buffer = sp;
 $hdr = sp + 72|0;
 $0 = 0;
 $1 = $argc;
 $2 = $argv;
 HEAP32[1710] = 3869;
 $3 = $1;
 $4 = ($3|0)<(2);
 L1: do {
  if (!($4)) {
   $outfile = 0;
   $5 = $2;
   $6 = ((($5)) + 4|0);
   $2 = $6;
   $7 = HEAP32[$6>>2]|0;
   HEAP32[1714] = $7;
   while(1) {
    $8 = $1;
    $9 = (($8) + -1)|0;
    $1 = $9;
    $10 = ($9|0)!=(0);
    if (!($10)) {
     break;
    }
    $11 = HEAP32[1714]|0;
    $12 = HEAP8[$11>>0]|0;
    $13 = $12 << 24 >> 24;
    $14 = ($13|0)==(45);
    if (!($14)) {
     break;
    }
    $15 = HEAP32[1714]|0;
    $16 = ((($15)) + 1|0);
    $17 = HEAP8[$16>>0]|0;
    $18 = $17 << 24 >> 24;
    switch ($18|0) {
    case 118:  {
     HEAP32[9934] = 1;
     break;
    }
    case 115:  {
     HEAP32[1719] = 1;
     break;
    }
    case 73:  {
     $19 = HEAP32[1714]|0;
     $20 = ((($19)) + 2|0);
     HEAP32[9924] = $20;
     break;
    }
    case 111:  {
     $21 = $1;
     $22 = ($21|0)>(1);
     if (!($22)) {
      break L1;
     }
     $23 = $2;
     $24 = ((($23)) + 4|0);
     $2 = $24;
     $25 = HEAP32[$24>>2]|0;
     $outfile = $25;
     $26 = $1;
     $27 = (($26) + -1)|0;
     $1 = $27;
     break;
    }
    default: {
     break L1;
    }
    }
    $30 = $2;
    $31 = ((($30)) + 4|0);
    $2 = $31;
    $32 = HEAP32[$31>>2]|0;
    HEAP32[1714] = $32;
   }
   $33 = $outfile;
   $34 = ($33|0)!=(0|0);
   if (!($34)) {
    $35 = HEAP32[2]|0;
    $36 = HEAP32[1710]|0;
    HEAP32[$vararg_buffer4>>2] = $36;
    (_fprintf($35,3924,$vararg_buffer4)|0);
    $0 = -1;
    $176 = $0;
    STACKTOP = sp;return ($176|0);
   }
   $37 = (_alloc(8388608)|0);
   $38 = $37;
   HEAP32[1712] = $38;
   HEAP32[1713] = $38;
   $39 = (_alloc(8388608)|0);
   $40 = $39;
   HEAP32[9929] = $40;
   $41 = (_alloc(65536)|0);
   $42 = $41;
   HEAP32[9926] = $42;
   HEAP32[1717] = $42;
   HEAP32[9931] = 1;
   $43 = HEAP8[(39727)>>0]|0;
   $44 = $43 << 24 >> 24;
   HEAP32[9931] = $44;
   $45 = HEAP32[1714]|0;
   _info_open($45);
   HEAP32[1727] = 3952;
   $i = 129;
   while(1) {
    $46 = $i;
    $47 = ($46|0)<=(159);
    _next();
    if (!($47)) {
     break;
    }
    $48 = $i;
    $49 = HEAP32[9925]|0;
    $50 = ((($49)) + 16|0);
    HEAP32[$50>>2] = $48;
    $51 = $i;
    $52 = (($51) + 1)|0;
    $i = $52;
   }
   $53 = HEAP32[9925]|0;
   $tmain = $53;
   HEAP32[1715] = 1;
   $54 = HEAP32[1714]|0;
   $55 = (_mapfile($54)|0);
   HEAP32[1727] = $55;
   $56 = (_alloc(4096)|0);
   $57 = ((($56)) + 4096|0);
   HEAP32[9930] = $57;
   $58 = (_alloc(65536)|0);
   $patchdata = $58;
   HEAP32[1725] = $58;
   $59 = (_alloc(65536)|0);
   $patchbss = $59;
   HEAP32[1726] = $59;
   $60 = (_alloc(4096)|0);
   HEAP32[1718] = $60;
   $61 = HEAP32[9934]|0;
   $62 = ($61|0)!=(0);
   if ($62) {
    $63 = HEAP32[2]|0;
    $64 = HEAP32[1710]|0;
    $65 = HEAP32[1714]|0;
    HEAP32[$vararg_buffer7>>2] = $64;
    $vararg_ptr10 = ((($vararg_buffer7)) + 4|0);
    HEAP32[$vararg_ptr10>>2] = $65;
    (_fprintf($63,4145,$vararg_buffer7)|0);
   }
   $66 = HEAP32[1719]|0;
   $67 = ($66|0)!=(0);
   if ($67) {
    _dline();
   }
   _next();
   _decl(149);
   $68 = HEAP32[1723]|0;
   $69 = ($68|0)==(0);
   $70 = HEAP32[9933]|0;
   $71 = ($70|0)!=(0);
   $or$cond = $69 & $71;
   if ($or$cond) {
    _err(4164);
   }
   $72 = HEAP32[1712]|0;
   $73 = (($72) + 7)|0;
   $74 = $73 & -8;
   HEAP32[1712] = $74;
   $75 = HEAP32[1712]|0;
   $76 = HEAP32[1713]|0;
   $77 = (($75) - ($76))|0;
   $text = $77;
   $78 = HEAP32[1720]|0;
   $79 = (($78) + 7)|0;
   $80 = $79 & -8;
   HEAP32[1720] = $80;
   $81 = HEAP32[1721]|0;
   $82 = (($81) + 7)|0;
   $83 = $82 & -8;
   HEAP32[1721] = $83;
   $84 = $text;
   $85 = HEAP32[1720]|0;
   $86 = (($84) + ($85))|0;
   $87 = HEAP32[1721]|0;
   $88 = (($86) + ($87))|0;
   $89 = ($88|0)>(8388608);
   if ($89) {
    _err(4208);
   }
   $90 = $tmain;
   $91 = ((($90)) + 8|0);
   $92 = HEAP32[$91>>2]|0;
   $amain = $92;
   $93 = ($92|0)!=(0);
   if (!($93)) {
    _err(4255);
   }
   $94 = HEAP32[9934]|0;
   $95 = ($94|0)!=(0);
   $96 = HEAP32[1723]|0;
   $97 = ($96|0)!=(0);
   $or$cond3 = $95 | $97;
   if ($or$cond3) {
    $98 = HEAP32[2]|0;
    $99 = HEAP32[1710]|0;
    $100 = HEAP32[1714]|0;
    $101 = HEAP32[1723]|0;
    HEAP32[$vararg_buffer11>>2] = $99;
    $vararg_ptr14 = ((($vararg_buffer11)) + 4|0);
    HEAP32[$vararg_ptr14>>2] = $100;
    $vararg_ptr15 = ((($vararg_buffer11)) + 8|0);
    HEAP32[$vararg_ptr15>>2] = $101;
    (_fprintf($98,4274,$vararg_buffer11)|0);
   }
   $102 = HEAP32[9934]|0;
   $103 = ($102|0)!=(0);
   if ($103) {
    $104 = HEAP32[2]|0;
    $105 = $amain;
    $106 = HEAP32[1713]|0;
    $107 = (($105) - ($106))|0;
    $108 = $text;
    $109 = HEAP32[1720]|0;
    $110 = HEAP32[1721]|0;
    HEAP32[$vararg_buffer16>>2] = $107;
    $vararg_ptr19 = ((($vararg_buffer16)) + 4|0);
    HEAP32[$vararg_ptr19>>2] = $108;
    $vararg_ptr20 = ((($vararg_buffer16)) + 8|0);
    HEAP32[$vararg_ptr20>>2] = $109;
    $vararg_ptr21 = ((($vararg_buffer16)) + 12|0);
    HEAP32[$vararg_ptr21>>2] = $110;
    (_fprintf($104,4307,$vararg_buffer16)|0);
   }
   $111 = HEAP32[1723]|0;
   $112 = ($111|0)!=(0);
   do {
    if (!($112)) {
     while(1) {
      $113 = HEAP32[1725]|0;
      $114 = $patchdata;
      $115 = ($113|0)!=($114|0);
      if (!($115)) {
       break;
      }
      $116 = HEAP32[1725]|0;
      $117 = ((($116)) + -4|0);
      HEAP32[1725] = $117;
      $118 = HEAP32[1712]|0;
      $119 = HEAP32[1725]|0;
      $120 = HEAP32[$119>>2]|0;
      $121 = (($118) - ($120))|0;
      $122 = (($121) - 4)|0;
      $123 = $122 << 8;
      $124 = HEAP32[1725]|0;
      $125 = HEAP32[$124>>2]|0;
      $126 = $125;
      $127 = HEAP32[$126>>2]|0;
      $128 = (($127) + ($123))|0;
      HEAP32[$126>>2] = $128;
     }
     while(1) {
      $129 = HEAP32[1726]|0;
      $130 = $patchbss;
      $131 = ($129|0)!=($130|0);
      if (!($131)) {
       break;
      }
      $132 = HEAP32[1726]|0;
      $133 = ((($132)) + -4|0);
      HEAP32[1726] = $133;
      $134 = HEAP32[1712]|0;
      $135 = HEAP32[1720]|0;
      $136 = (($134) + ($135))|0;
      $137 = HEAP32[1726]|0;
      $138 = HEAP32[$137>>2]|0;
      $139 = (($136) - ($138))|0;
      $140 = (($139) - 4)|0;
      $141 = $140 << 8;
      $142 = HEAP32[1726]|0;
      $143 = HEAP32[$142>>2]|0;
      $144 = $143;
      $145 = HEAP32[$144>>2]|0;
      $146 = (($145) + ($141))|0;
      HEAP32[$144>>2] = $146;
     }
     $147 = $outfile;
     $148 = (_fopen($147,1328)|0);
     $fd = $148;
     $149 = ($148|0)!=(0|0);
     if ($149) {
      HEAP32[$hdr>>2] = -1059131379;
      $153 = HEAP32[1721]|0;
      $154 = ((($hdr)) + 4|0);
      HEAP32[$154>>2] = $153;
      $155 = $amain;
      $156 = HEAP32[1713]|0;
      $157 = (($155) - ($156))|0;
      $158 = ((($hdr)) + 8|0);
      HEAP32[$158>>2] = $157;
      $159 = ((($hdr)) + 12|0);
      HEAP32[$159>>2] = 0;
      $160 = $fd;
      (_fwrite($hdr,1,16,$160)|0);
      $161 = HEAP32[1713]|0;
      $162 = $161;
      $163 = $text;
      $164 = $fd;
      (_fwrite($162,1,$163,$164)|0);
      $165 = HEAP32[9929]|0;
      $166 = $165;
      $167 = HEAP32[1720]|0;
      $168 = $fd;
      (_fwrite($166,1,$167,$168)|0);
      $169 = $fd;
      (_fclose($169)|0);
      $170 = $text;
      _info_close($170);
      break;
     }
     $150 = HEAP32[2]|0;
     $151 = HEAP32[1710]|0;
     $152 = $outfile;
     HEAP32[$vararg_buffer22>>2] = $151;
     $vararg_ptr25 = ((($vararg_buffer22)) + 4|0);
     HEAP32[$vararg_ptr25>>2] = $152;
     (_fprintf($150,4348,$vararg_buffer22)|0);
     $0 = -1;
     $176 = $0;
     STACKTOP = sp;return ($176|0);
    }
   } while(0);
   $171 = HEAP32[9934]|0;
   $172 = ($171|0)!=(0);
   if ($172) {
    $173 = HEAP32[2]|0;
    $174 = HEAP32[1710]|0;
    HEAP32[$vararg_buffer26>>2] = $174;
    (_fprintf($173,4387,$vararg_buffer26)|0);
   }
   $175 = HEAP32[1723]|0;
   $0 = $175;
   $176 = $0;
   STACKTOP = sp;return ($176|0);
  }
 } while(0);
 $28 = HEAP32[2]|0;
 $29 = HEAP32[1710]|0;
 HEAP32[$vararg_buffer>>2] = $29;
 (_fprintf($28,3874,$vararg_buffer)|0);
 $0 = -1;
 $176 = $0;
 STACKTOP = sp;return ($176|0);
}
function ___stdio_close($f) {
 $f = $f|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = ((($f)) + 60|0);
 $1 = HEAP32[$0>>2]|0;
 HEAP32[$vararg_buffer>>2] = $1;
 $2 = (___syscall6(6,($vararg_buffer|0))|0);
 $3 = (___syscall_ret($2)|0);
 STACKTOP = sp;return ($3|0);
}
function ___syscall_ret($r) {
 $r = $r|0;
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($r>>>0)>(4294963200);
 if ($0) {
  $1 = (0 - ($r))|0;
  $2 = (___errno_location()|0);
  HEAP32[$2>>2] = $1;
  $$0 = -1;
 } else {
  $$0 = $r;
 }
 return ($$0|0);
}
function ___errno_location() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[9938]|0;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = 39796;
 } else {
  $2 = (_pthread_self()|0);
  $3 = ((($2)) + 64|0);
  $4 = HEAP32[$3>>2]|0;
  $$0 = $4;
 }
 return ($$0|0);
}
function ___stdio_write($f,$buf,$len) {
 $f = $f|0;
 $buf = $buf|0;
 $len = $len|0;
 var $$0 = 0, $$phi$trans$insert = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $cnt$0 = 0, $cnt$1 = 0, $iov$0 = 0, $iov$0$lcssa11 = 0, $iov$1 = 0, $iovcnt$0 = 0, $iovcnt$0$lcssa12 = 0;
 var $iovcnt$1 = 0, $iovs = 0, $rem$0 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $iovs = sp + 32|0;
 $0 = ((($f)) + 28|0);
 $1 = HEAP32[$0>>2]|0;
 HEAP32[$iovs>>2] = $1;
 $2 = ((($iovs)) + 4|0);
 $3 = ((($f)) + 20|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) - ($1))|0;
 HEAP32[$2>>2] = $5;
 $6 = ((($iovs)) + 8|0);
 HEAP32[$6>>2] = $buf;
 $7 = ((($iovs)) + 12|0);
 HEAP32[$7>>2] = $len;
 $8 = (($5) + ($len))|0;
 $9 = ((($f)) + 60|0);
 $10 = ((($f)) + 44|0);
 $iov$0 = $iovs;$iovcnt$0 = 2;$rem$0 = $8;
 while(1) {
  $11 = HEAP32[9938]|0;
  $12 = ($11|0)==(0|0);
  if ($12) {
   $16 = HEAP32[$9>>2]|0;
   HEAP32[$vararg_buffer3>>2] = $16;
   $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
   HEAP32[$vararg_ptr6>>2] = $iov$0;
   $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
   HEAP32[$vararg_ptr7>>2] = $iovcnt$0;
   $17 = (___syscall146(146,($vararg_buffer3|0))|0);
   $18 = (___syscall_ret($17)|0);
   $cnt$0 = $18;
  } else {
   _pthread_cleanup_push((5|0),($f|0));
   $13 = HEAP32[$9>>2]|0;
   HEAP32[$vararg_buffer>>2] = $13;
   $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
   HEAP32[$vararg_ptr1>>2] = $iov$0;
   $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
   HEAP32[$vararg_ptr2>>2] = $iovcnt$0;
   $14 = (___syscall146(146,($vararg_buffer|0))|0);
   $15 = (___syscall_ret($14)|0);
   _pthread_cleanup_pop(0);
   $cnt$0 = $15;
  }
  $19 = ($rem$0|0)==($cnt$0|0);
  if ($19) {
   label = 6;
   break;
  }
  $26 = ($cnt$0|0)<(0);
  if ($26) {
   $iov$0$lcssa11 = $iov$0;$iovcnt$0$lcssa12 = $iovcnt$0;
   label = 8;
   break;
  }
  $34 = (($rem$0) - ($cnt$0))|0;
  $35 = ((($iov$0)) + 4|0);
  $36 = HEAP32[$35>>2]|0;
  $37 = ($cnt$0>>>0)>($36>>>0);
  if ($37) {
   $38 = HEAP32[$10>>2]|0;
   HEAP32[$0>>2] = $38;
   HEAP32[$3>>2] = $38;
   $39 = (($cnt$0) - ($36))|0;
   $40 = ((($iov$0)) + 8|0);
   $41 = (($iovcnt$0) + -1)|0;
   $$phi$trans$insert = ((($iov$0)) + 12|0);
   $$pre = HEAP32[$$phi$trans$insert>>2]|0;
   $49 = $$pre;$cnt$1 = $39;$iov$1 = $40;$iovcnt$1 = $41;
  } else {
   $42 = ($iovcnt$0|0)==(2);
   if ($42) {
    $43 = HEAP32[$0>>2]|0;
    $44 = (($43) + ($cnt$0)|0);
    HEAP32[$0>>2] = $44;
    $49 = $36;$cnt$1 = $cnt$0;$iov$1 = $iov$0;$iovcnt$1 = 2;
   } else {
    $49 = $36;$cnt$1 = $cnt$0;$iov$1 = $iov$0;$iovcnt$1 = $iovcnt$0;
   }
  }
  $45 = HEAP32[$iov$1>>2]|0;
  $46 = (($45) + ($cnt$1)|0);
  HEAP32[$iov$1>>2] = $46;
  $47 = ((($iov$1)) + 4|0);
  $48 = (($49) - ($cnt$1))|0;
  HEAP32[$47>>2] = $48;
  $iov$0 = $iov$1;$iovcnt$0 = $iovcnt$1;$rem$0 = $34;
 }
 if ((label|0) == 6) {
  $20 = HEAP32[$10>>2]|0;
  $21 = ((($f)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($f)) + 16|0);
  HEAP32[$24>>2] = $23;
  $25 = $20;
  HEAP32[$0>>2] = $25;
  HEAP32[$3>>2] = $25;
  $$0 = $len;
 }
 else if ((label|0) == 8) {
  $27 = ((($f)) + 16|0);
  HEAP32[$27>>2] = 0;
  HEAP32[$0>>2] = 0;
  HEAP32[$3>>2] = 0;
  $28 = HEAP32[$f>>2]|0;
  $29 = $28 | 32;
  HEAP32[$f>>2] = $29;
  $30 = ($iovcnt$0$lcssa12|0)==(2);
  if ($30) {
   $$0 = 0;
  } else {
   $31 = ((($iov$0$lcssa11)) + 4|0);
   $32 = HEAP32[$31>>2]|0;
   $33 = (($len) - ($32))|0;
   $$0 = $33;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function _cleanup_387($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($p)) + 68|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0);
 if ($2) {
  ___unlockfile($p);
 }
 return;
}
function ___unlockfile($f) {
 $f = $f|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function ___stdio_seek($f,$off,$whence) {
 $f = $f|0;
 $off = $off|0;
 $whence = $whence|0;
 var $$pre = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $ret = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $ret = sp + 20|0;
 $0 = ((($f)) + 60|0);
 $1 = HEAP32[$0>>2]|0;
 HEAP32[$vararg_buffer>>2] = $1;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $off;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $ret;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $whence;
 $2 = (___syscall140(140,($vararg_buffer|0))|0);
 $3 = (___syscall_ret($2)|0);
 $4 = ($3|0)<(0);
 if ($4) {
  HEAP32[$ret>>2] = -1;
  $5 = -1;
 } else {
  $$pre = HEAP32[$ret>>2]|0;
  $5 = $$pre;
 }
 STACKTOP = sp;return ($5|0);
}
function ___stdio_read($f,$buf,$len) {
 $f = $f|0;
 $buf = $buf|0;
 $len = $len|0;
 var $$0 = 0, $$cast = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $cnt$0 = 0, $iov = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $iov = sp + 32|0;
 HEAP32[$iov>>2] = $buf;
 $0 = ((($iov)) + 4|0);
 $1 = ((($f)) + 48|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)!=(0);
 $4 = $3&1;
 $5 = (($len) - ($4))|0;
 HEAP32[$0>>2] = $5;
 $6 = ((($iov)) + 8|0);
 $7 = ((($f)) + 44|0);
 $8 = HEAP32[$7>>2]|0;
 HEAP32[$6>>2] = $8;
 $9 = ((($iov)) + 12|0);
 HEAP32[$9>>2] = $2;
 $10 = HEAP32[9938]|0;
 $11 = ($10|0)==(0|0);
 if ($11) {
  $16 = ((($f)) + 60|0);
  $17 = HEAP32[$16>>2]|0;
  HEAP32[$vararg_buffer3>>2] = $17;
  $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
  HEAP32[$vararg_ptr6>>2] = $iov;
  $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
  HEAP32[$vararg_ptr7>>2] = 2;
  $18 = (___syscall145(145,($vararg_buffer3|0))|0);
  $19 = (___syscall_ret($18)|0);
  $cnt$0 = $19;
 } else {
  _pthread_cleanup_push((6|0),($f|0));
  $12 = ((($f)) + 60|0);
  $13 = HEAP32[$12>>2]|0;
  HEAP32[$vararg_buffer>>2] = $13;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $iov;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = 2;
  $14 = (___syscall145(145,($vararg_buffer|0))|0);
  $15 = (___syscall_ret($14)|0);
  _pthread_cleanup_pop(0);
  $cnt$0 = $15;
 }
 $20 = ($cnt$0|0)<(1);
 if ($20) {
  $21 = $cnt$0 & 48;
  $22 = $21 ^ 16;
  $23 = HEAP32[$f>>2]|0;
  $24 = $23 | $22;
  HEAP32[$f>>2] = $24;
  $25 = ((($f)) + 8|0);
  HEAP32[$25>>2] = 0;
  $26 = ((($f)) + 4|0);
  HEAP32[$26>>2] = 0;
  $$0 = $cnt$0;
 } else {
  $27 = HEAP32[$0>>2]|0;
  $28 = ($cnt$0>>>0)>($27>>>0);
  if ($28) {
   $29 = (($cnt$0) - ($27))|0;
   $30 = HEAP32[$7>>2]|0;
   $31 = ((($f)) + 4|0);
   HEAP32[$31>>2] = $30;
   $$cast = $30;
   $32 = (($$cast) + ($29)|0);
   $33 = ((($f)) + 8|0);
   HEAP32[$33>>2] = $32;
   $34 = HEAP32[$1>>2]|0;
   $35 = ($34|0)==(0);
   if ($35) {
    $$0 = $len;
   } else {
    $36 = ((($$cast)) + 1|0);
    HEAP32[$31>>2] = $36;
    $37 = HEAP8[$$cast>>0]|0;
    $38 = (($len) + -1)|0;
    $39 = (($buf) + ($38)|0);
    HEAP8[$39>>0] = $37;
    $$0 = $len;
   }
  } else {
   $$0 = $cnt$0;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function _cleanup_382($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($p)) + 68|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0);
 if ($2) {
  ___unlockfile($p);
 }
 return;
}
function ___stdout_write($f,$buf,$len) {
 $f = $f|0;
 $buf = $buf|0;
 $len = $len|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $tio = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $tio = sp + 12|0;
 $0 = ((($f)) + 36|0);
 HEAP32[$0>>2] = 2;
 $1 = HEAP32[$f>>2]|0;
 $2 = $1 & 64;
 $3 = ($2|0)==(0);
 if ($3) {
  $4 = ((($f)) + 60|0);
  $5 = HEAP32[$4>>2]|0;
  HEAP32[$vararg_buffer>>2] = $5;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21505;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $tio;
  $6 = (___syscall54(54,($vararg_buffer|0))|0);
  $7 = ($6|0)==(0);
  if (!($7)) {
   $8 = ((($f)) + 75|0);
   HEAP8[$8>>0] = -1;
  }
 }
 $9 = (___stdio_write($f,$buf,$len)|0);
 STACKTOP = sp;return ($9|0);
}
function ___toread($f) {
 $f = $f|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 74|0);
 $1 = HEAP8[$0>>0]|0;
 $2 = $1 << 24 >> 24;
 $3 = (($2) + 255)|0;
 $4 = $3 | $2;
 $5 = $4&255;
 HEAP8[$0>>0] = $5;
 $6 = ((($f)) + 20|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($f)) + 44|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ($7>>>0)>($9>>>0);
 if ($10) {
  $11 = ((($f)) + 36|0);
  $12 = HEAP32[$11>>2]|0;
  (FUNCTION_TABLE_iiii[$12 & 7]($f,0,0)|0);
 }
 $13 = ((($f)) + 16|0);
 HEAP32[$13>>2] = 0;
 $14 = ((($f)) + 28|0);
 HEAP32[$14>>2] = 0;
 HEAP32[$6>>2] = 0;
 $15 = HEAP32[$f>>2]|0;
 $16 = $15 & 20;
 $17 = ($16|0)==(0);
 if ($17) {
  $21 = HEAP32[$8>>2]|0;
  $22 = ((($f)) + 8|0);
  HEAP32[$22>>2] = $21;
  $23 = ((($f)) + 4|0);
  HEAP32[$23>>2] = $21;
  $$0 = 0;
 } else {
  $18 = $15 & 4;
  $19 = ($18|0)==(0);
  if ($19) {
   $$0 = -1;
  } else {
   $20 = $15 | 32;
   HEAP32[$f>>2] = $20;
   $$0 = -1;
  }
 }
 return ($$0|0);
}
function _memchr($src,$c,$n) {
 $src = $src|0;
 $c = $c|0;
 $n = $n|0;
 var $$0$lcssa = 0, $$0$lcssa30 = 0, $$019 = 0, $$1$lcssa = 0, $$110 = 0, $$110$lcssa = 0, $$24 = 0, $$3 = 0, $$lcssa = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond18 = 0, $s$0$lcssa = 0, $s$0$lcssa29 = 0, $s$020 = 0, $s$15 = 0, $s$2 = 0, $w$0$lcssa = 0, $w$011 = 0, $w$011$lcssa = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = $c & 255;
 $1 = $src;
 $2 = $1 & 3;
 $3 = ($2|0)!=(0);
 $4 = ($n|0)!=(0);
 $or$cond18 = $4 & $3;
 L1: do {
  if ($or$cond18) {
   $5 = $c&255;
   $$019 = $n;$s$020 = $src;
   while(1) {
    $6 = HEAP8[$s$020>>0]|0;
    $7 = ($6<<24>>24)==($5<<24>>24);
    if ($7) {
     $$0$lcssa30 = $$019;$s$0$lcssa29 = $s$020;
     label = 6;
     break L1;
    }
    $8 = ((($s$020)) + 1|0);
    $9 = (($$019) + -1)|0;
    $10 = $8;
    $11 = $10 & 3;
    $12 = ($11|0)!=(0);
    $13 = ($9|0)!=(0);
    $or$cond = $13 & $12;
    if ($or$cond) {
     $$019 = $9;$s$020 = $8;
    } else {
     $$0$lcssa = $9;$$lcssa = $13;$s$0$lcssa = $8;
     label = 5;
     break;
    }
   }
  } else {
   $$0$lcssa = $n;$$lcssa = $4;$s$0$lcssa = $src;
   label = 5;
  }
 } while(0);
 if ((label|0) == 5) {
  if ($$lcssa) {
   $$0$lcssa30 = $$0$lcssa;$s$0$lcssa29 = $s$0$lcssa;
   label = 6;
  } else {
   $$3 = 0;$s$2 = $s$0$lcssa;
  }
 }
 L8: do {
  if ((label|0) == 6) {
   $14 = HEAP8[$s$0$lcssa29>>0]|0;
   $15 = $c&255;
   $16 = ($14<<24>>24)==($15<<24>>24);
   if ($16) {
    $$3 = $$0$lcssa30;$s$2 = $s$0$lcssa29;
   } else {
    $17 = Math_imul($0, 16843009)|0;
    $18 = ($$0$lcssa30>>>0)>(3);
    L11: do {
     if ($18) {
      $$110 = $$0$lcssa30;$w$011 = $s$0$lcssa29;
      while(1) {
       $19 = HEAP32[$w$011>>2]|0;
       $20 = $19 ^ $17;
       $21 = (($20) + -16843009)|0;
       $22 = $20 & -2139062144;
       $23 = $22 ^ -2139062144;
       $24 = $23 & $21;
       $25 = ($24|0)==(0);
       if (!($25)) {
        $$110$lcssa = $$110;$w$011$lcssa = $w$011;
        break;
       }
       $26 = ((($w$011)) + 4|0);
       $27 = (($$110) + -4)|0;
       $28 = ($27>>>0)>(3);
       if ($28) {
        $$110 = $27;$w$011 = $26;
       } else {
        $$1$lcssa = $27;$w$0$lcssa = $26;
        label = 11;
        break L11;
       }
      }
      $$24 = $$110$lcssa;$s$15 = $w$011$lcssa;
     } else {
      $$1$lcssa = $$0$lcssa30;$w$0$lcssa = $s$0$lcssa29;
      label = 11;
     }
    } while(0);
    if ((label|0) == 11) {
     $29 = ($$1$lcssa|0)==(0);
     if ($29) {
      $$3 = 0;$s$2 = $w$0$lcssa;
      break;
     } else {
      $$24 = $$1$lcssa;$s$15 = $w$0$lcssa;
     }
    }
    while(1) {
     $30 = HEAP8[$s$15>>0]|0;
     $31 = ($30<<24>>24)==($15<<24>>24);
     if ($31) {
      $$3 = $$24;$s$2 = $s$15;
      break L8;
     }
     $32 = ((($s$15)) + 1|0);
     $33 = (($$24) + -1)|0;
     $34 = ($33|0)==(0);
     if ($34) {
      $$3 = 0;$s$2 = $32;
      break;
     } else {
      $$24 = $33;$s$15 = $32;
     }
    }
   }
  }
 } while(0);
 $35 = ($$3|0)!=(0);
 $36 = $35 ? $s$2 : 0;
 return ($36|0);
}
function _memcmp($vl,$vr,$n) {
 $vl = $vl|0;
 $vr = $vr|0;
 $n = $n|0;
 var $$03 = 0, $$lcssa = 0, $$lcssa19 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $l$04 = 0, $r$05 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($n|0)==(0);
 L1: do {
  if ($0) {
   $11 = 0;
  } else {
   $$03 = $n;$l$04 = $vl;$r$05 = $vr;
   while(1) {
    $1 = HEAP8[$l$04>>0]|0;
    $2 = HEAP8[$r$05>>0]|0;
    $3 = ($1<<24>>24)==($2<<24>>24);
    if (!($3)) {
     $$lcssa = $1;$$lcssa19 = $2;
     break;
    }
    $4 = (($$03) + -1)|0;
    $5 = ((($l$04)) + 1|0);
    $6 = ((($r$05)) + 1|0);
    $7 = ($4|0)==(0);
    if ($7) {
     $11 = 0;
     break L1;
    } else {
     $$03 = $4;$l$04 = $5;$r$05 = $6;
    }
   }
   $8 = $$lcssa&255;
   $9 = $$lcssa19&255;
   $10 = (($8) - ($9))|0;
   $11 = $10;
  }
 } while(0);
 return ($11|0);
}
function _vfprintf($f,$fmt,$ap) {
 $f = $f|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 var $$ = 0, $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ap2 = 0, $internal_buf = 0, $nl_arg = 0, $nl_type = 0;
 var $ret$1 = 0, $ret$1$ = 0, $vacopy_currentptr = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $ap2 = sp + 120|0;
 $nl_type = sp + 80|0;
 $nl_arg = sp;
 $internal_buf = sp + 136|0;
 dest=$nl_type; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $vacopy_currentptr = HEAP32[$ap>>2]|0;
 HEAP32[$ap2>>2] = $vacopy_currentptr;
 $0 = (_printf_core(0,$fmt,$ap2,$nl_arg,$nl_type)|0);
 $1 = ($0|0)<(0);
 if ($1) {
  $$0 = -1;
 } else {
  $2 = ((($f)) + 76|0);
  $3 = HEAP32[$2>>2]|0;
  $4 = ($3|0)>(-1);
  if ($4) {
   $5 = (___lockfile($f)|0);
   $33 = $5;
  } else {
   $33 = 0;
  }
  $6 = HEAP32[$f>>2]|0;
  $7 = $6 & 32;
  $8 = ((($f)) + 74|0);
  $9 = HEAP8[$8>>0]|0;
  $10 = ($9<<24>>24)<(1);
  if ($10) {
   $11 = $6 & -33;
   HEAP32[$f>>2] = $11;
  }
  $12 = ((($f)) + 48|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($13|0)==(0);
  if ($14) {
   $16 = ((($f)) + 44|0);
   $17 = HEAP32[$16>>2]|0;
   HEAP32[$16>>2] = $internal_buf;
   $18 = ((($f)) + 28|0);
   HEAP32[$18>>2] = $internal_buf;
   $19 = ((($f)) + 20|0);
   HEAP32[$19>>2] = $internal_buf;
   HEAP32[$12>>2] = 80;
   $20 = ((($internal_buf)) + 80|0);
   $21 = ((($f)) + 16|0);
   HEAP32[$21>>2] = $20;
   $22 = (_printf_core($f,$fmt,$ap2,$nl_arg,$nl_type)|0);
   $23 = ($17|0)==(0|0);
   if ($23) {
    $ret$1 = $22;
   } else {
    $24 = ((($f)) + 36|0);
    $25 = HEAP32[$24>>2]|0;
    (FUNCTION_TABLE_iiii[$25 & 7]($f,0,0)|0);
    $26 = HEAP32[$19>>2]|0;
    $27 = ($26|0)==(0|0);
    $$ = $27 ? -1 : $22;
    HEAP32[$16>>2] = $17;
    HEAP32[$12>>2] = 0;
    HEAP32[$21>>2] = 0;
    HEAP32[$18>>2] = 0;
    HEAP32[$19>>2] = 0;
    $ret$1 = $$;
   }
  } else {
   $15 = (_printf_core($f,$fmt,$ap2,$nl_arg,$nl_type)|0);
   $ret$1 = $15;
  }
  $28 = HEAP32[$f>>2]|0;
  $29 = $28 & 32;
  $30 = ($29|0)==(0);
  $ret$1$ = $30 ? $ret$1 : -1;
  $31 = $28 | $7;
  HEAP32[$f>>2] = $31;
  $32 = ($33|0)==(0);
  if (!($32)) {
   ___unlockfile($f);
  }
  $$0 = $ret$1$;
 }
 STACKTOP = sp;return ($$0|0);
}
function _printf_core($f,$fmt,$ap,$nl_arg,$nl_type) {
 $f = $f|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 $nl_arg = $nl_arg|0;
 $nl_type = $nl_type|0;
 var $$ = 0, $$$i = 0, $$0 = 0, $$0$i = 0, $$0$lcssa$i = 0, $$012$i = 0, $$013$i = 0, $$03$i33 = 0, $$07$i = 0.0, $$1$i = 0.0, $$114$i = 0, $$2$i = 0.0, $$20$i = 0.0, $$210$$24$i = 0, $$210$$26$i = 0, $$210$i = 0, $$23$i = 0, $$25$i = 0, $$3$i = 0.0, $$311$i = 0;
 var $$33$i = 0, $$36$i = 0.0, $$4$i = 0.0, $$412$lcssa$i = 0, $$41278$i = 0, $$43 = 0, $$5$lcssa$i = 0, $$589$i = 0, $$a$3$i = 0, $$a$3191$i = 0, $$a$3192$i = 0, $$fl$4 = 0, $$l10n$0 = 0, $$lcssa = 0, $$lcssa162$i = 0, $$lcssa295 = 0, $$lcssa300 = 0, $$lcssa301 = 0, $$lcssa302 = 0, $$lcssa303 = 0;
 var $$lcssa304 = 0, $$lcssa306 = 0, $$lcssa316 = 0, $$lcssa319 = 0.0, $$lcssa321 = 0, $$neg55$i = 0, $$neg56$i = 0, $$p$$i = 0, $$p$5 = 0, $$p$i = 0, $$pn$i = 0, $$pr$i = 0, $$pr50$i = 0, $$pre = 0, $$pre$i = 0, $$pre$phi190$iZ2D = 0, $$pre170 = 0, $$pre171 = 0, $$pre185$i = 0, $$pre188$i = 0;
 var $$pre189$i = 0, $$z$3$i = 0, $$z$4$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
 var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0;
 var $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0;
 var $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0;
 var $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0.0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0.0, $363 = 0, $364 = 0, $365 = 0;
 var $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0;
 var $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0.0, $391 = 0.0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0;
 var $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0.0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0.0, $411 = 0.0, $412 = 0.0, $413 = 0.0, $414 = 0.0, $415 = 0.0, $416 = 0, $417 = 0, $418 = 0, $419 = 0;
 var $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0;
 var $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0.0, $442 = 0.0, $443 = 0.0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0;
 var $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0;
 var $474 = 0.0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0.0, $483 = 0.0, $484 = 0.0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0;
 var $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0;
 var $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0;
 var $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0;
 var $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0;
 var $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0;
 var $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0.0, $594 = 0.0, $595 = 0, $596 = 0.0, $597 = 0, $598 = 0, $599 = 0, $6 = 0;
 var $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0;
 var $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0;
 var $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0;
 var $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0;
 var $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0;
 var $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0;
 var $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0;
 var $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0;
 var $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0;
 var $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0;
 var $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $a$0 = 0, $a$1 = 0, $a$1$lcssa$i = 0, $a$1149$i = 0, $a$2 = 0, $a$2$ph$i = 0, $a$3$lcssa$i = 0, $a$3136$i = 0, $a$5$lcssa$i = 0, $a$5111$i = 0, $a$6$i = 0, $a$8$i = 0, $a$9$ph$i = 0, $arg = 0, $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0;
 var $argpos$0 = 0, $big$i = 0, $buf = 0, $buf$i = 0, $carry$0142$i = 0, $carry3$0130$i = 0, $cnt$0 = 0, $cnt$1 = 0, $cnt$1$lcssa = 0, $d$0$i = 0, $d$0141$i = 0, $d$0143$i = 0, $d$1129$i = 0, $d$2$lcssa$i = 0, $d$2110$i = 0, $d$4$i = 0, $d$584$i = 0, $d$677$i = 0, $d$788$i = 0, $e$0125$i = 0;
 var $e$1$i = 0, $e$2106$i = 0, $e$4$i = 0, $e$5$ph$i = 0, $e2$i = 0, $ebuf0$i = 0, $estr$0$i = 0, $estr$1$lcssa$i = 0, $estr$195$i = 0, $estr$2$i = 0, $exitcond$i = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0;
 var $expanded8 = 0, $fl$0100 = 0, $fl$053 = 0, $fl$1 = 0, $fl$1$ = 0, $fl$3 = 0, $fl$4 = 0, $fl$6 = 0, $i$0$lcssa = 0, $i$0$lcssa178 = 0, $i$0105 = 0, $i$0124$i = 0, $i$03$i = 0, $i$03$i25 = 0, $i$1$lcssa$i = 0, $i$1116 = 0, $i$1118$i = 0, $i$2105$i = 0, $i$291 = 0, $i$291$lcssa = 0;
 var $i$3101$i = 0, $i$389 = 0, $isdigit = 0, $isdigit$i = 0, $isdigit$i27 = 0, $isdigit10 = 0, $isdigit12 = 0, $isdigit2$i = 0, $isdigit2$i23 = 0, $isdigittmp = 0, $isdigittmp$ = 0, $isdigittmp$i = 0, $isdigittmp$i26 = 0, $isdigittmp1$i = 0, $isdigittmp1$i22 = 0, $isdigittmp11 = 0, $isdigittmp4$i = 0, $isdigittmp4$i24 = 0, $isdigittmp9 = 0, $j$0$i = 0;
 var $j$0117$i = 0, $j$0119$i = 0, $j$1102$i = 0, $j$2$i = 0, $l$0 = 0, $l$0$i = 0, $l$1$i = 0, $l$1104 = 0, $l$2 = 0, $l10n$0 = 0, $l10n$0$lcssa = 0, $l10n$0$phi = 0, $l10n$1 = 0, $l10n$2 = 0, $l10n$3 = 0, $mb = 0, $notlhs$i = 0, $notrhs$i = 0, $or$cond = 0, $or$cond$i = 0;
 var $or$cond122 = 0, $or$cond15 = 0, $or$cond17 = 0, $or$cond18$i = 0, $or$cond20 = 0, $or$cond22$i = 0, $or$cond3$not$i = 0, $or$cond31$i = 0, $or$cond6$i = 0, $p$0 = 0, $p$0$ = 0, $p$1 = 0, $p$2 = 0, $p$2$ = 0, $p$3 = 0, $p$4176 = 0, $p$5 = 0, $pl$0 = 0, $pl$0$i = 0, $pl$1 = 0;
 var $pl$1$i = 0, $pl$2 = 0, $prefix$0 = 0, $prefix$0$$i = 0, $prefix$0$i = 0, $prefix$1 = 0, $prefix$2 = 0, $r$0$a$9$i = 0, $re$171$i = 0, $round$070$i = 0.0, $round6$1$i = 0.0, $s$0 = 0, $s$0$i = 0, $s$1 = 0, $s$1$i = 0, $s$1$i$lcssa = 0, $s$2$lcssa = 0, $s$292 = 0, $s$4 = 0, $s$6 = 0;
 var $s$7 = 0, $s$7$lcssa298 = 0, $s1$0$i = 0, $s7$081$i = 0, $s7$1$i = 0, $s8$0$lcssa$i = 0, $s8$072$i = 0, $s9$0$i = 0, $s9$185$i = 0, $s9$2$i = 0, $scevgep182$i = 0, $scevgep182183$i = 0, $small$0$i = 0.0, $small$1$i = 0.0, $st$0 = 0, $st$0$lcssa299 = 0, $storemerge = 0, $storemerge13 = 0, $storemerge851 = 0, $storemerge899 = 0;
 var $sum = 0, $t$0 = 0, $t$1 = 0, $w$$i = 0, $w$0 = 0, $w$1 = 0, $w$2 = 0, $w$32$i = 0, $wc = 0, $ws$0106 = 0, $ws$1117 = 0, $z$0$i = 0, $z$0$lcssa = 0, $z$093 = 0, $z$1 = 0, $z$1$lcssa$i = 0, $z$1148$i = 0, $z$2 = 0, $z$2$i = 0, $z$2$i$lcssa = 0;
 var $z$3$lcssa$i = 0, $z$3135$i = 0, $z$4$i = 0, $z$7$$i = 0, $z$7$i = 0, $z$7$i$lcssa = 0, $z$7$ph$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 624|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $big$i = sp + 24|0;
 $e2$i = sp + 16|0;
 $buf$i = sp + 588|0;
 $ebuf0$i = sp + 576|0;
 $arg = sp;
 $buf = sp + 536|0;
 $wc = sp + 8|0;
 $mb = sp + 528|0;
 $0 = ($f|0)!=(0|0);
 $1 = ((($buf)) + 40|0);
 $2 = $1;
 $3 = ((($buf)) + 39|0);
 $4 = ((($wc)) + 4|0);
 $5 = $buf$i;
 $6 = (0 - ($5))|0;
 $7 = ((($ebuf0$i)) + 12|0);
 $8 = ((($ebuf0$i)) + 11|0);
 $9 = $7;
 $10 = (($9) - ($5))|0;
 $11 = (-2 - ($5))|0;
 $12 = (($9) + 2)|0;
 $13 = ((($big$i)) + 288|0);
 $14 = ((($buf$i)) + 9|0);
 $15 = $14;
 $16 = ((($buf$i)) + 8|0);
 $cnt$0 = 0;$l$0 = 0;$l10n$0 = 0;$s$0 = $fmt;
 L1: while(1) {
  $17 = ($cnt$0|0)>(-1);
  do {
   if ($17) {
    $18 = (2147483647 - ($cnt$0))|0;
    $19 = ($l$0|0)>($18|0);
    if ($19) {
     $20 = (___errno_location()|0);
     HEAP32[$20>>2] = 75;
     $cnt$1 = -1;
     break;
    } else {
     $21 = (($l$0) + ($cnt$0))|0;
     $cnt$1 = $21;
     break;
    }
   } else {
    $cnt$1 = $cnt$0;
   }
  } while(0);
  $22 = HEAP8[$s$0>>0]|0;
  $23 = ($22<<24>>24)==(0);
  if ($23) {
   $cnt$1$lcssa = $cnt$1;$l10n$0$lcssa = $l10n$0;
   label = 244;
   break;
  } else {
   $24 = $22;$s$1 = $s$0;
  }
  L9: while(1) {
   switch ($24<<24>>24) {
   case 37:  {
    $s$292 = $s$1;$z$093 = $s$1;
    label = 9;
    break L9;
    break;
   }
   case 0:  {
    $s$2$lcssa = $s$1;$z$0$lcssa = $s$1;
    break L9;
    break;
   }
   default: {
   }
   }
   $25 = ((($s$1)) + 1|0);
   $$pre = HEAP8[$25>>0]|0;
   $24 = $$pre;$s$1 = $25;
  }
  L12: do {
   if ((label|0) == 9) {
    while(1) {
     label = 0;
     $26 = ((($s$292)) + 1|0);
     $27 = HEAP8[$26>>0]|0;
     $28 = ($27<<24>>24)==(37);
     if (!($28)) {
      $s$2$lcssa = $s$292;$z$0$lcssa = $z$093;
      break L12;
     }
     $29 = ((($z$093)) + 1|0);
     $30 = ((($s$292)) + 2|0);
     $31 = HEAP8[$30>>0]|0;
     $32 = ($31<<24>>24)==(37);
     if ($32) {
      $s$292 = $30;$z$093 = $29;
      label = 9;
     } else {
      $s$2$lcssa = $30;$z$0$lcssa = $29;
      break;
     }
    }
   }
  } while(0);
  $33 = $z$0$lcssa;
  $34 = $s$0;
  $35 = (($33) - ($34))|0;
  if ($0) {
   $36 = HEAP32[$f>>2]|0;
   $37 = $36 & 32;
   $38 = ($37|0)==(0);
   if ($38) {
    (___fwritex($s$0,$35,$f)|0);
   }
  }
  $39 = ($z$0$lcssa|0)==($s$0|0);
  if (!($39)) {
   $l10n$0$phi = $l10n$0;$cnt$0 = $cnt$1;$l$0 = $35;$s$0 = $s$2$lcssa;$l10n$0 = $l10n$0$phi;
   continue;
  }
  $40 = ((($s$2$lcssa)) + 1|0);
  $41 = HEAP8[$40>>0]|0;
  $42 = $41 << 24 >> 24;
  $isdigittmp = (($42) + -48)|0;
  $isdigit = ($isdigittmp>>>0)<(10);
  if ($isdigit) {
   $43 = ((($s$2$lcssa)) + 2|0);
   $44 = HEAP8[$43>>0]|0;
   $45 = ($44<<24>>24)==(36);
   $46 = ((($s$2$lcssa)) + 3|0);
   $$43 = $45 ? $46 : $40;
   $$l10n$0 = $45 ? 1 : $l10n$0;
   $isdigittmp$ = $45 ? $isdigittmp : -1;
   $$pre170 = HEAP8[$$43>>0]|0;
   $48 = $$pre170;$argpos$0 = $isdigittmp$;$l10n$1 = $$l10n$0;$storemerge = $$43;
  } else {
   $48 = $41;$argpos$0 = -1;$l10n$1 = $l10n$0;$storemerge = $40;
  }
  $47 = $48 << 24 >> 24;
  $49 = $47 & -32;
  $50 = ($49|0)==(32);
  L25: do {
   if ($50) {
    $52 = $47;$57 = $48;$fl$0100 = 0;$storemerge899 = $storemerge;
    while(1) {
     $51 = (($52) + -32)|0;
     $53 = 1 << $51;
     $54 = $53 & 75913;
     $55 = ($54|0)==(0);
     if ($55) {
      $67 = $57;$fl$053 = $fl$0100;$storemerge851 = $storemerge899;
      break L25;
     }
     $56 = $57 << 24 >> 24;
     $58 = (($56) + -32)|0;
     $59 = 1 << $58;
     $60 = $59 | $fl$0100;
     $61 = ((($storemerge899)) + 1|0);
     $62 = HEAP8[$61>>0]|0;
     $63 = $62 << 24 >> 24;
     $64 = $63 & -32;
     $65 = ($64|0)==(32);
     if ($65) {
      $52 = $63;$57 = $62;$fl$0100 = $60;$storemerge899 = $61;
     } else {
      $67 = $62;$fl$053 = $60;$storemerge851 = $61;
      break;
     }
    }
   } else {
    $67 = $48;$fl$053 = 0;$storemerge851 = $storemerge;
   }
  } while(0);
  $66 = ($67<<24>>24)==(42);
  do {
   if ($66) {
    $68 = ((($storemerge851)) + 1|0);
    $69 = HEAP8[$68>>0]|0;
    $70 = $69 << 24 >> 24;
    $isdigittmp11 = (($70) + -48)|0;
    $isdigit12 = ($isdigittmp11>>>0)<(10);
    if ($isdigit12) {
     $71 = ((($storemerge851)) + 2|0);
     $72 = HEAP8[$71>>0]|0;
     $73 = ($72<<24>>24)==(36);
     if ($73) {
      $74 = (($nl_type) + ($isdigittmp11<<2)|0);
      HEAP32[$74>>2] = 10;
      $75 = HEAP8[$68>>0]|0;
      $76 = $75 << 24 >> 24;
      $77 = (($76) + -48)|0;
      $78 = (($nl_arg) + ($77<<3)|0);
      $79 = $78;
      $80 = $79;
      $81 = HEAP32[$80>>2]|0;
      $82 = (($79) + 4)|0;
      $83 = $82;
      $84 = HEAP32[$83>>2]|0;
      $85 = ((($storemerge851)) + 3|0);
      $l10n$2 = 1;$storemerge13 = $85;$w$0 = $81;
     } else {
      label = 24;
     }
    } else {
     label = 24;
    }
    if ((label|0) == 24) {
     label = 0;
     $86 = ($l10n$1|0)==(0);
     if (!($86)) {
      $$0 = -1;
      break L1;
     }
     if (!($0)) {
      $fl$1 = $fl$053;$l10n$3 = 0;$s$4 = $68;$w$1 = 0;
      break;
     }
     $arglist_current = HEAP32[$ap>>2]|0;
     $87 = $arglist_current;
     $88 = ((0) + 4|0);
     $expanded4 = $88;
     $expanded = (($expanded4) - 1)|0;
     $89 = (($87) + ($expanded))|0;
     $90 = ((0) + 4|0);
     $expanded8 = $90;
     $expanded7 = (($expanded8) - 1)|0;
     $expanded6 = $expanded7 ^ -1;
     $91 = $89 & $expanded6;
     $92 = $91;
     $93 = HEAP32[$92>>2]|0;
     $arglist_next = ((($92)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next;
     $l10n$2 = 0;$storemerge13 = $68;$w$0 = $93;
    }
    $94 = ($w$0|0)<(0);
    if ($94) {
     $95 = $fl$053 | 8192;
     $96 = (0 - ($w$0))|0;
     $fl$1 = $95;$l10n$3 = $l10n$2;$s$4 = $storemerge13;$w$1 = $96;
    } else {
     $fl$1 = $fl$053;$l10n$3 = $l10n$2;$s$4 = $storemerge13;$w$1 = $w$0;
    }
   } else {
    $97 = $67 << 24 >> 24;
    $isdigittmp1$i = (($97) + -48)|0;
    $isdigit2$i = ($isdigittmp1$i>>>0)<(10);
    if ($isdigit2$i) {
     $101 = $storemerge851;$i$03$i = 0;$isdigittmp4$i = $isdigittmp1$i;
     while(1) {
      $98 = ($i$03$i*10)|0;
      $99 = (($98) + ($isdigittmp4$i))|0;
      $100 = ((($101)) + 1|0);
      $102 = HEAP8[$100>>0]|0;
      $103 = $102 << 24 >> 24;
      $isdigittmp$i = (($103) + -48)|0;
      $isdigit$i = ($isdigittmp$i>>>0)<(10);
      if ($isdigit$i) {
       $101 = $100;$i$03$i = $99;$isdigittmp4$i = $isdigittmp$i;
      } else {
       $$lcssa = $99;$$lcssa295 = $100;
       break;
      }
     }
     $104 = ($$lcssa|0)<(0);
     if ($104) {
      $$0 = -1;
      break L1;
     } else {
      $fl$1 = $fl$053;$l10n$3 = $l10n$1;$s$4 = $$lcssa295;$w$1 = $$lcssa;
     }
    } else {
     $fl$1 = $fl$053;$l10n$3 = $l10n$1;$s$4 = $storemerge851;$w$1 = 0;
    }
   }
  } while(0);
  $105 = HEAP8[$s$4>>0]|0;
  $106 = ($105<<24>>24)==(46);
  L46: do {
   if ($106) {
    $107 = ((($s$4)) + 1|0);
    $108 = HEAP8[$107>>0]|0;
    $109 = ($108<<24>>24)==(42);
    if (!($109)) {
     $136 = $108 << 24 >> 24;
     $isdigittmp1$i22 = (($136) + -48)|0;
     $isdigit2$i23 = ($isdigittmp1$i22>>>0)<(10);
     if ($isdigit2$i23) {
      $140 = $107;$i$03$i25 = 0;$isdigittmp4$i24 = $isdigittmp1$i22;
     } else {
      $p$0 = 0;$s$6 = $107;
      break;
     }
     while(1) {
      $137 = ($i$03$i25*10)|0;
      $138 = (($137) + ($isdigittmp4$i24))|0;
      $139 = ((($140)) + 1|0);
      $141 = HEAP8[$139>>0]|0;
      $142 = $141 << 24 >> 24;
      $isdigittmp$i26 = (($142) + -48)|0;
      $isdigit$i27 = ($isdigittmp$i26>>>0)<(10);
      if ($isdigit$i27) {
       $140 = $139;$i$03$i25 = $138;$isdigittmp4$i24 = $isdigittmp$i26;
      } else {
       $p$0 = $138;$s$6 = $139;
       break L46;
      }
     }
    }
    $110 = ((($s$4)) + 2|0);
    $111 = HEAP8[$110>>0]|0;
    $112 = $111 << 24 >> 24;
    $isdigittmp9 = (($112) + -48)|0;
    $isdigit10 = ($isdigittmp9>>>0)<(10);
    if ($isdigit10) {
     $113 = ((($s$4)) + 3|0);
     $114 = HEAP8[$113>>0]|0;
     $115 = ($114<<24>>24)==(36);
     if ($115) {
      $116 = (($nl_type) + ($isdigittmp9<<2)|0);
      HEAP32[$116>>2] = 10;
      $117 = HEAP8[$110>>0]|0;
      $118 = $117 << 24 >> 24;
      $119 = (($118) + -48)|0;
      $120 = (($nl_arg) + ($119<<3)|0);
      $121 = $120;
      $122 = $121;
      $123 = HEAP32[$122>>2]|0;
      $124 = (($121) + 4)|0;
      $125 = $124;
      $126 = HEAP32[$125>>2]|0;
      $127 = ((($s$4)) + 4|0);
      $p$0 = $123;$s$6 = $127;
      break;
     }
    }
    $128 = ($l10n$3|0)==(0);
    if (!($128)) {
     $$0 = -1;
     break L1;
    }
    if ($0) {
     $arglist_current2 = HEAP32[$ap>>2]|0;
     $129 = $arglist_current2;
     $130 = ((0) + 4|0);
     $expanded11 = $130;
     $expanded10 = (($expanded11) - 1)|0;
     $131 = (($129) + ($expanded10))|0;
     $132 = ((0) + 4|0);
     $expanded15 = $132;
     $expanded14 = (($expanded15) - 1)|0;
     $expanded13 = $expanded14 ^ -1;
     $133 = $131 & $expanded13;
     $134 = $133;
     $135 = HEAP32[$134>>2]|0;
     $arglist_next3 = ((($134)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next3;
     $p$0 = $135;$s$6 = $110;
    } else {
     $p$0 = 0;$s$6 = $110;
    }
   } else {
    $p$0 = -1;$s$6 = $s$4;
   }
  } while(0);
  $s$7 = $s$6;$st$0 = 0;
  while(1) {
   $143 = HEAP8[$s$7>>0]|0;
   $144 = $143 << 24 >> 24;
   $145 = (($144) + -65)|0;
   $146 = ($145>>>0)>(57);
   if ($146) {
    $$0 = -1;
    break L1;
   }
   $147 = ((($s$7)) + 1|0);
   $148 = ((4401 + (($st$0*58)|0)|0) + ($145)|0);
   $149 = HEAP8[$148>>0]|0;
   $150 = $149&255;
   $151 = (($150) + -1)|0;
   $152 = ($151>>>0)<(8);
   if ($152) {
    $s$7 = $147;$st$0 = $150;
   } else {
    $$lcssa300 = $147;$$lcssa301 = $149;$$lcssa302 = $150;$s$7$lcssa298 = $s$7;$st$0$lcssa299 = $st$0;
    break;
   }
  }
  $153 = ($$lcssa301<<24>>24)==(0);
  if ($153) {
   $$0 = -1;
   break;
  }
  $154 = ($$lcssa301<<24>>24)==(19);
  $155 = ($argpos$0|0)>(-1);
  do {
   if ($154) {
    if ($155) {
     $$0 = -1;
     break L1;
    } else {
     label = 52;
    }
   } else {
    if ($155) {
     $156 = (($nl_type) + ($argpos$0<<2)|0);
     HEAP32[$156>>2] = $$lcssa302;
     $157 = (($nl_arg) + ($argpos$0<<3)|0);
     $158 = $157;
     $159 = $158;
     $160 = HEAP32[$159>>2]|0;
     $161 = (($158) + 4)|0;
     $162 = $161;
     $163 = HEAP32[$162>>2]|0;
     $164 = $arg;
     $165 = $164;
     HEAP32[$165>>2] = $160;
     $166 = (($164) + 4)|0;
     $167 = $166;
     HEAP32[$167>>2] = $163;
     label = 52;
     break;
    }
    if (!($0)) {
     $$0 = 0;
     break L1;
    }
    _pop_arg($arg,$$lcssa302,$ap);
   }
  } while(0);
  if ((label|0) == 52) {
   label = 0;
   if (!($0)) {
    $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
    continue;
   }
  }
  $168 = HEAP8[$s$7$lcssa298>>0]|0;
  $169 = $168 << 24 >> 24;
  $170 = ($st$0$lcssa299|0)!=(0);
  $171 = $169 & 15;
  $172 = ($171|0)==(3);
  $or$cond15 = $170 & $172;
  $173 = $169 & -33;
  $t$0 = $or$cond15 ? $173 : $169;
  $174 = $fl$1 & 8192;
  $175 = ($174|0)==(0);
  $176 = $fl$1 & -65537;
  $fl$1$ = $175 ? $fl$1 : $176;
  L75: do {
   switch ($t$0|0) {
   case 110:  {
    switch ($st$0$lcssa299|0) {
    case 0:  {
     $183 = HEAP32[$arg>>2]|0;
     HEAP32[$183>>2] = $cnt$1;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 1:  {
     $184 = HEAP32[$arg>>2]|0;
     HEAP32[$184>>2] = $cnt$1;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 2:  {
     $185 = ($cnt$1|0)<(0);
     $186 = $185 << 31 >> 31;
     $187 = HEAP32[$arg>>2]|0;
     $188 = $187;
     $189 = $188;
     HEAP32[$189>>2] = $cnt$1;
     $190 = (($188) + 4)|0;
     $191 = $190;
     HEAP32[$191>>2] = $186;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 3:  {
     $192 = $cnt$1&65535;
     $193 = HEAP32[$arg>>2]|0;
     HEAP16[$193>>1] = $192;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 4:  {
     $194 = $cnt$1&255;
     $195 = HEAP32[$arg>>2]|0;
     HEAP8[$195>>0] = $194;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 6:  {
     $196 = HEAP32[$arg>>2]|0;
     HEAP32[$196>>2] = $cnt$1;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 7:  {
     $197 = ($cnt$1|0)<(0);
     $198 = $197 << 31 >> 31;
     $199 = HEAP32[$arg>>2]|0;
     $200 = $199;
     $201 = $200;
     HEAP32[$201>>2] = $cnt$1;
     $202 = (($200) + 4)|0;
     $203 = $202;
     HEAP32[$203>>2] = $198;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    default: {
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
    }
    }
    break;
   }
   case 112:  {
    $204 = ($p$0>>>0)>(8);
    $205 = $204 ? $p$0 : 8;
    $206 = $fl$1$ | 8;
    $fl$3 = $206;$p$1 = $205;$t$1 = 120;
    label = 64;
    break;
   }
   case 88: case 120:  {
    $fl$3 = $fl$1$;$p$1 = $p$0;$t$1 = $t$0;
    label = 64;
    break;
   }
   case 111:  {
    $244 = $arg;
    $245 = $244;
    $246 = HEAP32[$245>>2]|0;
    $247 = (($244) + 4)|0;
    $248 = $247;
    $249 = HEAP32[$248>>2]|0;
    $250 = ($246|0)==(0);
    $251 = ($249|0)==(0);
    $252 = $250 & $251;
    if ($252) {
     $$0$lcssa$i = $1;
    } else {
     $$03$i33 = $1;$254 = $246;$258 = $249;
     while(1) {
      $253 = $254 & 7;
      $255 = $253 | 48;
      $256 = $255&255;
      $257 = ((($$03$i33)) + -1|0);
      HEAP8[$257>>0] = $256;
      $259 = (_bitshift64Lshr(($254|0),($258|0),3)|0);
      $260 = tempRet0;
      $261 = ($259|0)==(0);
      $262 = ($260|0)==(0);
      $263 = $261 & $262;
      if ($263) {
       $$0$lcssa$i = $257;
       break;
      } else {
       $$03$i33 = $257;$254 = $259;$258 = $260;
      }
     }
    }
    $264 = $fl$1$ & 8;
    $265 = ($264|0)==(0);
    if ($265) {
     $a$0 = $$0$lcssa$i;$fl$4 = $fl$1$;$p$2 = $p$0;$pl$1 = 0;$prefix$1 = 4881;
     label = 77;
    } else {
     $266 = $$0$lcssa$i;
     $267 = (($2) - ($266))|0;
     $268 = ($p$0|0)>($267|0);
     $269 = (($267) + 1)|0;
     $p$0$ = $268 ? $p$0 : $269;
     $a$0 = $$0$lcssa$i;$fl$4 = $fl$1$;$p$2 = $p$0$;$pl$1 = 0;$prefix$1 = 4881;
     label = 77;
    }
    break;
   }
   case 105: case 100:  {
    $270 = $arg;
    $271 = $270;
    $272 = HEAP32[$271>>2]|0;
    $273 = (($270) + 4)|0;
    $274 = $273;
    $275 = HEAP32[$274>>2]|0;
    $276 = ($275|0)<(0);
    if ($276) {
     $277 = (_i64Subtract(0,0,($272|0),($275|0))|0);
     $278 = tempRet0;
     $279 = $arg;
     $280 = $279;
     HEAP32[$280>>2] = $277;
     $281 = (($279) + 4)|0;
     $282 = $281;
     HEAP32[$282>>2] = $278;
     $287 = $277;$288 = $278;$pl$0 = 1;$prefix$0 = 4881;
     label = 76;
     break L75;
    }
    $283 = $fl$1$ & 2048;
    $284 = ($283|0)==(0);
    if ($284) {
     $285 = $fl$1$ & 1;
     $286 = ($285|0)==(0);
     $$ = $286 ? 4881 : (4883);
     $287 = $272;$288 = $275;$pl$0 = $285;$prefix$0 = $$;
     label = 76;
    } else {
     $287 = $272;$288 = $275;$pl$0 = 1;$prefix$0 = (4882);
     label = 76;
    }
    break;
   }
   case 117:  {
    $177 = $arg;
    $178 = $177;
    $179 = HEAP32[$178>>2]|0;
    $180 = (($177) + 4)|0;
    $181 = $180;
    $182 = HEAP32[$181>>2]|0;
    $287 = $179;$288 = $182;$pl$0 = 0;$prefix$0 = 4881;
    label = 76;
    break;
   }
   case 99:  {
    $308 = $arg;
    $309 = $308;
    $310 = HEAP32[$309>>2]|0;
    $311 = (($308) + 4)|0;
    $312 = $311;
    $313 = HEAP32[$312>>2]|0;
    $314 = $310&255;
    HEAP8[$3>>0] = $314;
    $a$2 = $3;$fl$6 = $176;$p$5 = 1;$pl$2 = 0;$prefix$2 = 4881;$z$2 = $1;
    break;
   }
   case 109:  {
    $315 = (___errno_location()|0);
    $316 = HEAP32[$315>>2]|0;
    $317 = (_strerror($316)|0);
    $a$1 = $317;
    label = 82;
    break;
   }
   case 115:  {
    $318 = HEAP32[$arg>>2]|0;
    $319 = ($318|0)!=(0|0);
    $320 = $319 ? $318 : 6783;
    $a$1 = $320;
    label = 82;
    break;
   }
   case 67:  {
    $327 = $arg;
    $328 = $327;
    $329 = HEAP32[$328>>2]|0;
    $330 = (($327) + 4)|0;
    $331 = $330;
    $332 = HEAP32[$331>>2]|0;
    HEAP32[$wc>>2] = $329;
    HEAP32[$4>>2] = 0;
    HEAP32[$arg>>2] = $wc;
    $798 = $wc;$p$4176 = -1;
    label = 86;
    break;
   }
   case 83:  {
    $$pre171 = HEAP32[$arg>>2]|0;
    $333 = ($p$0|0)==(0);
    if ($333) {
     _pad($f,32,$w$1,0,$fl$1$);
     $i$0$lcssa178 = 0;
     label = 97;
    } else {
     $798 = $$pre171;$p$4176 = $p$0;
     label = 86;
    }
    break;
   }
   case 65: case 71: case 70: case 69: case 97: case 103: case 102: case 101:  {
    $358 = +HEAPF64[$arg>>3];
    HEAP32[$e2$i>>2] = 0;
    HEAPF64[tempDoublePtr>>3] = $358;$359 = HEAP32[tempDoublePtr>>2]|0;
    $360 = HEAP32[tempDoublePtr+4>>2]|0;
    $361 = ($360|0)<(0);
    if ($361) {
     $362 = -$358;
     $$07$i = $362;$pl$0$i = 1;$prefix$0$i = 6790;
    } else {
     $363 = $fl$1$ & 2048;
     $364 = ($363|0)==(0);
     if ($364) {
      $365 = $fl$1$ & 1;
      $366 = ($365|0)==(0);
      $$$i = $366 ? (6791) : (6796);
      $$07$i = $358;$pl$0$i = $365;$prefix$0$i = $$$i;
     } else {
      $$07$i = $358;$pl$0$i = 1;$prefix$0$i = (6793);
     }
    }
    HEAPF64[tempDoublePtr>>3] = $$07$i;$367 = HEAP32[tempDoublePtr>>2]|0;
    $368 = HEAP32[tempDoublePtr+4>>2]|0;
    $369 = $368 & 2146435072;
    $370 = ($369>>>0)<(2146435072);
    $371 = (0)<(0);
    $372 = ($369|0)==(2146435072);
    $373 = $372 & $371;
    $374 = $370 | $373;
    do {
     if ($374) {
      $390 = (+_frexpl($$07$i,$e2$i));
      $391 = $390 * 2.0;
      $392 = $391 != 0.0;
      if ($392) {
       $393 = HEAP32[$e2$i>>2]|0;
       $394 = (($393) + -1)|0;
       HEAP32[$e2$i>>2] = $394;
      }
      $395 = $t$0 | 32;
      $396 = ($395|0)==(97);
      if ($396) {
       $397 = $t$0 & 32;
       $398 = ($397|0)==(0);
       $399 = ((($prefix$0$i)) + 9|0);
       $prefix$0$$i = $398 ? $prefix$0$i : $399;
       $400 = $pl$0$i | 2;
       $401 = ($p$0>>>0)>(11);
       $402 = (12 - ($p$0))|0;
       $403 = ($402|0)==(0);
       $404 = $401 | $403;
       do {
        if ($404) {
         $$1$i = $391;
        } else {
         $re$171$i = $402;$round$070$i = 8.0;
         while(1) {
          $405 = (($re$171$i) + -1)|0;
          $406 = $round$070$i * 16.0;
          $407 = ($405|0)==(0);
          if ($407) {
           $$lcssa319 = $406;
           break;
          } else {
           $re$171$i = $405;$round$070$i = $406;
          }
         }
         $408 = HEAP8[$prefix$0$$i>>0]|0;
         $409 = ($408<<24>>24)==(45);
         if ($409) {
          $410 = -$391;
          $411 = $410 - $$lcssa319;
          $412 = $$lcssa319 + $411;
          $413 = -$412;
          $$1$i = $413;
          break;
         } else {
          $414 = $391 + $$lcssa319;
          $415 = $414 - $$lcssa319;
          $$1$i = $415;
          break;
         }
        }
       } while(0);
       $416 = HEAP32[$e2$i>>2]|0;
       $417 = ($416|0)<(0);
       $418 = (0 - ($416))|0;
       $419 = $417 ? $418 : $416;
       $420 = ($419|0)<(0);
       $421 = $420 << 31 >> 31;
       $422 = (_fmt_u($419,$421,$7)|0);
       $423 = ($422|0)==($7|0);
       if ($423) {
        HEAP8[$8>>0] = 48;
        $estr$0$i = $8;
       } else {
        $estr$0$i = $422;
       }
       $424 = $416 >> 31;
       $425 = $424 & 2;
       $426 = (($425) + 43)|0;
       $427 = $426&255;
       $428 = ((($estr$0$i)) + -1|0);
       HEAP8[$428>>0] = $427;
       $429 = (($t$0) + 15)|0;
       $430 = $429&255;
       $431 = ((($estr$0$i)) + -2|0);
       HEAP8[$431>>0] = $430;
       $notrhs$i = ($p$0|0)<(1);
       $432 = $fl$1$ & 8;
       $433 = ($432|0)==(0);
       $$2$i = $$1$i;$s$0$i = $buf$i;
       while(1) {
        $434 = (~~(($$2$i)));
        $435 = (4865 + ($434)|0);
        $436 = HEAP8[$435>>0]|0;
        $437 = $436&255;
        $438 = $437 | $397;
        $439 = $438&255;
        $440 = ((($s$0$i)) + 1|0);
        HEAP8[$s$0$i>>0] = $439;
        $441 = (+($434|0));
        $442 = $$2$i - $441;
        $443 = $442 * 16.0;
        $444 = $440;
        $445 = (($444) - ($5))|0;
        $446 = ($445|0)==(1);
        do {
         if ($446) {
          $notlhs$i = $443 == 0.0;
          $or$cond3$not$i = $notrhs$i & $notlhs$i;
          $or$cond$i = $433 & $or$cond3$not$i;
          if ($or$cond$i) {
           $s$1$i = $440;
           break;
          }
          $447 = ((($s$0$i)) + 2|0);
          HEAP8[$440>>0] = 46;
          $s$1$i = $447;
         } else {
          $s$1$i = $440;
         }
        } while(0);
        $448 = $443 != 0.0;
        if ($448) {
         $$2$i = $443;$s$0$i = $s$1$i;
        } else {
         $s$1$i$lcssa = $s$1$i;
         break;
        }
       }
       $449 = ($p$0|0)!=(0);
       $$pre188$i = $s$1$i$lcssa;
       $450 = (($11) + ($$pre188$i))|0;
       $451 = ($450|0)<($p$0|0);
       $or$cond122 = $449 & $451;
       $452 = $431;
       $453 = (($12) + ($p$0))|0;
       $454 = (($453) - ($452))|0;
       $455 = (($10) - ($452))|0;
       $456 = (($455) + ($$pre188$i))|0;
       $l$0$i = $or$cond122 ? $454 : $456;
       $457 = (($l$0$i) + ($400))|0;
       _pad($f,32,$w$1,$457,$fl$1$);
       $458 = HEAP32[$f>>2]|0;
       $459 = $458 & 32;
       $460 = ($459|0)==(0);
       if ($460) {
        (___fwritex($prefix$0$$i,$400,$f)|0);
       }
       $461 = $fl$1$ ^ 65536;
       _pad($f,48,$w$1,$457,$461);
       $462 = (($$pre188$i) - ($5))|0;
       $463 = HEAP32[$f>>2]|0;
       $464 = $463 & 32;
       $465 = ($464|0)==(0);
       if ($465) {
        (___fwritex($buf$i,$462,$f)|0);
       }
       $466 = (($9) - ($452))|0;
       $sum = (($462) + ($466))|0;
       $467 = (($l$0$i) - ($sum))|0;
       _pad($f,48,$467,0,0);
       $468 = HEAP32[$f>>2]|0;
       $469 = $468 & 32;
       $470 = ($469|0)==(0);
       if ($470) {
        (___fwritex($431,$466,$f)|0);
       }
       $471 = $fl$1$ ^ 8192;
       _pad($f,32,$w$1,$457,$471);
       $472 = ($457|0)<($w$1|0);
       $w$$i = $472 ? $w$1 : $457;
       $$0$i = $w$$i;
       break;
      }
      $473 = ($p$0|0)<(0);
      $$p$i = $473 ? 6 : $p$0;
      if ($392) {
       $474 = $391 * 268435456.0;
       $475 = HEAP32[$e2$i>>2]|0;
       $476 = (($475) + -28)|0;
       HEAP32[$e2$i>>2] = $476;
       $$3$i = $474;$478 = $476;
      } else {
       $$pre185$i = HEAP32[$e2$i>>2]|0;
       $$3$i = $391;$478 = $$pre185$i;
      }
      $477 = ($478|0)<(0);
      $$33$i = $477 ? $big$i : $13;
      $479 = $$33$i;
      $$4$i = $$3$i;$z$0$i = $$33$i;
      while(1) {
       $480 = (~~(($$4$i))>>>0);
       HEAP32[$z$0$i>>2] = $480;
       $481 = ((($z$0$i)) + 4|0);
       $482 = (+($480>>>0));
       $483 = $$4$i - $482;
       $484 = $483 * 1.0E+9;
       $485 = $484 != 0.0;
       if ($485) {
        $$4$i = $484;$z$0$i = $481;
       } else {
        $$lcssa303 = $481;
        break;
       }
      }
      $$pr$i = HEAP32[$e2$i>>2]|0;
      $486 = ($$pr$i|0)>(0);
      if ($486) {
       $488 = $$pr$i;$a$1149$i = $$33$i;$z$1148$i = $$lcssa303;
       while(1) {
        $487 = ($488|0)>(29);
        $489 = $487 ? 29 : $488;
        $d$0141$i = ((($z$1148$i)) + -4|0);
        $490 = ($d$0141$i>>>0)<($a$1149$i>>>0);
        do {
         if ($490) {
          $a$2$ph$i = $a$1149$i;
         } else {
          $carry$0142$i = 0;$d$0143$i = $d$0141$i;
          while(1) {
           $491 = HEAP32[$d$0143$i>>2]|0;
           $492 = (_bitshift64Shl(($491|0),0,($489|0))|0);
           $493 = tempRet0;
           $494 = (_i64Add(($492|0),($493|0),($carry$0142$i|0),0)|0);
           $495 = tempRet0;
           $496 = (___uremdi3(($494|0),($495|0),1000000000,0)|0);
           $497 = tempRet0;
           HEAP32[$d$0143$i>>2] = $496;
           $498 = (___udivdi3(($494|0),($495|0),1000000000,0)|0);
           $499 = tempRet0;
           $d$0$i = ((($d$0143$i)) + -4|0);
           $500 = ($d$0$i>>>0)<($a$1149$i>>>0);
           if ($500) {
            $$lcssa304 = $498;
            break;
           } else {
            $carry$0142$i = $498;$d$0143$i = $d$0$i;
           }
          }
          $501 = ($$lcssa304|0)==(0);
          if ($501) {
           $a$2$ph$i = $a$1149$i;
           break;
          }
          $502 = ((($a$1149$i)) + -4|0);
          HEAP32[$502>>2] = $$lcssa304;
          $a$2$ph$i = $502;
         }
        } while(0);
        $z$2$i = $z$1148$i;
        while(1) {
         $503 = ($z$2$i>>>0)>($a$2$ph$i>>>0);
         if (!($503)) {
          $z$2$i$lcssa = $z$2$i;
          break;
         }
         $504 = ((($z$2$i)) + -4|0);
         $505 = HEAP32[$504>>2]|0;
         $506 = ($505|0)==(0);
         if ($506) {
          $z$2$i = $504;
         } else {
          $z$2$i$lcssa = $z$2$i;
          break;
         }
        }
        $507 = HEAP32[$e2$i>>2]|0;
        $508 = (($507) - ($489))|0;
        HEAP32[$e2$i>>2] = $508;
        $509 = ($508|0)>(0);
        if ($509) {
         $488 = $508;$a$1149$i = $a$2$ph$i;$z$1148$i = $z$2$i$lcssa;
        } else {
         $$pr50$i = $508;$a$1$lcssa$i = $a$2$ph$i;$z$1$lcssa$i = $z$2$i$lcssa;
         break;
        }
       }
      } else {
       $$pr50$i = $$pr$i;$a$1$lcssa$i = $$33$i;$z$1$lcssa$i = $$lcssa303;
      }
      $510 = ($$pr50$i|0)<(0);
      if ($510) {
       $511 = (($$p$i) + 25)|0;
       $512 = (($511|0) / 9)&-1;
       $513 = (($512) + 1)|0;
       $514 = ($395|0)==(102);
       $516 = $$pr50$i;$a$3136$i = $a$1$lcssa$i;$z$3135$i = $z$1$lcssa$i;
       while(1) {
        $515 = (0 - ($516))|0;
        $517 = ($515|0)>(9);
        $518 = $517 ? 9 : $515;
        $519 = ($a$3136$i>>>0)<($z$3135$i>>>0);
        do {
         if ($519) {
          $523 = 1 << $518;
          $524 = (($523) + -1)|0;
          $525 = 1000000000 >>> $518;
          $carry3$0130$i = 0;$d$1129$i = $a$3136$i;
          while(1) {
           $526 = HEAP32[$d$1129$i>>2]|0;
           $527 = $526 & $524;
           $528 = $526 >>> $518;
           $529 = (($528) + ($carry3$0130$i))|0;
           HEAP32[$d$1129$i>>2] = $529;
           $530 = Math_imul($527, $525)|0;
           $531 = ((($d$1129$i)) + 4|0);
           $532 = ($531>>>0)<($z$3135$i>>>0);
           if ($532) {
            $carry3$0130$i = $530;$d$1129$i = $531;
           } else {
            $$lcssa306 = $530;
            break;
           }
          }
          $533 = HEAP32[$a$3136$i>>2]|0;
          $534 = ($533|0)==(0);
          $535 = ((($a$3136$i)) + 4|0);
          $$a$3$i = $534 ? $535 : $a$3136$i;
          $536 = ($$lcssa306|0)==(0);
          if ($536) {
           $$a$3192$i = $$a$3$i;$z$4$i = $z$3135$i;
           break;
          }
          $537 = ((($z$3135$i)) + 4|0);
          HEAP32[$z$3135$i>>2] = $$lcssa306;
          $$a$3192$i = $$a$3$i;$z$4$i = $537;
         } else {
          $520 = HEAP32[$a$3136$i>>2]|0;
          $521 = ($520|0)==(0);
          $522 = ((($a$3136$i)) + 4|0);
          $$a$3191$i = $521 ? $522 : $a$3136$i;
          $$a$3192$i = $$a$3191$i;$z$4$i = $z$3135$i;
         }
        } while(0);
        $538 = $514 ? $$33$i : $$a$3192$i;
        $539 = $z$4$i;
        $540 = $538;
        $541 = (($539) - ($540))|0;
        $542 = $541 >> 2;
        $543 = ($542|0)>($513|0);
        $544 = (($538) + ($513<<2)|0);
        $$z$4$i = $543 ? $544 : $z$4$i;
        $545 = HEAP32[$e2$i>>2]|0;
        $546 = (($545) + ($518))|0;
        HEAP32[$e2$i>>2] = $546;
        $547 = ($546|0)<(0);
        if ($547) {
         $516 = $546;$a$3136$i = $$a$3192$i;$z$3135$i = $$z$4$i;
        } else {
         $a$3$lcssa$i = $$a$3192$i;$z$3$lcssa$i = $$z$4$i;
         break;
        }
       }
      } else {
       $a$3$lcssa$i = $a$1$lcssa$i;$z$3$lcssa$i = $z$1$lcssa$i;
      }
      $548 = ($a$3$lcssa$i>>>0)<($z$3$lcssa$i>>>0);
      do {
       if ($548) {
        $549 = $a$3$lcssa$i;
        $550 = (($479) - ($549))|0;
        $551 = $550 >> 2;
        $552 = ($551*9)|0;
        $553 = HEAP32[$a$3$lcssa$i>>2]|0;
        $554 = ($553>>>0)<(10);
        if ($554) {
         $e$1$i = $552;
         break;
        } else {
         $e$0125$i = $552;$i$0124$i = 10;
        }
        while(1) {
         $555 = ($i$0124$i*10)|0;
         $556 = (($e$0125$i) + 1)|0;
         $557 = ($553>>>0)<($555>>>0);
         if ($557) {
          $e$1$i = $556;
          break;
         } else {
          $e$0125$i = $556;$i$0124$i = $555;
         }
        }
       } else {
        $e$1$i = 0;
       }
      } while(0);
      $558 = ($395|0)!=(102);
      $559 = $558 ? $e$1$i : 0;
      $560 = (($$p$i) - ($559))|0;
      $561 = ($395|0)==(103);
      $562 = ($$p$i|0)!=(0);
      $563 = $562 & $561;
      $$neg55$i = $563 << 31 >> 31;
      $564 = (($560) + ($$neg55$i))|0;
      $565 = $z$3$lcssa$i;
      $566 = (($565) - ($479))|0;
      $567 = $566 >> 2;
      $568 = ($567*9)|0;
      $569 = (($568) + -9)|0;
      $570 = ($564|0)<($569|0);
      if ($570) {
       $571 = ((($$33$i)) + 4|0);
       $572 = (($564) + 9216)|0;
       $573 = (($572|0) / 9)&-1;
       $574 = (($573) + -1024)|0;
       $575 = (($571) + ($574<<2)|0);
       $576 = (($572|0) % 9)&-1;
       $j$0117$i = (($576) + 1)|0;
       $577 = ($j$0117$i|0)<(9);
       if ($577) {
        $i$1118$i = 10;$j$0119$i = $j$0117$i;
        while(1) {
         $578 = ($i$1118$i*10)|0;
         $j$0$i = (($j$0119$i) + 1)|0;
         $exitcond$i = ($j$0$i|0)==(9);
         if ($exitcond$i) {
          $i$1$lcssa$i = $578;
          break;
         } else {
          $i$1118$i = $578;$j$0119$i = $j$0$i;
         }
        }
       } else {
        $i$1$lcssa$i = 10;
       }
       $579 = HEAP32[$575>>2]|0;
       $580 = (($579>>>0) % ($i$1$lcssa$i>>>0))&-1;
       $581 = ($580|0)==(0);
       $582 = ((($575)) + 4|0);
       $583 = ($582|0)==($z$3$lcssa$i|0);
       $or$cond18$i = $583 & $581;
       do {
        if ($or$cond18$i) {
         $a$8$i = $a$3$lcssa$i;$d$4$i = $575;$e$4$i = $e$1$i;
        } else {
         $584 = (($579>>>0) / ($i$1$lcssa$i>>>0))&-1;
         $585 = $584 & 1;
         $586 = ($585|0)==(0);
         $$20$i = $586 ? 9007199254740992.0 : 9007199254740994.0;
         $587 = (($i$1$lcssa$i|0) / 2)&-1;
         $588 = ($580>>>0)<($587>>>0);
         if ($588) {
          $small$0$i = 0.5;
         } else {
          $589 = ($580|0)==($587|0);
          $or$cond22$i = $583 & $589;
          $$36$i = $or$cond22$i ? 1.0 : 1.5;
          $small$0$i = $$36$i;
         }
         $590 = ($pl$0$i|0)==(0);
         do {
          if ($590) {
           $round6$1$i = $$20$i;$small$1$i = $small$0$i;
          } else {
           $591 = HEAP8[$prefix$0$i>>0]|0;
           $592 = ($591<<24>>24)==(45);
           if (!($592)) {
            $round6$1$i = $$20$i;$small$1$i = $small$0$i;
            break;
           }
           $593 = -$$20$i;
           $594 = -$small$0$i;
           $round6$1$i = $593;$small$1$i = $594;
          }
         } while(0);
         $595 = (($579) - ($580))|0;
         HEAP32[$575>>2] = $595;
         $596 = $round6$1$i + $small$1$i;
         $597 = $596 != $round6$1$i;
         if (!($597)) {
          $a$8$i = $a$3$lcssa$i;$d$4$i = $575;$e$4$i = $e$1$i;
          break;
         }
         $598 = (($595) + ($i$1$lcssa$i))|0;
         HEAP32[$575>>2] = $598;
         $599 = ($598>>>0)>(999999999);
         if ($599) {
          $a$5111$i = $a$3$lcssa$i;$d$2110$i = $575;
          while(1) {
           $600 = ((($d$2110$i)) + -4|0);
           HEAP32[$d$2110$i>>2] = 0;
           $601 = ($600>>>0)<($a$5111$i>>>0);
           if ($601) {
            $602 = ((($a$5111$i)) + -4|0);
            HEAP32[$602>>2] = 0;
            $a$6$i = $602;
           } else {
            $a$6$i = $a$5111$i;
           }
           $603 = HEAP32[$600>>2]|0;
           $604 = (($603) + 1)|0;
           HEAP32[$600>>2] = $604;
           $605 = ($604>>>0)>(999999999);
           if ($605) {
            $a$5111$i = $a$6$i;$d$2110$i = $600;
           } else {
            $a$5$lcssa$i = $a$6$i;$d$2$lcssa$i = $600;
            break;
           }
          }
         } else {
          $a$5$lcssa$i = $a$3$lcssa$i;$d$2$lcssa$i = $575;
         }
         $606 = $a$5$lcssa$i;
         $607 = (($479) - ($606))|0;
         $608 = $607 >> 2;
         $609 = ($608*9)|0;
         $610 = HEAP32[$a$5$lcssa$i>>2]|0;
         $611 = ($610>>>0)<(10);
         if ($611) {
          $a$8$i = $a$5$lcssa$i;$d$4$i = $d$2$lcssa$i;$e$4$i = $609;
          break;
         } else {
          $e$2106$i = $609;$i$2105$i = 10;
         }
         while(1) {
          $612 = ($i$2105$i*10)|0;
          $613 = (($e$2106$i) + 1)|0;
          $614 = ($610>>>0)<($612>>>0);
          if ($614) {
           $a$8$i = $a$5$lcssa$i;$d$4$i = $d$2$lcssa$i;$e$4$i = $613;
           break;
          } else {
           $e$2106$i = $613;$i$2105$i = $612;
          }
         }
        }
       } while(0);
       $615 = ((($d$4$i)) + 4|0);
       $616 = ($z$3$lcssa$i>>>0)>($615>>>0);
       $$z$3$i = $616 ? $615 : $z$3$lcssa$i;
       $a$9$ph$i = $a$8$i;$e$5$ph$i = $e$4$i;$z$7$ph$i = $$z$3$i;
      } else {
       $a$9$ph$i = $a$3$lcssa$i;$e$5$ph$i = $e$1$i;$z$7$ph$i = $z$3$lcssa$i;
      }
      $617 = (0 - ($e$5$ph$i))|0;
      $z$7$i = $z$7$ph$i;
      while(1) {
       $618 = ($z$7$i>>>0)>($a$9$ph$i>>>0);
       if (!($618)) {
        $$lcssa162$i = 0;$z$7$i$lcssa = $z$7$i;
        break;
       }
       $619 = ((($z$7$i)) + -4|0);
       $620 = HEAP32[$619>>2]|0;
       $621 = ($620|0)==(0);
       if ($621) {
        $z$7$i = $619;
       } else {
        $$lcssa162$i = 1;$z$7$i$lcssa = $z$7$i;
        break;
       }
      }
      do {
       if ($561) {
        $622 = $562&1;
        $623 = $622 ^ 1;
        $$p$$i = (($623) + ($$p$i))|0;
        $624 = ($$p$$i|0)>($e$5$ph$i|0);
        $625 = ($e$5$ph$i|0)>(-5);
        $or$cond6$i = $624 & $625;
        if ($or$cond6$i) {
         $626 = (($t$0) + -1)|0;
         $$neg56$i = (($$p$$i) + -1)|0;
         $627 = (($$neg56$i) - ($e$5$ph$i))|0;
         $$013$i = $626;$$210$i = $627;
        } else {
         $628 = (($t$0) + -2)|0;
         $629 = (($$p$$i) + -1)|0;
         $$013$i = $628;$$210$i = $629;
        }
        $630 = $fl$1$ & 8;
        $631 = ($630|0)==(0);
        if (!($631)) {
         $$114$i = $$013$i;$$311$i = $$210$i;$$pre$phi190$iZ2D = $630;
         break;
        }
        do {
         if ($$lcssa162$i) {
          $632 = ((($z$7$i$lcssa)) + -4|0);
          $633 = HEAP32[$632>>2]|0;
          $634 = ($633|0)==(0);
          if ($634) {
           $j$2$i = 9;
           break;
          }
          $635 = (($633>>>0) % 10)&-1;
          $636 = ($635|0)==(0);
          if ($636) {
           $i$3101$i = 10;$j$1102$i = 0;
          } else {
           $j$2$i = 0;
           break;
          }
          while(1) {
           $637 = ($i$3101$i*10)|0;
           $638 = (($j$1102$i) + 1)|0;
           $639 = (($633>>>0) % ($637>>>0))&-1;
           $640 = ($639|0)==(0);
           if ($640) {
            $i$3101$i = $637;$j$1102$i = $638;
           } else {
            $j$2$i = $638;
            break;
           }
          }
         } else {
          $j$2$i = 9;
         }
        } while(0);
        $641 = $$013$i | 32;
        $642 = ($641|0)==(102);
        $643 = $z$7$i$lcssa;
        $644 = (($643) - ($479))|0;
        $645 = $644 >> 2;
        $646 = ($645*9)|0;
        $647 = (($646) + -9)|0;
        if ($642) {
         $648 = (($647) - ($j$2$i))|0;
         $649 = ($648|0)<(0);
         $$23$i = $649 ? 0 : $648;
         $650 = ($$210$i|0)<($$23$i|0);
         $$210$$24$i = $650 ? $$210$i : $$23$i;
         $$114$i = $$013$i;$$311$i = $$210$$24$i;$$pre$phi190$iZ2D = 0;
         break;
        } else {
         $651 = (($647) + ($e$5$ph$i))|0;
         $652 = (($651) - ($j$2$i))|0;
         $653 = ($652|0)<(0);
         $$25$i = $653 ? 0 : $652;
         $654 = ($$210$i|0)<($$25$i|0);
         $$210$$26$i = $654 ? $$210$i : $$25$i;
         $$114$i = $$013$i;$$311$i = $$210$$26$i;$$pre$phi190$iZ2D = 0;
         break;
        }
       } else {
        $$pre189$i = $fl$1$ & 8;
        $$114$i = $t$0;$$311$i = $$p$i;$$pre$phi190$iZ2D = $$pre189$i;
       }
      } while(0);
      $655 = $$311$i | $$pre$phi190$iZ2D;
      $656 = ($655|0)!=(0);
      $657 = $656&1;
      $658 = $$114$i | 32;
      $659 = ($658|0)==(102);
      if ($659) {
       $660 = ($e$5$ph$i|0)>(0);
       $661 = $660 ? $e$5$ph$i : 0;
       $$pn$i = $661;$estr$2$i = 0;
      } else {
       $662 = ($e$5$ph$i|0)<(0);
       $663 = $662 ? $617 : $e$5$ph$i;
       $664 = ($663|0)<(0);
       $665 = $664 << 31 >> 31;
       $666 = (_fmt_u($663,$665,$7)|0);
       $667 = $666;
       $668 = (($9) - ($667))|0;
       $669 = ($668|0)<(2);
       if ($669) {
        $estr$195$i = $666;
        while(1) {
         $670 = ((($estr$195$i)) + -1|0);
         HEAP8[$670>>0] = 48;
         $671 = $670;
         $672 = (($9) - ($671))|0;
         $673 = ($672|0)<(2);
         if ($673) {
          $estr$195$i = $670;
         } else {
          $estr$1$lcssa$i = $670;
          break;
         }
        }
       } else {
        $estr$1$lcssa$i = $666;
       }
       $674 = $e$5$ph$i >> 31;
       $675 = $674 & 2;
       $676 = (($675) + 43)|0;
       $677 = $676&255;
       $678 = ((($estr$1$lcssa$i)) + -1|0);
       HEAP8[$678>>0] = $677;
       $679 = $$114$i&255;
       $680 = ((($estr$1$lcssa$i)) + -2|0);
       HEAP8[$680>>0] = $679;
       $681 = $680;
       $682 = (($9) - ($681))|0;
       $$pn$i = $682;$estr$2$i = $680;
      }
      $683 = (($pl$0$i) + 1)|0;
      $684 = (($683) + ($$311$i))|0;
      $l$1$i = (($684) + ($657))|0;
      $685 = (($l$1$i) + ($$pn$i))|0;
      _pad($f,32,$w$1,$685,$fl$1$);
      $686 = HEAP32[$f>>2]|0;
      $687 = $686 & 32;
      $688 = ($687|0)==(0);
      if ($688) {
       (___fwritex($prefix$0$i,$pl$0$i,$f)|0);
      }
      $689 = $fl$1$ ^ 65536;
      _pad($f,48,$w$1,$685,$689);
      do {
       if ($659) {
        $690 = ($a$9$ph$i>>>0)>($$33$i>>>0);
        $r$0$a$9$i = $690 ? $$33$i : $a$9$ph$i;
        $d$584$i = $r$0$a$9$i;
        while(1) {
         $691 = HEAP32[$d$584$i>>2]|0;
         $692 = (_fmt_u($691,0,$14)|0);
         $693 = ($d$584$i|0)==($r$0$a$9$i|0);
         do {
          if ($693) {
           $699 = ($692|0)==($14|0);
           if (!($699)) {
            $s7$1$i = $692;
            break;
           }
           HEAP8[$16>>0] = 48;
           $s7$1$i = $16;
          } else {
           $694 = ($692>>>0)>($buf$i>>>0);
           if (!($694)) {
            $s7$1$i = $692;
            break;
           }
           $695 = $692;
           $696 = (($695) - ($5))|0;
           _memset(($buf$i|0),48,($696|0))|0;
           $s7$081$i = $692;
           while(1) {
            $697 = ((($s7$081$i)) + -1|0);
            $698 = ($697>>>0)>($buf$i>>>0);
            if ($698) {
             $s7$081$i = $697;
            } else {
             $s7$1$i = $697;
             break;
            }
           }
          }
         } while(0);
         $700 = HEAP32[$f>>2]|0;
         $701 = $700 & 32;
         $702 = ($701|0)==(0);
         if ($702) {
          $703 = $s7$1$i;
          $704 = (($15) - ($703))|0;
          (___fwritex($s7$1$i,$704,$f)|0);
         }
         $705 = ((($d$584$i)) + 4|0);
         $706 = ($705>>>0)>($$33$i>>>0);
         if ($706) {
          $$lcssa316 = $705;
          break;
         } else {
          $d$584$i = $705;
         }
        }
        $707 = ($655|0)==(0);
        do {
         if (!($707)) {
          $708 = HEAP32[$f>>2]|0;
          $709 = $708 & 32;
          $710 = ($709|0)==(0);
          if (!($710)) {
           break;
          }
          (___fwritex(6825,1,$f)|0);
         }
        } while(0);
        $711 = ($$lcssa316>>>0)<($z$7$i$lcssa>>>0);
        $712 = ($$311$i|0)>(0);
        $713 = $712 & $711;
        if ($713) {
         $$41278$i = $$311$i;$d$677$i = $$lcssa316;
         while(1) {
          $714 = HEAP32[$d$677$i>>2]|0;
          $715 = (_fmt_u($714,0,$14)|0);
          $716 = ($715>>>0)>($buf$i>>>0);
          if ($716) {
           $717 = $715;
           $718 = (($717) - ($5))|0;
           _memset(($buf$i|0),48,($718|0))|0;
           $s8$072$i = $715;
           while(1) {
            $719 = ((($s8$072$i)) + -1|0);
            $720 = ($719>>>0)>($buf$i>>>0);
            if ($720) {
             $s8$072$i = $719;
            } else {
             $s8$0$lcssa$i = $719;
             break;
            }
           }
          } else {
           $s8$0$lcssa$i = $715;
          }
          $721 = HEAP32[$f>>2]|0;
          $722 = $721 & 32;
          $723 = ($722|0)==(0);
          if ($723) {
           $724 = ($$41278$i|0)>(9);
           $725 = $724 ? 9 : $$41278$i;
           (___fwritex($s8$0$lcssa$i,$725,$f)|0);
          }
          $726 = ((($d$677$i)) + 4|0);
          $727 = (($$41278$i) + -9)|0;
          $728 = ($726>>>0)<($z$7$i$lcssa>>>0);
          $729 = ($$41278$i|0)>(9);
          $730 = $729 & $728;
          if ($730) {
           $$41278$i = $727;$d$677$i = $726;
          } else {
           $$412$lcssa$i = $727;
           break;
          }
         }
        } else {
         $$412$lcssa$i = $$311$i;
        }
        $731 = (($$412$lcssa$i) + 9)|0;
        _pad($f,48,$731,9,0);
       } else {
        $732 = ((($a$9$ph$i)) + 4|0);
        $z$7$$i = $$lcssa162$i ? $z$7$i$lcssa : $732;
        $733 = ($$311$i|0)>(-1);
        if ($733) {
         $734 = ($$pre$phi190$iZ2D|0)==(0);
         $$589$i = $$311$i;$d$788$i = $a$9$ph$i;
         while(1) {
          $735 = HEAP32[$d$788$i>>2]|0;
          $736 = (_fmt_u($735,0,$14)|0);
          $737 = ($736|0)==($14|0);
          if ($737) {
           HEAP8[$16>>0] = 48;
           $s9$0$i = $16;
          } else {
           $s9$0$i = $736;
          }
          $738 = ($d$788$i|0)==($a$9$ph$i|0);
          do {
           if ($738) {
            $742 = ((($s9$0$i)) + 1|0);
            $743 = HEAP32[$f>>2]|0;
            $744 = $743 & 32;
            $745 = ($744|0)==(0);
            if ($745) {
             (___fwritex($s9$0$i,1,$f)|0);
            }
            $746 = ($$589$i|0)<(1);
            $or$cond31$i = $734 & $746;
            if ($or$cond31$i) {
             $s9$2$i = $742;
             break;
            }
            $747 = HEAP32[$f>>2]|0;
            $748 = $747 & 32;
            $749 = ($748|0)==(0);
            if (!($749)) {
             $s9$2$i = $742;
             break;
            }
            (___fwritex(6825,1,$f)|0);
            $s9$2$i = $742;
           } else {
            $739 = ($s9$0$i>>>0)>($buf$i>>>0);
            if (!($739)) {
             $s9$2$i = $s9$0$i;
             break;
            }
            $scevgep182$i = (($s9$0$i) + ($6)|0);
            $scevgep182183$i = $scevgep182$i;
            _memset(($buf$i|0),48,($scevgep182183$i|0))|0;
            $s9$185$i = $s9$0$i;
            while(1) {
             $740 = ((($s9$185$i)) + -1|0);
             $741 = ($740>>>0)>($buf$i>>>0);
             if ($741) {
              $s9$185$i = $740;
             } else {
              $s9$2$i = $740;
              break;
             }
            }
           }
          } while(0);
          $750 = $s9$2$i;
          $751 = (($15) - ($750))|0;
          $752 = HEAP32[$f>>2]|0;
          $753 = $752 & 32;
          $754 = ($753|0)==(0);
          if ($754) {
           $755 = ($$589$i|0)>($751|0);
           $756 = $755 ? $751 : $$589$i;
           (___fwritex($s9$2$i,$756,$f)|0);
          }
          $757 = (($$589$i) - ($751))|0;
          $758 = ((($d$788$i)) + 4|0);
          $759 = ($758>>>0)<($z$7$$i>>>0);
          $760 = ($757|0)>(-1);
          $761 = $759 & $760;
          if ($761) {
           $$589$i = $757;$d$788$i = $758;
          } else {
           $$5$lcssa$i = $757;
           break;
          }
         }
        } else {
         $$5$lcssa$i = $$311$i;
        }
        $762 = (($$5$lcssa$i) + 18)|0;
        _pad($f,48,$762,18,0);
        $763 = HEAP32[$f>>2]|0;
        $764 = $763 & 32;
        $765 = ($764|0)==(0);
        if (!($765)) {
         break;
        }
        $766 = $estr$2$i;
        $767 = (($9) - ($766))|0;
        (___fwritex($estr$2$i,$767,$f)|0);
       }
      } while(0);
      $768 = $fl$1$ ^ 8192;
      _pad($f,32,$w$1,$685,$768);
      $769 = ($685|0)<($w$1|0);
      $w$32$i = $769 ? $w$1 : $685;
      $$0$i = $w$32$i;
     } else {
      $375 = $t$0 & 32;
      $376 = ($375|0)!=(0);
      $377 = $376 ? 6809 : 6813;
      $378 = ($$07$i != $$07$i) | (0.0 != 0.0);
      $379 = $376 ? 6817 : 6821;
      $pl$1$i = $378 ? 0 : $pl$0$i;
      $s1$0$i = $378 ? $379 : $377;
      $380 = (($pl$1$i) + 3)|0;
      _pad($f,32,$w$1,$380,$176);
      $381 = HEAP32[$f>>2]|0;
      $382 = $381 & 32;
      $383 = ($382|0)==(0);
      if ($383) {
       (___fwritex($prefix$0$i,$pl$1$i,$f)|0);
       $$pre$i = HEAP32[$f>>2]|0;
       $385 = $$pre$i;
      } else {
       $385 = $381;
      }
      $384 = $385 & 32;
      $386 = ($384|0)==(0);
      if ($386) {
       (___fwritex($s1$0$i,3,$f)|0);
      }
      $387 = $fl$1$ ^ 8192;
      _pad($f,32,$w$1,$380,$387);
      $388 = ($380|0)<($w$1|0);
      $389 = $388 ? $w$1 : $380;
      $$0$i = $389;
     }
    } while(0);
    $cnt$0 = $cnt$1;$l$0 = $$0$i;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
    continue L1;
    break;
   }
   default: {
    $a$2 = $s$0;$fl$6 = $fl$1$;$p$5 = $p$0;$pl$2 = 0;$prefix$2 = 4881;$z$2 = $1;
   }
   }
  } while(0);
  L311: do {
   if ((label|0) == 64) {
    label = 0;
    $207 = $arg;
    $208 = $207;
    $209 = HEAP32[$208>>2]|0;
    $210 = (($207) + 4)|0;
    $211 = $210;
    $212 = HEAP32[$211>>2]|0;
    $213 = $t$1 & 32;
    $214 = ($209|0)==(0);
    $215 = ($212|0)==(0);
    $216 = $214 & $215;
    if ($216) {
     $a$0 = $1;$fl$4 = $fl$3;$p$2 = $p$1;$pl$1 = 0;$prefix$1 = 4881;
     label = 77;
    } else {
     $$012$i = $1;$218 = $209;$225 = $212;
     while(1) {
      $217 = $218 & 15;
      $219 = (4865 + ($217)|0);
      $220 = HEAP8[$219>>0]|0;
      $221 = $220&255;
      $222 = $221 | $213;
      $223 = $222&255;
      $224 = ((($$012$i)) + -1|0);
      HEAP8[$224>>0] = $223;
      $226 = (_bitshift64Lshr(($218|0),($225|0),4)|0);
      $227 = tempRet0;
      $228 = ($226|0)==(0);
      $229 = ($227|0)==(0);
      $230 = $228 & $229;
      if ($230) {
       $$lcssa321 = $224;
       break;
      } else {
       $$012$i = $224;$218 = $226;$225 = $227;
      }
     }
     $231 = $arg;
     $232 = $231;
     $233 = HEAP32[$232>>2]|0;
     $234 = (($231) + 4)|0;
     $235 = $234;
     $236 = HEAP32[$235>>2]|0;
     $237 = ($233|0)==(0);
     $238 = ($236|0)==(0);
     $239 = $237 & $238;
     $240 = $fl$3 & 8;
     $241 = ($240|0)==(0);
     $or$cond17 = $241 | $239;
     if ($or$cond17) {
      $a$0 = $$lcssa321;$fl$4 = $fl$3;$p$2 = $p$1;$pl$1 = 0;$prefix$1 = 4881;
      label = 77;
     } else {
      $242 = $t$1 >> 4;
      $243 = (4881 + ($242)|0);
      $a$0 = $$lcssa321;$fl$4 = $fl$3;$p$2 = $p$1;$pl$1 = 2;$prefix$1 = $243;
      label = 77;
     }
    }
   }
   else if ((label|0) == 76) {
    label = 0;
    $289 = (_fmt_u($287,$288,$1)|0);
    $a$0 = $289;$fl$4 = $fl$1$;$p$2 = $p$0;$pl$1 = $pl$0;$prefix$1 = $prefix$0;
    label = 77;
   }
   else if ((label|0) == 82) {
    label = 0;
    $321 = (_memchr($a$1,0,$p$0)|0);
    $322 = ($321|0)==(0|0);
    $323 = $321;
    $324 = $a$1;
    $325 = (($323) - ($324))|0;
    $326 = (($a$1) + ($p$0)|0);
    $z$1 = $322 ? $326 : $321;
    $p$3 = $322 ? $p$0 : $325;
    $a$2 = $a$1;$fl$6 = $176;$p$5 = $p$3;$pl$2 = 0;$prefix$2 = 4881;$z$2 = $z$1;
   }
   else if ((label|0) == 86) {
    label = 0;
    $i$0105 = 0;$l$1104 = 0;$ws$0106 = $798;
    while(1) {
     $334 = HEAP32[$ws$0106>>2]|0;
     $335 = ($334|0)==(0);
     if ($335) {
      $i$0$lcssa = $i$0105;$l$2 = $l$1104;
      break;
     }
     $336 = (_wctomb($mb,$334)|0);
     $337 = ($336|0)<(0);
     $338 = (($p$4176) - ($i$0105))|0;
     $339 = ($336>>>0)>($338>>>0);
     $or$cond20 = $337 | $339;
     if ($or$cond20) {
      $i$0$lcssa = $i$0105;$l$2 = $336;
      break;
     }
     $340 = ((($ws$0106)) + 4|0);
     $341 = (($336) + ($i$0105))|0;
     $342 = ($p$4176>>>0)>($341>>>0);
     if ($342) {
      $i$0105 = $341;$l$1104 = $336;$ws$0106 = $340;
     } else {
      $i$0$lcssa = $341;$l$2 = $336;
      break;
     }
    }
    $343 = ($l$2|0)<(0);
    if ($343) {
     $$0 = -1;
     break L1;
    }
    _pad($f,32,$w$1,$i$0$lcssa,$fl$1$);
    $344 = ($i$0$lcssa|0)==(0);
    if ($344) {
     $i$0$lcssa178 = 0;
     label = 97;
    } else {
     $i$1116 = 0;$ws$1117 = $798;
     while(1) {
      $345 = HEAP32[$ws$1117>>2]|0;
      $346 = ($345|0)==(0);
      if ($346) {
       $i$0$lcssa178 = $i$0$lcssa;
       label = 97;
       break L311;
      }
      $347 = ((($ws$1117)) + 4|0);
      $348 = (_wctomb($mb,$345)|0);
      $349 = (($348) + ($i$1116))|0;
      $350 = ($349|0)>($i$0$lcssa|0);
      if ($350) {
       $i$0$lcssa178 = $i$0$lcssa;
       label = 97;
       break L311;
      }
      $351 = HEAP32[$f>>2]|0;
      $352 = $351 & 32;
      $353 = ($352|0)==(0);
      if ($353) {
       (___fwritex($mb,$348,$f)|0);
      }
      $354 = ($349>>>0)<($i$0$lcssa>>>0);
      if ($354) {
       $i$1116 = $349;$ws$1117 = $347;
      } else {
       $i$0$lcssa178 = $i$0$lcssa;
       label = 97;
       break;
      }
     }
    }
   }
  } while(0);
  if ((label|0) == 97) {
   label = 0;
   $355 = $fl$1$ ^ 8192;
   _pad($f,32,$w$1,$i$0$lcssa178,$355);
   $356 = ($w$1|0)>($i$0$lcssa178|0);
   $357 = $356 ? $w$1 : $i$0$lcssa178;
   $cnt$0 = $cnt$1;$l$0 = $357;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
   continue;
  }
  if ((label|0) == 77) {
   label = 0;
   $290 = ($p$2|0)>(-1);
   $291 = $fl$4 & -65537;
   $$fl$4 = $290 ? $291 : $fl$4;
   $292 = $arg;
   $293 = $292;
   $294 = HEAP32[$293>>2]|0;
   $295 = (($292) + 4)|0;
   $296 = $295;
   $297 = HEAP32[$296>>2]|0;
   $298 = ($294|0)!=(0);
   $299 = ($297|0)!=(0);
   $300 = $298 | $299;
   $301 = ($p$2|0)!=(0);
   $or$cond = $301 | $300;
   if ($or$cond) {
    $302 = $a$0;
    $303 = (($2) - ($302))|0;
    $304 = $300&1;
    $305 = $304 ^ 1;
    $306 = (($305) + ($303))|0;
    $307 = ($p$2|0)>($306|0);
    $p$2$ = $307 ? $p$2 : $306;
    $a$2 = $a$0;$fl$6 = $$fl$4;$p$5 = $p$2$;$pl$2 = $pl$1;$prefix$2 = $prefix$1;$z$2 = $1;
   } else {
    $a$2 = $1;$fl$6 = $$fl$4;$p$5 = 0;$pl$2 = $pl$1;$prefix$2 = $prefix$1;$z$2 = $1;
   }
  }
  $770 = $z$2;
  $771 = $a$2;
  $772 = (($770) - ($771))|0;
  $773 = ($p$5|0)<($772|0);
  $$p$5 = $773 ? $772 : $p$5;
  $774 = (($pl$2) + ($$p$5))|0;
  $775 = ($w$1|0)<($774|0);
  $w$2 = $775 ? $774 : $w$1;
  _pad($f,32,$w$2,$774,$fl$6);
  $776 = HEAP32[$f>>2]|0;
  $777 = $776 & 32;
  $778 = ($777|0)==(0);
  if ($778) {
   (___fwritex($prefix$2,$pl$2,$f)|0);
  }
  $779 = $fl$6 ^ 65536;
  _pad($f,48,$w$2,$774,$779);
  _pad($f,48,$$p$5,$772,0);
  $780 = HEAP32[$f>>2]|0;
  $781 = $780 & 32;
  $782 = ($781|0)==(0);
  if ($782) {
   (___fwritex($a$2,$772,$f)|0);
  }
  $783 = $fl$6 ^ 8192;
  _pad($f,32,$w$2,$774,$783);
  $cnt$0 = $cnt$1;$l$0 = $w$2;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
 }
 L345: do {
  if ((label|0) == 244) {
   $784 = ($f|0)==(0|0);
   if ($784) {
    $785 = ($l10n$0$lcssa|0)==(0);
    if ($785) {
     $$0 = 0;
    } else {
     $i$291 = 1;
     while(1) {
      $786 = (($nl_type) + ($i$291<<2)|0);
      $787 = HEAP32[$786>>2]|0;
      $788 = ($787|0)==(0);
      if ($788) {
       $i$291$lcssa = $i$291;
       break;
      }
      $790 = (($nl_arg) + ($i$291<<3)|0);
      _pop_arg($790,$787,$ap);
      $791 = (($i$291) + 1)|0;
      $792 = ($791|0)<(10);
      if ($792) {
       $i$291 = $791;
      } else {
       $$0 = 1;
       break L345;
      }
     }
     $789 = ($i$291$lcssa|0)<(10);
     if ($789) {
      $i$389 = $i$291$lcssa;
      while(1) {
       $795 = (($nl_type) + ($i$389<<2)|0);
       $796 = HEAP32[$795>>2]|0;
       $797 = ($796|0)==(0);
       $794 = (($i$389) + 1)|0;
       if (!($797)) {
        $$0 = -1;
        break L345;
       }
       $793 = ($794|0)<(10);
       if ($793) {
        $i$389 = $794;
       } else {
        $$0 = 1;
        break;
       }
      }
     } else {
      $$0 = 1;
     }
    }
   } else {
    $$0 = $cnt$1$lcssa;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function ___fwritex($s,$l,$f) {
 $s = $s|0;
 $l = $l|0;
 $f = $f|0;
 var $$0 = 0, $$01 = 0, $$02 = 0, $$pre = 0, $$pre6 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i$0 = 0, $i$0$lcssa12 = 0;
 var $i$1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 16|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  $4 = (___towrite($f)|0);
  $5 = ($4|0)==(0);
  if ($5) {
   $$pre = HEAP32[$0>>2]|0;
   $9 = $$pre;
   label = 5;
  } else {
   $$0 = 0;
  }
 } else {
  $3 = $1;
  $9 = $3;
  label = 5;
 }
 L5: do {
  if ((label|0) == 5) {
   $6 = ((($f)) + 20|0);
   $7 = HEAP32[$6>>2]|0;
   $8 = (($9) - ($7))|0;
   $10 = ($8>>>0)<($l>>>0);
   $11 = $7;
   if ($10) {
    $12 = ((($f)) + 36|0);
    $13 = HEAP32[$12>>2]|0;
    $14 = (FUNCTION_TABLE_iiii[$13 & 7]($f,$s,$l)|0);
    $$0 = $14;
    break;
   }
   $15 = ((($f)) + 75|0);
   $16 = HEAP8[$15>>0]|0;
   $17 = ($16<<24>>24)>(-1);
   L10: do {
    if ($17) {
     $i$0 = $l;
     while(1) {
      $18 = ($i$0|0)==(0);
      if ($18) {
       $$01 = $l;$$02 = $s;$29 = $11;$i$1 = 0;
       break L10;
      }
      $19 = (($i$0) + -1)|0;
      $20 = (($s) + ($19)|0);
      $21 = HEAP8[$20>>0]|0;
      $22 = ($21<<24>>24)==(10);
      if ($22) {
       $i$0$lcssa12 = $i$0;
       break;
      } else {
       $i$0 = $19;
      }
     }
     $23 = ((($f)) + 36|0);
     $24 = HEAP32[$23>>2]|0;
     $25 = (FUNCTION_TABLE_iiii[$24 & 7]($f,$s,$i$0$lcssa12)|0);
     $26 = ($25>>>0)<($i$0$lcssa12>>>0);
     if ($26) {
      $$0 = $i$0$lcssa12;
      break L5;
     }
     $27 = (($s) + ($i$0$lcssa12)|0);
     $28 = (($l) - ($i$0$lcssa12))|0;
     $$pre6 = HEAP32[$6>>2]|0;
     $$01 = $28;$$02 = $27;$29 = $$pre6;$i$1 = $i$0$lcssa12;
    } else {
     $$01 = $l;$$02 = $s;$29 = $11;$i$1 = 0;
    }
   } while(0);
   _memcpy(($29|0),($$02|0),($$01|0))|0;
   $30 = HEAP32[$6>>2]|0;
   $31 = (($30) + ($$01)|0);
   HEAP32[$6>>2] = $31;
   $32 = (($i$1) + ($$01))|0;
   $$0 = $32;
  }
 } while(0);
 return ($$0|0);
}
function ___towrite($f) {
 $f = $f|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 74|0);
 $1 = HEAP8[$0>>0]|0;
 $2 = $1 << 24 >> 24;
 $3 = (($2) + 255)|0;
 $4 = $3 | $2;
 $5 = $4&255;
 HEAP8[$0>>0] = $5;
 $6 = HEAP32[$f>>2]|0;
 $7 = $6 & 8;
 $8 = ($7|0)==(0);
 if ($8) {
  $10 = ((($f)) + 8|0);
  HEAP32[$10>>2] = 0;
  $11 = ((($f)) + 4|0);
  HEAP32[$11>>2] = 0;
  $12 = ((($f)) + 44|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ((($f)) + 28|0);
  HEAP32[$14>>2] = $13;
  $15 = ((($f)) + 20|0);
  HEAP32[$15>>2] = $13;
  $16 = $13;
  $17 = ((($f)) + 48|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = (($16) + ($18)|0);
  $20 = ((($f)) + 16|0);
  HEAP32[$20>>2] = $19;
  $$0 = 0;
 } else {
  $9 = $6 | 32;
  HEAP32[$f>>2] = $9;
  $$0 = -1;
 }
 return ($$0|0);
}
function _pop_arg($arg,$type,$ap) {
 $arg = $arg|0;
 $type = $type|0;
 $ap = $ap|0;
 var $$mask = 0, $$mask1 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0.0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0.0;
 var $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0;
 var $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0, $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0;
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0;
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0;
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($type>>>0)>(20);
 L1: do {
  if (!($0)) {
   do {
    switch ($type|0) {
    case 9:  {
     $arglist_current = HEAP32[$ap>>2]|0;
     $1 = $arglist_current;
     $2 = ((0) + 4|0);
     $expanded28 = $2;
     $expanded = (($expanded28) - 1)|0;
     $3 = (($1) + ($expanded))|0;
     $4 = ((0) + 4|0);
     $expanded32 = $4;
     $expanded31 = (($expanded32) - 1)|0;
     $expanded30 = $expanded31 ^ -1;
     $5 = $3 & $expanded30;
     $6 = $5;
     $7 = HEAP32[$6>>2]|0;
     $arglist_next = ((($6)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next;
     HEAP32[$arg>>2] = $7;
     break L1;
     break;
    }
    case 10:  {
     $arglist_current2 = HEAP32[$ap>>2]|0;
     $8 = $arglist_current2;
     $9 = ((0) + 4|0);
     $expanded35 = $9;
     $expanded34 = (($expanded35) - 1)|0;
     $10 = (($8) + ($expanded34))|0;
     $11 = ((0) + 4|0);
     $expanded39 = $11;
     $expanded38 = (($expanded39) - 1)|0;
     $expanded37 = $expanded38 ^ -1;
     $12 = $10 & $expanded37;
     $13 = $12;
     $14 = HEAP32[$13>>2]|0;
     $arglist_next3 = ((($13)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next3;
     $15 = ($14|0)<(0);
     $16 = $15 << 31 >> 31;
     $17 = $arg;
     $18 = $17;
     HEAP32[$18>>2] = $14;
     $19 = (($17) + 4)|0;
     $20 = $19;
     HEAP32[$20>>2] = $16;
     break L1;
     break;
    }
    case 11:  {
     $arglist_current5 = HEAP32[$ap>>2]|0;
     $21 = $arglist_current5;
     $22 = ((0) + 4|0);
     $expanded42 = $22;
     $expanded41 = (($expanded42) - 1)|0;
     $23 = (($21) + ($expanded41))|0;
     $24 = ((0) + 4|0);
     $expanded46 = $24;
     $expanded45 = (($expanded46) - 1)|0;
     $expanded44 = $expanded45 ^ -1;
     $25 = $23 & $expanded44;
     $26 = $25;
     $27 = HEAP32[$26>>2]|0;
     $arglist_next6 = ((($26)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next6;
     $28 = $arg;
     $29 = $28;
     HEAP32[$29>>2] = $27;
     $30 = (($28) + 4)|0;
     $31 = $30;
     HEAP32[$31>>2] = 0;
     break L1;
     break;
    }
    case 12:  {
     $arglist_current8 = HEAP32[$ap>>2]|0;
     $32 = $arglist_current8;
     $33 = ((0) + 8|0);
     $expanded49 = $33;
     $expanded48 = (($expanded49) - 1)|0;
     $34 = (($32) + ($expanded48))|0;
     $35 = ((0) + 8|0);
     $expanded53 = $35;
     $expanded52 = (($expanded53) - 1)|0;
     $expanded51 = $expanded52 ^ -1;
     $36 = $34 & $expanded51;
     $37 = $36;
     $38 = $37;
     $39 = $38;
     $40 = HEAP32[$39>>2]|0;
     $41 = (($38) + 4)|0;
     $42 = $41;
     $43 = HEAP32[$42>>2]|0;
     $arglist_next9 = ((($37)) + 8|0);
     HEAP32[$ap>>2] = $arglist_next9;
     $44 = $arg;
     $45 = $44;
     HEAP32[$45>>2] = $40;
     $46 = (($44) + 4)|0;
     $47 = $46;
     HEAP32[$47>>2] = $43;
     break L1;
     break;
    }
    case 13:  {
     $arglist_current11 = HEAP32[$ap>>2]|0;
     $48 = $arglist_current11;
     $49 = ((0) + 4|0);
     $expanded56 = $49;
     $expanded55 = (($expanded56) - 1)|0;
     $50 = (($48) + ($expanded55))|0;
     $51 = ((0) + 4|0);
     $expanded60 = $51;
     $expanded59 = (($expanded60) - 1)|0;
     $expanded58 = $expanded59 ^ -1;
     $52 = $50 & $expanded58;
     $53 = $52;
     $54 = HEAP32[$53>>2]|0;
     $arglist_next12 = ((($53)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next12;
     $55 = $54&65535;
     $56 = $55 << 16 >> 16;
     $57 = ($56|0)<(0);
     $58 = $57 << 31 >> 31;
     $59 = $arg;
     $60 = $59;
     HEAP32[$60>>2] = $56;
     $61 = (($59) + 4)|0;
     $62 = $61;
     HEAP32[$62>>2] = $58;
     break L1;
     break;
    }
    case 14:  {
     $arglist_current14 = HEAP32[$ap>>2]|0;
     $63 = $arglist_current14;
     $64 = ((0) + 4|0);
     $expanded63 = $64;
     $expanded62 = (($expanded63) - 1)|0;
     $65 = (($63) + ($expanded62))|0;
     $66 = ((0) + 4|0);
     $expanded67 = $66;
     $expanded66 = (($expanded67) - 1)|0;
     $expanded65 = $expanded66 ^ -1;
     $67 = $65 & $expanded65;
     $68 = $67;
     $69 = HEAP32[$68>>2]|0;
     $arglist_next15 = ((($68)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next15;
     $$mask1 = $69 & 65535;
     $70 = $arg;
     $71 = $70;
     HEAP32[$71>>2] = $$mask1;
     $72 = (($70) + 4)|0;
     $73 = $72;
     HEAP32[$73>>2] = 0;
     break L1;
     break;
    }
    case 15:  {
     $arglist_current17 = HEAP32[$ap>>2]|0;
     $74 = $arglist_current17;
     $75 = ((0) + 4|0);
     $expanded70 = $75;
     $expanded69 = (($expanded70) - 1)|0;
     $76 = (($74) + ($expanded69))|0;
     $77 = ((0) + 4|0);
     $expanded74 = $77;
     $expanded73 = (($expanded74) - 1)|0;
     $expanded72 = $expanded73 ^ -1;
     $78 = $76 & $expanded72;
     $79 = $78;
     $80 = HEAP32[$79>>2]|0;
     $arglist_next18 = ((($79)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next18;
     $81 = $80&255;
     $82 = $81 << 24 >> 24;
     $83 = ($82|0)<(0);
     $84 = $83 << 31 >> 31;
     $85 = $arg;
     $86 = $85;
     HEAP32[$86>>2] = $82;
     $87 = (($85) + 4)|0;
     $88 = $87;
     HEAP32[$88>>2] = $84;
     break L1;
     break;
    }
    case 16:  {
     $arglist_current20 = HEAP32[$ap>>2]|0;
     $89 = $arglist_current20;
     $90 = ((0) + 4|0);
     $expanded77 = $90;
     $expanded76 = (($expanded77) - 1)|0;
     $91 = (($89) + ($expanded76))|0;
     $92 = ((0) + 4|0);
     $expanded81 = $92;
     $expanded80 = (($expanded81) - 1)|0;
     $expanded79 = $expanded80 ^ -1;
     $93 = $91 & $expanded79;
     $94 = $93;
     $95 = HEAP32[$94>>2]|0;
     $arglist_next21 = ((($94)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next21;
     $$mask = $95 & 255;
     $96 = $arg;
     $97 = $96;
     HEAP32[$97>>2] = $$mask;
     $98 = (($96) + 4)|0;
     $99 = $98;
     HEAP32[$99>>2] = 0;
     break L1;
     break;
    }
    case 17:  {
     $arglist_current23 = HEAP32[$ap>>2]|0;
     $100 = $arglist_current23;
     $101 = ((0) + 8|0);
     $expanded84 = $101;
     $expanded83 = (($expanded84) - 1)|0;
     $102 = (($100) + ($expanded83))|0;
     $103 = ((0) + 8|0);
     $expanded88 = $103;
     $expanded87 = (($expanded88) - 1)|0;
     $expanded86 = $expanded87 ^ -1;
     $104 = $102 & $expanded86;
     $105 = $104;
     $106 = +HEAPF64[$105>>3];
     $arglist_next24 = ((($105)) + 8|0);
     HEAP32[$ap>>2] = $arglist_next24;
     HEAPF64[$arg>>3] = $106;
     break L1;
     break;
    }
    case 18:  {
     $arglist_current26 = HEAP32[$ap>>2]|0;
     $107 = $arglist_current26;
     $108 = ((0) + 8|0);
     $expanded91 = $108;
     $expanded90 = (($expanded91) - 1)|0;
     $109 = (($107) + ($expanded90))|0;
     $110 = ((0) + 8|0);
     $expanded95 = $110;
     $expanded94 = (($expanded95) - 1)|0;
     $expanded93 = $expanded94 ^ -1;
     $111 = $109 & $expanded93;
     $112 = $111;
     $113 = +HEAPF64[$112>>3];
     $arglist_next27 = ((($112)) + 8|0);
     HEAP32[$ap>>2] = $arglist_next27;
     HEAPF64[$arg>>3] = $113;
     break L1;
     break;
    }
    default: {
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 return;
}
function _fmt_u($0,$1,$s) {
 $0 = $0|0;
 $1 = $1|0;
 $s = $s|0;
 var $$0$lcssa = 0, $$01$lcssa$off0 = 0, $$05 = 0, $$1$lcssa = 0, $$12 = 0, $$lcssa19 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $y$03 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1>>>0)>(0);
 $3 = ($0>>>0)>(4294967295);
 $4 = ($1|0)==(0);
 $5 = $4 & $3;
 $6 = $2 | $5;
 if ($6) {
  $$05 = $s;$7 = $0;$8 = $1;
  while(1) {
   $9 = (___uremdi3(($7|0),($8|0),10,0)|0);
   $10 = tempRet0;
   $11 = $9 | 48;
   $12 = $11&255;
   $13 = ((($$05)) + -1|0);
   HEAP8[$13>>0] = $12;
   $14 = (___udivdi3(($7|0),($8|0),10,0)|0);
   $15 = tempRet0;
   $16 = ($8>>>0)>(9);
   $17 = ($7>>>0)>(4294967295);
   $18 = ($8|0)==(9);
   $19 = $18 & $17;
   $20 = $16 | $19;
   if ($20) {
    $$05 = $13;$7 = $14;$8 = $15;
   } else {
    $$lcssa19 = $13;$28 = $14;$29 = $15;
    break;
   }
  }
  $$0$lcssa = $$lcssa19;$$01$lcssa$off0 = $28;
 } else {
  $$0$lcssa = $s;$$01$lcssa$off0 = $0;
 }
 $21 = ($$01$lcssa$off0|0)==(0);
 if ($21) {
  $$1$lcssa = $$0$lcssa;
 } else {
  $$12 = $$0$lcssa;$y$03 = $$01$lcssa$off0;
  while(1) {
   $22 = (($y$03>>>0) % 10)&-1;
   $23 = $22 | 48;
   $24 = $23&255;
   $25 = ((($$12)) + -1|0);
   HEAP8[$25>>0] = $24;
   $26 = (($y$03>>>0) / 10)&-1;
   $27 = ($y$03>>>0)<(10);
   if ($27) {
    $$1$lcssa = $25;
    break;
   } else {
    $$12 = $25;$y$03 = $26;
   }
  }
 }
 return ($$1$lcssa|0);
}
function _strerror($e) {
 $e = $e|0;
 var $$lcssa = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i$03 = 0, $i$03$lcssa = 0, $i$12 = 0, $s$0$lcssa = 0, $s$01 = 0, $s$1 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $i$03 = 0;
 while(1) {
  $1 = (4891 + ($i$03)|0);
  $2 = HEAP8[$1>>0]|0;
  $3 = $2&255;
  $4 = ($3|0)==($e|0);
  if ($4) {
   $i$03$lcssa = $i$03;
   label = 2;
   break;
  }
  $5 = (($i$03) + 1)|0;
  $6 = ($5|0)==(87);
  if ($6) {
   $i$12 = 87;$s$01 = 4979;
   label = 5;
   break;
  } else {
   $i$03 = $5;
  }
 }
 if ((label|0) == 2) {
  $0 = ($i$03$lcssa|0)==(0);
  if ($0) {
   $s$0$lcssa = 4979;
  } else {
   $i$12 = $i$03$lcssa;$s$01 = 4979;
   label = 5;
  }
 }
 if ((label|0) == 5) {
  while(1) {
   label = 0;
   $s$1 = $s$01;
   while(1) {
    $7 = HEAP8[$s$1>>0]|0;
    $8 = ($7<<24>>24)==(0);
    $9 = ((($s$1)) + 1|0);
    if ($8) {
     $$lcssa = $9;
     break;
    } else {
     $s$1 = $9;
    }
   }
   $10 = (($i$12) + -1)|0;
   $11 = ($10|0)==(0);
   if ($11) {
    $s$0$lcssa = $$lcssa;
    break;
   } else {
    $i$12 = $10;$s$01 = $$lcssa;
    label = 5;
   }
  }
 }
 return ($s$0$lcssa|0);
}
function _pad($f,$c,$w,$l,$fl) {
 $f = $f|0;
 $c = $c|0;
 $w = $w|0;
 $l = $l|0;
 $fl = $fl|0;
 var $$0$lcssa6 = 0, $$02 = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $or$cond = 0, $pad = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $pad = sp;
 $0 = $fl & 73728;
 $1 = ($0|0)==(0);
 $2 = ($w|0)>($l|0);
 $or$cond = $2 & $1;
 do {
  if ($or$cond) {
   $3 = (($w) - ($l))|0;
   $4 = ($3>>>0)>(256);
   $5 = $4 ? 256 : $3;
   _memset(($pad|0),($c|0),($5|0))|0;
   $6 = ($3>>>0)>(255);
   $7 = HEAP32[$f>>2]|0;
   $8 = $7 & 32;
   $9 = ($8|0)==(0);
   if ($6) {
    $10 = (($w) - ($l))|0;
    $$02 = $3;$17 = $7;$18 = $9;
    while(1) {
     if ($18) {
      (___fwritex($pad,256,$f)|0);
      $$pre = HEAP32[$f>>2]|0;
      $14 = $$pre;
     } else {
      $14 = $17;
     }
     $11 = (($$02) + -256)|0;
     $12 = ($11>>>0)>(255);
     $13 = $14 & 32;
     $15 = ($13|0)==(0);
     if ($12) {
      $$02 = $11;$17 = $14;$18 = $15;
     } else {
      break;
     }
    }
    $16 = $10 & 255;
    if ($15) {
     $$0$lcssa6 = $16;
    } else {
     break;
    }
   } else {
    if ($9) {
     $$0$lcssa6 = $3;
    } else {
     break;
    }
   }
   (___fwritex($pad,$$0$lcssa6,$f)|0);
  }
 } while(0);
 STACKTOP = sp;return;
}
function _wctomb($s,$wc) {
 $s = $s|0;
 $wc = $wc|0;
 var $$0 = 0, $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($s|0)==(0|0);
 if ($0) {
  $$0 = 0;
 } else {
  $1 = (_wcrtomb($s,$wc,0)|0);
  $$0 = $1;
 }
 return ($$0|0);
}
function _wcrtomb($s,$wc,$st) {
 $s = $s|0;
 $wc = $wc|0;
 $st = $st|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($s|0)==(0|0);
 do {
  if ($0) {
   $$0 = 1;
  } else {
   $1 = ($wc>>>0)<(128);
   if ($1) {
    $2 = $wc&255;
    HEAP8[$s>>0] = $2;
    $$0 = 1;
    break;
   }
   $3 = ($wc>>>0)<(2048);
   if ($3) {
    $4 = $wc >>> 6;
    $5 = $4 | 192;
    $6 = $5&255;
    $7 = ((($s)) + 1|0);
    HEAP8[$s>>0] = $6;
    $8 = $wc & 63;
    $9 = $8 | 128;
    $10 = $9&255;
    HEAP8[$7>>0] = $10;
    $$0 = 2;
    break;
   }
   $11 = ($wc>>>0)<(55296);
   $12 = $wc & -8192;
   $13 = ($12|0)==(57344);
   $or$cond = $11 | $13;
   if ($or$cond) {
    $14 = $wc >>> 12;
    $15 = $14 | 224;
    $16 = $15&255;
    $17 = ((($s)) + 1|0);
    HEAP8[$s>>0] = $16;
    $18 = $wc >>> 6;
    $19 = $18 & 63;
    $20 = $19 | 128;
    $21 = $20&255;
    $22 = ((($s)) + 2|0);
    HEAP8[$17>>0] = $21;
    $23 = $wc & 63;
    $24 = $23 | 128;
    $25 = $24&255;
    HEAP8[$22>>0] = $25;
    $$0 = 3;
    break;
   }
   $26 = (($wc) + -65536)|0;
   $27 = ($26>>>0)<(1048576);
   if ($27) {
    $28 = $wc >>> 18;
    $29 = $28 | 240;
    $30 = $29&255;
    $31 = ((($s)) + 1|0);
    HEAP8[$s>>0] = $30;
    $32 = $wc >>> 12;
    $33 = $32 & 63;
    $34 = $33 | 128;
    $35 = $34&255;
    $36 = ((($s)) + 2|0);
    HEAP8[$31>>0] = $35;
    $37 = $wc >>> 6;
    $38 = $37 & 63;
    $39 = $38 | 128;
    $40 = $39&255;
    $41 = ((($s)) + 3|0);
    HEAP8[$36>>0] = $40;
    $42 = $wc & 63;
    $43 = $42 | 128;
    $44 = $43&255;
    HEAP8[$41>>0] = $44;
    $$0 = 4;
    break;
   } else {
    $45 = (___errno_location()|0);
    HEAP32[$45>>2] = 84;
    $$0 = -1;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function _frexpl($x,$e) {
 $x = +$x;
 $e = $e|0;
 var $0 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (+_frexp($x,$e));
 return (+$0);
}
function _frexp($x,$e) {
 $x = +$x;
 $e = $e|0;
 var $$0 = 0.0, $$01 = 0.0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0, $storemerge = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $x;$0 = HEAP32[tempDoublePtr>>2]|0;
 $1 = HEAP32[tempDoublePtr+4>>2]|0;
 $2 = (_bitshift64Lshr(($0|0),($1|0),52)|0);
 $3 = tempRet0;
 $4 = $2 & 2047;
 switch ($4|0) {
 case 0:  {
  $5 = $x != 0.0;
  if ($5) {
   $6 = $x * 1.8446744073709552E+19;
   $7 = (+_frexp($6,$e));
   $8 = HEAP32[$e>>2]|0;
   $9 = (($8) + -64)|0;
   $$01 = $7;$storemerge = $9;
  } else {
   $$01 = $x;$storemerge = 0;
  }
  HEAP32[$e>>2] = $storemerge;
  $$0 = $$01;
  break;
 }
 case 2047:  {
  $$0 = $x;
  break;
 }
 default: {
  $10 = (($4) + -1022)|0;
  HEAP32[$e>>2] = $10;
  $11 = $1 & -2146435073;
  $12 = $11 | 1071644672;
  HEAP32[tempDoublePtr>>2] = $0;HEAP32[tempDoublePtr+4>>2] = $12;$13 = +HEAPF64[tempDoublePtr>>3];
  $$0 = $13;
 }
 }
 return (+$$0);
}
function ___lockfile($f) {
 $f = $f|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function _strlen($s) {
 $s = $s|0;
 var $$0 = 0, $$01$lcssa = 0, $$014 = 0, $$1$lcssa = 0, $$lcssa20 = 0, $$pn = 0, $$pn15 = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $w$0 = 0, $w$0$lcssa = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = $s;
 $1 = $0 & 3;
 $2 = ($1|0)==(0);
 L1: do {
  if ($2) {
   $$01$lcssa = $s;
   label = 4;
  } else {
   $$014 = $s;$21 = $0;
   while(1) {
    $3 = HEAP8[$$014>>0]|0;
    $4 = ($3<<24>>24)==(0);
    if ($4) {
     $$pn = $21;
     break L1;
    }
    $5 = ((($$014)) + 1|0);
    $6 = $5;
    $7 = $6 & 3;
    $8 = ($7|0)==(0);
    if ($8) {
     $$01$lcssa = $5;
     label = 4;
     break;
    } else {
     $$014 = $5;$21 = $6;
    }
   }
  }
 } while(0);
 if ((label|0) == 4) {
  $w$0 = $$01$lcssa;
  while(1) {
   $9 = HEAP32[$w$0>>2]|0;
   $10 = (($9) + -16843009)|0;
   $11 = $9 & -2139062144;
   $12 = $11 ^ -2139062144;
   $13 = $12 & $10;
   $14 = ($13|0)==(0);
   $15 = ((($w$0)) + 4|0);
   if ($14) {
    $w$0 = $15;
   } else {
    $$lcssa20 = $9;$w$0$lcssa = $w$0;
    break;
   }
  }
  $16 = $$lcssa20&255;
  $17 = ($16<<24>>24)==(0);
  if ($17) {
   $$1$lcssa = $w$0$lcssa;
  } else {
   $$pn15 = $w$0$lcssa;
   while(1) {
    $18 = ((($$pn15)) + 1|0);
    $$pre = HEAP8[$18>>0]|0;
    $19 = ($$pre<<24>>24)==(0);
    if ($19) {
     $$1$lcssa = $18;
     break;
    } else {
     $$pn15 = $18;
    }
   }
  }
  $20 = $$1$lcssa;
  $$pn = $20;
 }
 $$0 = (($$pn) - ($0))|0;
 return ($$0|0);
}
function _strcpy($dest,$src) {
 $dest = $dest|0;
 $src = $src|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 (___stpcpy($dest,$src)|0);
 return ($dest|0);
}
function ___stpcpy($d,$s) {
 $d = $d|0;
 $s = $s|0;
 var $$0$lcssa = 0, $$01$lcssa = 0, $$0115 = 0, $$016 = 0, $$03 = 0, $$1$ph = 0, $$12$ph = 0, $$128 = 0, $$19 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $wd$0$lcssa = 0, $wd$010 = 0, $ws$0$lcssa = 0, $ws$011 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = $s;
 $1 = $d;
 $2 = $0 ^ $1;
 $3 = $2 & 3;
 $4 = ($3|0)==(0);
 L1: do {
  if ($4) {
   $5 = $0 & 3;
   $6 = ($5|0)==(0);
   if ($6) {
    $$0$lcssa = $s;$$01$lcssa = $d;
   } else {
    $$0115 = $d;$$016 = $s;
    while(1) {
     $7 = HEAP8[$$016>>0]|0;
     HEAP8[$$0115>>0] = $7;
     $8 = ($7<<24>>24)==(0);
     if ($8) {
      $$03 = $$0115;
      break L1;
     }
     $9 = ((($$016)) + 1|0);
     $10 = ((($$0115)) + 1|0);
     $11 = $9;
     $12 = $11 & 3;
     $13 = ($12|0)==(0);
     if ($13) {
      $$0$lcssa = $9;$$01$lcssa = $10;
      break;
     } else {
      $$0115 = $10;$$016 = $9;
     }
    }
   }
   $14 = HEAP32[$$0$lcssa>>2]|0;
   $15 = (($14) + -16843009)|0;
   $16 = $14 & -2139062144;
   $17 = $16 ^ -2139062144;
   $18 = $17 & $15;
   $19 = ($18|0)==(0);
   if ($19) {
    $22 = $14;$wd$010 = $$01$lcssa;$ws$011 = $$0$lcssa;
    while(1) {
     $20 = ((($ws$011)) + 4|0);
     $21 = ((($wd$010)) + 4|0);
     HEAP32[$wd$010>>2] = $22;
     $23 = HEAP32[$20>>2]|0;
     $24 = (($23) + -16843009)|0;
     $25 = $23 & -2139062144;
     $26 = $25 ^ -2139062144;
     $27 = $26 & $24;
     $28 = ($27|0)==(0);
     if ($28) {
      $22 = $23;$wd$010 = $21;$ws$011 = $20;
     } else {
      $wd$0$lcssa = $21;$ws$0$lcssa = $20;
      break;
     }
    }
   } else {
    $wd$0$lcssa = $$01$lcssa;$ws$0$lcssa = $$0$lcssa;
   }
   $$1$ph = $ws$0$lcssa;$$12$ph = $wd$0$lcssa;
   label = 8;
  } else {
   $$1$ph = $s;$$12$ph = $d;
   label = 8;
  }
 } while(0);
 if ((label|0) == 8) {
  $29 = HEAP8[$$1$ph>>0]|0;
  HEAP8[$$12$ph>>0] = $29;
  $30 = ($29<<24>>24)==(0);
  if ($30) {
   $$03 = $$12$ph;
  } else {
   $$128 = $$12$ph;$$19 = $$1$ph;
   while(1) {
    $31 = ((($$19)) + 1|0);
    $32 = ((($$128)) + 1|0);
    $33 = HEAP8[$31>>0]|0;
    HEAP8[$32>>0] = $33;
    $34 = ($33<<24>>24)==(0);
    if ($34) {
     $$03 = $32;
     break;
    } else {
     $$128 = $32;$$19 = $31;
    }
   }
  }
 }
 return ($$03|0);
}
function _strchr($s,$c) {
 $s = $s|0;
 $c = $c|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___strchrnul($s,$c)|0);
 $1 = HEAP8[$0>>0]|0;
 $2 = $c&255;
 $3 = ($1<<24>>24)==($2<<24>>24);
 $4 = $3 ? $0 : 0;
 return ($4|0);
}
function ___strchrnul($s,$c) {
 $s = $s|0;
 $c = $c|0;
 var $$0 = 0, $$02$lcssa = 0, $$0211 = 0, $$1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond5 = 0, $w$0$lcssa = 0, $w$08 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = $c & 255;
 $1 = ($0|0)==(0);
 L1: do {
  if ($1) {
   $6 = (_strlen($s)|0);
   $7 = (($s) + ($6)|0);
   $$0 = $7;
  } else {
   $2 = $s;
   $3 = $2 & 3;
   $4 = ($3|0)==(0);
   if ($4) {
    $$02$lcssa = $s;
   } else {
    $5 = $c&255;
    $$0211 = $s;
    while(1) {
     $8 = HEAP8[$$0211>>0]|0;
     $9 = ($8<<24>>24)==(0);
     $10 = ($8<<24>>24)==($5<<24>>24);
     $or$cond = $9 | $10;
     if ($or$cond) {
      $$0 = $$0211;
      break L1;
     }
     $11 = ((($$0211)) + 1|0);
     $12 = $11;
     $13 = $12 & 3;
     $14 = ($13|0)==(0);
     if ($14) {
      $$02$lcssa = $11;
      break;
     } else {
      $$0211 = $11;
     }
    }
   }
   $15 = Math_imul($0, 16843009)|0;
   $16 = HEAP32[$$02$lcssa>>2]|0;
   $17 = (($16) + -16843009)|0;
   $18 = $16 & -2139062144;
   $19 = $18 ^ -2139062144;
   $20 = $19 & $17;
   $21 = ($20|0)==(0);
   L10: do {
    if ($21) {
     $23 = $16;$w$08 = $$02$lcssa;
     while(1) {
      $22 = $23 ^ $15;
      $24 = (($22) + -16843009)|0;
      $25 = $22 & -2139062144;
      $26 = $25 ^ -2139062144;
      $27 = $26 & $24;
      $28 = ($27|0)==(0);
      if (!($28)) {
       $w$0$lcssa = $w$08;
       break L10;
      }
      $29 = ((($w$08)) + 4|0);
      $30 = HEAP32[$29>>2]|0;
      $31 = (($30) + -16843009)|0;
      $32 = $30 & -2139062144;
      $33 = $32 ^ -2139062144;
      $34 = $33 & $31;
      $35 = ($34|0)==(0);
      if ($35) {
       $23 = $30;$w$08 = $29;
      } else {
       $w$0$lcssa = $29;
       break;
      }
     }
    } else {
     $w$0$lcssa = $$02$lcssa;
    }
   } while(0);
   $36 = $c&255;
   $$1 = $w$0$lcssa;
   while(1) {
    $37 = HEAP8[$$1>>0]|0;
    $38 = ($37<<24>>24)==(0);
    $39 = ($37<<24>>24)==($36<<24>>24);
    $or$cond5 = $38 | $39;
    $40 = ((($$1)) + 1|0);
    if ($or$cond5) {
     $$0 = $$1;
     break;
    } else {
     $$1 = $40;
    }
   }
  }
 } while(0);
 return ($$0|0);
}
function _fopen($filename,$mode) {
 $filename = $filename|0;
 $mode = $mode|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $memchr = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP8[$mode>>0]|0;
 $1 = $0 << 24 >> 24;
 $memchr = (_memchr(6827,$1,4)|0);
 $2 = ($memchr|0)==(0|0);
 if ($2) {
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = 22;
  $$0 = 0;
 } else {
  $4 = (___fmodeflags($mode)|0);
  $5 = $4 | 32768;
  HEAP32[$vararg_buffer>>2] = $filename;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $5;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = 438;
  $6 = (___syscall5(5,($vararg_buffer|0))|0);
  $7 = (___syscall_ret($6)|0);
  $8 = ($7|0)<(0);
  if ($8) {
   $$0 = 0;
  } else {
   $9 = (___fdopen($7,$mode)|0);
   $10 = ($9|0)==(0|0);
   if ($10) {
    HEAP32[$vararg_buffer3>>2] = $7;
    (___syscall6(6,($vararg_buffer3|0))|0);
    $$0 = 0;
   } else {
    $$0 = $9;
   }
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function ___fmodeflags($mode) {
 $mode = $mode|0;
 var $$ = 0, $$flags$4 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $flags$0 = 0, $flags$0$ = 0, $flags$2 = 0;
 var $flags$2$ = 0, $flags$4 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_strchr($mode,43)|0);
 $1 = ($0|0)==(0|0);
 $2 = HEAP8[$mode>>0]|0;
 $not$ = ($2<<24>>24)!=(114);
 $$ = $not$&1;
 $flags$0 = $1 ? $$ : 2;
 $3 = (_strchr($mode,120)|0);
 $4 = ($3|0)==(0|0);
 $5 = $flags$0 | 128;
 $flags$0$ = $4 ? $flags$0 : $5;
 $6 = (_strchr($mode,101)|0);
 $7 = ($6|0)==(0|0);
 $8 = $flags$0$ | 524288;
 $flags$2 = $7 ? $flags$0$ : $8;
 $9 = ($2<<24>>24)==(114);
 $10 = $flags$2 | 64;
 $flags$2$ = $9 ? $flags$2 : $10;
 $11 = ($2<<24>>24)==(119);
 $12 = $flags$2$ | 512;
 $flags$4 = $11 ? $12 : $flags$2$;
 $13 = ($2<<24>>24)==(97);
 $14 = $flags$4 | 1024;
 $$flags$4 = $13 ? $14 : $flags$4;
 return ($$flags$4|0);
}
function ___fdopen($fd,$mode) {
 $fd = $fd|0;
 $mode = $mode|0;
 var $$0 = 0, $$cast = 0, $$pre = 0, $$pre1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $memchr = 0, $tio = 0, $vararg_buffer = 0, $vararg_buffer12 = 0, $vararg_buffer3 = 0, $vararg_buffer7 = 0, $vararg_ptr1 = 0, $vararg_ptr10 = 0, $vararg_ptr11 = 0, $vararg_ptr15 = 0, $vararg_ptr16 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, dest = 0, label = 0;
 var sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer12 = sp + 40|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $tio = sp + 52|0;
 $0 = HEAP8[$mode>>0]|0;
 $1 = $0 << 24 >> 24;
 $memchr = (_memchr(6827,$1,4)|0);
 $2 = ($memchr|0)==(0|0);
 if ($2) {
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = 22;
  $$0 = 0;
 } else {
  $4 = (_malloc(1144)|0);
  $5 = ($4|0)==(0|0);
  if ($5) {
   $$0 = 0;
  } else {
   dest=$4; stop=dest+112|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
   $6 = (_strchr($mode,43)|0);
   $7 = ($6|0)==(0|0);
   if ($7) {
    $8 = ($0<<24>>24)==(114);
    $9 = $8 ? 8 : 4;
    HEAP32[$4>>2] = $9;
   }
   $10 = (_strchr($mode,101)|0);
   $11 = ($10|0)==(0|0);
   if ($11) {
    $13 = $0;
   } else {
    HEAP32[$vararg_buffer>>2] = $fd;
    $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
    HEAP32[$vararg_ptr1>>2] = 2;
    $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
    HEAP32[$vararg_ptr2>>2] = 1;
    (___syscall221(221,($vararg_buffer|0))|0);
    $$pre = HEAP8[$mode>>0]|0;
    $13 = $$pre;
   }
   $12 = ($13<<24>>24)==(97);
   if ($12) {
    HEAP32[$vararg_buffer3>>2] = $fd;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = 3;
    $14 = (___syscall221(221,($vararg_buffer3|0))|0);
    $15 = $14 & 1024;
    $16 = ($15|0)==(0);
    if ($16) {
     $17 = $14 | 1024;
     HEAP32[$vararg_buffer7>>2] = $fd;
     $vararg_ptr10 = ((($vararg_buffer7)) + 4|0);
     HEAP32[$vararg_ptr10>>2] = 4;
     $vararg_ptr11 = ((($vararg_buffer7)) + 8|0);
     HEAP32[$vararg_ptr11>>2] = $17;
     (___syscall221(221,($vararg_buffer7|0))|0);
    }
    $18 = HEAP32[$4>>2]|0;
    $19 = $18 | 128;
    HEAP32[$4>>2] = $19;
    $26 = $19;
   } else {
    $$pre1 = HEAP32[$4>>2]|0;
    $26 = $$pre1;
   }
   $20 = ((($4)) + 60|0);
   HEAP32[$20>>2] = $fd;
   $21 = ((($4)) + 120|0);
   $22 = ((($4)) + 44|0);
   HEAP32[$22>>2] = $21;
   $23 = ((($4)) + 48|0);
   HEAP32[$23>>2] = 1024;
   $24 = ((($4)) + 75|0);
   HEAP8[$24>>0] = -1;
   $25 = $26 & 8;
   $27 = ($25|0)==(0);
   if ($27) {
    HEAP32[$vararg_buffer12>>2] = $fd;
    $vararg_ptr15 = ((($vararg_buffer12)) + 4|0);
    HEAP32[$vararg_ptr15>>2] = 21505;
    $vararg_ptr16 = ((($vararg_buffer12)) + 8|0);
    HEAP32[$vararg_ptr16>>2] = $tio;
    $28 = (___syscall54(54,($vararg_buffer12|0))|0);
    $29 = ($28|0)==(0);
    if ($29) {
     HEAP8[$24>>0] = 10;
    }
   }
   $30 = ((($4)) + 32|0);
   HEAP32[$30>>2] = 7;
   $31 = ((($4)) + 36|0);
   HEAP32[$31>>2] = 2;
   $32 = ((($4)) + 40|0);
   HEAP32[$32>>2] = 3;
   $33 = ((($4)) + 12|0);
   HEAP32[$33>>2] = 1;
   $34 = HEAP32[(39756)>>2]|0;
   $35 = ($34|0)==(0);
   if ($35) {
    $36 = ((($4)) + 76|0);
    HEAP32[$36>>2] = -1;
   }
   ___lock(((39780)|0));
   $37 = HEAP32[(39776)>>2]|0;
   $38 = ((($4)) + 56|0);
   HEAP32[$38>>2] = $37;
   $39 = ($37|0)==(0);
   if (!($39)) {
    $$cast = $37;
    $40 = ((($$cast)) + 52|0);
    HEAP32[$40>>2] = $4;
   }
   HEAP32[(39776)>>2] = $4;
   ___unlock(((39780)|0));
   $$0 = $4;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function _fclose($f) {
 $f = $f|0;
 var $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 76|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)>(-1);
 if ($2) {
 }
 $3 = HEAP32[$f>>2]|0;
 $4 = $3 & 1;
 $5 = ($4|0)!=(0);
 if (!($5)) {
  ___lock(((39780)|0));
  $6 = ((($f)) + 52|0);
  $7 = HEAP32[$6>>2]|0;
  $8 = ($7|0)==(0|0);
  $9 = $7;
  $$pre = ((($f)) + 56|0);
  if (!($8)) {
   $10 = HEAP32[$$pre>>2]|0;
   $11 = ((($7)) + 56|0);
   HEAP32[$11>>2] = $10;
  }
  $12 = HEAP32[$$pre>>2]|0;
  $13 = ($12|0)==(0|0);
  $14 = $12;
  if (!($13)) {
   $15 = ((($12)) + 52|0);
   HEAP32[$15>>2] = $9;
  }
  $16 = HEAP32[(39776)>>2]|0;
  $17 = ($16|0)==($f|0);
  if ($17) {
   HEAP32[(39776)>>2] = $14;
  }
  ___unlock(((39780)|0));
 }
 $18 = (_fflush($f)|0);
 $19 = ((($f)) + 12|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = (FUNCTION_TABLE_ii[$20 & 1]($f)|0);
 $22 = $21 | $18;
 $23 = ((($f)) + 92|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ($24|0)==(0|0);
 if (!($25)) {
  _free($24);
 }
 if (!($5)) {
  _free($f);
 }
 return ($22|0);
}
function _fflush($f) {
 $f = $f|0;
 var $$0 = 0, $$01 = 0, $$012 = 0, $$014 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, $r$0$lcssa = 0, $r$03 = 0, $r$1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($f|0)==(0|0);
 do {
  if ($0) {
   $7 = HEAP32[59]|0;
   $8 = ($7|0)==(0|0);
   if ($8) {
    $27 = 0;
   } else {
    $9 = HEAP32[59]|0;
    $10 = (_fflush($9)|0);
    $27 = $10;
   }
   ___lock(((39780)|0));
   $$012 = HEAP32[(39776)>>2]|0;
   $11 = ($$012|0)==(0|0);
   if ($11) {
    $r$0$lcssa = $27;
   } else {
    $$014 = $$012;$r$03 = $27;
    while(1) {
     $12 = ((($$014)) + 76|0);
     $13 = HEAP32[$12>>2]|0;
     $14 = ($13|0)>(-1);
     if ($14) {
      $15 = (___lockfile($$014)|0);
      $24 = $15;
     } else {
      $24 = 0;
     }
     $16 = ((($$014)) + 20|0);
     $17 = HEAP32[$16>>2]|0;
     $18 = ((($$014)) + 28|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ($17>>>0)>($19>>>0);
     if ($20) {
      $21 = (___fflush_unlocked($$014)|0);
      $22 = $21 | $r$03;
      $r$1 = $22;
     } else {
      $r$1 = $r$03;
     }
     $23 = ($24|0)==(0);
     if (!($23)) {
      ___unlockfile($$014);
     }
     $25 = ((($$014)) + 56|0);
     $$01 = HEAP32[$25>>2]|0;
     $26 = ($$01|0)==(0|0);
     if ($26) {
      $r$0$lcssa = $r$1;
      break;
     } else {
      $$014 = $$01;$r$03 = $r$1;
     }
    }
   }
   ___unlock(((39780)|0));
   $$0 = $r$0$lcssa;
  } else {
   $1 = ((($f)) + 76|0);
   $2 = HEAP32[$1>>2]|0;
   $3 = ($2|0)>(-1);
   if (!($3)) {
    $4 = (___fflush_unlocked($f)|0);
    $$0 = $4;
    break;
   }
   $5 = (___lockfile($f)|0);
   $phitmp = ($5|0)==(0);
   $6 = (___fflush_unlocked($f)|0);
   if ($phitmp) {
    $$0 = $6;
   } else {
    ___unlockfile($f);
    $$0 = $6;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($f) {
 $f = $f|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 20|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ((($f)) + 28|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($1>>>0)>($3>>>0);
 if ($4) {
  $5 = ((($f)) + 36|0);
  $6 = HEAP32[$5>>2]|0;
  (FUNCTION_TABLE_iiii[$6 & 7]($f,0,0)|0);
  $7 = HEAP32[$0>>2]|0;
  $8 = ($7|0)==(0|0);
  if ($8) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $9 = ((($f)) + 4|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ((($f)) + 8|0);
  $12 = HEAP32[$11>>2]|0;
  $13 = ($10>>>0)<($12>>>0);
  if ($13) {
   $14 = ((($f)) + 40|0);
   $15 = HEAP32[$14>>2]|0;
   $16 = $10;
   $17 = $12;
   $18 = (($16) - ($17))|0;
   (FUNCTION_TABLE_iiii[$15 & 7]($f,$18,1)|0);
  }
  $19 = ((($f)) + 16|0);
  HEAP32[$19>>2] = 0;
  HEAP32[$2>>2] = 0;
  HEAP32[$0>>2] = 0;
  HEAP32[$11>>2] = 0;
  HEAP32[$9>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function _fseek($f,$off,$whence) {
 $f = $f|0;
 $off = $off|0;
 $whence = $whence|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___fseeko($f,$off,$whence)|0);
 return ($0|0);
}
function ___fseeko($f,$off,$whence) {
 $f = $f|0;
 $off = $off|0;
 $whence = $whence|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 76|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)>(-1);
 if ($2) {
  $4 = (___lockfile($f)|0);
  $phitmp = ($4|0)==(0);
  $5 = (___fseeko_unlocked($f,$off,$whence)|0);
  if ($phitmp) {
   $6 = $5;
  } else {
   ___unlockfile($f);
   $6 = $5;
  }
 } else {
  $3 = (___fseeko_unlocked($f,$off,$whence)|0);
  $6 = $3;
 }
 return ($6|0);
}
function ___fseeko_unlocked($f,$off,$whence) {
 $f = $f|0;
 $off = $off|0;
 $whence = $whence|0;
 var $$0 = 0, $$01 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($whence|0)==(1);
 if ($0) {
  $1 = ((($f)) + 8|0);
  $2 = HEAP32[$1>>2]|0;
  $3 = ((($f)) + 4|0);
  $4 = HEAP32[$3>>2]|0;
  $5 = (($off) - ($2))|0;
  $6 = (($5) + ($4))|0;
  $$01 = $6;
 } else {
  $$01 = $off;
 }
 $7 = ((($f)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($f)) + 28|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ($8>>>0)>($10>>>0);
 if ($11) {
  $12 = ((($f)) + 36|0);
  $13 = HEAP32[$12>>2]|0;
  (FUNCTION_TABLE_iiii[$13 & 7]($f,0,0)|0);
  $14 = HEAP32[$7>>2]|0;
  $15 = ($14|0)==(0|0);
  if ($15) {
   $$0 = -1;
  } else {
   label = 5;
  }
 } else {
  label = 5;
 }
 if ((label|0) == 5) {
  $16 = ((($f)) + 16|0);
  HEAP32[$16>>2] = 0;
  HEAP32[$9>>2] = 0;
  HEAP32[$7>>2] = 0;
  $17 = ((($f)) + 40|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = (FUNCTION_TABLE_iiii[$18 & 7]($f,$$01,$whence)|0);
  $20 = ($19|0)<(0);
  if ($20) {
   $$0 = -1;
  } else {
   $21 = ((($f)) + 8|0);
   HEAP32[$21>>2] = 0;
   $22 = ((($f)) + 4|0);
   HEAP32[$22>>2] = 0;
   $23 = HEAP32[$f>>2]|0;
   $24 = $23 & -17;
   HEAP32[$f>>2] = $24;
   $$0 = 0;
  }
 }
 return ($$0|0);
}
function _fprintf($f,$fmt,$varargs) {
 $f = $f|0;
 $fmt = $fmt|0;
 $varargs = $varargs|0;
 var $0 = 0, $ap = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $ap = sp;
 HEAP32[$ap>>2] = $varargs;
 $0 = (_vfprintf($f,$fmt,$ap)|0);
 STACKTOP = sp;return ($0|0);
}
function ___ftello($f) {
 $f = $f|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 76|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)>(-1);
 if ($2) {
  $4 = (___lockfile($f)|0);
  $phitmp = ($4|0)==(0);
  $5 = (___ftello_unlocked($f)|0);
  if ($phitmp) {
   $6 = $5;
  } else {
   $6 = $5;
  }
 } else {
  $3 = (___ftello_unlocked($f)|0);
  $6 = $3;
 }
 return ($6|0);
}
function ___ftello_unlocked($f) {
 $f = $f|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 40|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = HEAP32[$f>>2]|0;
 $3 = $2 & 128;
 $4 = ($3|0)==(0);
 if ($4) {
  $10 = 1;
 } else {
  $5 = ((($f)) + 20|0);
  $6 = HEAP32[$5>>2]|0;
  $7 = ((($f)) + 28|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = ($6>>>0)>($8>>>0);
  $phitmp = $9 ? 2 : 1;
  $10 = $phitmp;
 }
 $11 = (FUNCTION_TABLE_iiii[$1 & 7]($f,0,$10)|0);
 $12 = ($11|0)<(0);
 if ($12) {
  $$0 = $11;
 } else {
  $13 = ((($f)) + 8|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = ((($f)) + 4|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = ((($f)) + 20|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = ((($f)) + 28|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = (($11) - ($14))|0;
  $22 = (($21) + ($16))|0;
  $23 = (($22) + ($18))|0;
  $24 = (($23) - ($20))|0;
  $$0 = $24;
 }
 return ($$0|0);
}
function _fwrite($src,$size,$nmemb,$f) {
 $src = $src|0;
 $size = $size|0;
 $nmemb = $nmemb|0;
 $f = $f|0;
 var $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = Math_imul($nmemb, $size)|0;
 $1 = ((($f)) + 76|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)>(-1);
 if ($3) {
  $5 = (___lockfile($f)|0);
  $phitmp = ($5|0)==(0);
  $6 = (___fwritex($src,$0,$f)|0);
  if ($phitmp) {
   $8 = $6;
  } else {
   ___unlockfile($f);
   $8 = $6;
  }
 } else {
  $4 = (___fwritex($src,$0,$f)|0);
  $8 = $4;
 }
 $7 = ($8|0)==($0|0);
 if ($7) {
  $10 = $nmemb;
 } else {
  $9 = (($8>>>0) / ($size>>>0))&-1;
  $10 = $9;
 }
 return ($10|0);
}
function _fread($destv,$size,$nmemb,$f) {
 $destv = $destv|0;
 $size = $size|0;
 $nmemb = $nmemb|0;
 $f = $f|0;
 var $$ = 0, $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $dest$0$ph = 0, $dest$02 = 0, $l$0$ph = 0, $l$03 = 0, $l$03$lcssa = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = Math_imul($nmemb, $size)|0;
 $1 = ((($f)) + 76|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)>(-1);
 if ($3) {
  $4 = (___lockfile($f)|0);
  $31 = $4;
 } else {
  $31 = 0;
 }
 $5 = ((($f)) + 74|0);
 $6 = HEAP8[$5>>0]|0;
 $7 = $6 << 24 >> 24;
 $8 = (($7) + 255)|0;
 $9 = $8 | $7;
 $10 = $9&255;
 HEAP8[$5>>0] = $10;
 $11 = ((($f)) + 8|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($f)) + 4|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = (($12) - ($14))|0;
 $16 = ($15|0)>(0);
 $17 = $14;
 if ($16) {
  $18 = ($15>>>0)<($0>>>0);
  $$ = $18 ? $15 : $0;
  _memcpy(($destv|0),($17|0),($$|0))|0;
  $19 = (($17) + ($$)|0);
  HEAP32[$13>>2] = $19;
  $20 = (($destv) + ($$)|0);
  $21 = (($0) - ($$))|0;
  $dest$0$ph = $20;$l$0$ph = $21;
 } else {
  $dest$0$ph = $destv;$l$0$ph = $0;
 }
 $22 = ($l$0$ph|0)==(0);
 L7: do {
  if ($22) {
   label = 13;
  } else {
   $23 = ((($f)) + 32|0);
   $dest$02 = $dest$0$ph;$l$03 = $l$0$ph;
   while(1) {
    $24 = (___toread($f)|0);
    $25 = ($24|0)==(0);
    if (!($25)) {
     $l$03$lcssa = $l$03;
     break;
    }
    $26 = HEAP32[$23>>2]|0;
    $27 = (FUNCTION_TABLE_iiii[$26 & 7]($f,$dest$02,$l$03)|0);
    $28 = (($27) + 1)|0;
    $29 = ($28>>>0)<(2);
    if ($29) {
     $l$03$lcssa = $l$03;
     break;
    }
    $34 = (($l$03) - ($27))|0;
    $35 = (($dest$02) + ($27)|0);
    $36 = ($l$03|0)==($27|0);
    if ($36) {
     label = 13;
     break L7;
    } else {
     $dest$02 = $35;$l$03 = $34;
    }
   }
   $30 = ($31|0)==(0);
   if (!($30)) {
    ___unlockfile($f);
   }
   $32 = (($0) - ($l$03$lcssa))|0;
   $33 = (($32>>>0) / ($size>>>0))&-1;
   $$0 = $33;
  }
 } while(0);
 if ((label|0) == 13) {
  $37 = ($31|0)==(0);
  if ($37) {
   $$0 = $nmemb;
  } else {
   ___unlockfile($f);
   $$0 = $nmemb;
  }
 }
 return ($$0|0);
}
function _ftell($f) {
 $f = $f|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___ftello($f)|0);
 return ($0|0);
}
function _malloc($bytes) {
 $bytes = $bytes|0;
 var $$0 = 0, $$lcssa = 0, $$lcssa141 = 0, $$lcssa142 = 0, $$lcssa144 = 0, $$lcssa147 = 0, $$lcssa149 = 0, $$lcssa151 = 0, $$lcssa153 = 0, $$lcssa155 = 0, $$lcssa157 = 0, $$not$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i13 = 0, $$pre$i16$i = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i14Z2D = 0, $$pre$phi$i17$iZ2D = 0;
 var $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre71 = 0, $$pre9$i$i = 0, $$rsize$0$i = 0, $$rsize$4$i = 0, $$v$0$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0;
 var $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0;
 var $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0;
 var $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $107 = 0, $108 = 0;
 var $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0;
 var $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0;
 var $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0;
 var $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0;
 var $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0;
 var $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0;
 var $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0;
 var $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0;
 var $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0;
 var $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0;
 var $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0;
 var $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0;
 var $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0;
 var $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0;
 var $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0;
 var $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0;
 var $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0;
 var $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0;
 var $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0;
 var $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0;
 var $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0;
 var $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0;
 var $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0;
 var $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0;
 var $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0;
 var $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0;
 var $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0;
 var $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0;
 var $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0;
 var $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0;
 var $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0;
 var $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0;
 var $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0;
 var $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0;
 var $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0;
 var $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0;
 var $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0;
 var $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0;
 var $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0;
 var $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0;
 var $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0;
 var $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0;
 var $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0;
 var $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0;
 var $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0;
 var $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0;
 var $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0;
 var $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0;
 var $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0;
 var $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0, $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0, $K12$0$i = 0, $K2$0$i$i = 0, $K8$0$i$i = 0, $R$1$i = 0;
 var $R$1$i$i = 0, $R$1$i$i$lcssa = 0, $R$1$i$lcssa = 0, $R$1$i9 = 0, $R$1$i9$lcssa = 0, $R$3$i = 0, $R$3$i$i = 0, $R$3$i11 = 0, $RP$1$i = 0, $RP$1$i$i = 0, $RP$1$i$i$lcssa = 0, $RP$1$i$lcssa = 0, $RP$1$i8 = 0, $RP$1$i8$lcssa = 0, $T$0$i = 0, $T$0$i$i = 0, $T$0$i$i$lcssa = 0, $T$0$i$i$lcssa140 = 0, $T$0$i$lcssa = 0, $T$0$i$lcssa156 = 0;
 var $T$0$i18$i = 0, $T$0$i18$i$lcssa = 0, $T$0$i18$i$lcssa139 = 0, $br$2$ph$i = 0, $cond$i = 0, $cond$i$i = 0, $cond$i12 = 0, $exitcond$i$i = 0, $i$01$i$i = 0, $idx$0$i = 0, $magic$i$i = 0, $nb$0 = 0, $not$$i$i = 0, $not$$i20$i = 0, $not$7$i = 0, $oldfirst$0$i$i = 0, $or$cond$i = 0, $or$cond$i17 = 0, $or$cond1$i = 0, $or$cond1$i16 = 0;
 var $or$cond10$i = 0, $or$cond11$i = 0, $or$cond2$i = 0, $or$cond48$i = 0, $or$cond5$i = 0, $or$cond7$i = 0, $or$cond8$i = 0, $p$0$i$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i5 = 0, $rsize$1$i = 0, $rsize$3$i = 0, $rsize$4$lcssa$i = 0, $rsize$412$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sizebits$0$$i = 0, $sizebits$0$i = 0;
 var $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$068$i = 0, $sp$068$i$lcssa = 0, $sp$167$i = 0, $sp$167$i$lcssa = 0, $ssize$0$i = 0, $ssize$2$ph$i = 0, $ssize$5$i = 0, $t$0$i = 0, $t$0$i4 = 0, $t$2$i = 0, $t$4$ph$i = 0, $t$4$v$4$i = 0, $t$411$i = 0, $tbase$746$i = 0, $tsize$745$i = 0, $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i6 = 0;
 var $v$1$i = 0, $v$3$i = 0, $v$4$lcssa$i = 0, $v$413$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $magic$i$i = sp;
 $0 = ($bytes>>>0)<(245);
 do {
  if ($0) {
   $1 = ($bytes>>>0)<(11);
   $2 = (($bytes) + 11)|0;
   $3 = $2 & -8;
   $4 = $1 ? 16 : $3;
   $5 = $4 >>> 3;
   $6 = HEAP32[9950]|0;
   $7 = $6 >>> $5;
   $8 = $7 & 3;
   $9 = ($8|0)==(0);
   if (!($9)) {
    $10 = $7 & 1;
    $11 = $10 ^ 1;
    $12 = (($11) + ($5))|0;
    $13 = $12 << 1;
    $14 = (39840 + ($13<<2)|0);
    $15 = ((($14)) + 8|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ($14|0)==($18|0);
    do {
     if ($19) {
      $20 = 1 << $12;
      $21 = $20 ^ -1;
      $22 = $6 & $21;
      HEAP32[9950] = $22;
     } else {
      $23 = HEAP32[(39816)>>2]|0;
      $24 = ($18>>>0)<($23>>>0);
      if ($24) {
       _abort();
       // unreachable;
      }
      $25 = ((($18)) + 12|0);
      $26 = HEAP32[$25>>2]|0;
      $27 = ($26|0)==($16|0);
      if ($27) {
       HEAP32[$25>>2] = $14;
       HEAP32[$15>>2] = $18;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $28 = $12 << 3;
    $29 = $28 | 3;
    $30 = ((($16)) + 4|0);
    HEAP32[$30>>2] = $29;
    $31 = (($16) + ($28)|0);
    $32 = ((($31)) + 4|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = $33 | 1;
    HEAP32[$32>>2] = $34;
    $$0 = $17;
    STACKTOP = sp;return ($$0|0);
   }
   $35 = HEAP32[(39808)>>2]|0;
   $36 = ($4>>>0)>($35>>>0);
   if ($36) {
    $37 = ($7|0)==(0);
    if (!($37)) {
     $38 = $7 << $5;
     $39 = 2 << $5;
     $40 = (0 - ($39))|0;
     $41 = $39 | $40;
     $42 = $38 & $41;
     $43 = (0 - ($42))|0;
     $44 = $42 & $43;
     $45 = (($44) + -1)|0;
     $46 = $45 >>> 12;
     $47 = $46 & 16;
     $48 = $45 >>> $47;
     $49 = $48 >>> 5;
     $50 = $49 & 8;
     $51 = $50 | $47;
     $52 = $48 >>> $50;
     $53 = $52 >>> 2;
     $54 = $53 & 4;
     $55 = $51 | $54;
     $56 = $52 >>> $54;
     $57 = $56 >>> 1;
     $58 = $57 & 2;
     $59 = $55 | $58;
     $60 = $56 >>> $58;
     $61 = $60 >>> 1;
     $62 = $61 & 1;
     $63 = $59 | $62;
     $64 = $60 >>> $62;
     $65 = (($63) + ($64))|0;
     $66 = $65 << 1;
     $67 = (39840 + ($66<<2)|0);
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ($67|0)==($71|0);
     do {
      if ($72) {
       $73 = 1 << $65;
       $74 = $73 ^ -1;
       $75 = $6 & $74;
       HEAP32[9950] = $75;
       $90 = $35;
      } else {
       $76 = HEAP32[(39816)>>2]|0;
       $77 = ($71>>>0)<($76>>>0);
       if ($77) {
        _abort();
        // unreachable;
       }
       $78 = ((($71)) + 12|0);
       $79 = HEAP32[$78>>2]|0;
       $80 = ($79|0)==($69|0);
       if ($80) {
        HEAP32[$78>>2] = $67;
        HEAP32[$68>>2] = $71;
        $$pre = HEAP32[(39808)>>2]|0;
        $90 = $$pre;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $81 = $65 << 3;
     $82 = (($81) - ($4))|0;
     $83 = $4 | 3;
     $84 = ((($69)) + 4|0);
     HEAP32[$84>>2] = $83;
     $85 = (($69) + ($4)|0);
     $86 = $82 | 1;
     $87 = ((($85)) + 4|0);
     HEAP32[$87>>2] = $86;
     $88 = (($85) + ($82)|0);
     HEAP32[$88>>2] = $82;
     $89 = ($90|0)==(0);
     if (!($89)) {
      $91 = HEAP32[(39820)>>2]|0;
      $92 = $90 >>> 3;
      $93 = $92 << 1;
      $94 = (39840 + ($93<<2)|0);
      $95 = HEAP32[9950]|0;
      $96 = 1 << $92;
      $97 = $95 & $96;
      $98 = ($97|0)==(0);
      if ($98) {
       $99 = $95 | $96;
       HEAP32[9950] = $99;
       $$pre71 = ((($94)) + 8|0);
       $$pre$phiZ2D = $$pre71;$F4$0 = $94;
      } else {
       $100 = ((($94)) + 8|0);
       $101 = HEAP32[$100>>2]|0;
       $102 = HEAP32[(39816)>>2]|0;
       $103 = ($101>>>0)<($102>>>0);
       if ($103) {
        _abort();
        // unreachable;
       } else {
        $$pre$phiZ2D = $100;$F4$0 = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $91;
      $104 = ((($F4$0)) + 12|0);
      HEAP32[$104>>2] = $91;
      $105 = ((($91)) + 8|0);
      HEAP32[$105>>2] = $F4$0;
      $106 = ((($91)) + 12|0);
      HEAP32[$106>>2] = $94;
     }
     HEAP32[(39808)>>2] = $82;
     HEAP32[(39820)>>2] = $85;
     $$0 = $70;
     STACKTOP = sp;return ($$0|0);
    }
    $107 = HEAP32[(39804)>>2]|0;
    $108 = ($107|0)==(0);
    if ($108) {
     $nb$0 = $4;
    } else {
     $109 = (0 - ($107))|0;
     $110 = $107 & $109;
     $111 = (($110) + -1)|0;
     $112 = $111 >>> 12;
     $113 = $112 & 16;
     $114 = $111 >>> $113;
     $115 = $114 >>> 5;
     $116 = $115 & 8;
     $117 = $116 | $113;
     $118 = $114 >>> $116;
     $119 = $118 >>> 2;
     $120 = $119 & 4;
     $121 = $117 | $120;
     $122 = $118 >>> $120;
     $123 = $122 >>> 1;
     $124 = $123 & 2;
     $125 = $121 | $124;
     $126 = $122 >>> $124;
     $127 = $126 >>> 1;
     $128 = $127 & 1;
     $129 = $125 | $128;
     $130 = $126 >>> $128;
     $131 = (($129) + ($130))|0;
     $132 = (40104 + ($131<<2)|0);
     $133 = HEAP32[$132>>2]|0;
     $134 = ((($133)) + 4|0);
     $135 = HEAP32[$134>>2]|0;
     $136 = $135 & -8;
     $137 = (($136) - ($4))|0;
     $rsize$0$i = $137;$t$0$i = $133;$v$0$i = $133;
     while(1) {
      $138 = ((($t$0$i)) + 16|0);
      $139 = HEAP32[$138>>2]|0;
      $140 = ($139|0)==(0|0);
      if ($140) {
       $141 = ((($t$0$i)) + 20|0);
       $142 = HEAP32[$141>>2]|0;
       $143 = ($142|0)==(0|0);
       if ($143) {
        $rsize$0$i$lcssa = $rsize$0$i;$v$0$i$lcssa = $v$0$i;
        break;
       } else {
        $145 = $142;
       }
      } else {
       $145 = $139;
      }
      $144 = ((($145)) + 4|0);
      $146 = HEAP32[$144>>2]|0;
      $147 = $146 & -8;
      $148 = (($147) - ($4))|0;
      $149 = ($148>>>0)<($rsize$0$i>>>0);
      $$rsize$0$i = $149 ? $148 : $rsize$0$i;
      $$v$0$i = $149 ? $145 : $v$0$i;
      $rsize$0$i = $$rsize$0$i;$t$0$i = $145;$v$0$i = $$v$0$i;
     }
     $150 = HEAP32[(39816)>>2]|0;
     $151 = ($v$0$i$lcssa>>>0)<($150>>>0);
     if ($151) {
      _abort();
      // unreachable;
     }
     $152 = (($v$0$i$lcssa) + ($4)|0);
     $153 = ($v$0$i$lcssa>>>0)<($152>>>0);
     if (!($153)) {
      _abort();
      // unreachable;
     }
     $154 = ((($v$0$i$lcssa)) + 24|0);
     $155 = HEAP32[$154>>2]|0;
     $156 = ((($v$0$i$lcssa)) + 12|0);
     $157 = HEAP32[$156>>2]|0;
     $158 = ($157|0)==($v$0$i$lcssa|0);
     do {
      if ($158) {
       $168 = ((($v$0$i$lcssa)) + 20|0);
       $169 = HEAP32[$168>>2]|0;
       $170 = ($169|0)==(0|0);
       if ($170) {
        $171 = ((($v$0$i$lcssa)) + 16|0);
        $172 = HEAP32[$171>>2]|0;
        $173 = ($172|0)==(0|0);
        if ($173) {
         $R$3$i = 0;
         break;
        } else {
         $R$1$i = $172;$RP$1$i = $171;
        }
       } else {
        $R$1$i = $169;$RP$1$i = $168;
       }
       while(1) {
        $174 = ((($R$1$i)) + 20|0);
        $175 = HEAP32[$174>>2]|0;
        $176 = ($175|0)==(0|0);
        if (!($176)) {
         $R$1$i = $175;$RP$1$i = $174;
         continue;
        }
        $177 = ((($R$1$i)) + 16|0);
        $178 = HEAP32[$177>>2]|0;
        $179 = ($178|0)==(0|0);
        if ($179) {
         $R$1$i$lcssa = $R$1$i;$RP$1$i$lcssa = $RP$1$i;
         break;
        } else {
         $R$1$i = $178;$RP$1$i = $177;
        }
       }
       $180 = ($RP$1$i$lcssa>>>0)<($150>>>0);
       if ($180) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$RP$1$i$lcssa>>2] = 0;
        $R$3$i = $R$1$i$lcssa;
        break;
       }
      } else {
       $159 = ((($v$0$i$lcssa)) + 8|0);
       $160 = HEAP32[$159>>2]|0;
       $161 = ($160>>>0)<($150>>>0);
       if ($161) {
        _abort();
        // unreachable;
       }
       $162 = ((($160)) + 12|0);
       $163 = HEAP32[$162>>2]|0;
       $164 = ($163|0)==($v$0$i$lcssa|0);
       if (!($164)) {
        _abort();
        // unreachable;
       }
       $165 = ((($157)) + 8|0);
       $166 = HEAP32[$165>>2]|0;
       $167 = ($166|0)==($v$0$i$lcssa|0);
       if ($167) {
        HEAP32[$162>>2] = $157;
        HEAP32[$165>>2] = $160;
        $R$3$i = $157;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $181 = ($155|0)==(0|0);
     do {
      if (!($181)) {
       $182 = ((($v$0$i$lcssa)) + 28|0);
       $183 = HEAP32[$182>>2]|0;
       $184 = (40104 + ($183<<2)|0);
       $185 = HEAP32[$184>>2]|0;
       $186 = ($v$0$i$lcssa|0)==($185|0);
       if ($186) {
        HEAP32[$184>>2] = $R$3$i;
        $cond$i = ($R$3$i|0)==(0|0);
        if ($cond$i) {
         $187 = 1 << $183;
         $188 = $187 ^ -1;
         $189 = HEAP32[(39804)>>2]|0;
         $190 = $189 & $188;
         HEAP32[(39804)>>2] = $190;
         break;
        }
       } else {
        $191 = HEAP32[(39816)>>2]|0;
        $192 = ($155>>>0)<($191>>>0);
        if ($192) {
         _abort();
         // unreachable;
        }
        $193 = ((($155)) + 16|0);
        $194 = HEAP32[$193>>2]|0;
        $195 = ($194|0)==($v$0$i$lcssa|0);
        if ($195) {
         HEAP32[$193>>2] = $R$3$i;
        } else {
         $196 = ((($155)) + 20|0);
         HEAP32[$196>>2] = $R$3$i;
        }
        $197 = ($R$3$i|0)==(0|0);
        if ($197) {
         break;
        }
       }
       $198 = HEAP32[(39816)>>2]|0;
       $199 = ($R$3$i>>>0)<($198>>>0);
       if ($199) {
        _abort();
        // unreachable;
       }
       $200 = ((($R$3$i)) + 24|0);
       HEAP32[$200>>2] = $155;
       $201 = ((($v$0$i$lcssa)) + 16|0);
       $202 = HEAP32[$201>>2]|0;
       $203 = ($202|0)==(0|0);
       do {
        if (!($203)) {
         $204 = ($202>>>0)<($198>>>0);
         if ($204) {
          _abort();
          // unreachable;
         } else {
          $205 = ((($R$3$i)) + 16|0);
          HEAP32[$205>>2] = $202;
          $206 = ((($202)) + 24|0);
          HEAP32[$206>>2] = $R$3$i;
          break;
         }
        }
       } while(0);
       $207 = ((($v$0$i$lcssa)) + 20|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       if (!($209)) {
        $210 = HEAP32[(39816)>>2]|0;
        $211 = ($208>>>0)<($210>>>0);
        if ($211) {
         _abort();
         // unreachable;
        } else {
         $212 = ((($R$3$i)) + 20|0);
         HEAP32[$212>>2] = $208;
         $213 = ((($208)) + 24|0);
         HEAP32[$213>>2] = $R$3$i;
         break;
        }
       }
      }
     } while(0);
     $214 = ($rsize$0$i$lcssa>>>0)<(16);
     if ($214) {
      $215 = (($rsize$0$i$lcssa) + ($4))|0;
      $216 = $215 | 3;
      $217 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$217>>2] = $216;
      $218 = (($v$0$i$lcssa) + ($215)|0);
      $219 = ((($218)) + 4|0);
      $220 = HEAP32[$219>>2]|0;
      $221 = $220 | 1;
      HEAP32[$219>>2] = $221;
     } else {
      $222 = $4 | 3;
      $223 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$223>>2] = $222;
      $224 = $rsize$0$i$lcssa | 1;
      $225 = ((($152)) + 4|0);
      HEAP32[$225>>2] = $224;
      $226 = (($152) + ($rsize$0$i$lcssa)|0);
      HEAP32[$226>>2] = $rsize$0$i$lcssa;
      $227 = HEAP32[(39808)>>2]|0;
      $228 = ($227|0)==(0);
      if (!($228)) {
       $229 = HEAP32[(39820)>>2]|0;
       $230 = $227 >>> 3;
       $231 = $230 << 1;
       $232 = (39840 + ($231<<2)|0);
       $233 = HEAP32[9950]|0;
       $234 = 1 << $230;
       $235 = $233 & $234;
       $236 = ($235|0)==(0);
       if ($236) {
        $237 = $233 | $234;
        HEAP32[9950] = $237;
        $$pre$i = ((($232)) + 8|0);
        $$pre$phi$iZ2D = $$pre$i;$F1$0$i = $232;
       } else {
        $238 = ((($232)) + 8|0);
        $239 = HEAP32[$238>>2]|0;
        $240 = HEAP32[(39816)>>2]|0;
        $241 = ($239>>>0)<($240>>>0);
        if ($241) {
         _abort();
         // unreachable;
        } else {
         $$pre$phi$iZ2D = $238;$F1$0$i = $239;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $229;
       $242 = ((($F1$0$i)) + 12|0);
       HEAP32[$242>>2] = $229;
       $243 = ((($229)) + 8|0);
       HEAP32[$243>>2] = $F1$0$i;
       $244 = ((($229)) + 12|0);
       HEAP32[$244>>2] = $232;
      }
      HEAP32[(39808)>>2] = $rsize$0$i$lcssa;
      HEAP32[(39820)>>2] = $152;
     }
     $245 = ((($v$0$i$lcssa)) + 8|0);
     $$0 = $245;
     STACKTOP = sp;return ($$0|0);
    }
   } else {
    $nb$0 = $4;
   }
  } else {
   $246 = ($bytes>>>0)>(4294967231);
   if ($246) {
    $nb$0 = -1;
   } else {
    $247 = (($bytes) + 11)|0;
    $248 = $247 & -8;
    $249 = HEAP32[(39804)>>2]|0;
    $250 = ($249|0)==(0);
    if ($250) {
     $nb$0 = $248;
    } else {
     $251 = (0 - ($248))|0;
     $252 = $247 >>> 8;
     $253 = ($252|0)==(0);
     if ($253) {
      $idx$0$i = 0;
     } else {
      $254 = ($248>>>0)>(16777215);
      if ($254) {
       $idx$0$i = 31;
      } else {
       $255 = (($252) + 1048320)|0;
       $256 = $255 >>> 16;
       $257 = $256 & 8;
       $258 = $252 << $257;
       $259 = (($258) + 520192)|0;
       $260 = $259 >>> 16;
       $261 = $260 & 4;
       $262 = $261 | $257;
       $263 = $258 << $261;
       $264 = (($263) + 245760)|0;
       $265 = $264 >>> 16;
       $266 = $265 & 2;
       $267 = $262 | $266;
       $268 = (14 - ($267))|0;
       $269 = $263 << $266;
       $270 = $269 >>> 15;
       $271 = (($268) + ($270))|0;
       $272 = $271 << 1;
       $273 = (($271) + 7)|0;
       $274 = $248 >>> $273;
       $275 = $274 & 1;
       $276 = $275 | $272;
       $idx$0$i = $276;
      }
     }
     $277 = (40104 + ($idx$0$i<<2)|0);
     $278 = HEAP32[$277>>2]|0;
     $279 = ($278|0)==(0|0);
     L123: do {
      if ($279) {
       $rsize$3$i = $251;$t$2$i = 0;$v$3$i = 0;
       label = 86;
      } else {
       $280 = ($idx$0$i|0)==(31);
       $281 = $idx$0$i >>> 1;
       $282 = (25 - ($281))|0;
       $283 = $280 ? 0 : $282;
       $284 = $248 << $283;
       $rsize$0$i5 = $251;$rst$0$i = 0;$sizebits$0$i = $284;$t$0$i4 = $278;$v$0$i6 = 0;
       while(1) {
        $285 = ((($t$0$i4)) + 4|0);
        $286 = HEAP32[$285>>2]|0;
        $287 = $286 & -8;
        $288 = (($287) - ($248))|0;
        $289 = ($288>>>0)<($rsize$0$i5>>>0);
        if ($289) {
         $290 = ($287|0)==($248|0);
         if ($290) {
          $rsize$412$i = $288;$t$411$i = $t$0$i4;$v$413$i = $t$0$i4;
          label = 90;
          break L123;
         } else {
          $rsize$1$i = $288;$v$1$i = $t$0$i4;
         }
        } else {
         $rsize$1$i = $rsize$0$i5;$v$1$i = $v$0$i6;
        }
        $291 = ((($t$0$i4)) + 20|0);
        $292 = HEAP32[$291>>2]|0;
        $293 = $sizebits$0$i >>> 31;
        $294 = (((($t$0$i4)) + 16|0) + ($293<<2)|0);
        $295 = HEAP32[$294>>2]|0;
        $296 = ($292|0)==(0|0);
        $297 = ($292|0)==($295|0);
        $or$cond1$i = $296 | $297;
        $rst$1$i = $or$cond1$i ? $rst$0$i : $292;
        $298 = ($295|0)==(0|0);
        $299 = $298&1;
        $300 = $299 ^ 1;
        $sizebits$0$$i = $sizebits$0$i << $300;
        if ($298) {
         $rsize$3$i = $rsize$1$i;$t$2$i = $rst$1$i;$v$3$i = $v$1$i;
         label = 86;
         break;
        } else {
         $rsize$0$i5 = $rsize$1$i;$rst$0$i = $rst$1$i;$sizebits$0$i = $sizebits$0$$i;$t$0$i4 = $295;$v$0$i6 = $v$1$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 86) {
      $301 = ($t$2$i|0)==(0|0);
      $302 = ($v$3$i|0)==(0|0);
      $or$cond$i = $301 & $302;
      if ($or$cond$i) {
       $303 = 2 << $idx$0$i;
       $304 = (0 - ($303))|0;
       $305 = $303 | $304;
       $306 = $249 & $305;
       $307 = ($306|0)==(0);
       if ($307) {
        $nb$0 = $248;
        break;
       }
       $308 = (0 - ($306))|0;
       $309 = $306 & $308;
       $310 = (($309) + -1)|0;
       $311 = $310 >>> 12;
       $312 = $311 & 16;
       $313 = $310 >>> $312;
       $314 = $313 >>> 5;
       $315 = $314 & 8;
       $316 = $315 | $312;
       $317 = $313 >>> $315;
       $318 = $317 >>> 2;
       $319 = $318 & 4;
       $320 = $316 | $319;
       $321 = $317 >>> $319;
       $322 = $321 >>> 1;
       $323 = $322 & 2;
       $324 = $320 | $323;
       $325 = $321 >>> $323;
       $326 = $325 >>> 1;
       $327 = $326 & 1;
       $328 = $324 | $327;
       $329 = $325 >>> $327;
       $330 = (($328) + ($329))|0;
       $331 = (40104 + ($330<<2)|0);
       $332 = HEAP32[$331>>2]|0;
       $t$4$ph$i = $332;
      } else {
       $t$4$ph$i = $t$2$i;
      }
      $333 = ($t$4$ph$i|0)==(0|0);
      if ($333) {
       $rsize$4$lcssa$i = $rsize$3$i;$v$4$lcssa$i = $v$3$i;
      } else {
       $rsize$412$i = $rsize$3$i;$t$411$i = $t$4$ph$i;$v$413$i = $v$3$i;
       label = 90;
      }
     }
     if ((label|0) == 90) {
      while(1) {
       label = 0;
       $334 = ((($t$411$i)) + 4|0);
       $335 = HEAP32[$334>>2]|0;
       $336 = $335 & -8;
       $337 = (($336) - ($248))|0;
       $338 = ($337>>>0)<($rsize$412$i>>>0);
       $$rsize$4$i = $338 ? $337 : $rsize$412$i;
       $t$4$v$4$i = $338 ? $t$411$i : $v$413$i;
       $339 = ((($t$411$i)) + 16|0);
       $340 = HEAP32[$339>>2]|0;
       $341 = ($340|0)==(0|0);
       if (!($341)) {
        $rsize$412$i = $$rsize$4$i;$t$411$i = $340;$v$413$i = $t$4$v$4$i;
        label = 90;
        continue;
       }
       $342 = ((($t$411$i)) + 20|0);
       $343 = HEAP32[$342>>2]|0;
       $344 = ($343|0)==(0|0);
       if ($344) {
        $rsize$4$lcssa$i = $$rsize$4$i;$v$4$lcssa$i = $t$4$v$4$i;
        break;
       } else {
        $rsize$412$i = $$rsize$4$i;$t$411$i = $343;$v$413$i = $t$4$v$4$i;
        label = 90;
       }
      }
     }
     $345 = ($v$4$lcssa$i|0)==(0|0);
     if ($345) {
      $nb$0 = $248;
     } else {
      $346 = HEAP32[(39808)>>2]|0;
      $347 = (($346) - ($248))|0;
      $348 = ($rsize$4$lcssa$i>>>0)<($347>>>0);
      if ($348) {
       $349 = HEAP32[(39816)>>2]|0;
       $350 = ($v$4$lcssa$i>>>0)<($349>>>0);
       if ($350) {
        _abort();
        // unreachable;
       }
       $351 = (($v$4$lcssa$i) + ($248)|0);
       $352 = ($v$4$lcssa$i>>>0)<($351>>>0);
       if (!($352)) {
        _abort();
        // unreachable;
       }
       $353 = ((($v$4$lcssa$i)) + 24|0);
       $354 = HEAP32[$353>>2]|0;
       $355 = ((($v$4$lcssa$i)) + 12|0);
       $356 = HEAP32[$355>>2]|0;
       $357 = ($356|0)==($v$4$lcssa$i|0);
       do {
        if ($357) {
         $367 = ((($v$4$lcssa$i)) + 20|0);
         $368 = HEAP32[$367>>2]|0;
         $369 = ($368|0)==(0|0);
         if ($369) {
          $370 = ((($v$4$lcssa$i)) + 16|0);
          $371 = HEAP32[$370>>2]|0;
          $372 = ($371|0)==(0|0);
          if ($372) {
           $R$3$i11 = 0;
           break;
          } else {
           $R$1$i9 = $371;$RP$1$i8 = $370;
          }
         } else {
          $R$1$i9 = $368;$RP$1$i8 = $367;
         }
         while(1) {
          $373 = ((($R$1$i9)) + 20|0);
          $374 = HEAP32[$373>>2]|0;
          $375 = ($374|0)==(0|0);
          if (!($375)) {
           $R$1$i9 = $374;$RP$1$i8 = $373;
           continue;
          }
          $376 = ((($R$1$i9)) + 16|0);
          $377 = HEAP32[$376>>2]|0;
          $378 = ($377|0)==(0|0);
          if ($378) {
           $R$1$i9$lcssa = $R$1$i9;$RP$1$i8$lcssa = $RP$1$i8;
           break;
          } else {
           $R$1$i9 = $377;$RP$1$i8 = $376;
          }
         }
         $379 = ($RP$1$i8$lcssa>>>0)<($349>>>0);
         if ($379) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$RP$1$i8$lcssa>>2] = 0;
          $R$3$i11 = $R$1$i9$lcssa;
          break;
         }
        } else {
         $358 = ((($v$4$lcssa$i)) + 8|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359>>>0)<($349>>>0);
         if ($360) {
          _abort();
          // unreachable;
         }
         $361 = ((($359)) + 12|0);
         $362 = HEAP32[$361>>2]|0;
         $363 = ($362|0)==($v$4$lcssa$i|0);
         if (!($363)) {
          _abort();
          // unreachable;
         }
         $364 = ((($356)) + 8|0);
         $365 = HEAP32[$364>>2]|0;
         $366 = ($365|0)==($v$4$lcssa$i|0);
         if ($366) {
          HEAP32[$361>>2] = $356;
          HEAP32[$364>>2] = $359;
          $R$3$i11 = $356;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $380 = ($354|0)==(0|0);
       do {
        if (!($380)) {
         $381 = ((($v$4$lcssa$i)) + 28|0);
         $382 = HEAP32[$381>>2]|0;
         $383 = (40104 + ($382<<2)|0);
         $384 = HEAP32[$383>>2]|0;
         $385 = ($v$4$lcssa$i|0)==($384|0);
         if ($385) {
          HEAP32[$383>>2] = $R$3$i11;
          $cond$i12 = ($R$3$i11|0)==(0|0);
          if ($cond$i12) {
           $386 = 1 << $382;
           $387 = $386 ^ -1;
           $388 = HEAP32[(39804)>>2]|0;
           $389 = $388 & $387;
           HEAP32[(39804)>>2] = $389;
           break;
          }
         } else {
          $390 = HEAP32[(39816)>>2]|0;
          $391 = ($354>>>0)<($390>>>0);
          if ($391) {
           _abort();
           // unreachable;
          }
          $392 = ((($354)) + 16|0);
          $393 = HEAP32[$392>>2]|0;
          $394 = ($393|0)==($v$4$lcssa$i|0);
          if ($394) {
           HEAP32[$392>>2] = $R$3$i11;
          } else {
           $395 = ((($354)) + 20|0);
           HEAP32[$395>>2] = $R$3$i11;
          }
          $396 = ($R$3$i11|0)==(0|0);
          if ($396) {
           break;
          }
         }
         $397 = HEAP32[(39816)>>2]|0;
         $398 = ($R$3$i11>>>0)<($397>>>0);
         if ($398) {
          _abort();
          // unreachable;
         }
         $399 = ((($R$3$i11)) + 24|0);
         HEAP32[$399>>2] = $354;
         $400 = ((($v$4$lcssa$i)) + 16|0);
         $401 = HEAP32[$400>>2]|0;
         $402 = ($401|0)==(0|0);
         do {
          if (!($402)) {
           $403 = ($401>>>0)<($397>>>0);
           if ($403) {
            _abort();
            // unreachable;
           } else {
            $404 = ((($R$3$i11)) + 16|0);
            HEAP32[$404>>2] = $401;
            $405 = ((($401)) + 24|0);
            HEAP32[$405>>2] = $R$3$i11;
            break;
           }
          }
         } while(0);
         $406 = ((($v$4$lcssa$i)) + 20|0);
         $407 = HEAP32[$406>>2]|0;
         $408 = ($407|0)==(0|0);
         if (!($408)) {
          $409 = HEAP32[(39816)>>2]|0;
          $410 = ($407>>>0)<($409>>>0);
          if ($410) {
           _abort();
           // unreachable;
          } else {
           $411 = ((($R$3$i11)) + 20|0);
           HEAP32[$411>>2] = $407;
           $412 = ((($407)) + 24|0);
           HEAP32[$412>>2] = $R$3$i11;
           break;
          }
         }
        }
       } while(0);
       $413 = ($rsize$4$lcssa$i>>>0)<(16);
       do {
        if ($413) {
         $414 = (($rsize$4$lcssa$i) + ($248))|0;
         $415 = $414 | 3;
         $416 = ((($v$4$lcssa$i)) + 4|0);
         HEAP32[$416>>2] = $415;
         $417 = (($v$4$lcssa$i) + ($414)|0);
         $418 = ((($417)) + 4|0);
         $419 = HEAP32[$418>>2]|0;
         $420 = $419 | 1;
         HEAP32[$418>>2] = $420;
        } else {
         $421 = $248 | 3;
         $422 = ((($v$4$lcssa$i)) + 4|0);
         HEAP32[$422>>2] = $421;
         $423 = $rsize$4$lcssa$i | 1;
         $424 = ((($351)) + 4|0);
         HEAP32[$424>>2] = $423;
         $425 = (($351) + ($rsize$4$lcssa$i)|0);
         HEAP32[$425>>2] = $rsize$4$lcssa$i;
         $426 = $rsize$4$lcssa$i >>> 3;
         $427 = ($rsize$4$lcssa$i>>>0)<(256);
         if ($427) {
          $428 = $426 << 1;
          $429 = (39840 + ($428<<2)|0);
          $430 = HEAP32[9950]|0;
          $431 = 1 << $426;
          $432 = $430 & $431;
          $433 = ($432|0)==(0);
          if ($433) {
           $434 = $430 | $431;
           HEAP32[9950] = $434;
           $$pre$i13 = ((($429)) + 8|0);
           $$pre$phi$i14Z2D = $$pre$i13;$F5$0$i = $429;
          } else {
           $435 = ((($429)) + 8|0);
           $436 = HEAP32[$435>>2]|0;
           $437 = HEAP32[(39816)>>2]|0;
           $438 = ($436>>>0)<($437>>>0);
           if ($438) {
            _abort();
            // unreachable;
           } else {
            $$pre$phi$i14Z2D = $435;$F5$0$i = $436;
           }
          }
          HEAP32[$$pre$phi$i14Z2D>>2] = $351;
          $439 = ((($F5$0$i)) + 12|0);
          HEAP32[$439>>2] = $351;
          $440 = ((($351)) + 8|0);
          HEAP32[$440>>2] = $F5$0$i;
          $441 = ((($351)) + 12|0);
          HEAP32[$441>>2] = $429;
          break;
         }
         $442 = $rsize$4$lcssa$i >>> 8;
         $443 = ($442|0)==(0);
         if ($443) {
          $I7$0$i = 0;
         } else {
          $444 = ($rsize$4$lcssa$i>>>0)>(16777215);
          if ($444) {
           $I7$0$i = 31;
          } else {
           $445 = (($442) + 1048320)|0;
           $446 = $445 >>> 16;
           $447 = $446 & 8;
           $448 = $442 << $447;
           $449 = (($448) + 520192)|0;
           $450 = $449 >>> 16;
           $451 = $450 & 4;
           $452 = $451 | $447;
           $453 = $448 << $451;
           $454 = (($453) + 245760)|0;
           $455 = $454 >>> 16;
           $456 = $455 & 2;
           $457 = $452 | $456;
           $458 = (14 - ($457))|0;
           $459 = $453 << $456;
           $460 = $459 >>> 15;
           $461 = (($458) + ($460))|0;
           $462 = $461 << 1;
           $463 = (($461) + 7)|0;
           $464 = $rsize$4$lcssa$i >>> $463;
           $465 = $464 & 1;
           $466 = $465 | $462;
           $I7$0$i = $466;
          }
         }
         $467 = (40104 + ($I7$0$i<<2)|0);
         $468 = ((($351)) + 28|0);
         HEAP32[$468>>2] = $I7$0$i;
         $469 = ((($351)) + 16|0);
         $470 = ((($469)) + 4|0);
         HEAP32[$470>>2] = 0;
         HEAP32[$469>>2] = 0;
         $471 = HEAP32[(39804)>>2]|0;
         $472 = 1 << $I7$0$i;
         $473 = $471 & $472;
         $474 = ($473|0)==(0);
         if ($474) {
          $475 = $471 | $472;
          HEAP32[(39804)>>2] = $475;
          HEAP32[$467>>2] = $351;
          $476 = ((($351)) + 24|0);
          HEAP32[$476>>2] = $467;
          $477 = ((($351)) + 12|0);
          HEAP32[$477>>2] = $351;
          $478 = ((($351)) + 8|0);
          HEAP32[$478>>2] = $351;
          break;
         }
         $479 = HEAP32[$467>>2]|0;
         $480 = ($I7$0$i|0)==(31);
         $481 = $I7$0$i >>> 1;
         $482 = (25 - ($481))|0;
         $483 = $480 ? 0 : $482;
         $484 = $rsize$4$lcssa$i << $483;
         $K12$0$i = $484;$T$0$i = $479;
         while(1) {
          $485 = ((($T$0$i)) + 4|0);
          $486 = HEAP32[$485>>2]|0;
          $487 = $486 & -8;
          $488 = ($487|0)==($rsize$4$lcssa$i|0);
          if ($488) {
           $T$0$i$lcssa = $T$0$i;
           label = 148;
           break;
          }
          $489 = $K12$0$i >>> 31;
          $490 = (((($T$0$i)) + 16|0) + ($489<<2)|0);
          $491 = $K12$0$i << 1;
          $492 = HEAP32[$490>>2]|0;
          $493 = ($492|0)==(0|0);
          if ($493) {
           $$lcssa157 = $490;$T$0$i$lcssa156 = $T$0$i;
           label = 145;
           break;
          } else {
           $K12$0$i = $491;$T$0$i = $492;
          }
         }
         if ((label|0) == 145) {
          $494 = HEAP32[(39816)>>2]|0;
          $495 = ($$lcssa157>>>0)<($494>>>0);
          if ($495) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$$lcssa157>>2] = $351;
           $496 = ((($351)) + 24|0);
           HEAP32[$496>>2] = $T$0$i$lcssa156;
           $497 = ((($351)) + 12|0);
           HEAP32[$497>>2] = $351;
           $498 = ((($351)) + 8|0);
           HEAP32[$498>>2] = $351;
           break;
          }
         }
         else if ((label|0) == 148) {
          $499 = ((($T$0$i$lcssa)) + 8|0);
          $500 = HEAP32[$499>>2]|0;
          $501 = HEAP32[(39816)>>2]|0;
          $502 = ($500>>>0)>=($501>>>0);
          $not$7$i = ($T$0$i$lcssa>>>0)>=($501>>>0);
          $503 = $502 & $not$7$i;
          if ($503) {
           $504 = ((($500)) + 12|0);
           HEAP32[$504>>2] = $351;
           HEAP32[$499>>2] = $351;
           $505 = ((($351)) + 8|0);
           HEAP32[$505>>2] = $500;
           $506 = ((($351)) + 12|0);
           HEAP32[$506>>2] = $T$0$i$lcssa;
           $507 = ((($351)) + 24|0);
           HEAP32[$507>>2] = 0;
           break;
          } else {
           _abort();
           // unreachable;
          }
         }
        }
       } while(0);
       $508 = ((($v$4$lcssa$i)) + 8|0);
       $$0 = $508;
       STACKTOP = sp;return ($$0|0);
      } else {
       $nb$0 = $248;
      }
     }
    }
   }
  }
 } while(0);
 $509 = HEAP32[(39808)>>2]|0;
 $510 = ($509>>>0)<($nb$0>>>0);
 if (!($510)) {
  $511 = (($509) - ($nb$0))|0;
  $512 = HEAP32[(39820)>>2]|0;
  $513 = ($511>>>0)>(15);
  if ($513) {
   $514 = (($512) + ($nb$0)|0);
   HEAP32[(39820)>>2] = $514;
   HEAP32[(39808)>>2] = $511;
   $515 = $511 | 1;
   $516 = ((($514)) + 4|0);
   HEAP32[$516>>2] = $515;
   $517 = (($514) + ($511)|0);
   HEAP32[$517>>2] = $511;
   $518 = $nb$0 | 3;
   $519 = ((($512)) + 4|0);
   HEAP32[$519>>2] = $518;
  } else {
   HEAP32[(39808)>>2] = 0;
   HEAP32[(39820)>>2] = 0;
   $520 = $509 | 3;
   $521 = ((($512)) + 4|0);
   HEAP32[$521>>2] = $520;
   $522 = (($512) + ($509)|0);
   $523 = ((($522)) + 4|0);
   $524 = HEAP32[$523>>2]|0;
   $525 = $524 | 1;
   HEAP32[$523>>2] = $525;
  }
  $526 = ((($512)) + 8|0);
  $$0 = $526;
  STACKTOP = sp;return ($$0|0);
 }
 $527 = HEAP32[(39812)>>2]|0;
 $528 = ($527>>>0)>($nb$0>>>0);
 if ($528) {
  $529 = (($527) - ($nb$0))|0;
  HEAP32[(39812)>>2] = $529;
  $530 = HEAP32[(39824)>>2]|0;
  $531 = (($530) + ($nb$0)|0);
  HEAP32[(39824)>>2] = $531;
  $532 = $529 | 1;
  $533 = ((($531)) + 4|0);
  HEAP32[$533>>2] = $532;
  $534 = $nb$0 | 3;
  $535 = ((($530)) + 4|0);
  HEAP32[$535>>2] = $534;
  $536 = ((($530)) + 8|0);
  $$0 = $536;
  STACKTOP = sp;return ($$0|0);
 }
 $537 = HEAP32[10068]|0;
 $538 = ($537|0)==(0);
 if ($538) {
  HEAP32[(40280)>>2] = 4096;
  HEAP32[(40276)>>2] = 4096;
  HEAP32[(40284)>>2] = -1;
  HEAP32[(40288)>>2] = -1;
  HEAP32[(40292)>>2] = 0;
  HEAP32[(40244)>>2] = 0;
  $539 = $magic$i$i;
  $540 = $539 & -16;
  $541 = $540 ^ 1431655768;
  HEAP32[$magic$i$i>>2] = $541;
  HEAP32[10068] = $541;
 }
 $542 = (($nb$0) + 48)|0;
 $543 = HEAP32[(40280)>>2]|0;
 $544 = (($nb$0) + 47)|0;
 $545 = (($543) + ($544))|0;
 $546 = (0 - ($543))|0;
 $547 = $545 & $546;
 $548 = ($547>>>0)>($nb$0>>>0);
 if (!($548)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $549 = HEAP32[(40240)>>2]|0;
 $550 = ($549|0)==(0);
 if (!($550)) {
  $551 = HEAP32[(40232)>>2]|0;
  $552 = (($551) + ($547))|0;
  $553 = ($552>>>0)<=($551>>>0);
  $554 = ($552>>>0)>($549>>>0);
  $or$cond1$i16 = $553 | $554;
  if ($or$cond1$i16) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $555 = HEAP32[(40244)>>2]|0;
 $556 = $555 & 4;
 $557 = ($556|0)==(0);
 L254: do {
  if ($557) {
   $558 = HEAP32[(39824)>>2]|0;
   $559 = ($558|0)==(0|0);
   L256: do {
    if ($559) {
     label = 171;
    } else {
     $sp$0$i$i = (40248);
     while(1) {
      $560 = HEAP32[$sp$0$i$i>>2]|0;
      $561 = ($560>>>0)>($558>>>0);
      if (!($561)) {
       $562 = ((($sp$0$i$i)) + 4|0);
       $563 = HEAP32[$562>>2]|0;
       $564 = (($560) + ($563)|0);
       $565 = ($564>>>0)>($558>>>0);
       if ($565) {
        $$lcssa153 = $sp$0$i$i;$$lcssa155 = $562;
        break;
       }
      }
      $566 = ((($sp$0$i$i)) + 8|0);
      $567 = HEAP32[$566>>2]|0;
      $568 = ($567|0)==(0|0);
      if ($568) {
       label = 171;
       break L256;
      } else {
       $sp$0$i$i = $567;
      }
     }
     $591 = HEAP32[(39812)>>2]|0;
     $592 = (($545) - ($591))|0;
     $593 = $592 & $546;
     $594 = ($593>>>0)<(2147483647);
     if ($594) {
      $595 = (_sbrk(($593|0))|0);
      $596 = HEAP32[$$lcssa153>>2]|0;
      $597 = HEAP32[$$lcssa155>>2]|0;
      $598 = (($596) + ($597)|0);
      $599 = ($595|0)==($598|0);
      if ($599) {
       $600 = ($595|0)==((-1)|0);
       if (!($600)) {
        $tbase$746$i = $595;$tsize$745$i = $593;
        label = 191;
        break L254;
       }
      } else {
       $br$2$ph$i = $595;$ssize$2$ph$i = $593;
       label = 181;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 171) {
     $569 = (_sbrk(0)|0);
     $570 = ($569|0)==((-1)|0);
     if (!($570)) {
      $571 = $569;
      $572 = HEAP32[(40276)>>2]|0;
      $573 = (($572) + -1)|0;
      $574 = $573 & $571;
      $575 = ($574|0)==(0);
      if ($575) {
       $ssize$0$i = $547;
      } else {
       $576 = (($573) + ($571))|0;
       $577 = (0 - ($572))|0;
       $578 = $576 & $577;
       $579 = (($547) - ($571))|0;
       $580 = (($579) + ($578))|0;
       $ssize$0$i = $580;
      }
      $581 = HEAP32[(40232)>>2]|0;
      $582 = (($581) + ($ssize$0$i))|0;
      $583 = ($ssize$0$i>>>0)>($nb$0>>>0);
      $584 = ($ssize$0$i>>>0)<(2147483647);
      $or$cond$i17 = $583 & $584;
      if ($or$cond$i17) {
       $585 = HEAP32[(40240)>>2]|0;
       $586 = ($585|0)==(0);
       if (!($586)) {
        $587 = ($582>>>0)<=($581>>>0);
        $588 = ($582>>>0)>($585>>>0);
        $or$cond2$i = $587 | $588;
        if ($or$cond2$i) {
         break;
        }
       }
       $589 = (_sbrk(($ssize$0$i|0))|0);
       $590 = ($589|0)==($569|0);
       if ($590) {
        $tbase$746$i = $569;$tsize$745$i = $ssize$0$i;
        label = 191;
        break L254;
       } else {
        $br$2$ph$i = $589;$ssize$2$ph$i = $ssize$0$i;
        label = 181;
       }
      }
     }
    }
   } while(0);
   L276: do {
    if ((label|0) == 181) {
     $601 = (0 - ($ssize$2$ph$i))|0;
     $602 = ($br$2$ph$i|0)!=((-1)|0);
     $603 = ($ssize$2$ph$i>>>0)<(2147483647);
     $or$cond7$i = $603 & $602;
     $604 = ($542>>>0)>($ssize$2$ph$i>>>0);
     $or$cond8$i = $604 & $or$cond7$i;
     do {
      if ($or$cond8$i) {
       $605 = HEAP32[(40280)>>2]|0;
       $606 = (($544) - ($ssize$2$ph$i))|0;
       $607 = (($606) + ($605))|0;
       $608 = (0 - ($605))|0;
       $609 = $607 & $608;
       $610 = ($609>>>0)<(2147483647);
       if ($610) {
        $611 = (_sbrk(($609|0))|0);
        $612 = ($611|0)==((-1)|0);
        if ($612) {
         (_sbrk(($601|0))|0);
         break L276;
        } else {
         $613 = (($609) + ($ssize$2$ph$i))|0;
         $ssize$5$i = $613;
         break;
        }
       } else {
        $ssize$5$i = $ssize$2$ph$i;
       }
      } else {
       $ssize$5$i = $ssize$2$ph$i;
      }
     } while(0);
     $614 = ($br$2$ph$i|0)==((-1)|0);
     if (!($614)) {
      $tbase$746$i = $br$2$ph$i;$tsize$745$i = $ssize$5$i;
      label = 191;
      break L254;
     }
    }
   } while(0);
   $615 = HEAP32[(40244)>>2]|0;
   $616 = $615 | 4;
   HEAP32[(40244)>>2] = $616;
   label = 188;
  } else {
   label = 188;
  }
 } while(0);
 if ((label|0) == 188) {
  $617 = ($547>>>0)<(2147483647);
  if ($617) {
   $618 = (_sbrk(($547|0))|0);
   $619 = (_sbrk(0)|0);
   $620 = ($618|0)!=((-1)|0);
   $621 = ($619|0)!=((-1)|0);
   $or$cond5$i = $620 & $621;
   $622 = ($618>>>0)<($619>>>0);
   $or$cond10$i = $622 & $or$cond5$i;
   if ($or$cond10$i) {
    $623 = $619;
    $624 = $618;
    $625 = (($623) - ($624))|0;
    $626 = (($nb$0) + 40)|0;
    $$not$i = ($625>>>0)>($626>>>0);
    if ($$not$i) {
     $tbase$746$i = $618;$tsize$745$i = $625;
     label = 191;
    }
   }
  }
 }
 if ((label|0) == 191) {
  $627 = HEAP32[(40232)>>2]|0;
  $628 = (($627) + ($tsize$745$i))|0;
  HEAP32[(40232)>>2] = $628;
  $629 = HEAP32[(40236)>>2]|0;
  $630 = ($628>>>0)>($629>>>0);
  if ($630) {
   HEAP32[(40236)>>2] = $628;
  }
  $631 = HEAP32[(39824)>>2]|0;
  $632 = ($631|0)==(0|0);
  do {
   if ($632) {
    $633 = HEAP32[(39816)>>2]|0;
    $634 = ($633|0)==(0|0);
    $635 = ($tbase$746$i>>>0)<($633>>>0);
    $or$cond11$i = $634 | $635;
    if ($or$cond11$i) {
     HEAP32[(39816)>>2] = $tbase$746$i;
    }
    HEAP32[(40248)>>2] = $tbase$746$i;
    HEAP32[(40252)>>2] = $tsize$745$i;
    HEAP32[(40260)>>2] = 0;
    $636 = HEAP32[10068]|0;
    HEAP32[(39836)>>2] = $636;
    HEAP32[(39832)>>2] = -1;
    $i$01$i$i = 0;
    while(1) {
     $637 = $i$01$i$i << 1;
     $638 = (39840 + ($637<<2)|0);
     $639 = ((($638)) + 12|0);
     HEAP32[$639>>2] = $638;
     $640 = ((($638)) + 8|0);
     HEAP32[$640>>2] = $638;
     $641 = (($i$01$i$i) + 1)|0;
     $exitcond$i$i = ($641|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $i$01$i$i = $641;
     }
    }
    $642 = (($tsize$745$i) + -40)|0;
    $643 = ((($tbase$746$i)) + 8|0);
    $644 = $643;
    $645 = $644 & 7;
    $646 = ($645|0)==(0);
    $647 = (0 - ($644))|0;
    $648 = $647 & 7;
    $649 = $646 ? 0 : $648;
    $650 = (($tbase$746$i) + ($649)|0);
    $651 = (($642) - ($649))|0;
    HEAP32[(39824)>>2] = $650;
    HEAP32[(39812)>>2] = $651;
    $652 = $651 | 1;
    $653 = ((($650)) + 4|0);
    HEAP32[$653>>2] = $652;
    $654 = (($650) + ($651)|0);
    $655 = ((($654)) + 4|0);
    HEAP32[$655>>2] = 40;
    $656 = HEAP32[(40288)>>2]|0;
    HEAP32[(39828)>>2] = $656;
   } else {
    $sp$068$i = (40248);
    while(1) {
     $657 = HEAP32[$sp$068$i>>2]|0;
     $658 = ((($sp$068$i)) + 4|0);
     $659 = HEAP32[$658>>2]|0;
     $660 = (($657) + ($659)|0);
     $661 = ($tbase$746$i|0)==($660|0);
     if ($661) {
      $$lcssa147 = $657;$$lcssa149 = $658;$$lcssa151 = $659;$sp$068$i$lcssa = $sp$068$i;
      label = 201;
      break;
     }
     $662 = ((($sp$068$i)) + 8|0);
     $663 = HEAP32[$662>>2]|0;
     $664 = ($663|0)==(0|0);
     if ($664) {
      break;
     } else {
      $sp$068$i = $663;
     }
    }
    if ((label|0) == 201) {
     $665 = ((($sp$068$i$lcssa)) + 12|0);
     $666 = HEAP32[$665>>2]|0;
     $667 = $666 & 8;
     $668 = ($667|0)==(0);
     if ($668) {
      $669 = ($631>>>0)>=($$lcssa147>>>0);
      $670 = ($631>>>0)<($tbase$746$i>>>0);
      $or$cond48$i = $670 & $669;
      if ($or$cond48$i) {
       $671 = (($$lcssa151) + ($tsize$745$i))|0;
       HEAP32[$$lcssa149>>2] = $671;
       $672 = HEAP32[(39812)>>2]|0;
       $673 = ((($631)) + 8|0);
       $674 = $673;
       $675 = $674 & 7;
       $676 = ($675|0)==(0);
       $677 = (0 - ($674))|0;
       $678 = $677 & 7;
       $679 = $676 ? 0 : $678;
       $680 = (($631) + ($679)|0);
       $681 = (($tsize$745$i) - ($679))|0;
       $682 = (($681) + ($672))|0;
       HEAP32[(39824)>>2] = $680;
       HEAP32[(39812)>>2] = $682;
       $683 = $682 | 1;
       $684 = ((($680)) + 4|0);
       HEAP32[$684>>2] = $683;
       $685 = (($680) + ($682)|0);
       $686 = ((($685)) + 4|0);
       HEAP32[$686>>2] = 40;
       $687 = HEAP32[(40288)>>2]|0;
       HEAP32[(39828)>>2] = $687;
       break;
      }
     }
    }
    $688 = HEAP32[(39816)>>2]|0;
    $689 = ($tbase$746$i>>>0)<($688>>>0);
    if ($689) {
     HEAP32[(39816)>>2] = $tbase$746$i;
     $753 = $tbase$746$i;
    } else {
     $753 = $688;
    }
    $690 = (($tbase$746$i) + ($tsize$745$i)|0);
    $sp$167$i = (40248);
    while(1) {
     $691 = HEAP32[$sp$167$i>>2]|0;
     $692 = ($691|0)==($690|0);
     if ($692) {
      $$lcssa144 = $sp$167$i;$sp$167$i$lcssa = $sp$167$i;
      label = 209;
      break;
     }
     $693 = ((($sp$167$i)) + 8|0);
     $694 = HEAP32[$693>>2]|0;
     $695 = ($694|0)==(0|0);
     if ($695) {
      $sp$0$i$i$i = (40248);
      break;
     } else {
      $sp$167$i = $694;
     }
    }
    if ((label|0) == 209) {
     $696 = ((($sp$167$i$lcssa)) + 12|0);
     $697 = HEAP32[$696>>2]|0;
     $698 = $697 & 8;
     $699 = ($698|0)==(0);
     if ($699) {
      HEAP32[$$lcssa144>>2] = $tbase$746$i;
      $700 = ((($sp$167$i$lcssa)) + 4|0);
      $701 = HEAP32[$700>>2]|0;
      $702 = (($701) + ($tsize$745$i))|0;
      HEAP32[$700>>2] = $702;
      $703 = ((($tbase$746$i)) + 8|0);
      $704 = $703;
      $705 = $704 & 7;
      $706 = ($705|0)==(0);
      $707 = (0 - ($704))|0;
      $708 = $707 & 7;
      $709 = $706 ? 0 : $708;
      $710 = (($tbase$746$i) + ($709)|0);
      $711 = ((($690)) + 8|0);
      $712 = $711;
      $713 = $712 & 7;
      $714 = ($713|0)==(0);
      $715 = (0 - ($712))|0;
      $716 = $715 & 7;
      $717 = $714 ? 0 : $716;
      $718 = (($690) + ($717)|0);
      $719 = $718;
      $720 = $710;
      $721 = (($719) - ($720))|0;
      $722 = (($710) + ($nb$0)|0);
      $723 = (($721) - ($nb$0))|0;
      $724 = $nb$0 | 3;
      $725 = ((($710)) + 4|0);
      HEAP32[$725>>2] = $724;
      $726 = ($718|0)==($631|0);
      do {
       if ($726) {
        $727 = HEAP32[(39812)>>2]|0;
        $728 = (($727) + ($723))|0;
        HEAP32[(39812)>>2] = $728;
        HEAP32[(39824)>>2] = $722;
        $729 = $728 | 1;
        $730 = ((($722)) + 4|0);
        HEAP32[$730>>2] = $729;
       } else {
        $731 = HEAP32[(39820)>>2]|0;
        $732 = ($718|0)==($731|0);
        if ($732) {
         $733 = HEAP32[(39808)>>2]|0;
         $734 = (($733) + ($723))|0;
         HEAP32[(39808)>>2] = $734;
         HEAP32[(39820)>>2] = $722;
         $735 = $734 | 1;
         $736 = ((($722)) + 4|0);
         HEAP32[$736>>2] = $735;
         $737 = (($722) + ($734)|0);
         HEAP32[$737>>2] = $734;
         break;
        }
        $738 = ((($718)) + 4|0);
        $739 = HEAP32[$738>>2]|0;
        $740 = $739 & 3;
        $741 = ($740|0)==(1);
        if ($741) {
         $742 = $739 & -8;
         $743 = $739 >>> 3;
         $744 = ($739>>>0)<(256);
         L328: do {
          if ($744) {
           $745 = ((($718)) + 8|0);
           $746 = HEAP32[$745>>2]|0;
           $747 = ((($718)) + 12|0);
           $748 = HEAP32[$747>>2]|0;
           $749 = $743 << 1;
           $750 = (39840 + ($749<<2)|0);
           $751 = ($746|0)==($750|0);
           do {
            if (!($751)) {
             $752 = ($746>>>0)<($753>>>0);
             if ($752) {
              _abort();
              // unreachable;
             }
             $754 = ((($746)) + 12|0);
             $755 = HEAP32[$754>>2]|0;
             $756 = ($755|0)==($718|0);
             if ($756) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $757 = ($748|0)==($746|0);
           if ($757) {
            $758 = 1 << $743;
            $759 = $758 ^ -1;
            $760 = HEAP32[9950]|0;
            $761 = $760 & $759;
            HEAP32[9950] = $761;
            break;
           }
           $762 = ($748|0)==($750|0);
           do {
            if ($762) {
             $$pre9$i$i = ((($748)) + 8|0);
             $$pre$phi10$i$iZ2D = $$pre9$i$i;
            } else {
             $763 = ($748>>>0)<($753>>>0);
             if ($763) {
              _abort();
              // unreachable;
             }
             $764 = ((($748)) + 8|0);
             $765 = HEAP32[$764>>2]|0;
             $766 = ($765|0)==($718|0);
             if ($766) {
              $$pre$phi10$i$iZ2D = $764;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $767 = ((($746)) + 12|0);
           HEAP32[$767>>2] = $748;
           HEAP32[$$pre$phi10$i$iZ2D>>2] = $746;
          } else {
           $768 = ((($718)) + 24|0);
           $769 = HEAP32[$768>>2]|0;
           $770 = ((($718)) + 12|0);
           $771 = HEAP32[$770>>2]|0;
           $772 = ($771|0)==($718|0);
           do {
            if ($772) {
             $782 = ((($718)) + 16|0);
             $783 = ((($782)) + 4|0);
             $784 = HEAP32[$783>>2]|0;
             $785 = ($784|0)==(0|0);
             if ($785) {
              $786 = HEAP32[$782>>2]|0;
              $787 = ($786|0)==(0|0);
              if ($787) {
               $R$3$i$i = 0;
               break;
              } else {
               $R$1$i$i = $786;$RP$1$i$i = $782;
              }
             } else {
              $R$1$i$i = $784;$RP$1$i$i = $783;
             }
             while(1) {
              $788 = ((($R$1$i$i)) + 20|0);
              $789 = HEAP32[$788>>2]|0;
              $790 = ($789|0)==(0|0);
              if (!($790)) {
               $R$1$i$i = $789;$RP$1$i$i = $788;
               continue;
              }
              $791 = ((($R$1$i$i)) + 16|0);
              $792 = HEAP32[$791>>2]|0;
              $793 = ($792|0)==(0|0);
              if ($793) {
               $R$1$i$i$lcssa = $R$1$i$i;$RP$1$i$i$lcssa = $RP$1$i$i;
               break;
              } else {
               $R$1$i$i = $792;$RP$1$i$i = $791;
              }
             }
             $794 = ($RP$1$i$i$lcssa>>>0)<($753>>>0);
             if ($794) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$RP$1$i$i$lcssa>>2] = 0;
              $R$3$i$i = $R$1$i$i$lcssa;
              break;
             }
            } else {
             $773 = ((($718)) + 8|0);
             $774 = HEAP32[$773>>2]|0;
             $775 = ($774>>>0)<($753>>>0);
             if ($775) {
              _abort();
              // unreachable;
             }
             $776 = ((($774)) + 12|0);
             $777 = HEAP32[$776>>2]|0;
             $778 = ($777|0)==($718|0);
             if (!($778)) {
              _abort();
              // unreachable;
             }
             $779 = ((($771)) + 8|0);
             $780 = HEAP32[$779>>2]|0;
             $781 = ($780|0)==($718|0);
             if ($781) {
              HEAP32[$776>>2] = $771;
              HEAP32[$779>>2] = $774;
              $R$3$i$i = $771;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $795 = ($769|0)==(0|0);
           if ($795) {
            break;
           }
           $796 = ((($718)) + 28|0);
           $797 = HEAP32[$796>>2]|0;
           $798 = (40104 + ($797<<2)|0);
           $799 = HEAP32[$798>>2]|0;
           $800 = ($718|0)==($799|0);
           do {
            if ($800) {
             HEAP32[$798>>2] = $R$3$i$i;
             $cond$i$i = ($R$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $801 = 1 << $797;
             $802 = $801 ^ -1;
             $803 = HEAP32[(39804)>>2]|0;
             $804 = $803 & $802;
             HEAP32[(39804)>>2] = $804;
             break L328;
            } else {
             $805 = HEAP32[(39816)>>2]|0;
             $806 = ($769>>>0)<($805>>>0);
             if ($806) {
              _abort();
              // unreachable;
             }
             $807 = ((($769)) + 16|0);
             $808 = HEAP32[$807>>2]|0;
             $809 = ($808|0)==($718|0);
             if ($809) {
              HEAP32[$807>>2] = $R$3$i$i;
             } else {
              $810 = ((($769)) + 20|0);
              HEAP32[$810>>2] = $R$3$i$i;
             }
             $811 = ($R$3$i$i|0)==(0|0);
             if ($811) {
              break L328;
             }
            }
           } while(0);
           $812 = HEAP32[(39816)>>2]|0;
           $813 = ($R$3$i$i>>>0)<($812>>>0);
           if ($813) {
            _abort();
            // unreachable;
           }
           $814 = ((($R$3$i$i)) + 24|0);
           HEAP32[$814>>2] = $769;
           $815 = ((($718)) + 16|0);
           $816 = HEAP32[$815>>2]|0;
           $817 = ($816|0)==(0|0);
           do {
            if (!($817)) {
             $818 = ($816>>>0)<($812>>>0);
             if ($818) {
              _abort();
              // unreachable;
             } else {
              $819 = ((($R$3$i$i)) + 16|0);
              HEAP32[$819>>2] = $816;
              $820 = ((($816)) + 24|0);
              HEAP32[$820>>2] = $R$3$i$i;
              break;
             }
            }
           } while(0);
           $821 = ((($815)) + 4|0);
           $822 = HEAP32[$821>>2]|0;
           $823 = ($822|0)==(0|0);
           if ($823) {
            break;
           }
           $824 = HEAP32[(39816)>>2]|0;
           $825 = ($822>>>0)<($824>>>0);
           if ($825) {
            _abort();
            // unreachable;
           } else {
            $826 = ((($R$3$i$i)) + 20|0);
            HEAP32[$826>>2] = $822;
            $827 = ((($822)) + 24|0);
            HEAP32[$827>>2] = $R$3$i$i;
            break;
           }
          }
         } while(0);
         $828 = (($718) + ($742)|0);
         $829 = (($742) + ($723))|0;
         $oldfirst$0$i$i = $828;$qsize$0$i$i = $829;
        } else {
         $oldfirst$0$i$i = $718;$qsize$0$i$i = $723;
        }
        $830 = ((($oldfirst$0$i$i)) + 4|0);
        $831 = HEAP32[$830>>2]|0;
        $832 = $831 & -2;
        HEAP32[$830>>2] = $832;
        $833 = $qsize$0$i$i | 1;
        $834 = ((($722)) + 4|0);
        HEAP32[$834>>2] = $833;
        $835 = (($722) + ($qsize$0$i$i)|0);
        HEAP32[$835>>2] = $qsize$0$i$i;
        $836 = $qsize$0$i$i >>> 3;
        $837 = ($qsize$0$i$i>>>0)<(256);
        if ($837) {
         $838 = $836 << 1;
         $839 = (39840 + ($838<<2)|0);
         $840 = HEAP32[9950]|0;
         $841 = 1 << $836;
         $842 = $840 & $841;
         $843 = ($842|0)==(0);
         do {
          if ($843) {
           $844 = $840 | $841;
           HEAP32[9950] = $844;
           $$pre$i16$i = ((($839)) + 8|0);
           $$pre$phi$i17$iZ2D = $$pre$i16$i;$F4$0$i$i = $839;
          } else {
           $845 = ((($839)) + 8|0);
           $846 = HEAP32[$845>>2]|0;
           $847 = HEAP32[(39816)>>2]|0;
           $848 = ($846>>>0)<($847>>>0);
           if (!($848)) {
            $$pre$phi$i17$iZ2D = $845;$F4$0$i$i = $846;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i17$iZ2D>>2] = $722;
         $849 = ((($F4$0$i$i)) + 12|0);
         HEAP32[$849>>2] = $722;
         $850 = ((($722)) + 8|0);
         HEAP32[$850>>2] = $F4$0$i$i;
         $851 = ((($722)) + 12|0);
         HEAP32[$851>>2] = $839;
         break;
        }
        $852 = $qsize$0$i$i >>> 8;
        $853 = ($852|0)==(0);
        do {
         if ($853) {
          $I7$0$i$i = 0;
         } else {
          $854 = ($qsize$0$i$i>>>0)>(16777215);
          if ($854) {
           $I7$0$i$i = 31;
           break;
          }
          $855 = (($852) + 1048320)|0;
          $856 = $855 >>> 16;
          $857 = $856 & 8;
          $858 = $852 << $857;
          $859 = (($858) + 520192)|0;
          $860 = $859 >>> 16;
          $861 = $860 & 4;
          $862 = $861 | $857;
          $863 = $858 << $861;
          $864 = (($863) + 245760)|0;
          $865 = $864 >>> 16;
          $866 = $865 & 2;
          $867 = $862 | $866;
          $868 = (14 - ($867))|0;
          $869 = $863 << $866;
          $870 = $869 >>> 15;
          $871 = (($868) + ($870))|0;
          $872 = $871 << 1;
          $873 = (($871) + 7)|0;
          $874 = $qsize$0$i$i >>> $873;
          $875 = $874 & 1;
          $876 = $875 | $872;
          $I7$0$i$i = $876;
         }
        } while(0);
        $877 = (40104 + ($I7$0$i$i<<2)|0);
        $878 = ((($722)) + 28|0);
        HEAP32[$878>>2] = $I7$0$i$i;
        $879 = ((($722)) + 16|0);
        $880 = ((($879)) + 4|0);
        HEAP32[$880>>2] = 0;
        HEAP32[$879>>2] = 0;
        $881 = HEAP32[(39804)>>2]|0;
        $882 = 1 << $I7$0$i$i;
        $883 = $881 & $882;
        $884 = ($883|0)==(0);
        if ($884) {
         $885 = $881 | $882;
         HEAP32[(39804)>>2] = $885;
         HEAP32[$877>>2] = $722;
         $886 = ((($722)) + 24|0);
         HEAP32[$886>>2] = $877;
         $887 = ((($722)) + 12|0);
         HEAP32[$887>>2] = $722;
         $888 = ((($722)) + 8|0);
         HEAP32[$888>>2] = $722;
         break;
        }
        $889 = HEAP32[$877>>2]|0;
        $890 = ($I7$0$i$i|0)==(31);
        $891 = $I7$0$i$i >>> 1;
        $892 = (25 - ($891))|0;
        $893 = $890 ? 0 : $892;
        $894 = $qsize$0$i$i << $893;
        $K8$0$i$i = $894;$T$0$i18$i = $889;
        while(1) {
         $895 = ((($T$0$i18$i)) + 4|0);
         $896 = HEAP32[$895>>2]|0;
         $897 = $896 & -8;
         $898 = ($897|0)==($qsize$0$i$i|0);
         if ($898) {
          $T$0$i18$i$lcssa = $T$0$i18$i;
          label = 279;
          break;
         }
         $899 = $K8$0$i$i >>> 31;
         $900 = (((($T$0$i18$i)) + 16|0) + ($899<<2)|0);
         $901 = $K8$0$i$i << 1;
         $902 = HEAP32[$900>>2]|0;
         $903 = ($902|0)==(0|0);
         if ($903) {
          $$lcssa = $900;$T$0$i18$i$lcssa139 = $T$0$i18$i;
          label = 276;
          break;
         } else {
          $K8$0$i$i = $901;$T$0$i18$i = $902;
         }
        }
        if ((label|0) == 276) {
         $904 = HEAP32[(39816)>>2]|0;
         $905 = ($$lcssa>>>0)<($904>>>0);
         if ($905) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$lcssa>>2] = $722;
          $906 = ((($722)) + 24|0);
          HEAP32[$906>>2] = $T$0$i18$i$lcssa139;
          $907 = ((($722)) + 12|0);
          HEAP32[$907>>2] = $722;
          $908 = ((($722)) + 8|0);
          HEAP32[$908>>2] = $722;
          break;
         }
        }
        else if ((label|0) == 279) {
         $909 = ((($T$0$i18$i$lcssa)) + 8|0);
         $910 = HEAP32[$909>>2]|0;
         $911 = HEAP32[(39816)>>2]|0;
         $912 = ($910>>>0)>=($911>>>0);
         $not$$i20$i = ($T$0$i18$i$lcssa>>>0)>=($911>>>0);
         $913 = $912 & $not$$i20$i;
         if ($913) {
          $914 = ((($910)) + 12|0);
          HEAP32[$914>>2] = $722;
          HEAP32[$909>>2] = $722;
          $915 = ((($722)) + 8|0);
          HEAP32[$915>>2] = $910;
          $916 = ((($722)) + 12|0);
          HEAP32[$916>>2] = $T$0$i18$i$lcssa;
          $917 = ((($722)) + 24|0);
          HEAP32[$917>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       }
      } while(0);
      $1048 = ((($710)) + 8|0);
      $$0 = $1048;
      STACKTOP = sp;return ($$0|0);
     } else {
      $sp$0$i$i$i = (40248);
     }
    }
    while(1) {
     $918 = HEAP32[$sp$0$i$i$i>>2]|0;
     $919 = ($918>>>0)>($631>>>0);
     if (!($919)) {
      $920 = ((($sp$0$i$i$i)) + 4|0);
      $921 = HEAP32[$920>>2]|0;
      $922 = (($918) + ($921)|0);
      $923 = ($922>>>0)>($631>>>0);
      if ($923) {
       $$lcssa142 = $922;
       break;
      }
     }
     $924 = ((($sp$0$i$i$i)) + 8|0);
     $925 = HEAP32[$924>>2]|0;
     $sp$0$i$i$i = $925;
    }
    $926 = ((($$lcssa142)) + -47|0);
    $927 = ((($926)) + 8|0);
    $928 = $927;
    $929 = $928 & 7;
    $930 = ($929|0)==(0);
    $931 = (0 - ($928))|0;
    $932 = $931 & 7;
    $933 = $930 ? 0 : $932;
    $934 = (($926) + ($933)|0);
    $935 = ((($631)) + 16|0);
    $936 = ($934>>>0)<($935>>>0);
    $937 = $936 ? $631 : $934;
    $938 = ((($937)) + 8|0);
    $939 = ((($937)) + 24|0);
    $940 = (($tsize$745$i) + -40)|0;
    $941 = ((($tbase$746$i)) + 8|0);
    $942 = $941;
    $943 = $942 & 7;
    $944 = ($943|0)==(0);
    $945 = (0 - ($942))|0;
    $946 = $945 & 7;
    $947 = $944 ? 0 : $946;
    $948 = (($tbase$746$i) + ($947)|0);
    $949 = (($940) - ($947))|0;
    HEAP32[(39824)>>2] = $948;
    HEAP32[(39812)>>2] = $949;
    $950 = $949 | 1;
    $951 = ((($948)) + 4|0);
    HEAP32[$951>>2] = $950;
    $952 = (($948) + ($949)|0);
    $953 = ((($952)) + 4|0);
    HEAP32[$953>>2] = 40;
    $954 = HEAP32[(40288)>>2]|0;
    HEAP32[(39828)>>2] = $954;
    $955 = ((($937)) + 4|0);
    HEAP32[$955>>2] = 27;
    ;HEAP32[$938>>2]=HEAP32[(40248)>>2]|0;HEAP32[$938+4>>2]=HEAP32[(40248)+4>>2]|0;HEAP32[$938+8>>2]=HEAP32[(40248)+8>>2]|0;HEAP32[$938+12>>2]=HEAP32[(40248)+12>>2]|0;
    HEAP32[(40248)>>2] = $tbase$746$i;
    HEAP32[(40252)>>2] = $tsize$745$i;
    HEAP32[(40260)>>2] = 0;
    HEAP32[(40256)>>2] = $938;
    $p$0$i$i = $939;
    while(1) {
     $956 = ((($p$0$i$i)) + 4|0);
     HEAP32[$956>>2] = 7;
     $957 = ((($956)) + 4|0);
     $958 = ($957>>>0)<($$lcssa142>>>0);
     if ($958) {
      $p$0$i$i = $956;
     } else {
      break;
     }
    }
    $959 = ($937|0)==($631|0);
    if (!($959)) {
     $960 = $937;
     $961 = $631;
     $962 = (($960) - ($961))|0;
     $963 = HEAP32[$955>>2]|0;
     $964 = $963 & -2;
     HEAP32[$955>>2] = $964;
     $965 = $962 | 1;
     $966 = ((($631)) + 4|0);
     HEAP32[$966>>2] = $965;
     HEAP32[$937>>2] = $962;
     $967 = $962 >>> 3;
     $968 = ($962>>>0)<(256);
     if ($968) {
      $969 = $967 << 1;
      $970 = (39840 + ($969<<2)|0);
      $971 = HEAP32[9950]|0;
      $972 = 1 << $967;
      $973 = $971 & $972;
      $974 = ($973|0)==(0);
      if ($974) {
       $975 = $971 | $972;
       HEAP32[9950] = $975;
       $$pre$i$i = ((($970)) + 8|0);
       $$pre$phi$i$iZ2D = $$pre$i$i;$F$0$i$i = $970;
      } else {
       $976 = ((($970)) + 8|0);
       $977 = HEAP32[$976>>2]|0;
       $978 = HEAP32[(39816)>>2]|0;
       $979 = ($977>>>0)<($978>>>0);
       if ($979) {
        _abort();
        // unreachable;
       } else {
        $$pre$phi$i$iZ2D = $976;$F$0$i$i = $977;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $631;
      $980 = ((($F$0$i$i)) + 12|0);
      HEAP32[$980>>2] = $631;
      $981 = ((($631)) + 8|0);
      HEAP32[$981>>2] = $F$0$i$i;
      $982 = ((($631)) + 12|0);
      HEAP32[$982>>2] = $970;
      break;
     }
     $983 = $962 >>> 8;
     $984 = ($983|0)==(0);
     if ($984) {
      $I1$0$i$i = 0;
     } else {
      $985 = ($962>>>0)>(16777215);
      if ($985) {
       $I1$0$i$i = 31;
      } else {
       $986 = (($983) + 1048320)|0;
       $987 = $986 >>> 16;
       $988 = $987 & 8;
       $989 = $983 << $988;
       $990 = (($989) + 520192)|0;
       $991 = $990 >>> 16;
       $992 = $991 & 4;
       $993 = $992 | $988;
       $994 = $989 << $992;
       $995 = (($994) + 245760)|0;
       $996 = $995 >>> 16;
       $997 = $996 & 2;
       $998 = $993 | $997;
       $999 = (14 - ($998))|0;
       $1000 = $994 << $997;
       $1001 = $1000 >>> 15;
       $1002 = (($999) + ($1001))|0;
       $1003 = $1002 << 1;
       $1004 = (($1002) + 7)|0;
       $1005 = $962 >>> $1004;
       $1006 = $1005 & 1;
       $1007 = $1006 | $1003;
       $I1$0$i$i = $1007;
      }
     }
     $1008 = (40104 + ($I1$0$i$i<<2)|0);
     $1009 = ((($631)) + 28|0);
     HEAP32[$1009>>2] = $I1$0$i$i;
     $1010 = ((($631)) + 20|0);
     HEAP32[$1010>>2] = 0;
     HEAP32[$935>>2] = 0;
     $1011 = HEAP32[(39804)>>2]|0;
     $1012 = 1 << $I1$0$i$i;
     $1013 = $1011 & $1012;
     $1014 = ($1013|0)==(0);
     if ($1014) {
      $1015 = $1011 | $1012;
      HEAP32[(39804)>>2] = $1015;
      HEAP32[$1008>>2] = $631;
      $1016 = ((($631)) + 24|0);
      HEAP32[$1016>>2] = $1008;
      $1017 = ((($631)) + 12|0);
      HEAP32[$1017>>2] = $631;
      $1018 = ((($631)) + 8|0);
      HEAP32[$1018>>2] = $631;
      break;
     }
     $1019 = HEAP32[$1008>>2]|0;
     $1020 = ($I1$0$i$i|0)==(31);
     $1021 = $I1$0$i$i >>> 1;
     $1022 = (25 - ($1021))|0;
     $1023 = $1020 ? 0 : $1022;
     $1024 = $962 << $1023;
     $K2$0$i$i = $1024;$T$0$i$i = $1019;
     while(1) {
      $1025 = ((($T$0$i$i)) + 4|0);
      $1026 = HEAP32[$1025>>2]|0;
      $1027 = $1026 & -8;
      $1028 = ($1027|0)==($962|0);
      if ($1028) {
       $T$0$i$i$lcssa = $T$0$i$i;
       label = 305;
       break;
      }
      $1029 = $K2$0$i$i >>> 31;
      $1030 = (((($T$0$i$i)) + 16|0) + ($1029<<2)|0);
      $1031 = $K2$0$i$i << 1;
      $1032 = HEAP32[$1030>>2]|0;
      $1033 = ($1032|0)==(0|0);
      if ($1033) {
       $$lcssa141 = $1030;$T$0$i$i$lcssa140 = $T$0$i$i;
       label = 302;
       break;
      } else {
       $K2$0$i$i = $1031;$T$0$i$i = $1032;
      }
     }
     if ((label|0) == 302) {
      $1034 = HEAP32[(39816)>>2]|0;
      $1035 = ($$lcssa141>>>0)<($1034>>>0);
      if ($1035) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$lcssa141>>2] = $631;
       $1036 = ((($631)) + 24|0);
       HEAP32[$1036>>2] = $T$0$i$i$lcssa140;
       $1037 = ((($631)) + 12|0);
       HEAP32[$1037>>2] = $631;
       $1038 = ((($631)) + 8|0);
       HEAP32[$1038>>2] = $631;
       break;
      }
     }
     else if ((label|0) == 305) {
      $1039 = ((($T$0$i$i$lcssa)) + 8|0);
      $1040 = HEAP32[$1039>>2]|0;
      $1041 = HEAP32[(39816)>>2]|0;
      $1042 = ($1040>>>0)>=($1041>>>0);
      $not$$i$i = ($T$0$i$i$lcssa>>>0)>=($1041>>>0);
      $1043 = $1042 & $not$$i$i;
      if ($1043) {
       $1044 = ((($1040)) + 12|0);
       HEAP32[$1044>>2] = $631;
       HEAP32[$1039>>2] = $631;
       $1045 = ((($631)) + 8|0);
       HEAP32[$1045>>2] = $1040;
       $1046 = ((($631)) + 12|0);
       HEAP32[$1046>>2] = $T$0$i$i$lcssa;
       $1047 = ((($631)) + 24|0);
       HEAP32[$1047>>2] = 0;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    }
   }
  } while(0);
  $1049 = HEAP32[(39812)>>2]|0;
  $1050 = ($1049>>>0)>($nb$0>>>0);
  if ($1050) {
   $1051 = (($1049) - ($nb$0))|0;
   HEAP32[(39812)>>2] = $1051;
   $1052 = HEAP32[(39824)>>2]|0;
   $1053 = (($1052) + ($nb$0)|0);
   HEAP32[(39824)>>2] = $1053;
   $1054 = $1051 | 1;
   $1055 = ((($1053)) + 4|0);
   HEAP32[$1055>>2] = $1054;
   $1056 = $nb$0 | 3;
   $1057 = ((($1052)) + 4|0);
   HEAP32[$1057>>2] = $1056;
   $1058 = ((($1052)) + 8|0);
   $$0 = $1058;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $1059 = (___errno_location()|0);
 HEAP32[$1059>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($mem) {
 $mem = $mem|0;
 var $$lcssa = 0, $$pre = 0, $$pre$phi41Z2D = 0, $$pre$phi43Z2D = 0, $$pre$phiZ2D = 0, $$pre40 = 0, $$pre42 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0;
 var $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0;
 var $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0;
 var $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0;
 var $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0;
 var $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0;
 var $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0;
 var $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0;
 var $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0;
 var $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0;
 var $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0;
 var $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0;
 var $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0;
 var $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0;
 var $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F18$0 = 0, $I20$0 = 0, $K21$0 = 0, $R$1 = 0, $R$1$lcssa = 0, $R$3 = 0, $R8$1 = 0, $R8$1$lcssa = 0, $R8$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $RP10$1 = 0, $RP10$1$lcssa = 0;
 var $T$0 = 0, $T$0$lcssa = 0, $T$0$lcssa48 = 0, $cond20 = 0, $cond21 = 0, $not$ = 0, $p$1 = 0, $psize$1 = 0, $psize$2 = 0, $sp$0$i = 0, $sp$0$in$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($mem|0)==(0|0);
 if ($0) {
  return;
 }
 $1 = ((($mem)) + -8|0);
 $2 = HEAP32[(39816)>>2]|0;
 $3 = ($1>>>0)<($2>>>0);
 if ($3) {
  _abort();
  // unreachable;
 }
 $4 = ((($mem)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & 3;
 $7 = ($6|0)==(1);
 if ($7) {
  _abort();
  // unreachable;
 }
 $8 = $5 & -8;
 $9 = (($1) + ($8)|0);
 $10 = $5 & 1;
 $11 = ($10|0)==(0);
 do {
  if ($11) {
   $12 = HEAP32[$1>>2]|0;
   $13 = ($6|0)==(0);
   if ($13) {
    return;
   }
   $14 = (0 - ($12))|0;
   $15 = (($1) + ($14)|0);
   $16 = (($12) + ($8))|0;
   $17 = ($15>>>0)<($2>>>0);
   if ($17) {
    _abort();
    // unreachable;
   }
   $18 = HEAP32[(39820)>>2]|0;
   $19 = ($15|0)==($18|0);
   if ($19) {
    $104 = ((($9)) + 4|0);
    $105 = HEAP32[$104>>2]|0;
    $106 = $105 & 3;
    $107 = ($106|0)==(3);
    if (!($107)) {
     $p$1 = $15;$psize$1 = $16;
     break;
    }
    HEAP32[(39808)>>2] = $16;
    $108 = $105 & -2;
    HEAP32[$104>>2] = $108;
    $109 = $16 | 1;
    $110 = ((($15)) + 4|0);
    HEAP32[$110>>2] = $109;
    $111 = (($15) + ($16)|0);
    HEAP32[$111>>2] = $16;
    return;
   }
   $20 = $12 >>> 3;
   $21 = ($12>>>0)<(256);
   if ($21) {
    $22 = ((($15)) + 8|0);
    $23 = HEAP32[$22>>2]|0;
    $24 = ((($15)) + 12|0);
    $25 = HEAP32[$24>>2]|0;
    $26 = $20 << 1;
    $27 = (39840 + ($26<<2)|0);
    $28 = ($23|0)==($27|0);
    if (!($28)) {
     $29 = ($23>>>0)<($2>>>0);
     if ($29) {
      _abort();
      // unreachable;
     }
     $30 = ((($23)) + 12|0);
     $31 = HEAP32[$30>>2]|0;
     $32 = ($31|0)==($15|0);
     if (!($32)) {
      _abort();
      // unreachable;
     }
    }
    $33 = ($25|0)==($23|0);
    if ($33) {
     $34 = 1 << $20;
     $35 = $34 ^ -1;
     $36 = HEAP32[9950]|0;
     $37 = $36 & $35;
     HEAP32[9950] = $37;
     $p$1 = $15;$psize$1 = $16;
     break;
    }
    $38 = ($25|0)==($27|0);
    if ($38) {
     $$pre42 = ((($25)) + 8|0);
     $$pre$phi43Z2D = $$pre42;
    } else {
     $39 = ($25>>>0)<($2>>>0);
     if ($39) {
      _abort();
      // unreachable;
     }
     $40 = ((($25)) + 8|0);
     $41 = HEAP32[$40>>2]|0;
     $42 = ($41|0)==($15|0);
     if ($42) {
      $$pre$phi43Z2D = $40;
     } else {
      _abort();
      // unreachable;
     }
    }
    $43 = ((($23)) + 12|0);
    HEAP32[$43>>2] = $25;
    HEAP32[$$pre$phi43Z2D>>2] = $23;
    $p$1 = $15;$psize$1 = $16;
    break;
   }
   $44 = ((($15)) + 24|0);
   $45 = HEAP32[$44>>2]|0;
   $46 = ((($15)) + 12|0);
   $47 = HEAP32[$46>>2]|0;
   $48 = ($47|0)==($15|0);
   do {
    if ($48) {
     $58 = ((($15)) + 16|0);
     $59 = ((($58)) + 4|0);
     $60 = HEAP32[$59>>2]|0;
     $61 = ($60|0)==(0|0);
     if ($61) {
      $62 = HEAP32[$58>>2]|0;
      $63 = ($62|0)==(0|0);
      if ($63) {
       $R$3 = 0;
       break;
      } else {
       $R$1 = $62;$RP$1 = $58;
      }
     } else {
      $R$1 = $60;$RP$1 = $59;
     }
     while(1) {
      $64 = ((($R$1)) + 20|0);
      $65 = HEAP32[$64>>2]|0;
      $66 = ($65|0)==(0|0);
      if (!($66)) {
       $R$1 = $65;$RP$1 = $64;
       continue;
      }
      $67 = ((($R$1)) + 16|0);
      $68 = HEAP32[$67>>2]|0;
      $69 = ($68|0)==(0|0);
      if ($69) {
       $R$1$lcssa = $R$1;$RP$1$lcssa = $RP$1;
       break;
      } else {
       $R$1 = $68;$RP$1 = $67;
      }
     }
     $70 = ($RP$1$lcssa>>>0)<($2>>>0);
     if ($70) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$1$lcssa>>2] = 0;
      $R$3 = $R$1$lcssa;
      break;
     }
    } else {
     $49 = ((($15)) + 8|0);
     $50 = HEAP32[$49>>2]|0;
     $51 = ($50>>>0)<($2>>>0);
     if ($51) {
      _abort();
      // unreachable;
     }
     $52 = ((($50)) + 12|0);
     $53 = HEAP32[$52>>2]|0;
     $54 = ($53|0)==($15|0);
     if (!($54)) {
      _abort();
      // unreachable;
     }
     $55 = ((($47)) + 8|0);
     $56 = HEAP32[$55>>2]|0;
     $57 = ($56|0)==($15|0);
     if ($57) {
      HEAP32[$52>>2] = $47;
      HEAP32[$55>>2] = $50;
      $R$3 = $47;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $71 = ($45|0)==(0|0);
   if ($71) {
    $p$1 = $15;$psize$1 = $16;
   } else {
    $72 = ((($15)) + 28|0);
    $73 = HEAP32[$72>>2]|0;
    $74 = (40104 + ($73<<2)|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = ($15|0)==($75|0);
    if ($76) {
     HEAP32[$74>>2] = $R$3;
     $cond20 = ($R$3|0)==(0|0);
     if ($cond20) {
      $77 = 1 << $73;
      $78 = $77 ^ -1;
      $79 = HEAP32[(39804)>>2]|0;
      $80 = $79 & $78;
      HEAP32[(39804)>>2] = $80;
      $p$1 = $15;$psize$1 = $16;
      break;
     }
    } else {
     $81 = HEAP32[(39816)>>2]|0;
     $82 = ($45>>>0)<($81>>>0);
     if ($82) {
      _abort();
      // unreachable;
     }
     $83 = ((($45)) + 16|0);
     $84 = HEAP32[$83>>2]|0;
     $85 = ($84|0)==($15|0);
     if ($85) {
      HEAP32[$83>>2] = $R$3;
     } else {
      $86 = ((($45)) + 20|0);
      HEAP32[$86>>2] = $R$3;
     }
     $87 = ($R$3|0)==(0|0);
     if ($87) {
      $p$1 = $15;$psize$1 = $16;
      break;
     }
    }
    $88 = HEAP32[(39816)>>2]|0;
    $89 = ($R$3>>>0)<($88>>>0);
    if ($89) {
     _abort();
     // unreachable;
    }
    $90 = ((($R$3)) + 24|0);
    HEAP32[$90>>2] = $45;
    $91 = ((($15)) + 16|0);
    $92 = HEAP32[$91>>2]|0;
    $93 = ($92|0)==(0|0);
    do {
     if (!($93)) {
      $94 = ($92>>>0)<($88>>>0);
      if ($94) {
       _abort();
       // unreachable;
      } else {
       $95 = ((($R$3)) + 16|0);
       HEAP32[$95>>2] = $92;
       $96 = ((($92)) + 24|0);
       HEAP32[$96>>2] = $R$3;
       break;
      }
     }
    } while(0);
    $97 = ((($91)) + 4|0);
    $98 = HEAP32[$97>>2]|0;
    $99 = ($98|0)==(0|0);
    if ($99) {
     $p$1 = $15;$psize$1 = $16;
    } else {
     $100 = HEAP32[(39816)>>2]|0;
     $101 = ($98>>>0)<($100>>>0);
     if ($101) {
      _abort();
      // unreachable;
     } else {
      $102 = ((($R$3)) + 20|0);
      HEAP32[$102>>2] = $98;
      $103 = ((($98)) + 24|0);
      HEAP32[$103>>2] = $R$3;
      $p$1 = $15;$psize$1 = $16;
      break;
     }
    }
   }
  } else {
   $p$1 = $1;$psize$1 = $8;
  }
 } while(0);
 $112 = ($p$1>>>0)<($9>>>0);
 if (!($112)) {
  _abort();
  // unreachable;
 }
 $113 = ((($9)) + 4|0);
 $114 = HEAP32[$113>>2]|0;
 $115 = $114 & 1;
 $116 = ($115|0)==(0);
 if ($116) {
  _abort();
  // unreachable;
 }
 $117 = $114 & 2;
 $118 = ($117|0)==(0);
 if ($118) {
  $119 = HEAP32[(39824)>>2]|0;
  $120 = ($9|0)==($119|0);
  if ($120) {
   $121 = HEAP32[(39812)>>2]|0;
   $122 = (($121) + ($psize$1))|0;
   HEAP32[(39812)>>2] = $122;
   HEAP32[(39824)>>2] = $p$1;
   $123 = $122 | 1;
   $124 = ((($p$1)) + 4|0);
   HEAP32[$124>>2] = $123;
   $125 = HEAP32[(39820)>>2]|0;
   $126 = ($p$1|0)==($125|0);
   if (!($126)) {
    return;
   }
   HEAP32[(39820)>>2] = 0;
   HEAP32[(39808)>>2] = 0;
   return;
  }
  $127 = HEAP32[(39820)>>2]|0;
  $128 = ($9|0)==($127|0);
  if ($128) {
   $129 = HEAP32[(39808)>>2]|0;
   $130 = (($129) + ($psize$1))|0;
   HEAP32[(39808)>>2] = $130;
   HEAP32[(39820)>>2] = $p$1;
   $131 = $130 | 1;
   $132 = ((($p$1)) + 4|0);
   HEAP32[$132>>2] = $131;
   $133 = (($p$1) + ($130)|0);
   HEAP32[$133>>2] = $130;
   return;
  }
  $134 = $114 & -8;
  $135 = (($134) + ($psize$1))|0;
  $136 = $114 >>> 3;
  $137 = ($114>>>0)<(256);
  do {
   if ($137) {
    $138 = ((($9)) + 8|0);
    $139 = HEAP32[$138>>2]|0;
    $140 = ((($9)) + 12|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = $136 << 1;
    $143 = (39840 + ($142<<2)|0);
    $144 = ($139|0)==($143|0);
    if (!($144)) {
     $145 = HEAP32[(39816)>>2]|0;
     $146 = ($139>>>0)<($145>>>0);
     if ($146) {
      _abort();
      // unreachable;
     }
     $147 = ((($139)) + 12|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = ($148|0)==($9|0);
     if (!($149)) {
      _abort();
      // unreachable;
     }
    }
    $150 = ($141|0)==($139|0);
    if ($150) {
     $151 = 1 << $136;
     $152 = $151 ^ -1;
     $153 = HEAP32[9950]|0;
     $154 = $153 & $152;
     HEAP32[9950] = $154;
     break;
    }
    $155 = ($141|0)==($143|0);
    if ($155) {
     $$pre40 = ((($141)) + 8|0);
     $$pre$phi41Z2D = $$pre40;
    } else {
     $156 = HEAP32[(39816)>>2]|0;
     $157 = ($141>>>0)<($156>>>0);
     if ($157) {
      _abort();
      // unreachable;
     }
     $158 = ((($141)) + 8|0);
     $159 = HEAP32[$158>>2]|0;
     $160 = ($159|0)==($9|0);
     if ($160) {
      $$pre$phi41Z2D = $158;
     } else {
      _abort();
      // unreachable;
     }
    }
    $161 = ((($139)) + 12|0);
    HEAP32[$161>>2] = $141;
    HEAP32[$$pre$phi41Z2D>>2] = $139;
   } else {
    $162 = ((($9)) + 24|0);
    $163 = HEAP32[$162>>2]|0;
    $164 = ((($9)) + 12|0);
    $165 = HEAP32[$164>>2]|0;
    $166 = ($165|0)==($9|0);
    do {
     if ($166) {
      $177 = ((($9)) + 16|0);
      $178 = ((($177)) + 4|0);
      $179 = HEAP32[$178>>2]|0;
      $180 = ($179|0)==(0|0);
      if ($180) {
       $181 = HEAP32[$177>>2]|0;
       $182 = ($181|0)==(0|0);
       if ($182) {
        $R8$3 = 0;
        break;
       } else {
        $R8$1 = $181;$RP10$1 = $177;
       }
      } else {
       $R8$1 = $179;$RP10$1 = $178;
      }
      while(1) {
       $183 = ((($R8$1)) + 20|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = ($184|0)==(0|0);
       if (!($185)) {
        $R8$1 = $184;$RP10$1 = $183;
        continue;
       }
       $186 = ((($R8$1)) + 16|0);
       $187 = HEAP32[$186>>2]|0;
       $188 = ($187|0)==(0|0);
       if ($188) {
        $R8$1$lcssa = $R8$1;$RP10$1$lcssa = $RP10$1;
        break;
       } else {
        $R8$1 = $187;$RP10$1 = $186;
       }
      }
      $189 = HEAP32[(39816)>>2]|0;
      $190 = ($RP10$1$lcssa>>>0)<($189>>>0);
      if ($190) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$RP10$1$lcssa>>2] = 0;
       $R8$3 = $R8$1$lcssa;
       break;
      }
     } else {
      $167 = ((($9)) + 8|0);
      $168 = HEAP32[$167>>2]|0;
      $169 = HEAP32[(39816)>>2]|0;
      $170 = ($168>>>0)<($169>>>0);
      if ($170) {
       _abort();
       // unreachable;
      }
      $171 = ((($168)) + 12|0);
      $172 = HEAP32[$171>>2]|0;
      $173 = ($172|0)==($9|0);
      if (!($173)) {
       _abort();
       // unreachable;
      }
      $174 = ((($165)) + 8|0);
      $175 = HEAP32[$174>>2]|0;
      $176 = ($175|0)==($9|0);
      if ($176) {
       HEAP32[$171>>2] = $165;
       HEAP32[$174>>2] = $168;
       $R8$3 = $165;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $191 = ($163|0)==(0|0);
    if (!($191)) {
     $192 = ((($9)) + 28|0);
     $193 = HEAP32[$192>>2]|0;
     $194 = (40104 + ($193<<2)|0);
     $195 = HEAP32[$194>>2]|0;
     $196 = ($9|0)==($195|0);
     if ($196) {
      HEAP32[$194>>2] = $R8$3;
      $cond21 = ($R8$3|0)==(0|0);
      if ($cond21) {
       $197 = 1 << $193;
       $198 = $197 ^ -1;
       $199 = HEAP32[(39804)>>2]|0;
       $200 = $199 & $198;
       HEAP32[(39804)>>2] = $200;
       break;
      }
     } else {
      $201 = HEAP32[(39816)>>2]|0;
      $202 = ($163>>>0)<($201>>>0);
      if ($202) {
       _abort();
       // unreachable;
      }
      $203 = ((($163)) + 16|0);
      $204 = HEAP32[$203>>2]|0;
      $205 = ($204|0)==($9|0);
      if ($205) {
       HEAP32[$203>>2] = $R8$3;
      } else {
       $206 = ((($163)) + 20|0);
       HEAP32[$206>>2] = $R8$3;
      }
      $207 = ($R8$3|0)==(0|0);
      if ($207) {
       break;
      }
     }
     $208 = HEAP32[(39816)>>2]|0;
     $209 = ($R8$3>>>0)<($208>>>0);
     if ($209) {
      _abort();
      // unreachable;
     }
     $210 = ((($R8$3)) + 24|0);
     HEAP32[$210>>2] = $163;
     $211 = ((($9)) + 16|0);
     $212 = HEAP32[$211>>2]|0;
     $213 = ($212|0)==(0|0);
     do {
      if (!($213)) {
       $214 = ($212>>>0)<($208>>>0);
       if ($214) {
        _abort();
        // unreachable;
       } else {
        $215 = ((($R8$3)) + 16|0);
        HEAP32[$215>>2] = $212;
        $216 = ((($212)) + 24|0);
        HEAP32[$216>>2] = $R8$3;
        break;
       }
      }
     } while(0);
     $217 = ((($211)) + 4|0);
     $218 = HEAP32[$217>>2]|0;
     $219 = ($218|0)==(0|0);
     if (!($219)) {
      $220 = HEAP32[(39816)>>2]|0;
      $221 = ($218>>>0)<($220>>>0);
      if ($221) {
       _abort();
       // unreachable;
      } else {
       $222 = ((($R8$3)) + 20|0);
       HEAP32[$222>>2] = $218;
       $223 = ((($218)) + 24|0);
       HEAP32[$223>>2] = $R8$3;
       break;
      }
     }
    }
   }
  } while(0);
  $224 = $135 | 1;
  $225 = ((($p$1)) + 4|0);
  HEAP32[$225>>2] = $224;
  $226 = (($p$1) + ($135)|0);
  HEAP32[$226>>2] = $135;
  $227 = HEAP32[(39820)>>2]|0;
  $228 = ($p$1|0)==($227|0);
  if ($228) {
   HEAP32[(39808)>>2] = $135;
   return;
  } else {
   $psize$2 = $135;
  }
 } else {
  $229 = $114 & -2;
  HEAP32[$113>>2] = $229;
  $230 = $psize$1 | 1;
  $231 = ((($p$1)) + 4|0);
  HEAP32[$231>>2] = $230;
  $232 = (($p$1) + ($psize$1)|0);
  HEAP32[$232>>2] = $psize$1;
  $psize$2 = $psize$1;
 }
 $233 = $psize$2 >>> 3;
 $234 = ($psize$2>>>0)<(256);
 if ($234) {
  $235 = $233 << 1;
  $236 = (39840 + ($235<<2)|0);
  $237 = HEAP32[9950]|0;
  $238 = 1 << $233;
  $239 = $237 & $238;
  $240 = ($239|0)==(0);
  if ($240) {
   $241 = $237 | $238;
   HEAP32[9950] = $241;
   $$pre = ((($236)) + 8|0);
   $$pre$phiZ2D = $$pre;$F18$0 = $236;
  } else {
   $242 = ((($236)) + 8|0);
   $243 = HEAP32[$242>>2]|0;
   $244 = HEAP32[(39816)>>2]|0;
   $245 = ($243>>>0)<($244>>>0);
   if ($245) {
    _abort();
    // unreachable;
   } else {
    $$pre$phiZ2D = $242;$F18$0 = $243;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $p$1;
  $246 = ((($F18$0)) + 12|0);
  HEAP32[$246>>2] = $p$1;
  $247 = ((($p$1)) + 8|0);
  HEAP32[$247>>2] = $F18$0;
  $248 = ((($p$1)) + 12|0);
  HEAP32[$248>>2] = $236;
  return;
 }
 $249 = $psize$2 >>> 8;
 $250 = ($249|0)==(0);
 if ($250) {
  $I20$0 = 0;
 } else {
  $251 = ($psize$2>>>0)>(16777215);
  if ($251) {
   $I20$0 = 31;
  } else {
   $252 = (($249) + 1048320)|0;
   $253 = $252 >>> 16;
   $254 = $253 & 8;
   $255 = $249 << $254;
   $256 = (($255) + 520192)|0;
   $257 = $256 >>> 16;
   $258 = $257 & 4;
   $259 = $258 | $254;
   $260 = $255 << $258;
   $261 = (($260) + 245760)|0;
   $262 = $261 >>> 16;
   $263 = $262 & 2;
   $264 = $259 | $263;
   $265 = (14 - ($264))|0;
   $266 = $260 << $263;
   $267 = $266 >>> 15;
   $268 = (($265) + ($267))|0;
   $269 = $268 << 1;
   $270 = (($268) + 7)|0;
   $271 = $psize$2 >>> $270;
   $272 = $271 & 1;
   $273 = $272 | $269;
   $I20$0 = $273;
  }
 }
 $274 = (40104 + ($I20$0<<2)|0);
 $275 = ((($p$1)) + 28|0);
 HEAP32[$275>>2] = $I20$0;
 $276 = ((($p$1)) + 16|0);
 $277 = ((($p$1)) + 20|0);
 HEAP32[$277>>2] = 0;
 HEAP32[$276>>2] = 0;
 $278 = HEAP32[(39804)>>2]|0;
 $279 = 1 << $I20$0;
 $280 = $278 & $279;
 $281 = ($280|0)==(0);
 do {
  if ($281) {
   $282 = $278 | $279;
   HEAP32[(39804)>>2] = $282;
   HEAP32[$274>>2] = $p$1;
   $283 = ((($p$1)) + 24|0);
   HEAP32[$283>>2] = $274;
   $284 = ((($p$1)) + 12|0);
   HEAP32[$284>>2] = $p$1;
   $285 = ((($p$1)) + 8|0);
   HEAP32[$285>>2] = $p$1;
  } else {
   $286 = HEAP32[$274>>2]|0;
   $287 = ($I20$0|0)==(31);
   $288 = $I20$0 >>> 1;
   $289 = (25 - ($288))|0;
   $290 = $287 ? 0 : $289;
   $291 = $psize$2 << $290;
   $K21$0 = $291;$T$0 = $286;
   while(1) {
    $292 = ((($T$0)) + 4|0);
    $293 = HEAP32[$292>>2]|0;
    $294 = $293 & -8;
    $295 = ($294|0)==($psize$2|0);
    if ($295) {
     $T$0$lcssa = $T$0;
     label = 130;
     break;
    }
    $296 = $K21$0 >>> 31;
    $297 = (((($T$0)) + 16|0) + ($296<<2)|0);
    $298 = $K21$0 << 1;
    $299 = HEAP32[$297>>2]|0;
    $300 = ($299|0)==(0|0);
    if ($300) {
     $$lcssa = $297;$T$0$lcssa48 = $T$0;
     label = 127;
     break;
    } else {
     $K21$0 = $298;$T$0 = $299;
    }
   }
   if ((label|0) == 127) {
    $301 = HEAP32[(39816)>>2]|0;
    $302 = ($$lcssa>>>0)<($301>>>0);
    if ($302) {
     _abort();
     // unreachable;
    } else {
     HEAP32[$$lcssa>>2] = $p$1;
     $303 = ((($p$1)) + 24|0);
     HEAP32[$303>>2] = $T$0$lcssa48;
     $304 = ((($p$1)) + 12|0);
     HEAP32[$304>>2] = $p$1;
     $305 = ((($p$1)) + 8|0);
     HEAP32[$305>>2] = $p$1;
     break;
    }
   }
   else if ((label|0) == 130) {
    $306 = ((($T$0$lcssa)) + 8|0);
    $307 = HEAP32[$306>>2]|0;
    $308 = HEAP32[(39816)>>2]|0;
    $309 = ($307>>>0)>=($308>>>0);
    $not$ = ($T$0$lcssa>>>0)>=($308>>>0);
    $310 = $309 & $not$;
    if ($310) {
     $311 = ((($307)) + 12|0);
     HEAP32[$311>>2] = $p$1;
     HEAP32[$306>>2] = $p$1;
     $312 = ((($p$1)) + 8|0);
     HEAP32[$312>>2] = $307;
     $313 = ((($p$1)) + 12|0);
     HEAP32[$313>>2] = $T$0$lcssa;
     $314 = ((($p$1)) + 24|0);
     HEAP32[$314>>2] = 0;
     break;
    } else {
     _abort();
     // unreachable;
    }
   }
  }
 } while(0);
 $315 = HEAP32[(39832)>>2]|0;
 $316 = (($315) + -1)|0;
 HEAP32[(39832)>>2] = $316;
 $317 = ($316|0)==(0);
 if ($317) {
  $sp$0$in$i = (40256);
 } else {
  return;
 }
 while(1) {
  $sp$0$i = HEAP32[$sp$0$in$i>>2]|0;
  $318 = ($sp$0$i|0)==(0|0);
  $319 = ((($sp$0$i)) + 8|0);
  if ($318) {
   break;
  } else {
   $sp$0$in$i = $319;
  }
 }
 HEAP32[(39832)>>2] = -1;
 return;
}
function runPostSets() {
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
    stop = (ptr + num)|0;
    if ((num|0) >= 20) {
      // This is unaligned, but quite large, so work hard to get to aligned settings
      value = value & 0xff;
      unaligned = ptr & 3;
      value4 = value | (value << 8) | (value << 16) | (value << 24);
      stop4 = stop & ~3;
      if (unaligned) {
        unaligned = (ptr + 4 - unaligned)|0;
        while ((ptr|0) < (unaligned|0)) { // no need to check for stop, since we have large num
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
      }
      while ((ptr|0) < (stop4|0)) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    while ((ptr|0) < (stop|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (ptr-num)|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    $rem = $rem | 0;
    var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
    $n_sroa_0_0_extract_trunc = $a$0;
    $n_sroa_1_4_extract_shift$0 = $a$1;
    $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
    $d_sroa_0_0_extract_trunc = $b$0;
    $d_sroa_1_4_extract_shift$0 = $b$1;
    $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
    if (($n_sroa_1_4_extract_trunc | 0) == 0) {
      $4 = ($rem | 0) != 0;
      if (($d_sroa_1_4_extract_trunc | 0) == 0) {
        if ($4) {
          HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$4) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
    $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
    do {
      if (($d_sroa_0_0_extract_trunc | 0) == 0) {
        if ($17) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
            HEAP32[$rem + 4 >> 2] = 0;
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        if (($n_sroa_0_0_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0;
            HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
        if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0 | $a$0 & -1;
            HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
          }
          $_0$1 = 0;
          $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($51 >>> 0 <= 30) {
          $57 = $51 + 1 | 0;
          $58 = 31 - $51 | 0;
          $sr_1_ph = $57;
          $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$17) {
          $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
          $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          if ($119 >>> 0 <= 31) {
            $125 = $119 + 1 | 0;
            $126 = 31 - $119 | 0;
            $130 = $119 - 31 >> 31;
            $sr_1_ph = $125;
            $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
            $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
            $q_sroa_0_1_ph = 0;
            $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
            break;
          }
          if (($rem | 0) == 0) {
            $_0$1 = 0;
            $_0$0 = 0;
            return (tempRet0 = $_0$1, $_0$0) | 0;
          }
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
        if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
          $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
          $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          $89 = 64 - $88 | 0;
          $91 = 32 - $88 | 0;
          $92 = $91 >> 31;
          $95 = $88 - 32 | 0;
          $105 = $95 >> 31;
          $sr_1_ph = $88;
          $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
          $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
          $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
          $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
          break;
        }
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
          HEAP32[$rem + 4 >> 2] = 0;
        }
        if (($d_sroa_0_0_extract_trunc | 0) == 1) {
          $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$0 = 0 | $a$0 & -1;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        } else {
          $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
          $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
          $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
      }
    } while (0);
    if (($sr_1_ph | 0) == 0) {
      $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
      $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
      $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
      $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = 0;
    } else {
      $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
      $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
      $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
      $137$1 = tempRet0;
      $q_sroa_1_1198 = $q_sroa_1_1_ph;
      $q_sroa_0_1199 = $q_sroa_0_1_ph;
      $r_sroa_1_1200 = $r_sroa_1_1_ph;
      $r_sroa_0_1201 = $r_sroa_0_1_ph;
      $sr_1202 = $sr_1_ph;
      $carry_0203 = 0;
      while (1) {
        $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
        $149 = $carry_0203 | $q_sroa_0_1199 << 1;
        $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
        $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
        _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
        $150$1 = tempRet0;
        $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
        $152 = $151$0 & 1;
        $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
        $r_sroa_0_0_extract_trunc = $154$0;
        $r_sroa_1_4_extract_trunc = tempRet0;
        $155 = $sr_1202 - 1 | 0;
        if (($155 | 0) == 0) {
          break;
        } else {
          $q_sroa_1_1198 = $147;
          $q_sroa_0_1199 = $149;
          $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
          $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
          $sr_1202 = $155;
          $carry_0203 = $152;
        }
      }
      $q_sroa_1_1_lcssa = $147;
      $q_sroa_0_1_lcssa = $149;
      $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
      $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = $152;
    }
    $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
    $q_sroa_0_0_insert_ext75$1 = 0;
    $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
    if (($rem | 0) != 0) {
      HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
      HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
    }
    $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
    $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $1$0 = 0;
    $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
    return $1$0 | 0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $rem = 0, __stackBase__ = 0;
    __stackBase__ = STACKTOP;
    STACKTOP = STACKTOP + 16 | 0;
    $rem = __stackBase__ | 0;
    ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
    STACKTOP = __stackBase__;
    return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if ((num|0) >= 4096) return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    ret = dest|0;
    if ((dest&3) == (src&3)) {
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      while ((num|0) >= 4) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
        num = (num-4)|0;
      }
    }
    while ((num|0) > 0) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
      num = (num-1)|0;
    }
    return ret|0;
}
function _pthread_self() {
    return 0;
}

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}


function dynCall_vi(index,a1) {
  index = index|0;
  a1=a1|0;
  FUNCTION_TABLE_vi[index&7](a1|0);
}

function b0(p0) {
 p0 = p0|0; nullFunc_ii(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(1);return 0;
}
function b2(p0) {
 p0 = p0|0; nullFunc_vi(2);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,b1,___stdio_write,___stdio_seek,___stdout_write,b1,b1,___stdio_read];
var FUNCTION_TABLE_vi = [b2,b2,b2,b2,b2,_cleanup_387,_cleanup_382,b2];

  return { _i64Subtract: _i64Subtract, _free: _free, _main: _main, _i64Add: _i64Add, _pthread_self: _pthread_self, _memset: _memset, _llvm_cttz_i32: _llvm_cttz_i32, _malloc: _malloc, _memcpy: _memcpy, _bitshift64Shl: _bitshift64Shl, _bitshift64Lshr: _bitshift64Lshr, _fflush: _fflush, ___udivdi3: ___udivdi3, ___uremdi3: ___uremdi3, ___errno_location: ___errno_location, ___udivmoddi4: ___udivmoddi4, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_vi: dynCall_vi };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Subtract.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__free.apply(null, arguments);
};

var real__main = asm["_main"]; asm["_main"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__main.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Add.apply(null, arguments);
};

var real____udivmoddi4 = asm["___udivmoddi4"]; asm["___udivmoddi4"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____udivmoddi4.apply(null, arguments);
};

var real__pthread_self = asm["_pthread_self"]; asm["_pthread_self"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__pthread_self.apply(null, arguments);
};

var real__llvm_cttz_i32 = asm["_llvm_cttz_i32"]; asm["_llvm_cttz_i32"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__llvm_cttz_i32.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__malloc.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Lshr.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__fflush.apply(null, arguments);
};

var real____udivdi3 = asm["___udivdi3"]; asm["___udivdi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____udivdi3.apply(null, arguments);
};

var real____uremdi3 = asm["___uremdi3"]; asm["___uremdi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____uremdi3.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____errno_location.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"]; asm["_bitshift64Shl"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Shl.apply(null, arguments);
};
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _free = Module["_free"] = asm["_free"];
var _main = Module["_main"] = asm["_main"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var ___udivmoddi4 = Module["___udivmoddi4"] = asm["___udivmoddi4"];
var _pthread_self = Module["_pthread_self"] = asm["_pthread_self"];
var _memset = Module["_memset"] = asm["_memset"];
var _llvm_cttz_i32 = Module["_llvm_cttz_i32"] = asm["_llvm_cttz_i32"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===





function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

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
  checkStackCookie();
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') implicitly called by end of main(), but noExitRuntime, so not exiting the runtime (you can use emscripten_force_exit, if you want to force a true shutdown)');
    return;
  }

  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)');
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}




};
