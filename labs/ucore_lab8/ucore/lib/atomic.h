#ifndef __LIBS_ATOMIC_H__
#define __LIBS_ATOMIC_H__
#include <v9.h>

set_bit(int nr, uint* addr) {
    int e = splhi();
    *addr = (*addr) | (1 << nr);
    splx(e);
}

clear_bit(int nr, uint* addr) {
    int e = splhi();
    *addr = ((*addr) | (1 << nr)) ^ (1 << nr);
    splx(e);
}

change_bit(int nr, uint* addr) {
    int e = splhi();
    *addr = (*addr) ^ (1 << nr);
    splx(e);
}

int test_bit(int nr, uint* addr) {
    int e = splhi();
    if (((*addr) & (1 << nr)) == 0) {
        splx(e);
        return 0;
    }
    splx(e);
    return 1;
}

/* *
 * test_and_set_bit - Atomically set a bit and return its old value
 * @nr:     the bit to set
 * @addr:   the address to count from
 * */
bool
test_and_set_bit(int nr, uint* addr) {
    int e = splhi();
    int oldbit = ((*addr) & (1 << nr));
    *addr = (*addr) | (1 << nr);
    splx(e);
    return oldbit != 0;
}

/* *
 * test_and_clear_bit - Atomically clear a bit and return its old value
 * @nr:     the bit to clear
 * @addr:   the address to count from
 * */
bool
test_and_clear_bit(int nr, uint* addr) {
    int e = splhi();
    int oldbit = ((*addr) & (1 << nr));
    *addr = ((*addr) | (1 << nr)) ^ (1 << nr);
    splx(e);
    return oldbit != 0;
}


#endif /* !__LIBS_ATOMIC_H__ */