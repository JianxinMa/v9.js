#ifndef __KERN_FS_FSS_H__
#define __KERN_FS_FSS_H__

#define SECTSIZE            512
#define PAGE_NSECT          (PGSIZE / SECTSIZE)

#define SWAP_DEV_NO         1

enum {
  ROOTINO = 16,
  NBUF    = 10,         // size of disk block cache
  
  BUFSZ   = 16*4096,     // bitmap size
  DIRSIZ  = 252,
  NDIR    = 480,         // 1.9 MB
  NIDIR   = 512,         //   2 GB
  NIIDIR  = 8,           //  32 GB
  NIIIDIR = 4,           //  16 TB
  NINODE  = 50,         // maximum number of active i-nodes  XXX make this more dynamic ... 
};

enum { I_BUSY = 1, I_VALID = 2 };
enum { B_BUSY  = 1,      // buffer is locked by some process
       B_VALID = 2,      // buffer has been read from disk
       B_DIRTY = 4};     // buffer needs to be written to disk
enum { S_IFIFO = 0x1000, // fifo
      S_IFCHR = 0x2000, // character
      S_IFBLK = 0x3000, // block
      S_IFDIR = 0x4000, // directory
      S_IFREG = 0x8000, // regular
      S_IFMT  = 0xF000 }; // file type mask


struct inode { // in-memory copy of an inode
  uint inum;             // inode number
  int ref;               // reference count
  int flags;             // I_BUSY, I_VALID
  ushort mode;           // copy of disk inode
  uint nlink;
  uint size;
  uint dir[NDIR];
  uint idir[NIDIR];
};

struct dinode { // on-disk inode structure
  ushort mode;           // file mode
  uint nlink;            // number of links to inode in file system
  uint size;             // size of file
  uint pad[17];
  uint dir[NDIR];        // data block addresses
  uint idir[NIDIR];
  uint iidir[NIIDIR];    // XXX not implemented
  uint iiidir[NIIIDIR];  // XXX not implemented
};

struct direct { // directory is a file containing a sequence of direct structures.
  uint d_ino;
  char d_name[DIRSIZ];
};

struct buf {
  int flags;
  uint sector;
  struct buf *prev;      // LRU cache list
  struct buf *next;
  uchar *data;
};

struct inode inode[NINODE]; // inode cache XXX make dynamic and eventually power of 2, look into iget()
struct buf bfreelist;    // linked list of all buffers, through prev/next.   bfreelist.next is most recently used
struct buf bcache[NBUF];

struct inode *namei(char *path);
int readi(struct inode *ip, char *dst, uint off, uint n);
ilock(struct inode *ip);

#endif
