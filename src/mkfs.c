#include <dirent.h>
#include <memory.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

typedef unsigned char uchar;
typedef unsigned short ushort;
typedef unsigned int uint;

enum {
    BUFSZ = 16 * 4096, // bitmap size
    DIRSIZ = 252,
    NDIR = 480,  // 1.9 MB
    NIDIR = 512, //   2 GB
    NIIDIR = 8,  //  32 GB
    NIIIDIR = 4, //  16 TB
};

struct dinode {  // 4K disk inode structure
    ushort mode; // file mode
    uint nlink;  // number of links to inode in file system
    uint size;   // size of file
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
FILE* disk;

void write_disk(void* b, uint n)
{
    int i;
    while (n) {
        if ((i = fwrite(b, 1, n, disk)) <= 0) {
            fprintf(stderr, "write(%d) failed\n", n);
            exit(-1);
        }
        b += i;
        n -= i;
    }
}

void write_meta(uint size, uint mode, uint nlink)
{
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

void add_dir(uint parent, struct direct* sp)
{
    uint size, dsize, dseek, nlink = 2;
    int n, i;
    FILE* f;
    struct direct *de, *p;
    DIR* d;
    struct dirent* dp;
    struct stat st;
    static uchar zeros[4096];

    // build directory
    de = sp;
    d = opendir(".");
    sp->d_ino = bn;
    strncpy(sp->d_name, ".", DIRSIZ);
    sp++;
    sp->d_ino = parent;
    strncpy(sp->d_name, "..", DIRSIZ);
    sp++;
    while ((dp = readdir(d))) {
        if (!strcmp(dp->d_name, ".") || !strcmp(dp->d_name, "..")
            || strlen(dp->d_name) > DIRSIZ) {
            continue;
        }
        if (stat(dp->d_name, &st)) {
            fprintf(stderr, "stat(%s) failed\n", dp->d_name);
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
        strncpy(sp->d_name, dp->d_name, DIRSIZ);
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
                if ((f = fopen(p->d_name, "rb")) < 0) {
                    fprintf(stderr, "open(%s) failed\n", p->d_name);
                    exit(-1);
                }
                for (n = size; n; n -= i) {
                    if ((i = fread(buf, 1, (n > BUFSZ) ? BUFSZ : n, f))
                        <= 0) {
                        fprintf(stderr, "read(%s) failed\n", p->d_name);
                        exit(-1);
                    }
                    write_disk(buf, i);
                }
                fclose(f);
                if (size & 4095) {
                    write_disk(zeros, 4096 - (size & 4095));
                }
            }
        }
    }

    // update directory
    fseek(disk, dseek, SEEK_SET);
    write_disk(de, dsize);
    fseek(disk, 0, SEEK_END);
}

int main(int argc, char* argv[])
{
    struct direct* sp;
    static char cwd[256];
    if (sizeof(struct dinode) != 4096) {
        fprintf(stderr, "sizeof(struct dinode) %d != 4096\n",
            sizeof(struct dinode));
        return -1;
    }

    if (argc != 3) {
        fprintf(stderr, "Usage: mkfs fs rootdir\n");
        return -1;
    }
    if ((disk = fopen(argv[1], "wb")) < 0) {
        fprintf(stderr, "open(%s) failed\n", argv[1]);
        return -1;
    }
    if ((int)(sp = (struct direct*)malloc(16 * 1024 * 1024)) == 0) {
        fprintf(stderr, "sbrk() failed\n");
        return -1;
    }
    memset(sp, 0, 16 * 1024 * 1024);

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
    fseek(disk, 0, SEEK_SET);
    write_disk(buf, (bn + 7) / 8);
    fclose(disk);
    return 0;
}
