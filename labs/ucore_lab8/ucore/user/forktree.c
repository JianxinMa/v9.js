#include <ulib.h>
#include <io.h>
#include <string.h>
#include <umain.h>

#define DEPTH 4

void forktree(char *cur);

void
forkchild(char *cur, char branch) {
    char nxt[DEPTH + 1];

    if (strlen(cur) >= DEPTH)
        return;

    snprintf(nxt, DEPTH + 1, "%s%c", cur, branch);
    if (fork() == 0) {
        forktree(nxt);
        yield();
        exit(0);
    }
}

void
forktree(char *cur) {
    cprintf("%04x: I am '%s'\n", getpid(), cur);

    forkchild(cur, '0');
    forkchild(cur, '1');
}

int
main(void) {
    forktree("");
    return 0;
}

