/*jslint bitwise:true browser:true maxlen:80 white:true */
/*global buffer, Uint8Array */

"use strict";

var v9 = {};

(function() {
    var MEM_SZ = 64 * 1024 * 1024, // default memory size of vm (64M)
        TB_SZ = 1024 * 1024, // page translation buffer size (4G / page_sz)
        FS_SZ = 4 * 1024 * 1024, // ram file system size (4M)
        TPAGES = 4096, // maximum cached page translations

        PTE_P = 0x001, // present
        PTE_W = 0x002, // writable
        PTE_U = 0x004, // user
        PTE_A = 0x020, // accessed
        PTE_D = 0x040, // dirty

        FMEM = 0, // bad physical address
        FTIMER = 1, // timer interrupt
        FKEYBD = 2, // keyboard interrupt
        FPRIV = 3, // privileged instruction
        FINST = 4, // illegal instruction
        FSYS = 5, // software trap
        FARITH = 6, // arithmetic trap
        FIPAGE = 7, // page fault on opcode fetch
        FWPAGE = 8, // page fault on write
        FRPAGE = 9, // page fault on read
        USER = 16, // user mode exception (16)

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
        tpage = 0, // valid page translations
        tpages = 0, // number of cached page translations
        trk = 0, // kernel read page translation tables
        twk = 0, // kernel write page translation tables
        tru = 0, // user read page translation tables
        twu = 0, // user write page translation tables
        tr = 0, // current read page translation tables
        tw = 0, // current write page translation tables

        a = 0,
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
        g = 0,

        execs = [],
        follower = 0,
        fatal = 0,
        exception = 0,
        interrupt = 0,
        fixsp = 0,
        chkpc = 0,
        fixpc = 0,
        chkio = 0,
        decode = 0,

        updateForOS = true,
        toUpdateSyms = false,
        currentSym = '',
        dsyms = {},
        stateInfo = {},
        cpu = 0,
        debugcpu = 0,
        debug = false,
        bootpc = -1,
        bootsp = -1,

        probingkb = false,
        pendkeys = [],
        putstr = 0;

    function probekb() {
        probingkb = true;
        if (pendkeys[0]) {
            return pendkeys.shift();
        }
        return -1;
    }

    function hexstr(x) {
        return ("00000000" + (x >>> 0).toString(16)).substr(-8);
    }

    function printch(ch) {
        if (putstr(1, String.fromCharCode(ch))) {
            return 1;
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
                if (userable || !user) {
                    if (!(pte & PTE_A)) {
                        mem.writeUInt32LE(pte | PTE_A, ppte);
                    }
                    return pushtlb(v, pte, (pte & PTE_D) && (q & PTE_W),
                        userable);
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

    function execUpdateSyms() {
        var p, v, s, t, m;

        if (updateForOS) {
            v = 0;
        } else {
            v = 16;
        }
        p = tr.readUInt32LE((v >>> 12) * 4);
        if (!p) {
            p = rlook(v);
            if (!p) {
                follower = exception;
                return;
            }
        }
        p = ((v ^ p) & -4) >>> 0;
        m = mem.readUInt32LE(p);
        s = '';
        p = p + 4;
        while (true) {
            t = mem.readUInt8(p);
            if (0 <= t && t <= 0x7F) {
                if (t === 0) {
                    break;
                }
                s = s + String.fromCharCode(t);
            } else {
                console.log("execUpdateSyms: incorrect string");
            }
            p = p + 1;
        }
        if (dsyms[s] && m === 0xff3223ff) {
            currentSym = s;
        }
        toUpdateSyms = false;
        updateForOS = false;
        follower = chkpc;
        return;
    }

    function execHALT() {
        if (user) {
            putstr(2, "halt(" + a.toString() + ") cycle = " +
                ((cycle + ((xpc - xcycle) | 0) / 4) >>> 0).toString() + "\n");
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
                    putstr(2, "ungraceful exit. cycle = " +
                        ((cycle + ((xpc - xcycle) | 0) / 4) >>> 0).toString() +
                        "\n");
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
            putstr(2, "bad write a=" + a.toString() + "\n");
            follower = 0;
            return;
        }
        ch = b;
        a = printch(ch);
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
                putstr(2, "RTI kstack fault\n");
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
                putstr(2, "RTI kstack fault\n");
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
        toUpdateSyms = true;
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
            putstr(2, "timer" + (ir >> 8).toString() + "=" + timer.toString() +
                " timeout=" + timeout.toString() + "\n");
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
        putstr(2, (ir & 0xFF).toString() + " not implemented!\n");
        trap = FINST;
        follower = exception;
        return;
    }

    function assemble() {
        var i;

        execs = [];
        for (i = 0; i <= 0xFF; i = i + 1) {
            execs.push(execDefault);
        }
        execs[0] = execHALT;
        execs[1] = execENT;
        execs[2] = execLEV;
        execs[3] = execJMP;
        execs[4] = execJMPI;
        execs[5] = execJSR;
        execs[6] = execJSRA;
        execs[7] = execLEA;
        execs[8] = execLEAG;
        execs[9] = execCYC;
        execs[10] = execMCPY;
        execs[11] = execMCMP;
        execs[12] = execMCHR;
        execs[13] = execMSET;
        execs[14] = execLL;
        execs[15] = execLLS;
        execs[16] = execLLH;
        execs[17] = execLLC;
        execs[18] = execLLB;
        execs[19] = execLLD;
        execs[20] = execLLF;
        execs[21] = execLG;
        execs[22] = execLGS;
        execs[23] = execLGH;
        execs[24] = execLGC;
        execs[25] = execLGB;
        execs[26] = execLGD;
        execs[27] = execLGF;
        execs[28] = execLX;
        execs[29] = execLXS;
        execs[30] = execLXH;
        execs[31] = execLXC;
        execs[32] = execLXB;
        execs[33] = execLXD;
        execs[34] = execLXF;
        execs[35] = execLI;
        execs[36] = execLHI;
        execs[37] = execLIF;
        execs[38] = execLBL;
        execs[39] = execLBLS;
        execs[40] = execLBLH;
        execs[41] = execLBLC;
        execs[42] = execLBLB;
        execs[43] = execLBLD;
        execs[44] = execLBLF;
        execs[45] = execLBG;
        execs[46] = execLBGS;
        execs[47] = execLBGH;
        execs[48] = execLBGC;
        execs[49] = execLBGB;
        execs[50] = execLBGD;
        execs[51] = execLBGF;
        execs[52] = execLBX;
        execs[53] = execLBXS;
        execs[54] = execLBXH;
        execs[55] = execLBXC;
        execs[56] = execLBXB;
        execs[57] = execLBXD;
        execs[58] = execLBXF;
        execs[59] = execLBI;
        execs[60] = execLBHI;
        execs[61] = execLBIF;
        execs[62] = execLBA;
        execs[63] = execLBAD;
        execs[64] = execSL;
        execs[65] = execSLH;
        execs[66] = execSLB;
        execs[67] = execSLD;
        execs[68] = execSLF;
        execs[69] = execSG;
        execs[70] = execSGH;
        execs[71] = execSGB;
        execs[72] = execSGD;
        execs[73] = execSGF;
        execs[74] = execSX;
        execs[75] = execSXH;
        execs[76] = execSXB;
        execs[77] = execSXD;
        execs[78] = execSXF;
        execs[79] = execADDF;
        execs[80] = execSUBF;
        execs[81] = execMULF;
        execs[82] = execDIVF;
        execs[83] = execADD;
        execs[84] = execADDI;
        execs[85] = execADDL;
        execs[86] = execSUB;
        execs[87] = execSUBI;
        execs[88] = execSUBL;
        execs[89] = execMUL;
        execs[90] = execMULI;
        execs[91] = execMULL;
        execs[92] = execDIV;
        execs[93] = execDIVI;
        execs[94] = execDIVL;
        execs[95] = execDVU;
        execs[96] = execDVUI;
        execs[97] = execDVUL;
        execs[98] = execMOD;
        execs[99] = execMODI;
        execs[100] = execMODL;
        execs[101] = execMDU;
        execs[102] = execMDUI;
        execs[103] = execMDUL;
        execs[104] = execAND;
        execs[105] = execANDI;
        execs[106] = execANDL;
        execs[107] = execOR;
        execs[108] = execORI;
        execs[109] = execORL;
        execs[110] = execXOR;
        execs[111] = execXORI;
        execs[112] = execXORL;
        execs[113] = execSHL;
        execs[114] = execSHLI;
        execs[115] = execSHLL;
        execs[116] = execSHR;
        execs[117] = execSHRI;
        execs[118] = execSHRL;
        execs[119] = execSRU;
        execs[120] = execSRUI;
        execs[121] = execSRUL;
        execs[122] = execEQ;
        execs[123] = execEQF;
        execs[124] = execNE;
        execs[125] = execNEF;
        execs[126] = execLT;
        execs[127] = execLTU;
        execs[128] = execLTF;
        execs[129] = execGE;
        execs[130] = execGEU;
        execs[131] = execGEF;
        execs[132] = execBZ;
        execs[133] = execBZF;
        execs[134] = execBNZ;
        execs[135] = execBNZF;
        execs[136] = execBE;
        execs[137] = execBEF;
        execs[138] = execBNE;
        execs[139] = execBNEF;
        execs[140] = execBLT;
        execs[141] = execBLTU;
        execs[142] = execBLTF;
        execs[143] = execBGE;
        execs[144] = execBGEU;
        execs[145] = execBGEF;
        execs[146] = execCID;
        execs[147] = execCUD;
        execs[148] = execCDI;
        execs[149] = execCDU;
        execs[150] = execCLI;
        execs[151] = execSTI;
        execs[152] = execRTI;
        execs[153] = execBIN;
        execs[154] = execBOUT;
        execs[155] = execNOP;
        execs[156] = execSSP;
        execs[157] = execPSHA;
        execs[158] = execPSHI;
        execs[159] = execPSHF;
        execs[160] = execPSHB;
        execs[161] = execPOPB;
        execs[162] = execPOPF;
        execs[163] = execPOPA;
        execs[164] = execIVEC;
        execs[165] = execPDIR;
        execs[166] = execSPAG;
        execs[167] = execTIME;
        execs[168] = execLVAD;
        execs[169] = execTRAP;
        execs[170] = execLUSP;
        execs[171] = execSUSP;
        execs[172] = execLCL;
        execs[173] = execLCA;
        execs[174] = execPSHC;
        execs[175] = execPOPC;
        execs[176] = execMSIZ;
        execs[177] = execPSHG;
        execs[178] = execPOPG;
        execs[188] = execPOW;
        execs[189] = execATN2;
        execs[190] = execFABS;
        execs[191] = execATAN;
        execs[192] = execLOG;
        execs[193] = execLOGT;
        execs[194] = execEXP;
        execs[195] = execFLOR;
        execs[196] = execCEIL;
        execs[197] = execHYPO;
        execs[198] = execSIN;
        execs[199] = execCOS;
        execs[200] = execTAN;
        execs[201] = execASIN;
        execs[202] = execACOS;
        execs[203] = execSINH;
        execs[204] = execCOSH;
        execs[205] = execTANH;
        execs[206] = execSQRT;
        execs[207] = execFMOD;
        execs[208] = execIDLE;
        fatal = function() {
            putstr(2, "processor halted! cycle = " +
                ((cycle + ((xpc - xcycle) | 0) / 4) >>> 0).toString() +
                " pc = " + hexstr(xpc - tpc) +
                " ir = " + hexstr(ir) +
                " sp = " + hexstr(xsp - tsp) +
                " a = " + a.toString() +
                " b = " + b.toString() +
                " c = " + c.toString() +
                " trap = " + trap.toString() + "\n");
            follower = 0;
        };
        exception = function() {
            if (!iena) {
                putstr(2, "exception in interrupt handler\n");
                follower = fatal;
            } else {
                follower = interrupt;
            }
        };
        interrupt = function() {
            var p;

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
                    putstr(2, "kstack fault!\n");
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
                    putstr(2, "kstack fault\n");
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
            if (xpc === fpc) {
                follower = fixpc;
            } else {
                follower = decode;
            }
        };
        fixpc = function() {
            var v, p;

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

            if (xpc > xcycle) {
                cycle = cycle + delta;
                xcycle = xcycle + delta * 4;
                if (iena || !(ipend & FKEYBD)) {
                    ch = probekb();
                    if (ch !== -1) {
                        kbchar = ch;
                        if (kbchar === '`'.charCodeAt(0)) {
                            putstr(2, "ungraceful exit. cycle = %d\n",
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
            (execs[ir & 0xFF])();
        };
    }

    function mntdisk(diskbuf) {
        var i, j, view;

        view = new Uint8Array(diskbuf);
        j = diskbuf.byteLength;
        for (i = 0; i < j; i = i + 1) {
            mem[memsz - FS_SZ + i] = view[i];
        }
        return 0;
    }

    function loados(osbuf) {
        var i, j, hdrbuf, hdr, view;

        view = new Uint8Array(osbuf);
        hdrbuf = new buffer.Buffer(16);
        for (i = 0; i < 16; i = i + 1) {
            hdrbuf[i] = view[i];
        }
        hdr = {
            magic: hdrbuf.readUInt32LE(0),
            bss: hdrbuf.readUInt32LE(4),
            entry: hdrbuf.readUInt32LE(8),
            flags: hdrbuf.readUInt32LE(12)
        };
        if (hdr.magic !== 0xC0DEF00D) {
            putstr(2, "failed to boot: bad hdr.magic\n");
            return -1;
        }
        j = osbuf.byteLength;
        for (i = 16; i < j; i = i + 1) {
            mem[i - 16] = view[i];
        }
        return hdr;
    }

    function unsignall() {
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
    }

    function parseSymFile(d) {
        var t, s, tlen, i, cur, x;

        x = {};
        t = d.split('\n');
        tlen = t.length;
        for (i = 0; i < tlen; i = i + 1) {
            s = t[i];
            if (s !== '') {
                if (s[0] === 'A') {
                    cur = Number(s.slice(2)) >>> 0;
                    if (!x[cur]) {
                        x[cur] = {};
                    }
                } else if (s[0] === 'F') {
                    x[cur].file = s.slice(2).slice(4);
                } else if (s[0] === 'L') {
                    x[cur].line = Number(s.slice(2));
                } else {
                    console.log('In parseSymFile: not implemented.');
                }
            }
        }
        return x;
    }

    function udpateStateInfo(pc) {
        var info;

        if (currentSym !== '') {
            info = dsyms[currentSym];
            if (!info) {
                return;
            }
            info = info[pc];
            if (!info || !info.file || !info.line) {
                return;
            }
            stateInfo.file = info.file;
            stateInfo.line = info.line;
        }
    }

    v9.inithdr = function(putstrimpl) {
        pendkeys = [];
        putstr = putstrimpl;
        memsz = MEM_SZ;
        mem = new buffer.Buffer(memsz);
        trk = new buffer.Buffer(TB_SZ * 4);
        twk = new buffer.Buffer(TB_SZ * 4);
        tru = new buffer.Buffer(TB_SZ * 4);
        twu = new buffer.Buffer(TB_SZ * 4);
        tpage = new buffer.Buffer(TPAGES * 4);
        assemble();
    };

    v9.acceptkb = function() {
        return probingkb;
    };

    v9.putkbch = function(c) {
        pendkeys.push(c);
    };

    v9.fillimg = function(osbuf, diskbuf) {
        var hdr;

        if (cpu !== 0) {
            clearInterval(cpu);
            cpu = 0;
            console.log("v9.fillimg: dangerous");
        }
        if (debugcpu !== 0) {
            clearInterval(debugcpu);
            debugcpu = 0;
            console.log("v9.fillimg: dangerous with debugcpu");
        }
        mem.fill(0);
        mntdisk(diskbuf);
        hdr = loados(osbuf);
        bootpc = hdr.entry;
        bootsp = memsz - FS_SZ;
    };

    function bufToStr(buf, begin, end) {
        var i, j, s;

        s = '';
        for (i = begin; i < end; i = i + 1) {
            j = buf.readUInt8(i);
            if (0 <= j && j <= 0x7F) {
                if (j === 0) {
                    break;
                }
                s = s + String.fromCharCode(j);
            } else {
                console.log("bufToStr: non-ASCII " + j.toString());
                break;
            }
        }
        return s;
    }

    v9.reset = function() {
        if (cpu !== 0) {
            clearInterval(cpu);
            cpu = 0;
            console.log("v9.reset: dangerous");
        }
        if (debugcpu !== 0) {
            clearInterval(debugcpu);
            debugcpu = 0;
            console.log("v9.reset: dangerous with debugcpu");
        }
        currentSym = bufToStr(mem, 4, 256);
        updateForOS = true;
        toUpdateSyms = false;
        stateInfo = {};
        debug = false;
        probingkb = false;
        pendkeys = [];
        user = 0;
        iena = 0;
        ipend = 0;
        trap = 0;
        ivec = 0;
        vadr = 0;
        paging = 0;
        pdir = 0;
        tpages = 0;
        tpage.fill(0);
        trk.fill(0);
        twk.fill(0);
        tru.fill(0);
        twu.fill(0);
        tr = trk;
        tw = twk;
        a = 0;
        b = 0;
        c = 0;
        ssp = 0;
        usp = 0;
        xpc = 0;
        tpc = -bootpc;
        fpc = 0;
        xsp = bootsp;
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
    };

    v9.run = function(cb) {
        if (cpu !== 0) {
            clearInterval(cpu);
            cpu = 0;
            console.log("v9.run: dangerous");
        }
        if (debugcpu !== 0) {
            clearInterval(debugcpu);
            debugcpu = 0;
            console.log("v9.run: dangerous with debugcpu");
        }
        cpu = setInterval(function() {
            var i;

            for (i = 0; i < (1 << 18); i = i + 1) {
                if (follower === 0) {
                    clearInterval(cpu);
                    cpu = 0;
                    v9.reset();
                    if (cb) {
                        cb();
                    }
                    return;
                }
                unsignall();
                follower();
            }
        }, 50);
    };

    v9.startdebug = function() {
        debug = true;
    };

    v9.running = function() {
        return cpu !== 0 || debugcpu !== 0;
    };

    v9.debugging = function() {
        return debug;
    };

    v9.kill = function() {
        if (cpu !== 0) {
            clearInterval(cpu);
            cpu = 0;
        }
        if (debugcpu !== 0) {
            clearInterval(debugcpu);
            cpu = 0;
        }
        v9.reset();
    };

    v9.singlestep = function(cb) {
        var cur, lastline;

        if (!v9.debugging()) {
            console.log("v9.singlestep: not in debug mode");
        }
        if (cpu !== 0) {
            clearInterval(cpu);
            cpu = 0;
            console.log("v9.singlestep: dangerous");
        }
        if (debugcpu !== 0) {
            clearInterval(debugcpu);
            debugcpu = 0;
            console.log("v9.singlestep: dangerous debugcpu");
        }
        cur = xpc >>> 0;
        while (follower !== 0 && (xpc >>> 0) === cur) {
            unsignall();
            if (toUpdateSyms && paging && follower === decode) {
                execUpdateSyms();
            } else {
                follower();
            }
        }
        if (follower === 0) {
            v9.reset();
        }
        lastline = stateInfo.line;
        udpateStateInfo(xpc >>> 0);
        if (lastline !== stateInfo.line) {
            cb(stateInfo);
        } else {
            v9.singlestep(cb);
        }
    };

    function validateBreaks(bps) {
        var i, j, k, s, t;
        k = {};
        for (i in bps) {
            if (bps.hasOwnProperty(i)) {
                for (j in bps[i]) {
                    if (bps[i].hasOwnProperty(j)) {
                        k[i + '|||' + j.toString()] = true;
                    }
                }
            }
        }
        bps = k;
        s = {};
        for (i in dsyms) {
            if (dsyms.hasOwnProperty(i)) {
                for (j in dsyms[i]) {
                    if (dsyms[i].hasOwnProperty(j)) {
                        k = dsyms[i][j];
                        t = k.file + '|||' + k.line;
                        if (bps[t]) {
                            s[j] = t;
                        }
                    }
                }
            }
        }
        return s;
    }

    v9.untilbreak = function(bps, cb) {
        var s;

        if (!v9.debugging()) {
            console.log("v9.untilbreak: not in debug mode");
        }
        if (cpu !== 0) {
            clearInterval(cpu);
            cpu = 0;
            console.log("v9.untilbreak: dangerous");
        }
        if (debugcpu !== 0) {
            clearInterval(debugcpu);
            debugcpu = 0;
            console.log("v9.untilbreak: dangerous debugcpu");
        }
        s = validateBreaks(bps);
        console.log(s);
        v9.singlestep(function() {
            return;
        });
        debugcpu = setInterval(function() {
            var i, cur;

            for (i = 0; i < 1 << 18; i = i + 1) {
                if (follower === 0) {
                    clearInterval(debugcpu);
                    debugcpu = 0;
                    v9.reset();
                    cb(stateInfo);
                    return;
                }
                unsignall();
                if (toUpdateSyms && paging && follower === decode) {
                    execUpdateSyms();
                } else {
                    follower();
                }
                cur = xpc >>> 0;
                udpateStateInfo(cur);
                if (s[cur] && s[cur] ===
                    stateInfo.file + '|||' + stateInfo.line.toString()) {
                    clearInterval(debugcpu);
                    debugcpu = 0;
                    cb(stateInfo);
                    return;
                }
            }
        }, 50);
    };

    v9.loadsymbols = function(d) {
        var dlen, i;

        dsyms = {};
        dlen = d.length;
        for (i = 0; i < dlen; i = i + 1) {
            dsyms[d[i].name] = parseSymFile(d[i].data);
        }
    };
}());
