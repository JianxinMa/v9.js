#v9

## Screenshot

```
Jianxins-MacBook-Air:src mjx$ node emulate.js -f fs.img root/etc/os 
Welcome!
$ ls
.
..
demo/
emhello.c
euhello.c
hello.c
os/
prseg.c
$ cat hello.c
#include <u.h>
#include <libc.h>

int main()
{
  printf("hello world.\n");
  return 0;
}
$ c hello.c
hello world.
$ c -o hello hello.c
$ ./hello
hello world.
$ c prseg.c
code  = 0x00818000
data  = 0x00818fa8
bss   = 0x00819210
stack = 0x00817f6c
brk   = 0x00819220
$ halt
halt(0) cycle = 3410320018

Jianxins-MacBook-Air:src mjx$ 
```
