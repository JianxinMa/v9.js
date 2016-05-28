/*jslint white:true browser:true maxlen:80 bitwise:true */
/*global buffer, Uint8Array */

"use strict";

function createV9(printOut, breakPoints, kernMainTag) {
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

    function execHALT() {
        var tmp;
        if (regUser) {
            tmp = ((regCycle + ((regXPc - regXCycle) | 0) / 4) >>> 0);
            printOut(2, "halt(" + regA.toString() + ") cycle = " +
                tmp.toString() + "\n");
        }
        regNextHdlr = 0;
        return;
    }

    function execIDLE() {
        var ch, tmp;
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        if (!regIena) {
            regTrap = FINST;
            regNextHdlr = hdlrExcpt;
            return;
        }
        while (true) {
            ch = (kbBuffer[0] ? kbBuffer.shift() : -1);
            if (ch !== -1) {
                regKbChar = ch;
                if (regKbChar === '`'.charCodeAt(0)) {
                    tmp = ((regCycle + ((regXPc - regXCycle) | 0) / 4) >>> 0);
                    printOut(2, "ungraceful exit. cycle = " +
                        tmp.toString() + "\n");
                    regNextHdlr = 0;
                    return;
                }
                regTrap = FKEYBD;
                regIena = 0;
                regNextHdlr = hdlrItrpt;
                return;
            }
            regCycle = regCycle + 4096;
            if (regTimeOut) {
                regTimer = regTimer + 4096;
                if (regTimer >= regTimeOut) {
                    regTimer = 0;
                    regTrap = FTIMER;
                    regIena = 0;
                    regNextHdlr = hdlrItrpt;
                    return;
                }
            }
        }
        regNextHdlr = hdlrExcpt;
        return;
    }

    function execMCPY() {
        var t, p, u, v;
        while (regC) {
            t = regTr.readUInt32LE((regB >>> 12) * 4);
            if (!t) {
                t = pageLookR(regB);
                if (!t) {
                    regNextHdlr = hdlrExcpt;
                    return;
                }
            }
            p = regTw.readUInt32LE((regA >>> 12) * 4);
            if (!p) {
                p = pageLookW(regA);
                if (!p) {
                    regNextHdlr = hdlrExcpt;
                    return;
                }
            }
            v = 4096 - (regA & 4095);
            if (v > regC) {
                v = regC;
            }
            u = 4096 - (regB & 4095);
            if (u > v) {
                u = v;
            }
            p = regA ^ (p & -2);
            t = regB ^ (t & -2);
            hdrMem.copy(hdrMem, p, t, t + u);
            regA = regA + u;
            regB = regB + u;
            regC = regC - u;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMCMP() {
        var t, p, u, v, memCmp;
        memCmp = function(arrA, arrB) {
            var i, j, x, y;
            j = arrA.length;
            i = arrB.length;
            if (j > i) {
                j = i;
            }
            for (i = 0; i < j; i = i + 1) {
                x = arrA.readUInt8(i);
                y = arrB.readUInt8(i);
                if (x !== y) {
                    return x - y;
                }
            }
            return 0;
        };
        while (true) {
            if (!regC) {
                regA = 0;
                break;
            }
            t = regTr.readUInt32LE((regB >>> 12) * 4);
            if (!t) {
                t = pageLookR(regB);
                if (!t) {
                    regNextHdlr = hdlrExcpt;
                    return;
                }
            }
            p = regTr.readUInt32LE((regA >>> 12) * 4);
            if (!p) {
                p = pageLookR(regA);
                if (!p) {
                    regNextHdlr = hdlrExcpt;
                    return;
                }
            }
            v = 4096 - (regA & 4095);
            if (v > regC) {
                v = regC;
            }
            u = 4096 - (regB & 4095);
            if (u > v) {
                u = v;
            }
            p = regA ^ (p & -2);
            t = regB ^ (t & -2);
            t = memCmp(hdrMem.slice(p, p + u), hdrMem.slice(t, t + u));
            if (t) {
                regA = t;
                regB = regB + regC;
                regC = 0;
                break;
            }
            regA = regA + u;
            regB = regB + u;
            regC = regC - u;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMCHR() {
        var t, p, u, v;
        while (true) {
            if (regC === 0) {
                regA = 0;
                break;
            }
            p = regTr.readUInt32LE((regA >>> 12) * 4);
            if (!p) {
                p = pageLookR(regA);
                if (!p) {
                    regNextHdlr = hdlrExcpt;
                    return;
                }
            }
            u = 4096 - (regA & 4095);
            if (u > regC) {
                u = regC;
            }
            v = regA ^ (p & -2);
            t = hdrMem.slice(v, v + u).indexOf(regB);
            if (t !== -1) {
                regA = regA + t;
                regC = 0;
                break;
            }
            regA = regA + u;
            regC = regC - u;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMSET() {
        var p, u, v;

        while (regC) {
            p = regTw.readUInt32LE((regA >>> 12) * 4);
            if (!p) {
                p = pageLookW(regA);
                if (!p) {
                    regNextHdlr = hdlrExcpt;
                    return;
                }
            }
            u = 4096 - (regA & 4095);
            if (u > regC) {
                u = regC;
            }
            v = regA ^ (p & -2);
            hdrMem.fill(regB, v, v + u);
            regA = regA + u;
            regC = regC - u;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execPOW() {
        regF = Math.pow(regF, regG);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execATN2() {
        regF = Math.atan2(regF, regG);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execFABS() {
        regF = Math.abs(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execATAN() {
        regF = Math.atan(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLOG() {
        regF = Math.log(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLOGT() {
        regF = Math.log10(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execEXP() {
        regF = Math.exp(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execFLOR() {
        regF = Math.floor(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execCEIL() {
        regF = Math.ceil(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execHYPO() {
        regF = Math.hypot(regF, regG);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSIN() {
        regF = Math.sin(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execCOS() {
        regF = Math.cos(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execTAN() {
        regF = Math.tan(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execASIN() {
        regF = Math.asin(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execACOS() {
        regF = Math.acos(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSINH() {
        regF = Math.sinh(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execCOSH() {
        regF = Math.cosh(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execTANH() {
        regF = Math.tanh(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSQRT() {
        regF = Math.sqrt(regF);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execFMOD() {
        regF = Math.fmod(regF, regG);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execENT() {
        if (regFSP) {
            regFSP = regFSP - (regIr & -256);
            if (regFSP < 0 || regFSP > (4096 << 8)) {
                regFSP = 0;
            }
        }
        regXSp = regXSp + (regIr >> 8);
        if (regFSP) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLEV() {
        var t, p, v;
        if (regIr < regFSP) {
            t = hdrMem.readUInt32LE(regXSp + (regIr >> 8)) + regTPc;
            regFSP = regFSP - ((regIr + (8 << 8)) & -256);
        } else {
            v = regXSp - regTSp + (regIr >> 8);
            p = regTr.readUInt32LE((v >>> 12) * 4);
            if (!p) {
                p = pageLookR(v);
                if (!p) {
                    regNextHdlr = hdlrExcpt;
                    return;
                }
            }
            t = hdrMem.readUInt32LE((v ^ p) & -8) + regTPc;
            regFSP = 0;
        }
        regXSp = regXSp + ((regIr >> 8) + 8);
        regXCycle = regXCycle + t - regXPc;
        regXPc = t;
        if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
            regNextHdlr = hdlrFixpc;
            return;
        }
        regNextHdlr = hdlrChkio;
        return;
    }

    function execJMP() {
        regXCycle = regXCycle + (regIr >> 8);
        regXPc = regXPc + ((regIr >> 10) << 2);
        if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
            regNextHdlr = hdlrFixpc;
            return;
        }
        regNextHdlr = hdlrChkio;
        return;
    }

    function execJMPI() {
        var t, p, v;
        v = regXPc - regTPc + (regIr >> 8) + (regA << 2);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        t = hdrMem.readUInt32LE((v ^ p) & -4);
        regXCycle = regXCycle + t;
        regXPc = regXPc + t;
        if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
            regNextHdlr = hdlrFixpc;
            return;
        }
        regNextHdlr = hdlrChkio;
        return;
    }

    function execJSR() {
        var p, v;
        if (regFSP & (4095 << 8)) {
            regXSp = regXSp - 8;
            regFSP = regFSP + (8 << 8);
            hdrMem.writeUInt32LE((regXPc - regTPc) >>> 0, regXSp);
        } else {
            v = regXSp - regTSp - 8;
            p = regTw.readUInt32LE((v >>> 12) * 4);
            if (!p) {
                p = pageLookW(v);
                if (!p) {
                    regNextHdlr = hdlrExcpt;
                    return;
                }
            }
            hdrMem.writeUInt32LE((regXPc - regTPc) >>> 0, (v ^ p) & -8);
            regFSP = 0;
            regXSp = regXSp - 8;
        }
        regXCycle = regXCycle + (regIr >> 8); // Why not ((ir >> 10) << 2)?
        regXPc = regXPc + ((regIr >> 10) << 2);
        if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
            regNextHdlr = hdlrFixpc;
            return;
        }
        regNextHdlr = hdlrChkio;
        return;
    }

    function execJSRA() {
        var p, v;
        if (regFSP & (4095 << 8)) {
            regXSp = regXSp - 8;
            regFSP = regFSP + (8 << 8);
            hdrMem.writeUInt32LE((regXPc - regTPc) >>> 0, regXSp);
        } else {
            v = regXSp - regTSp - 8;
            p = regTw.readUInt32LE((v >>> 12) * 4);
            if (!p) {
                p = pageLookW(v);
                if (!p) {
                    regNextHdlr = hdlrExcpt;
                    return;
                }
            }
            hdrMem.writeUInt32LE((regXPc - regTPc) >>> 0, (v ^ p) & -8);
            regFSP = 0;
            regXSp = regXSp - 8;
        }
        regXCycle = regXCycle + regA + regTPc - regXPc;
        regXPc = regA + regTPc;
        if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
            regNextHdlr = hdlrFixpc;
            return;
        }
        regNextHdlr = hdlrChkio;
        return;
    }

    function execPSHA() {
        var p, v;
        if (regFSP & (4095 << 8)) {
            regXSp = regXSp - 8;
            regFSP = regFSP + (8 << 8);
            hdrMem.writeUInt32LE(regA, regXSp);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp - 8;
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt32LE(regA, (v ^ p) & -8);
        regXSp = regXSp - 8;
        regFSP = 0;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPSHB() {
        var p, v;
        if (regFSP & (4095 << 8)) {
            regXSp = regXSp - 8;
            regFSP = regFSP + (8 << 8);
            hdrMem.writeUInt32LE(regB, regXSp);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp - 8;
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt32LE(regB, (v ^ p) & -8);
        regXSp = regXSp - 8;
        regFSP = 0;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPSHC() {
        var p, v;
        if (regFSP & (4095 << 8)) {
            regXSp = regXSp - 8;
            regFSP = regFSP + (8 << 8);
            hdrMem.writeUInt32LE(regC, regXSp);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp - 8;
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt32LE(regC, (v ^ p) & -8);
        regXSp = regXSp - 8;
        regFSP = 0;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPSHF() {
        var p, v;
        if (regFSP & (4095 << 8)) {
            regXSp = regXSp - 8;
            regFSP = regFSP + (8 << 8);
            hdrMem.writeDoubleLE(regF, regXSp);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp - 8;
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeDoubleLE(regF, (v ^ p) & -8);
        regXSp = regXSp - 8;
        regFSP = 0;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPSHG() {
        var p, v;
        if (regFSP & (4095 << 8)) {
            regXSp = regXSp - 8;
            regFSP = regFSP + (8 << 8);
            hdrMem.writeDoubleLE(regG, regXSp);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp - 8;
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeDoubleLE(regG, (v ^ p) & -8);
        regXSp = regXSp - 8;
        regFSP = 0;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPSHI() {
        var p, v;
        if (regFSP & (4095 << 8)) {
            regXSp = regXSp - 8;
            regFSP = regFSP + (8 << 8);
            hdrMem.writeInt32LE((regIr >> 8), regXSp);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp - 8;
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeInt32LE(regIr >> 8, (v ^ p) & -8);
        regXSp = regXSp - 8;
        regFSP = 0;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPOPA() {
        var p, v;
        if (regFSP) {
            regA = hdrMem.readUInt32LE(regXSp);
            regXSp = regXSp + 8;
            regFSP = regFSP - (8 << 8);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp;
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt32LE((v ^ p) & -8);
        regXSp = regXSp + 8;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPOPB() {
        var p, v;
        if (regFSP) {
            regB = hdrMem.readUInt32LE(regXSp);
            regXSp = regXSp + 8;
            regFSP = regFSP - (8 << 8);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp;
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt32LE((v ^ p) & -8);
        regXSp = regXSp + 8;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPOPC() {
        var p, v;
        if (regFSP) {
            regC = hdrMem.readUInt32LE(regXSp);
            regXSp = regXSp + 8;
            regFSP = regFSP - (8 << 8);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp;
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regC = hdrMem.readUInt32LE((v ^ p) & -8);
        regXSp = regXSp + 8;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPOPF() {
        var p, v;
        if (regFSP) {
            regF = hdrMem.readDoubleLE(regXSp);
            regXSp = regXSp + 8;
            regFSP = regFSP - (8 << 8);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp;
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regF = hdrMem.readDoubleLE((v ^ p) & -8);
        regXSp = regXSp + 8;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execPOPG() {
        var p, v;
        if (regFSP) {
            regG = hdrMem.readDoubleLE(regXSp);
            regXSp = regXSp + 8;
            regFSP = regFSP - (8 << 8);
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp;
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regG = hdrMem.readDoubleLE((v ^ p) & -8);
        regXSp = regXSp + 8;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLEA() {
        regA = regXSp - regTSp + (regIr >> 8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLEAG() {
        regA = regXPc - regTPc + (regIr >> 8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLL() {
        var p, v;
        if (regIr < regFSP) {
            regA = hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLLS() {
        var p, v;
        if (regIr < regFSP) {
            regA = hdrMem.readInt16LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readInt16LE((v ^ p) & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLLH() {
        var p, v;
        if (regIr < regFSP) {
            regA = hdrMem.readUInt16LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt16LE((v ^ p) & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLLC() {
        var p, v;
        if (regIr < regFSP) {
            regA = hdrMem.readInt8(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readInt8(v ^ p & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLLB() {
        var p, v;
        if (regIr < regFSP) {
            regA = hdrMem.readUInt8(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt8(v ^ p & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLLD() {
        var p, v;
        if (regIr < regFSP) {
            regF = hdrMem.readDoubleLE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regF = hdrMem.readDoubleLE((v ^ p) & -8);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLLF() {
        var p, v;
        if (regIr < regFSP) {
            regF = hdrMem.readFloatLE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regF = hdrMem.readFloatLE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLG() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt32LE((v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLGS() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readInt16LE((v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLGH() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt16LE((v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLGC() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readInt8(v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLGB() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt8(v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLGD() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regF = hdrMem.readDoubleLE((v ^ p) & -8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLGF() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regF = hdrMem.readFloatLE((v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLX() {
        var p, v;
        v = regA + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt32LE((v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLXS() {
        var p, v;
        v = regA + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readInt16LE((v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLXH() {
        var p, v;
        v = regA + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt16LE((v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLXC() {
        var p, v;
        v = regA + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readInt8(v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLXB() {
        var p, v;
        v = regA + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = hdrMem.readUInt8(v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLXD() {
        var p, v;
        v = regA + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regF = hdrMem.readDoubleLE((v ^ p) & -8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLXF() {
        var p, v;
        v = regA + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regF = hdrMem.readFloatLE((v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLI() {
        regA = regIr >> 8;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLHI() {
        regA = (regA << 24) | (regIr >>> 8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLIF() {
        regF = (regIr >> 8) / 256.0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBL() {
        var p, v;
        if (regIr < regFSP) {
            regB = hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLBLS() {
        var p, v;
        if (regIr < regFSP) {
            regB = hdrMem.readInt16LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readInt16LE((v ^ p) & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLBLH() {
        var p, v;
        if (regIr < regFSP) {
            regB = hdrMem.readUInt16LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt16LE((v ^ p) & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLBLC() {
        var p, v;
        if (regIr < regFSP) {
            regB = (hdrMem.readInt8(regXSp + (regIr >> 8)));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readInt8(v ^ p & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLBLB() {
        var p, v;
        if (regIr < regFSP) {
            regB = (hdrMem.readUInt8(regXSp + (regIr >> 8)));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt8(v ^ p & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLBLD() {
        var p, v;
        if (regIr < regFSP) {
            regG = hdrMem.readDoubleLE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readDoubleLE((v ^ p) & -8);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLBLF() {
        var p, v;
        if (regIr < regFSP) {
            regG = hdrMem.readFloatLE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readFloatLE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLBG() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt32LE((v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBGS() {
        var p, v;

        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readInt16LE((v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBGH() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt16LE((v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBGC() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readInt8(v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBGB() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt8(v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBGD() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regG = hdrMem.readDoubleLE((v ^ p) & -8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBGF() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regG = hdrMem.readFloatLE((v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBX() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt32LE((v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBXS() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readInt16LE((v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBXH() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt16LE((v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBXC() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readInt8(v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBXB() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regB = hdrMem.readUInt8(v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBXD() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regG = hdrMem.readDoubleLE((v ^ p) & -8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBXF() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regG = hdrMem.readFloatLE((v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBI() {
        regB = regIr >> 8;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBHI() {
        regB = (regB << 24) | (regIr >>> 8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBIF() {
        regG = (regIr >> 8) / 256.0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLCL() {
        var p, v;
        if (regIr < regFSP) {
            regC = hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regC = hdrMem.readUInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execLBA() {
        regB = regA;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLCA() {
        regC = regA;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLBAD() {
        regG = regF;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSL() {
        var p, v;
        if (regIr < regFSP) {
            hdrMem.writeUInt32LE(regA, regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt32LE(regA, (v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execSLH() {
        var p, v;
        if (regIr < regFSP) {
            hdrMem.writeUInt16LE(regA, regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt16LE(regA, (v ^ p) & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execSLB() {
        var p, v;
        if (regIr < regFSP) {
            hdrMem.writeUInt8(regA, regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt8(regA, v ^ p & -2);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execSLD() {
        var p, v;
        if (regIr < regFSP) {
            hdrMem.writeDoubleLE(regF, regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeDoubleLE(regF, (v ^ p) & -8);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execSLF() {
        var p, v;
        if (regIr < regFSP) {
            hdrMem.writeFloatLE(regF, regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeFloatLE(regF, (v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execSG() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt32LE(regA, (v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSGH() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt16LE(regA, (v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSGB() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt8(regA, v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSGD() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeDoubleLE(regF, (v ^ p) & -8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSGF() {
        var p, v;
        v = regXPc - regTPc + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeFloatLE(regF, (v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSX() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt32LE(regA, (v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSXH() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt16LE(regA, (v ^ p) & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSXB() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeUInt8(regA, v ^ p & -2);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSXD() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeDoubleLE(regF, (v ^ p) & -8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSXF() {
        var p, v;
        v = regB + (regIr >> 8);
        p = regTw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookW(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        hdrMem.writeFloatLE(regF, (v ^ p) & -4);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execADDF() {
        regF = regF + regG;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSUBF() {
        regF = regF - regG;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMULF() {
        regF = regF * regG;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execDIVF() {
        if (regG === 0.0) {
            regTrap = FARITH;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regF = regF / regG;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execADD() {
        regA = regA + regB;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execADDI() {
        regA = regA + (regIr >> 8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execADDL() {
        var p, v;
        if (regIr < regFSP) {
            regA = regA + hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = regA + hdrMem.readUInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execSUB() {
        regA = regA - regB;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSUBI() {
        regA = regA - (regIr >> 8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSUBL() {
        var p, v;
        if (regIr < regFSP) {
            regA = regA - hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = regA - hdrMem.readUInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execMUL() {
        regA = (regA | 0) * (regB | 0);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMULI() {
        regA = (regA | 0) * (regIr >> 8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMULL() {
        var p, v;
        if (regIr < regFSP) {
            regA = (regA | 0) * hdrMem.readInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = (regA | 0) * hdrMem.readInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execDIV() {
        if (!regB) {
            regTrap = FARITH;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = ((regA | 0) / (regB | 0)) >>> 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execDIVI() {
        var t;
        t = regIr >> 8;
        if (!t) {
            regTrap = FARITH;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = ((regA | 0) / (t | 0)) >>> 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execDIVL() {
        var p, v, t;
        if (regIr < regFSP) {
            t = hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            if (!t) {
                regTrap = FARITH;
                regNextHdlr = hdlrExcpt;
                return;
            }
            regA = ((regA | 0) / (t | 0)) >>> 0;
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        t = hdrMem.readUInt32LE((v ^ p) & -4);
        if (!t) {
            regTrap = FARITH;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = ((regA | 0) / (t | 0)) >>> 0;
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execDVU() {
        if (!regB) {
            regTrap = FARITH;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = (regA / regB) >>> 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execDVUI() {
        var t;
        t = (regIr >> 8);
        if (!t) {
            regTrap = FARITH;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = (regA / t) >>> 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execDVUL() {
        var p, v, t;
        if (regIr < regFSP) {
            t = hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            if (!t) {
                regTrap = FARITH;
                regNextHdlr = hdlrExcpt;
                return;
            }
            regA = (regA / t) >>> 0;
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        t = hdrMem.readUInt32LE((v ^ p) & -4);
        if (!t) {
            regTrap = FARITH;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = (regA / t) >>> 0;
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execMOD() {
        regA = ((regA | 0) % (regB | 0));
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMODI() {
        regA = ((regA | 0) % (regIr >> 8));
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMODL() {
        var p, v;
        if (regIr < regFSP) {
            regA = ((regA | 0) % hdrMem.readUInt32LE(regXSp + (regIr >> 8)));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = ((regA | 0) % hdrMem.readUInt32LE((v ^ p) & -4));
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execMDU() {
        regA %= regB;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMDUI() {
        regA %= (regIr >> 8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMDUL() {
        var p, v;
        if (regIr < regFSP) {
            regA %= hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA %= hdrMem.readUInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execAND() {
        regA &= regB;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execANDI() {
        regA &= regIr >> 8;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execANDL() {
        var p, v;
        if (regIr < regFSP) {
            regA &= hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA &= hdrMem.readUInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execOR() {
        regA = regA | regB;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execORI() {
        regA = regA | (regIr >> 8);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execORL() {
        var p, v;
        if (regIr < regFSP) {
            regA = (regA | hdrMem.readUInt32LE(regXSp + (regIr >> 8)));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = (regA | hdrMem.readUInt32LE((v ^ p) & -4));
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execXOR() {
        regA ^= regB;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execXORI() {
        regA ^= regIr >> 8;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execXORL() {
        var p, v;
        if (regIr < regFSP) {
            regA ^= hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA ^= hdrMem.readUInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execSHL() {
        regA <<= regB;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSHLI() {
        regA <<= regIr >> 8;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSHLL() {
        var p, v;
        if (regIr < regFSP) {
            regA <<= hdrMem.readUInt32LE(regXSp + (regIr >> 8));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA <<= hdrMem.readUInt32LE((v ^ p) & -4);
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execSHR() {
        regA = ((regA | 0) >> (regB | 0));
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSHRI() {
        regA = ((regA | 0) >> (regIr >> 8));
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSHRL() {
        var p, v;
        if (regIr < regFSP) {
            regA = ((regA | 0) >> hdrMem.readUInt32LE(regXSp + (regIr >> 8)));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = ((regA | 0) >> hdrMem.readUInt32LE((v ^ p) & -4));
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execSRU() {
        regA >>= regB;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSRUI() {
        regA >>>= regIr >> 8;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSRUL() {
        var p, v;
        if (regIr < regFSP) {
            regA = (regA >> hdrMem.readUInt32LE(regXSp + (regIr >> 8)));
            regNextHdlr = hdlrChkpc;
            return;
        }
        v = regXSp - regTSp + (regIr >> 8);
        p = regTr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = pageLookR(v);
            if (!p) {
                regNextHdlr = hdlrExcpt;
                return;
            }
        }
        regA = (regA >> hdrMem.readUInt32LE((v ^ p) & -4));
        if (regFSP || (v ^ (regXSp - regTSp)) & -4096) {
            regNextHdlr = hdlrChkpc;
            return;
        }
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execEQ() {
        regA = (regA === regB);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execEQF() {
        regA = (regF === regG);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execNE() {
        regA = (regA !== regB);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execNEF() {
        regA = (regF !== regG);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLT() {
        regA = ((regA | 0) < (regB | 0));
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLTU() {
        regA = (regA < regB);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLTF() {
        regA = (regF < regG);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execGE() {
        regA = ((regA | 0) >= (regB | 0));
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execGEU() {
        regA = (regA >= regB);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execGEF() {
        regA = (regF >= regG);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBZ() {
        if (!regA) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBZF() {
        if (!regF) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBNZ() {
        if (regA) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBNZF() {
        if (regF) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBE() {
        if (regA === regB) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBEF() {
        if (regF === regG) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBNE() {
        if (regA !== regB) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBNEF() {
        if (regF !== regG) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBLT() {
        if ((regA | 0) < (regB | 0)) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBLTU() {
        if (regA < regB) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBLTF() {
        if (regF < regG) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBGE() {
        if ((regA | 0) >= (regB | 0)) {
            regXCycle = regXCycle + (regIr >> 8);
            regXPc = regXPc + ((regIr >> 10) << 2);
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBGEU() {
        if (regA >= regB) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBGEF() {
        if (regF >= regG) {
            regXCycle = (regXCycle + (regIr >> 8));
            regXPc = (regXPc + ((regIr >> 10) << 2));
            if ((regXPc - regFPc) >>> 0 < (-4096) >>> 0) {
                regNextHdlr = hdlrFixpc;
                return;
            }
            regNextHdlr = hdlrChkio;
            return;
        }
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execCID() {
        regF = regA | 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execCUD() {
        regF = regA >>> 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execCDI() {
        regA = regF | 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execCDU() {
        regA = regF >>> 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBIN() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = regKbChar;
        regKbChar = -1;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execBOUT() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        if (regA !== 1) {
            printOut(2, "bad write a=" + regA.toString() + "\n");
            regNextHdlr = 0;
            return;
        }
        regA = (printOut(1, String.fromCharCode(regB)) ? 1 : -1);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSSP() {
        regXSp = regA;
        regTSp = 0;
        regFSP = 0;
        regNextHdlr = hdlrFixsp;
        return;
    }

    function execNOP() {
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execCYC() {
        regA = (regCycle + ((regXPc - regXCycle) | 0) / 4) >>> 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execMSIZ() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = hdrMemSz;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execCLI() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = regIena;
        regIena = 0;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSTI() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        if (regIpend) {
            regTrap = (regIpend & -regIpend);
            regIpend ^= regTrap;
            regIena = 0;
            regNextHdlr = hdlrItrpt;
            return;
        }
        regIena = (1);
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execRTI() {
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
                printOut(2, "RTI kstack fault\n");
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
                printOut(2, "RTI kstack fault\n");
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
        return;
    }

    function execIVEC() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regIvec = regA;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execPDIR() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        if (regA > hdrMemSz) {
            regTrap = FMEM;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regPdir = regA & -4096;
        clearTLB();
        regFSP = 0;
        regNextHdlr = hdlrFixpc;
        return;
    }

    function execSPAG() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        if (regA && !regPdir) {
            regTrap = FMEM;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regPaging = regA;
        clearTLB();
        regFSP = 0;
        regNextHdlr = hdlrFixpc;
        return;
    }

    function execTIME() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        if (regIr >> 8) {
            printOut(2, "timer" + (regIr >> 8).toString() +
                "=" + regTimer.toString() +
                " timeout=" + regTimeOut.toString() + "\n");
            regNextHdlr = hdlrChkpc;
            return;
        }
        regTimeOut = regA;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execLVAD() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = regVadr;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execTRAP() {
        regTrap = FSYSCL;
        regNextHdlr = hdlrExcpt;
        return;
    }

    function execLUSP() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regA = regUSp;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execSUSP() {
        if (regUser) {
            regTrap = FPRIV;
            regNextHdlr = hdlrExcpt;
            return;
        }
        regUSp = regA;
        regNextHdlr = hdlrChkpc;
        return;
    }

    function execDefault() {
        printOut(2, (regIr & 0xFF).toString() + " not implemented!\n");
        regTrap = FINST;
        regNextHdlr = hdlrExcpt;
        return;
    }

    function setupHardware() {
        var setupDecoder, setupLogic, setupMemory;
        setupDecoder = function() {
            var i;
            executors = [];
            for (i = 0; i <= 0xFF; i = i + 1) {
                executors.push(execDefault);
            }
            executors[0] = execHALT;
            executors[1] = execENT;
            executors[2] = execLEV;
            executors[3] = execJMP;
            executors[4] = execJMPI;
            executors[5] = execJSR;
            executors[6] = execJSRA;
            executors[7] = execLEA;
            executors[8] = execLEAG;
            executors[9] = execCYC;
            executors[10] = execMCPY;
            executors[11] = execMCMP;
            executors[12] = execMCHR;
            executors[13] = execMSET;
            executors[14] = execLL;
            executors[15] = execLLS;
            executors[16] = execLLH;
            executors[17] = execLLC;
            executors[18] = execLLB;
            executors[19] = execLLD;
            executors[20] = execLLF;
            executors[21] = execLG;
            executors[22] = execLGS;
            executors[23] = execLGH;
            executors[24] = execLGC;
            executors[25] = execLGB;
            executors[26] = execLGD;
            executors[27] = execLGF;
            executors[28] = execLX;
            executors[29] = execLXS;
            executors[30] = execLXH;
            executors[31] = execLXC;
            executors[32] = execLXB;
            executors[33] = execLXD;
            executors[34] = execLXF;
            executors[35] = execLI;
            executors[36] = execLHI;
            executors[37] = execLIF;
            executors[38] = execLBL;
            executors[39] = execLBLS;
            executors[40] = execLBLH;
            executors[41] = execLBLC;
            executors[42] = execLBLB;
            executors[43] = execLBLD;
            executors[44] = execLBLF;
            executors[45] = execLBG;
            executors[46] = execLBGS;
            executors[47] = execLBGH;
            executors[48] = execLBGC;
            executors[49] = execLBGB;
            executors[50] = execLBGD;
            executors[51] = execLBGF;
            executors[52] = execLBX;
            executors[53] = execLBXS;
            executors[54] = execLBXH;
            executors[55] = execLBXC;
            executors[56] = execLBXB;
            executors[57] = execLBXD;
            executors[58] = execLBXF;
            executors[59] = execLBI;
            executors[60] = execLBHI;
            executors[61] = execLBIF;
            executors[62] = execLBA;
            executors[63] = execLBAD;
            executors[64] = execSL;
            executors[65] = execSLH;
            executors[66] = execSLB;
            executors[67] = execSLD;
            executors[68] = execSLF;
            executors[69] = execSG;
            executors[70] = execSGH;
            executors[71] = execSGB;
            executors[72] = execSGD;
            executors[73] = execSGF;
            executors[74] = execSX;
            executors[75] = execSXH;
            executors[76] = execSXB;
            executors[77] = execSXD;
            executors[78] = execSXF;
            executors[79] = execADDF;
            executors[80] = execSUBF;
            executors[81] = execMULF;
            executors[82] = execDIVF;
            executors[83] = execADD;
            executors[84] = execADDI;
            executors[85] = execADDL;
            executors[86] = execSUB;
            executors[87] = execSUBI;
            executors[88] = execSUBL;
            executors[89] = execMUL;
            executors[90] = execMULI;
            executors[91] = execMULL;
            executors[92] = execDIV;
            executors[93] = execDIVI;
            executors[94] = execDIVL;
            executors[95] = execDVU;
            executors[96] = execDVUI;
            executors[97] = execDVUL;
            executors[98] = execMOD;
            executors[99] = execMODI;
            executors[100] = execMODL;
            executors[101] = execMDU;
            executors[102] = execMDUI;
            executors[103] = execMDUL;
            executors[104] = execAND;
            executors[105] = execANDI;
            executors[106] = execANDL;
            executors[107] = execOR;
            executors[108] = execORI;
            executors[109] = execORL;
            executors[110] = execXOR;
            executors[111] = execXORI;
            executors[112] = execXORL;
            executors[113] = execSHL;
            executors[114] = execSHLI;
            executors[115] = execSHLL;
            executors[116] = execSHR;
            executors[117] = execSHRI;
            executors[118] = execSHRL;
            executors[119] = execSRU;
            executors[120] = execSRUI;
            executors[121] = execSRUL;
            executors[122] = execEQ;
            executors[123] = execEQF;
            executors[124] = execNE;
            executors[125] = execNEF;
            executors[126] = execLT;
            executors[127] = execLTU;
            executors[128] = execLTF;
            executors[129] = execGE;
            executors[130] = execGEU;
            executors[131] = execGEF;
            executors[132] = execBZ;
            executors[133] = execBZF;
            executors[134] = execBNZ;
            executors[135] = execBNZF;
            executors[136] = execBE;
            executors[137] = execBEF;
            executors[138] = execBNE;
            executors[139] = execBNEF;
            executors[140] = execBLT;
            executors[141] = execBLTU;
            executors[142] = execBLTF;
            executors[143] = execBGE;
            executors[144] = execBGEU;
            executors[145] = execBGEF;
            executors[146] = execCID;
            executors[147] = execCUD;
            executors[148] = execCDI;
            executors[149] = execCDU;
            executors[150] = execCLI;
            executors[151] = execSTI;
            executors[152] = execRTI;
            executors[153] = execBIN;
            executors[154] = execBOUT;
            executors[155] = execNOP;
            executors[156] = execSSP;
            executors[157] = execPSHA;
            executors[158] = execPSHI;
            executors[159] = execPSHF;
            executors[160] = execPSHB;
            executors[161] = execPOPB;
            executors[162] = execPOPF;
            executors[163] = execPOPA;
            executors[164] = execIVEC;
            executors[165] = execPDIR;
            executors[166] = execSPAG;
            executors[167] = execTIME;
            executors[168] = execLVAD;
            executors[169] = execTRAP;
            executors[170] = execLUSP;
            executors[171] = execSUSP;
            executors[172] = execLCL;
            executors[173] = execLCA;
            executors[174] = execPSHC;
            executors[175] = execPOPC;
            executors[176] = execMSIZ;
            executors[177] = execPSHG;
            executors[178] = execPOPG;
            executors[188] = execPOW;
            executors[189] = execATN2;
            executors[190] = execFABS;
            executors[191] = execATAN;
            executors[192] = execLOG;
            executors[193] = execLOGT;
            executors[194] = execEXP;
            executors[195] = execFLOR;
            executors[196] = execCEIL;
            executors[197] = execHYPO;
            executors[198] = execSIN;
            executors[199] = execCOS;
            executors[200] = execTAN;
            executors[201] = execASIN;
            executors[202] = execACOS;
            executors[203] = execSINH;
            executors[204] = execCOSH;
            executors[205] = execTANH;
            executors[206] = execSQRT;
            executors[207] = execFMOD;
            executors[208] = execIDLE;
        };
        setupLogic = function() {
            hdlrFatal = function() {
                var hexStr, tmp;
                hexStr = function(x) {
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
            hdlrExcpt = function() {
                if (!regIena) {
                    printOut(2, "exception in interrupt handler\n");
                    regNextHdlr = hdlrFatal;
                } else {
                    regNextHdlr = hdlrItrpt;
                }
            };
            hdlrItrpt = function() {
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
            hdlrFixsp = function() {
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
            hdlrChkpc = function() {
                if (regXPc === regFPc) {
                    regNextHdlr = hdlrFixpc;
                } else {
                    regNextHdlr = hdlrInstr;
                }
            };
            hdlrFixpc = function() {
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
            hdlrChkio = function() {
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
            hdlrInstr = function() {
                regIr = hdrMem.readUInt32LE(regXPc);
                regXPc = regXPc + 4;
                (executors[regIr & 0xFF])();
            };
        };
        setupMemory = function() {
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
    }

    function setupSoftware(abOS, abFS, infoStr) {
        var cleanMemory, wipeMemory, wipeRegs, readInfo;
        cleanMemory = function() {
            hdrMem.fill(0);
            hdrTrK.fill(0);
            hdrTwK.fill(0);
            hdrTrU.fill(0);
            hdrTwU.fill(0);
            hdrTpage.fill(0);
        };
        wipeMemory = function() {
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
        wipeRegs = function() {
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
        readInfo = function() {
            var program, locals, split, addVarInfo;
            split = function(s) {
                return s.split(' ').filter(function(m) {
                    return m.length > 0;
                });
            };
            addVarInfo = function(varSet, line) {
                line = split(line);
                varSet[line[1]] = {
                    space: line[2],
                    offset: Number(line[3]),
                    type: line[4]
                };
            };
            infoPool = {};
            infoStr.split('\n').forEach(function(line) {
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
                        if ((executors[hdrMem.readUInt32LE(regXPc) & 0xFF]) ===
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
        singleStepCb = function(point, localDefs) {
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
        cpuEvent = setInterval(function() {
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
        forceInit: forceInit,
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
