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

An string is used to represent a variable's type. Here is an example type string, ```(array(64|132(struct<proc>)))```. A type string is generated according to the following pseudo algorithm.

```c
#
# Example outputs:
#    (array(10|20(struct<buf>)))
#    (ptr(struct<inode>)) 
# 
def print_type_str(var):
  print("(")
  if (type(var) == pointer) {
    print("ptr");
    print_type_str(*var)  # print the type of the variable it points to
  } else {
    switch (type(var)) {
    case char:
      print("char")
      break
    case short:
      print("short")
      break
    case int:
      print("int")
      break
    case uchar:
      print("uchar")
      break
    case ushort:
      print("ushort")
      break
    case uint:
      print("uint")
      break
    case float:
      print("float")
      break
    case double:
      print("double")
      break
    case void:
      print("void")
      break
    case function:
      print("fun")
      break;
    case array:
      print("array(");
        print(number_of_elements_in_an_array(var))
        print("|")
        print(size_in_bytes_of_each_element_in_an_array(var))
        print_type_str(var[0])  # print the type of its element
      print(")");
      break;
    case struct:
      #
      # If a struct look like this:
      #   struct fancy_st {
      #     ...
      #   };
      # It is a struct with name `fancy_st`.
      #
      # Note that in C, you need to use `struct fancy_st var` to declare a variable.
      # In C++, you can simply use `fancy_st var`. But no, this is not allowed in C.
      #
      # Also note that we don't consider `typedef` names.
      # This means if a struct look like this:
      #   typedef struct fancy_st {
      #      ..
      #   } fancy_t;
      # You can use `fancy_t var` to declare a variable in C.
      # But the struct's name is `fancy_st`, not `fancy_t`.
      #
      # This also means the following struct has no name, i.e. is anonymous:
      #   typedef struct {
      #     ..
      #   } fancy_t;
      #
      # Moreover, if a varialbe is defined like this:
      #   struct { int x, y; } p;
      # It is also  of an anonymous struct type.
      #
      print("struct");
      if (is_an_anonymous_struct) {
        print_struct_type_str(var)  # See print_struct_type_str below.
      } else {
        print("<")
        print(name_of_the_struct_type(var))
        print(">")
      }
      break;
    default:
      warn("Unknown Type");
    }
  }
  printf(")")


#
# An example output:
#   (struct(8|(c:+0:(char))(i:+4:(int))))
#
def print_struct_type_str(var):
  print("(")
  print(size_of_struct(var))  # this is the size after struct being aligned
  print("|")
  for each member m in struct_type(var) {
    print("(")
    print(member_name(m))
    print(":")
    print(member_address_offset(m))
    print_type_str(m)
    print(")")
  }
  fprintf(")")
```