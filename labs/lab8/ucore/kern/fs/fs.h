#ifndef __KERN_FS_FS_H__
#define __KERN_FS_FS_H__

#include <mmu.h>
#include <console.h>

// buffer cache:
// The buffer cache is a linked list of buf structures holding cached copies of disk block contents.  Caching disk blocks.
// in memory reduces the number of disk reads and also provides a synchronization point for disk blocks used by multiple processes.
//
// Interface:
// * To get a buffer for a particular disk block, call bread.
// * After changing buffer data, call bwrite to write it to disk.
// * When done with the buffer, call brelse.
// * Do not use the buffer after calling brelse.
// * Only one process at a time can use a buffer, so do not keep them longer than necessary.
//
// The implementation uses three state flags internally:
// * B_BUSY: the block has been returned from bread and has not been passed back to brelse.
// * B_VALID: the buffer data has been read from the disk.
// * B_DIRTY: the buffer data has been modified and needs to be written to disk.
binit()
{
  struct buf *b;

  // create linked list of buffers
  bfreelist.prev = bfreelist.next = &bfreelist;
  for (b = bcache; b < bcache+NBUF; b++) {
    b->next = bfreelist.next;
    b->prev = &bfreelist;
    b->data = page2kva(alloc_page());
    // printf("%x\n",b->data );
    bfreelist.next->prev = b;
    bfreelist.next = b;
  }
}

static int fs_init() {
  binit();                 // buffer cache
}
// look through buffer cache for sector.
// if not found, allocate fresh block.  in either case, return B_BUSY buffer
struct buf *bget(uint sector)
{
  struct buf *b; int e = splhi();

loop:  // try for cached block
  for (b = bfreelist.next; b != &bfreelist; b = b->next) {
    if (b->sector == sector) {
      if (!(b->flags & B_BUSY)) {
	b->flags |= B_BUSY;
	splx(e);
	return b;
      }
      //   sleep(b)
      panic("bget sleep");
      goto loop;
    }
  }

  // allocate fresh block
  for (b = bfreelist.prev; b != &bfreelist; b = b->prev) {
    if (!(b->flags & (B_BUSY | B_DIRTY))) {
      b->sector = sector;
      b->flags = B_BUSY;
      splx(e);
      return b;
    }
  }
  panic("bget: no buffers");
}

// sync buf with disk.  if B_DIRTY is set, write buf to disk, clear B_DIRTY, set B_VALID.
// else if B_VALID is not set, read buf from disk, set B_VALID.
iderw(struct buf *b) // XXX rename?!
{
  if (!(b->flags & B_BUSY)) panic("iderw: buf not busy");
  if ((b->flags & (B_VALID|B_DIRTY)) == B_VALID) panic("iderw: nothing to do");
  if (b->sector >= (FSSIZE / PGSIZE)) panic("iderw: sector out of range");

  if (b->flags & B_DIRTY) {
    b->flags &= ~B_DIRTY;
    memcpy(memdisk + b->sector*PGSIZE, b->data, PGSIZE);
  } else
    memcpy(b->data, memdisk + b->sector*PGSIZE, PGSIZE);
  b->flags |= B_VALID;
}

// return a B_BUSY buf with the contents of the indicated disk sector
struct buf *bread(uint sector)
{
  struct buf *b;

  b = bget(sector);
  if (!(b->flags & B_VALID)) iderw(b);
  return b;
}

// release a B_BUSY buffer.  move to the head of the MRU list
brelse(struct buf *b)
{
  int e = splhi();
  if (!(b->flags & B_BUSY)) panic("brelse");

  b->next->prev = b->prev;
  b->prev->next = b->next;
  b->next = bfreelist.next;
  b->prev = &bfreelist;
  bfreelist.next->prev = b;
  bfreelist.next = b;
  b->flags &= ~B_BUSY;
  // wakeup(b);
  splx(e);
}

// lock the given inode.  read the inode from disk if necessary
ilock(struct inode *ip)
{
  struct buf *bp;
  struct dinode *dip;
  int e = splhi();

  if (!ip || ip->ref < 1) panic("ilock");

  while (ip->flags & I_BUSY) panic("ilock sleep");
  ip->flags |= I_BUSY;
  splx(e);

  if (!(ip->flags & I_VALID)) {
    bp = bread(ip->inum);
    dip = (struct dinode *)bp->data;
    ip->mode  = dip->mode;
    ip->nlink = dip->nlink;
    ip->size = dip->size;
    memcpy(ip->dir,  dip->dir,  sizeof(ip->dir));
    memcpy(ip->idir, dip->idir, sizeof(ip->idir));
    brelse(bp);
    ip->flags |= I_VALID;
    if (!ip->mode) panic("ilock: no mode");
  }
}


// find the inode with number inum and return the in-memory copy.  does not lock the inode and does not read it from disk
struct inode *iget(uint inum)
{
  struct inode *ip, *empty; int e = splhi();

  // is the inode already cached
  empty = 0;
  for (ip = &inode[0]; ip < &inode[NINODE]; ip++) {
    if (ip->ref > 0 && ip->inum == inum) {
      ip->ref++;
      splx(e);
      return ip;
    }
    if (!empty && !ip->ref) empty = ip; // remember empty slot
  }

  // recycle an inode cache entry
  if (!empty) panic("iget: no inodes");

  ip = empty;
  ip->inum = inum;
  ip->ref = 1;
  ip->flags = 0;
  splx(e);

  return ip;
}

// increment reference count for ip
idup(struct inode *ip)
{
  int e = splhi();
  ip->ref++;
  splx(e);
}

// paths:
// Copy the next path element from path into name.
// Return a pointer to the element following the copied one.
// The returned path has no leading slashes, so the caller can check *path=='\0' to see if the name is the last one.
// If no name to remove, return 0.
//
// Examples:
//   skipelem("a/bb/c", name) = "bb/c", setting name = "a"
//   skipelem("///a//bb", name) = "bb", setting name = "a"
//   skipelem("a", name) = "", setting name = "a"
//   skipelem("", name) = skipelem("////", name) = 0
//
char *skipelem(char *path, char *name)
{
  char *s;
  int len;

  while (*path == '/') path++;
  if (!*path) return 0;
  s = path;
  while (*path != '/' && *path) path++;
  len = path - s;
  if (len >= DIRSIZ) memcpy(name, s, DIRSIZ);
  else {
    memcpy(name, s, len);
    name[len] = 0;
  }
  while (*path == '/') path++;
  return path;
}



// write b's contents to disk.  must be B_BUSY
bwrite(struct buf *b)
{
  if (!(b->flags & B_BUSY)) panic("bwrite");
  b->flags |= B_DIRTY;
  iderw(b);
}

// allocate a disk block
uint balloc()
{
  int b, bi, bb;
  struct buf *bp;

  for (b = 0; b < 16; b++) {
    bp = bread(b);
    for (bi = 0; bi < 4096; bi++) {
      if (bp->data[bi] == 0xff) continue;
      for (bb = 0; bb < 8; bb++) {
	if (bp->data[bi] & (1 << bb)) continue; // is block free?
	bp->data[bi] |= (1 << bb);  // mark block in use???
	bwrite(bp);
	brelse(bp);
	return b*(4096*8) + bi*8 + bb;
      }
    }
    brelse(bp);
  }
  panic("balloc: out of blocks");
}


// Inode contents:
// The contents (data) associated with each inode is stored in a sequence of blocks on the disk.
// The first NDIR blocks are listed in ip->dir[].  The next NIDIR blocks are listed in the block ip->idir[].
// Return the disk block address of the nth block in inode ip. If there is no such block, bmap allocates one.
uint bmap(struct inode *ip, uint bn)
{
  uint addr, *a;
  struct buf *bp;

  if (bn < NDIR) {
    if (!(addr = ip->dir[bn])) ip->dir[bn] = addr = balloc();
    return addr;
  }
  bn -= NDIR;
  if (bn >= NIDIR * 1024) panic("bmap: out of range");

  // load indirect block, allocating if necessary
  if (!(addr = ip->idir[bn / 1024])) ip->idir[bn / 1024] = addr = balloc();
  bp = bread(addr);
  a = (uint *)bp->data;
  if (!(addr = a[bn & 1023])) {
    a[bn & 1023] = addr = balloc();
    bwrite(bp);
  }
  brelse(bp);
  return addr;
}

// read data from inode
int readi(struct inode *ip, char *dst, uint off, uint n)
{
  uint tot, m;
  struct buf *bp;

  if ((ip->mode & S_IFMT) == S_IFCHR) { // S_IFBLK ??
    return consoleread(ip, dst, n);
  }

  if (off > ip->size || off + n < off) return -1;
  if (off + n > ip->size) n = ip->size - off;

  for (tot = n; tot; tot -= m, off += m, dst += m) {
    bp = bread(bmap(ip, off/PGSIZE));
    if ((m = PGSIZE - off%PGSIZE) > tot) m = tot;
    memcpy(dst, bp->data + off%PGSIZE, m);
    brelse(bp);
  }
  return n;
}


// directories:
int namecmp(char *p, char *q)
{
  uint n = DIRSIZ;
  while (n) { if (!*p || *p != *q) return *p - *q; n--; p++; q++; } // XXX
  return 0;
}

// look for a directory entry in a directory. If found, set *poff to byte offset of entry.
struct inode *dirlookup(struct inode *dp, char *name, uint *poff)
{
  uint off; struct direct de;

  if ((dp->mode & S_IFMT) != S_IFDIR) panic("dirlookup not DIR");
  for (off = 0; off < dp->size; off += sizeof(de)) {
    if (readi(dp, (char *)&de, off, sizeof(de)) != sizeof(de)) panic("dirlink read");
    if (de.d_ino && !namecmp(name, de.d_name)) { // entry matches path element
      if (poff) *poff = off;
      return iget(de.d_ino);
    }
  }
  return 0;
}

// zero a block
bzero(uint b)  // XXX only called in bfree
{
  struct buf *bp;
  bp = bread(b);
  memset(bp->data, 0, PGSIZE);
  bwrite(bp);
  brelse(bp);
}

// free a disk block
bfree(uint b)
{
  int bi, m;
  struct buf *bp;

  bzero(b);

  bp = bread(b / (4096*8));
  m = 1 << (b & 7);
  b = (b / 8) & 4095;
  if (!(bp->data[b] & m)) panic("freeing free block");
  bp->data[b] &= ~m;  // mark block free on disk???
  bwrite(bp);
  brelse(bp);
}

// copy modified memory inode to disk
iupdate(struct inode *ip)
{
  struct buf *bp;
  struct dinode *dip;

  bp = bread(ip->inum);
  dip = (struct dinode *)bp->data;
  dip->mode  = ip->mode;
  dip->nlink = ip->nlink;
  dip->size = ip->size;
//  printf("iupdate() memcpy(dip->dir, ip->dir, %d)\n",sizeof(ip->dir));
  memcpy(dip->dir, ip->dir, sizeof(ip->dir));
  memcpy(dip->idir, ip->idir, sizeof(ip->idir));
  bwrite(bp);
  brelse(bp);
}

// truncate inode (discard contents)
// only called when the inode has no links to it (no directory entries referring to it)
// and has no in-memory reference to it (is not an open file or current directory)
itrunc(struct inode *ip)
{
  int i, j;
  struct buf *bp;
  uint *a;

  for (i = 0; i < NDIR; i++) {
    if (!ip->dir[i]) goto done;  // XXX done by ip->size?
    bfree(ip->dir[i]);
    ip->dir[i] = 0;
  }

  for (i = 0; i < NIDIR; i++) {
    if (!ip->idir[i]) break;
    bp = bread(ip->idir[i]);
    a = (uint *)bp->data;
    for (j = 0; j < 1024; j++) {
      if (!a[j]) break;
      bfree(a[j]);
    }
    brelse(bp);
    bfree(ip->idir[i]);
    ip->idir[i] = 0;
  }

done:
  ip->size = 0;
  iupdate(ip);
}

// drop a reference to an in-memory inode
// if that was the last reference, the inode cache entry can be recycled
// if that was the last reference and the inode has no links
// to it, free the inode (and its content) on disk
iput(struct inode *ip)
{
  int e = splhi();
  if (ip->ref == 1 && (ip->flags & I_VALID) && !ip->nlink) {
    // inode has no links: truncate and free inode
    if (ip->flags & I_BUSY) panic("iput busy");
    ip->flags |= I_BUSY;
    splx(e);
    itrunc(ip);
    ip->mode = 0;
    bfree(ip->inum);
    e = splhi();
    ip->flags = 0;
    // wakeup(ip);
  }
  ip->ref--;
  splx(e);
}

// unlock the given inode
iunlock(struct inode *ip)
{
  int e = splhi();
  if (!ip || !(ip->flags & I_BUSY) || ip->ref < 1) panic("iunlock");

  ip->flags &= ~I_BUSY;
  // wakeup(ip);
  splx(e);
}

// common idiom: unlock, then put
iunlockput(struct inode *ip)
{
  iunlock(ip);
  iput(ip);
}

// write data to inode
int writei(struct inode *ip, char *src, uint off, uint n)
{
  uint tot, m;
  struct buf *bp;

  if ((ip->mode & S_IFMT) == S_IFCHR) { // XXX S_IFBLK ??
//    if (ip->major < 0 || ip->major >= NDEV || !devsw[ip->major].write) return -1;
//    return devsw[ip->major].write(ip, src, n);
    panic("writei");
    // if (ip->dir[0] >= NDEV || !devsw[ip->dir[0]].write) return -1; // XXX refactor
    // return devsw[ip->dir[0]].write(ip, src, n);
  }
  if (off > ip->size || off + n < off) return -1;
  if (off + n > (NDIR + NIDIR*1024)*PGSIZE) return -1;

  for (tot = n; tot; tot -= m, off += m, src += m) {
    bp = bread(bmap(ip, off/PGSIZE));
    if ((m = PGSIZE - off%PGSIZE) > tot) m = tot;
    memcpy(bp->data + off%PGSIZE, src, m);
    bwrite(bp);
    brelse(bp);
  }
  if (n > 0 && off > ip->size) {
    ip->size = off;
    iupdate(ip);
  }
  return n;
}

// Look up and return the inode for a path name
struct inode *namei(char *path)
{
  char name[DIRSIZ];
  struct inode *ip, *next;

  // if (*path == '/') ip = iget(ROOTINO); else idup(ip = current->cwd);
  ip = iget(ROOTINO);
  while (path = skipelem(path, name)) {
    ilock(ip);
    if ((ip->mode & S_IFMT) != S_IFDIR || !(next = dirlookup(ip, name, 0))) {
      iunlockput(ip);
      return 0;
    }
    iunlockput(ip);
    ip = next;
  }
  return ip;
}

// return the inode for the parent and copy the final path element into name, which must have room for DIRSIZ bytes.
struct inode *nameiparent(char *path, char *name)
{
  struct inode *ip, *next;

  if (*path == '/') ip = iget(ROOTINO); else idup(ip = current->cwd);

  while (path = skipelem(path, name)) {
    ilock(ip);
    if ((ip->mode & S_IFMT) != S_IFDIR) {
      iunlockput(ip);
      return 0;
    }
    if (!*path) { // stop one level early
      iunlock(ip);
      return ip;
    }
    if (!(next = dirlookup(ip, name, 0))) {
      iunlockput(ip);
      return 0;
    }
    iunlockput(ip);
    ip = next;
  }
  iput(ip);
  return 0;
}

// write a new directory entry (name, inum) into the directory dp
int dirlink(struct inode *dp, char *name, uint inum)
{
  int off;
  struct direct de;
  struct inode *ip;

  // check that name is not present
  if (ip = dirlookup(dp, name, 0)) {
    iput(ip);
    return -1;
  }
  // look for an empty direct
  for (off = 0; off < dp->size; off += sizeof(de)) {
    if (readi(dp, (char *)&de, off, sizeof(de)) != sizeof(de)) panic("dirlink read");
    if (!de.d_ino) break;
  }
  xstrncpy(de.d_name, name, DIRSIZ);
  de.d_ino = inum;
  if (writei(dp, (char *)&de, off, sizeof(de)) != sizeof(de)) panic("dirlink");

  return 0;
}

// allocate a new inode with the given mode
struct inode *ialloc(ushort mode)
{
  int inum;
  struct buf *bp;
  struct dinode *dip;

  inum = balloc();
  bp = bread(inum);
  dip = (struct dinode *)bp->data;
  memset(dip, 0, sizeof(*dip));
  dip->mode = mode;
  bwrite(bp);   // mark it allocated on the disk
  brelse(bp);
  return iget(inum);
}

struct inode *create(char *path, ushort mode, int dev)
{
  struct inode *ip, *dp;
  char name[DIRSIZ];
  if (!(dp = nameiparent(path, name))) return 0;
  ilock(dp);

  if (ip = dirlookup(dp, name, 0)) {
    iunlockput(dp);
    ilock(ip);
    if ((mode & S_IFMT) == S_IFREG && (ip->mode & S_IFMT) == S_IFREG) return ip;
    iunlockput(ip);
    return 0;
  }

  if (!(ip = ialloc(mode))) panic("create: ialloc");

  ilock(ip);
  if ((mode & S_IFMT) == S_IFCHR || (ip->mode & S_IFMT) == S_IFBLK) {
    ip->dir[0] = (dev >> 8) & 0xff;
    ip->dir[1] = dev & 0xff;
  }
  ip->nlink = 1;
  iupdate(ip);

  if ((mode & S_IFMT) == S_IFDIR) {  // create . and .. entries
    dp->nlink++;  // for ".."
    iupdate(dp);
    // no ip->nlink++ for ".": avoid cyclic ref count
    if (dirlink(ip, ".", ip->inum) || dirlink(ip, "..", dp->inum)) panic("create dots");
  }

  if (dirlink(dp, name, ip->inum)) panic("create: dirlink");

  iunlockput(dp);
  return ip;
}

int mknod(char *path, int mode, int dev) {
  struct inode *ip;
  if (!(ip = create(path, mode, dev))) return -1;
  iunlockput(ip);
  return 0;
}
#endif /* !__KERN_FS_FS_H__ */
