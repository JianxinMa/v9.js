#ifndef __TRAP_TFSTRUCT_H__
#define __TRAP_TFSTRUCT_H__

enum {    // processor fault codes
  FMEM,     // bad physical address
  FTIMER,   // timer interrupt
  FKEYBD,   // keyboard interrupt
  FPRIV,    // privileged instruction
  FINST,    // illegal instruction
  FSYS,     // software trap
  FARITH,   // arithmetic trap
  FIPAGE,   // page fault on opcode fetch
  FWPAGE,   // page fault on write
  FRPAGE,   // page fault on read
  USER=16   // user mode exception
};

uint ticks;

struct pushregs {
  int sp, pad1;
  double g;
  double f;
  int c,  pad2;
  int b,  pad3;
  int a,  pad4;
};

struct trapframe {
  struct pushregs tf_regs;
  int fc, pad5;
  int pc, pad6;
};

void print_regs(struct pushregs *regs) {
  printf("  SP : 0x%x\n", regs->sp);
  // printf("  REG_G : %f\n", regs -> g);
  // printf("  REG_F : %f\n", regs -> f);
  printf("  REG_A : 0x%x\n", regs->a);
  printf("  REG_B : 0x%x\n", regs->b);
  printf("  REG_C : 0x%x\n", regs->c);
}

void print_trapframe(struct trapframe *tf) {
  // printf("trapframe at %x\n", tf);
  // print_regs(&tf->tf_regs);
  // if (!trap_in_kernel(tf)) {
  //   printf("Trap in usermode!\n");
  // }else{
  //   printf("Trap in kernel!\n");
  // }
  // printf("Error Code: %e\n", tf->fc);
  printf("PC : 0x%x\n", tf->pc);
  printf("\n");
}

bool
trap_in_kernel(struct trapframe *tf) {
  return (tf->fc < USER);
}

#endif
