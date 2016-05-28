#ifndef __KERN_TRAP_TRAP_H__
#define __KERN_TRAP_TRAP_H__
#include <defs.h>
#include <syscall.h>
#include <tfstruct.h>

#define TICK_NUM 100

void trapname(int fc) {
  switch (fc) {
    case FMEM:
    case FMEM + USER:
      printf("bad physical address\n");
      return;
    case FTIMER:
    case FTIMER + USER:
      printf("timer interrupt\n");
      return;
    case FKEYBD:
    case FKEYBD + USER:
      printf("keyboard interrupt");
      return;
    case FPRIV:
    case FPRIV + USER:
      printf("privileged instruction");
      return;
    case FINST:
    case FINST + USER:
      printf("illegal instruction");
      return;
    case FSYS:
    case FSYS + USER:
      printf("software trap");
      return;
    case FARITH:
    case FARITH + USER:
      printf("arithmetic trap");
      return;
    case FIPAGE:
    case FIPAGE + USER:
      printf("page fault on opcode fetch");
      return;
    case FWPAGE:
    case FWPAGE + USER:
      printf("page fault on write");
      return;
    case FRPAGE:
    case FRPAGE + USER:
      printf("page fault on read");
      return;
    default:
      printf("Unkonw!\n");
  }
}

void print_pgfault(struct trapframe *tf) {
    /* error_code:
     * bit 0 == 0 means no page found, 1 means protection fault
     * bit 1 == 0 means read, 1 means write
     * bit 2 == 0 means kernel, 1 means user
     * */
    printf("page fault at 0x%x: %c/%c [%s].\n", lvadr(),
            (tf->fc >= USER) ? 'U' : 'K',
            (tf->fc == FWPAGE || tf->fc == USER + FWPAGE) ? 'W' : 'R',
            (tf->tf_regs.b & 1) ? "protection fault" : "no page found");
}

// int pgfault_handler(struct trapframe *tf) {
//     print_pgfault(tf);
//     if (check_mm_struct != NULL) {
//         return do_pgfault(check_mm_struct, tf->fc, lvadr());
//     }
//     panic("unhandled page fault.\n");
// }
int pgfault_handler(struct  trapframe *tf) {
    struct mm_struct *mm;
    if(check_mm_struct != NULL) {
        print_pgfault(tf);
    }
    if (check_mm_struct != NULL) {
        assert(current == idleproc);
        mm = check_mm_struct;
    }
    else {
        if (current == NULL) {
            print_trapframe(tf);
            print_pgfault(tf);
            panic("unhandled page fault.\n");
        }
        mm = current->mm;
    }
    return do_pgfault(check_mm_struct, tf->fc, lvadr());
}

void trap_dispatch(struct trapframe *tf)
{
  uint va;
  uint ret;
  //print_trapframe(tf);
  switch (tf -> fc) {
    case FSYS: 
      //panic("FSYS from kernel");
    case FSYS + USER:
      tf->tf_regs.a = syscall();
      return;
    case FMEM:
      panic("FMEM from kernel");
    case FMEM   + USER:
      printf("FMEM + USER\n");
      return;
      // exit(-1);
    case FPRIV:
      panic("FPRIV from kernel");
    case FPRIV  + USER:
      printf("FPRIV + USER\n");
      return;
      //exit(-1);
    case FINST:
      panic("FINST from kernel");
    case FINST  + USER:
      printf("FINST + USER\n");
      return;
      //exit(-1);
    case FARITH:
      panic("FARITH from kernel");
    case FARITH + USER:
      printf("FARITH + USER\n");
      return;
      //exit(-1); // XXX psignal(SIGFPT)
    case FIPAGE:
      printf("FIPAGE from kernel [0x%x]", lvadr());
      panic("!\n");
    case FIPAGE + USER:
      printf("FIPAGE + USER [0x%x]", lvadr());
      return;
      //exit(-1); // XXX psignal(SIGSEG) or page in
    case FWPAGE:
    case FWPAGE + USER:
    case FRPAGE:
    case FRPAGE + USER:
      if ((ret = pgfault_handler(tf)) != 0) {
            print_trapframe(tf);
            if (current == NULL) {
                panic("handle pgfault failed. ret=%d\n", ret);
            }
            else {
                if (trap_in_kernel(tf)) {
                    panic("handle pgfault failed in kernel mode. ret=%d\n", ret);
                }
                printf("killed by kernel.\n");
                panic("handle user mode pgfault failed. ret=%d\n", ret);
            }
      }
      tf->pc = (uint *)(tf->pc) - 1;
      spage(1);
      return;
    case FTIMER:
    case FTIMER + USER:
       /* LAB1 YOUR CODE : STEP 3 */
       /* handle the timer interrupt */
       /* (1) After a timer interrupt, you should record this event using a global variable (increase it), such as ticks in kern/driver/clock.c
        * (2) Every TICK_NUM cycle, you can print some info using a funciton, such as print_ticks().
        * (3) Too Simple? Yes, I think so!
        */
       /* LAB5 2013011343 */
       /* you should upate you lab1 code (just add ONE or TWO lines of code):
        *    Every TICK_NUM cycle, you should set current process's current->need_resched = 1
        */
       /* LAB6 YOUR CODE */
       /* you should upate you lab5 code
        * IMPORTANT FUNCTIONS:
        * sched_class_proc_tick
        */
       ticks ++;
       assert(current != NULL);
       sched_class_proc_tick(current);
       return;
    case FKEYBD:
    case FKEYBD + USER:
      //consoleintr();
      return;
  }
}

void trap(struct trapframe *tf) {
    // dispatch based on what type of trap occurred
    // used for previous projects
    struct trapframe *otf;
    bool in_kernel;

    if (current == NULL) {
        trap_dispatch(tf);
    }
    else {
        // keep a trapframe chain in stack
        otf = current->tf;
        current->tf = tf;
        in_kernel = trap_in_kernel(tf);

        trap_dispatch(tf);
    
        current->tf = otf;
        if (!in_kernel) {
            if (current->flags & PF_EXITING) {
                do_exit(-E_KILLED);
            }
            if (current->need_resched) {
                schedule();
            }
        }
    }

}

void trap_before(uint *sp, double g, double f, int c, int b, int a, int fc, uint *pc) {
    trap(&sp);
}

void alltraps()
{
  asm(PSHA);
  asm(PSHB);
  asm(PSHC);
  asm(PSHF);
  asm(PSHG);
  asm(LUSP); asm(PSHA);
  trap_before();
  asm(POPA); asm(SUSP);
  asm(POPG);
  asm(POPF);
  asm(POPC);
  asm(POPB);
  asm(POPA);
  asm(RTI);
}

void idt_init() {
  ivec(alltraps);
}

#endif /* !__KERN_TRAP_TRAP_H__ */
