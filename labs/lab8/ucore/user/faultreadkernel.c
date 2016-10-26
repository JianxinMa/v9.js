#include <io.h>
#include <ulib.h>
#include <umain.h>

int
main(void) {
  cprintf("I read %08x from 0xfac00000!\n", *(unsigned *)0xfac00000);
  panic("FAIL: T.T\n");
}
