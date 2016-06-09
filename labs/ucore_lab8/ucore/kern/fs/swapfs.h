#ifndef __KERN_FS_SWAPFS_H__
#define __KERN_FS_SWAPFS_H__

#include <memlayout.h>
#include <fs.h>
#include <ide.h>

size_t max_swap_offset;

uint swap_offset(uint entry) {
     size_t __offset = (entry >> 8);
     if (!(__offset > 0 && __offset < max_swap_offset)) {
          panic("invalid swap_entry_t = %x.\n", entry);
     }
     return __offset;
}

void
swapfs_init(void) {
    assert((PGSIZE % SECTSIZE) == 0);
    max_swap_offset = ide_device_size(SWAP_DEV_NO) / (PGSIZE / SECTSIZE);
}

int
swapfs_read(swap_entry_t entry, struct Page *page) {
    return ide_read_secs(SWAP_DEV_NO, swap_offset(entry) * PAGE_NSECT, page2kva(page), PAGE_NSECT);
}

int
swapfs_write(swap_entry_t entry, struct Page *page) {
    return ide_write_secs(SWAP_DEV_NO, swap_offset(entry) * PAGE_NSECT, page2kva(page), PAGE_NSECT);
}

#endif /* !__KERN_FS_SWAPFS_H__ */

