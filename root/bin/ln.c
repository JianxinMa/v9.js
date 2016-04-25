// ln -- make a link
//
// Usage:  ln old new
//
// Description:
//   ln creates a link from an existing old file to a new file.

// clang-format off
#include <u.h>
#include <libc.h>
// clang-format on

int main(int argc, char *argv[]) {
  if (argc != 3) {
    dprintf(2, "Usage: ln old new\n");
    return -1;
  }
  if (link(argv[1], argv[2]) < 0) {
    dprintf(2, "link %s %s: failed\n", argv[1], argv[2]);
    return -1;
  }
  return 0;
}
