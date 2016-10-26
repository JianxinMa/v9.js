#ifndef __LIBS_IO_H__
#define __LIBS_IO_H__
#include <defs.h>
#include <printfmt.h>
#include <v9.h>

// console device
//输出 understand
static void cout(char c) {
  out(1, c);
}

static void cputch(int c, int *cnt, int unused) {
  cout(c);
  (*cnt)++;
}

/* cputchar - writes a single character to stdout */
void
cputchar(int c) {
  cout(c);
}

static int
vkprintf(char *fmt, va_list ap) {
  int cnt = 0;
  vprintfmt(cputch, NO_FD, &cnt, fmt, ap);
  return cnt;
}

//输出函数printf
int printf(char *fmt, ...) {
  va_list ap;
  int cnt;
  va_start(ap, fmt);
  cnt = vkprintf(fmt, ap);
  // va_end(ap);
  return cnt;
}

panic(char *s)  //异常输出panic
{
  asm (CLI);
  out(1,'p'); out(1,'a'); out(1,'n'); out(1,'i'); out(1,'c'); out(1,':'); out(1,' ');
  while (*s) out(1,*s++);
  out(1,'\n');
  asm (HALT);
}

assert(int x) {
  if (x == 0)
    panic("assertion failed: %s", x);
}

#endif /* !__LIBS_IO_H__ */
