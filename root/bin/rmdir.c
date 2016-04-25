// rmdir -- remove a directory
//
// Usage:  rmdir dirname ...
//
// Description:
//   rmdir removes the specified directories.

// clang-format off
#include <u.h>
#include <libc.h>
// clang-format on

int main(int argc, char *argv[]) {
  int i;

  if (argc < 2) {
    dprintf(2, "Usage: rmdir dirname ...\n");
    return -1;
  }

  dprintf(2, "rmdir: not implemented yet\n"); // XXX
  return 0;
}
