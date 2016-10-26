#ifndef __USER_LIBS_FILE_H__
#define __USER_LIBS_FILE_H__

int read(int fd, void *base, size_t len) {
  return sys_read(fd, base, len);
}

int
open(char *path, uint32_t open_flags) {
  return sys_open(path, open_flags);
}

int
close(int fd) {
  return sys_close(fd);
}

#endif
