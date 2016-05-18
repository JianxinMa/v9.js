/*jslint white:true browser:true maxlen:80 bitwise:true */
/*global buffer, Uint8Array */

"use strict";

function createAlex(printOut, breakPoints) {
  var PTE_P = 0x001,
    PTE_W = 0x002,
    PTE_U = 0x004,
    PTE_A = 0x020,
    PTE_D = 0x040,
    FMEM = 0x00,
    FTIMER = 0x01,
    FKEYBD = 0x02,
    FPRIV = 0x03,
    FINST = 0x04,
    FSYSCL = 0x05,
    FARITH = 0x06,
    FIPAGE = 0x07,
    FWPAGE = 0x08,
    FRPAGE = 0x09,
    USER = 0x10,
    kbBuffer,
    hdrMem,
    hdrMemSz,
    hdrTrK,
    hdrTwK,
    hdrTrU,
    hdrTwU,
    hdrTpage,
    regTpageCnt,
    regUser,
    regIena,
    regIpend,
    regTrap,
    regIvec,
    regVadr,
    regPaging,
    regPdir,
    regTr,
    regTw,
    regNextHdlr,
    regToLoadInfo,
    regInfoOffset,
    regA,
    regB,
    regC,
    regF,
    regG,
    regIr,
    regXPc,
    regTPc,
    regFPc,
    regXSp,
    regTSp,
    regFSP,
    regSSp,
    regUSp,
    regCycle,
    regXCycle,
    regTimer,
    regTimeOut,
    regKbChar,
    regFrameBase,
    executors,
    hdlrFatal,
    hdlrExcpt,
    hdlrItrpt,
    hdlrFixsp,
    hdlrChkpc,
    hdlrFixpc,
    hdlrChkio,
    hdlrInstr,
    cpuEvent,
    infoPool,
    currentInfo;

  var regs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var R0 = 0,
    S0 = 1,
    S1 = 2,
    S2 = 3,
    S3 = 4,
    S4 = 5,
    T0 = 6,
    T1 = 7,
    T2 = 8,
    T3 = 9,
    T4 = 10,
    FP = 11,
    SP = 12,
    GP = 13,
    AT = 14,
    LR = 15;
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

  function execDefault() {
    printOut(2, (regIr & 0xFF).toString() + " not implemented!\n");
    regTrap = FINST;
    regNextHdlr = hdlrExcpt;
    return;
  }

  // int32 -> int
  function getOpCode(ins) {
    return ins >>> 24;
  }

  function setupHardware() {
    var setupDecoder, setupLogic, setupMemory;

    // (str -> obj) -> (obj -> (any -> unit) -> unit) -> [any -> (any -> unit) -> unit] -> unit
    var executor = function (decode, exe, middlewares) {
      middlewares = middlewares || [function (data, next) {
          regNextHdlr = hdlrChkpc;
        }];

      /* implement a node-like middleware handler, each middleware is of type any -> (any -> unit) -> unit
       example:
       var myMiddleware = function (data, next) {
       if (data == 0) {
       return 0;
       }
       next(data + 1);
       }
       */
      var handleMiddlewares = function (data, middlewares) {
        var i = 0;
        var next = function (data) {
          if (i < middlewares.length) {
            middlewares[i++](data, next);
          }
        };
        // trigger the first middleware
        next(data);
      };

      var mws = [function (data, next) {
        exe(decode(data), next);
      }];
      mws.extend(middlewares);
      handleMiddlewares(regIr, mws);
    };

    // 2. candidate decoders: decode either R-type or I-type
    var decodeRType = function (ins) {
      return {
        'ra': (ins >>> 20) & 0xF,
        'rb': (ins >>> 16) & 0xF,
        'rc': (ins >>> 12) & 0xF
      };
    };

    var decodeIType = function (extend) {
      return function (ins) {
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

    // int -> int32 -> unit
    var writeRegister = function (regIndex, val) {
      if (regIndex == 0) {
        printOut("Warning: trying to write register R0");
      } else {
        regs[regIndex] = val;
      }
    };

    // candidate exe functions: for binary/branch/load/store/...

    // (int32 -> int32 -> int32) -> (obj -> unit -> unit)
    var exeBinR = function (op) {
      return function (args, next) {
        writeRegister(args['ra'], op(regs[args['rb']], regs[args['rc']]));
        next();
      };
    };

    // (int32 -> int32 -> int32) -> (obj -> unit -> unit)
    var exeBinI = function (op) {
      return function (args, next) {
        writeRegister(args['ra'], op(regs[args['rb']], args['imm']));
        next();
      };
    };

    // (int32 -> int32 -> int32) -> (obj -> unit -> unit)
    var exeBranch = function (tester) {
      return function (args, next) {
        if (tester(regs[args['ra']], regs[args['rb']]) == 1) { // jump
          next(regs[args['imm']]);
        } else { // not jump
          regNextHdlr = hdlrChkpc;
        }
      };
    };

    // (int32 -> int32) -> (obj -> bool)
    var exeLoad = function (loader) {
      return function (args, next) {
        var p, v;
        v = regA + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
          p = pageLookR(v);
          if (!p) { // has exception
            next();
          }
        }
        writeRegister(args['ra'], loader(add32(regs[args['rb']], args['imm'])));
        return true;
      };
    };

    // (int32 -> int32 -> unit) -> (obj -> bool)
    var exeStore = function (saver) {
      return function (args, next) {
        var p, v;
        v = add32(regs[args['rb']], args['imm']);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
          p = pageLookW(v);
          if (!p) {
            next();
          }
        }
        saver(regs[args['ra']], v ^ p);
        hdrMem.writeUInt32LE(regA, (v ^ p) & -4);
      };
    };


    // int32 -> unit -> unit
    var offsetJumper = function (offset, next) {
      regXCycle = (regXCycle + offset);
      regXPc = (regXPc + (offset >> 2) << 2);
      if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
        regNextHdlr = hdlrFixpc;
        return;
      }
      next();
    };

    var nextJump = function () {
      regNextHdlr = hdlrChkio;
    };

    // int32 -> unit -> unit
    var addrJumper = function (addr, next) {
      regXCycle = addr;
      regXPc = addr;
      if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
        regNextHdlr = hdlrFixpc;
        return;
      }
      next();
    };

    // bool -> unit
    var excptJumper = function (hasExcpt) {
      if (hasExcpt) {
        regNextHdlr = hdlrExcpt;
        return;
      }
      regNextHdlr = hdlrChkpc;
    };

    // binary operators: int32 -> int32 -> int32
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

    var not32 = function t32(a) {
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

    setupDecoder = function () {
      var i;
      executors = [];
      for (i = 0; i <= 0xFF; i = i + 1) {
        executors.push(execDefault);
      }
      executors[0x00] = function () {
      };
      executors[0x01] = executor(decodeRType, exeBinR(add32));
      executors[0x02] = executor(decodeIType(ext32), exeBinI(add32));
      executors[0x03] = executor(decodeIType(uext32), exeBinI(add32));

      executors[0x04] = executor(decodeRType, exeBinR(sub32));
      executors[0x05] = executor(decodeIType(ext32), exeBinI(sub32));
      executors[0x06] = executor(decodeIType(uext32), exeBinI(sub32));

      executors[0x07] = executor(decodeRType, exeBinR(mul32));
      executors[0x08] = executor(decodeIType(ext32), exeBinI(mul32));
      executors[0x09] = executor(decodeIType(uext32), exeBinI(mul32));

      executors[0x0A] = executor(decodeRType, exeBinR(div32));
      executors[0x0B] = executor(decodeIType(ext32), exeBinI(div32));
      executors[0x0C] = executor(decodeIType(uext32), exeBinI(div32));
      executors[0x43] = executor(decodeRType, exeBinR(divu32));

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

      executors[0x24] = executor(decodeIType(oext32), exeBranch(true32), offsetJumper, nextJump);
      executors[0x25] = executor(decodeIType(oext32), exeBranch(eq32), offsetJumper, nextJump);
      executors[0x26] = executor(decodeIType(oext32), exeBranch(ne32), offsetJumper, nextJump);
      executors[0x27] = executor(decodeIType(oext32), exeBranch(lt32), offsetJumper, nextJump);
      executors[0x28] = executor(decodeIType(oext32), exeBranch(gt32), offsetJumper, nextJump);

      executors[0x2A] = executor(decodeRType, function (args, next) {
        next(regs[args['ra']]);
      }, addrJumper, nextJump);
      executors[0x2B] = executor(decodeRType, function (args, next) {
        var data = regXPc + 4;
        writeRegister(SP, sub32(regs[SP], 4));
        bin.storeWord(cpu.getRegister(cpu.Regs.SP), data, mem);
        next(regs[args['ra']]);
      }, addrJumper, nextJump);
      executors[0x2C] = executor(decodeRType, function (args, next) {
        var buf = bin.loadWord(cpu.getRegister(cpu.Regs.SP), mem);
        regs[cpu.Regs.SP] = bin.add32(regs[cpu.Regs.SP], bin.four32);
        next(buf);
      }, addrJumper, nextJump);

      executors[0x2D] = executor(decodeIType(ext32), exeLoad(bin.loadWord));
      executors[0x2E] = executor(decodeIType(ext32), exeLoad(bin.loadHalf));
      executors[0x2F] = executor(decodeIType(ext32), exeLoad(bin.loadByte));
      executors[0x30] = executor(decodeIType(ext32), exeLoad(bin.loadFloat));

      executors[0x31] = executor(decodeIType(ext32), function (args, next) {
        writeRegister(args['ra'], args['imm']);
        next();
      });
      executors[0x32] = executor(decodeIType(uext32), function (args, next) {
        writeRegister(args['ra'], args['imm']);
        next();
      });
      executors[0x33] = executor(decodeIType(uext32), function (args, next) {
        writeRegister(args['ra'], or32(and32(regs[args['ra']], 0xFFFF)), shl32(args['imm'], 16));
        next();
      });

      executors[0x34] = executor(decodeIType(ext32), exeStore(bin.storeWord));
      executors[0x35] = executor(decodeIType(ext32), exeStore(bin.storeHalf));
      executors[0x36] = executor(decodeIType(ext32), exeStore(bin.storeByte));
      executors[0x37] = executor(decodeIType(ext32), exeStore(bin.storeFloat));

      executors[0x38] = executor(decodeRType, exePop(loadWord, 4));
      executors[0x39] = executor(decodeRType, exePop(loadHalf, 2));
      executors[0x3A] = executor(decodeRType, exePop(loadByte, 1));
      executors[0x3B] = executor(decodeRType, exePop(loadFloat, 8));
      executors[0x3C] = executor(decodeRType, exePop(loadWord, 8));

      executors[0x3D] = executor(decodeRType, exePush(storeWord, 4));
      executors[0x3E] = executor(decodeRType, exePush(storeHalf, 2));
      executors[0x3F] = executor(decodeRType, exePush(storeByte, 1));
      executors[0x40] = executor(decodeRType, exePush(storeFloat, 8));
      executors[0x41] = executor(decodeRType, exePush(storeWord, 8));

      executors[0x45] = executor(decodeRType, function (args) {
        fregs[args['ra']] = regs[args['rb']];
      });
      executors[0x46] = executor(decodeRType, function (args) {
        fregs[args['ra']] = (regs[args['rb']]) >>> 0;
      });
      executors[0x47] = executor(decodeRType, function (args) {
        regs[args['ra']] = Math.floor(fregs[args['rb']]);
      });
    };

    setupLogic = function () {
      hdlrFatal = function () {
        var hexStr, tmp;
        hexStr = function (x) {
          return ("00000000" + (x >>> 0).toString(16)).substr(-8);
        };
        tmp = ((regCycle + ((regXPc - regXCycle) | 0) / 4) >>> 0);
        printOut(2, "processor halted! cycle = " + tmp.toString() +
          " pc = " + hexStr(regXPc - regTPc) +
          " ir = " + hexStr(regIr) +
          " sp = " + hexStr(regXSp - regTSp) +
          " a = " + regA.toString() +
          " b = " + regB.toString() +
          " c = " + regC.toString() +
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
        currentInfo = infoPool['root/etc/os.c'];
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
        (executors[getOpCode(regIr)])();
      };
    };
    setupMemory = function () {
      hdrMemSz = 64 * 1024 * 1024;
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
      }
      for (i = 16; i < j; i = i + 1) {
        hdrMem[i - 16] = view[i];
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
      regA = 0;
      regB = 0;
      regC = 0;
      regF = 0.0;
      regG = 0.0;
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
          } else if (line[0] === '>') {
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
      currentInfo = infoPool['root/etc/os.c'];
      regInfoOffset = 0;
      regToLoadInfo = false;
    };
    cleanMemory();
    wipeMemory();
    wipeRegs();
    readInfo();
  }

  function unsignRegs() {
    regA >>>= 0;
    regB >>>= 0;
    regC >>>= 0;
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
      s = 'root/etc/os.c';
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
          if (!regUser && currentInfo === infoPool['root/etc/os.c']) {
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
    pauseRunning: pauseRunning,
    runNonStop: runNonStop,
    runSingleStep: runSingleStep,
    runUntilBreak: runUntilBreak,
    writeKbBuf: writeKbBuf,
    needInit: needInit,
    getVirtAddr: getVirtAddr,
    readBaseType: readBaseType,
    getStructType: getStructType
  };
}
