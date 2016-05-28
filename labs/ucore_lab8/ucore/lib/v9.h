#ifndef __LIBS_V9_H__
#define __LIBS_V9_H__
#include "u.h"
#include "defs.h"

int in(port)    { asm(LL,8); asm(BIN); }                    //从port获得输入
out(port, val)  { asm(LL,8); asm(LBL,16); asm(BOUT); }      //输出val到port
ivec(void *isr) { asm(LL,8); asm(IVEC); }                   //设置中断向量 <- isr
lvadr()         { asm(LVAD); }                              //通过LVAD指令可获得访问异常的虚地址并赋值给寄存器a
uint msiz()     { asm(MSIZ); }                              //获取内存大小
stmr(val)       { asm(LL,8); asm(TIME); }                   //设置timeout <- val
pdir(val)       { asm(LL,8); asm(PDIR); }                   //设置PTBR <- val
spage(val)      { asm(LL,8); asm(SPAG); }                   //设置页机制开关 <- val
splhi()         { asm(CLI); }                               //屏蔽中断
splx(int e)     { if (e) asm(STI); }                        //屏蔽使能

#endif
