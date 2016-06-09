#include <io.h>
#include <ulib.h>
#include <umain.h>

int
main(void) {
    cprintf("I read %8x from 0.\n", *(unsigned int *)0);
    panic("FAIL: T.T\n");
}

