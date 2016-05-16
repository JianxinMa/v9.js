# Debugger Design (Not Finished)

## Support from the Operating System

Please replace `userinit` of `os.c` with this one:
```c
void userinit(void) {
  char *mem;
  init = allocproc();
  init->pdir = memcpy(kalloc(), kpdir, PAGE);
  mem = memset(kalloc(), 0, PAGE);
  *(uint *)(mem) = -20 + (uint)((char *)init_start) + V2P;  /* change #1 */
  *(uint *)(mem + 16) = 0xff2016ff;  /* change #2 */
  mem = memcpy(mem + 20, (char *)init_start,
               (uint)userinit - (uint)init_start);
  mappage(init->pdir, 0, V2P + mem, PTE_P | PTE_W | PTE_U);
  init->sz = PAGE;
  init->tf->sp = PAGE;
  init->tf->fc = USER;
  init->tf->pc = 20;  /* change #3 */
  safestrcpy(init->name, "initcode", sizeof(init->name));
  init->cwd = namei("/");
  init->state = RUNNABLE;
}
```

For your reference, here is the original one:

```c
void userinit(void) {
  char *mem;
  init = allocproc();
  init->pdir = memcpy(kalloc(), kpdir, PAGE);
  mem = memset(kalloc(), 0, PAGE)
  mem = memcpy(mem, (char *)init_start,
        (uint)userinit - (uint)init_start);
  mappage(init->pdir, 0, V2P + mem, PTE_P | PTE_W | PTE_U);
  init->sz = PAGE;
  init->tf->sp = PAGE;
  init->tf->fc = USER;
  init->tf->pc = 0;
  safestrcpy(init->name, "initcode", sizeof(init->name));
  init->cwd = namei("/");
  init->state = RUNNABLE;
}
```

Basically, we have just injected 20 extra bytes at the beginning.

## Support from the Compiler

### Executable File Format

Executable files should be little-endian and follow the format used by V9. Please go to `xvcc.c` and figure out how the format looks like. Here is the key snippet.
```c
...
    hdr.magic = 0xC0DEF00D;
    hdr.bss = bss;
    hdr.entry = amain - ts;
    hdr.flags = 0;
    fwrite(&hdr, 1, sizeof(hdr), fd);
    fwrite((void *)ts, 1, text, fd);
    fwrite((void *)gs, 1, data, fd);
...
```

### Additional Information in Executable Files

When you are compiling, please do the following things:
- Reserve the first 4 bytes of .text, and save `0xFF2017FF` (a 32-bit integer) there.
- Store the source file name right after the above magic number. For example, save `root/etc/os.c` after `0xFF2017FF`. It should be terminated by '\0'.

### Debugging Information

Store debugging information in another file. For example, you may have compiled `root/etc/os.c` and obtained `root/etc/os`. Now you should store debugging information in `root/etc/os.d`.

`root/etc/os.d` looks like this.
```
TODO: ...
```
