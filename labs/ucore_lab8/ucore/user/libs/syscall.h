#ifndef __USER_LIBS_SYSCALL_H__
#define __USER_LIBS_SYSCALL_H__

#include "u.h"
#include <defs.h>

#define MAX_ARGS            5

static int
trap(uint code, uint* args) {
    asm(LL, 8);
    asm(LBL, 16);
    asm(LCL, 24);
    asm(TRAP);
}

static int
syscall(int num, ...) {
    va_list ap;
    uint32_t a[MAX_ARGS];
    int i, ret;
    va_start(ap, num);
    for (i = 0; i < MAX_ARGS; i ++) {
        a[i] = va_arg(ap, uint32_t);
    }
    // va_end(ap);
    ret = trap(num, a[0], a[1], a[2], a[3], a[4]);
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

void
sys_lab6_set_priority(uint32_t priority)
{
    syscall(SYS_lab6_set_priority, priority);
}

#endif /* !__USER_LIBS_SYSCALL_H__ */
