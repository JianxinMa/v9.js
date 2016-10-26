#ifndef __USER_LIBS_ULIB_H__
#define __USER_LIBS_ULIB_H__

#include <defs.h>
#include <syscall.h>
#include <io.h>
#include <panic.h>

// void __warn( char *file, int line,  char *fmt, ...);
// void  __panic( char *file, int line,  char *fmt, ...);

#define warn(...)                                       \
  __warn(__FILE__, __LINE__, __VA_ARGS__)

#define panic(...)                                      \
  __panic(__FILE__, __LINE__, __VA_ARGS__)

#define assert(x)                                       \
  do {                                                \
    if (!(x)) {                                     \
      panic("assertion failed: %s", #x);          \
    }                                               \
  } while (0)

// static_assert(x) will generate a compile-time error if 'x' is false.
#define static_assert(x)                                \
  switch (x) { case 0: case (x):; }

void
exit(int error_code) {
  sys_exit(error_code);
  cprintf("BUG: exit failed.\n");
  while (1) ;
}

int
fork(void) {
  return sys_fork();
}

int
wait(void) {
  return sys_wait(0, NULL);
}

int
waitpid(int pid, int *store) {
  return sys_wait(pid, store);
}

void
yield(void) {
  sys_yield();
}

int
kill(int pid) {
  return sys_kill(pid);
}

int
getpid(void) {
  return sys_getpid();
}

int exec(char* name) {
  return sys_exec(name);
}

//print_pgdir - print the PDT&PT
void
print_pgdir(void) {
  sys_pgdir();
}

unsigned int
gettime_msec(void) {
  return (unsigned int)sys_gettime();
}

void
lab6_set_priority(uint32_t priority)
{
  sys_lab6_set_priority(priority);
}

#endif /* !__USER_LIBS_ULIB_H__ */
