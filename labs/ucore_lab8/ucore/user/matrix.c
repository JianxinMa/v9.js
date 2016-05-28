#include <io.h>
#include <ulib.h>
#include <string.h>
#include <lib.h>
#include <umain.h>

#define MATSIZE     10
#define total 21

static int mata[MATSIZE][MATSIZE];
static int matb[MATSIZE][MATSIZE];
static int matc[MATSIZE][MATSIZE];

void
work(unsigned int times) {
    int i, j, k, size = MATSIZE;
    for (i = 0; i < size; i ++) {
        for (j = 0; j < size; j ++) {
            mata[i][j] = matb[i][j] = 1;
        }
    }

    yield();

    cprintf("pid %d is running (%d times)!.\n", getpid(), times);

    while (times -- > 0) {
        for (i = 0; i < size; i ++) {
            for (j = 0; j < size; j ++) {
                matc[i][j] = 0;
                for (k = 0; k < size; k ++) {
                    matc[i][j] += mata[i][k] * matb[k][j];
                }
            }
        }
        for (i = 0; i < size; i ++) {
            for (j = 0; j < size; j ++) {
                mata[i][j] = matb[i][j] = matc[i][j];
            }
        }
    }
    cprintf("pid %d done!.\n", getpid());
    exit(0);
}

int
main(void) {
    int pids[total];
    int times;
    int i;

    memset(pids, 0, sizeof(pids));

    for (i = 0; i < total; i ++) {
        if ((pids[i] = fork()) == 0) {
            srand(i * i);
            times = (((unsigned int)rand()) % total);
            cprintf("%d\n", times );
            times = (times * times + 10) * 100;
            work(times);
        }
        if (pids[i] < 0) {
            goto failed;
        }
    }

    cprintf("fork ok.\n");

    for (i = 0; i < total; i ++) {
        if (wait() != 0) {
            cprintf("wait failed.\n");
            goto failed;
        }
    }

    cprintf("matrix pass.\n");
    return 0;

failed:
    for (i = 0; i < total; i ++) {
        if (pids[i] > 0) {
            kill(pids[i]);
        }
    }
    panic("FAIL: T.T\n");
}

