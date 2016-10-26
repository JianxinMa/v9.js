#ifndef __KERN_FS_FILE_H__
#define __KERN_FS_FILE_H__

#include <fs.h>

enum { O_RDONLY, O_WRONLY, O_RDWR, O_CREAT = 0x100, O_TRUNC = 0x200 };
enum { FD_NONE, FD_PIPE, FD_INODE, FD_SOCKET, FD_RFS };

struct file *getf(uint fd) {
  return (fd < MAX_OPEN_FILE) ? current->ofile[fd] : 0;
}

// pipes:
void pipeclose(struct pipe *p, int writable)
{
  panic("pipe close");
  // int e = splhi();
  // if (writable) {
  //   p->writeopen = 0;
  //   wakeup(&p->nread);
  // } else {
  //   p->readopen = 0;
  //   wakeup(&p->nwrite);
  // }
  // if (!p->readopen && !p->writeopen) kfree(p);
  // splx(e);
}

int piperead(struct pipe *p, char *addr, int n)
{
  panic("pipe read");
  // int i, e = splhi();
  //
  // while (p->nread == p->nwrite && p->writeopen) {  // XXX DOC: pipe-empty
  //   if (u->killed) {
  //     splx(e);
  //     return -1;
  //   }
  //   sleep(&p->nread); // XXX DOC: piperead-sleep
  // }
  // for (i = 0; i < n; i++) {  // XXX DOC: piperead-copy
  //   if (p->nread == p->nwrite) break;
  //   addr[i] = p->data[p->nread++ % PIPESIZE]; // XXX pagefault possible in cli (use inode locks instead?)
  // }
  // wakeup(&p->nwrite);  // XXX DOC: piperead-wakeup
  // splx(e);
  // return i;
}


// allocate a file structure
struct file *filealloc()
{
  struct file *f; int e = splhi();

  for (f = file; f < file + NFILE; f++) {
    if (!f->ref) {
      f->ref = 1;
      splx(e);
      return f;
    }
  }
  splx(e);
  return 0;
}

// allocate a file descriptor for the given file.  Takes over file reference from caller on success.
int fdalloc(struct file *f)
{
  int fd;

  for (fd = 0; fd < MAX_OPEN_FILE; fd++) {
    if (!current->ofile[fd]) {
      current->ofile[fd] = f;
      return fd;
    }
  }
  return -1;
}

fileclose(struct file *f)
{
  struct file ff; int e = splhi();

  if (f->ref < 1) panic("close");
  if (--f->ref > 0) {
    splx(e);
    return;
  }
  memcpy(&ff, f, sizeof(struct file)); //XXX  ff = *f;
  f->ref = 0;
  f->type = FD_NONE;
  splx(e);

  switch (ff.type) {
  case FD_PIPE:   pipeclose(ff.pipe, ff.writable); break;
  case FD_INODE:  iput(ff.ip); break;
  case FD_SOCKET:
  case FD_RFS:    panic("file close no socket. ");//sockclose(ff.off);
  }
}

int open(char *path, int oflag) // XXX, int mode)
{
  int fd, r; int h[4];
  struct file *f;
  struct inode *ip;
  // if (!svalid(path)) return -1;
//  if (!namecmp(path, "rfs.txt")) {
  if (!strcmp(path,"rfs/",4)) {
    panic("no socket");
  } else if (oflag & O_CREAT) {
    if (!(ip = create(path, S_IFREG, 0))) return -1;
  } else {
    if (!(ip = namei(path))) return -1;
    ilock(ip);
    if ((ip->mode & S_IFMT) == S_IFDIR && oflag != O_RDONLY) {
      iunlockput(ip);
      return -1;
    }
  }

  if (!(f = filealloc()) || (fd = fdalloc(f)) < 0) {
    if (f) fileclose(f);
    iunlockput(ip);
    return -1;
  }

  if (oflag & O_TRUNC)
    itrunc(ip);

  iunlock(ip);

  f->type = FD_INODE;
  f->ip = ip;
  f->off = 0;
  f->readable = !(oflag & O_WRONLY);
  f->writable = (oflag & O_WRONLY) || (oflag & O_RDWR);
  return fd;
}

int read(int fd, char *addr, int n)
{
  int r; int h[2]; struct file *f;
  if (!(f = getf(fd)) || !f->readable) return -1;
  switch (f->type) {
  case FD_PIPE: return piperead(f->pipe, addr, n);
  case FD_SOCKET: panic("read no socket.");
  case FD_INODE:
    ilock(f->ip);
    if ((r = readi(f->ip, addr, f->off, n)) > 0) f->off += r;
    iunlock(f->ip);
    return r;
  case FD_RFS: panic("read no socket.");
  }
  panic("read");
}

// increment ref count for file
struct file *filedup(struct file *f)
{
  int e = splhi();
  if (f->ref < 1) panic("filedup");
  f->ref++;
  splx(e);
  return f;
}

int close(int fd)
{
  struct file *f;
  if (!(f = getf(fd))) return -1;
  current->ofile[fd] = 0;
  fileclose(f);
  return 0;
}

#endif
