/*jslint
    bitwise: true, node: true, stupid: true, nomen: true, white: true
 */

"use strict";

var minimist = require("minimist"),
    assert = require("assert"),
    fs = require("fs"),
    keypress = require('keypress');

function sg(x) {
    return x | 0;
}

function us(x) {
    return x >>> 0;
}

var HALT = us(0),
    ENT = us(1),
    LEV = us(2),
    JMP = us(3),
    JMPI = us(4),
    JSR = us(5),
    JSRA = us(6),
    LEA = us(7),
    LEAG = us(8),
    CYC = us(9),
    MCPY = us(10),
    MCMP = us(11),
    MCHR = us(12),
    MSET = us(13),
    LL = us(14),
    LLS = us(15),
    LLH = us(16),
    LLC = us(17),
    LLB = us(18),
    LLD = us(19),
    LLF = us(20),
    LG = us(21),
    LGS = us(22),
    LGH = us(23),
    LGC = us(24),
    LGB = us(25),
    LGD = us(26),
    LGF = us(27),
    LX = us(28),
    LXS = us(29),
    LXH = us(30),
    LXC = us(31),
    LXB = us(32),
    LXD = us(33),
    LXF = us(34),
    LI = us(35),
    LHI = us(36),
    LIF = us(37),
    LBL = us(38),
    LBLS = us(39),
    LBLH = us(40),
    LBLC = us(41),
    LBLB = us(42),
    LBLD = us(43),
    LBLF = us(44),
    LBG = us(45),
    LBGS = us(46),
    LBGH = us(47),
    LBGC = us(48),
    LBGB = us(49),
    LBGD = us(50),
    LBGF = us(51),
    LBX = us(52),
    LBXS = us(53),
    LBXH = us(54),
    LBXC = us(55),
    LBXB = us(56),
    LBXD = us(57),
    LBXF = us(58),
    LBI = us(59),
    LBHI = us(60),
    LBIF = us(61),
    LBA = us(62),
    LBAD = us(63),
    SL = us(64),
    SLH = us(65),
    SLB = us(66),
    SLD = us(67),
    SLF = us(68),
    SG = us(69),
    SGH = us(70),
    SGB = us(71),
    SGD = us(72),
    SGF = us(73),
    SX = us(74),
    SXH = us(75),
    SXB = us(76),
    SXD = us(77),
    SXF = us(78),
    ADDF = us(79),
    SUBF = us(80),
    MULF = us(81),
    DIVF = us(82),
    ADD = us(83),
    ADDI = us(84),
    ADDL = us(85),
    SUB = us(86),
    SUBI = us(87),
    SUBL = us(88),
    MUL = us(89),
    MULI = us(90),
    MULL = us(91),
    DIV = us(92),
    DIVI = us(93),
    DIVL = us(94),
    DVU = us(95),
    DVUI = us(96),
    DVUL = us(97),
    MOD = us(98),
    MODI = us(99),
    MODL = us(100),
    MDU = us(101),
    MDUI = us(102),
    MDUL = us(103),
    AND = us(104),
    ANDI = us(105),
    ANDL = us(106),
    OR = us(107),
    ORI = us(108),
    ORL = us(109),
    XOR = us(110),
    XORI = us(111),
    XORL = us(112),
    SHL = us(113),
    SHLI = us(114),
    SHLL = us(115),
    SHR = us(116),
    SHRI = us(117),
    SHRL = us(118),
    SRU = us(119),
    SRUI = us(120),
    SRUL = us(121),
    EQ = us(122),
    EQF = us(123),
    NE = us(124),
    NEF = us(125),
    LT = us(126),
    LTU = us(127),
    LTF = us(128),
    GE = us(129),
    GEU = us(130),
    GEF = us(131),
    BZ = us(132),
    BZF = us(133),
    BNZ = us(134),
    BNZF = us(135),
    BE = us(136),
    BEF = us(137),
    BNE = us(138),
    BNEF = us(139),
    BLT = us(140),
    BLTU = us(141),
    BLTF = us(142),
    BGE = us(143),
    BGEU = us(144),
    BGEF = us(145),
    CID = us(146),
    CUD = us(147),
    CDI = us(148),
    CDU = us(149),
    CLI = us(150),
    STI = us(151),
    RTI = us(152),
    BIN = us(153),
    BOUT = us(154),
    NOP = us(155),
    SSP = us(156),
    PSHA = us(157),
    PSHI = us(158),
    PSHF = us(159),
    PSHB = us(160),
    POPB = us(161),
    POPF = us(162),
    POPA = us(163),
    IVEC = us(164),
    PDIR = us(165),
    SPAG = us(166),
    TIME = us(167),
    LVAD = us(168),
    TRAP = us(169),
    LUSP = us(170),
    SUSP = us(171),
    LCL = us(172),
    LCA = us(173),
    PSHC = us(174),
    POPC = us(175),
    MSIZ = us(176),
    PSHG = us(177),
    POPG = us(178),
    NET1 = us(179),
    NET2 = us(180),
    NET3 = us(181),
    NET4 = us(182),
    NET5 = us(183),
    NET6 = us(184),
    NET7 = us(185),
    NET8 = us(186),
    NET9 = us(187),
    POW = us(188),
    ATN2 = us(189),
    FABS = us(190),
    ATAN = us(191),
    LOG = us(192),
    LOGT = us(193),
    EXP = us(194),
    FLOR = us(195),
    CEIL = us(196),
    HYPO = us(197),
    SIN = us(198),
    COS = us(199),
    TAN = us(200),
    ASIN = us(201),
    ACOS = us(202),
    SINH = us(203),
    COSH = us(204),
    TANH = us(205),
    SQRT = us(206),
    FMOD = us(207),
    IDLE = us(208);

var MEM_SZ = us(128 * 1024 * 1024), // default memory size of vm (128M)
    TB_SZ = us(1024 * 1024), // page translation buffer size (4G / page_sz)
    FS_SZ = us(4 * 1024 * 1024), // ram file system size (4M)
    TPAGES = us(4096); // maximum cached page translations

var PTE_P = us(0x001), // present
    PTE_W = us(0x002), // writeable
    PTE_U = us(0x004), // user
    PTE_A = us(0x020), // accessed
    PTE_D = us(0x040); // dirty

var FMEM = us(0), // bad physical address
    FTIMER = us(1), // timer interrupt
    FKEYBD = us(2), // keyboard interrupt
    FPRIV = us(3), // privileged instruction
    FINST = us(4), // illegal instruction
    FSYS = us(5), // software trap
    FARITH = us(6), // arithmetic trap
    FIPAGE = us(7), // page fault on opcode fetch
    FWPAGE = us(8), // page fault on write
    FRPAGE = us(9), // page fault on read
    USER = us(16); // user mode exception (16)

var verbose = us(0), // chatty option -v
    mem = us(0), // physical memory
    memsz = us(0), // physical memory size
    user = us(0), // user mode
    iena = us(0), // interrupt enable
    ipend = us(0), // interrupt pending
    trap = us(0), // fault code
    ivec = us(0), // interrupt vector
    vadr = us(0), // bad virtual address
    paging = us(0), // virtual memory enabled
    pdir = us(0), // page directory
    tpage = Buffer.alloc(us(TPAGES * 4)), // valid page translations
    tpages = us(0), // number of cached page translations
    trk = us(0), // kernel read page translation tables
    twk = us(0), // kernel write page translation tables
    tru = us(0), // user read page translation tables
    twu = us(0), // user write page translation tables
    tr = us(0), // current read page translation tables
    tw = us(0); // current write page translation tables

var cmd = "./xem";

function hex(x) {
    return ("00000000" + us(x).toString(16)).substr(-8);
}

function printch(ch) {
    ch = us(ch & 0x7F);
    if (process.stdout.write(String.fromCharCode(ch))) {
        return 1;
    }
    return -1;
}

var pendkeys = [];

function initkb() {
    keypress(process.stdin);
    process.stdin.on('keypress', function(ch) {
        var c;

        c = ch.charCodeAt(0);
        if (0 <= c && c <= 0x7F) {
            pendkeys.push(c);
        }
    });
    process.stdin.setRawMode(true);
    process.stdin.resume();
}

function shutkb() {
    process.stdin.pause();
}

function probekb() {
    if (pendkeys.length > 0) {
        return pendkeys.shift();
    }
    return -1;
}

function flush() {
    var v;

    while (tpages) {
        tpages = us(tpages - 1);
        v = tpage.readUInt32LE(us(tpages * 4));
        trk.writeUInt32LE(us(0), us(v * 4));
        twk.writeUInt32LE(us(0), us(v * 4));
        tru.writeUInt32LE(us(0), us(v * 4));
        twu.writeUInt32LE(us(0), us(v * 4));
    }
}

function setpage(v, p, writable, userable) {
    v = us(v);
    p = us(p);
    writable = us(writable);
    userable = us(userable);
    if (p >= memsz) {
        trap = FMEM;
        vadr = v;
        return 0;
    }
    p = us(us(us(v ^ p) & -4096) + 1);
    v = us(v >>> 12);
    if (!trk.readUInt32LE(us(v * 4))) {
        if (tpages >= TPAGES) {
            flush();
        }
        tpage.writeUInt32LE(v, us(tpages * 4));
        tpages = us(tpages + 1);
    }
    trk.writeUInt32LE(us(p), us(v * 4));
    twk.writeUInt32LE(us(writable ? p : 0), us(v * 4));
    tru.writeUInt32LE(us(userable ? p : 0), us(v * 4));
    twu.writeUInt32LE(us((userable && writable) ? p : 0), us(v * 4));
    return p;
}

function rlook(v) {
    var pde, ppde, pte, ppte, q, userable;

    v = us(v);
    if (!paging) {
        return setpage(v, v, 1, 1);
    }
    ppde = us(pdir + us((v >>> 22) << 2));
    pde = mem.readUInt32LE(ppde);
    if (us(pde & PTE_P)) {
        if (!us(pde & PTE_A)) {
            mem.writeUInt32LE(us(pde | PTE_A), ppde);
        }
        if (pde >= memsz) {
            trap = FMEM;
            vadr = v;
            return 0;
        }
        ppte = us(us(pde & -4096) + us((v >>> 10) & 0xffc));
        pte = mem.readUInt32LE(ppte);
        if (us(pte & PTE_P)) {
            q = us(pte & pde);
            userable = us(q & PTE_U);
            if (userable || !user) {
                if (!us(pte & PTE_A)) {
                    mem.writeUInt32LE(us(pte | PTE_A), ppte);
                }
                // check PTE_D here because the dirty bit should be set by wlook
                return setpage(v, pte, us(us(pte & PTE_D) && us(q & PTE_W)), userable);
            }
        }
    }
    trap = FRPAGE;
    vadr = v;
    return 0;
}

function wlook(v) {
    var pde, ppde, pte, ppte, q, userable;

    v = us(v);
    if (!paging) {
        return setpage(v, v, 1, 1);
    }
    ppde = us(pdir + us((v >>> 22) << 2));
    pde = mem.readUInt32LE(ppde);
    if (us(pde & PTE_P)) {
        if (!us(pde & PTE_A)) {
            mem.writeUInt32LE(us(pde | PTE_A), ppde);
        }
        if (pde >= memsz) {
            trap = FMEM;
            vadr = v;
            return 0;
        }
        ppte = us(us(pde & -4096) + us((v >>> 10) & 0xffc));
        pte = mem.readUInt32LE(ppte);
        if (us(pte & PTE_P)) {
            q = us(pte & pde);
            userable = us(q & PTE_U);
            if ((userable || !user) && (q & PTE_W)) {
                if (us(pte & (PTE_D | PTE_A)) !== us(PTE_D | PTE_A)) {
                    mem.writeUInt32LE(us(pte | (PTE_D | PTE_A)), ppte);
                }
                return setpage(v, pte, us(q & PTE_W), userable);
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
        st = fs.fstatSync(fd);
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
    if (hdr.magic !== us(0xC0DEF00D)) {
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
    var a = us(0),
        b = us(0),
        c = us(0),
        ssp = us(0),
        usp = us(0),
        xpc = us(0),
        tpc = us(-pc),
        fpc = us(0),
        xsp = us(sp),
        tsp = us(0),
        fsp = us(0),
        trap = us(0),
        delta = us(4096),
        cycle = us(4096),
        xcycle = us(delta * 4),
        timer = us(0),
        timeout = us(0),
        ir = sg(0),
        kbchar = sg(-1),
        f = 0.0,
        g = 0.0,
        follower, fatal, exception, interrupt, fixsp, chkpc, fixpc, next, after;

    fatal = function() {
        console.log("processor halted! cycle = %d pc = %s ir = %s sp = %s" +
            " a = %d b = %d c = %d trap = %d\n",
            us(cycle + us(us(xpc - xcycle) / 4)), hex(xpc - tpc), hex(ir),
            hex(xsp - tsp), a, b, c, trap);
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

        xsp = us(xsp - tsp);
        tsp = us(0);
        fsp = us(0);
        if (user) {
            usp = xsp;
            xsp = ssp;
            user = us(0);
            tr = trk;
            tw = twk;
            trap = us(trap | USER);
        }
        xsp = us(xsp - 8);
        p = tw.readUInt32LE(us((xsp >>> 12) * 4));
        if (!p) {
            p = wlook(xsp);
            if (!p) {
                console.log("kstack fault!\n");
                follower = fatal;
                return;
            }
        }
        mem.writeUInt32LE(us(xpc - tpc), us(us(xsp ^ p) & -8));
        xsp = us(xsp - 8);
        p = tw.readUInt32LE(us(us(xsp >>> 12) * 4));
        if (!p) {
            p = wlook(xsp);
            if (!p) {
                console.log("kstack fault\n");
                follower = fatal;
                return;
            }
        }
        mem.writeUInt32LE(trap, us(us(xsp ^ p) & -8));
        xcycle = us(xcycle + us(ivec + tpc - xpc));
        xpc = us(ivec + tpc);
        follower = fixpc;
    };
    fixsp = function() {
        var v, p;

        v = us(xsp - tsp);
        p = tw.readUInt32LE(us((v >>> 12) * 4));
        if (p) {
            xsp = us(v ^ us(p - 1));
            tsp = us(xsp - v);
            fsp = us(us(4096 - us(xsp & 4095)) << 8);
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

        v = us(xpc - tpc);
        p = tr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = rlook(v);
            if (!p) {
                trap = FIPAGE;
                follower = exception;
                return;
            }
        }
        xcycle = us(xcycle - tpc);
        xpc = us(v ^ (p - 1));
        tpc = us(xpc - v);
        xcycle = us(xcycle + tpc);
        fpc = us(us(xpc + 4096) & -4096);
        follower = next;
    };
    next = function() {
        var ch;

        if (xpc > xcycle) {
            cycle = us(cycle + us(delta));
            xcycle = us(xcycle + us(delta * 4));
            if (iena || !(ipend & FKEYBD)) {
                ch = probekb();
                if (ch !== -1) {
                    kbchar = ch;
                    if (kbchar === '`'.charCodeAt(0)) {
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
                    ipend = us(ipend | FKEYBD);
                }
            }
            if (timeout) {
                timer = us(timer + us(delta));
                if (timer >= timeout) {
                    timer = 0;
                    if (iena) {
                        trap = FTIMER;
                        iena = 0;
                        follower = interrupt;
                        return;
                    }
                    ipend = us(ipend | FTIMER);
                }
            }
        }
        follower = after;
    };
    after = function() {
        var ch, u, v, p, t;

        ir = mem.readUInt32LE(xpc);
        xpc = us(xpc + us(4));
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
                        if (kbchar === '`'.charCodeAt(0)) {
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
                    cycle = us(cycle + us(delta));
                    if (timeout) {
                        timer = us(timer + us(delta));
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
                    a = us(a + us(u));
                    b = us(b + us(u));
                    c = us(c - u);
                }
                follower = chkpc;
                return;
            case MCMP:
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
                    t = mem.slice(p, p + u).compare(mem.slice(t, t + u));
                    if (t) {
                        a = t;
                        b = us(b + us(c));
                        c = 0;
                        break;
                    }
                    a = us(a + us(u));
                    b = us(b + us(u));
                    c = us(c - u);
                }
                follower = chkpc;
                return;
            case MCHR:
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
                        a = us(a + us(t));
                        c = 0;
                        break;
                    }
                    a = us(a + us(u));
                    c = us(c - u);
                }
                follower = chkpc;
                return;
            case MSET:
                while (c > 0) {
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
                    a = us(a + us(u));
                    c = us(c - u);
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
                    fsp = us(fsp - ir) & -256;
                    if (fsp > (4096 << 8)) {
                        fsp = 0;
                    }
                }
                xsp = us(xsp + us((ir >> 8)));
                if (fsp) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LEV:
                if (ir < fsp) {
                    t = mem.readUInt32LE(xsp + (ir >> 8)) + tpc;
                    fsp -= (ir + 0x800) & -256;
                } else {
                    v = xsp - tsp + (ir >> 8);
                    p = tr.readUInt32LE((v >>> 12) * 4);
                    if (!p) {
                        p = rlook(v);
                        if (!p) {
                            break;
                        }
                    }
                    t = mem.readUInt32LE((v ^ p) & -8) + tpc;
                    fsp = 0;
                }
                xsp = us(xsp + us((ir >> 8) + 8));
                xcycle = us(xcycle + us(t - xpc));
                xpc = t;
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case JMP:
                xcycle = us(xcycle + us((ir >> 8)));
                xpc = us(xpc + us((ir >> 10) << 2));
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case JMPI:
                v = xpc - tpc + (ir >> 8) + (a << 2);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                t = mem.readUInt32LE((v ^ p) & -4);
                xcycle = us(xcycle + us(t));
                xpc = xpc + t;
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case JSR:
                if (fsp & (4095 << 8)) {
                    xsp = us(xsp - 8);
                    fsp = us(fsp + us(8 << 8));
                    mem.writeUInt32LE(xpc - tpc, xsp);
                } else {
                    v = xsp - tsp - 8;
                    p = tw.readUInt32LE((v >>> 12) * 4);
                    if (!p) {
                        p = wlook(v);
                        if (!p) {
                            break;
                        }
                    }
                    mem.writeUInt32LE(xpc - tpc, (v ^ p) & -8);
                    fsp = 0;
                    xsp = us(xsp - 8);
                }
                xcycle = us(xcycle + us((ir >> 8)));
                xpc = us(xpc + us((ir >> 10) << 2));
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case JSRA:
                if (fsp & (4095 << 8)) {
                    xsp = us(xsp - 8);
                    fsp = us(fsp + us(8 << 8));
                    mem.writeUInt32LE(xpc - tpc, xsp);
                } else {
                    v = xsp - tsp - 8;
                    p = tw.readUInt32LE((v >>> 12) * 4);
                    if (!p) {
                        p = wlook(v);
                        if (!p) {
                            break;
                        }
                    }
                    mem.writeUInt32LE(xpc - tpc, (v ^ p) & -8);
                    fsp = 0;
                    xsp = us(xsp - 8);
                }
                xcycle = us(xcycle + us(a + tpc - xpc));
                xpc = a + tpc;
                if (xpc - fpc < -4096) {
                    follower = fixpc;
                    return;
                }
                follower = next;
                return;
            case PSHA:
                if (fsp & (4095 << 8)) {
                    xsp = us(xsp - 8);
                    fsp = us(fsp + us(8 << 8));
                    mem.writeUInt32LE(a, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt32LE(a, (v ^ p) & -8);
                xsp = us(xsp - 8);
                fsp = 0;
                follower = fixsp;
                return;
            case PSHB:
                if (fsp & (4095 << 8)) {
                    xsp = us(xsp - 8);
                    fsp = us(fsp + us(8 << 8));
                    mem.writeUInt32LE(b, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt32LE(b, (v ^ p) & -8);
                xsp = us(xsp - 8);
                fsp = 0;
                follower = fixsp;
                return;
            case PSHC:
                if (fsp & (4095 << 8)) {
                    xsp = us(xsp - 8);
                    fsp = us(fsp + us(8 << 8));
                    mem.writeUInt32LE(c, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt32LE(c, (v ^ p) & -8);
                xsp = us(xsp - 8);
                fsp = 0;
                follower = fixsp;
                return;
            case PSHF:
                if (fsp & (4095 << 8)) {
                    xsp = us(xsp - 8);
                    fsp = us(fsp + us(8 << 8));
                    mem.writeDoubleLE(f, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeDoubleLE(f, (v ^ p) & -8);
                xsp = us(xsp - 8);
                fsp = 0;
                follower = fixsp;
                return;
            case PSHG:
                if (fsp & (4095 << 8)) {
                    xsp = us(xsp - 8);
                    fsp = us(fsp + us(8 << 8));
                    mem.writeDoubleLE(g, xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeDoubleLE(g, (v ^ p) & -8);
                xsp = us(xsp - 8);
                fsp = 0;
                follower = fixsp;
                return;
            case PSHI:
                if (fsp & (4095 << 8)) {
                    xsp = us(xsp - 8);
                    fsp = us(fsp + us(8 << 8));
                    mem.writeInt32LE((ir >> 8), xsp);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp - 8;
                p = tw.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeInt32LE((ir >> 8), (v ^ p) & -8);
                xsp = us(xsp - 8);
                fsp = 0;
                follower = fixsp;
                return;
            case POPA:
                if (fsp) {
                    a = mem.readUInt32LE(xsp);
                    xsp = us(xsp + us(8));
                    fsp = us(fsp - 8) << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt32LE((v ^ p) & -8);
                xsp = us(xsp + us(8));
                follower = fixsp;
                return;
            case POPB:
                if (fsp) {
                    b = mem.readUInt32LE(xsp);
                    xsp = us(xsp + us(8));
                    fsp = us(fsp - 8) << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt32LE((v ^ p) & -8);
                xsp = us(xsp + us(8));
                follower = fixsp;
                return;
            case POPC:
                if (fsp) {
                    c = mem.readUInt32LE(xsp);
                    xsp = us(xsp + us(8));
                    fsp = us(fsp - 8) << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                c = mem.readUInt32LE((v ^ p) & -8);
                xsp = us(xsp + us(8));
                follower = fixsp;
                return;
            case POPF:
                if (fsp) {
                    f = mem.readDoubleLE(xsp);
                    xsp = us(xsp + us(8));
                    fsp = us(fsp - 8) << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                f = mem.readDoubleLE((v ^ p) & -8);
                xsp = us(xsp + us(8));
                follower = fixsp;
                return;
            case POPG:
                if (fsp) {
                    g = mem.readDoubleLE(xsp);
                    xsp = us(xsp + us(8));
                    fsp = us(fsp - 8) << 8;
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp;
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                g = mem.readDoubleLE((v ^ p) & -8);
                xsp = us(xsp + us(8));
                follower = fixsp;
                return;
            case LEA:
                a = xsp - tsp + (ir >> 8);
                follower = chkpc;
                return;
            case LEAG:
                a = xpc - tpc + (ir >> 8);
                follower = chkpc;
                return;
            case LL:
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
                    a = mem.readInt16LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                    a = mem.readUInt16LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                    a = mem.readInt8(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readInt8(v ^ p & -2); // & precedes ^
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LLB:
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
                        break;
                    }
                }
                a = mem.readUInt8(v ^ p & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LLD:
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
                    f = mem.readFloatLE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readInt8(v ^ p & -2);
                follower = chkpc;
                return;
            case LGB:
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt8(v ^ p & -2);
                follower = chkpc;
                return;
            case LGD:
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = a + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = a + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = a + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = a + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readInt8(v ^ p & -2);
                follower = chkpc;
                return;
            case LXB:
                v = a + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = mem.readUInt8(v ^ p & -2);
                follower = chkpc;
                return;
            case LXD:
                v = a + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = a + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                a = (ir >> 8);
                follower = chkpc;
                return;
            case LHI:
                a = a << 24 | (ir >> 8);
                follower = chkpc;
                return;
            case LIF:
                f = (ir >> 8) / 256.0;
                follower = chkpc;
                return;
            case LBL:
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
                    b = mem.readInt16LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                    b = mem.readUInt16LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                    b = mem.readInt8(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readInt8(v ^ p & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBLB:
                if (ir < fsp) {
                    b = mem.readUInt8(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt8(v ^ p & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case LBLD:
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
                    g = mem.readFloatLE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readInt8(v ^ p & -2);
                follower = chkpc;
                return;
            case LBGB:
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt8(v ^ p & -2);
                follower = chkpc;
                return;
            case LBGD:
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = b + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = b + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = b + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = b + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readInt8(v ^ p & -2);
                follower = chkpc;
                return;
            case LBXB:
                v = b + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                b = mem.readUInt8(v ^ p & -2);
                follower = chkpc;
                return;
            case LBXD:
                v = b + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                v = b + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                b = (ir >> 8);
                follower = chkpc;
                return;
            case LBHI:
                b = b << 24 | (ir >> 8);
                follower = chkpc;
                return;
            case LBIF:
                g = (ir >> 8) / 256.0;
                follower = chkpc;
                return;
            case LCL:
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
                    mem.writeUInt32LE(a, xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                    mem.writeUInt16LE(a, xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                    mem.writeUInt8(a, xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt8(a, v ^ p & -2);
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SLD:
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
                    mem.writeFloatLE(f, xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt8(a, v ^ p & -2);
                follower = chkpc;
                return;
            case SGD:
                v = xpc - tpc + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                v = xpc - tpc + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                v = b + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                v = b + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                v = b + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = wlook(v);
                    if (!p) {
                        break;
                    }
                }
                mem.writeUInt8(a, v ^ p & -2);
                follower = chkpc;
                return;
            case SXD:
                v = b + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                v = b + (ir >> 8);
                p = tw.readUInt32LE((v >>> 12) * 4);
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
                f = us(f + us(g));
                follower = chkpc;
                return;
            case SUBF:
                f = us(f - g);
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
                a = us(a + us(b));
                follower = chkpc;
                return;
            case ADDI:
                a = us(a + us((ir >> 8)));
                follower = chkpc;
                return;
            case ADDL:
                if (ir < fsp) {
                    a = us(a + us(mem.readUInt32LE(xsp + (ir >> 8))));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = us(a + us(mem.readUInt32LE((v ^ p) & -4)));
                if (fsp || (v ^ (xsp - tsp)) & -4096) {
                    follower = chkpc;
                    return;
                }
                follower = fixsp;
                return;
            case SUB:
                a = us(a - b);
                follower = chkpc;
                return;
            case SUBI:
                a -= (ir >> 8);
                follower = chkpc;
                return;
            case SUBL:
                if (ir < fsp) {
                    a = us(a - mem.readUInt32LE(xsp + (ir >> 8)));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
                if (!p) {
                    p = rlook(v);
                    if (!p) {
                        break;
                    }
                }
                a = us(a - mem.readUInt32LE((v ^ p) & -4));
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
                a = a * (ir >> 8);
                follower = chkpc;
                return;
            case MULL:
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
                t = (ir >> 8);
                if (!t) {
                    trap = FARITH;
                    break;
                }
                a = Math.floor(a / t);
                follower = chkpc;
                return;
            case DIVL:
                if (ir < fsp) {
                    t = mem.readUInt32LE(xsp + (ir >> 8));
                    if (!t) {
                        trap = FARITH;
                        break;
                    }
                    a = Math.floor(a / t);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                t = (ir >> 8);
                if (!t) {
                    trap = FARITH;
                    break;
                }
                a = Math.floor(a / t);
                follower = chkpc;
                return;
            case DVUL:
                if (ir < fsp) {
                    t = mem.readUInt32LE(xsp + (ir >> 8));
                    if (!t) {
                        trap = FARITH;
                        break;
                    }
                    a = Math.floor(a / t);
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                a = a % (ir >> 8);
                follower = chkpc;
                return;
            case MODL:
                if (ir < fsp) {
                    a = a % mem.readUInt32LE(xsp + (ir >> 8));
                    follower = chkpc;
                    return;
                }
                v = xsp - tsp + (ir >> 8);
                p = tr.readUInt32LE((v >>> 12) * 4);
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
                a %= (ir >> 8);
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
                a = us(a | b);
                follower = chkpc;
                return;
            case ORI:
                a = us(a | ir) >> 8;
                follower = chkpc;
                return;

            case ORL:
                if (ir < fsp) {
                    a = us(a | mem.readUInt32LE(xsp + (ir >> 8)));
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
                a = us(a | mem.readUInt32LE((v ^ p) & -4));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                    xcycle = us(xcycle + us(ir >> 8));
                    xpc = us(xpc + us((ir >> 10) << 2));
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
                a = printch(ch);
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
                xsp = us(xsp - tsp);
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
                xsp = us(xsp + us(8));
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
                xcycle = us(xcycle + us(pc - xpc));
                xsp = us(xsp + us(8));
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
            case IVEC:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                ivec = a;
                follower = chkpc;
                return;
            case PDIR:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                if (a > memsz) {
                    trap = FMEM;
                    break;
                }
                pdir = a & -4096;
                flush();
                fsp = 0;
                follower = fixpc;
                return;
            case SPAG:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                if (a && !pdir) {
                    trap = FMEM;
                    break;
                }
                paging = a;
                flush();
                fsp = 0;
                follower = fixpc;
                return;
            case TIME:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                if (ir >> 8) {
                    console.log("timer%d=%u timeout=%u\n", ir >> 8, timer, timeout);
                    follower = chkpc;
                    return;
                }
                timeout = a;
                follower = chkpc;
                return;
            case LVAD:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                a = vadr;
                follower = chkpc;
                return;
            case TRAP:
                trap = FSYS;
                break;
            case LUSP:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                a = usp;
                follower = chkpc;
                return;
            case SUSP:
                if (user) {
                    trap = FPRIV;
                    break;
                }
                usp = a;
                follower = chkpc;
                return;
            case NET1:
                console.log("NET1 not implemented\n");
                follower = fatal;
                return;
            case NET2:
                console.log("NET2 not implemented\n");
                follower = fatal;
                return;
            case NET3:
                console.log("NET3 not implemented\n");
                follower = fatal;
                return;
            case NET4:
                console.log("NET4 not implemented\n");
                follower = fatal;
                return;
            case NET5:
                console.log("NET5 not implemented\n");
                follower = fatal;
                return;
            case NET6:
                console.log("NET6 not implemented\n");
                follower = fatal;
                return;
            case NET7:
                console.log("NET7 not implemented\n");
                follower = fatal;
                return;
            case NET8:
                console.log("NET8 not implemented\n");
                follower = fatal;
                return;
            case NET9:
                console.log("NET9 not implemented\n");
                follower = fatal;
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
        memsz = us(Number(argv.m) * 1024 * 1024);
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
    initkb();
    cpu(hdr.entry, memsz - FS_SZ);
    shutkb();
    return 0;
}

main(minimist(process.argv.slice(2)));
