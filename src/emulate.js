/*jslint
    bitwise: true, node: true, stupid: true, nomen: true, white: true
 */

"use strict";

/* Modules */

var minimist = require("minimist"),
    assert = require("assert"),
    fs = require("fs");

/* Instruction Set */

// instructions: system
var HALT = 0,
    ENT = 1,
    LEV = 2,
    JMP = 3,
    JMPI = 4,
    JSR = 5,
    JSRA = 6,
    LEA = 7,
    LEAG = 8,
    CYC = 9,
    MCPY = 10,
    MCMP = 11,
    MCHR = 12,
    MSET = 13;

// instructions: load a
var LL = 14,
    LLS = 15,
    LLH = 16,
    LLC = 17,
    LLB = 18,
    LLD = 19,
    LLF = 20,
    LG = 21,
    LGS = 22,
    LGH = 23,
    LGC = 24,
    LGB = 25,
    LGD = 26,
    LGF = 27,
    LX = 28,
    LXS = 29,
    LXH = 30,
    LXC = 31,
    LXB = 32,
    LXD = 33,
    LXF = 34,
    LI = 35,
    LHI = 36,
    LIF = 37;

// instructions: load b
var LBL = 38,
    LBLS = 39,
    LBLH = 40,
    LBLC = 41,
    LBLB = 42,
    LBLD = 43,
    LBLF = 44,
    LBG = 45,
    LBGS = 46,
    LBGH = 47,
    LBGC = 48,
    LBGB = 49,
    LBGD = 50,
    LBGF = 51,
    LBX = 52,
    LBXS = 53,
    LBXH = 54,
    LBXC = 55,
    LBXB = 56,
    LBXD = 57,
    LBXF = 58,
    LBI = 59,
    LBHI = 60,
    LBIF = 61,
    LBA = 62,
    LBAD = 63;

// instructions: store
var SL = 64,
    SLH = 65,
    SLB = 66,
    SLD = 67,
    SLF = 68,
    SG = 69,
    SGH = 70,
    SGB = 71,
    SGD = 72,
    SGF = 73,
    SX = 74,
    SXH = 75,
    SXB = 76,
    SXD = 77,
    SXF = 78;

// instructions: arithmetic
var ADDF = 79,
    SUBF = 80,
    MULF = 81,
    DIVF = 82,
    ADD = 83,
    ADDI = 84,
    ADDL = 85,
    SUB = 86,
    SUBI = 87,
    SUBL = 88,
    MUL = 89,
    MULI = 90,
    MULL = 91,
    DIV = 92,
    DIVI = 93,
    DIVL = 94,
    DVU = 95,
    DVUI = 96,
    DVUL = 97,
    MOD = 98,
    MODI = 99,
    MODL = 100,
    MDU = 101,
    MDUI = 102,
    MDUL = 103,
    AND = 104,
    ANDI = 105,
    ANDL = 106,
    OR = 107,
    ORI = 108,
    ORL = 109,
    XOR = 110,
    XORI = 111,
    XORL = 112,
    SHL = 113,
    SHLI = 114,
    SHLL = 115,
    SHR = 116,
    SHRI = 117,
    SHRL = 118;

// instructions: logical
var SRU = 119,
    SRUI = 120,
    SRUL = 121,
    EQ = 122,
    EQF = 123,
    NE = 124,
    NEF = 125,
    LT = 126,
    LTU = 127,
    LTF = 128,
    GE = 129,
    GEU = 130,
    GEF = 131;

// instructions: conditional
var BZ = 132,
    BZF = 133,
    BNZ = 134,
    BNZF = 135,
    BE = 136,
    BEF = 137,
    BNE = 138,
    BNEF = 139,
    BLT = 140,
    BLTU = 141,
    BLTF = 142,
    BGE = 143,
    BGEU = 144,
    BGEF = 145;

// instructions: conversion
var CID = 146,
    CUD = 147,
    CDI = 148,
    CDU = 149;

// instructions: misc
var CLI = 150,
    STI = 151,
    RTI = 152,
    BIN = 153,
    BOUT = 154,
    NOP = 155,
    SSP = 156,
    PSHA = 157,
    PSHI = 158,
    PSHF = 159,
    PSHB = 160,
    POPB = 161,
    POPF = 162,
    POPA = 163,
    IVEC = 164,
    PDIR = 165,
    SPAG = 166,
    TIME = 167,
    LVAD = 168,
    TRAP = 169,
    LUSP = 170,
    SUSP = 171,
    LCL = 172,
    LCA = 173,
    PSHC = 174,
    POPC = 175,
    MSIZ = 176,
    PSHG = 177,
    POPG = 178,
    NET1 = 179,
    NET2 = 180,
    NET3 = 181,
    NET4 = 182,
    NET5 = 183,
    NET6 = 184,
    NET7 = 185,
    NET8 = 186,
    NET9 = 187;

// instructions: math
var POW = 188,
    ATN2 = 189,
    FABS = 190,
    ATAN = 191,
    LOG = 192,
    LOGT = 193,
    EXP = 194,
    FLOR = 195,
    CEIL = 196,
    HYPO = 197,
    SIN = 198,
    COS = 199,
    TAN = 200,
    ASIN = 201,
    ACOS = 202,
    SINH = 203,
    COSH = 204,
    TANH = 205,
    SQRT = 206,
    FMOD = 207,
    IDLE = 208;

/* Weird C Library */

function signed(x) {
    return x >> 0;
}

function unsigned(x) {
    return x >>> 0;
}

function dprintf(fd) {
    var args;

    if (fd === 2) {
        args = Array.prototype.slice.call(arguments, 1);
        console.log.apply(console, args);
    } else {
        assert(false);
    }
}

function probekeybd() {
    assert(false);
    /// should have the same effect as `poll + read`
    return -1;
}

var INT8 = 0,
    UINT8 = 1,
    INT16 = 2,
    UINT16 = 3,
    INT32 = 4,
    UINT32 = 5,
    FLOAT = 6,
    DOUBLE = 7;

function calloc(sz, dtype) {
    var ret;

    if (dtype === INT16 || dtype === UINT16) {
        sz *= 2;
    } else if (dtype === INT32 || dtype === UINT32 || dtype === FLOAT) {
        sz *= 4;
    } else if (dtype === DOUBLE) {
        sz *= 8;
    }
    ret = Buffer.alloc(sz);
    ret.dtype = dtype;
    return ret;
}

function rdAtT(a, i, dtype) {
    var v;

    switch (dtype) {
        case INT8:
            v = a.readInt8(i);
            break;
        case UINT8:
            v = a.readUInt8(i);
            break;
        case INT16:
            v = a.readInt16LE(i);
            break;
        case UINT16:
            v = a.readUInt16LE(i);
            break;
        case INT32:
            v = a.readInt32LE(i);
            break;
        case UINT32:
            v = a.readUInt32LE(i);
            break;
        case FLOAT:
            v = a.readFloatLE(i);
            break;
        case DOUBLE:
            v = a.readDoubleLE(i);
            break;
        default:
            assert(false);
    }
    return v;
}

function rdAt(a, i) {
    return rdAtT(a, i, a.dtype);
}

function wrAtT(a, i, v, dtype) {
    switch (dtype) {
        case INT8:
            a.writeInt8(v, i);
            break;
        case UINT8:
            a.writeUInt8(v, i);
            break;
        case INT16:
            a.writeInt16LE(v, i);
            break;
        case UINT16:
            a.writeUInt16LE(v, i);
            break;
        case INT32:
            a.writeInt32LE(v, i);
            break;
        case UINT32:
            a.writeUInt32LE(v, i);
            break;
        case FLOAT:
            a.writeFloatLE(v, i);
            break;
        case DOUBLE:
            a.writeDoubleLE(v, i);
            break;
        default:
            assert(false);
    }
    return v;
}

function wrAt(a, i, v) {
    return wrAtT(a, i, v, a.dtype);
}

/* V9 Emulator */

var MEM_SZ = 128 * 1024 * 1024, // default memory size of vm (128M)
    TB_SZ = 1024 * 1024, // page translation buffer size (4G / page_sz)
    FS_SZ = 4 * 1024 * 1024, // ram file system size (4M)
    TPAGES = 4096, // maximum cached page translations
    PAGE_SZ = 4096; // bytes per page

var PTE_P = 0x001, // present
    PTE_W = 0x002, // writeable
    PTE_U = 0x004, // user
    PTE_A = 0x020, // accessed
    PTE_D = 0x040; // dirty

var FMEM = 0, // bad physical address
    FTIMER = 1, // timer interrupt
    FKEYBD = 2, // keyboard interrupt
    FPRIV = 3, // privileged instruction
    FINST = 4, // illegal instruction
    FSYS = 5, // software trap
    FARITH = 6, // arithmetic trap
    FIPAGE = 7, // page fault on opcode fetch
    FWPAGE = 8, // page fault on write
    FRPAGE = 9, // page fault on read
    USER = 16; // user mode exception (16)

var verbose = 0, // chatty option -v
    mem = 0, // physical memory
    memsz = 0, // physical memory size
    user = 0, // user mode
    iena = 0, // interrupt enable
    ipend = 0, // interrupt pending
    trap = 0, // fault code
    ivec = 0, // interrupt vector
    vadr = 0, // bad virtual address
    paging = 0, // virtual memory enabled
    pdir = 0, // page directory
    tpage = calloc(TPAGES, UINT32), // valid page translations
    tpages = 0, // number of cached page translations
    trk = 0, // kernel read page translation tables
    twk = 0, // kernel write page translation tables
    tru = 0, // user read page translation tables
    twu = 0, // user write page translation tables
    tr = 0, // current read page translation tables
    tw = 0; // current write page translation tables

var cmd = "./xem";

var H31_L1 = 0xFFFFFFFE,
    H29_L3 = 0xFFFFFFF8,
    H24_L8 = 0xFFFFFF00,
    H20_L12 = 0xFFFFF000,
    L20_H10_L2 = 0xFFC,
    L20_H12 = 0xFFF,
    L24_H8 = 0xFF;

// to prevent unintended use of signed shift >>
function shr(x, n) {
    return x >>> n;
}

function flush() {
    var v;

    while (tpages > 0) {
        tpages -= 1;
        v = rdAt(tpage, tpages);
        wrAt(trk, v, 0);
        wrAt(twk, v, 0);
        wrAt(tru, v, 0);
        wrAt(twu, v, 0);
    }
}

function setpage(v, p, writable, userable) {
    if (p >= memsz) {
        trap = FMEM;
        vadr = v;
        return 0;
    }
    p = ((v ^ p) & H20_L12) + 1; // a trick that makes readers hate me
    v = shr(v, 12);
    if (rdAt(trk, v) === 0) {
        if (tpages >= TPAGES) {
            flush();
        }
        wrAt(tpage, tpages, v);
        tpages += 1;
    }
    wrAt(trk, v, p);
    wrAt(twk, v, (writable ? p : 0));
    wrAt(tru, v, (userable ? p : 0));
    wrAt(twu, v, ((userable && writable) ? p : 0));
    return p;
}

function rlook(v) {
    var pde, ppde, pte, ppte, q, userable;

    if (!paging) {
        return setpage(v, v, 1, 1);
    }
    ppde = pdir + (shr(v, 22) << 2);
    assert((shr(ppde, 2) << 2) === ppde);
    pde = rdAtT(mem, shr(ppde, 2), UINT32);
    if (pde & PTE_P) {
        if (!(pde & PTE_A)) {
            wrAtT(mem, shr(ppde, 2), pde | PTE_A, UINT32);
        }
        if (pde >= memsz) {
            trap = FMEM;
            vadr = v;
            return 0;
        }
        ppte = (pde & H20_L12) + (shr(v, 10) & L20_H10_L2);
        assert((shr(ppte, 2) << 2) === ppte);
        pte = rdAtT(mem, shr(ppte, 2), UINT32);
        if (pte & PTE_P) {
            q = pte & pde;
            userable = q & PTE_U;
            if (userable || !user) {
                if (!(pte & PTE_A)) {
                    wrAtT(mem, shr(ppte, 2), pte | PTE_A, UINT32);
                }
                // check PTE_D here because the dirty bit should be set by wlook
                return setpage(v, pte, (pte & PTE_D) && (q & PTE_W), userable);
            }
        }
    }
    trap = FRPAGE;
    vadr = v;
    return 0;
}

function wlook(v) {
    var pde, ppde, pte, ppte, q, userable;

    if (!paging) {
        return setpage(v, v, 1, 1);
    }
    ppde = pdir + (shr(v, 22) << 2);
    assert((shr(ppde, 2) << 2) === ppde);
    pde = rdAtT(mem, shr(ppde, 2), UINT32);
    if (pde & PTE_P) {
        if (!(pde & PTE_A)) {
            wrAtT(mem, shr(ppde, 2), pde | PTE_A, UINT32);
        }
        if (pde >= memsz) {
            trap = FMEM;
            vadr = v;
            return 0;
        }
        ppte = (pde & H20_L12) + (shr(v, 10) & L20_H10_L2);
        assert((shr(ppte, 2) << 2) === ppte);
        pte = rdAtT(mem, shr(ppte, 2), UINT32);
        if (pte & PTE_P) {
            q = pte & pde;
            userable = q & PTE_U;
            if ((userable || !user) && (q & PTE_W)) {
                if ((pte & (PTE_D | PTE_A)) !== (PTE_D | PTE_A)) {
                    wrAtT(mem, shr(ppte, 2), pte | (PTE_D | PTE_A), UINT32);
                }
                return setpage(v, pte, q & PTE_W, userable);
            }
        }
    }
    trap = FWPAGE;
    vadr = v;
    return 0;
}

function usage() {
    dprintf(2, "USAGE: node emulate.js [options] <file>");
    dprintf(2, "OPTIONS:");
    dprintf(2, "  -v");
    dprintf(2, "  -m <memsize>");
    dprintf(2, "  -f <filesys>");
}

function readfs(filename) {
    var fd, st, i;

    if (verbose) {
        dprintf(2, "%s : loading ram file system %s\n", cmd, filename);
    }
    fd = fs.openSync(filename, "r");
    if (fd < 0) {
        dprintf(2, "%s : couldn't open file system %s\n", cmd, filename);
        return -1;
    }
    try {
        st = fs.fstatSync(fd);
    } catch (e) {
        dprintf(2, "%s : couldn't stat file system %s\n", cmd, filename);
        return -1;
    }
    i = fs.readSync(fd, mem, memsz - FS_SZ, st.size);
    if (i !== st.size) {
        dprintf(2, "%s : failed to read filesystem size %d returned %d\n",
            cmd, st.size, i);
        return -1;
    }
    fs.closeSync(fd);
    return 0;
}

function readhdr(filename) {
    var fd, st, buf, hdr, i;

    fd = fs.openSync(filename, "r");
    if (fd < 0) {
        dprintf(2, "%s : couldn't open %s\n", cmd, filename);
        return -1;
    }
    try {
        st = fs.fstatSync(fd); // How to check if it succeeds or not?
    } catch (e) {
        dprintf(2, "%s : couldn't stat file %s\n", cmd, filename);
        return -1;
    }
    buf = calloc(4, UINT32);
    fs.readSync(fd, buf, 0, 16);
    hdr = {
        magic: rdAt(buf, 0),
        bss: rdAt(buf, 1),
        entry: rdAt(buf, 2),
        flags: rdAt(buf, 3)
    };
    if (hdr.magic !== 0xC0DEF00D) {
        dprintf(2, "%s : bad hdr.magic\n", cmd);
        return -1;
    }
    i = fs.readSync(fd, mem, 0, st.size - 16);
    if (i !== st.size - 16) {
        dprintf(2, "%s : failed to read file %s\n", cmd, filename);
        return -1;
    }
    fs.closeSync(fd);
    return hdr;
}

function cpu(pc, sp) {
    var a = 0,
        b = 0,
        c = 0,
        f = 0.0,
        g = 0.0,
        ssp,
        usp,
        xpc = 0,
        tpc = -pc,
        fpc = 0,
        xsp = sp,
        tsp = 0,
        fsp = 0,
        ir,
        trap,
        delta = 4096,
        cycle = 4096,
        xcycle = delta * 4,
        timer = 0,
        timeout = 0,
        kbchar = -1,
        follower, fatal, exception, interrupt, fixsp, chkpc, fixpc, next, after;

    fatal = function() {
        dprintf(2, "processor halted! cycle = %d pc = %08x ir = %08x sp = %08x" +
            " a = %d b = %d c = %d trap = %d\n",
            cycle + Math.floor((xpc - xcycle) / 4), xpc - tpc, ir, xsp - tsp,
            a, b, c, trap);
        follower = 0;
    };
    exception = function() {
        if (iena === 0) {
            dprintf(2, "exception in interrupt handler\n");
            follower = fatal;
        } else {
            follower = interrupt;
        }
    };
    interrupt = function() {
        var p;

        xsp -= tsp;
        tsp = 0;
        fsp = 0;
        if (user) {
            usp = xsp;
            xsp = ssp;
            user = 0;
            tr = trk;
            tw = twk;
            trap |= USER;
        }
        xsp -= 8;
        p = rdAt(tw, shr(xsp, 12));
        if (p === 0) {
            p = wlook(xsp);
            if (p === 0) {
                dprintf(2, "kstack fault!\n");
                follower = fatal;
                return;
            }
        }
        wrAtT(mem, shr((xsp ^ p) & H29_L3, 2), xpc - tpc, UINT32);
        xsp -= 8;
        p = rdAt(tw, shr(xsp, 12));
        if (p === 0) {
            p = wlook(xsp);
            if (p === 0) {
                dprintf(2, "kstack fault\n");
                follower = fatal;
                return;
            }
        }
        wrAtT(mem, shr((xsp ^ p) & H29_L3, 2), trap, UINT32);
        xcycle += ivec + tpc - xpc;
        xpc = ivec + tpc;
        follower = fixpc;
    };
    fixsp = function() {
        var v, p;

        v = xsp - tsp;
        p = rdAt(tw, shr(v, 12));
        if (p) {
            xsp = v ^ (p - 1);
            tsp = xsp - v;
            fsp = (PAGE_SZ - (xsp & L20_H12)) << 8;
        }
        follower = chkpc;
    };
    chkpc = function() {
        if (xpc === fpc) {
            follower = fixpc;
        } else {
            follower = after;
        }
    };
    fixpc = function() {
        var v, p;

        v = xpc - tpc;
        p = rdAt(tr, shr(v, 12));
        if (p === 0) {
            p = rlook(v);
            if (p === 0) {
                trap = FIPAGE;
                follower = exception;
                return;
            }
        }
        xcycle -= tpc;
        xpc = v ^ (p - 1);
        tpc = xpc - v;
        xcycle += tpc;
        fpc = (xpc + 4096) & H20_L12;
        follower = next;
    };
    next = function() {
        var ch;

        if (xpc > xcycle) {
            cycle += delta;
            xcycle += delta * 4;
            if (iena || !(ipend & FKEYBD)) {
                ch = probekeybd();
                if (ch !== -1) {
                    kbchar = ch;
                    if (kbchar === '`') {
                        dprintf(2, "ungraceful exit. cycle = %d\n",
                            cycle + Math.floor((xpc - xcycle) / 4));
                        follower = 0;
                        return;
                    }
                    if (iena) {
                        trap = FKEYBD;
                        iena = 0;
                        follower = interrupt;
                        return;
                    }
                    ipend |= FKEYBD;
                }
            }
            if (timeout) {
                timer += delta;
                if (timer >= timeout) {
                    timer = 0;
                    if (iena) {
                        trap = FTIMER;
                        iena = 0;
                        follower = interrupt;
                        return;
                    }
                    ipend |= FTIMER;
                }
            }
        }
        follower = after;
    };
    after = function() {
        var ch, u, v, p, t;

        assert(shr(xpc, 2) << 2 === xpc);
        ir = rdAtT(mem, shr(xpc, 2), INT32); // immediate is signed
        xpc += 4;
        switch (ir & L24_H8) {
            case HALT:
                if (user || verbose) {
                    dprintf(2, "halt(%d) cycle = %d\n",
                        a, cycle + Math.floor((xpc - xcycle) / 4));
                }
                follower = 0;
                return;
            case IDLE:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                if (!iena) {
                    trap = FINST;
                    break;
                }
                while (true) {
                    ch = probekeybd();
                    if (ch !== -1) {
                        kbchar = ch;
                        if (kbchar === '`') {
                            dprintf(2, "ungraceful exit. cycle = %d\n",
                                cycle + Math.floor((xpc - xcycle) / 4));
                            follower = 0;
                            return;
                        }
                        trap = FKEYBD;
                        iena = 0;
                        follower = interrupt;
                        return;
                    }
                    cycle += delta;
                    if (timeout) {
                        timer += delta;
                        if (timer >= timeout) {
                            timer = 0;
                            trap = FTIMER;
                            iena = 0;
                            follower = interrupt;
                            return;
                        }
                    }
                }
                break;
            case MCPY:
                while (c > 0) {
                    t = rdAt(tr, shr(b, 12));
                    if (t === 0) {
                        t = rlook(b);
                        if (t === 0) {
                            follower = exception;
                            return;
                        }
                    }
                    p = rdAt(tw, shr(a, 12));
                    if (p === 0) {
                        p = wlook(a);
                        if (p === 0) {
                            follower = exception;
                            return;
                        }
                    }
                    v = PAGE_SZ - (a & L20_H12);
                    if (v > c) {
                        v = c;
                    }
                    u = PAGE_SZ - (b & L20_H12);
                    if (u > v) {
                        u = v;
                    }
                    p = a ^ (p & H31_L1);
                    t = b ^ (t & H31_L1);
                    mem.copy(mem, p, t, t + u);
                    a += u;
                    b += u;
                    c -= u;
                }
                follower = chkpc;
                return;
            case MCMP:
                while (true) {
                    if (c === 0) {
                        a = 0;
                        break;
                    }
                    t = rdAt(tr, shr(b, 12));
                    if (t === 0) {
                        t = rlook(b);
                        if (t === 0) {
                            follower = exception;
                            return;
                        }
                    }
                    p = rdAt(tr, shr(a, 12));
                    if (p === 0) {
                        p = rlook(a);
                        if (p === 0) {
                            follower = exception;
                            return;
                        }
                    }
                    v = PAGE_SZ - (a & L20_H12);
                    if (v > c) {
                        v = c;
                    }
                    u = PAGE_SZ - (b & L20_H12);
                    if (u > v) {
                        u = v;
                    }
                    p = a ^ (p & H31_L1);
                    t = b ^ (t & H31_L1);
                    t = mem.slice(p, p + u).compare(mem.slice(t, t + u));
                    if (t !== 0) {
                        a = t;
                        b += c;
                        c = 0;
                        break;
                    }
                    a += u;
                    b += u;
                    c -= u;
                }
                follower = chkpc;
                return;
            case MCHR:
                while (true) {
                    if (c === 0) {
                        a = 0;
                        break;
                    }
                    p = rdAt(tr, shr(a, 12));
                    if (p === 0) {
                        p = rlook(a);
                        if (p === 0) {
                            follower = exception;
                            return;
                        }
                    }
                    u = PAGE_SZ - (a & L20_H12);
                    if (u > c) {
                        u = c;
                    }
                    v = a ^ (p & H31_L1);
                    t = mem.slice(v, v + u).indexOf(b);
                    if (t !== -1) {
                        a += t;
                        c = 0;
                        break;
                    }
                    a += u;
                    c -= u;
                }
                follower = chkpc;
                return;
            case MSET:
                while (c > 0) {
                    p = rdAt(tw, shr(a, 12));
                    if (p === 0) {
                        p = wlook(a);
                        if (p === 0) {
                            follower = exception;
                            return;
                        }
                    }
                    u = PAGE_SZ - (a & L20_H12);
                    if (u > c) {
                        u = c;
                    }
                    v = a ^ (p & H31_L1);
                    mem.fill(b, v, v + u);
                    a += u;
                    c -= u;
                }
                follower = chkpc;
                return;
            case POW:
                f = Math.pow(f, g);
                follower = chkpc;
                return;
            case ATN2:
                f = Math.atan2(f, g);
                follower = chkpc;
                return;
            case FABS:
                f = Math.abs(f);
                follower = chkpc;
                return;
            case ATAN:
                f = Math.atan(f);
                follower = chkpc;
                return;
            case LOG:
                f = Math.log(f);
                follower = chkpc;
                return;
            case LOGT:
                f = Math.log10(f);
                follower = chkpc;
                return;
            case EXP:
                f = Math.exp(f);
                follower = chkpc;
                return;
            case FLOR:
                f = Math.floor(f);
                follower = chkpc;
                return;
            case CEIL:
                f = Math.ceil(f);
                follower = chkpc;
                return;
            case HYPO:
                f = Math.hypot(f, g);
                follower = chkpc;
                return;
            case SIN:
                f = Math.sin(f);
                follower = chkpc;
                return;
            case COS:
                f = Math.cos(f);
                follower = chkpc;
                return;
            case TAN:
                f = Math.tan(f);
                follower = chkpc;
                return;
            case ASIN:
                f = Math.asin(f);
                follower = chkpc;
                return;
            case ACOS:
                f = Math.acos(f);
                follower = chkpc;
                return;
            case SINH:
                f = Math.sinh(f);
                follower = chkpc;
                return;
            case COSH:
                f = Math.cosh(f);
                follower = chkpc;
                return;
            case TANH:
                f = Math.tanh(f);
                follower = chkpc;
                return;
            case SQRT:
                f = Math.sqrt(f);
                follower = chkpc;
                return;
            case FMOD:
                f = Math.fmod(f, g);
                follower = chkpc;
                return;
            case ENT:
                if (fsp) {
                    fsp -= ir & H24_L8;
                    if (fsp > (PAGE_SZ << 8)) {
                        fsp = 0;
                    }
                }
                xsp += ir >> 8;
                if (fsp) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            default:
                trap = FINST;
                break;
        }
        follower = exception;
    };
    follower = fixpc;
    while (follower !== 0) {
        follower();
    }
}

function main(argv) {
    var hdr;

    if (argv._.length !== 1) {
        usage();
        return -1;
    }
    verbose = argv.hasOwnProperty("v");
    if (argv.hasOwnProperty("m")) {
        memsz = Number(argv.m) * 1024 * 1024;
    } else {
        memsz = MEM_SZ;
    }
    if (verbose) {
        dprintf(2, "mem size = %d\n", memsz);
    }
    mem = calloc(memsz, UINT8);
    if (argv.hasOwnProperty("f")) {
        if (readfs(argv.f) === -1) {
            return -1;
        }
    }
    hdr = readhdr(argv._[0]);
    if (hdr === -1) {
        return -1;
    }
    trk = calloc(TB_SZ, UINT32);
    twk = calloc(TB_SZ, UINT32);
    tru = calloc(TB_SZ, UINT32);
    twu = calloc(TB_SZ, UINT32);
    tr = trk;
    tw = twk;
    if (verbose) {
        dprintf(2, "%s : emulating %s\n", cmd, argv._[0]);
    }
    cpu(hdr.entry, memsz - FS_SZ);
    return 0;
}

main(minimist(process.argv.slice(2)));
