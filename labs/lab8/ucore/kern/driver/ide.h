#ifndef __KERN_DRIVER_IDE_H__
#define __KERN_DRIVER_IDE_H__

#include <defs.h>
#include <io.h>
#include <string.h>

static char disk[1 * 1024 * 8 * 512];

void
ide_init(void) {
  memset(disk, sizeof(disk), 0);
}

size_t
ide_device_size(unsigned short ideno) {
  return 1 * 1024 * 8;
}

int
ide_read_secs(unsigned short ideno, uint32_t secno, void *dst, size_t nsecs) {

  int ret = 0;
  int i;

  secno = secno * SECTSIZE;

  for (; nsecs > 0; nsecs--, dst += SECTSIZE, secno += SECTSIZE) {
    for (i = 0; i < SECTSIZE; i++) {
      // *((char *)(dst) + i) = *((char *)(secno) + i);
      *((char *)(dst) + i) = disk[secno + i];
    }

  }

  return ret;
}

int
ide_write_secs(unsigned short ideno, uint32_t secno, uint32_t *src, size_t nsecs) {

  int ret = 0;
  int i;

  secno = secno * SECTSIZE;

  for (; nsecs > 0; nsecs--, src += SECTSIZE, secno += SECTSIZE) {
    for (i = 0; i < SECTSIZE; i++) {
      // *((char *)(secno) + i) = *((char *)(src) + i);
      disk[secno + i] = *((char *)(src) + i);
    }

  }

  return ret;

}


#endif /* !__KERN_DRIVER_IDE_H__ */
