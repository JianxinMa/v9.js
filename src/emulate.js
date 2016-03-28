"use strict";

var minimist = require("minimist");
var assert = require("assert");
var fs = require("fs");
var printf = console.log;

function __malloc(sz) {
    var i, ret;

    ret = [];
    for (i = 0; i < sz; i += 1) {
        ret.push(0);
    }
    return ret;
}
var malloc_byte = __malloc;
var malloc_long = __malloc;

var MEM_SZ = 128 * 1024 * 1024;  // default memory size of vm (128M)
var TB_SZ  = 1024 * 1024;        // page translation buffer size (4G / page_sz)
var FS_SZ  = 4 * 1024 * 1024;    // ram file system size (4M)
var TPAGES = 4096;               // maximum cached page translations

var PTE_P = 0x001;  // present
var PTE_W = 0x002;  // writeable
var PTE_U = 0x004;  // user
var PTE_A = 0x020;  // accessed
var PTE_D = 0x040;  // dirty

var FMEM = 0;    // bad physical address
var FTIMER = 1;  // timer interrupt
var FKEYBD = 2;  // keyboard interrupt
var FPRIV = 3;   // privileged instruction
var FINST = 4;   // illegal instruction
var FSYS = 5;    // software trap
var FARITH = 6;  // arithmetic trap
var FIPAGE = 7;  // page fault on opcode fetch
var FWPAGE = 8;  // page fault on write
var FRPAGE = 9;  // page fault on read
var USER = 16;   // user mode exception (16)


var verbose = 0;             // chatty option -v
var mem = 0;                 // physical memory
var memsz = 0;               // physical memory size
var user = 0;                // user mode
var iena = 0;                // interrupt enable
var ipend = 0;               // interrupt pending
var trap = 0;                // fault code
var ivec = 0;                // interrupt vector
var vadr = 0;                // bad virtual address
var paging = 0;              // virtual memory enabled
var pdir = 0;                // page directory
var tpage = malloc_long(TPAGES);  // valid page translations
var tpages = 0;              // number of cached page translations
var trk = 0;                 // kernel read page translation tables
var twk = 0;                 // kernel write page translation tables
var tru = 0;                 // user read page translation tables
var twu = 0;                 // user write page translation tables
var tr = 0;                  // current read page translation tables
var tw = 0;                  // current write page translation tables

var cmd = "./xem";

function usage() {
    printf("USAGE: node emulate.js [options] <file>");
    printf("OPTIONS:");
    printf("  -v");
    printf("  -m <memsize>");
    printf("  -f <filesys>");
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
        printf("mem size = %d\n", memsz);
    }
    mem = malloc_byte(memsz);

    if (argv.hasOwnProperty("f")) {
        if (readfs(argv.f) === -1) {
            return -1;
        }
    }
    
    hdr = readhdr(argv._[0]);
    if (hdr === -1) {
        return -1;
    }

    trk = malloc_long(TB_SZ);
    twk = malloc_long(TB_SZ);
    tru = malloc_long(TB_SZ);
    twu = malloc_long(TB_SZ);
    tr = trk;
    tw = twk;

    if (verbose) {
        printf("%s : emulating %s\n", cmd, argv._[0]);
    }
    cpu(hdr.entry, memsz - FS_SZ);

    return 0;
}

function readfs(filename) {
    var fd, st, buf, i;

    if (verbose) {
        printf("%s : loading ram file system %s\n", cmd, filename);
    }

    fd = fs.openSync(filename, "r");
    if (fd < 0) {
        printf("%s : couldn't open file system %s\n", cmd, filename);
        return -1;
    }

    st = fs.statSync(fd);
    if (st === undefined) {  // How to check if st is valid?
        printf("%s : couldn't stat file system %s\n", cmd, filename);
        return -1;
    }

    buf = new Buffer(st.size);
    i = fs.readSync(fd, buf, 0, st.size);
    if (i !== st.size) {
        printf("%s : failed to read filesystem size %d returned %d\n",
            cmd, st.size, i);
        return -1;
    }

    for (i = 0; i < buf.length; i += 1) {
        mem[memsz - FS_SZ + i] = buf[i];
    }

    fs.closeSync(fd);

    return 0;
}

function readhdr(filename) {
    var fd, st, buf, hdr, i;

    fd = fs.open(filename, "r");
    if (fd < 0) { 
        printf("%s : couldn't open %s\n", cmd, filename); 
        return -1; 
    }
    
    st = fs.fstat(fd);
    if (st === undefined) {  // How to check if st is valid?
        printf("%s : couldn't stat file %s\n", cmd, filename); 
        return -1; 
    }

    buf = new Buffer(16);
    fs.readSync(fd, buf, 0, 16);
    hdr = {
        magic : buf.readInt32LE(0),
        bss :   buf.readInt32LE(4),
        entry : buf.readInt32LE(8),
        flags : buf.readInt32LE(12)
    };

    if (hdr.magic !== 0xC0DEF00D) { 
        printf("%s : bad hdr.magic\n", cmd); 
        return -1; 
    }

    buf = new Buffer(st.size - 16);
    i = fs.readSync(fd, buf, 0, st.size - 16);
    if (i !== st.size - 16) { 
        printf("%s : failed to read file %sn", cmd, filename); 
        return -1; 
    }
    for (i = 0; i < buf.length; i += 1) {
        mem[i] = buf[i];
    }
    
    fs.closeSync(fd);
    
    return hdr;
}

function cpu(pc, sp) {
    
}

main(minimist(process.argv.slice(2)));
