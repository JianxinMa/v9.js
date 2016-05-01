// clang-format off
#include <u.h>
#include <libc.h>
// clang-format on

int g_bss_i;
int g_data_i = -1;

int main() {
  int i;
  double d;
  void *p;
  static int l_bss_i;
  static int l_data_i = 24;
  i = 4;
  d = 8;
  p = 1;
  return 0;
}
