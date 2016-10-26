#ifndef __KERN_FS_CONSOLE_H__
#define __KERN_FS_CONSOLE_H__

enum { INPUT_BUF = 128 };
struct input_s {
  char buf[INPUT_BUF];
  uint r;  // read index
  uint w;  // write index
};
struct input_s input;    // XXX do this some other way?

int consoleread(struct inode *ip, char *dst, int n)
{
  int target, c, e;
  iunlock(ip);
  target = n;
  // e = splhi();
  while (n > 0) {
    if (input.r == input.w && n < target) break; // block until at least one byte transfered
    while (input.r == input.w) {
      // if (u->killed) {
      //   splx(e);
      //   ilock(ip);
      //   return -1;
      // }
      // sleep(&input.r);
    }
    c = input.buf[input.r++ % INPUT_BUF];

    *dst++ = c;  // XXX pagefault possible in cli (perhaps use inode locks to achieve desired effect)
    n--;
  }
  // splx(e);
  ilock(ip);
  return target - n;
}

int consolewrite(struct inode *ip, char *buf, int n)
{
  int i, e;

  iunlock(ip);
  e = splhi(); // XXX pagefault possible in cli
  for (i = 0; i < n; i++) cout(buf[i]);
  splx(e);
  ilock(ip);
  return n;
}

consoleintr()
{
  int c;
  while ((c = in(0)) != -1) {
    //  printf("<%d>",c); //   XXX
    if (input.w - input.r < INPUT_BUF) {
      input.buf[input.w++ % INPUT_BUF] = c;
      // wakeup(&input.r);
    }
  }
}

#endif
