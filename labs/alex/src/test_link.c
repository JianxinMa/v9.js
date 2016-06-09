#include "libs/stdio.h"
unsigned int uint32_v = 0xdeadbeef;
int int32_v = -123;
char char_v = 'a';
unsigned char uint8_v = 0x81;
int *int32_ptr = &int32_v;
char ***arr[100];

struct s2 {
  int xx;
};

struct s1 {
  struct s2 s2val;
  struct {
    int a;
    int a1234;
  };
  struct {
    int v;
  } u;
  int b;
};

int func_with_parameters(int a, int b, struct s1 c) {
  int x = 123;
  int y = 321;
  int z = x + y;
  return a + b + c.a + z;
}

int main() {
  struct s1 a;
  a.a = 123;
  cprintf("func_with_parameters: %d\n", func_with_parameters(1, 2, a));
  cprintf("Hello World! \n  uint32: 0x%08x\n  int32: %d\n  char: %c\n  uint8: 0x%02x\n",
    uint32_v, int32_v, char_v, uint8_v);
  return 0;
}
