#ifndef __USER_LIBS_UMAIN_H__
#define __USER_LIBS_UMAIN_H__
#include <ulib.h>

int umain(void);

int main(void) {
  int ret = umain();
  exit(ret);
}

#define main umain

#endif /* !__USER_LIBS_UMAIN_H__ */
