# Debugger Design

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
      # This also means the following struct has no name, i.e. is unnamed:
      #   typedef struct {
      #     ..
      #   } fancy_t;
      #
      # Moreover, if a varialbe is defined like this:
      #   struct { int x, y; } p;
      # It is also  of an unnamed struct type.
      #
      print("struct");
      if (is_an_unnamed_struct) {
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
  print(")")


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
  print(")")
```

What's the content of `root/etc/os.d`? It looks like this:
```
= root/etc/os.c
# 注意上面，文件的第一行必须以=开始，后接代码的文件名。

# 行首为`#`，表明这一行为注释。空行会被忽略。
g proc bss +0 (array(64|132(struct<proc>)))                                     
g u bss +8448 (ptr(struct<proc>))                                               
g init bss +8452 (ptr(struct<proc>))                                            
g mem_free bss +8456 (ptr(char))                                                
g mem_top bss +8460 (ptr(char))                                                 
g mem_sz bss +8464 (uint)                                                       
g kreserved bss +8468 (uint)  
# ...省略很多很多...
# 上面这几个是全局变量，分别叫proc、u、init等等；
# 由于它们在bss段，当然了，如果变量在data段就请把bss换成data；
# bss后面的十进制数字表示这个变量的地址相对.bss开头处的偏移值，注意，是偏移值；
# 偏移值之后是类型信息。

# ...省略很多很多...

# 接下来是某个函数相关的信息：
> 0x00000018
# 上面先用以>开头的一行表示出函数的入口；
l n stk +24 (uint)
l s stk +16 (ptr(void))
l d stk +8 (ptr(void))
# 然后立即用l（是小L，不是I）开头表示出都有什么局部变量；
# 传入的参数也视为局部变量；
# 实际上你看相对栈帧的偏移值的正负就可以判断这个局部变量是否传入参数；
# 局部变量的格式和全局变量的格式差不多；
# 这里stk表示该局部变量是在栈帧上的；
# 如果一个局部变量是static的，那么这里stk应该相应地替换成bss或data；
i 0x00000018 root/etc/os.c 213
i 0x0000001c root/etc/os.c 213
i 0x00000020 root/etc/os.c 214
i 0x00000024 root/etc/os.c 215
i 0x00000028 root/etc/os.c 216
i 0x0000002c root/etc/os.c 217
i 0x00000030 root/etc/os.c 218
# ...省略很多很多...
# 然后对函数里的每一条指令，用i开头的一行标注它的位置。

# ...省略很多很多...

# 下面是另一个函数的相关信息，作为另一个例子：
> 0x0000687c
l endbss bss +211180 (int)
l kstack bss +210924 (array(256|1(char)))
l ksp stk -4 (ptr(int))
i 0x0000687c root/etc/os.c 2621
i 0x00006880 root/etc/os.c 2621
i 0x00006884 root/etc/os.c 2621
i 0x00006888 root/etc/os.c 2621
i 0x0000688c root/etc/os.c 2621
# ...省略很多很多...

# 接下来给出定义的结构体的信息：
d struct pollfd (8|(fd:+0:(int))(events:+4:(short))(revents:+6:(short)))
# ...省略很多很多...
# 可以看到结构体的类型信息还给出了各个成员的偏移值

# 最后给出.bss和.data的起始地址，注意是起始地址，不是大小
.data 0x00006948
.bss  0x00006ed8
```
