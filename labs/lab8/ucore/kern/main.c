#include <u.h>
#include <defs.h>
#include <list.h>
#include <atomic.h>
#include <string.h>
#include <io.h>
#include <sync.h>
#include <default_pmm.h>
#include <trap.h>
#include <swap.h>
#include <kmalloc.h>
#include <proc.h>

void kern_init() {

  // cons_init();                // init the console

  printf("(THU.CST) os is loading ...\n");

  pmm_init();                   // init physical memory management

  idt_init();                   // init interrupt descriptor table

  asm (STI);                    // enable irq interrupt

  spage(1);

  vmm_init();                   // init virtual memory management

  sched_init();                 // init scheduler

  swap_init();                  // init swap

  fs_init();

  proc_init();

  stmr(128*1024);          // init clock interrupt

  cpu_idle();

  // while (1) {
  //                             // do nothing
  // }
}

main() {
  int *ksp;                // temp kernel stack pointer

  static int bss;       // last variable in bss segment
  endbss = &bss;

  ksp = ((uint)kstack + sizeof(kstack) - 8) & -8;
  asm (LL, 4);
  asm (SSP);

  kern_init();

  asm (HALT);
}
