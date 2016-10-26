#ifndef U_H
#define U_H
// u.h

// instruction set
enum {
  HALT,ENT,LEV,JMP,JMPI,JSR,JSRA,LEA,LEAG,CYC,MCPY,MCMP,MCHR,MSET,       // system
  LL,LLS,LLH,LLC,LLB,LLD,LLF,LG,LGS,LGH,LGC,LGB,LGD,LGF,                 // load a
  LX,LXS,LXH,LXC,LXB,LXD,LXF,LI,LHI,LIF,
  LBL,LBLS,LBLH,LBLC,LBLB,LBLD,LBLF,LBG,LBGS,LBGH,LBGC,LBGB,LBGD,LBGF,   // load b
  LBX,LBXS,LBXH,LBXC,LBXB,LBXD,LBXF,LBI,LBHI,LBIF,LBA,LBAD,
  SL,SLH,SLB,SLD,SLF,SG,SGH,SGB,SGD,SGF,                                 // store
  SX,SXH,SXB,SXD,SXF,
  ADDF,SUBF,MULF,DIVF,                                                   // arithmetic
  ADD,ADDI,ADDL,SUB,SUBI,SUBL,MUL,MULI,MULL,DIV,DIVI,DIVL,
  DVU,DVUI,DVUL,MOD,MODI,MODL,MDU,MDUI,MDUL,AND,ANDI,ANDL,
  OR,ORI,ORL,XOR,XORI,XORL,SHL,SHLI,SHLL,SHR,SHRI,SHRL,
  SRU,SRUI,SRUL,EQ,EQF,NE,NEF,LT,LTU,LTF,GE,GEU,GEF,                     // logical
  BZ,BZF,BNZ,BNZF,BE,BEF,BNE,BNEF,BLT,BLTU,BLTF,BGE,BGEU,BGEF,           // conditional
  CID,CUD,CDI,CDU,                                                       // conversion
  CLI,STI,RTI,BIN,BOUT,NOP,SSP,PSHA,PSHI,PSHF,PSHB,POPB,POPF,POPA,       // misc
  IVEC,PDIR,SPAG,TIME,LVAD,TRAP,LUSP,SUSP,LCL,LCA,PSHC,POPC,MSIZ,
  PSHG,POPG,NET1,NET2,NET3,NET4,NET5,NET6,NET7,NET8,NET9,
  POW,ATN2,FABS,ATAN,LOG,LOGT,EXP,FLOR,CEIL,HYPO,SIN,COS,TAN,ASIN,       // math
  ACOS,SINH,COSH,TANH,SQRT,FMOD,
  IDLE
};

/* syscall number */
#define SYS_exit            1
#define SYS_fork            2
#define SYS_wait            3
#define SYS_exec            4
#define SYS_clone           5
#define SYS_yield           10
#define SYS_sleep           11
#define SYS_kill            12
#define SYS_gettime         17
#define SYS_getpid          18
#define SYS_brk             19
#define SYS_mmap            20
#define SYS_munmap          21
#define SYS_shmem           22
#define SYS_putc            30
#define SYS_pgdir           31
#define SYS_open            100
#define SYS_close           101
#define SYS_read            102
#define SYS_write           103
#define SYS_seek            104
#define SYS_fstat           110
#define SYS_fsync           111
#define SYS_getcwd          121
#define SYS_getdirentry     128
#define SYS_dup             130
/* OLNY FOR LAB6 */
#define SYS_lab6_set_priority 255

typedef unsigned char uchar;
typedef unsigned short ushort;
typedef unsigned int uint;

#define NO_FD               -0x9527     // invalid fd


#endif
