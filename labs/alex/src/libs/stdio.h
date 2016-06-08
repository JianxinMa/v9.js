#include "defs.h"
#include "stdarg.h"

int cprintf(const char *fmt, ...);
int vsnprintf(char *str, size_t size, const char *fmt, va_list ap);
int snprintf(char *str, size_t size, const char *fmt, ...);
int vsnprintf(char *str, size_t size, const char *fmt, va_list ap);
void vprintfmt(void (*putch)(int, void*, int), int fd, void *putdat, const char *fmt, va_list ap);
void alex_putc(char c);
