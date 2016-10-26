#include <io.h>
#include <ulib.h>
#include <umain.h>

int
main(void) {
  cprintf("Hello world!!.\n");
  cprintf("I am process %d.\n", getpid());
  cprintf("hello pass.\n");
  return 0;
}
