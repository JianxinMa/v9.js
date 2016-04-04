// u.h

// instruction set
// clang-format off
enum {
    HALT,ENT ,LEV ,JMP ,JMPI,JSR ,JSRA,LEA ,LEAG,CYC ,MCPY,MCMP,MCHR,MSET, // system
    LL  ,LLS ,LLH ,LLC ,LLB ,LLD ,LLF ,LG  ,LGS ,LGH ,LGC ,LGB ,LGD ,LGF , // load a
    LX  ,LXS ,LXH ,LXC ,LXB ,LXD ,LXF ,LI  ,LHI ,LIF ,
    LBL ,LBLS,LBLH,LBLC,LBLB,LBLD,LBLF,LBG ,LBGS,LBGH,LBGC,LBGB,LBGD,LBGF, // load b
    LBX ,LBXS,LBXH,LBXC,LBXB,LBXD,LBXF,LBI ,LBHI,LBIF,LBA ,LBAD,
    SL  ,SLH ,SLB ,SLD ,SLF ,SG  ,SGH ,SGB ,SGD ,SGF ,                     // store
    SX  ,SXH ,SXB ,SXD ,SXF ,
    ADDF,SUBF,MULF,DIVF,                                                   // arithmetic
    ADD ,ADDI,ADDL,SUB ,SUBI,SUBL,MUL ,MULI,MULL,DIV ,DIVI,DIVL,
    DVU ,DVUI,DVUL,MOD ,MODI,MODL,MDU ,MDUI,MDUL,AND ,ANDI,ANDL,
    OR  ,ORI ,ORL ,XOR ,XORI,XORL,SHL ,SHLI,SHLL,SHR ,SHRI,SHRL,
    SRU ,SRUI,SRUL,EQ  ,EQF ,NE  ,NEF ,LT  ,LTU ,LTF ,GE  ,GEU ,GEF ,      // logical
    BZ  ,BZF ,BNZ ,BNZF,BE  ,BEF ,BNE ,BNEF,BLT ,BLTU,BLTF,BGE ,BGEU,BGEF, // conditional
    CID ,CUD ,CDI ,CDU ,                                                   // conversion
    CLI ,STI ,RTI ,BIN ,BOUT,NOP ,SSP ,PSHA,PSHI,PSHF,PSHB,POPB,POPF,POPA, // misc
    IVEC,PDIR,SPAG,TIME,LVAD,TRAP,LUSP,SUSP,LCL ,LCA ,PSHC,POPC,MSIZ,
    PSHG,POPG,NET1,NET2,NET3,NET4,NET5,NET6,NET7,NET8,NET9,
    POW ,ATN2,FABS,ATAN,LOG ,LOGT,EXP ,FLOR,CEIL,HYPO,SIN ,COS ,TAN ,ASIN, // math
    ACOS,SINH,COSH,TANH,SQRT,FMOD,
    IDLE
};
// clang-format on

typedef unsigned char uchar;
typedef unsigned short ushort;
typedef unsigned int uint;

// linux/libc.h
// Allows a few specific programs to compile and run under linux.

#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <assert.h>
#include <memory.h>
#include <stdarg.h>
#include <termios.h>
#include <sys/stat.h>
#include <dirent.h>

#define NOFILE 16 // XXX subject to change

#undef NAME_MAX
#define NAME_MAX 256

enum { xCLOSED, xCONSOLE, xFILE, xSOCKET, xDIR };
int xfd[NOFILE];
int xft[NOFILE];

int xopen(char *fn, int mode) {
  int i, d;
  struct stat hs;
  int r;
  for (i = 0; i < NOFILE; i++) {
    if (xft[i] == xCLOSED) {
      if (!(mode & O_CREAT) && !stat(fn, &hs) && S_ISDIR(hs.st_mode)) {
        if (!(d = (int)opendir(fn))) {
          return -1;
        }
        xft[i] = xDIR;
      } else {
        if ((d = open(fn, mode, S_IRWXU)) < 0) {
          return d;
        }
        xft[i] = xFILE;
      }
      xfd[i] = d;
      return i;
    }
  }
  return -1;
}
int xclose(int d) {
  int r;
  if ((uint)d >= NOFILE) {
    return -1;
  }
  switch (xft[d]) {
  case xSOCKET:
  case xFILE:
    r = close(xfd[d]);
    break;
  case xDIR:
    closedir((DIR *)xfd[d]);
    r = 0;
    break;
  }
  xfd[d] = -1;
  xft[d] = xCLOSED;
  return r;
}
int xread(int d, void *b, int n) {
  struct dirent *de;
  int c;

  if ((uint)d >= NOFILE) {
    return -1;
  }
  switch (xft[d]) {
  case xSOCKET:
    return read(xfd[d], b, n);
  case xCONSOLE:
    return read(0, b, 1);
  case xDIR:
    if (n != NAME_MAX) {
      return 0;
    }
    if (!(de = readdir((DIR *)xfd[d]))) {
      return 0;
    }
    n = 1;
    memcpy(b, &n, 4);
    strncpy((char *)b + 4, de->d_name, NAME_MAX - 4);
    return NAME_MAX; // XXX hardcoded crap
  case xFILE:
    return read(xfd[d], b, n);
  }
  return -1;
}
int xwrite(int d, void *b, int n) {
  if ((uint)d >= NOFILE) {
    return -1;
  }
  switch (xft[d]) {
  case xSOCKET:
  case xFILE: // return write(xfd[d], b, n);
  case xCONSOLE:
    return write(xfd[d], b, n); // return write(1, b, n); XXX
  }
  return -1;
}
int xdprintf(int d, char *f, ...) {
  static char buf[4096];
  va_list v;
  int n;
  va_start(v, f);
  n = vsprintf(buf, f, v);
  va_end(v);
  return xwrite(d, buf, n);
}

struct xstat {
  ushort st_dev;  // device number
  ushort st_mode; // type of file
  uint st_ino;    // inode number on device
  uint st_nlink;  // number of links to file
  uint st_size;   // size of file in bytes
};
int xfstat(int d, struct xstat *s) {
  struct stat hs;
  int r;
  if ((uint)d >= NOFILE) {
    return -1;
  }
  if (xft[d] == xDIR) {
    s->st_mode = S_IFDIR;
    s->st_dev = 0;
    s->st_ino = 0;
    s->st_nlink = 0;
    s->st_size = 0;
    r = 0;
  } else if (!(r = fstat(xfd[d], &hs))) {
    s->st_mode = S_IFREG;
    s->st_dev = hs.st_dev;
    s->st_ino = hs.st_ino;
    s->st_nlink = hs.st_nlink;
    s->st_size = hs.st_size;
  }
  return r;
}
int xstat(char *file, struct xstat *s) {
  struct stat hs;
  int r;
  if (!(r = stat(file, &hs))) {
    s->st_mode = hs.st_mode;
    s->st_dev = hs.st_dev;
    s->st_ino = hs.st_ino;
    s->st_nlink = hs.st_nlink;
    s->st_size = hs.st_size;
  }
  return r;
}
void *xsbrk(int i) {
  void *p;
  static int brk = 0;
  if (!i) {
    return (void *)brk;
  }
  if (i < 0) {
    printf("sbrk(i<0) not implemented\n");
    exit(-1);
  }
  p = malloc(i);
  if (p != NULL) {
    memset(p, 0, i);
    brk += i;
    return p;
  } // XXX memset is probably redundant since we never reallocate
  return (void *)-1;
}

void xexit(int rc) {
  struct termios sttybuf;
  tcgetattr(0, &sttybuf);
  sttybuf.c_lflag |= ECHO | ICANON;
  tcsetattr(0, TCSANOW, &sttybuf);
  exit(rc);
}

int main(int argc, char *argv[]) {
  extern int xmain();
  struct termios sttybuf;
  int i;
  tcgetattr(0, &sttybuf);
  sttybuf.c_lflag &= ~(ECHO | ICANON);
  tcsetattr(0, TCSANOW, &sttybuf);
  for (i = 0; i < 3; i++) {
    xfd[i] = i;
    xft[i] = xCONSOLE;
  }
  for (i = 3; i < NOFILE; i++) {
    xfd[i] = -1;
    xft[i] = xCLOSED;
  }
  xexit(xmain(argc, argv));
}

#define dprintf xdprintf
#define open xopen
#define close xclose
#define read xread
#define write xwrite
#define stat xstat
#define fstat xfstat

#define exit xexit
#define main xmain
#define sbrk xsbrk

// linux/libm.h
// Allows a few specific programs to compile and run under linux.

#include <math.h>

// linux/net.h
// Allows a few specific programs to compile and run under linux.

#include <netinet/in.h>
#include <sys/select.h>

int xsocket(int family, int ty, int protocol) {
  int i, d;
  for (i = 0; i < NOFILE; i++) {
    if (xft[i] == xCLOSED) {
      if ((d = socket(family, ty, protocol)) < 0) {
        return d;
      }
      xft[i] = xSOCKET;
      xfd[i] = d; // printf("socket()%d=%d\n",d,i);
      return i;
    }
  }
  return -1;
}

// XXX use linux poll?
struct pollfd {
  int fd;
  short events, revents;
};
enum { POLLIN = 1, POLLOUT = 2, POLLNVAL = 4 };
int xpoll(struct pollfd *pfd, uint n, int msec) {
  struct pollfd *p, *pn = &pfd[n];
  int f, r;
  fd_set hr, hw, *phr, *phw;
  struct timeval t;

  phr = phw = 0;
  FD_ZERO(&hr);
  FD_ZERO(&hw);
  for (p = pfd; p != pn; p++) {
    p->revents = 0;
    f = p->fd;
    if (f < 0) {
      continue;
    }
    if (f >= NOFILE) {
      p->revents = POLLNVAL;
      continue;
    }
    switch (xft[f]) {
    case xCONSOLE:
    case xSOCKET:
      f = xfd[f];
      if (p->events & POLLIN) {
        phr = &hr;
        FD_SET(f, &hr);
      }
      if (p->events & POLLOUT) {
        phw = &hw;
        FD_SET(f, &hw);
      }
      continue;
    default:
      p->revents = POLLNVAL;
    }
  }

  //  if (phr || phw) { XXX
  if (msec >= 0) {
    t.tv_sec = msec / 1000;
    t.tv_usec = (msec % 1000) * 1000;
  }
  if ((r = select(FD_SETSIZE, phr, phw, 0, (msec < 0) ? 0 : &t)) < 0) {
    return r;
  }
  //  }
  //  else if (msec < 0) return -1;
  //  else { if (msec > 0) Sleep(msec); return 0; }

  r = 0;
  for (p = pfd; p != pn; p++) {
    f = p->fd;
    if (f < 0 || f >= NOFILE) {
      continue;
    }
    switch (xft[f]) {
    case xCONSOLE:
    case xSOCKET:
      f = xfd[f];
      if (FD_ISSET(f, &hr)) {
        p->revents |= POLLIN;
      }
      if (FD_ISSET(f, &hw)) {
        p->revents |= POLLOUT;
      }
      if (p->revents) {
        r++;
      }
      continue;
    }
  }
  return r;
}

int xbind(int d, void *a, int sz) {
  return ((uint)d >= NOFILE) ? -1 : bind(xfd[d], a, sz);
}
int xlisten(int d, int n) {
  return ((uint)d >= NOFILE) ? -1 : listen(xfd[d], n);
}
int xaccept(int d, void *a, void *b) {
  int i, r;
  if ((uint)d >= NOFILE) {
    return -1;
  }
  for (i = 0; i < NOFILE; i++) {
    if (xft[i] == xCLOSED) {
      if ((r = accept(xfd[d], a, b)) < 0) {
        return r;
      }
      xft[i] = xSOCKET;
      xfd[i] = r;
      return i;
    }
  }
  return -1;
}
int xconnect(int d, void *a, int n) {
  return ((uint)d >= NOFILE) ? -1 : connect(xfd[d], a, n);
}

#define socket xsocket
#define bind xbind
#define listen xlisten
#define accept xaccept
#define connect xconnect
#define poll xpoll

// em -- cpu emulator
//
// Usage:  em [-v] [-m memsize] [-f filesys] file
//
// Description:
//
// Written by Robert Swierczek

// #include <u.h>
// #include <libc.h>
// #include <libm.h>
// #include <net.h>

enum {
  MEM_SZ = 128 * 1024 * 1024, // default memory size of virtual machine (128M)
  TB_SZ = 1024 * 1024,     // page translation buffer array size (4G / pagesize)
  FS_SZ = 4 * 1024 * 1024, // ram file system size (4M)
  TPAGES = 4096,           // maximum cached page translations
};

enum {           // page table entry flags
  PTE_P = 0x001, // Present
  PTE_W = 0x002, // Writeable
  PTE_U = 0x004, // User
  PTE_A = 0x020, // Accessed
  PTE_D = 0x040, // Dirty
};

enum {      // processor fault codes (some can be masked together)
  FMEM,     // bad physical address
  FTIMER,   // timer interrupt
  FKEYBD,   // keyboard interrupt
  FPRIV,    // privileged instruction
  FINST,    // illegal instruction
  FSYS,     // software trap
  FARITH,   // arithmetic trap
  FIPAGE,   // page fault on opcode fetch
  FWPAGE,   // page fault on write
  FRPAGE,   // page fault on read
  USER = 16 // user mode exception
};

uint verbose,      // chatty option -v
    mem, memsz,    // physical memory
    user,          // user mode
    iena,          // interrupt enable
    ipend,         // interrupt pending
    trap,          // fault code
    ivec,          // interrupt vector
    vadr,          // bad virtual address
    paging,        // virtual memory enabled
    pdir,          // page directory
    tpage[TPAGES], // valid page translations
    tpages,        // number of cached page translations
    *trk, *twk,    // kernel read/write page transation tables
    *tru, *twu,    // user read/write page transation tables
    *tr, *tw;      // current read/write page transation tables

char *cmd; // command name

void *new (int size) {
  void *p;
  if ((p = sbrk((size + 7) & -8)) == (void *)-1) {
    dprintf(2, "%s : fatal: unable to sbrk(%d)\n", cmd, size);
    exit(-1);
  }
  return (void *)(((int)p + 7) & -8);
}

flush() {
  uint v;
  //  static int xx; if (tpages >= xx) { xx = tpages; dprintf(2,"******
  //  flush(%d)\n",tpages); }
  //  if (verbose) printf("F(%d)",tpages);
  while (tpages) {
    v = tpage[--tpages];
    trk[v] = twk[v] = tru[v] = twu[v] = 0;
  }
}

uint setpage(uint v, uint p, uint writable, uint userable) {
  if (p >= memsz) {
    trap = FMEM;
    vadr = v;
    return 0;
  }
  p = ((v ^ (mem + p)) & -4096) + 1;
  if (!trk[v >>= 12]) {
    if (tpages >= TPAGES) {
      flush();
    }
    tpage[tpages++] = v;
  }
  //  if (verbose) printf(".");
  trk[v] = p;
  twk[v] = writable ? p : 0;
  tru[v] = userable ? p : 0;
  twu[v] = (userable && writable) ? p : 0;
  return p;
}

uint rlook(uint v) {
  uint pde, *ppde, pte, *ppte, q, userable;
  //  dprintf(2,"rlook(%08x)\n",v);
  if (!paging) {
    return setpage(v, v, 1, 1);
  }
  pde = *(ppde = (uint *)(pdir + (v >> 22 << 2))); // page directory entry
  if (pde & PTE_P) {
    if (!(pde & PTE_A)) {
      *ppde = pde | PTE_A;
    }
    if (pde >= memsz) {
      trap = FMEM;
      vadr = v;
      return 0;
    }
    pte = *(ppte = (uint *)(mem + (pde & -4096) +
                            ((v >> 10) & 0xffc))); // page table entry
    if ((pte & PTE_P) && ((userable = (q = pte & pde) & PTE_U) || !user)) {
      if (!(pte & PTE_A)) {
        *ppte = pte | PTE_A;
      }
      return setpage(
          v, pte, (pte & PTE_D) && (q & PTE_W),
          userable); // set writable after first write so dirty gets set
    }
  }
  trap = FRPAGE;
  vadr = v;
  return 0;
}

uint wlook(uint v) {
  uint pde, *ppde, pte, *ppte, q, userable;
  //  dprintf(2,"wlook(%08x)\n",v);
  if (!paging) {
    return setpage(v, v, 1, 1);
  }
  pde = *(ppde = (uint *)(pdir + (v >> 22 << 2))); // page directory entry
  if (pde & PTE_P) {
    if (!(pde & PTE_A)) {
      *ppde = pde | PTE_A;
    }
    if (pde >= memsz) {
      trap = FMEM;
      vadr = v;
      return 0;
    }
    pte = *(ppte = (uint *)(mem + (pde & -4096) +
                            ((v >> 10) & 0xffc))); // page table entry
    if ((pte & PTE_P) &&
        (((userable = (q = pte & pde) & PTE_U) || !user) && (q & PTE_W))) {
      if ((pte & (PTE_D | PTE_A)) != (PTE_D | PTE_A)) {
        *ppte = pte | (PTE_D | PTE_A);
      }
      return setpage(v, pte, q & PTE_W, userable);
    }
  }
  trap = FWPAGE;
  vadr = v;
  return 0;
}

void cpu(uint pc, uint sp) {
  uint a, b, c, ssp, usp, t, p, v, u, delta, cycle, xcycle, timer, timeout, fpc,
      tpc, xsp, tsp, fsp;
  double f, g;
  int ir, *xpc, kbchar;
  char ch;
  struct pollfd pfd;
  struct sockaddr_in addr;
  static char rbuf[4096]; // XXX

  a = b = c = timer = timeout = fpc = tsp = fsp = 0;
  cycle = delta = 4096;
  xcycle = delta * 4;
  kbchar = -1;
  xpc = 0;
  tpc = -pc;
  xsp = sp;
  void *follower = &&fixpc;
  goto gotomanager;

gotomanager:
  if (follower == 0)
    return;
  else
    goto *follower;

fixsp:
  if (p = tw[(v = xsp - tsp) >> 12]) {
    tsp = (xsp = v ^ (p - 1)) - v;
    fsp = (4096 - (xsp & 4095)) << 8;
  }
  follower = &&loopstart;
  goto gotomanager;

loopstart:
  if ((uint)xpc == fpc) {
    follower = &&fixpc;
    goto gotomanager;
  } else {
    follower = &&passifstat;
    goto gotomanager;
  }

fixpc:
  if (!(p = tr[(v = (uint)xpc - tpc) >> 12]) && !(p = rlook(v))) {
    trap = FIPAGE;
    follower = &&exception;
    goto gotomanager;
  }
  xcycle -= tpc;
  xcycle += (tpc = (uint)(xpc = (int *)(v ^ (p - 1))) - v);
  fpc = ((uint)xpc + 4096) & -4096;
  follower = &&next;
  goto gotomanager;

next:
  if ((uint)xpc > xcycle) {
    cycle += delta;
    xcycle += delta * 4;
    if (iena ||
        !(ipend & FKEYBD)) { // XXX dont do this, use a small queue instead
      pfd.fd = 0;
      pfd.events = POLLIN;
      if (poll(&pfd, 1, 0) == 1 && read(0, &ch, 1) == 1) {
        kbchar = ch;
        if (kbchar == '`') {
          dprintf(2, "ungraceful exit. cycle = %u\n",
                  cycle + (int)((uint)xpc - xcycle) / 4);
          follower = 0;
          goto gotomanager;
        }
        if (iena) {
          trap = FKEYBD;
          iena = 0;
          follower = &&interrupt;
          goto gotomanager;
        }
        ipend |= FKEYBD;
      }
    }
    if (timeout) {
      timer += delta;
      if (timer >= timeout) { // XXX  // any interrupt actually!
        //          dprintf(2,"timeout! timer=%d,
        //          timeout=%d\n",timer,timeout);
        timer = 0;
        if (iena) {
          trap = FTIMER;
          iena = 0;
          follower = &&interrupt;
          goto gotomanager;
        }
        ipend |= FTIMER;
      }
    }
  }
  follower = &&passifstat;
  goto gotomanager;

passifstat:
  switch ((uchar)(ir = *xpc++)) {
  case HALT:
    if (user || verbose)
      dprintf(2, "halt(%d) cycle = %u\n", a,
              cycle + (int)((uint)xpc - xcycle) / 4);
    follower = 0;
    goto gotomanager; // XXX should be supervisor!
  case IDLE:
    if (user) {
      trap = FPRIV;
      break;
    }
    if (!iena) {
      trap = FINST;
      break;
    } // XXX this will be fatal !!!
    for (;;) {
      pfd.fd = 0;
      pfd.events = POLLIN;
      if (poll(&pfd, 1, 0) == 1 && read(0, &ch, 1) == 1) {
        kbchar = ch;
        if (kbchar == '`') {
          dprintf(2, "ungraceful exit. cycle = %u\n",
                  cycle + (int)((uint)xpc - xcycle) / 4);
          follower = 0;
          goto gotomanager;
        }
        trap = FKEYBD;
        iena = 0;
        follower = &&interrupt;
        goto gotomanager;
      }
      cycle += delta;
      if (timeout) {
        timer += delta;
        if (timer >= timeout) { // XXX  // any interrupt actually!
          //        dprintf(2,"IDLE timeout! timer=%d,
          //        timeout=%d\n",timer,timeout);
          timer = 0;
          trap = FTIMER;
          iena = 0;
          follower = &&interrupt;
          goto gotomanager;
        }
      }
    }

  // memory -- designed to be restartable/continuable after
  // exception/interrupt
  case MCPY: // while (c) { *a = *b; a++; b++; c--; }
    while (c) {
      if (!(t = tr[b >> 12]) && !(t = rlook(b))) {
        follower = &&exception;
        goto gotomanager;
      }
      if (!(p = tw[a >> 12]) && !(p = wlook(a))) {
        follower = &&exception;
        goto gotomanager;
      }
      if ((v = 4096 - (a & 4095)) > c) {
        v = c;
      }
      if ((u = 4096 - (b & 4095)) > v) {
        u = v;
      }
      memcpy((char *)(a ^ (p & -2)), (char *)(b ^ (t & -2)), u);
      a += u;
      b += u;
      c -= u;
      //        if (!(++cycle % DELTA)) { pc -= 4; break; } XXX
    }
    follower = &&loopstart;
    goto gotomanager;

  case MCMP: // for (;;) { if (!c) { a = 0; break; } if (*b != *a) { a = *b -
    // *a; b += c; c = 0; break; } a++; b++; c--; }
    for (;;) {
      if (!c) {
        a = 0;
        break;
      }
      if (!(t = tr[b >> 12]) && !(t = rlook(b))) {
        follower = &&exception;
        goto gotomanager;
      }
      if (!(p = tr[a >> 12]) && !(p = rlook(a))) {
        follower = &&exception;
        goto gotomanager;
      }
      if ((v = 4096 - (a & 4095)) > c) {
        v = c;
      }
      if ((u = 4096 - (b & 4095)) > v) {
        u = v;
      }
      if (t = memcmp((char *)(a ^ (p & -2)), (char *)(b ^ (t & -2)), u)) {
        a = t;
        b += c;
        c = 0;
        break;
      }
      a += u;
      b += u;
      c -= u;
      //        if (!(++cycle % DELTA)) { pc -= 4; break; } XXX
    }
    follower = &&loopstart;
    goto gotomanager;

  case MCHR: // for (;;) { if (!c) { a = 0; break; } if (*a == b) { c = 0;
    // break; } a++; c--; }
    for (;;) {
      if (!c) {
        a = 0;
        break;
      }
      if (!(p = tr[a >> 12]) && !(p = rlook(a))) {
        follower = &&exception;
        goto gotomanager;
      }
      if ((u = 4096 - (a & 4095)) > c) {
        u = c;
      }
      if (t = (uint)memchr((char *)(v = a ^ (p & -2)), b, u)) {
        a += t - v;
        c = 0;
        break;
      }
      a += u;
      c -= u;
      //        if (!(++cycle % DELTA)) { pc -= 4; break; } XXX
    }
    follower = &&loopstart;
    goto gotomanager;

  case MSET: // while (c) { *a = b; a++; c--; }
    while (c) {
      if (!(p = tw[a >> 12]) && !(p = wlook(a))) {
        follower = &&exception;
        goto gotomanager;
      }
      if ((u = 4096 - (a & 4095)) > c) {
        u = c;
      }
      memset((char *)(a ^ (p & -2)), b, u);
      a += u;
      c -= u;
      //        if (!(++cycle % DELTA)) { pc -= 4; break; } XXX
    }
    follower = &&loopstart;
    goto gotomanager;

  // math
  case POW:
    f = pow(f, g);
    follower = &&loopstart;
    goto gotomanager;
  case ATN2:
    f = atan2(f, g);
    follower = &&loopstart;
    goto gotomanager;
  case FABS:
    f = fabs(f);
    follower = &&loopstart;
    goto gotomanager;
  case ATAN:
    f = atan(f);
    follower = &&loopstart;
    goto gotomanager;
  case LOG:
    if (f) {
      f = log(f);
    }
    follower = &&loopstart;
    goto gotomanager; // XXX others?
  case LOGT:
    if (f) {
      f = log10(f);
    }
    follower = &&loopstart;
    goto gotomanager; // XXX
  case EXP:
    f = exp(f);
    follower = &&loopstart;
    goto gotomanager;
  case FLOR:
    f = floor(f);
    follower = &&loopstart;
    goto gotomanager;
  case CEIL:
    f = ceil(f);
    follower = &&loopstart;
    goto gotomanager;
  case HYPO:
    f = hypot(f, g);
    follower = &&loopstart;
    goto gotomanager;
  case SIN:
    f = sin(f);
    follower = &&loopstart;
    goto gotomanager;
  case COS:
    f = cos(f);
    follower = &&loopstart;
    goto gotomanager;
  case TAN:
    f = tan(f);
    follower = &&loopstart;
    goto gotomanager;
  case ASIN:
    f = asin(f);
    follower = &&loopstart;
    goto gotomanager;
  case ACOS:
    f = acos(f);
    follower = &&loopstart;
    goto gotomanager;
  case SINH:
    f = sinh(f);
    follower = &&loopstart;
    goto gotomanager;
  case COSH:
    f = cosh(f);
    follower = &&loopstart;
    goto gotomanager;
  case TANH:
    f = tanh(f);
    follower = &&loopstart;
    goto gotomanager;
  case SQRT:
    f = sqrt(f);
    follower = &&loopstart;
    goto gotomanager;
  case FMOD:
    f = fmod(f, g);
    follower = &&loopstart;
    goto gotomanager;

  case ENT:
    if (fsp && (fsp -= ir & -256) > 4096 << 8) {
      fsp = 0;
    }
    xsp += ir >> 8;
    if (fsp) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LEV:
    if (ir < fsp) {
      t = *(uint *)(xsp + (ir >> 8)) + tpc;
      fsp -= (ir + 0x800) & -256;
    } // XXX revisit this mess
    else {
      if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
        break;
      }
      t = *(uint *)((v ^ p) & -8) + tpc;
      fsp = 0;
    }
    xsp += (ir >> 8) + 8;
    xcycle += t - (uint)xpc;
    if ((uint)(xpc = (uint *)t) - fpc < -4096) {
      follower = &&fixpc;
      goto gotomanager;
    }
    follower = &&next;
    goto gotomanager;

  // jump
  case JMP:
    xcycle += ir >> 8;
    if ((uint)(xpc += ir >> 10) - fpc < -4096) {
      follower = &&fixpc;
      goto gotomanager;
    }
    follower = &&next;
    goto gotomanager;
  case JMPI:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8) + (a << 2)) >> 12]) &&
        !(p = rlook(v))) {
      break;
    }
    xcycle += (t = *(uint *)((v ^ p) & -4));
    if ((uint)(xpc = (int *)((uint)xpc + t)) - fpc < -4096) {
      follower = &&fixpc;
      goto gotomanager;
    }
    follower = &&next;
    goto gotomanager;
  case JSR:
    if (fsp & (4095 << 8)) {
      xsp -= 8;
      fsp += 8 << 8;
      *(uint *)xsp = (uint)xpc - tpc;
    } else {
      if (!(p = tw[(v = xsp - tsp - 8) >> 12]) && !(p = wlook(v))) {
        break;
      }
      *(uint *)((v ^ p) & -8) = (uint)xpc - tpc;
      fsp = 0;
      xsp -= 8;
    }
    xcycle += ir >> 8;
    if ((uint)(xpc += ir >> 10) - fpc < -4096) {
      follower = &&fixpc;
      goto gotomanager;
    }
    follower = &&next;
    goto gotomanager;
  case JSRA:
    if (fsp & (4095 << 8)) {
      xsp -= 8;
      fsp += 8 << 8;
      *(uint *)xsp = (uint)xpc - tpc;
    } else {
      if (!(p = tw[(v = xsp - tsp - 8) >> 12]) && !(p = wlook(v))) {
        break;
      }
      *(uint *)((v ^ p) & -8) = (uint)xpc - tpc;
      fsp = 0;
      xsp -= 8;
    }
    xcycle += a + tpc - (uint)xpc;
    if ((uint)(xpc = (uint *)(a + tpc)) - fpc < -4096) {
      follower = &&fixpc;
      goto gotomanager;
    }
    follower = &&next;
    goto gotomanager;

  // stack
  case PSHA:
    if (fsp & (4095 << 8)) {
      xsp -= 8;
      fsp += 8 << 8;
      *(uint *)xsp = a;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp - 8) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(uint *)((v ^ p) & -8) = a;
    xsp -= 8;
    fsp = 0;
    follower = &&fixsp;
    goto gotomanager;
  case PSHB:
    if (fsp & (4095 << 8)) {
      xsp -= 8;
      fsp += 8 << 8;
      *(uint *)xsp = b;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp - 8) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(uint *)((v ^ p) & -8) = b;
    xsp -= 8;
    fsp = 0;
    follower = &&fixsp;
    goto gotomanager;
  case PSHC:
    if (fsp & (4095 << 8)) {
      xsp -= 8;
      fsp += 8 << 8;
      *(uint *)xsp = c;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp - 8) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(uint *)((v ^ p) & -8) = c;
    xsp -= 8;
    fsp = 0;
    follower = &&fixsp;
    goto gotomanager;
  case PSHF:
    if (fsp & (4095 << 8)) {
      xsp -= 8;
      fsp += 8 << 8;
      *(double *)xsp = f;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp - 8) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(double *)((v ^ p) & -8) = f;
    xsp -= 8;
    fsp = 0;
    follower = &&fixsp;
    goto gotomanager;
  case PSHG:
    if (fsp & (4095 << 8)) {
      xsp -= 8;
      fsp += 8 << 8;
      *(double *)xsp = g;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp - 8) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(double *)((v ^ p) & -8) = g;
    xsp -= 8;
    fsp = 0;
    follower = &&fixsp;
    goto gotomanager;
  case PSHI:
    if (fsp & (4095 << 8)) {
      xsp -= 8;
      fsp += 8 << 8;
      *(int *)xsp = ir >> 8;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp - 8) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(int *)((v ^ p) & -8) = ir >> 8;
    xsp -= 8;
    fsp = 0;
    follower = &&fixsp;
    goto gotomanager;

  case POPA:
    if (fsp) {
      a = *(uint *)xsp;
      xsp += 8;
      fsp -= 8 << 8;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(uint *)((v ^ p) & -8);
    xsp += 8;
    follower = &&fixsp;
    goto gotomanager;
  case POPB:
    if (fsp) {
      b = *(uint *)xsp;
      xsp += 8;
      fsp -= 8 << 8;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(uint *)((v ^ p) & -8);
    xsp += 8;
    follower = &&fixsp;
    goto gotomanager;
  case POPC:
    if (fsp) {
      c = *(uint *)xsp;
      xsp += 8;
      fsp -= 8 << 8;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp) >> 12]) && !(p = rlook(v))) {
      break;
    }
    c = *(uint *)((v ^ p) & -8);
    xsp += 8;
    follower = &&fixsp;
    goto gotomanager;
  case POPF:
    if (fsp) {
      f = *(double *)xsp;
      xsp += 8;
      fsp -= 8 << 8;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp) >> 12]) && !(p = rlook(v))) {
      break;
    }
    f = *(double *)((v ^ p) & -8);
    xsp += 8;
    follower = &&fixsp;
    goto gotomanager;
  case POPG:
    if (fsp) {
      g = *(double *)xsp;
      xsp += 8;
      fsp -= 8 << 8;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp) >> 12]) && !(p = rlook(v))) {
      break;
    }
    g = *(double *)((v ^ p) & -8);
    xsp += 8;
    follower = &&fixsp;
    goto gotomanager;

  // load effective address
  case LEA:
    a = xsp - tsp + (ir >> 8);
    follower = &&loopstart;
    goto gotomanager;
  case LEAG:
    a = (uint)xpc - tpc + (ir >> 8);
    follower = &&loopstart;
    goto gotomanager;

  // load a local
  case LL:
    if (ir < fsp) {
      a = *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LLS:
    if (ir < fsp) {
      a = *(short *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(short *)((v ^ p) & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LLH:
    if (ir < fsp) {
      a = *(ushort *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(ushort *)((v ^ p) & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LLC:
    if (ir < fsp) {
      a = *(char *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(char *)(v ^ p & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LLB:
    if (ir < fsp) {
      a = *(uchar *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(uchar *)(v ^ p & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LLD:
    if (ir < fsp) {
      f = *(double *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    f = *(double *)((v ^ p) & -8);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LLF:
    if (ir < fsp) {
      f = *(float *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    f = *(float *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  // load a global
  case LG:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(uint *)((v ^ p) & -4);
    follower = &&loopstart;
    goto gotomanager;
  case LGS:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(short *)((v ^ p) & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LGH:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(ushort *)((v ^ p) & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LGC:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(char *)(v ^ p & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LGB:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(uchar *)(v ^ p & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LGD:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    f = *(double *)((v ^ p) & -8);
    follower = &&loopstart;
    goto gotomanager;
  case LGF:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    f = *(float *)((v ^ p) & -4);
    follower = &&loopstart;
    goto gotomanager;

  // load a indexed
  case LX:
    if (!(p = tr[(v = a + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(uint *)((v ^ p) & -4);
    follower = &&loopstart;
    goto gotomanager;
  case LXS:
    if (!(p = tr[(v = a + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(short *)((v ^ p) & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LXH:
    if (!(p = tr[(v = a + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(ushort *)((v ^ p) & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LXC:
    if (!(p = tr[(v = a + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(char *)(v ^ p & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LXB:
    if (!(p = tr[(v = a + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = *(uchar *)(v ^ p & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LXD:
    if (!(p = tr[(v = a + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    f = *(double *)((v ^ p) & -8);
    follower = &&loopstart;
    goto gotomanager;
  case LXF:
    if (!(p = tr[(v = a + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    f = *(float *)((v ^ p) & -4);
    follower = &&loopstart;
    goto gotomanager;

  // load a immediate
  case LI:
    a = ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case LHI:
    a = a << 24 | (uint)ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case LIF:
    f = (ir >> 8) / 256.0;
    follower = &&loopstart;
    goto gotomanager;

  // load b local
  case LBL:
    if (ir < fsp) {
      b = *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LBLS:
    if (ir < fsp) {
      b = *(short *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(short *)((v ^ p) & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LBLH:
    if (ir < fsp) {
      b = *(ushort *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(ushort *)((v ^ p) & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LBLC:
    if (ir < fsp) {
      b = *(char *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(char *)(v ^ p & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LBLB:
    if (ir < fsp) {
      b = *(uchar *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(uchar *)(v ^ p & -2);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LBLD:
    if (ir < fsp) {
      g = *(double *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    g = *(double *)((v ^ p) & -8);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case LBLF:
    if (ir < fsp) {
      g = *(float *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    g = *(float *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  // load b global
  case LBG:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(uint *)((v ^ p) & -4);
    follower = &&loopstart;
    goto gotomanager;
  case LBGS:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(short *)((v ^ p) & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LBGH:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(ushort *)((v ^ p) & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LBGC:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(char *)(v ^ p & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LBGB:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(uchar *)(v ^ p & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LBGD:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    g = *(double *)((v ^ p) & -8);
    follower = &&loopstart;
    goto gotomanager;
  case LBGF:
    if (!(p = tr[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    g = *(float *)((v ^ p) & -4);
    follower = &&loopstart;
    goto gotomanager;

  // load b indexed
  case LBX:
    if (!(p = tr[(v = b + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(uint *)((v ^ p) & -4);
    follower = &&loopstart;
    goto gotomanager;
  case LBXS:
    if (!(p = tr[(v = b + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(short *)((v ^ p) & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LBXH:
    if (!(p = tr[(v = b + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(ushort *)((v ^ p) & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LBXC:
    if (!(p = tr[(v = b + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(char *)(v ^ p & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LBXB:
    if (!(p = tr[(v = b + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    b = *(uchar *)(v ^ p & -2);
    follower = &&loopstart;
    goto gotomanager;
  case LBXD:
    if (!(p = tr[(v = b + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    g = *(double *)((v ^ p) & -8);
    follower = &&loopstart;
    goto gotomanager;
  case LBXF:
    if (!(p = tr[(v = b + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    g = *(float *)((v ^ p) & -4);
    follower = &&loopstart;
    goto gotomanager;

  // load b immediate
  case LBI:
    b = ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case LBHI:
    b = b << 24 | (uint)ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case LBIF:
    g = (ir >> 8) / 256.0;
    follower = &&loopstart;
    goto gotomanager;

  // misc transfer
  case LCL:
    if (ir < fsp) {
      c = *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    c = *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case LBA:
    b = a;
    follower = &&loopstart;
    goto gotomanager; // XXX need LAB, LAC to improve k.c  // or maybe a = a *
                      // imm
  // + b
  // ?  or b = b * imm + a ?
  case LCA:
    c = a;
    follower = &&loopstart;
    goto gotomanager;
  case LBAD:
    g = f;
    follower = &&loopstart;
    goto gotomanager;

  // store a local
  case SL:
    if (ir < fsp) {
      *(uint *)(xsp + (ir >> 8)) = a;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(uint *)((v ^ p) & -4) = a;
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case SLH:
    if (ir < fsp) {
      *(ushort *)(xsp + (ir >> 8)) = a;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(ushort *)((v ^ p) & -2) = a;
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case SLB:
    if (ir < fsp) {
      *(uchar *)(xsp + (ir >> 8)) = a;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(uchar *)(v ^ p & -2) = a;
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case SLD:
    if (ir < fsp) {
      *(double *)(xsp + (ir >> 8)) = f;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(double *)((v ^ p) & -8) = f;
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;
  case SLF:
    if (ir < fsp) {
      *(float *)(xsp + (ir >> 8)) = f;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tw[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(float *)((v ^ p) & -4) = f;
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  // store a global
  case SG:
    if (!(p = tw[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(uint *)((v ^ p) & -4) = a;
    follower = &&loopstart;
    goto gotomanager;
  case SGH:
    if (!(p = tw[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(ushort *)((v ^ p) & -2) = a;
    follower = &&loopstart;
    goto gotomanager;
  case SGB:
    if (!(p = tw[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(uchar *)(v ^ p & -2) = a;
    follower = &&loopstart;
    goto gotomanager;
  case SGD:
    if (!(p = tw[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(double *)((v ^ p) & -8) = f;
    follower = &&loopstart;
    goto gotomanager;
  case SGF:
    if (!(p = tw[(v = (uint)xpc - tpc + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(float *)((v ^ p) & -4) = f;
    follower = &&loopstart;
    goto gotomanager;

  // store a indexed
  case SX:
    if (!(p = tw[(v = b + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(uint *)((v ^ p) & -4) = a;
    follower = &&loopstart;
    goto gotomanager;
  case SXH:
    if (!(p = tw[(v = b + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(ushort *)((v ^ p) & -2) = a;
    follower = &&loopstart;
    goto gotomanager;
  case SXB:
    if (!(p = tw[(v = b + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(uchar *)(v ^ p & -2) = a;
    follower = &&loopstart;
    goto gotomanager;
  case SXD:
    if (!(p = tw[(v = b + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(double *)((v ^ p) & -8) = f;
    follower = &&loopstart;
    goto gotomanager;
  case SXF:
    if (!(p = tw[(v = b + (ir >> 8)) >> 12]) && !(p = wlook(v))) {
      break;
    }
    *(float *)((v ^ p) & -4) = f;
    follower = &&loopstart;
    goto gotomanager;

  // arithmetic
  case ADDF:
    f += g;
    follower = &&loopstart;
    goto gotomanager;
  case SUBF:
    f -= g;
    follower = &&loopstart;
    goto gotomanager;
  case MULF:
    f *= g;
    follower = &&loopstart;
    goto gotomanager;
  case DIVF:
    if (g == 0.0) {
      trap = FARITH;
      break;
    }
    f /= g;
    follower = &&loopstart;
    goto gotomanager; // XXX

  case ADD:
    a += b;
    follower = &&loopstart;
    goto gotomanager;
  case ADDI:
    a += ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case ADDL:
    if (ir < fsp) {
      a += *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a += *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case SUB:
    a -= b;
    follower = &&loopstart;
    goto gotomanager;
  case SUBI:
    a -= ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case SUBL:
    if (ir < fsp) {
      a -= *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a -= *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case MUL:
    a = (int)a * (int)b;
    follower = &&loopstart;
    goto gotomanager; // XXX MLU ???
  case MULI:
    a = (int)a * (ir >> 8);
    follower = &&loopstart;
    goto gotomanager;
  case MULL:
    if (ir < fsp) {
      a = (int)a * *(int *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = (int)a * *(int *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case DIV:
    if (!b) {
      trap = FARITH;
      break;
    }
    a = (int)a / (int)b;
    follower = &&loopstart;
    goto gotomanager;
  case DIVI:
    if (!(t = ir >> 8)) {
      trap = FARITH;
      break;
    }
    a = (int)a / (int)t;
    follower = &&loopstart;
    goto gotomanager;
  case DIVL:
    if (ir < fsp) {
      if (!(t = *(uint *)(xsp + (ir >> 8)))) {
        trap = FARITH;
        break;
      }
      a = (int)a / (int)t;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    if (!(t = *(uint *)((v ^ p) & -4))) {
      trap = FARITH;
      break;
    }
    a = (int)a / (int)t;
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case DVU:
    if (!b) {
      trap = FARITH;
      break;
    }
    a /= b;
    follower = &&loopstart;
    goto gotomanager;
  case DVUI:
    if (!(t = ir >> 8)) {
      trap = FARITH;
      break;
    }
    a /= t;
    follower = &&loopstart;
    goto gotomanager;
  case DVUL:
    if (ir < fsp) {
      if (!(t = *(int *)(xsp + (ir >> 8)))) {
        trap = FARITH;
        break;
      }
      a /= t;
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    if (!(t = *(uint *)((v ^ p) & -4))) {
      trap = FARITH;
      break;
    }
    a /= t;
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case MOD:
    a = (int)a % (int)b;
    follower = &&loopstart;
    goto gotomanager;
  case MODI:
    a = (int)a % (ir >> 8);
    follower = &&loopstart;
    goto gotomanager;
  case MODL:
    if (ir < fsp) {
      a = (int)a % *(int *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = (int)a % *(int *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case MDU:
    a %= b;
    follower = &&loopstart;
    goto gotomanager;
  case MDUI:
    a %= (ir >> 8);
    follower = &&loopstart;
    goto gotomanager;
  case MDUL:
    if (ir < fsp) {
      a %= *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a %= *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case AND:
    a &= b;
    follower = &&loopstart;
    goto gotomanager;
  case ANDI:
    a &= ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case ANDL:
    if (ir < fsp) {
      a &= *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a &= *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case OR:
    a |= b;
    follower = &&loopstart;
    goto gotomanager;
  case ORI:
    a |= ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case ORL:
    if (ir < fsp) {
      a |= *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a |= *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case XOR:
    a ^= b;
    follower = &&loopstart;
    goto gotomanager;
  case XORI:
    a ^= ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case XORL:
    if (ir < fsp) {
      a ^= *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a ^= *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case SHL:
    a <<= b;
    follower = &&loopstart;
    goto gotomanager;
  case SHLI:
    a <<= ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case SHLL:
    if (ir < fsp) {
      a <<= *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a <<= *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case SHR:
    a = (int)a >> (int)b;
    follower = &&loopstart;
    goto gotomanager;
  case SHRI:
    a = (int)a >> (ir >> 8);
    follower = &&loopstart;
    goto gotomanager;
  case SHRL:
    if (ir < fsp) {
      a = (int)a >> *(int *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a = (int)a >> *(int *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  case SRU:
    a >>= b;
    follower = &&loopstart;
    goto gotomanager;
  case SRUI:
    a >>= ir >> 8;
    follower = &&loopstart;
    goto gotomanager;
  case SRUL:
    if (ir < fsp) {
      a >>= *(uint *)(xsp + (ir >> 8));
      follower = &&loopstart;
      goto gotomanager;
    }
    if (!(p = tr[(v = xsp - tsp + (ir >> 8)) >> 12]) && !(p = rlook(v))) {
      break;
    }
    a >>= *(uint *)((v ^ p) & -4);
    if (fsp || (v ^ (xsp - tsp)) & -4096) {
      follower = &&loopstart;
      goto gotomanager;
    }
    follower = &&fixsp;
    goto gotomanager;

  // logical
  case EQ:
    a = a == b;
    follower = &&loopstart;
    goto gotomanager;
  case EQF:
    a = f == g;
    follower = &&loopstart;
    goto gotomanager;
  case NE:
    a = a != b;
    follower = &&loopstart;
    goto gotomanager;
  case NEF:
    a = f != g;
    follower = &&loopstart;
    goto gotomanager;
  case LT:
    a = (int)a < (int)b;
    follower = &&loopstart;
    goto gotomanager;
  case LTU:
    a = a < b;
    follower = &&loopstart;
    goto gotomanager;
  case LTF:
    a = f < g;
    follower = &&loopstart;
    goto gotomanager;
  case GE:
    a = (int)a >= (int)b;
    follower = &&loopstart;
    goto gotomanager;
  case GEU:
    a = a >= b;
    follower = &&loopstart;
    goto gotomanager;
  case GEF:
    a = f >= g;
    follower = &&loopstart;
    goto gotomanager;

  // branch
  case BZ:
    if (!a) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BZF:
    if (!f) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BNZ:
    if (a) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BNZF:
    if (f) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BE:
    if (a == b) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BEF:
    if (f == g) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BNE:
    if (a != b) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BNEF:
    if (f != g) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BLT:
    if ((int)a < (int)b) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BLTU:
    if (a < b) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BLTF:
    if (f < g) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BGE:
    if ((int)a >= (int)b) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BGEU:
    if (a >= b) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;
  case BGEF:
    if (f >= g) {
      xcycle += ir >> 8;
      if ((uint)(xpc += ir >> 10) - fpc < -4096) {
        follower = &&fixpc;
        goto gotomanager;
      }
      follower = &&next;
      goto gotomanager;
    }
    follower = &&loopstart;
    goto gotomanager;

  // conversion
  case CID:
    f = (int)a;
    follower = &&loopstart;
    goto gotomanager;
  case CUD:
    f = a;
    follower = &&loopstart;
    goto gotomanager;
  case CDI:
    a = (int)f;
    follower = &&loopstart;
    goto gotomanager;
  case CDU:
    a = f;
    follower = &&loopstart;
    goto gotomanager;

  // misc
  case BIN:
    if (user) {
      trap = FPRIV;
      break;
    }
    a = kbchar;
    kbchar = -1;
    follower = &&loopstart;
    goto gotomanager; // XXX
  case BOUT:
    if (user) {
      trap = FPRIV;
      break;
    }
    if (a != 1) {
      dprintf(2, "bad write a=%d\n", a);
      follower = 0;
      goto gotomanager;
    }
    ch = b;
    a = write(a, &ch, 1);
    follower = &&loopstart;
    goto gotomanager;
  case SSP:
    xsp = a;
    tsp = fsp = 0;
    follower = &&fixsp;
    goto gotomanager;

  case NOP:
    follower = &&loopstart;
    goto gotomanager;
  case CYC:
    a = cycle + (int)((uint)xpc - xcycle) / 4;
    follower = &&loopstart;
    goto gotomanager; // XXX protected?  XXX also need wall clock time
                      // instruction
  case MSIZ:
    if (user) {
      trap = FPRIV;
      break;
    }
    a = memsz;
    follower = &&loopstart;
    goto gotomanager;

  case CLI:
    if (user) {
      trap = FPRIV;
      break;
    }
    a = iena;
    iena = 0;
    follower = &&loopstart;
    goto gotomanager;
  case STI:
    if (user) {
      trap = FPRIV;
      break;
    }
    if (ipend) {
      trap = ipend & -ipend;
      ipend ^= trap;
      iena = 0;
      follower = &&interrupt;
      goto gotomanager;
    }
    iena = 1;
    follower = &&loopstart;
    goto gotomanager;

  case RTI:
    if (user) {
      trap = FPRIV;
      break;
    }
    xsp -= tsp;
    tsp = fsp = 0;
    if (!(p = tr[xsp >> 12]) && !(p = rlook(xsp))) {
      dprintf(2, "RTI kstack fault\n");
      follower = &&fatal;
      goto gotomanager;
    }
    t = *(uint *)((xsp ^ p) & -8);
    xsp += 8;
    if (!(p = tr[xsp >> 12]) && !(p = rlook(xsp))) {
      dprintf(2, "RTI kstack fault\n");
      follower = &&fatal;
      goto gotomanager;
    }
    xcycle += (pc = *(uint *)((xsp ^ p) & -8) + tpc) - (uint)xpc;
    xsp += 8;
    xpc = (uint *)pc;
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
        follower = &&interrupt;
        goto gotomanager;
      }
      iena = 1;
    }
    follower = &&fixpc;
    goto gotomanager; // page may be invalid

  case IVEC:
    if (user) {
      trap = FPRIV;
      break;
    }
    ivec = a;
    follower = &&loopstart;
    goto gotomanager;
  case PDIR:
    if (user) {
      trap = FPRIV;
      break;
    }
    if (a > memsz) {
      trap = FMEM;
      break;
    }
    pdir = (mem + a) & -4096;
    flush();
    fsp = 0;
    follower = &&fixpc;
    goto gotomanager; // set page directory
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
    follower = &&fixpc;
    goto gotomanager; // enable paging

  case TIME:
    if (user) {
      trap = FPRIV;
      break;
    }
    if (ir >> 8) {
      dprintf(2, "timer%d=%u timeout=%u\n", ir >> 8, timer, timeout);
      follower = &&loopstart;
      goto gotomanager;
    } // XXX undocumented feature!
    timeout = a;
    follower = &&loopstart;
    goto gotomanager; // XXX cancel pending interrupts if disabled?

  // XXX need some sort of user mode thread locking functions to support user
  // mode semaphores, etc.  atomic test/set?

  case LVAD:
    if (user) {
      trap = FPRIV;
      break;
    }
    a = vadr;
    follower = &&loopstart;
    goto gotomanager;

  case TRAP:
    trap = FSYS;
    break;

  case LUSP:
    if (user) {
      trap = FPRIV;
      break;
    }
    a = usp;
    follower = &&loopstart;
    goto gotomanager;
  case SUSP:
    if (user) {
      trap = FPRIV;
      break;
    }
    usp = a;
    follower = &&loopstart;
    goto gotomanager;

  // networking -- XXX HACK CODE (and all wrong), but it gets some basic
  // networking going...
  case NET1:
    if (user) {
      trap = FPRIV;
      break;
    }
    a = socket(a, b, c);
    follower = &&loopstart;
    goto gotomanager; // XXX
  case NET2:
    if (user) {
      trap = FPRIV;
      break;
    }
    a = close(a);
    follower = &&loopstart;
    goto gotomanager; // XXX does this block?
  case NET3:
    if (user) {
      trap = FPRIV;
      break;
    }
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = b & 0xFFFF;
    addr.sin_port = b >> 16;
    addr.sin_addr.s_addr = c;
    a = connect(a, (struct sockaddr *)&addr,
                sizeof(struct sockaddr_in)); // XXX needs to be non-blocking
    follower = &&loopstart;
    goto gotomanager;
  case NET4:
    if (user) {
      trap = FPRIV;
      break;
    }
    t = 0;
    // XXX if ((unknown || !ready) && !poll()) return -1;
    if ((int)c > 0) {
      if ((int)c > sizeof(rbuf)) {
        c = sizeof(rbuf);
      }
      a = c = read(a, rbuf, c);
    } else {
      a = 0; // XXX uint or int??
    }
    while ((int)c > 0) {
      if (!(p = tw[b >> 12]) && !(p = wlook(b))) {
        dprintf(2, "unstable!!");
        exit(9);
      } // follower=&&exception;goto gotomanager; } XXX
      if ((u = 4096 - (b & 4095)) > c) {
        u = c;
      }
      memcpy((char *)(b ^ p & -2), &rbuf[t], u);
      t += u;
      b += u;
      c -= u;
    }
    follower = &&loopstart;
    goto gotomanager;
  case NET5:
    if (user) {
      trap = FPRIV;
      break;
    }
    t = c;
    // XXX if ((unknown || !ready) && !poll()) return -1;
    while ((int)c > 0) {
      if (!(p = tr[b >> 12]) && !(p = rlook(b))) {
        follower = &&exception;
        goto gotomanager;
      }
      if ((u = 4096 - (b & 4095)) > c) {
        u = c;
      }
      if ((int)(u = write(a, (char *)(b ^ p & -2), u)) > 0) {
        b += u;
        c -= u;
      } else {
        t = u;
        break;
      }
    }
    a = t;
    follower = &&loopstart;
    goto gotomanager;
  case NET6:
    if (user) {
      trap = FPRIV;
      break;
    }
    pfd.fd = a;
    pfd.events = POLLIN;
    a = poll(&pfd, 1, 0); // XXX do something completely different
    follower = &&loopstart;
    goto gotomanager;
  case NET7:
    if (user) {
      trap = FPRIV;
      break;
    }
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = b & 0xFFFF;
    addr.sin_port = b >> 16;
    addr.sin_addr.s_addr = c;
    a = bind(a, (struct sockaddr *)&addr, sizeof(struct sockaddr_in));
    follower = &&loopstart;
    goto gotomanager;
  case NET8:
    if (user) {
      trap = FPRIV;
      break;
    }
    a = listen(a, b);
    follower = &&loopstart;
    goto gotomanager;
  case NET9:
    if (user) {
      trap = FPRIV;
      break;
    }
    // XXX if ((unknown || !ready) && !poll()) return -1;
    a = accept(a, (void *)b,
               (void *)c); // XXX cant do this with virtual addresses!!!
    follower = &&loopstart;
    goto gotomanager;
  default:
    trap = FINST;
    break;
  }
  follower = &&exception;
  goto gotomanager;

exception:
  if (!iena) {
    dprintf(2, "exception in interrupt handler\n");
    follower = &&fatal;
    goto gotomanager;
  }
  follower = &&interrupt;
  goto gotomanager;

interrupt:
  xsp -= tsp;
  tsp = fsp = 0;
  if (user) {
    usp = xsp;
    xsp = ssp;
    user = 0;
    tr = trk;
    tw = twk;
    trap |= USER;
  }
  xsp -= 8;
  if (!(p = tw[xsp >> 12]) && !(p = wlook(xsp))) {
    dprintf(2, "kstack fault!\n");
    follower = &&fatal;
    goto gotomanager;
  }
  *(uint *)((xsp ^ p) & -8) = (uint)xpc - tpc;
  xsp -= 8;
  if (!(p = tw[xsp >> 12]) && !(p = wlook(xsp))) {
    dprintf(2, "kstack fault\n");
    follower = &&fatal;
    goto gotomanager;
  }
  *(uint *)((xsp ^ p) & -8) = trap;
  xcycle += ivec + tpc - (uint)xpc;
  xpc = (int *)(ivec + tpc);
  follower = &&fixpc;
  goto gotomanager;

fatal:
  dprintf(2, "processor halted! cycle = %u pc = %08x ir = %08x sp = %08x a = "
             "%d b = %d c = %d trap = %u\n",
          cycle + (int)((uint)xpc - xcycle) / 4, (uint)xpc - tpc, ir, xsp - tsp,
          a, b, c, trap);
  follower = 0;
  goto gotomanager;
}

usage() {
  dprintf(2, "%s : usage: %s [-v] [-m memsize] [-f filesys] file\n", cmd, cmd);
  exit(-1);
}

int main(int argc, char *argv[]) {
  int i, f;
  struct {
    uint magic, bss, entry, flags;
  } hdr;
  char *file, *fs;
  struct stat st;

  cmd = *argv++;
  if (argc < 2) {
    usage();
  }
  file = *argv;
  memsz = MEM_SZ;
  fs = 0;
  while (--argc && *file == '-') {
    switch (file[1]) {
    case 'v':
      verbose = 1;
      break;
    case 'm':
      memsz = atoi(*++argv) * (1024 * 1024);
      argc--;
      break;
    case 'f':
      fs = *++argv;
      argc--;
      break;
    default:
      usage();
    }
    file = *++argv;
  }

  if (verbose) {
    dprintf(2, "mem size = %u\n", memsz);
  }
  mem = (((int)new (memsz + 4096)) + 4095) & -4096;

  if (fs) {
    if (verbose) {
      dprintf(2, "%s : loading ram file system %s\n", cmd, fs);
    }
    if ((f = open(fs, O_RDONLY)) < 0) {
      dprintf(2, "%s : couldn't open file system %s\n", cmd, fs);
      return -1;
    }
    if (fstat(f, &st)) {
      dprintf(2, "%s : couldn't stat file system %s\n", cmd, fs);
      return -1;
    }
    if ((i = read(f, (void *)(mem + memsz - FS_SZ), st.st_size)) !=
        st.st_size) {
      dprintf(2, "%s : failed to read filesystem size %d returned %d\n", cmd,
              st.st_size, i);
      return -1;
    }
    close(f);
  }

  if ((f = open(file, O_RDONLY)) < 0) {
    dprintf(2, "%s : couldn't open %s\n", cmd, file);
    return -1;
  }
  if (fstat(f, &st)) {
    dprintf(2, "%s : couldn't stat file %s\n", cmd, file);
    return -1;
  }

  read(f, &hdr, sizeof(hdr));
  if (hdr.magic != 0xC0DEF00D) {
    dprintf(2, "%s : bad hdr.magic\n", cmd);
    return -1;
  }

  if (read(f, (void *)mem, st.st_size - sizeof(hdr)) !=
      st.st_size - sizeof(hdr)) {
    dprintf(2, "%s : failed to read file %sn", cmd, file);
    return -1;
  }
  close(f);

  //  if (verbose) dprintf(2,"entry = %u text = %u data = %u bss = %u\n",
  //  hdr.entry, hdr.text, hdr.data, hdr.bss);

  // setup virtual memory
  trk = (uint *)new (TB_SZ * sizeof(uint)); // kernel read table
  twk = (uint *)new (TB_SZ * sizeof(uint)); // kernel write table
  tru = (uint *)new (TB_SZ * sizeof(uint)); // user read table
  twu = (uint *)new (TB_SZ * sizeof(uint)); // user write table
  tr = trk;
  tw = twk;

  if (verbose) {
    dprintf(2, "%s : emulating %s\n", cmd, file);
  }
  cpu(hdr.entry, memsz - FS_SZ);
  return 0;
}
