/*jslint
    bitwise: true, node: true, stupid: true, nomen: true, white: true
 */

"use strict";

var minimist = require("minimist"),
    assert = require("assert"),
    fs = require("fs");

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

var MEM_SZ = 128 * 1024 * 1024, // default memory size of vm (128M)
    TB_SZ = 1024 * 1024, // page translation buffer size (4G / page_sz)
    FS_SZ = 4 * 1024 * 1024, // ram file system size (4M)
    TPAGES = 4096; // maximum cached page translations

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
    tpage = Buffer.alloc(TPAGES * 4), // valid page translations
    tpages = 0, // number of cached page translations
    trk = 0, // kernel read page translation tables
    twk = 0, // kernel write page translation tables
    tru = 0, // user read page translation tables
    twu = 0, // user write page translation tables
    tr = 0, // current read page translation tables
    tw = 0; // current write page translation tables

var cmd = "./xem";

function signed(x) {
    return x | 0;
}

function unsigned(x) {
    return x >>> 0;
}

function sar(x, n) {
    return x >> n;
}

function shr(x, n) {
    return x >>> n;
}

function probekb() {
    assert(false);
    ///
    return -1;
}

function writech(ch) {
    if (process.stdout.write(ch)) {
        return 1;
    }
    return -1;
}

function flush() {
    var v;

    while (tpages > 0) {
        tpages -= 1;
        v = tpage.readUInt32LE(tpages * 4);
        trk.writeUInt32LE(0, v * 4);
        twk.writeUInt32LE(0, v * 4);
        tru.writeUInt32LE(0, v * 4);
        twu.writeUInt32LE(0, v * 4);
    }
}

function setpage(v, p, writable, userable) {
    if (p >= memsz) {
        trap = FMEM;
        vadr = v;
        return 0;
    }
    p = unsigned(((v ^ p) & -4096) + 1);
    v = shr(v, 12);
    if (!trk.readUInt32LE(v * 4)) {
        if (tpages >= TPAGES) {
            flush();
        }
        tpage.writeUInt32LE(v, tpages * 4);
        tpages += 1;
    }
    trk.writeUInt32LE(p, v * 4);
    twk.writeUInt32LE((writable ? p : 0), v * 4);
    tru.writeUInt32LE((userable ? p : 0), v * 4);
    twu.writeUInt32LE(((userable && writable) ? p : 0), v * 4);
    return p;
}

function rlook(v) {
    var pde, ppde, pte, ppte, q, userable;

    if (!paging) {
        return setpage(v, v, 1, 1);
    }
    ppde = unsigned(pdir + (shr(v, 22) << 2));
    pde = mem.readUInt32LE(ppde);
    if (pde & PTE_P) {
        if (!(pde & PTE_A)) {
            mem.writeUInt32LE(pde | PTE_A, ppde);
        }
        if (pde >= memsz) {
            trap = FMEM;
            vadr = v;
            return 0;
        }
        ppte = unsigned((pde & -4096) + (shr(v, 10) & 0xffc));
        pte = mem.readUInt32LE(ppte);
        if (pte & PTE_P) {
            q = pte & pde;
            userable = q & PTE_U;
            if (userable || !user) {
                if (!(pte & PTE_A)) {
                    mem.writeUInt32LE(pte | PTE_A, ppte);
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
    ppde = unsigned(pdir + (shr(v, 22) << 2));
    pde = mem.readUInt32LE(ppde);
    if (pde & PTE_P) {
        if (!(pde & PTE_A)) {
            mem.writeUInt32LE(pde | PTE_A, ppde);
        }
        if (pde >= memsz) {
            trap = FMEM;
            vadr = v;
            return 0;
        }
        ppte = unsigned((pde & -4096) + (shr(v, 10) & 0xffc));
        pte = mem.readUInt32LE(ppte);
        if (pte & PTE_P) {
            q = pte & pde;
            userable = q & PTE_U;
            if ((userable || !user) && (q & PTE_W)) {
                if ((pte & (PTE_D | PTE_A)) !== (PTE_D | PTE_A)) {
                    mem.writeUInt32LE(pte | (PTE_D | PTE_A), ppte);
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
    console.log("USAGE: node emulate.js [options] <file>");
    console.log("OPTIONS:");
    console.log("  -v");
    console.log("  -m <memsize>");
    console.log("  -f <filesys>");
}

function readfs(filename) {
    var fd, st, i;

    if (verbose) {
        console.log("%s : loading ram file system %s\n", cmd, filename);
    }
    fd = fs.openSync(filename, "r");
    if (fd < 0) {
        console.log("%s : couldn't open file system %s\n", cmd, filename);
        return -1;
    }
    try {
        st = fs.fstatSync(fd);
    } catch (e) {
        console.log("%s : couldn't stat file system %s\n", cmd, filename);
        return -1;
    }
    i = fs.readSync(fd, mem, memsz - FS_SZ, st.size);
    if (i !== st.size) {
        console.log("%s : failed to read filesystem size %d returned %d\n",
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
        console.log("%s : couldn't open %s\n", cmd, filename);
        return -1;
    }
    try {
        st = fs.fstatSync(fd); // How to check if it succeeds or not?
    } catch (e) {
        console.log("%s : couldn't stat file %s\n", cmd, filename);
        return -1;
    }
    buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16);
    hdr = {
        magic: buf.readUInt32LE(0),
        bss: buf.readUInt32LE(4),
        entry: buf.readUInt32LE(8),
        flags: buf.readUInt32LE(12)
    };
    if (hdr.magic !== 0xC0DEF00D) {
        console.log("%s : bad hdr.magic\n", cmd);
        return -1;
    }
    i = fs.readSync(fd, mem, 0, st.size - 16);
    if (i !== st.size - 16) {
        console.log("%s : failed to read file %s\n", cmd, filename);
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
        ssp = 0,
        usp = 0,
        xpc = 0,
        tpc = -pc,
        fpc = 0,
        xsp = sp,
        tsp = 0,
        fsp = 0,
        ir = 0,
        trap = 0,
        delta = 4096,
        cycle = 4096,
        xcycle = delta * 4,
        timer = 0,
        timeout = 0,
        kbchar = -1,
        follower, fatal, exception, interrupt, fixsp, chkpc, fixpc, next, after;

    fatal = function() {
        console.log("processor halted! cycle = %d pc = %08x ir = %08x sp = %08x" +
            " a = %d b = %d c = %d trap = %d\n",
            cycle + Math.floor((xpc - xcycle) / 4), xpc - tpc, ir, xsp - tsp,
            a, b, c, trap);
        follower = 0;
    };
    exception = function() {
        if (!iena) {
            console.log("exception in interrupt handler\n");
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
        p = tw.readUInt32LE(shr(xsp, 12) * 4);
        if (!p) {
            p = wlook(xsp);
            if (!p) {
                console.log("kstack fault!\n");
                follower = fatal;
                return;
            }
        }
        mem.writeUInt32LE(xpc - tpc, unsigned((xsp ^ p) & -8));
        xsp -= 8;
        p = tw.readUInt32LE(shr(xsp, 12) * 4);
        if (!p) {
            p = wlook(xsp);
            if (!p) {
                console.log("kstack fault\n");
                follower = fatal;
                return;
            }
        }
        mem.writeUInt32LE(trap, unsigned((xsp ^ p) & -8));
        xcycle += ivec + tpc - xpc;
        xpc = ivec + tpc;
        follower = fixpc;
    };
    fixsp = function() {
        var v, p;

        v = xsp - tsp;
        p = tw.readUInt32LE(shr(v, 12) * 4);
        if (p) {
            xsp = v ^ (p - 1);
            tsp = xsp - v;
            fsp = (4096 - (xsp & 4095)) << 8;
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
        p = tr.readUInt32LE(shr(v, 12) * 4);
        if (!p) {
            p = rlook(v);
            if (!p) {
                trap = FIPAGE;
                follower = exception;
                return;
            }
        }
        xcycle -= tpc;
        xpc = v ^ (p - 1);
        tpc = xpc - v;
        xcycle += tpc;
        fpc = (xpc + 4096) & -4096;
        follower = next;
    };
    next = function() {
        var ch;

        if (xpc > xcycle) {
            cycle += delta;
            xcycle += delta * 4;
            if (iena || !(ipend & FKEYBD)) {
                ch = probekb();
                if (ch !== -1) {
                    kbchar = ch;
                    if (kbchar === '`') {
                        console.log("ungraceful exit. cycle = %d\n",
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

        ir = mem.readUInt32LE(xpc);
        xpc += 4;
        switch (ir & 0xFF) {
            case HALT:
                if (user || verbose) {
                    console.log("halt(%d) cycle = %d\n",
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
                    ch = probekb();
                    if (ch !== -1) {
                        kbchar = ch;
                        if (kbchar === '`') {
                            console.log("ungraceful exit. cycle = %d\n",
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
                while (c) {
                    t = tr.readUInt32LE(shr(b, 12) * 4);
                    if (!t) {
                        t = rlook(b);
                        if (!t) {
                            follower = exception;
                            return;
                        }
                    }
                    p = tw.readUInt32LE(shr(a, 12) * 4);
                    if (!p) {
                        p = wlook(a);
                        if (!p) {
                            follower = exception;
                            return;
                        }
                    }
                    v = 4096 - (a & 4095);
                    if (v > c) {
                        v = c;
                    }
                    u = 4096 - (b & 4095);
                    if (u > v) {
                        u = v;
                    }
                    p = a ^ (p & -2);
                    t = b ^ (t & -2);
                    mem.copy(mem, p, t, t + u);
                    a += u;
                    b += u;
                    c -= u;
                }
                follower = chkpc;
                return;
            case MCMP:
                while (true) {
                    if (!c) {
                        a = 0;
                        break;
                    }
                    t = tr.readUInt32LE(shr(b, 12) * 4);
                    if (!t) {
                        t = rlook(b);
                        if (!t) {
                            follower = exception;
                            return;
                        }
                    }
                    p = tr.readUInt32LE(shr(a, 12) * 4);
                    if (!p) {
                        p = rlook(a);
                        if (!p) {
                            follower = exception;
                            return;
                        }
                    }
                    v = 4096 - (a & 4095);
                    if (v > c) {
                        v = c;
                    }
                    u = 4096 - (b & 4095);
                    if (u > v) {
                        u = v;
                    }
                    p = a ^ (p & -2);
                    t = b ^ (t & -2);
                    t = mem.slice(p, p + u).compare(mem.slice(t, t + u));
                    if (t) {
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
                    p = tr.readUInt32LE(shr(a, 12) * 4);
                    if (!p) {
                        p = rlook(a);
                        if (!p) {
                            follower = exception;
                            return;
                        }
                    }
                    u = 4096 - (a & 4095);
                    if (u > c) {
                        u = c;
                    }
                    v = a ^ (p & -2);
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
                    p = tw.readUInt32LE(shr(a, 12) * 4);
                    if (!p) {
                        p = wlook(a);
                        if (!p) {
                            follower = exception;
                            return;
                        }
                    }
                    u = 4096 - (a & 4095);
                    if (u > c) {
                        u = c;
                    }
                    v = a ^ (p & -2);
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
                    fsp -= ir & -256;
                    if (fsp > (4096 << 8)) {
                        fsp = 0;
                    }
                }
                xsp += sar(ir, 8);
                if (fsp) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LEV:
                if (ir < fsp) {
                    t = mem.readUInt32LE(xsp + sar(ir, 8)) + tpc;
                    fsp -= (ir + 0x800) & -256;
                } else {
                    v = xsp - tsp + sar(ir, 8);
                    p = tr.readUInt32LE(shr(v, 12) * 4);
                    if (!p) {
                        p = rlook(v);
                        if (!p) {
                            break;
                        }
                    }
                    t = mem.readUInt32LE((v ^ p) & -8) + tpc;
                    fsp = 0;
                }
                xsp += sar(ir, 8) + 8;
                xcycle += t - xpc;
                xpc = t;
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case JMP:
                xcycle += sar(ir, 8);
                xpc += sar(ir, 10) << 2;
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case JMPI:
                v = xpc - tpc + sar(ir, 8) + (a << 2);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                t = mem.readUInt32LE((v ^ p) & -4);
                xcycle += t;
                xpc = xpc + t;
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case JSR:
                if (fsp & (4095 << 8)) {
                    xsp -= 8;
                    fsp += 8 << 8;
                    mem.writeUInt32LE(xpc - tpc, xsp);
                } else {
                    v = xsp - tsp - 8;
                    p = tw.readUInt32LE(shr(v, 12) * 4);
                    if (!p) {
                        p = wlook(v);
                        if (!p) {
                            break;
                        }
                    }
                    mem.writeUInt32LE(xpc - tpc, (v ^ p) & -8);
                    fsp = 0;
                    xsp -= 8;
                }
                xcycle += sar(ir, 8);
                xpc += sar(ir, 10) << 2;
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case JSRA:
                if (fsp & (4095 << 8)) {
                    xsp -= 8;
                    fsp += 8 << 8;
                    mem.writeUInt32LE(xpc - tpc, xsp);
                } else {
                    v = xsp - tsp - 8;
                    p = tw.readUInt32LE(shr(v, 12) * 4);
                    if (!p) {
                        p = wlook(v);
                        if (!p) {
                            break;
                        }
                    }
                    mem.writeUInt32LE(xpc - tpc, (v ^ p) & -8);
                    fsp = 0;
                    xsp -= 8;
                }
                xcycle += a + tpc - xpc;
                xpc = a + tpc;
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case PSHA:
                if (fsp & (4095 << 8)) {
                    xsp -= 8;
                    fsp += 8 << 8;
                    mem.writeUInt32LE(a, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt32LE(a, (v ^ p) & -8);
                xsp -= 8;
                fsp = 0;
                follower = fixsp;
                return;
            case PSHB:
                if (fsp & (4095 << 8)) {
                    xsp -= 8;
                    fsp += 8 << 8;
                    mem.writeUInt32LE(b, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt32LE(b, (v ^ p) & -8);
                xsp -= 8;
                fsp = 0;
                follower = fixsp;
                return;
            case PSHC:
                if (fsp & (4095 << 8)) {
                    xsp -= 8;
                    fsp += 8 << 8;
                    mem.writeUInt32LE(c, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt32LE(c, (v ^ p) & -8);
                xsp -= 8;
                fsp = 0;
                follower = fixsp;
                return;
            case PSHF:
                if (fsp & (4095 << 8)) {
                    xsp -= 8;
                    fsp += 8 << 8;
                    mem.writeDoubleLE(f, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeDoubleLE(f, (v ^ p) & -8);
                xsp -= 8;
                fsp = 0;
                follower = fixsp;
                return;
            case PSHG:
                if (fsp & (4095 << 8)) {
                    xsp -= 8;
                    fsp += 8 << 8;
                    mem.writeDoubleLE(g, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeDoubleLE(g, (v ^ p) & -8);
                xsp -= 8;
                fsp = 0;
                follower = fixsp;
                return;
            case PSHI:
                if (fsp & (4095 << 8)) {
                    xsp -= 8;
                    fsp += 8 << 8;
                    mem.writeInt32LE(sar(ir, 8), xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeInt32LE(sar(ir, 8), (v ^ p) & -8);
                xsp -= 8;
                fsp = 0;
                follower = fixsp;
                return;
            case POPA:
                if (fsp) {
                    a = mem.readUInt32LE(xsp);
                    xsp += 8;
                    fsp -= 8 << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt32LE((v ^ p) & -8);
                xsp += 8;
                follower = fixsp;
                return;
            case POPB:
                if (fsp) {
                    b = mem.readUInt32LE(xsp);
                    xsp += 8;
                    fsp -= 8 << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt32LE((v ^ p) & -8);
                xsp += 8;
                follower = fixsp;
                return;
            case POPC:
                if (fsp) {
                    c = mem.readUInt32LE(xsp);
                    xsp += 8;
                    fsp -= 8 << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                c = mem.readUInt32LE((v ^ p) & -8);
                xsp += 8;
                follower = fixsp;
                return;
            case POPF:
                if (fsp) {
                    f = mem.readDoubleLE(xsp);
                    xsp += 8;
                    fsp -= 8 << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                f = mem.readDoubleLE((v ^ p) & -8);
                xsp += 8;
                follower = fixsp;
                return;
            case POPG:
                if (fsp) {
                    g = mem.readDoubleLE(xsp);
                    xsp += 8;
                    fsp -= 8 << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                g = mem.readDoubleLE((v ^ p) & -8);
                xsp += 8;
                follower = fixsp;
                return;
            case LEA:
                a = xsp - tsp + sar(ir, 8);
                follower = chkpc;
                return;
            case LEAG:
                a = xpc - tpc + sar(ir, 8);
                follower = chkpc;
                return;
            case LL:
                if (ir < fsp) {
                    a = mem.readUInt32LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LLS:
                if (ir < fsp) {
                    a = mem.readInt16LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readInt16LE((v ^ p) & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LLH:
                if (ir < fsp) {
                    a = mem.readUInt16LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt16LE((v ^ p) & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LLC:
                if (ir < fsp) {
                    a = mem.readInt8LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readInt8LE(v ^ p & -2); // & precedes ^, what gives?
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LLB:
                if (ir < fsp) {
                    a = mem.readUInt8LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt8LE(v ^ p & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LLD:
                if (ir < fsp) {
                    f = mem.readDoubleLE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                f = mem.readDoubleLE((v ^ p) & -8);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LLF:
                if (ir < fsp) {
                    f = mem.readFloatLE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                f = mem.readFloatLE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LG:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt32LE((v ^ p) & -4);
                follower = chkpc;
                return;
            case LGS:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readInt16LE((v ^ p) & -2);
                follower = chkpc;
                return;
            case LGH:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt16LE((v ^ p) & -2);
                follower = chkpc;
                return;
            case LGC:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readInt8LE(v ^ p & -2);
                follower = chkpc;
                return;
            case LGB:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt8LE(v ^ p & -2);
                follower = chkpc;
                return;
            case LGD:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                f = mem.readDoubleLE((v ^ p) & -8);
                follower = chkpc;
                return;
            case LGF:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                f = mem.readFloatLE((v ^ p) & -4);
                follower = chkpc;
                return;
            case LX:
                v = a + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt32LE((v ^ p) & -4);
                follower = chkpc;
                return;
            case LXS:
                v = a + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readInt16LE((v ^ p) & -2);
                follower = chkpc;
                return;
            case LXH:
                v = a + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt16LE((v ^ p) & -2);
                follower = chkpc;
                return;
            case LXC:
                v = a + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readInt8LE(v ^ p & -2);
                follower = chkpc;
                return;
            case LXB:
                v = a + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt8LE(v ^ p & -2);
                follower = chkpc;
                return;
            case LXD:
                v = a + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                f = mem.readDoubleLE((v ^ p) & -8);
                follower = chkpc;
                return;
            case LXF:
                v = a + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                f = mem.readFloatLE((v ^ p) & -4);
                follower = chkpc;
                return;
            case LI:
                a = sar(ir, 8);
                follower = chkpc;
                return;
            case LHI:
                a = a << 24 | sar(ir, 8);
                follower = chkpc;
                return;
            case LIF:
                f = sar(ir, 8) / 256.0;
                follower = chkpc;
                return;
            case LBL:
                if (ir < fsp) {
                    b = mem.readUInt32LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBLS:
                if (ir < fsp) {
                    b = mem.readInt16LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readInt16LE((v ^ p) & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBLH:
                if (ir < fsp) {
                    b = mem.readUInt16LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt16LE((v ^ p) & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBLC:
                if (ir < fsp) {
                    b = mem.readInt8LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readInt8LE(v ^ p & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBLB:
                if (ir < fsp) {
                    b = mem.readUInt8LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt8LE(v ^ p & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBLD:
                if (ir < fsp) {
                    g = mem.readDoubleLE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readDoubleLE((v ^ p) & -8);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBLF:
                if (ir < fsp) {
                    g = mem.readFloatLE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readFloatLE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBG:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt32LE((v ^ p) & -4);
                follower = chkpc;
                return;
            case LBGS:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readInt16LE((v ^ p) & -2);
                follower = chkpc;
                return;
            case LBGH:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt16LE((v ^ p) & -2);
                follower = chkpc;
                return;
            case LBGC:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readInt8LE(v ^ p & -2);
                follower = chkpc;
                return;
            case LBGB:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt8LE(v ^ p & -2);
                follower = chkpc;
                return;
            case LBGD:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                g = mem.readDoubleLE((v ^ p) & -8);
                follower = chkpc;
                return;
            case LBGF:
                v = xpc - tpc + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                g = mem.readFloatLE((v ^ p) & -4);
                follower = chkpc;
                return;
            case LBX:
                v = b + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt32LE((v ^ p) & -4);
                follower = chkpc;
                return;
            case LBXS:
                v = b + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readInt16LE((v ^ p) & -2);
                follower = chkpc;
                return;
            case LBXH:
                v = b + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt16LE((v ^ p) & -2);
                follower = chkpc;
                return;
            case LBXC:
                v = b + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readInt8LE(v ^ p & -2);
                follower = chkpc;
                return;
            case LBXB:
                v = b + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt8LE(v ^ p & -2);
                follower = chkpc;
                return;
            case LBXD:
                v = b + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                g = mem.readDoubleLE((v ^ p) & -8);
                follower = chkpc;
                return;
            case LBXF:
                v = b + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                g = mem.readFloatLE((v ^ p) & -4);
                follower = chkpc;
                return;
            case LBI:
                b = sar(ir, 8);
                follower = chkpc;
                return;
            case LBHI:
                b = b << 24 | sar(ir, 8);
                follower = chkpc;
                return;
            case LBIF:
                g = sar(ir, 8) / 256.0;
                follower = chkpc;
                return;
            case LCL:
                if (ir < fsp) {
                    c = mem.readUInt32LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                c = mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBA:
                b = a;
                follower = chkpc;
                return;
            case LCA:
                c = a;
                follower = chkpc;
                return;
            case LBAD:
                g = f;
                follower = chkpc;
                return;
            case SL:
                if (ir < fsp) {
                    mem.writeUInt32LE(a, xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt32LE(a, (v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SLH:
                if (ir < fsp) {
                    mem.writeUInt16LE(a, xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt16LE(a, (v ^ p) & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SLB:
                if (ir < fsp) {
                    mem.writeUInt8LE(a, xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt8LE(a, v ^ p & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SLD:
                if (ir < fsp) {
                    mem.writeDoubleLE(f, xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeDoubleLE(f, (v ^ p) & -8);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SLF:
                if (ir < fsp) {
                    mem.writeFloatLE(f, xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeFloatLE(f, (v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SG:
                v = xpc - tpc + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt32LE(a, (v ^ p) & -4);
                follower = chkpc;
                return;
            case SGH:
                v = xpc - tpc + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt16LE(a, (v ^ p) & -2);
                follower = chkpc;
                return;
            case SGB:
                v = xpc - tpc + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt8LE(a, v ^ p & -2);
                follower = chkpc;
                return;
            case SGD:
                v = xpc - tpc + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeDoubleLE(a, (v ^ p) & -8);
                follower = chkpc;
                return;
            case SGF:
                v = xpc - tpc + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeFloatLE(a, (v ^ p) & -4);
                follower = chkpc;
                return;
            case SX:
                v = b + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt32LE(a, (v ^ p) & -4);
                follower = chkpc;
                return;
            case SXH:
                v = b + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt16LE(a, (v ^ p) & -2);
                follower = chkpc;
                return;
            case SXB:
                v = b + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt8LE(a, v ^ p & -2);
                follower = chkpc;
                return;
            case SXD:
                v = b + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeDoubleLE(f, (v ^ p) & -8);
                follower = chkpc;
                return;
            case SXF:
                v = b + sar(ir, 8);
                p = tw.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeFloatLE(f, (v ^ p) & -4);
                follower = chkpc;
                return;
            case ADDF:
                f += g;
                follower = chkpc;
                return;
            case SUBF:
                f -= g;
                follower = chkpc;
                return;
            case MULF:
                f *= g;
                follower = chkpc;
                return;
            case DIVF:
                if (g === 0.0) {
                    trap = FARITH;
                    break;
                }
                f /= g;
                follower = chkpc;
                return;
            case ADD:
                a += b;
                follower = chkpc;
                return;
            case ADDI:
                a += sar(ir, 8);
                follower = chkpc;
                return;
            case ADDL:
                if (ir < fsp) {
                    a += mem.readUInt32LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a += mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SUB:
                a -= b;
                follower = chkpc;
                return;
            case SUBI:
                a -= sar(ir, 8);
                follower = chkpc;
                return;
            case SUBL:
                if (ir < fsp) {
                    a -= mem.readUInt32LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a -= mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case MUL:
                a = a * b;
                follower = chkpc;
                return;
            case MULI:
                a = a * sar(ir, 8);
                follower = chkpc;
                return;
            case MULL:
                if (ir < fsp) {
                    a = a * mem.readInt32LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = a * mem.readInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case DIV:
                if (!b) {
                    trap = FARITH;
                    break;
                }
                a = Math.floor(a / b);
                follower = chkpc;
                return;
            case DIVI:
                t = sar(ir, 8);
                if (!t) {
                    trap = FARITH;
                    break;
                }
                a = Math.floor(a / t);
                follower = chkpc;
                return;
            case DIVL:
                if (ir < fsp) {
                    t = mem.readUInt32LE(xsp + sar(ir, 8));
                    if (!t) {
                        trap = FARITH;
                        break;
                    }
                    a = Math.floor(a / t);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                t = mem.readUInt32LE((v ^ p) & -4);
                if (!t) {
                    trap = FARITH;
                    break;
                }
                a = Math.floor(a / t);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case DVU:
                if (!b) {
                    trap = FARITH;
                    break;
                }
                a = Math.floor(a / b);
                follower = chkpc;
                return;
            case DVUI:
                t = sar(ir, 8);
                if (!t) {
                    trap = FARITH;
                    break;
                }
                a = Math.floor(a / t);
                follower = chkpc;
                return;
            case DVUL:
                if (ir < fsp) {
                    t = mem.readUInt32LE(xsp + sar(ir, 8));
                    if (!t) {
                        trap = FARITH;
                        break;
                    }
                    a = Math.floor(a / t);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                t = mem.readUInt32LE((v ^ p) & -4);
                if (!t) {
                    trap = FARITH;
                    break;
                }
                a = Math.floor(a / t);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case MOD:
                a = a % b;
                follower = chkpc;
                return;
            case MODI:
                a = a % sar(ir, 8);
                follower = chkpc;
                return;
            case MODL:
                if (ir < fsp) {
                    a = a % mem.readUInt32LE(xsp + sar(ir, 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + sar(ir, 8);
                p = tr.readUInt32LE(shr(v, 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = a % mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case MDU:
                a %= b;
                follower = chkpc;
                return;
            case MDUI:
                a %= sar(ir, 8);
                follower = chkpc;
                return;
            case MDUL:
                if (ir < fsp) {
                    a %= mem.readUInt32LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a %= mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case AND:
                a &= b;
                follower = chkpc;
                return;
            case ANDI:
                a &= ir >> 8;
                follower = chkpc;
                return;
            case ANDL:
                if (ir < fsp) {
                    a &= mem.readUInt32LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a &= mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case OR:
                a |= b;
                follower = chkpc;
                return;
            case ORI:
                a |= ir >> 8;
                follower = chkpc;
                return;

            case ORL:
                if (ir < fsp) {
                    a |= mem.readUInt32LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a |= mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case XOR:
                a ^= b;
                follower = chkpc;
                return;
            case XORI:
                a ^= ir >> 8;
                follower = chkpc;
                return;
            case XORL:
                if (ir < fsp) {
                    a ^= mem.readUInt32LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a ^= mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SHL:
                a <<= b;
                follower = chkpc;
                return;
            case SHLI:
                a <<= ir >> 8;
                follower = chkpc;
                return;
            case SHLL:
                if (ir < fsp) {
                    a <<= mem.readUInt32LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a <<= mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SHR:
                a = a >> b;
                follower = chkpc;
                return;
            case SHRI:
                a = a >> (ir >> 8);
                follower = chkpc;
                return;
            case SHRL:
                if (ir < fsp) {
                    a = a >> mem.readUInt32LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = a >> mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SRU:
                a >>= b;
                follower = chkpc;
                return;
            case SRUI:
                a >>= ir >> 8;
                follower = chkpc;
                return;
            case SRUL:
                if (ir < fsp) {
                    a = a >> mem.readUInt32LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = a >> mem.readUInt32LE((v ^ p) & -4);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case EQ:
                a = a === b;
                follower = chkpc;
                return;
            case EQF:
                a = f === g;
                follower = chkpc;
                return;
            case NE:
                a = a !== b;
                follower = chkpc;
                return;
            case NEF:
                a = f !== g;
                follower = chkpc;
                return;
            case LT:
                a = a < b;
                follower = chkpc;
                return;
            case LTU:
                a = a < b;
                follower = chkpc;
                return;
            case LTF:
                a = f < g;
                follower = chkpc;
                return;
            case GE:
                a = a >= b;
                follower = chkpc;
                return;
            case GEU:
                a = a >= b;
                follower = chkpc;
                return;
            case GEF:
                a = f >= g;
                follower = chkpc;
                return;
            case BZ:
                if (!a) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BZF:
                if (!f) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BNZ:
                if (a) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BNZF:
                if (f) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BE:
                if (a === b) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BEF:
                if (f === g) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BNE:
                if (a !== b) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BNEF:
                if (f !== g) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BLT:
                if (a < b) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BLTU:
                if (a < b) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BLTF:
                if (f < g) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BGE:
                if (a >= b) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BGEU:
                if (a >= b) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case BGEF:
                if (f >= g) {
                    xcycle += ir >> 8;
                    xpc += (ir >> 10) << 2;
                    if (xpc - fpc < -4096) {
                        follower = fixpc;
                        return;
                    }
                    follower = next;
                    return;
                }
                follower = chkpc;
                return;
            case CID:
                f = a;
                follower = chkpc;
                return;
            case CUD:
                f = a;
                follower = chkpc;
                return;
            case CDI:
                a = f;
                follower = chkpc;
                return;
            case CDU:
                a = f;
                follower = chkpc;
                return;
            case BIN:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                a = kbchar;
                kbchar = -1;
                follower = chkpc;
                return;
            case BOUT:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                if (a !== 1) {
                    console.log("bad write a=%d\n", a);
                    follower = 0;
                    return;
                }
                ch = b;
                a = writech(ch);
                follower = chkpc;
                return;
            case SSP:
                xsp = a;
                tsp = 0;
                fsp = 0;
                follower = fixsp;
                return;
            case NOP:
                follower = chkpc;
                return;
            case CYC:
                a = cycle + Math.floor((xpc - xcycle) / 4);
                follower = chkpc;
                return;
            case MSIZ:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                a = memsz;
                follower = chkpc;
                return;
            case CLI:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                a = iena;
                iena = 0;
                follower = chkpc;
                return;
            case STI:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                if (ipend) {
                    trap = ipend & -ipend;
                    ipend ^= trap;
                    iena = 0;
                    follower = interrupt;
                    return;
                }
                iena = 1;
                follower = chkpc;
                return;
            case RTI:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                xsp -= tsp;
                tsp = 0;
                fsp = 0;
                p = tr.readUInt32LE((xsp >> 12) * 4);
                if (!p) {
                    p = rlook(xsp);
                    if (!p) {
                        console.log("RTI kstack fault\n");
                        follower = fatal;
                        return;
                    }
                }
                t = mem.readUInt32LE((xsp ^ p) & -8);
                xsp += 8;
                p = tr.readUInt32LE((xsp >> 12) * 4);
                if (!p) {
                    p = rlook(xsp);
                    if (!p) {
                        console.log("RTI kstack fault\n");
                        follower = fatal;
                        return;
                    }
                }
                pc = mem.readUInt32LE((xsp ^ p) & -8) + tpc;
                xcycle += pc - xpc;
                xsp += 8;
                xpc = pc;
                if (t & USER) {
                    ssp = xsp;
                    xsp = usp;
                    user = 1;
                    tr = tru;
                    tw = twu;
                }
                if (!iena) {
                    if (ipend) {
                        trap = ipend & -ipend;
                        ipend ^= trap;
                        follower = interrupt;
                        return;
                    }
                    iena = 1;
                }
                follower = fixpc;
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
        console.log("mem size = %d\n", memsz);
    }
    mem = Buffer.alloc(memsz);
    if (argv.hasOwnProperty("f")) {
        if (readfs(argv.f) === -1) {
            return -1;
        }
    }
    hdr = readhdr(argv._[0]);
    if (hdr === -1) {
        return -1;
    }
    trk = Buffer.alloc(TB_SZ * 4);
    twk = Buffer.alloc(TB_SZ * 4);
    tru = Buffer.alloc(TB_SZ * 4);
    twu = Buffer.alloc(TB_SZ * 4);
    tr = trk;
    tw = twk;
    if (verbose) {
        console.log("%s : emulating %s\n", cmd, argv._[0]);
    }
    cpu(hdr.entry, memsz - FS_SZ);
    return 0;
}

main(minimist(process.argv.slice(2)));
