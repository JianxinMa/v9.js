// u.h

typedef unsigned char uchar;
typedef unsigned short ushort;
typedef unsigned int uint;

// linux/libc.h
// Allows a few specific programs to compile and run under linux.

#include <assert.h>
#include <dirent.h>
#include <fcntl.h>
#include <memory.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <termios.h>
#include <unistd.h>

#define NOFILE 16 // XXX subject to change

#undef NAME_MAX
#undef PATH_MAX
#define NAME_MAX 256
#define PATH_MAX 256

enum { xCLOSED, xCONSOLE, xFILE, xSOCKET, xDIR };
int xfd[NOFILE];
int xft[NOFILE];

char *pesc = 0;

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
int xlseek(int d, int offset, int whence) {
  return ((uint)d >= NOFILE) ? -1 : lseek(xfd[d], offset, whence);
}
int xprintf(char *f, ...) {
  static char buf[4096];
  va_list v;
  int n;
  va_start(v, f);
  n = vsprintf(buf, f, v); // XXX should be my version!
  va_end(v);
  return xwrite(1, buf, n);
}
int xvprintf(char *f, va_list v) {
  static char buf[4096];
  return xwrite(1, buf, vsprintf(buf, f, v)); // XXX should be my version!
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
int xvdprintf(int d, char *f, va_list v) {
  static char buf[4096];
  return xwrite(d, buf, vsprintf(buf, f, v)); // XXX
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
int xmkdir(char *path) { return mkdir(path, 0644); }

int xfork(void) {
  printf("fork() not implemented\n");
  exit(-1);
}
int xwait(void) {
  printf("wait() not implemented\n");
  exit(-1);
}
int xpipe(int *fd) {
  printf("pipe() not implemented\n");
  exit(-1);
}
int xkill(int pid) {
  printf("kill() not implemented\n");
  exit(-1);
}
int xexec(char *path, char **argv) {
  printf("exec() not implemented\n");
  exit(-1);
}
int xmknod(char *path, int mode, int dev) {
  printf("mknod() not implemented\n");
  exit(-1);
}
int xlink(char *old, char *new) {
  printf("link() not implemented\n");
  exit(-1);
}
int xgetpid(void) {
  printf("getpid() not implemented\n");
  exit(-1);
}
int xsleep(int n) {
  printf("sleep() not implemented\n");
  exit(-1);
}
int xuptime(void) {
  printf("uptime() not implemented\n");
  exit(-1);
}
int xmount(char *spec, char *dir, int rwflag) {
  printf("mount() not implemented\n");
  exit(-1);
}
int xumount(char *spec) {
  printf("umount() not implemented\n");
  exit(-1);
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

#define printf xprintf
#define vprintf xvprintf
#define dprintf xdprintf
#define vdprintf xvdprintf
#define open xopen
#define close xclose
#define read xread
#define write xwrite
#define lseek xlseek
#define stat xstat
#define fstat xfstat
#define mkdir xmkdir

#define fork xfork
#define wait xwait
#define pipe xpipe
#define kill xkill
#define exec xexec
#define mknod xmknod
#define link xlink
#define getpid xgetpid
#define sleep xsleep
#define uptime xuptime
#define mount xmount
#define umount xumount

#define exit xexit
#define main xmain
#define sbrk xsbrk

// linux/dir.h
// Allows a few specific programs to compile and run under linux.

#include <dirent.h>

// mkfs.c - make file system

// #include <u.h>
// #include <libc.h>
// #include <dir.h>

enum {
  BUFSZ = 16 * 4096, // bitmap size
  DIRSIZ = 252,
  NDIR = 480,  // 1.9 MB
  NIDIR = 512, //   2 GB
  NIIDIR = 8,  //  32 GB
  NIIIDIR = 4, //  16 TB
};

struct dinode { // 4K disk inode structure
  ushort mode;  // file mode
  uint nlink;   // number of links to inode in file system
  uint size;    // size of file
  uint pad[17];
  uint dir[NDIR];       // data block addresses
  uint idir[NIDIR];     // 2 GB max file size
  uint iidir[NIIDIR];   // not yet implemented
  uint iiidir[NIIIDIR]; // not yet implemented
};

struct direct { // disk directory entry structure
  uint d_ino;
  char d_name[DIRSIZ];
};

uchar buf[BUFSZ];
uint bn;
int disk;

void xstrncpy(char *s, char *t, int n) { // no return value unlike strncpy
  while (n-- > 0 && (*s++ = *t++))
    ;
  while (n-- > 0) {
    *s++ = 0;
  }
}

void write_disk(void *b, uint n) {
  uint i;
  while (n) {
    if ((i = write(disk, b, n)) < 0) {
      dprintf(2, "write(%d) failed\n", n);
      exit(-1);
    }
    b += i;
    n -= i;
  }
}

void write_meta(uint size, uint mode, uint nlink) {
  uint i, b, dir, idir;
  struct dinode inode;
  static uint iblock[1024];

  // compute blocks, direct, and indirect
  b = (size + 4095) / 4096;
  dir = (b > NDIR) ? NDIR : b;
  idir = (b + 1023 - NDIR) / 1024;

  // write inode
  memset(&inode, 0, 4096);
  inode.mode = mode;
  inode.nlink = nlink;
  inode.size = size;
  bn++;
  for (i = 0; i < dir; i++) {
    inode.dir[i] = bn + idir + i;
  }
  for (i = 0; i < idir; i++) {
    inode.idir[i] = bn++;
  }
  write_disk(&inode, 4096);

  // write indirect blocks
  b += bn;
  bn += dir;
  while (bn < b) {
    for (i = 0; i < 1024; i++) {
      iblock[i] = (bn < b) ? bn++ : 0;
    }
    write_disk(iblock, 4096);
  }
}

void add_dir(uint parent, struct direct *sp) {
  uint size, dsize, dseek, nlink = 2;
  int f, n, i;
  struct direct *de, *p;
  DIR *d;
  struct dirent *dp;
  struct stat st;
  static uchar zeros[4096];

  // build directory
  de = sp;
  d = opendir(".");
  sp->d_ino = bn;
  xstrncpy(sp->d_name, ".", DIRSIZ);
  sp++;
  sp->d_ino = parent;
  xstrncpy(sp->d_name, "..", DIRSIZ);
  sp++;
  while (dp = readdir(d)) {
    if (!strcmp(dp->d_name, ".") || !strcmp(dp->d_name, "..") ||
        strlen(dp->d_name) > DIRSIZ) {
      continue;
    }
    if (stat(dp->d_name, &st)) {
      dprintf(2, "stat(%s) failed\n", dp->d_name);
      exit(-1);
    }
    if ((st.st_mode & S_IFMT) == S_IFREG) {
      sp->d_ino = st.st_size;
    } else if ((st.st_mode & S_IFMT) == S_IFDIR) {
      sp->d_ino = -1;
      nlink++;
    } else {
      continue;
    }
    xstrncpy(sp->d_name, dp->d_name, DIRSIZ);
    sp++;
  }
  closedir(d);
  parent = bn;

  // write inode
  write_meta(dsize = (uint)sp - (uint)de, S_IFDIR, nlink);
  dseek = (bn - ((dsize + 4095) / 4096)) * 4096;

  // write directory
  write_disk(de, dsize);
  if (dsize & 4095) {
    write_disk(zeros, 4096 - (dsize & 4095));
  }

  // add directory contents
  for (p = de + 2; p < sp; p++) {
    size = p->d_ino;
    p->d_ino = bn;
    if (size == -1) { // subdirectory
      chdir(p->d_name);
      add_dir(parent, sp);
      chdir("..");
    } else { // file
      write_meta(size, S_IFREG, 1);
      if (size) {
        if ((f = open(p->d_name, O_RDONLY)) < 0) {
          dprintf(2, "open(%s) failed\n", p->d_name);
          exit(-1);
        }
        for (n = size; n; n -= i) {
          if ((i = read(f, buf, (n > BUFSZ) ? BUFSZ : n)) < 0) {
            dprintf(2, "read(%s) failed\n", p->d_name);
            exit(-1);
          }
          write_disk(buf, i);
        }
        close(f);
        if (size & 4095) {
          write_disk(zeros, 4096 - (size & 4095));
        }
      }
    }
  }

  // update directory
  lseek(disk, dseek, SEEK_SET);
  write_disk(de, dsize);
  lseek(disk, 0, SEEK_END);
}

int main(int argc, char *argv[]) {
  struct direct *sp;
  static char cwd[PATH_MAX];
  if (sizeof(struct dinode) != 4096) {
    dprintf(2, "sizeof(struct dinode) %d != 4096\n", sizeof(struct dinode));
    return -1;
  }

  if (argc != 3) {
    dprintf(2, "Usage: mkfs fs rootdir\n");
    return -1;
  }
  if ((disk = open(argv[1], O_RDWR | O_CREAT | O_TRUNC)) < 0) {
    dprintf(2, "open(%s) failed\n", argv[1]);
    return -1;
  }
  if ((int)(sp = (struct direct *)sbrk(16 * 1024 * 1024)) == -1) {
    dprintf(2, "sbrk() failed\n");
    return -1;
  }

  // write zero bitmap
  write_disk(buf, BUFSZ);

  // populate file system
  getcwd(cwd, sizeof(cwd));
  chdir(argv[2]);
  add_dir(bn = 16, sp);
  chdir(cwd);

  // update bitmap
  memset(buf, 0xff, bn / 8);
  if (bn & 7) {
    buf[bn / 8] = (1 << (bn & 7)) - 1;
  }
  lseek(disk, 0, SEEK_SET);
  write_disk(buf, (bn + 7) / 8);
  close(disk);
  return 0;
}
