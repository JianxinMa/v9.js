#ifndef __LIB_CALL_H__
#define __LIB_CALL_H__

#include <u.h>

typedef unsigned int funcptr_t;

void call0(funcptr_t func) {
  asm(LL, 8);
  asm(PSHA);
  asm(LEV);
}

void call1(int arg0, funcptr_t func) {
  asm(LL, 16);
  asm(PSHA);
  asm(LEV);
}

void call2(int arg0, int arg1, funcptr_t func) {
  asm(LL, 24);
  asm(PSHA);
  asm(LEV);
}

void call3(int arg0, int arg1, int arg2, funcptr_t func) {
  asm(LL, 32);
  asm(PSHA);
  asm(LEV);
}

void call4(int arg0, int arg1, int arg2, int arg3, funcptr_t func) {
  asm(LL, 40);
  asm(PSHA);
  asm(LEV);
}
#endif
