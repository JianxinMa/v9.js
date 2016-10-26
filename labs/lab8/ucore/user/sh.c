#include <ulib.h>
#include <io.h>
#include <umain.h>
#include <string.h>
// #include <dir.h>
#include <file.h>
// #include <error.h>
// #include <unistd.h>

#define putc(c)                         cprintf("%c", c)

#define BUFSIZE                         4096
#define WHITESPACE                      " \t\r\n"
#define SYMBOLS                         "<|>&;"
#define EXEC_MAX_ARG_NUM                2

enum { O_RDONLY, O_WRONLY, O_RDWR, O_CREAT = 0x100, O_TRUNC = 0x200 };

char shcwd[BUFSIZE];
int fd;

int
gettoken(char **p1, char **p2) {
  char *s;
  int token;
  bool flag;
  if ((s = *p1) == NULL) {
    return 0;
  }
  while (strchr(WHITESPACE, *s) != NULL) {
    *s++ = '\0';
  }
  if (*s == '\0') {
    return 0;
  }

  *p2 = s;
  token = 'w';
  if (strchr(SYMBOLS, *s) != NULL) {
    token = *s, *s++ = '\0';
  }
  else {
    flag = 0;
    while (*s != '\0' && (flag || strchr(WHITESPACE SYMBOLS, *s) == NULL)) {
      if (*s == '"') {
	*s = ' ', flag = !flag;
      }
      s++;
    }
  }
  *p1 = (*s != '\0' ? s : NULL);
  return token;
}

char *
readline(char *prompt) {
  static char buffer[BUFSIZE];
  int ret, i = 0;
  char c;
  if (prompt != NULL) {
    cprintf("%s", prompt);
  }
  while (1) {
    if ((ret = read(0, &c, sizeof(char))) < 0) {
      return NULL;
    }
    else if (ret == 0) {
      if (i > 0) {
	buffer[i] = '\0';
	break;
      }
      return NULL;
    }
    if (c == 3) {
      return NULL;
    }
    else if (c >= ' ' && i < BUFSIZE - 1) {
      putc(c);
      buffer[i++] = c;
    }
    else if (c == '\b' && i > 0) {
      putc(c);
      i--;
    }
    else if (c == '\n' || c == '\r') {
      putc(c);
      buffer[i] = '\0';
      break;
    }
  }
  return buffer;
}

void
usage(void) {
  cprintf("usage: sh [command-file]\n");
}

int
reopen(int fd2, char *filename, uint32_t open_flags) {
  cprintf("reopen not implement\n");
  exit(0);

  // int ret, fd1;
  // close(fd2);
  // if ((ret = open(filename, open_flags)) >= 0 && ret != fd2) {
  //     close(fd2);
  //     fd1 = ret, ret = dup2(fd1, fd2);
  //     close(fd1);
  // }
  // return ret < 0 ? ret : 0;
}

int
testfile(char *name) {
  int ret;
  if ((ret = open(name, O_RDONLY)) < 0) {
    return ret;
  }
  close(ret);
  return 0;
}

int
runcmd(char *cmd) {
  static char argv0[BUFSIZE];
  char *argv[EXEC_MAX_ARG_NUM + 1];
  char *t;
  int argc, token, ret, p[2];
again:
  argc = 0;
  while (1) {
    switch (token = gettoken(&cmd, &t)) {
    case 'w':
      if (argc == EXEC_MAX_ARG_NUM) {
	cprintf("sh error: too many arguments\n");
	return -1;
      }
      argv[argc++] = t;
      break;
    case '<':
    case '>':
    case '|':
    case '&':
      cprintf("<%c> not support!", token);
    case 0:
      goto runit;
    case ';':
      if ((ret = fork()) == 0) {
	goto runit;
      }
      else {
	if (ret < 0) {
	  return ret;
	}
	waitpid(ret, NULL);
	goto again;
      }
      break;
    default:
      cprintf("sh error: bad return %d from gettoken\n", token);
      return -1;
    }
  }

runit:
  if (argc == 0) {
    return 0;
  }
  else if (strcmp(argv[0], "cd") == 0) {
    // if (argc != 2) {
    //     return -1;
    // }
    // strcpy(shcwd, argv[1]);
    // return 0;
    cprintf("cd not support\n");
    return 0;
  }
  if ((ret = testfile(argv[0])) != 0) {
    cprintf("file error\n");
    return 0;
  }
  argv[argc] = NULL;
  return exec(argv[0]);
}

int
main(int argc, char **argv) {
  int ret, interactive = 1;
  char *buffer;
  int pid;
  if (open("/CONSOLE", O_RDWR) != 0) {
    cprintf("open console failed.");
    exit(0);
  }
  cprintf("user sh is running!!!");
  assert(shcwd != NULL);

  while ((buffer = readline((interactive) ? "$ " : NULL)) != NULL) {
    cprintf("\ndo %s\n", buffer);
    shcwd[0] = '\0';
    if ((pid = fork()) == 0) {
      ret = runcmd(buffer);
      exit(ret);
    }
    assert(pid >= 0);
    if (waitpid(pid, &ret) == 0) {
      if (ret == 0 && shcwd[0] != '\0') {
	ret = 0;
      }
      if (ret != 0) {
	cprintf("error: %d - %e\n", ret, ret);
      }
    }
  }
  return 0;
}
