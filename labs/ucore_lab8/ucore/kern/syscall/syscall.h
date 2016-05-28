#ifndef __KERN_SYSCALL_SYSCALL_H__
#define __KERN_SYSCALL_SYSCALL_H__

#include <tfstruct.h>

#include <u.h>
#include <proc.h>
#include <io.h>
#include <pmm.h>

static int
sys_exit(uint32_t arg[]) {
    int error_code = (int)arg[0];
    return do_exit(error_code);
}

static int
sys_fork(uint32_t arg[]) {
    struct trapframe *tf = current->tf;
    uintptr_t stack = tf->tf_regs.sp;
    return do_fork(0, stack, tf);
}

static int
sys_wait(uint32_t arg[]) {
    int pid = (int)arg[0];
    int *store = (int *)arg[1];
    return do_wait(pid, store);
}

// dirty hack, only 3 registers. NOTE
static int
sys_exec(uint32_t arg[]) {
    char *name = (char *)arg[0];
    uint32_t *args = arg[1];
    size_t len = (size_t)args[0];
    unsigned char *binary = (unsigned char *)args[1];
    size_t size = (size_t)args[2];
    return do_execve(name, len, binary, size);
}

static int
sys_yield(uint32_t arg[]) {
    return do_yield();
}

static int
sys_kill(uint32_t arg[]) {
    int pid = (int)arg[0];
    return do_kill(pid);
}

static int
sys_getpid(uint32_t arg[]) {
    return current->pid;
}

static int
sys_putc(uint32_t arg[]) {
    int c = (int)arg[0];
    cputchar(c);
    return 0;
}

static int
sys_pgdir(uint32_t arg[]) {
    print_pgdir();
    return 0;
}

static int
sys_gettime(uint32_t arg[]) {
    return (int)ticks;
}

static int
sys_lab6_set_priority(uint32_t arg[])
{
    uint32_t priority = (uint32_t)arg[0];
    lab6_set_priority(priority);
    return 0;
}


int
syscall() {
    struct trapframe *tf = current->tf;
    uint32_t arg[2];
    int num = tf->tf_regs.a;
    arg[0] = tf->tf_regs.b;
    arg[1] = tf->tf_regs.c;
    switch (num) {
        case SYS_exit:
            return sys_exit(arg);
        case SYS_fork:
            return sys_fork(arg);
        case SYS_wait:
            return sys_wait(arg);
        case SYS_exec:
            return sys_exec(arg);
        case SYS_yield:
            return sys_yield(arg);
        case SYS_kill:
            return sys_kill(arg);
        case SYS_getpid:
            return sys_getpid(arg);
        case SYS_putc:
            return sys_putc(arg);
        case SYS_pgdir:
            return sys_pgdir(arg);
        case SYS_gettime:
            return sys_gettime(arg);
        case SYS_lab6_set_priority:
            return sys_lab6_set_priority(arg);
    }

    print_trapframe(tf);
    panic("undefined syscall %d, pid = %d, name = %s.\n",
            num, current->pid, current->name);
}

#endif /* !__KERN_SYSCALL_SYSCALL_H__ */
