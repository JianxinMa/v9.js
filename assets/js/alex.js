/*jslint white:true browser:true maxlen:120 bitwise:true sloppy:true*/
/*global buffer, Uint8Array */

"use strict";

function createAlex(printOut, breakPoints, kernMainTag) {
  // page table bits
  var PTE_P = 0x001;
  var PTE_W = 0x002;
  var PTE_U = 0x004;
  var PTE_A = 0x020;
  var PTE_D = 0x040;

  // exceptions and interrupts
  var FMEM = 0x00;
  var FTIMER = 0x01;
  var FKEYBD = 0x02;
  var FPRIV = 0x03;
  var FINST = 0x04;
  var FSYSCL = 0x05;
  var FARITH = 0x06;
  var FIPAGE = 0x07;
  var FWPAGE = 0x08;
  var FRPAGE = 0x09;
  var USER = 0x10;

  // hardware
  var kbBuffer;
  var hdrMem;
  var hdrMemSz;
  var hdrTrK;
  var hdrTwK;
  var hdrTrU;
  var hdrTwU;
  var hdrTpage;

  // special registers
  var regTpageCnt;
  var regUser;
  var regIena;
  var regIpend;
  var regTrap;
  var regIvec;
  var regVadr;
  var regPaging;
  var regPdir;
  var regTr;
  var regTw;
  var regNextHdlr;
  var regToLoadInfo;
  var regInfoOffset;
  var regIr;
  var regXPc;
  var regTPc;
  var regFPc;
  var regXSp;
  var regTSp;
  var regFSP;
  var regSSp;
  var regUSp;
  var regCycle;
  var regXCycle;
  var regTimer;
  var regTimeOut;
  var regKbChar;
  var regFrameBase;

  // handlers
  var hdlrFatal; // fatal error, exit process
  var hdlrExcpt; // handle exception
  var hdlrItrpt; // handle interrupt
  var hdlrFixsp;
  var hdlrChkpc; // go on fetch instruction / hdlrFixpc
  var hdlrFixpc;
  var hdlrChkio;
  var hdlrInstr; // fetch instruction

  var executors;
  var cpuEvent;
  var infoPool;
  var currentInfo;

  // general registers (32 bits): store int32 value
  var regs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // general register alias
  var R0 = 0;
  var S0 = 1;
  var S1 = 2;
  var S2 = 3;
  var S3 = 4;
  var S4 = 5;
  var T0 = 6;
  var T1 = 7;
  var T2 = 8;
  var T3 = 9;
  var T4 = 10;
  var FP = 11;
  var SP = 12;
  var GP = 13;
  var AT = 14;
  var LR = 15;
  var I0 = 16; // simulator reserved
  var I1 = 17; // simulator reserved

  // floating-point registers (64 bits)
  var fregs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  function clearTLB() {
    var v;
    while (regTpageCnt) {
      regTpageCnt = regTpageCnt - 1;
      v = hdrTpage.readUInt32LE(regTpageCnt * 4);
      hdrTrK.writeUInt32LE(0, v * 4);
      hdrTwK.writeUInt32LE(0, v * 4);
      hdrTrU.writeUInt32LE(0, v * 4);
      hdrTwU.writeUInt32LE(0, v * 4);
    }
  }

  function pushTLB(v, p, writable, userable) {
    if (p >= hdrMemSz) {
      regTrap = FMEM;
      regVadr = v;
      return 0;
    }
    p = (((v ^ p) & -4096) + 1) >>> 0;
    v = v >>> 12;
    if (!hdrTrK.readUInt32LE(v * 4)) {
      if (regTpageCnt >= hdrTpage.length) {
        clearTLB();
      }
      hdrTpage.writeUInt32LE(v, regTpageCnt * 4);
      regTpageCnt = regTpageCnt + 1;
    }
    hdrTrK.writeUInt32LE(p, v * 4);
    hdrTwK.writeUInt32LE((writable ? p : 0), v * 4);
    hdrTrU.writeUInt32LE((userable ? p : 0), v * 4);
    hdrTwU.writeUInt32LE(((userable && writable) ? p : 0), v * 4);
    return p;
  }

  function pageLookR(v, noFault) {
    var pde, ppde, pte, ppte, q, userable;
    if (!regPaging) {
      return pushTLB(v, v, 1, 1);
    }
    ppde = regPdir + ((v >>> 22) << 2);
    pde = hdrMem.readUInt32LE(ppde);
    if (pde & PTE_P) {
      if (!(pde & PTE_A)) {
        hdrMem.writeUInt32LE(pde | PTE_A, ppde);
      }
      if (!noFault && pde >= hdrMemSz) {
        regTrap = FMEM;
        regVadr = v;
        return 0;
      }
      ppte = (pde & -4096) + ((v >>> 10) & 0xffc);
      pte = hdrMem.readUInt32LE(ppte);
      if (pte & PTE_P) {
        q = pte & pde;
        userable = q & PTE_U;
        if (userable || !regUser) {
          if (!(pte & PTE_A)) {
            hdrMem.writeUInt32LE(pte | PTE_A, ppte);
          }
          return pushTLB(v, pte, (pte & PTE_D) && (q & PTE_W),
            userable);
        }
      }
    }
    if (!noFault) {
      regTrap = FRPAGE;
      regVadr = v;
    }
    return 0;
  }

  function pageLookW(v) {
    var pde, ppde, pte, ppte, q, userable;
    if (!regPaging) {
      return pushTLB(v, v, 1, 1);
    }
    ppde = regPdir + ((v >>> 22) << 2);
    pde = hdrMem.readUInt32LE(ppde);
    if (pde & PTE_P) {
      if (!(pde & PTE_A)) {
        hdrMem.writeUInt32LE(pde | PTE_A, ppde);
      }
      if (pde >= hdrMemSz) {
        regTrap = FMEM;
        regVadr = v;
        return 0;
      }
      ppte = (pde & -4096) + ((v >>> 10) & 0xffc);
      pte = hdrMem.readUInt32LE(ppte);
      if (pte & PTE_P) {
        q = pte & pde;
        userable = q & PTE_U;
        if ((userable || !regUser) && (q & PTE_W)) {
          if ((pte & (PTE_D | PTE_A)) !== (PTE_D | PTE_A)) {
            hdrMem.writeUInt32LE(pte | (PTE_D | PTE_A), ppte);
          }
          return pushTLB(v, pte, q & PTE_W, userable);
        }
      }
    }
    regTrap = FWPAGE;
    regVadr = v;
    return 0;
  }

  // int32 -> int
  function getOpCode(ins) {
    return ins >>> 24;
  }

  function setupHardware() {
    var setupDecoder, setupLogic, setupMemory;

    var nextNormal = function () {
      regNextHdlr = hdlrChkpc;
      console.log('next normal');
    };

    // 1. executor

    // bool -> ((int32 -> obj) -> (obj -> (any -> unit) -> unit) -> [mf]) -> unit
    // where mf :: any -> (any -> unit) -> unit
    var pipeExecutor = function (flag) {
      return function (decode, exe, middlewares) {
        return function () {
          middlewares = middlewares || [nextNormal];

          /* implement a node-like middleware handler, each middleware is of type mf
           example:
           --var myMiddleware = function (data, next) {
           ----if (data == 0) {
           ------return; // stop here
           ----}
           ----next(data + 1); // go on executing next middleware with parameter `data`
           --}
           */
          var handleMiddlewares = function (data, middlewares) {
            var mwc = 0;
            var next = function (data) {
              if (mwc < middlewares.length) {
                (middlewares[mwc++])(data, next);
              }
            };
            // trigger the first middleware
            next(data);
          };

          var mws = [];
          if (flag) {
            mws.push(function (data, next) {
              if (regUser) { // if in user mode, then raise FPRIV
                regTrap = FPRIV;
                regNextHdlr = hdlrExcpt;
                return;
              }
              next(data);
            });
          }
          mws.push(function (data, next) {
            exe(decode(data), next);
          });
          mws = mws.concat(middlewares);
          handleMiddlewares(regIr, mws);
        };
      };
    };

    // executor for user mode
    var executor = pipeExecutor(false);

    // executor for kernel mode
    var kexecutor = pipeExecutor(true);

    // 2. decoders (R-type or I-type) and extenders (signed, unsigned, offset)

    // int32 -> obj
    var decodeRType = function (ins) {
      console.log('decode R, ins='+ins.toString(16));
      return {
        'ra': (ins >>> 20) & 0xF,
        'rb': (ins >>> 16) & 0xF,
        'rc': (ins >>> 12) & 0xF
      };
    };

    // (int32 -> int32) -> int32 -> obj
    var decodeIType = function (extend) {
      return function (ins) {
        console.log('decode I, ins='+ins.toString(16));
        return {
          'ra': (ins >>> 20) & 0xF,
          'rb': (ins >>> 16) & 0xF,
          'imm': extend(ins & 0xFFFF)
        };
      };
    };

    // int32 -> int32
    var ext32 = function (imm) {
      var buf = new buffer.Buffer(2);
      buf.writeUInt16LE(imm, 0, 2);
      return buf.readInt16LE(0, 2);
    };

    // int32 -> int32
    var uext32 = function (imm) {
      return imm;
    };

    // int32 -> int32
    var oext32 = function (imm) {
      return ext32(imm) << 2;
    };

    // int -> int32
    var getRegister = function (regIndex) {
      return regIndex == SP ? (regXSp - regTSp) << 0 : regs[regIndex];
    };

    // int32
    var getPC = function () {
      return (regXPc - regTPc) << 0;
    };

    // int -> int32 -> unit
    var writeRegister = function (regIndex, val) {
      if (regIndex === 0) {
        printOut(2, "Warning: trying to write register R0\n");
      } else if (regIndex == SP) {
        // NOTE: val == SP + (val - SP)
        var offset = val >>> 0 - getRegister(SP) >>> 0;
        if (regFSP) {
          regFSP = regFSP - offset;
          if (regFSP < 0 || regFSP > (4096 << 8)) {
            regFSP = 0;
          }
        }
        regXSp = regXSp + offset;
        if (regFSP) {
          return;
        }
        hdlrFixsp();
      } else {
        regs[regIndex] = val;
      }
      console.log('write reg '+regIndex+':='+val);
    };

    // 3. exe functions: for binary/branch/load/store/...

    // (int32 -> int32 -> int32) -> (obj -> unit -> unit)
    var exeBinR = function (op) {
      return function (args, next) {
        console.log('exe bin args='+JSON.stringify(args));
        writeRegister(args['ra'], op(getRegister(args['rb']), getRegister(args['rc'])));
        next();
      };
    };

    // (int32 -> int32 -> int32) -> (obj -> unit -> unit)
    var exeBinI = function (op) {
      return function (args, next) {
        console.log('exe bin args='+JSON.stringify(args));
        writeRegister(args['ra'], op(getRegister(args['rb']), args['imm']));
        next();
      };
    };

    // (int32 -> int32 -> int32) -> (obj -> unit -> unit)
    var exeBranch = function (tester) {
      return function (args, next) {
        if (tester(getRegister(args['ra']), getRegister(args['rb'])) == 1) { // jump
          next(args['imm']);
        } else { // not jump
          regNextHdlr = hdlrChkpc;
        }
      };
    };

    // (uint32 -> uint32 -> int32) -> (obj -> unit -> unit)
    var exeLoad = function (loader) {
      return function (args, next) {
        console.log('load args='+JSON.stringify(args));
        var p, v;
        v = add32(getRegister(args['rb']), args['imm']) >>> 0;
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
          p = pageLookR(v);
          if (!p) {
            regNextHdlr = hdlrExcpt;
            return;
          }
        }
        writeRegister(args['ra'], loader(v, p));
        next();
      };
    };

    // obj -> unit -> unit
    var exeFLoad = function (args, next) {
      var p, v;
      v = add32(getRegister(args['rb']), args['imm']) >>> 0;
      p = regTr.readUInt32LE((v >>> 12) * 4);
      if (!p) {
        p = pageLookR(v);
        if (!p) {
          regNextHdlr = hdlrExcpt;
          return;
        }
      }
      fregs[args['ra']] = hdrMem.readDoubleLE((v ^ p) & -8);
      next();
    };

    // (uint32 -> uint32 -> int32 -> unit) -> (obj -> unit -> unit)
    var exeStore = function (saver) {
      return function (args, next) {
        console.log('store args='+JSON.stringify(args));
        var p, v;
        v = add32(getRegister(args['rb']), args['imm']) >>> 0;
        p = regTw.readUInt32LE((v >>> 12) * 4);
        console.log('p='+p+', v='+v);
        if (!p) {
          p = pageLookW(v);
          if (!p) {
            regNextHdlr = hdlrExcpt;
            return;
          }
        }
        saver(v, p, getRegister(args['ra']));
        next();
      };
    };

    // obj -> unit -> unit
    var exeFStore = function (args, next) {
      var p, v;
      v = add32(getRegister(args['rb']), args['imm']) >>> 0;
      p = regTw.readUInt32LE((v >>> 12) * 4);
      if (!p) {
        p = pageLookW(v);
        if (!p) {
          regNextHdlr = hdlrExcpt;
          return;
        }
      }
      hdrMem.writeDoubleLE(fregs[args['ra']], (v ^ p) & -8);
      next();
    };

    // (float -> float -> float) -> (obj -> unit -> unit)
    var exeFloat = function (op) {
      return function (args, next) {
        fregs[args['ra']] = op(fregs[args['rb']], fregs[args['rc']]);
        next();
      };
    };

    // (float -> float -> bool) -> (obj -> unit -> unit)
    var exeFloatCmp = function (op) {
      return function (args, next) {
        writeRegister(args['ra'], op(fregs[args['rb']], fregs[args['rc']]) ? 1 : 0);
        next();
      };
    };

    // 4. jumper middlewares

    // int32 -> unit -> unit
    var offsetJumper = function (offset, next) {
      console.log('jump offset='+offset);
      regXCycle = (regXCycle + offset);
      regXPc = (regXPc + (offset >> 2) << 2);
      if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
        regNextHdlr = hdlrFixpc;
        return;
      }
      next();
    };

    // unit
    var nextJump = function () {
      regNextHdlr = hdlrChkio;
      console.log('next jump');
    };

    // int32 -> unit -> unit
    var addrJumper = function (addr, next) {
      console.log('jump addr='+addr);
      // NOTE: addr == PC + (addr - PC)
      var offset = addr >>> 0 - getPC() >>> 0;
      regXCycle = (regXCycle + offset);
      regXPc = (regXPc + (offset >> 2) << 2);
      if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
        regNextHdlr = hdlrFixpc;
        return;
      }
      next();
    };

    // 5. helper operators

    // 5.1 binary operators: int32 -> int32 -> int32

    var add32 = function (a, b) {
      return (a + b) << 0;
    };

    var sub32 = function (a, b) {
      return (a - b) << 0;
    };

    var mul32 = function (a, b) {
      return (a * b) << 0;
    };

    var div32 = function (a, b) {
      return (Math.floor(a / b)) << 0;
    };

    var divu32 = function (a, b) {
      return (Math.floor((a >>> 0) / (b >>> 0))) << 0;
    };

    var mod32 = function (a, b) {
      return (a % b) << 0;
    };

    var modu32 = function (a, b) {
      return ((a >>> 0) % (b >>> 0)) << 0;
    };

    var and32 = function (a, b) {
      return a & b;
    };

    var or32 = function (a, b) {
      return a | b;
    };

    var not32 = function (a) {
      return ~a;
    };

    var xor32 = function (a, b) {
      return a ^ b;
    };

    var shl32 = function (a, b) {
      return a << b;
    };

    var sar32 = function (a, b) {
      return a >> b;
    };

    var slr32 = function (a, b) {
      return a >>> b;
    };

    var eq32 = function (a, b) {
      return (a == b) ? 1 : 0;
    };

    var ne32 = function (a, b) {
      return (a != b) ? 1 : 0;
    };

    var lt32 = function (a, b) {
      return (a < b) ? 1 : 0;
    };

    var ltu32 = function (a, b) {
      return ((a >>> 0) < (b >>> 0)) ? 1 : 0;
    };

    var le32 = function (a, b) {
      return (a <= b) ? 1 : 0;
    };

    var leu32 = function (a, b) {
      return ((a >>> 0) <= (b >>> 0)) ? 1 : 0;
    };

    var gt32 = function (a, b) {
      return (a > b) ? 1 : 0;
    };

    var gtu32 = function (a, b) {
      return ((a >>> 0) > (b >>> 0)) ? 1 : 0;
    };

    var ge32 = function (a, b) {
      return (a >= b) ? 1 : 0;
    };

    var geu32 = function (a, b) {
      return ((a >>> 0) >= (b >>> 0)) ? 1 : 0;
    };

    var true32 = function () {
      return 1;
    };

    // 5.2 loaders: uint32 -> uint32 -> int32

    var loadWord = function (v, p) {
      return hdrMem.readInt32LE((v ^ p) & -4);
    };

    var loadHalf = function (v, p) {
      return hdrMem.readUInt16LE((v ^ p) & -2);
    };

    var loadByte = function (v, p) {
      return hdrMem.readUInt8(v ^ p & -2);
    };

    // 5.3 savers: uint32 -> uint32 -> int32 -> unit

    var storeWord = function (v, p, data) {
      hdrMem.writeInt32LE(data, (v ^ p) & -4);
    };

    var storeHalf = function (v, p, data) {
      hdrMem.writeUInt16LE(data & 0xFFFF, (v ^ p) & -2);
    };

    var storeByte = function (v, p, data) {
      hdrMem.writeUInt8(data & 0xFF, v ^ p & -2);
    };

    setupDecoder = function () {
      var i;
      executors = [];
      for (i = 0; i <= 0xFF; i++) {
        executors.push(function () {
          printOut(2, (getOpCode(regIr)).toString() + " not implemented!\n");
          regTrap = FINST;
          regNextHdlr = hdlrExcpt;
        });
      }
      executors[0x00] = executor(decodeRType, function () {});

      executors[0x01] = executor(decodeRType, exeBinR(add32));
      executors[0x02] = executor(decodeIType(ext32), exeBinI(add32));
      executors[0x03] = executor(decodeIType(uext32), exeBinI(add32));

      executors[0x04] = executor(decodeRType, exeBinR(sub32));
      executors[0x05] = executor(decodeIType(ext32), exeBinI(sub32));
      executors[0x06] = executor(decodeIType(uext32), exeBinI(sub32));

      executors[0x07] = executor(decodeRType, exeBinR(mul32));
      executors[0x08] = executor(decodeIType(ext32), exeBinI(mul32));
      executors[0x09] = executor(decodeIType(uext32), exeBinI(mul32));

      executors[0x0A] = executor(decodeRType, function (args, next) {
        if (getRegister(args['rc']) == 0) {
          regTrap = FARITH;
          regNextHdlr = hdlrExcpt;
          return;
        }
        next(args);
      }, [exeBinR(div32), nextNormal]);
      executors[0x0B] = executor(decodeIType(ext32), function (args, next) {
        if (args['imm'] == 0) {
          regTrap = FARITH;
          regNextHdlr = hdlrExcpt;
          return;
        }
        next(args);
      }, [exeBinI(div32), nextNormal]);
      executors[0x0C] = executor(decodeIType(uext32), function (args, next) {
        if (args['imm'] == 0) {
          regTrap = FARITH;
          regNextHdlr = hdlrExcpt;
          return;
        }
        next(args);
      }, [exeBinI(div32), nextNormal]);
      executors[0x43] = executor(decodeRType, function (args, next) {
        if (getRegister(args['rc']) == 0) {
          regTrap = FARITH;
          regNextHdlr = hdlrExcpt;
          return;
        }
        next(args);
      }, [exeBinR(divu32), nextNormal]);

      executors[0x0D] = executor(decodeRType, exeBinR(mod32));
      executors[0x0E] = executor(decodeIType(ext32), exeBinI(mod32));
      executors[0x0F] = executor(decodeIType(uext32), exeBinI(mod32));
      executors[0x44] = executor(decodeRType, exeBinR(modu32));

      executors[0x10] = executor(decodeRType, exeBinR(shl32));
      executors[0x11] = executor(decodeIType(uext32), exeBinI(shl32));

      executors[0x12] = executor(decodeRType, exeBinR(slr32));
      executors[0x13] = executor(decodeIType(uext32), exeBinI(slr32));

      executors[0x14] = executor(decodeRType, exeBinR(sar32));
      executors[0x15] = executor(decodeIType(uext32), exeBinI(sar32));

      executors[0x16] = executor(decodeRType, exeBinR(and32));
      executors[0x17] = executor(decodeRType, exeBinR(or32));
      executors[0x42] = executor(decodeIType(uext32), exeBinI(or32));
      executors[0x18] = executor(decodeRType, exeBinR(xor32));
      executors[0x19] = executor(decodeRType, exeBinR(not32));
      executors[0x1A] = executor(decodeRType, exeBinR(eq32));
      executors[0x1B] = executor(decodeRType, exeBinR(ne32));
      executors[0x1C] = executor(decodeRType, exeBinR(lt32));
      executors[0x1D] = executor(decodeRType, exeBinR(ltu32));
      executors[0x1E] = executor(decodeRType, exeBinR(gt32));
      executors[0x1F] = executor(decodeRType, exeBinR(gtu32));
      executors[0x20] = executor(decodeRType, exeBinR(le32));
      executors[0x21] = executor(decodeRType, exeBinR(leu32));
      executors[0x22] = executor(decodeRType, exeBinR(ge32));
      executors[0x23] = executor(decodeRType, exeBinR(geu32));

      executors[0x24] = executor(decodeIType(oext32), exeBranch(true32), [offsetJumper, nextJump]);
      executors[0x25] = executor(decodeIType(oext32), exeBranch(eq32), [offsetJumper, nextJump]);
      executors[0x26] = executor(decodeIType(oext32), exeBranch(ne32), [offsetJumper, nextJump]);
      executors[0x27] = executor(decodeIType(oext32), exeBranch(lt32), [offsetJumper, nextJump]);
      executors[0x28] = executor(decodeIType(oext32), exeBranch(gt32), [offsetJumper, nextJump]);

      executors[0x2A] = executor(decodeRType, function (args, next) {
        next(getRegister(args['ra']));
      }, [addrJumper, nextJump]);
      executors[0x2B] = executor(decodeRType, function (args, next) {
        writeRegister(I1, getRegister(args['ra'])); // ra
        writeRegister(I0, add32(getPC(), 4)); // PC + 4
        args['ra'] = I0;
        args['rb'] = SP;
        args['imm'] = -4;
        next(args);
      }, [
        exeStore(storeWord), // store(SP - 4, 4, PC + 4)
        function (data, next) {
          writeRegister(SP, sub32(getRegister(SP), 4)); // SP := SP - 4
          next(getRegister(I1));
        },
        addrJumper, // PC := ra
        nextJump
      ]);
      executors[0x2C] = executor(decodeRType, function (args, next) {
        args['ra'] = I0; // x
        args['rb'] = SP;
        args['imm'] = 0;
        next(args);
      }, [
        exeLoad(loadWord), // x := load(SP, 4)
        function (data, next) {
          writeRegister(SP, add32(getRegister(SP), 4)); // SP := SP + 4
          next(getRegister(I0));
        },
        addrJumper, // PC := x
        nextJump
      ]);

      executors[0x2D] = executor(decodeIType(ext32), exeLoad(loadWord));
      executors[0x2E] = executor(decodeIType(ext32), exeLoad(loadHalf));
      executors[0x2F] = executor(decodeIType(ext32), exeLoad(loadByte));
      executors[0x30] = executor(decodeIType(ext32), exeFLoad);

      executors[0x31] = executor(decodeIType(ext32), function (args, next) {
        console.log('exe LI args='+JSON.stringify(args));
        writeRegister(args['ra'], args['imm']);
        next();
      });
      executors[0x32] = executor(decodeIType(uext32), function (args, next) {
        console.log('exe LIU args='+JSON.stringify(args));
        writeRegister(args['ra'], args['imm']);
        next();
      });
      executors[0x33] = executor(decodeIType(uext32), function (args, next) {
        console.log('exe LIH args='+JSON.stringify(args));
        var tmp = or32(and32(getRegister(args['ra']), 0xFFFF), shl32(args['imm'], 16));
        writeRegister(args['ra'], tmp);
        next();
      });

      executors[0x34] = executor(decodeIType(ext32), exeStore(storeWord));
      executors[0x35] = executor(decodeIType(ext32), exeStore(storeHalf));
      executors[0x36] = executor(decodeIType(ext32), exeStore(storeByte));
      executors[0x37] = executor(decodeIType(ext32), exeFStore);

      executors[0x38] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = 0;
        next(args);
      }, [
        exeLoad(loadWord),
        function (data, next) {
          writeRegister(SP, add32(getRegister(SP), 4));
          next();
        },
        nextNormal
      ]);
      executors[0x39] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = 0;
        next(args);
      }, [
        exeLoad(loadHalf),
        function (data, next) {
          writeRegister(SP, add32(getRegister(SP), 2));
          next();
        },
        nextNormal
      ]);
      executors[0x3A] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = 0;
        next(args);
      }, [
        exeLoad(loadHalf),
        function (data, next) {
          writeRegister(SP, add32(getRegister(SP), 1));
          next();
        },
        nextNormal
      ]);
      executors[0x3B] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = 0;
        next(args);
      }, [
        exeFLoad,
        function (data, next) {
          writeRegister(SP, add32(getRegister(SP), 8));
          next();
        },
        nextNormal
      ]);
      executors[0x3C] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = 0;
        next(args);
      }, [
        exeLoad(loadWord),
        function (data, next) {
          writeRegister(SP, add32(getRegister(SP), 8));
          next();
        },
        nextNormal
      ]);

      executors[0x3D] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = -4;
        next(args);
      }, [
        exeStore(storeWord),
        function (data, next) {
          writeRegister(SP, sub32(getRegister(SP), 4));
          next();
        },
        nextNormal
      ]);
      executors[0x3E] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = -2;
        next(args);
      }, [
        exeStore(storeHalf),
        function (data, next) {
          writeRegister(SP, sub32(getRegister(SP), 2));
          next();
        },
        nextNormal
      ]);
      executors[0x3F] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = -1;
        next(args);
      }, [
        exeStore(storeByte),
        function (data, next) {
          writeRegister(SP, sub32(getRegister(SP), 1));
          next();
        },
        nextNormal
      ]);
      executors[0x40] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = -8;
        next(args);
      }, [
        exeFStore,
        function (data, next) {
          writeRegister(SP, sub32(getRegister(SP), 8));
          next();
        },
        nextNormal
      ]);
      executors[0x41] = executor(decodeRType, function (args, next) {
        args['rb'] = SP;
        args['imm'] = -8;
        next(args);
      }, [
        exeStore(storeWord),
        function (data, next) {
          writeRegister(SP, sub32(getRegister(SP), 8));
          next();
        },
        nextNormal
      ]);

      executors[0x45] = executor(decodeRType, function (args, next) {
        fregs[args['ra']] = getRegister(args['rb']);
        next();
      });
      executors[0x46] = executor(decodeRType, function (args, next) {
        fregs[args['ra']] = getRegister(args['rb']) >>> 0;
        next();
      });
      executors[0x47] = executor(decodeRType, function (args, next) {
        writeRegister(args['ra'], Math.floor(fregs[args['rb']]));
        next();
      });

      executors[0x48] = executor(decodeRType, exeFloat(function (a, b) {
        return a + b;
      }));
      executors[0x49] = executor(decodeRType, exeFloat(function (a, b) {
        return a - b;
      }));
      executors[0x4A] = executor(decodeRType, exeFloat(function (a, b) {
        return a * b;
      }));
      executors[0x4B] = executor(decodeRType, function (args, next) {
        if (fregs[args['rc']] == 0) {
          regTrap = FARITH;
          regNextHdlr = hdlrExcpt;
          return;
        }
        next(args);
      }, [
        exeFloat(function (a, b) {
          return a / b;
        }),
        nextNormal
      ]);
      executors[0x4C] = executor(decodeRType, exeFloat(function (a, b) {
        return a % b;
      }));

      executors[0x4D] = executor(decodeRType, exeFloatCmp(function (a, b) {
        return a == b;
      }));
      executors[0x4E] = executor(decodeRType, exeFloatCmp(function (a, b) {
        return a != b;
      }));
      executors[0x4F] = executor(decodeRType, exeFloatCmp(function (a, b) {
        return a < b;
      }));
      executors[0x50] = executor(decodeRType, exeFloatCmp(function (a, b) {
        return a > b;
      }));
      executors[0x51] = executor(decodeRType, exeFloatCmp(function (a, b) {
        return a <= b;
      }));
      executors[0x52] = executor(decodeRType, exeFloatCmp(function (a, b) {
        return a >= b;
      }));

      executors[0x53] = executor(decodeRType, exeFloat(function (a) {
        return Math.floor(a);
      }));
      executors[0x54] = executor(decodeRType, exeFloat(function (a) {
        return Math.ceil(a);
      }));

      // system
      executors[0x80] = kexecutor(decodeRType, function (args, next) {
        writeRegister(args['rb'], regKbChar);
        regKbChar = -1;
        next();
      });
      executors[0x81] = kexecutor(decodeRType, function (args, next) {
        writeRegister(args['rc'], printOut(getRegister(args['ra']), String.fromCharCode(getRegister(args['rb']))) ?
          1 : 0);
        next();
      });
      executors[0x82] = kexecutor(decodeRType, function (args, next) {
        writeRegister(args['ra'], regIvec);
        next();
      });
      executors[0x83] = kexecutor(decodeRType, function (args, next) {
        regIvec = getRegister(args['ra']);
        next();
      });
      executors[0x84] = kexecutor(decodeRType, function (args, next) {
        writeRegister(args['ra'], regPdir);
        next();
      });
      executors[0x85] = kexecutor(decodeRType, function (args, next) {
        if (getRegister(args['ra']) > hdrMemSz) {
          regTrap = FMEM;
          regNextHdlr = hdlrExcpt;
          return;
        }
        regPdir = getRegister(args['ra']) & -4096;
        clearTLB();
        regFSP = 0;
        regNextHdlr = hdlrFixpc;
      });
      executors[0x86] = kexecutor(decodeRType, function (args, next) {
        if (getRegister(args['ra']) == 0) { // clear
          regIena = 0;
          next();
        } else { // set
          if (regIpend) {
            regTrap = (regIpend & -regIpend);
            regIpend ^= regTrap;
            regIena = 0;
            regNextHdlr = hdlrItrpt;
            return;
          }
          regIena = 1;
          next();
        }
      });
      executors[0x87] = kexecutor(decodeRType, function (args, next) {
        if (getRegister(args['ra']) && !regPdir) {
          regTrap = FMEM;
          regNextHdlr = hdlrExcpt;
          return;
        }
        regPaging = getRegister(args['ra']);
        clearTLB();
        regFSP = 0;
        regNextHdlr = hdlrFixpc;
      });
      executors[0x88] = kexecutor(decodeRType, function (args, next) {
        writeRegister(args['ra'], regVadr);
        next();
      });
      executors[0x89] = kexecutor(decodeRType, function (args, next) {
        regTimeOut = getRegister(args['ra']);
        next();
      });
      executors[0x90] = kexecutor(decodeRType, function (args, next) {
        writeRegister(args['ra'], getPC());
        next();
      });
      executors[0x91] = kexecutor(decodeRType, function (args, next) {
        var flags = regIpend << 16; // fault code
        flags |= regUser ? 8 : 0; // user mode?
        flags |= regIena ? 4 : 0; // interrupt enabled?
        flags |= regPaging ? 1 : 0; // paging enabled?
        writeRegister(args['ra'], flags);
        next();
      });

      executors[0xF0] = executor(decodeRType, function (args, next) { // NOTE: can be executed from user mode
        regTrap = FSYSCL;
        regNextHdlr = hdlrExcpt;
      });
      executors[0xF1] = kexecutor(decodeRType, function (args, next) {
        var t, p, pc;
        if (regUser) {
          regTrap = FPRIV;
          regNextHdlr = hdlrExcpt;
          return;
        }
        regXSp = (regXSp - regTSp);
        regTSp = 0;
        regFSP = 0;
        p = (regTr.readUInt32LE((regXSp >>> 12) * 4));
        if (!p) {
          p = (pageLookR(regXSp));
          if (!p) {
            printOut(2, "IRET kstack fault\n");
            regNextHdlr = hdlrFatal;
            return;
          }
        }
        t = (hdrMem.readUInt32LE((regXSp ^ p) & -8));
        regXSp = regXSp + 8;
        p = (regTr.readUInt32LE((regXSp >>> 12) * 4));
        if (!p) {
          p = (pageLookR(regXSp));
          if (!p) {
            printOut(2, "IRET kstack fault\n");
            regNextHdlr = hdlrFatal;
            return;
          }
        }
        pc = (hdrMem.readUInt32LE((regXSp ^ p) & -8) + regTPc);
        regXCycle = (regXCycle + (pc - regXPc));
        regXSp = regXSp + 8;
        regXPc = pc;
        if (t & USER) {
          regSSp = regXSp;
          regXSp = regUSp;
          regUser = 1;
          regTr = hdrTrU;
          regTw = hdrTwU;
          regToLoadInfo = true;
        }
        if (!regIena) {
          if (regIpend) {
            regTrap = (regIpend & -regIpend);
            regIpend ^= regTrap;
            regNextHdlr = hdlrItrpt;
            return;
          }
          regIena = 1;
        }
        regNextHdlr = hdlrFixpc;
      });
      executors[0xFF] = function () {
        var tmp;
        if (regUser) {
          tmp = ((regCycle + ((regXPc - regXCycle) | 0) / 4) >>> 0);
          printOut(2, "halt: cycle = " + tmp.toString() + "\n");
        }
        regNextHdlr = 0;
      };
    };

    setupLogic = function () {
      hdlrFatal = function () {
        var hexStr, tmp;
        hexStr = function (x) {
          return ("00000000" + (x >>> 0).toString(16)).substr(-8);
        };
        tmp = ((regCycle + ((regXPc - regXCycle) | 0) / 4) >>> 0);
        var regsInfo = '';
        for (var i = 0; i < 15; i++) {
          regsInfo += ' regs[' + i + '] = ' + hexStr(regs[i]) + '\n';
        }
        printOut(2, "processor halted! cycle = " + tmp.toString() +
          "\n pc = " + hexStr(regXPc - regTPc) +
          "\n ir = " + hexStr(regIr) +
          "\n sp = " + hexStr(regXSp - regTSp) +
          '\n' + regsInfo +
          " trap = " + regTrap.toString() + "\n");
        regNextHdlr = 0;
      };
      hdlrExcpt = function () {
        if (!regIena) {
          printOut(2, "exception in interrupt handler\n");
          regNextHdlr = hdlrFatal;
        } else {
          regNextHdlr = hdlrItrpt;
        }
      };
      hdlrItrpt = function () {
        var p;
        currentInfo = infoPool[kernMainTag];
        regInfoOffset = 0;
        regXSp = regXSp - regTSp;
        regTSp = 0;
        regFSP = 0;
        if (regUser) {
          regUSp = regXSp;
          regXSp = regSSp;
          regUser = 0;
          regTr = hdrTrK;
          regTw = hdrTwK;
          regTrap = regTrap | USER;
        }
        regXSp = regXSp - 8;
        p = regTw.readUInt32LE((regXSp >>> 12) * 4);
        if (!p) {
          p = pageLookW(regXSp);
          if (!p) {
            printOut(2, "kstack fault!\n");
            regNextHdlr = hdlrFatal;
            return;
          }
        }
        hdrMem.writeUInt32LE((regXPc - regTPc) >>> 0,
          (regXSp ^ p) & -8);
        regXSp = regXSp - 8;
        p = regTw.readUInt32LE((regXSp >>> 12) * 4);
        if (!p) {
          p = pageLookW(regXSp);
          if (!p) {
            printOut(2, "kstack fault\n");
            regNextHdlr = hdlrFatal;
            return;
          }
        }
        hdrMem.writeUInt32LE(regTrap, (regXSp ^ p) & -8);
        regXCycle = regXCycle + regIvec + regTPc - regXPc;
        regXPc = regIvec + regTPc;
        regNextHdlr = hdlrFixpc;
      };
      hdlrFixsp = function () {
        var v, p;
        v = regXSp - regTSp;
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (p) {
          regXSp = v ^ (p - 1);
          regTSp = regXSp - v;
          regFSP = (4096 - (regXSp & 4095)) << 8;
        }
        regNextHdlr = hdlrChkpc;
      };
      hdlrChkpc = function () {
        if (regXPc === regFPc) {
          regNextHdlr = hdlrFixpc;
        } else {
          regNextHdlr = hdlrInstr;
        }
      };
      hdlrFixpc = function () {
        var v, p;
        v = regXPc - regTPc;
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
          p = pageLookR(v);
          if (!p) {
            regTrap = FIPAGE;
            regNextHdlr = hdlrExcpt;
            return;
          }
        }
        regXCycle = regXCycle - regTPc;
        regXPc = v ^ (p - 1);
        regTPc = regXPc - v;
        regXCycle = regXCycle + regTPc;
        regFPc = (regXPc + 4096) & -4096;
        regNextHdlr = hdlrChkio;
      };
      hdlrChkio = function () {
        var ch, tmp;
        if (regXPc > regXCycle) {
          regCycle = regCycle + 4096;
          regXCycle = regXCycle + 4096 * 4;
          if (regIena || !(regIpend & FKEYBD)) {
            ch = (kbBuffer[0] ? kbBuffer.shift() : -1);
            if (ch !== -1) {
              regKbChar = ch;
              if (regKbChar === '`'.charCodeAt(0)) {
                tmp = regCycle + ((regXPc - regXCycle) | 0) / 4;
                tmp = tmp >>> 0;
                printOut(2, "ungraceful exit. cycle = " +
                  tmp.toString() + '\n');
                regNextHdlr = 0;
                return;
              }
              if (regIena) {
                regTrap = FKEYBD;
                regIena = 0;
                regNextHdlr = hdlrItrpt;
                return;
              }
              regIpend = regIpend | FKEYBD;
            }
          }
          if (regTimeOut) {
            regTimer = regTimer + 4096;
            if (regTimer >= regTimeOut) {
              regTimer = 0;
              if (regIena) {
                regTrap = FTIMER;
                regIena = 0;
                regNextHdlr = hdlrItrpt;
                return;
              }
              regIpend = regIpend | FTIMER;
            }
          }
        }
        regNextHdlr = hdlrInstr;
      };
      hdlrInstr = function () {
        regIr = hdrMem.readUInt32LE(regXPc);
        regXPc = regXPc + 4;
        console.log('regs='+regs);
        console.log('fetch ins='+regIr.toString(16));
        (executors[getOpCode(regIr)])();
      };
    };
    setupMemory = function () {
      hdrMemSz = 128 * 1024 * 1024;
      hdrMem = new buffer.Buffer(hdrMemSz);
      hdrTrK = new buffer.Buffer(1024 * 1024 * 4);
      hdrTwK = new buffer.Buffer(1024 * 1024 * 4);
      hdrTrU = new buffer.Buffer(1024 * 1024 * 4);
      hdrTwU = new buffer.Buffer(1024 * 1024 * 4);
      hdrTpage = new buffer.Buffer(4096 * 4);
    };
    setupDecoder();
    setupLogic();
    setupMemory();
    cpuEvent = 0;
    regNextHdlr = 0;
  } // end setupHardware

  function setupSoftware(abOS, abFS, infoStr) {
    var cleanMemory, wipeMemory, wipeRegs, readInfo;
    cleanMemory = function () {
      hdrMem.fill(0);
      hdrTrK.fill(0);
      hdrTwK.fill(0);
      hdrTrU.fill(0);
      hdrTwU.fill(0);
      hdrTpage.fill(0);
    };
    wipeMemory = function () {
      var i, j, diskSz, hdr, view;
      diskSz = 4 * 1024 * 1024;
      view = new Uint8Array(abFS);
      j = abFS.byteLength;
      for (i = 0; i < j; i = i + 1) {
        hdrMem[hdrMemSz - diskSz + i] = view[i];
      }
      hdr = new buffer.Buffer(16);
      view = new Uint8Array(abOS);
      j = abOS.byteLength;
      for (i = 0; i < 16; i = i + 1) {
        hdr[i] = view[i];
        hdrMem[i] = view[i]; // XXX
      }
      for (i = 16; i < j; i = i + 1) {
        // XXX hdrMem[i - 16] = view[i];
        hdrMem[i] = view[i];
      }
      hdr = {
        magic: hdr.readUInt32LE(0),
        bss: hdr.readUInt32LE(4),
        entry: hdr.readUInt32LE(8),
        flags: hdr.readUInt32LE(12)
      };
      if (hdr.magic !== 0xC0DEF00D) {
        printOut(2, "bad hdr.magic\n");
      }
      regXPc = 0;
      regTPc = -hdr.entry;
      regFPc = 0;
      regXSp = hdrMemSz - diskSz;
      regTSp = 0;
      regFSP = 0;
    };
    wipeRegs = function () {
      regs = regs.map(function () {
        return 0;
      });
      fregs = fregs.map(function () {
        return 0;
      });
      regIr = 0;
      regCycle = 4096;
      regXCycle = 4096 * 4;
      regTimer = 0;
      regTimeOut = 0;
      regSSp = 0;
      regUSp = 0;
      regKbChar = -1;
      kbBuffer = [];
      regUser = 0;
      regIena = 0;
      regIpend = 0;
      regTrap = 0;
      regIvec = 0;
      regVadr = 0;
      regPaging = 0;
      regPdir = 0;
      regTpageCnt = 0;
      regTr = hdrTrK;
      regTw = hdrTwK;
      regNextHdlr = hdlrFixpc;
      regFrameBase = [];
    };
    readInfo = function () {
      var program, locals, split, addVarInfo;
      split = function (s) {
        return s.split(' ').filter(function (m) {
          return m.length > 0;
        });
      };
      addVarInfo = function (varSet, line) {
        line = split(line);
        varSet[line[1]] = {
          space: line[2],
          offset: Number(line[3]),
          type: line[4]
        };
      };
      infoPool = {};
      infoStr.split('\n').forEach(function (line) {
        var tmp;
        line = line.trim();
        if (line.length > 0 && line[0] !== '#') {
          if (line[0] === '=') {
            program = line.substr(2);
            infoPool[program] = {};
            infoPool[program].globals = {};
            infoPool[program].structs = {};
            infoPool[program].asms = {};
            infoPool[program].isEntry = {};
          } else if (line.startsWith('.data')) {
            infoPool[program].data = Number(split(line)[1]);
          } else if (line.startsWith('.bss')) {
            infoPool[program].bss = Number(split(line)[1]);
          } else if (line[0] === 'd') {
            tmp = split(line);
            infoPool[program].structs[tmp[2]] = tmp[3];
          } else if (line[0] === 'g') {
            addVarInfo(infoPool[program].globals, line);
          } else if (line[0] === '>' || line[0] === '<') {
            locals = {};
            tmp = Number(line.substr(2));
            infoPool[program].isEntry[tmp] = true;
          } else if (line[0] === 'l') {
            addVarInfo(locals, line);
          } else if (line[0] === 'i') {
            tmp = split(line);
            infoPool[program].asms[Number(tmp[1])] = {
              point: tmp[2] + ' ' + tmp[3],
              locals: locals
            };
          } else {
            console.log('In readInfo: unsupported', line);
          }
        }
      });
      currentInfo = infoPool[kernMainTag];
      regInfoOffset = 0;
      regToLoadInfo = false;
    };
    cleanMemory();
    wipeMemory();
    wipeRegs();
    readInfo();
  }

  function unsignRegs() {
    regXPc >>>= 0;
    regTPc >>>= 0;
    regFPc >>>= 0;
    regXSp >>>= 0;
    regTSp >>>= 0;
    regFSP >>>= 0;
    regSSp >>>= 0;
    regUSp >>>= 0;
    regCycle >>>= 0;
    regXCycle >>>= 0;
    regTimer >>>= 0;
    regTimeOut >>>= 0;
    regTrap >>>= 0;
  }

  function loadUserProcInfo() {
    var p, v, s, t, m;
    regToLoadInfo = false;
    v = 16;
    p = regTr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
      p = pageLookR(v);
      if (!p) {
        regNextHdlr = hdlrExcpt;
        return;
      }
    }
    p = ((v ^ p) & -4) >>> 0;
    m = hdrMem.readUInt32LE(p);
    if (m === 0xff2017ff) {
      s = '';
      p = p + 4;
      while (true) {
        t = hdrMem.readUInt8(p);
        if (0 < t && t <= 0x7F) {
          s = s + String.fromCharCode(t);
          p = p + 1;
        } else {
          break;
        }
      }
      regInfoOffset = -16;
    } else if (m === 0xff2016ff) {
      s = kernMainTag;
      regInfoOffset = hdrMem.readUInt32LE(p - 16);
    } else {
      console.log('In loadUserProcInfo: bad m', '0x' + m.toString(16));
    }
    if (infoPool[s]) {
      currentInfo = infoPool[s];
    } else {
      console.log('In loadUserProcInfo: bad s', s);
    }
    regNextHdlr = hdlrChkpc;
    return;
  }

  function pauseRunning() {
    if (cpuEvent !== 0) {
      clearInterval(cpuEvent);
      cpuEvent = 0;
    }
  }

  function forceInit() {
    pauseRunning();
    regNextHdlr = 0;
  }

  function runSingleStep(cb, continuing) {
    var fst, nxt, addr, localDefs;
    if (!continuing) {
      pauseRunning();
    }
    while (true) {
      unsignRegs();
      if (regNextHdlr === 0) {
        pauseRunning();
        cb();
        return;
      }
      if (regToLoadInfo && regNextHdlr === hdlrInstr) {
        loadUserProcInfo();
      } else {
        if (regNextHdlr === hdlrInstr) {
          if (!regUser && currentInfo === infoPool[kernMainTag]) {
            addr = regXPc >>> 0;
          } else {
            addr = (regXPc - regTPc) >>> 0;
          }
          addr += regInfoOffset;
          if (currentInfo.asms[addr]) {
            if (currentInfo.isEntry[addr]) {
              regFrameBase.push((regXSp - regTSp) >>> 0);
            }
            if ((executors[getOpCode(hdrMem.readUInt32LE(regXPc))]) ===
              execLEV) {
              regFrameBase.pop();
            }
            localDefs = currentInfo.asms[addr].locals;
            nxt = currentInfo.asms[addr].point;
            if (!fst) {
              fst = nxt;
            }
            if (nxt !== fst) {
              break;
            }
          } else {
            if (hdrMem.readUInt32LE(regXPc) !== 0x2a9) {
              console.log('In runSingleStep: 0x2a9 expected');
            }
          }
        }
        regNextHdlr();
      }
    }
    cb(nxt, localDefs, currentInfo.globals);
  }

  function runUntilBreak(cb, ignoreBreaks) {
    var singleStepCb, ignoreNxtBreak, quitting;
    pauseRunning();
    singleStepCb = function (point, localDefs) {
      if (!point) {
        pauseRunning();
        cb();
        quitting = true;
        return;
      }
      if (!ignoreNxtBreak && breakPoints[point]) {
        pauseRunning();
        cb(point, localDefs, currentInfo.globals);
        quitting = true;
        return;
      }
    };
    ignoreNxtBreak = true;
    cpuEvent = setInterval(function () {
      var i;
      quitting = false;
      for (i = 0; i < (1 << 14); i = i + 1) {
        runSingleStep(singleStepCb, true);
        ignoreNxtBreak = ignoreBreaks;
        if (quitting) {
          break;
        }
      }
    }, 50);
  }

  function runNonStop(cb) {
    runUntilBreak(cb, true);
  }

  function runNonDebug(cb) {
    cpuEvent = setInterval(function() {
      var i;
      for (i = 0; i < (1 << 21); i = i + 1) {
        if (regNextHdlr === 0) {
          pauseRunning();
          cb();
          return;
        }
        unsignRegs();
        regNextHdlr();
      }
    }, 50);
  }

  function writeKbBuf(c) {
    kbBuffer.push(c);
  }

  function needInit() {
    return regNextHdlr === 0;
  }

  function getVirtAddr(space, offset) {
    var v;
    if (space === 'stk') {
      v = regFrameBase[regFrameBase.length - 1];
    } else if (space === 'dat') {
      v = currentInfo.data - regInfoOffset;
    } else if (space === 'bss') {
      v = currentInfo.bss - regInfoOffset;
    } else {
      console.log('In showVars: unexpected location', space);
    }
    return v + offset;
  }

  function readBaseType(v, baseType) {
    var p;
    p = regTr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
      p = pageLookR(v, true);
      if (!p) {
        return '[PAGE FAULT]';
      }
    }
    if (baseType === 'char') {
      return hdrMem.readInt8(v ^ p & -2);
    }
    if (baseType === 'short') {
      return hdrMem.readInt16LE((v ^ p) & -2);
    }
    if (baseType === 'int') {
      return hdrMem.readInt32LE((v ^ p) & -4);
    }
    if (baseType === 'uchar') {
      return hdrMem.readUInt8(v ^ p & -2);
    }
    if (baseType === 'ushort') {
      return hdrMem.readUInt16LE((v ^ p) & -2);
    }
    if (baseType === 'uint') {
      return hdrMem.readUInt32LE((v ^ p) & -4);
    }
    if (baseType === 'float') {
      return hdrMem.readFloatLE((v ^ p) & -4);
    }
    if (baseType === 'double') {
      return hdrMem.readDoubleLE((v ^ p) & -8);
    }
    console.log('In readBaseType: bad base type', baseType);
    return '[BAD TYPE]';
  }

  function getStructType(name) {
    return currentInfo.structs[name];
  }

  setupHardware();
  return {
    setupSoftware: setupSoftware,
    forceInit: forceInit,
    runNonStop: runNonStop,
    runSingleStep: runSingleStep,
    runUntilBreak: runUntilBreak,
    runNonDebug: runNonDebug,
    writeKbBuf: writeKbBuf,
    needInit: needInit,
    getVirtAddr: getVirtAddr,
    readBaseType: readBaseType,
    getStructType: getStructType
  };
}
