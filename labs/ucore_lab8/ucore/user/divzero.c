#include <io.h>
#include <ulib.h>
#include <umain.h>

int zero;

int
main(void) {
    zero = 0;
    cprintf("value is %d.\n", 1 / zero);
    panic("FAIL: T.T\n");
}

