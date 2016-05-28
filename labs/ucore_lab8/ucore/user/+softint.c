#include <stdio.h>
#include <ulib.h>
#include <umain.h>

int
main(void) {
	asm(LI, 14);
	asm(TRAP);
    panic("FAIL: T.T\n");
}

