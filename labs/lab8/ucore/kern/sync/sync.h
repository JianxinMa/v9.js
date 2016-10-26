#ifndef __KERN_SYNC_SYNC_H__
#define __KERN_SYNC_SYNC_H__
#include "u.h"
#include <defs.h>
#include <io.h>

bool
__intr_save(void) {
  return splhi();
}

void
__intr_restore(bool flag) {
  splx(flag);
}

#define local_intr_save(x)      do { x = __intr_save(); } while (0)
#define local_intr_restore(x)   __intr_restore(x);

typedef  bool lock_t;

void
lock_init(lock_t *lock) {
  *lock = 0;
}

bool
try_lock(lock_t *lock) {
  return !test_and_set_bit(0, lock);
}

void schedule(void);

void
lock(lock_t *lock) {
  while (!try_lock(lock)) {
    schedule();
  }
}

void
unlock(lock_t *lock) {
  if (!test_and_clear_bit(0, lock)) {
    panic("Unlock failed.\n");
  }
}


#endif /* !__KERN_SYNC_SYNC_H__ */
