#ifndef __USER_LIBS_SYSCALL_H__
#define __USER_LIBS_SYSCALL_H__

#include "u.h"
#include <defs.h>

#define MAX_ARGS            5

static int
trap(uint code, uint* args) {
  asm (LL, 8);
  asm (LBL, 16);
  asm (LCL, 24);
  asm (TRAP);
}

static int
syscall(int num, ...) {
  va_list ap;
  uint32_t a[MAX_ARGS];
  uint32_t argtmp[MAX_ARGS];
  int i, ret;
  va_start(ap, num);
  for (i = 0; i < MAX_ARGS; i++) {
    a[i] = va_arg(ap, uint32_t);
  }
  if (num == SYS_read) {
    argtmp[0] = a[1];
    argtmp[1] = a[2];
    argtmp[2] = a[3];
    argtmp[3] = a[4];
    ret = trap(num, a[0], argtmp);
  } else {
    ret = trap(num, a[0], a[1]);
  }
  return ret;
}

int
sys_exit(int error_code) {
  return syscall(SYS_exit, error_code);
}

int
sys_fork(void) {
  return syscall(SYS_fork);
}

int
sys_wait(int pid, int *store) {
  return syscall(SYS_wait, pid, store);
}

int
sys_yield(void) {
  return syscall(SYS_yield);
}

int
sys_kill(int pid) {
  return syscall(SYS_kill, pid);
}

int
sys_getpid(void) {
  return syscall(SYS_getpid);
}

int
sys_putc(int c) {
  return syscall(SYS_putc, c);
}

int
sys_pgdir(void) {
  return syscall(SYS_pgdir);
}

int
sys_gettime(void) {
  return syscall(SYS_gettime);
}

int
sys_read(int fd, void *base, size_t len) {
  return syscall(SYS_read, fd, base, len);
}

int
sys_open(char *path, uint32_t open_flags) {
  return syscall(SYS_open, path, open_flags);
}

int
sys_close(int fd) {
  return syscall(SYS_close, fd);
}

int sys_exec(char *name) {
  return syscall(SYS_exec, name);
}

void
sys_lab6_set_priority(uint32_t priority)
{
  syscall(SYS_lab6_set_priority, priority);
}

#endif /* !__USER_LIBS_SYSCALL_H__ */
