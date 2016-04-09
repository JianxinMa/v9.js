/*jslint
     bitwise: true, node: true, stupid: true,
     nomen: true, white: true, maxlen: 80
 */

"use strict";

var minimist = require("minimist"),
    fs = require("fs"),
    keypress = require('keypress');

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
    MSET = 13,
    LL = 14,
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
    LIF = 37,
    LBL = 38,
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
    LBAD = 63,
    SL = 64,
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
    SXF = 78,
    ADDF = 79,
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
    SHRL = 118,
    SRU = 119,
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
    GEF = 131,
    BZ = 132,
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
    BGEF = 145,
    CID = 146,
    CUD = 147,
    CDI = 148,
    CDU = 149,
    CLI = 150,
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
    NET9 = 187,
    POW = 188,
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
    PTE_W = 0x002, // writable
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

var logging = 0, // logging option
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

var a = 0,
    b = 0,
    c = 0,
    ssp = 0,
    usp = 0,
    xpc = 0,
    tpc = 0,
    fpc = 0,
    xsp = 0,
    tsp = 0,
    fsp = 0,
    delta = 0,
    cycle = 0,
    xcycle = 0,
    timer = 0,
    timeout = 0,
    ir = 0,
    kbchar = 0,
    f = 0,
    g = 0;

var cpu = 0,
    execs = [],
    follower = 0,
    fatal = 0,
    exception = 0,
    interrupt = 0,
    fixsp = 0,
    chkpc = 0,
    fixpc = 0,
    chkio = 0,
    decode = 0;

function hex(x) {
    return ("00000000" + (x >>> 0).toString(16)).substr(-8);
}

function printch(ch) {
    if (process.stdout.write(String.fromCharCode(ch))) {
        return 1;
    }
    return -1;
}

var pendkeys = [];

function probekb() {
    if (pendkeys[0]) {
        return pendkeys.shift();
    }
    return -1;
}

function memcmp(a, b) {
    var i, j, x, y;

    j = a.length;
    i = b.length;
    if (j > i) {
        j = i;
    }
    for (i = 0; i < j; i = i + 1) {
        x = a.readUInt8(i);
        y = b.readUInt8(i);
        if (x !== y) {
            return x - y;
        }
    }
    return 0;
}

function cleartlb() {
    var v;

    while (tpages) {
        tpages = tpages - 1;
        v = tpage.readUInt32LE(tpages * 4);
        trk.writeUInt32LE(0, v * 4);
        twk.writeUInt32LE(0, v * 4);
        tru.writeUInt32LE(0, v * 4);
        twu.writeUInt32LE(0, v * 4);
    }
}

function pushtlb(v, p, writable, userable) {
    if (p >= memsz) {
        trap = FMEM;
        vadr = v;
        return 0;
    }
    p = (((v ^ p) & -4096) + 1) >>> 0;
    v = v >>> 12;
    if (!trk.readUInt32LE(v * 4)) {
        if (tpages >= TPAGES) {
            cleartlb();
        }
        tpage.writeUInt32LE(v, tpages * 4);
        tpages = tpages + 1;
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
        return pushtlb(v, v, 1, 1);
    }
    ppde = pdir + ((v >>> 22) << 2);
    pde = mem.readUInt32LE(ppde);
    if (logging) {
        console.log("pde = %d", pde >>> 0);
    }
    if (logging) {
        console.log("rlook #1");
    }
    if (pde & PTE_P) {
        if (!(pde & PTE_A)) {
            mem.writeUInt32LE(pde | PTE_A, ppde);
        }
        if (pde >= memsz) {
            trap = FMEM;
            vadr = v;
            return 0;
        }
        if (logging) {
            console.log("rlook #2");
        }
        ppte = (pde & -4096) + ((v >>> 10) & 0xffc);
        pte = mem.readUInt32LE(ppte);
        if (pte & PTE_P) {
            if (logging) {
                console.log("rlook #3");
            }
            q = pte & pde;
            userable = q & PTE_U;
            if (userable || !user) {
                if (!(pte & PTE_A)) {
                    mem.writeUInt32LE(pte | PTE_A, ppte);
                }
                return pushtlb(v, pte, (pte & PTE_D) && (q & PTE_W), userable);
            }
        }
    }
    trap = FRPAGE;
    if (logging) {
        console.log("rlook trap = %d", trap);
    }
    vadr = v;
    return 0;
}

function wlook(v) {
    var pde, ppde, pte, ppte, q, userable;

    if (!paging) {
        return pushtlb(v, v, 1, 1);
    }
    ppde = pdir + ((v >>> 22) << 2);
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
        ppte = (pde & -4096) + ((v >>> 10) & 0xffc);
        pte = mem.readUInt32LE(ppte);
        if (pte & PTE_P) {
            q = pte & pde;
            userable = q & PTE_U;
            if ((userable || !user) && (q & PTE_W)) {
                if ((pte & (PTE_D | PTE_A)) !== (PTE_D | PTE_A)) {
                    mem.writeUInt32LE(pte | (PTE_D | PTE_A), ppte);
                }
                return pushtlb(v, pte, q & PTE_W, userable);
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
    console.log("  -l");
    console.log("  -m <memsize>");
    console.log("  -f <filesys>");
}

function readfs(filename) {
    var fd, st, i;

    fd = fs.openSync(filename, "r");
    if (fd < 0) {
        console.log("./xem : couldn't open file system %s\n", filename);
        return -1;
    }
    try {
        st = fs.fstatSync(fd);
    } catch (e) {
        console.log("./xem : couldn't stat file system %s\n", filename);
        return -1;
    }
    i = fs.readSync(fd, mem, memsz - FS_SZ, st.size);
    if (i !== st.size) {
        console.log("./xem : failed to read filesystem size %d returned %d\n",
            st.size, i);
        return -1;
    }
    fs.closeSync(fd);
    return 0;
}

function readhdr(filename) {
    var fd, st, buf, hdr, i;

    fd = fs.openSync(filename, "r");
    if (fd < 0) {
        console.log("./xem : couldn't open %s\n", filename);
        return -1;
    }
    try {
        st = fs.fstatSync(fd);
    } catch (e) {
        console.log("./xem : couldn't stat file %s\n", filename);
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
        console.log("./xem : bad hdr.magic\n");
        return -1;
    }
    i = fs.readSync(fd, mem, 0, st.size - 16);
    if (i !== st.size - 16) {
        console.log("./xem : failed to read file %s\n", filename);
        return -1;
    }
    fs.closeSync(fd);
    return hdr;
}

function tickcpu() {
    var i;

    for (i = 0; i < (1 << 20); i = i + 1) {
        if (follower !== 0) {
            a >>>= 0;
            b >>>= 0;
            c >>>= 0;
            ssp >>>= 0;
            usp >>>= 0;
            xpc >>>= 0;
            tpc >>>= 0;
            fpc >>>= 0;
            xsp >>>= 0;
            tsp >>>= 0;
            fsp >>>= 0;
            trap >>>= 0;
            delta >>>= 0;
            cycle >>>= 0;
            xcycle >>>= 0;
            timer >>>= 0;
            timeout >>>= 0;
            if (logging) {
                console.log("cycle = %d pc = %s ir = %s sp = %s" +
                    " a = %d b = %d c = %d trap = %d paging = %d vadr = %d" +
                    " uf = %d ug = %d sf = %d sg = %d",
                    (cycle + ((xpc - xcycle) | 0) / 4) >>> 0, hex(xpc - tpc),
                    hex(ir), hex(xsp - tsp), a, b, c, trap, paging, vadr >>> 0,
                    f >>> 0, g >>> 0, f | 0, g | 0);
            }
            follower();
        } else {
            clearInterval(cpu);
            break;
        }
    }
}

function execHALT() {
    if (user) {
        console.log("halt(%d) cycle = %d\n",
            a, (cycle + ((xpc - xcycle) | 0) / 4) >>> 0);
    }
    follower = 0;
    return;
}

function execIDLE() {
    var ch;

    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    if (!iena) {
        trap = FINST;
        follower = exception;
        return;
    }
    while (true) {
        ch = probekb();
        if (ch !== -1) {
            kbchar = ch;
            if (kbchar === '`'.charCodeAt(0)) {
                console.log("ungraceful exit. cycle = %d\n",
                    (cycle + ((xpc - xcycle) | 0) / 4) >>> 0);
                follower = 0;
                return;
            }
            trap = FKEYBD;
            iena = 0;
            follower = interrupt;
            return;
        }
        cycle = cycle + delta;
        if (timeout) {
            timer = timer + delta;
            if (timer >= timeout) {
                timer = 0;
                trap = FTIMER;
                iena = 0;
                follower = interrupt;
                return;
            }
        }
    }
    follower = exception;
    return;
}

function execMCPY() {
    var t, p, u, v;

    while (c) {
        t = tr.readUInt32LE((b >>> 12) * 4);
        if (!t) {
            t = rlook(b);
            if (!t) {
                follower = exception;
                return;
            }
        }
        p = tw.readUInt32LE((a >>> 12) * 4);
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
        a = a + u;
        b = b + u;
        c = c - u;
    }
    follower = chkpc;
    return;
}

function execMCMP() {
    var t, p, u, v;

    while (true) {
        if (!c) {
            a = 0;
            break;
        }
        t = tr.readUInt32LE((b >>> 12) * 4);
        if (!t) {
            t = rlook(b);
            if (!t) {
                follower = exception;
                return;
            }
        }
        p = tr.readUInt32LE((a >>> 12) * 4);
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
        t = memcmp(mem.slice(p, p + u), mem.slice(t, t + u));
        if (t) {
            a = t;
            b = b + c;
            c = 0;
            break;
        }
        a = a + u;
        b = b + u;
        c = c - u;
    }
    follower = chkpc;
    return;
}

function execMCHR() {
    var t, p, u, v;

    while (true) {
        if (c === 0) {
            a = 0;
            break;
        }
        p = tr.readUInt32LE((a >>> 12) * 4);
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
            a = a + t;
            c = 0;
            break;
        }
        a = a + u;
        c = c - u;
    }
    follower = chkpc;
    return;
}

function execMSET() {
    var p, u, v;

    while (c) {
        p = tw.readUInt32LE((a >>> 12) * 4);
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
        a = a + u;
        c = c - u;
    }
    follower = chkpc;
    return;
}

function execPOW() {
    f = Math.pow(f, g);
    follower = chkpc;
    return;
}

function execATN2() {
    f = Math.atan2(f, g);
    follower = chkpc;
    return;
}

function execFABS() {
    f = Math.abs(f);
    follower = chkpc;
    return;
}

function execATAN() {
    f = Math.atan(f);
    follower = chkpc;
    return;
}

function execLOG() {
    f = Math.log(f);
    follower = chkpc;
    return;
}

function execLOGT() {
    f = Math.log10(f);
    follower = chkpc;
    return;
}

function execEXP() {
    f = Math.exp(f);
    follower = chkpc;
    return;
}

function execFLOR() {
    f = Math.floor(f);
    follower = chkpc;
    return;
}

function execCEIL() {
    f = Math.ceil(f);
    follower = chkpc;
    return;
}

function execHYPO() {
    f = Math.hypot(f, g);
    follower = chkpc;
    return;
}

function execSIN() {
    f = Math.sin(f);
    follower = chkpc;
    return;
}

function execCOS() {
    f = Math.cos(f);
    follower = chkpc;
    return;
}

function execTAN() {
    f = Math.tan(f);
    follower = chkpc;
    return;
}

function execASIN() {
    f = Math.asin(f);
    follower = chkpc;
    return;
}

function execACOS() {
    f = Math.acos(f);
    follower = chkpc;
    return;
}

function execSINH() {
    f = Math.sinh(f);
    follower = chkpc;
    return;
}

function execCOSH() {
    f = Math.cosh(f);
    follower = chkpc;
    return;
}

function execTANH() {
    f = Math.tanh(f);
    follower = chkpc;
    return;
}

function execSQRT() {
    f = Math.sqrt(f);
    follower = chkpc;
    return;
}

function execFMOD() {
    f = Math.fmod(f, g);
    follower = chkpc;
    return;
}

function execENT() {
    if (fsp) {
        fsp = fsp - (ir & -256);
        if (fsp < 0 || fsp > (4096 << 8)) {
            fsp = 0;
        }
    }
    xsp = xsp + (ir >> 8);
    if (fsp) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLEV() {
    var t, p, v;

    if (ir < fsp) {
        t = mem.readUInt32LE(xsp + (ir >> 8)) + tpc;
        fsp = fsp - ((ir + (8 << 8)) & -256);
    } else {
        v = xsp - tsp + (ir >> 8);
        p = tr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = rlook(v);
            if (!p) {
                follower = exception;
                return;
            }
        }
        t = mem.readUInt32LE((v ^ p) & -8) + tpc;
        fsp = 0;
    }
    xsp = xsp + ((ir >> 8) + 8);
    xcycle = xcycle + t - xpc;
    xpc = t;
    if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
        follower = fixpc;
        return;
    }
    follower = chkio;
    return;
}

function execJMP() {
    xcycle = xcycle + (ir >> 8);
    xpc = xpc + ((ir >> 10) << 2);
    if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
        follower = fixpc;
        return;
    }
    follower = chkio;
    return;
}

function execJMPI() {
    var t, p, v;

    v = xpc - tpc + (ir >> 8) + (a << 2);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    t = mem.readUInt32LE((v ^ p) & -4);
    xcycle = xcycle + t;
    xpc = xpc + t;
    if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
        follower = fixpc;
        return;
    }
    follower = chkio;
    return;
}

function execJSR() {
    var p, v;

    if (fsp & (4095 << 8)) {
        xsp = xsp - 8;
        fsp = fsp + (8 << 8);
        mem.writeUInt32LE((xpc - tpc) >>> 0, xsp);
    } else {
        v = xsp - tsp - 8;
        p = tw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = wlook(v);
            if (!p) {
                follower = exception;
                return;
            }
        }
        mem.writeUInt32LE((xpc - tpc) >>> 0, (v ^ p) & -8);
        fsp = 0;
        xsp = xsp - 8;
    }
    xcycle = xcycle + (ir >> 8); // Why not ((ir >> 10) << 2)?
    xpc = xpc + ((ir >> 10) << 2);
    if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
        follower = fixpc;
        return;
    }
    follower = chkio;
    return;
}

function execJSRA() {
    var p, v;

    if (fsp & (4095 << 8)) {
        xsp = xsp - 8;
        fsp = fsp + (8 << 8);
        mem.writeUInt32LE((xpc - tpc) >>> 0, xsp);
    } else {
        v = xsp - tsp - 8;
        p = tw.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = wlook(v);
            if (!p) {
                follower = exception;
                return;
            }
        }
        mem.writeUInt32LE((xpc - tpc) >>> 0, (v ^ p) & -8);
        fsp = 0;
        xsp = xsp - 8;
    }
    xcycle = xcycle + a + tpc - xpc;
    xpc = a + tpc;
    if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
        follower = fixpc;
        return;
    }
    follower = chkio;
    return;
}

function execPSHA() {
    var p, v;

    if (fsp & (4095 << 8)) {
        xsp = xsp - 8;
        fsp = fsp + (8 << 8);
        mem.writeUInt32LE(a, xsp);
        follower = chkpc;
        return;
    }
    v = xsp - tsp - 8;
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt32LE(a, (v ^ p) & -8);
    xsp = xsp - 8;
    fsp = 0;
    follower = fixsp;
    return;
}

function execPSHB() {
    var p, v;

    if (fsp & (4095 << 8)) {
        xsp = xsp - 8;
        fsp = fsp + (8 << 8);
        mem.writeUInt32LE(b, xsp);
        follower = chkpc;
        return;
    }
    v = xsp - tsp - 8;
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt32LE(b, (v ^ p) & -8);
    xsp = xsp - 8;
    fsp = 0;
    follower = fixsp;
    return;
}

function execPSHC() {
    var p, v;

    if (fsp & (4095 << 8)) {
        xsp = xsp - 8;
        fsp = fsp + (8 << 8);
        mem.writeUInt32LE(c, xsp);
        follower = chkpc;
        return;
    }
    v = xsp - tsp - 8;
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt32LE(c, (v ^ p) & -8);
    xsp = xsp - 8;
    fsp = 0;
    follower = fixsp;
    return;
}

function execPSHF() {
    var p, v;

    if (fsp & (4095 << 8)) {
        xsp = xsp - 8;
        fsp = fsp + (8 << 8);
        mem.writeDoubleLE(f, xsp);
        follower = chkpc;
        return;
    }
    v = xsp - tsp - 8;
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeDoubleLE(f, (v ^ p) & -8);
    xsp = xsp - 8;
    fsp = 0;
    follower = fixsp;
    return;
}

function execPSHG() {
    var p, v;

    if (fsp & (4095 << 8)) {
        xsp = xsp - 8;
        fsp = fsp + (8 << 8);
        mem.writeDoubleLE(g, xsp);
        follower = chkpc;
        return;
    }
    v = xsp - tsp - 8;
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeDoubleLE(g, (v ^ p) & -8);
    xsp = xsp - 8;
    fsp = 0;
    follower = fixsp;
    return;
}

function execPSHI() {
    var p, v;

    if (fsp & (4095 << 8)) {
        xsp = xsp - 8;
        fsp = fsp + (8 << 8);
        mem.writeInt32LE((ir >> 8), xsp);
        follower = chkpc;
        return;
    }
    v = xsp - tsp - 8;
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeInt32LE(ir >> 8, (v ^ p) & -8);
    xsp = xsp - 8;
    fsp = 0;
    follower = fixsp;
    return;
}

function execPOPA() {
    var p, v;

    if (fsp) {
        a = mem.readUInt32LE(xsp);
        xsp = xsp + 8;
        fsp = fsp - (8 << 8);
        follower = chkpc;
        return;
    }
    v = xsp - tsp;
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt32LE((v ^ p) & -8);
    xsp = xsp + 8;
    follower = fixsp;
    return;
}

function execPOPB() {
    var p, v;

    if (fsp) {
        b = mem.readUInt32LE(xsp);
        xsp = xsp + 8;
        fsp = fsp - (8 << 8);
        follower = chkpc;
        return;
    }
    v = xsp - tsp;
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt32LE((v ^ p) & -8);
    xsp = xsp + 8;
    follower = fixsp;
    return;
}

function execPOPC() {
    var p, v;

    if (fsp) {
        c = mem.readUInt32LE(xsp);
        xsp = xsp + 8;
        fsp = fsp - (8 << 8);
        follower = chkpc;
        return;
    }
    v = xsp - tsp;
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    c = mem.readUInt32LE((v ^ p) & -8);
    xsp = xsp + 8;
    follower = fixsp;
    return;
}

function execPOPF() {
    var p, v;

    if (fsp) {
        f = mem.readDoubleLE(xsp);
        xsp = xsp + 8;
        fsp = fsp - (8 << 8);
        follower = chkpc;
        return;
    }
    v = xsp - tsp;
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    f = mem.readDoubleLE((v ^ p) & -8);
    xsp = xsp + 8;
    follower = fixsp;
    return;
}

function execPOPG() {
    var p, v;
    if (fsp) {
        g = mem.readDoubleLE(xsp);
        xsp = xsp + 8;
        fsp = fsp - (8 << 8);
        follower = chkpc;
        return;
    }
    v = xsp - tsp;
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    g = mem.readDoubleLE((v ^ p) & -8);
    xsp = xsp + 8;
    follower = fixsp;
    return;
}

function execLEA() {
    a = xsp - tsp + (ir >> 8);
    follower = chkpc;
    return;
}

function execLEAG() {
    a = xpc - tpc + (ir >> 8);
    follower = chkpc;
    return;
}

function execLL() {
    var p, v;

    if (ir < fsp) {
        a = mem.readUInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLLS() {
    var p, v;

    if (ir < fsp) {
        a = mem.readInt16LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readInt16LE((v ^ p) & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLLH() {
    var p, v;

    if (ir < fsp) {
        a = mem.readUInt16LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt16LE((v ^ p) & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLLC() {
    var p, v;

    if (ir < fsp) {
        a = mem.readInt8(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readInt8(v ^ p & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLLB() {
    var p, v;

    if (ir < fsp) {
        a = mem.readUInt8(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt8(v ^ p & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLLD() {
    var p, v;

    if (ir < fsp) {
        f = mem.readDoubleLE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    f = mem.readDoubleLE((v ^ p) & -8);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLLF() {
    var p, v;

    if (ir < fsp) {
        f = mem.readFloatLE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    f = mem.readFloatLE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLG() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt32LE((v ^ p) & -4);
    follower = chkpc;
    return;
}

function execLGS() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readInt16LE((v ^ p) & -2);
    follower = chkpc;
    return;
}

function execLGH() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt16LE((v ^ p) & -2);
    follower = chkpc;
    return;
}

function execLGC() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readInt8(v ^ p & -2);
    follower = chkpc;
    return;
}

function execLGB() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt8(v ^ p & -2);
    follower = chkpc;
    return;
}

function execLGD() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    f = mem.readDoubleLE((v ^ p) & -8);
    follower = chkpc;
    return;
}

function execLGF() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    f = mem.readFloatLE((v ^ p) & -4);
    follower = chkpc;
    return;
}

function execLX() {
    var p, v;

    v = a + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt32LE((v ^ p) & -4);
    follower = chkpc;
    return;
}

function execLXS() {
    var p, v;

    v = a + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readInt16LE((v ^ p) & -2);
    follower = chkpc;
    return;
}

function execLXH() {
    var p, v;

    v = a + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt16LE((v ^ p) & -2);
    follower = chkpc;
    return;
}

function execLXC() {
    var p, v;

    v = a + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readInt8(v ^ p & -2);
    follower = chkpc;
    return;
}

function execLXB() {
    var p, v;

    v = a + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = mem.readUInt8(v ^ p & -2);
    follower = chkpc;
    return;
}

function execLXD() {
    var p, v;

    v = a + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    f = mem.readDoubleLE((v ^ p) & -8);
    follower = chkpc;
    return;
}

function execLXF() {
    var p, v;

    v = a + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    f = mem.readFloatLE((v ^ p) & -4);
    follower = chkpc;
    return;
}

function execLI() {
    a = ir >> 8;
    follower = chkpc;
    return;
}

function execLHI() {
    a = (a << 24) | (ir >>> 8);
    follower = chkpc;
    return;
}

function execLIF() {
    f = (ir >> 8) / 256.0;
    follower = chkpc;
    return;
}

function execLBL() {
    var p, v;

    if (ir < fsp) {
        b = mem.readUInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLBLS() {
    var p, v;

    if (ir < fsp) {
        b = mem.readInt16LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readInt16LE((v ^ p) & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLBLH() {
    var p, v;

    if (ir < fsp) {
        b = mem.readUInt16LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt16LE((v ^ p) & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLBLC() {
    var p, v;

    if (ir < fsp) {
        b = (mem.readInt8(xsp + (ir >> 8)));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readInt8(v ^ p & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLBLB() {
    var p, v;

    if (ir < fsp) {
        b = (mem.readUInt8(xsp + (ir >> 8)));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt8(v ^ p & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLBLD() {
    var p, v;

    if (ir < fsp) {
        g = mem.readDoubleLE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readDoubleLE((v ^ p) & -8);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLBLF() {
    var p, v;

    if (ir < fsp) {
        g = mem.readFloatLE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readFloatLE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLBG() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt32LE((v ^ p) & -4);
    follower = chkpc;
    return;
}

function execLBGS() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readInt16LE((v ^ p) & -2);
    follower = chkpc;
    return;
}

function execLBGH() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt16LE((v ^ p) & -2);
    follower = chkpc;
    return;
}

function execLBGC() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readInt8(v ^ p & -2);
    follower = chkpc;
    return;
}

function execLBGB() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt8(v ^ p & -2);
    follower = chkpc;
    return;
}

function execLBGD() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    g = mem.readDoubleLE((v ^ p) & -8);
    follower = chkpc;
    return;
}

function execLBGF() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    g = mem.readFloatLE((v ^ p) & -4);
    follower = chkpc;
    return;
}

function execLBX() {
    var p, v;

    v = b + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt32LE((v ^ p) & -4);
    follower = chkpc;
    return;
}

function execLBXS() {
    var p, v;

    v = b + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readInt16LE((v ^ p) & -2);
    follower = chkpc;
    return;
}

function execLBXH() {
    var p, v;

    v = b + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt16LE((v ^ p) & -2);
    follower = chkpc;
    return;
}

function execLBXC() {
    var p, v;

    v = b + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readInt8(v ^ p & -2);
    follower = chkpc;
    return;
}

function execLBXB() {
    var p, v;

    v = b + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    b = mem.readUInt8(v ^ p & -2);
    follower = chkpc;
    return;
}

function execLBXD() {
    var p, v;

    v = b + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    g = mem.readDoubleLE((v ^ p) & -8);
    follower = chkpc;
    return;
}

function execLBXF() {
    var p, v;

    v = b + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    g = mem.readFloatLE((v ^ p) & -4);
    follower = chkpc;
    return;
}

function execLBI() {
    b = ir >> 8;
    follower = chkpc;
    return;
}

function execLBHI() {
    b = (b << 24) | (ir >>> 8);
    follower = chkpc;
    return;
}

function execLBIF() {
    g = (ir >> 8) / 256.0;
    follower = chkpc;
    return;
}

function execLCL() {
    var p, v;

    if (ir < fsp) {
        c = mem.readUInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    c = mem.readUInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execLBA() {
    b = a;
    follower = chkpc;
    return;
}

function execLCA() {
    c = a;
    follower = chkpc;
    return;
}

function execLBAD() {
    g = f;
    follower = chkpc;
    return;
}

function execSL() {
    var p, v;

    if (ir < fsp) {
        mem.writeUInt32LE(a, xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt32LE(a, (v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execSLH() {
    var p, v;

    if (ir < fsp) {
        mem.writeUInt16LE(a, xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt16LE(a, (v ^ p) & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execSLB() {
    var p, v;

    if (ir < fsp) {
        mem.writeUInt8(a, xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt8(a, v ^ p & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execSLD() {
    var p, v;

    if (ir < fsp) {
        mem.writeDoubleLE(f, xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeDoubleLE(f, (v ^ p) & -8);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execSLF() {
    var p, v;

    if (ir < fsp) {
        mem.writeFloatLE(f, xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeFloatLE(f, (v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execSG() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt32LE(a, (v ^ p) & -4);
    follower = chkpc;
    return;
}

function execSGH() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt16LE(a, (v ^ p) & -2);
    follower = chkpc;
    return;
}

function execSGB() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt8(a, v ^ p & -2);
    follower = chkpc;
    return;
}

function execSGD() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeDoubleLE(f, (v ^ p) & -8);
    follower = chkpc;
    return;
}

function execSGF() {
    var p, v;

    v = xpc - tpc + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeFloatLE(f, (v ^ p) & -4);
    follower = chkpc;
    return;
}

function execSX() {
    var p, v;

    v = b + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt32LE(a, (v ^ p) & -4);
    follower = chkpc;
    return;
}

function execSXH() {
    var p, v;

    v = b + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt16LE(a, (v ^ p) & -2);
    follower = chkpc;
    return;
}

function execSXB() {
    var p, v;

    v = b + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeUInt8(a, v ^ p & -2);
    follower = chkpc;
    return;
}

function execSXD() {
    var p, v;

    v = b + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeDoubleLE(f, (v ^ p) & -8);
    follower = chkpc;
    return;
}

function execSXF() {
    var p, v;

    v = b + (ir >> 8);
    p = tw.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = wlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    mem.writeFloatLE(f, (v ^ p) & -4);
    follower = chkpc;
    return;
}

function execADDF() {
    f = f + g;
    follower = chkpc;
    return;
}

function execSUBF() {
    f = f - g;
    follower = chkpc;
    return;
}

function execMULF() {
    f = f * g;
    follower = chkpc;
    return;
}

function execDIVF() {
    if (g === 0.0) {
        trap = FARITH;
        follower = exception;
        return;
    }
    f = f / g;
    follower = chkpc;
    return;
}

function execADD() {
    a = a + b;
    follower = chkpc;
    return;
}

function execADDI() {
    a = a + (ir >> 8);
    follower = chkpc;
    return;
}

function execADDL() {
    var p, v;

    if (ir < fsp) {
        a = a + mem.readUInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = a + mem.readUInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execSUB() {
    a = a - b;
    follower = chkpc;
    return;
}

function execSUBI() {
    a = a - (ir >> 8);
    follower = chkpc;
    return;
}

function execSUBL() {
    var p, v;

    if (ir < fsp) {
        a = a - mem.readUInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = a - mem.readUInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execMUL() {
    a = a * b;
    follower = chkpc;
    return;
}

function execMULI() {
    a = a * (ir >> 8);
    follower = chkpc;
    return;
}

function execMULL() {
    var p, v;

    if (ir < fsp) {
        a = a * mem.readInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = a * mem.readInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execDIV() {
    if (!b) {
        trap = FARITH;
        follower = exception;
        return;
    }
    a = (a / b) >>> 0;
    follower = chkpc;
    return;
}

function execDIVI() {
    var t;

    t = ir >> 8;
    if (!t) {
        trap = FARITH;
        follower = exception;
        return;
    }
    a = (a / t) >>> 0;
    follower = chkpc;
    return;
}

function execDIVL() {
    var p, v, t;

    if (ir < fsp) {
        t = mem.readUInt32LE(xsp + (ir >> 8));
        if (!t) {
            trap = FARITH;
            follower = exception;
            return;
        }
        a = (a / t) >>> 0;
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    t = mem.readUInt32LE((v ^ p) & -4);
    if (!t) {
        trap = FARITH;
        follower = exception;
        return;
    }
    a = (a / t) >>> 0;
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execDVU() {
    if (!b) {
        trap = FARITH;
        follower = exception;
        return;
    }
    a = (a / b) >>> 0;
    follower = chkpc;
    return;
}

function execDVUI() {
    var t;

    t = (ir >> 8);
    if (!t) {
        trap = FARITH;
        follower = exception;
        return;
    }
    a = (a / t) >>> 0;
    follower = chkpc;
    return;
}

function execDVUL() {
    var p, v, t;

    if (ir < fsp) {
        t = mem.readUInt32LE(xsp + (ir >> 8));
        if (!t) {
            trap = FARITH;
            follower = exception;
            return;
        }
        a = (a / t) >>> 0;
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    t = mem.readUInt32LE((v ^ p) & -4);
    if (!t) {
        trap = FARITH;
        follower = exception;
        return;
    }
    a = (a / t) >>> 0;
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execMOD() {
    a = (a % b);
    follower = chkpc;
    return;
}

function execMODI() {
    a = (a % (ir >> 8));
    follower = chkpc;
    return;
}

function execMODL() {
    var p, v;

    if (ir < fsp) {
        a = (a % mem.readUInt32LE(xsp + (ir >> 8)));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = (a % mem.readUInt32LE((v ^ p) & -4));
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execMDU() {
    a %= b;
    follower = chkpc;
    return;
}

function execMDUI() {
    a %= (ir >> 8);
    follower = chkpc;
    return;
}

function execMDUL() {
    var p, v;

    if (ir < fsp) {
        a %= mem.readUInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a %= mem.readUInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execAND() {
    a &= b;
    follower = chkpc;
    return;
}

function execANDI() {
    a &= ir >> 8;
    follower = chkpc;
    return;
}

function execANDL() {
    var p, v;

    if (ir < fsp) {
        a &= mem.readUInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a &= mem.readUInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execOR() {
    a = a | b;
    follower = chkpc;
    return;
}

function execORI() {
    a = a | (ir >> 8);
    follower = chkpc;
    return;
}

function execORL() {
    var p, v;

    if (ir < fsp) {
        a = (a | mem.readUInt32LE(xsp + (ir >> 8)));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = (a | mem.readUInt32LE((v ^ p) & -4));
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execXOR() {
    a ^= b;
    follower = chkpc;
    return;
}

function execXORI() {
    a ^= ir >> 8;
    follower = chkpc;
    return;
}

function execXORL() {
    var p, v;

    if (ir < fsp) {
        a ^= mem.readUInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a ^= mem.readUInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execSHL() {
    a <<= b;
    follower = chkpc;
    return;
}

function execSHLI() {
    a <<= ir >> 8;
    follower = chkpc;
    return;
}

function execSHLL() {
    var p, v;

    if (ir < fsp) {
        a <<= mem.readUInt32LE(xsp + (ir >> 8));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a <<= mem.readUInt32LE((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execSHR() {
    a = (a >> b);
    follower = chkpc;
    return;
}

function execSHRI() {
    a = (a >> (ir >> 8));
    follower = chkpc;
    return;
}

function execSHRL() {
    var p, v;

    if (ir < fsp) {
        a = (a >> mem.readUInt32LE(xsp + (ir >> 8)));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = (a >> mem.readUInt32LE((v ^ p) & -4));
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execSRU() {
    a >>= b;
    follower = chkpc;
    return;
}

function execSRUI() {
    a >>>= ir >> 8;
    follower = chkpc;
    return;
}

function execSRUL() {
    var p, v;

    if (ir < fsp) {
        a = (a >> mem.readUInt32LE(xsp + (ir >> 8)));
        follower = chkpc;
        return;
    }
    v = xsp - tsp + (ir >> 8);
    p = tr.readUInt32LE((v >>> 12) * 4);
    if (!p) {
        p = rlook(v);
        if (!p) {
            follower = exception;
            return;
        }
    }
    a = (a >> mem.readUInt32LE((v ^ p) & -4));
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
        follower = chkpc;
        return;
    }
    follower = fixsp;
    return;
}

function execEQ() {
    a = (a === b);
    follower = chkpc;
    return;
}

function execEQF() {
    a = (f === g);
    follower = chkpc;
    return;
}

function execNE() {
    a = (a !== b);
    follower = chkpc;
    return;
}

function execNEF() {
    a = (f !== g);
    follower = chkpc;
    return;
}

function execLT() {
    a = (a < b);
    follower = chkpc;
    return;
}

function execLTU() {
    a = (a < b);
    follower = chkpc;
    return;
}

function execLTF() {
    a = (f < g);
    follower = chkpc;
    return;
}

function execGE() {
    a = (a >= b);
    follower = chkpc;
    return;
}

function execGEU() {
    a = (a >= b);
    follower = chkpc;
    return;
}

function execGEF() {
    a = (f >= g);
    follower = chkpc;
    return;
}

function execBZ() {
    if (!a) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBZF() {
    if (!f) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBNZ() {
    if (a) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBNZF() {
    if (f) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBE() {
    if (a === b) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBEF() {
    if (f === g) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBNE() {
    if (a !== b) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBNEF() {
    if (f !== g) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBLT() {
    if (a < b) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBLTU() {
    if (a < b) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBLTF() {
    if (f < g) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBGE() {
    if ((a | 0) >= (b | 0)) {
        xcycle = xcycle + (ir >> 8);
        xpc = xpc + ((ir >> 10) << 2);
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBGEU() {
    if (a >= b) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execBGEF() {
    if (f >= g) {
        xcycle = (xcycle + (ir >> 8));
        xpc = (xpc + ((ir >> 10) << 2));
        if ((xpc - fpc) >>> 0 < (-4096) >>> 0) {
            follower = fixpc;
            return;
        }
        follower = chkio;
        return;
    }
    follower = chkpc;
    return;
}

function execCID() {
    f = a | 0;
    follower = chkpc;
    return;
}

function execCUD() {
    f = a >>> 0;
    follower = chkpc;
    return;
}

function execCDI() {
    a = f | 0;
    follower = chkpc;
    return;
}

function execCDU() {
    a = f >>> 0;
    follower = chkpc;
    return;
}

function execBIN() {
    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    a = kbchar;
    kbchar = -1;
    follower = chkpc;
    return;
}

function execBOUT() {
    var ch;

    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    if (a !== 1) {
        console.log("bad write a=%d\n", a);
        follower = 0;
        return;
    }
    ch = b;
    a = (printch(ch));
    follower = chkpc;
    return;
}

function execSSP() {
    xsp = a;
    tsp = 0;
    fsp = 0;
    follower = fixsp;
    return;
}

function execNOP() {
    follower = chkpc;
    return;
}

function execCYC() {

    a = (cycle + ((xpc - xcycle) | 0) / 4) >>> 0;
    follower = chkpc;
    return;
}

function execMSIZ() {

    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    a = memsz;
    follower = chkpc;
    return;
}

function execCLI() {

    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    a = iena;
    iena = 0;
    follower = chkpc;
    return;
}

function execSTI() {
    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    if (ipend) {
        trap = (ipend & -ipend);
        ipend ^= trap;
        iena = 0;
        follower = interrupt;
        return;
    }
    iena = (1);
    follower = chkpc;
    return;
}

function execRTI() {
    var t, p, pc;

    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    xsp = (xsp - tsp);
    tsp = 0;
    fsp = 0;
    p = (tr.readUInt32LE((xsp >>> 12) * 4));
    if (!p) {
        p = (rlook(xsp));
        if (!p) {
            console.log("RTI kstack fault\n");
            follower = fatal;
            return;
        }
    }
    t = (mem.readUInt32LE((xsp ^ p) & -8));
    xsp = xsp + 8;
    p = (tr.readUInt32LE((xsp >>> 12) * 4));
    if (!p) {
        p = (rlook(xsp));
        if (!p) {
            console.log("RTI kstack fault\n");
            follower = fatal;
            return;
        }
    }
    pc = (mem.readUInt32LE((xsp ^ p) & -8) + tpc);
    xcycle = (xcycle + (pc - xpc));
    xsp = xsp + 8;
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
            trap = (ipend & -ipend);
            ipend ^= trap;
            follower = interrupt;
            return;
        }
        iena = (1);
    }
    follower = fixpc;
    return;
}

function execIVEC() {
    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    ivec = a;
    follower = chkpc;
    return;
}

function execPDIR() {
    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    if (a > memsz) {
        trap = FMEM;
        follower = exception;
        return;
    }
    pdir = a & -4096;
    cleartlb();
    fsp = 0;
    follower = fixpc;
    return;
}

function execSPAG() {
    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    if (a && !pdir) {
        trap = FMEM;
        follower = exception;
        return;
    }
    paging = a;
    cleartlb();
    fsp = 0;
    follower = fixpc;
    return;
}

function execTIME() {
    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    if (ir >> 8) {
        console.log("timer%d=%d timeout=%d\n",
            ir >> 8, timer, timeout);
        follower = chkpc;
        return;
    }
    timeout = a;
    follower = chkpc;
    return;
}

function execLVAD() {
    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    a = vadr;
    follower = chkpc;
    return;
}

function execTRAP() {
    trap = FSYS;
    follower = exception;
    return;
}

function execLUSP() {
    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    a = usp;
    follower = chkpc;
    return;
}

function execSUSP() {
    if (user) {
        trap = FPRIV;
        follower = exception;
        return;
    }
    usp = a;
    follower = chkpc;
    return;
}

function execDefault() {
    console.log("%d not implemented!", ir & 0xFF);
    trap = FINST;
    follower = exception;
    return;
}

function firecpu(pc, sp) {
    var i;

    execs = [];
    for (i = 0; i <= 0xFF; i = i + 1) {
        execs.push(execDefault);
    }
    execs[HALT] = execHALT;
    execs[ENT] = execENT;
    execs[LEV] = execLEV;
    execs[JMP] = execJMP;
    execs[JMPI] = execJMPI;
    execs[JSR] = execJSR;
    execs[JSRA] = execJSRA;
    execs[LEA] = execLEA;
    execs[LEAG] = execLEAG;
    execs[CYC] = execCYC;
    execs[MCPY] = execMCPY;
    execs[MCMP] = execMCMP;
    execs[MCHR] = execMCHR;
    execs[MSET] = execMSET;
    execs[LL] = execLL;
    execs[LLS] = execLLS;
    execs[LLH] = execLLH;
    execs[LLC] = execLLC;
    execs[LLB] = execLLB;
    execs[LLD] = execLLD;
    execs[LLF] = execLLF;
    execs[LG] = execLG;
    execs[LGS] = execLGS;
    execs[LGH] = execLGH;
    execs[LGC] = execLGC;
    execs[LGB] = execLGB;
    execs[LGD] = execLGD;
    execs[LGF] = execLGF;
    execs[LX] = execLX;
    execs[LXS] = execLXS;
    execs[LXH] = execLXH;
    execs[LXC] = execLXC;
    execs[LXB] = execLXB;
    execs[LXD] = execLXD;
    execs[LXF] = execLXF;
    execs[LI] = execLI;
    execs[LHI] = execLHI;
    execs[LIF] = execLIF;
    execs[LBL] = execLBL;
    execs[LBLS] = execLBLS;
    execs[LBLH] = execLBLH;
    execs[LBLC] = execLBLC;
    execs[LBLB] = execLBLB;
    execs[LBLD] = execLBLD;
    execs[LBLF] = execLBLF;
    execs[LBG] = execLBG;
    execs[LBGS] = execLBGS;
    execs[LBGH] = execLBGH;
    execs[LBGC] = execLBGC;
    execs[LBGB] = execLBGB;
    execs[LBGD] = execLBGD;
    execs[LBGF] = execLBGF;
    execs[LBX] = execLBX;
    execs[LBXS] = execLBXS;
    execs[LBXH] = execLBXH;
    execs[LBXC] = execLBXC;
    execs[LBXB] = execLBXB;
    execs[LBXD] = execLBXD;
    execs[LBXF] = execLBXF;
    execs[LBI] = execLBI;
    execs[LBHI] = execLBHI;
    execs[LBIF] = execLBIF;
    execs[LBA] = execLBA;
    execs[LBAD] = execLBAD;
    execs[SL] = execSL;
    execs[SLH] = execSLH;
    execs[SLB] = execSLB;
    execs[SLD] = execSLD;
    execs[SLF] = execSLF;
    execs[SG] = execSG;
    execs[SGH] = execSGH;
    execs[SGB] = execSGB;
    execs[SGD] = execSGD;
    execs[SGF] = execSGF;
    execs[SX] = execSX;
    execs[SXH] = execSXH;
    execs[SXB] = execSXB;
    execs[SXD] = execSXD;
    execs[SXF] = execSXF;
    execs[ADDF] = execADDF;
    execs[SUBF] = execSUBF;
    execs[MULF] = execMULF;
    execs[DIVF] = execDIVF;
    execs[ADD] = execADD;
    execs[ADDI] = execADDI;
    execs[ADDL] = execADDL;
    execs[SUB] = execSUB;
    execs[SUBI] = execSUBI;
    execs[SUBL] = execSUBL;
    execs[MUL] = execMUL;
    execs[MULI] = execMULI;
    execs[MULL] = execMULL;
    execs[DIV] = execDIV;
    execs[DIVI] = execDIVI;
    execs[DIVL] = execDIVL;
    execs[DVU] = execDVU;
    execs[DVUI] = execDVUI;
    execs[DVUL] = execDVUL;
    execs[MOD] = execMOD;
    execs[MODI] = execMODI;
    execs[MODL] = execMODL;
    execs[MDU] = execMDU;
    execs[MDUI] = execMDUI;
    execs[MDUL] = execMDUL;
    execs[AND] = execAND;
    execs[ANDI] = execANDI;
    execs[ANDL] = execANDL;
    execs[OR] = execOR;
    execs[ORI] = execORI;
    execs[ORL] = execORL;
    execs[XOR] = execXOR;
    execs[XORI] = execXORI;
    execs[XORL] = execXORL;
    execs[SHL] = execSHL;
    execs[SHLI] = execSHLI;
    execs[SHLL] = execSHLL;
    execs[SHR] = execSHR;
    execs[SHRI] = execSHRI;
    execs[SHRL] = execSHRL;
    execs[SRU] = execSRU;
    execs[SRUI] = execSRUI;
    execs[SRUL] = execSRUL;
    execs[EQ] = execEQ;
    execs[EQF] = execEQF;
    execs[NE] = execNE;
    execs[NEF] = execNEF;
    execs[LT] = execLT;
    execs[LTU] = execLTU;
    execs[LTF] = execLTF;
    execs[GE] = execGE;
    execs[GEU] = execGEU;
    execs[GEF] = execGEF;
    execs[BZ] = execBZ;
    execs[BZF] = execBZF;
    execs[BNZ] = execBNZ;
    execs[BNZF] = execBNZF;
    execs[BE] = execBE;
    execs[BEF] = execBEF;
    execs[BNE] = execBNE;
    execs[BNEF] = execBNEF;
    execs[BLT] = execBLT;
    execs[BLTU] = execBLTU;
    execs[BLTF] = execBLTF;
    execs[BGE] = execBGE;
    execs[BGEU] = execBGEU;
    execs[BGEF] = execBGEF;
    execs[CID] = execCID;
    execs[CUD] = execCUD;
    execs[CDI] = execCDI;
    execs[CDU] = execCDU;
    execs[CLI] = execCLI;
    execs[STI] = execSTI;
    execs[RTI] = execRTI;
    execs[BIN] = execBIN;
    execs[BOUT] = execBOUT;
    execs[NOP] = execNOP;
    execs[SSP] = execSSP;
    execs[PSHA] = execPSHA;
    execs[PSHI] = execPSHI;
    execs[PSHF] = execPSHF;
    execs[PSHB] = execPSHB;
    execs[POPB] = execPOPB;
    execs[POPF] = execPOPF;
    execs[POPA] = execPOPA;
    execs[IVEC] = execIVEC;
    execs[PDIR] = execPDIR;
    execs[SPAG] = execSPAG;
    execs[TIME] = execTIME;
    execs[LVAD] = execLVAD;
    execs[TRAP] = execTRAP;
    execs[LUSP] = execLUSP;
    execs[SUSP] = execSUSP;
    execs[LCL] = execLCL;
    execs[LCA] = execLCA;
    execs[PSHC] = execPSHC;
    execs[POPC] = execPOPC;
    execs[MSIZ] = execMSIZ;
    execs[PSHG] = execPSHG;
    execs[POPG] = execPOPG;
    execs[POW] = execPOW;
    execs[ATN2] = execATN2;
    execs[FABS] = execFABS;
    execs[ATAN] = execATAN;
    execs[LOG] = execLOG;
    execs[LOGT] = execLOGT;
    execs[EXP] = execEXP;
    execs[FLOR] = execFLOR;
    execs[CEIL] = execCEIL;
    execs[HYPO] = execHYPO;
    execs[SIN] = execSIN;
    execs[COS] = execCOS;
    execs[TAN] = execTAN;
    execs[ASIN] = execASIN;
    execs[ACOS] = execACOS;
    execs[SINH] = execSINH;
    execs[COSH] = execCOSH;
    execs[TANH] = execTANH;
    execs[SQRT] = execSQRT;
    execs[FMOD] = execFMOD;
    execs[IDLE] = execIDLE;
    fatal = function() {
        if (logging) {
            console.log("fatal <");
        }
        console.log("processor halted! cycle = %d pc = %s ir = %s sp = %s" +
            " a = %d b = %d c = %d trap = %d\n",
            (cycle + ((xpc - xcycle) | 0) / 4) >>> 0, hex(xpc - tpc), hex(ir),
            hex(xsp - tsp), a, b, c, trap);
        follower = 0;
    };
    exception = function() {
        if (logging) {
            console.log("exception <");
        }
        if (!iena) {
            console.log("exception in interrupt handler\n");
            follower = fatal;
        } else {
            follower = interrupt;
        }
    };
    interrupt = function() {
        var p;

        if (logging) {
            console.log("interrupt <");
        }
        xsp = xsp - tsp;
        tsp = 0;
        fsp = 0;
        if (user) {
            usp = xsp;
            xsp = ssp;
            user = 0;
            tr = trk;
            tw = twk;
            trap = trap | USER;
        }
        xsp = xsp - 8;
        p = tw.readUInt32LE((xsp >>> 12) * 4);
        if (!p) {
            p = wlook(xsp);
            if (!p) {
                console.log("kstack fault!\n");
                follower = fatal;
                return;
            }
        }
        mem.writeUInt32LE((xpc - tpc) >>> 0, (xsp ^ p) & -8);
        xsp = xsp - 8;
        p = tw.readUInt32LE((xsp >>> 12) * 4);
        if (!p) {
            p = wlook(xsp);
            if (!p) {
                console.log("kstack fault\n");
                follower = fatal;
                return;
            }
        }
        mem.writeUInt32LE(trap, (xsp ^ p) & -8);
        xcycle = xcycle + ivec + tpc - xpc;
        xpc = ivec + tpc;
        follower = fixpc;
    };
    fixsp = function() {
        var v, p;

        if (logging) {
            console.log("fixsp <");
        }
        v = xsp - tsp;
        p = tw.readUInt32LE((v >>> 12) * 4);
        if (p) {
            xsp = v ^ (p - 1);
            tsp = xsp - v;
            fsp = (4096 - (xsp & 4095)) << 8;
        }
        follower = chkpc;
    };
    chkpc = function() {
        if (logging) {
            console.log("chkpc <");
        }
        if (xpc === fpc) {
            follower = fixpc;
        } else {
            follower = decode;
        }
    };
    fixpc = function() {
        var v, p;

        if (logging) {
            console.log("fixpc <");
        }
        v = xpc - tpc;
        p = tr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = rlook(v);
            if (!p) {
                trap = FIPAGE;
                follower = exception;
                return;
            }
        }
        xcycle = xcycle - tpc;
        xpc = v ^ (p - 1);
        tpc = xpc - v;
        xcycle = xcycle + tpc;
        fpc = (xpc + 4096) & -4096;
        follower = chkio;
    };
    chkio = function() {
        var ch;

        if (logging) {
            console.log("chkio <");
        }
        if (xpc > xcycle) {
            cycle = cycle + delta;
            xcycle = xcycle + delta * 4;
            if (iena || !(ipend & FKEYBD)) {
                ch = probekb();
                if (ch !== -1) {
                    kbchar = ch;
                    if (kbchar === '`'.charCodeAt(0)) {
                        console.log("ungraceful exit. cycle = %d\n",
                            (cycle + ((xpc - xcycle) | 0) / 4) >>> 0);
                        follower = 0;
                        return;
                    }
                    if (iena) {
                        trap = FKEYBD;
                        iena = 0;
                        follower = interrupt;
                        return;
                    }
                    ipend = ipend | FKEYBD;
                }
            }
            if (timeout) {
                timer = timer + delta;
                if (timer >= timeout) {
                    timer = 0;
                    if (iena) {
                        trap = FTIMER;
                        iena = 0;
                        follower = interrupt;
                        return;
                    }
                    ipend = ipend | FTIMER;
                }
            }
        }
        follower = decode;
    };
    decode = function() {
        ir = mem.readUInt32LE(xpc);
        xpc = xpc + 4;
        if (logging) {
            console.log("ASM #%d : %d", ir & 0xFF, ir >>> 0);
        }
        (execs[ir & 0xFF])();
    };
    a = 0;
    b = 0;
    c = 0;
    ssp = 0;
    usp = 0;
    xpc = 0;
    tpc = -pc;
    fpc = 0;
    xsp = sp;
    tsp = 0;
    fsp = 0;
    delta = 4096;
    cycle = 4096;
    xcycle = delta * 4;
    timer = 0;
    timeout = 0;
    ir = 0;
    kbchar = -1;
    f = 0.0;
    g = 0.0;
    follower = fixpc;
    cpu = setInterval(tickcpu, 1);
}

function main(argv) {
    var hdr;

    if (argv._.length !== 1) {
        usage();
        return -1;
    }
    logging = argv.hasOwnProperty("l");
    if (argv.hasOwnProperty("m")) {
        memsz = Number(argv.m) * 1024 * 1024;
    } else {
        memsz = MEM_SZ;
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
    firecpu(hdr.entry, memsz - FS_SZ);
    return 0;
}

main(minimist(process.argv.slice(2)));
