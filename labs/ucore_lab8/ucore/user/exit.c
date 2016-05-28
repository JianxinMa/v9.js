#include <io.h>
#include <ulib.h>
#include <umain.h>


int magic = -0x10384;

int
main(void) {
    int pid, code, ret;

    cprintf("I am the parent. Forking the child...\n");
    pid = fork();

    if (pid == 0) {
        cprintf("I am the child.\n");
        yield();
        yield();
        yield();
        yield();
        yield();
        yield();
        yield();
        exit(magic);
    }
    else {
        cprintf("I am parent, fork a child pid %d\n",pid);
    }

    assert(pid > 0);
    ret = waitpid(pid, &code);
    assert( ret== 0 && code == magic);
    assert(waitpid(pid, &code) != 0 && wait() != 0);

    cprintf("waitpid %d ok.\n", pid);

    cprintf("exit pass.\n");
    return 0;
}

