#include <defs.h>
#include <io.h>
#include <ulib.h>
#include <error.h>

void
exit(int error_code);

void
__panic(char *file, int line, char *fmt, ...) {
    // print the 'message'
    va_list ap;
    va_start(ap, fmt);
    cprintf("user panic at %s:%d:\n    ", file, line);
    vcprintf(fmt, ap);
    cprintf("\n");
    // va_end(ap);
    exit(-E_PANIC);
}

void
__warn(char *file, int line, char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    cprintf("user warning at %s:%d:\n    ", file, line);
    vcprintf(fmt, ap);
    cprintf("\n");
    // va_end(ap);
}

