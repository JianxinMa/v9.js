#ifndef __KERN_MM_VMM_H__
#define __KERN_MM_VMM_H__

#include <defs.h>
#include <list.h>
#include <memlayout.h>
#include <sync.h>
#include <pmm.h>
#include <kmalloc.h>


/* kernel error codes -- keep in sync with list in lib/printfmt.c */
#define E_UNSPECIFIED       1   // Unspecified or unknown problem
#define E_BAD_PROC          2   // Process doesn't exist or otherwise
#define E_INVAL             3   // Invalid parameter
#define E_NO_MEM            4   // Request failed due to memory shortage
#define E_NO_FREE_PROC      5   // Attempt to create a new process beyond
#define E_FAULT             6   // Memory fault

#define VM_READ                 0x00000001
#define VM_WRITE                0x00000002
#define VM_EXEC                 0x00000004
#define VM_STACK                0x00000008

#define le2vma(le, member)      to_struct((le), struct vma_struct, member)

/*
   vmm design include two parts: mm_struct (mm) & vma_struct (vma)
   mm is the memory manager for the set of continuous virtual memory
   area which have the same PDT. vma is a continuous virtual memory area.
   There a linear link list for vma & a redblack link list for vma in mm.
   ---------------
   mm related functions:
   golbal functions
     struct mm_struct * mm_create(void)
     void mm_destroy(struct mm_struct *mm)
     int do_pgfault(struct mm_struct *mm, uint32_t error_code, uintptr_t addr)
   --------------
   vma related functions:
   global functions
     struct vma_struct * vma_create (uintptr_t vm_start, uintptr_t vm_end,...)
     void insert_vma_struct(struct mm_struct *mm, struct vma_struct *vma)
     struct vma_struct * find_vma(struct mm_struct *mm, uintptr_t addr)
   local functions
     inline void check_vma_overlap(struct vma_struct *prev, struct vma_struct *next)
   ---------------
   check correctness functions
     void check_vmm(void);
     void check_vma_struct(void);
     void check_pgfault(void);
 */

int
mm_count(struct mm_struct *mm) {
  return mm->mm_count;
}

void
set_mm_count(struct mm_struct *mm, int val) {
  mm->mm_count = val;
}

int
mm_count_inc(struct mm_struct *mm) {
  mm->mm_count += 1;
  return mm->mm_count;
}

int
mm_count_dec(struct mm_struct *mm) {
  mm->mm_count -= 1;
  return mm->mm_count;
}

void
lock_mm(struct mm_struct *mm) {
  if (mm != NULL) {
    lock(&(mm->mm_lock));
  }
}

void
unlock_mm(struct mm_struct *mm) {
  if (mm != NULL) {
    unlock(&(mm->mm_lock));
  }
}

int swap_init_mm(struct mm_struct *mm);

// mm_create -  alloc a mm_struct & initialize it.
struct mm_struct *
mm_create(void) {
  struct mm_struct *mm;
  mm = kmalloc(sizeof(struct mm_struct));
  if (mm != NULL) {
    list_init(&(mm->mmap_list));
    mm->mmap_cache = NULL;
    mm->pgdir = NULL;
    mm->map_count = 0;
    if (swap_init_ok)
      swap_init_mm(mm);
    else
      mm->sm_priv = NULL;

    set_mm_count(mm, 0);
    lock_init(&(mm->mm_lock));
  }
  return mm;
}

// vma_create - alloc a vma_struct & initialize it. (addr range: vm_start~vm_end)
struct vma_struct *
vma_create(uintptr_t vm_start, uintptr_t vm_end, uint32_t vm_flags) {
  struct vma_struct *vma;
  vma = kmalloc(sizeof(struct vma_struct));
  if (vma != NULL) {
    vma->vm_start = vm_start;
    vma->vm_end = vm_end;
    vma->vm_flags = vm_flags;
  }
  return vma;
}


// find_vma - find a vma  (vma->vm_start <= addr <= vma_vm_end)
struct vma_struct *
find_vma(struct mm_struct *mm, uintptr_t addr) {
  bool found;
  struct vma_struct *vma = NULL;
  list_entry_t *list, *le;
  if (mm != NULL) {
    vma = mm->mmap_cache;
    if (!(vma != NULL && vma->vm_start <= addr && vma->vm_end > addr)) {
      found = 0;
      list = &(mm->mmap_list);
      le = list;
      while ((le = list_next(le)) != list) {
	vma = le2vma(le, list_link);
	if (vma->vm_start<=addr && addr < vma->vm_end) {
	  found = 1;
	  break;
	}
      }
      if (!found) {
	vma = NULL;
      }
    }
    if (vma != NULL) {
      mm->mmap_cache = vma;
    }
  }
  return vma;
}

// check_vma_overlap - check if vma1 overlaps vma2 ?
void check_vma_overlap(struct vma_struct *prev, struct vma_struct *next) {
  assert(prev->vm_start < prev->vm_end);
  assert(prev->vm_end <= next->vm_start);
  assert(next->vm_start < next->vm_end);
}

// insert_vma_struct -insert vma in mm's list link
void
insert_vma_struct(struct mm_struct *mm, struct vma_struct *vma) {
  list_entry_t *le;
  list_entry_t *list;
  list_entry_t *le_prev, *le_next;
  struct vma_struct *mmap_prev;
  assert(vma->vm_start < vma->vm_end);
  list = &(mm->mmap_list);
  le_prev = list;

  le = list;
  while ((le = list_next(le)) != list) {
    mmap_prev = le2vma(le, list_link);
    if (mmap_prev->vm_start > vma->vm_start) {
      break;
    }
    le_prev = le;
  }

  le_next = list_next(le_prev);
  /* check overlap */
  if (le_prev != list) {
    check_vma_overlap(le2vma(le_prev, list_link), vma);
  }
  if (le_next != list) {
    check_vma_overlap(vma, le2vma(le_next, list_link));
  }

  vma->vm_mm = mm;
  list_add_after(le_prev, &(vma->list_link));

  mm->map_count++;
}

// mm_destroy - free mm and mm internal fields
void
mm_destroy(struct mm_struct *mm) {
  list_entry_t *list = &(mm->mmap_list), *le;
  assert(mm_count(mm) == 0);
  while ((le = list_next(list)) != list) {
    list_del(le);
    kfree(le2vma(le, list_link));      //kfree vma
  }
  kfree(mm);   //kfree mm
  mm=NULL;
}

void
check_vma_struct(void) {
  size_t nr_free_pages_store = nr_free_pages();
  int step1 = 10;
  int step2 = step1 * 10;
  int i;
  struct mm_struct *mm = mm_create();
  struct vma_struct *vma;
  struct vma_struct *mmap;
  struct vma_struct *vma1, *vma2, *vma3, *vma4, *vma5;
  struct vma_struct *vma_below_5;
  list_entry_t *le;

  assert(mm != NULL);

  for (i = step1; i >= 1; i--) {
    vma = vma_create(i * 5, i * 5 + 2, 0);
    assert(vma != NULL);
    insert_vma_struct(mm, vma);
  }

  for (i = step1 + 1; i <= step2; i++) {
    vma = vma_create(i * 5, i * 5 + 2, 0);
    assert(vma != NULL);
    insert_vma_struct(mm, vma);
  }

  le = list_next(&(mm->mmap_list));

  for (i = 1; i <= step2; i++) {
    assert(le != &(mm->mmap_list));
    mmap = le2vma(le, list_link);
    assert(mmap->vm_start == i * 5 && mmap->vm_end == i * 5 + 2);
    le = list_next(le);
  }

  for (i = 5; i <= 5 * step2; i +=5) {
    vma1 = find_vma(mm, i);
    assert(vma1 != NULL);
    vma2 = find_vma(mm, i+1);
    assert(vma2 != NULL);
    vma3 = find_vma(mm, i+2);
    assert(vma3 == NULL);
    vma4 = find_vma(mm, i+3);
    assert(vma4 == NULL);
    vma5 = find_vma(mm, i+4);
    assert(vma5 == NULL);

    assert(vma1->vm_start == i  && vma1->vm_end == i  + 2);
    assert(vma2->vm_start == i  && vma2->vm_end == i  + 2);
  }

  for (i =4; i>=0; i--) {
    vma_below_5 = find_vma(mm,i);
    if (vma_below_5 != NULL ) {
      printf("vma_below_5: i %x, start %x, end %x\n",i, vma_below_5->vm_start, vma_below_5->vm_end);
    }
    assert(vma_below_5 == NULL);
  }

  mm_destroy(mm);

  printf("check_vma_struct() succeeded!\n");
}

// check_pgfault - check correctness of pgfault handler
void check_pgfault(void) {
  size_t nr_free_pages_store = nr_free_pages();
  struct mm_struct *mm;
  struct vma_struct *vma;
  pde_t *pgdir;
  uintptr_t addr;
  int i, sum;


  check_mm_struct = mm_create();
  assert(check_mm_struct != NULL);

  mm = check_mm_struct;
  pgdir = mm->pgdir = boot_pgdir;
  assert(pgdir[0] == 0);

  vma = vma_create(0, PTSIZE, VM_WRITE);
  assert(vma != NULL);

  insert_vma_struct(mm, vma);

  addr = 0x100;

  assert(find_vma(mm, addr) == vma);

  sum = 0;

  for (i = 0; i < 100; i++) {
    *(char *)(addr + i) = i;
    sum += i;
  }

  for (i = 0; i < 100; i++) {
    sum -= *(char *)(addr + i);
  }

  assert(sum == 0);

  page_remove(pgdir, ROUNDDOWN(addr, PGSIZE));

  free_page(pde2page(pgdir[0]));

  pgdir[0] = 0;

  mm->pgdir = NULL;
  mm_destroy(mm);
  check_mm_struct = NULL;

  assert(nr_free_pages_store == nr_free_pages());

  printf("check_pgfault() succeeded!\n");
}

// check_vmm - check correctness of vmm
void check_vmm(void) {
  size_t nr_free_pages_store = nr_free_pages();

  check_vma_struct();
  check_pgfault();

  printf("check_vmm() succeeded.\n");
}

int
mm_map(struct mm_struct *mm, uintptr_t addr, size_t len, uint32_t vm_flags,
       struct vma_struct **vma_store) {

  uintptr_t start = ROUNDDOWN(addr, PGSIZE), end = ROUNDUP(addr + len, PGSIZE);
  int ret;
  struct vma_struct *vma;

  if (!USER_ACCESS(start, end)) {
    return -E_INVAL;
  }

  assert(mm != NULL);

  ret = -E_INVAL;

  if ((vma = find_vma(mm, start)) != NULL && end > vma->vm_start) {
    return ret;
  }
  ret = -E_NO_MEM;

  if ((vma = vma_create(start, end, vm_flags)) == NULL) {
    return ret;
  }
  insert_vma_struct(mm, vma);
  if (vma_store != NULL) {
    *vma_store = vma;
  }
  ret = 0;

  return ret;
}

int
dup_mmap(struct mm_struct *to, struct mm_struct *from) {
  list_entry_t *list = &(from->mmap_list), *le = list;
  struct vma_struct *vma, *nvma;
  bool share;

  assert(to != NULL && from != NULL);

  while ((le = list_prev(le)) != list) {

    vma = le2vma(le, list_link);
    nvma = vma_create(vma->vm_start, vma->vm_end, vma->vm_flags);
    if (nvma == NULL) {
      return -E_NO_MEM;
    }

    insert_vma_struct(to, nvma);
    share = 0;
    if (copy_range(to->pgdir, from->pgdir, vma->vm_start, vma->vm_end, share) != 0) {
      return -E_NO_MEM;
    }
  }
  return 0;
}

void
exit_mmap(struct mm_struct *mm) {
  pde_t *pgdir;
  list_entry_t *list, *le;
  struct vma_struct *vma;

  assert(mm != NULL && mm_count(mm) == 0);

  pgdir = mm->pgdir;
  list = &(mm->mmap_list);
  le = list;
  while ((le = list_next(le)) != list) {
    vma = le2vma(le, list_link);
    unmap_range(pgdir, vma->vm_start, vma->vm_end);
  }
  while ((le = list_next(le)) != list) {
    vma = le2vma(le, list_link);
    exit_range(pgdir, vma->vm_start, vma->vm_end);
  }
}

bool
user_mem_check(struct mm_struct *mm, uintptr_t addr, size_t len, bool write) {
  struct vma_struct * vma;
  uintptr_t start, end;

  if (mm != NULL) {
    if (!USER_ACCESS(addr, addr + len)) {
      return 0;
    }

    start = addr;
    end = addr + len;

    while (start < end) {
      if ((vma = find_vma(mm, start)) == NULL || start < vma->vm_start) {
	return 0;
      }
      if (!(vma->vm_flags & ((write) ? VM_WRITE : VM_READ))) {
	return 0;
      }
      if (write && (vma->vm_flags & VM_STACK)) {
	if (start < vma->vm_start + PGSIZE) {   //check stack start & size
	  return 0;
	}
      }
      start = vma->vm_end;
    }
    return 1;
  }
  return KERN_ACCESS(addr, addr + len);
}

bool
copy_from_user(struct mm_struct *mm, void *dst, void *src, size_t len, bool writable) {
  if (!user_mem_check(mm, (uintptr_t)src, len, writable)) {
    return 0;
  }
  memcpy(dst, src, len);
  return 1;
}

bool
copy_to_user(struct mm_struct *mm, void *dst, void *src, size_t len) {
  if (!user_mem_check(mm, (uintptr_t)dst, len, 1)) {
    return 0;
  }
  memcpy(dst, src, len);
  return 1;
}

// vmm_init - initialize virtual memory management
//          - now just call check_vmm to check correctness of vmm
void
vmm_init(void) {
  check_vmm();
}

//page fault number
unsigned int pgfault_num=0;

int swap_in(struct mm_struct *mm, uintptr_t addr, struct Page **ptr_result);

/* do_pgfault - interrupt handler to process the page fault execption
 * @mm         : the control struct for a set of vma using the same PDT
 * @error_code : the error code recorded in trapframe->tf_err which is setted by x86 hardware
 * @addr       : the addr which causes a memory access exception, (the contents of the CR2 register)
 *
 * CALL GRAPH: trap--> trap_dispatch-->pgfault_handler-->do_pgfault
 * The processor provides ucore's do_pgfault function with two items of information to aid in diagnosing
 * the exception and recovering from it.
 *   (1) The contents of the CR2 register. The processor loads the CR2 register with the
 *       32-bit linear address that generated the exception. The do_pgfault fun can
 *       use this address to locate the corresponding page directory and page-table
 *       entries.
 *   (2) An error code on the kernel stack. The error code for a page fault has a format different from
 *       that for other exceptions. The error code tells the exception handler three things:
 *         -- The P flag   (bit 0) indicates whether the exception was due to a not-present page (0)
 *            or to either an access rights violation or the use of a reserved bit (1).
 *         -- The W/R flag (bit 1) indicates whether the memory access that caused the exception
 *            was a read (0) or write (1).
 *         -- The U/S flag (bit 2) indicates whether the processor was executing at user mode (1)
 *            or supervisor mode (0) at the time of the exception.
 */
int
do_pgfault(struct mm_struct *mm, uint32_t error_code, uintptr_t addr) {
  int ret = -E_INVAL;
  //try to find a vma which include addr
  struct vma_struct *vma = find_vma(mm, addr);
  struct Page * page;
  pte_t *ptep;
  uint32_t perm;

  pgfault_num++;
  //If the addr is in the range of a mm's vma?
  if (vma == NULL || vma->vm_start > addr) {
    printf("not valid addr %x, and  can not find it in vma\n", addr);
    // goto failed;
    return ret;
  }

  //check the error_code
  // switch (error_code & 3) {
  // default:
  //         // error code flag : default is 3 ( W/R=1, P=1): write, present
  // case 2:
  //     // error code flag : (W/R=1, P=0): write, not present
  //     if (!(vma->vm_flags & VM_WRITE)) {
  //         printf("do_pgfault failed: error code flag = write AND not present, but the addr's vma cannot write\n");
  //         // goto failed;
  //         return ret;
  //     }
  //     break;
  // case 1:
  //     // error code flag : (W/R=0, P=1): read, present
  //     printf("do_pgfault failed: error code flag = read AND present\n");
  //     // goto failed;
  //     return ret;
  // case 0:
  //     // error code flag : (W/R=0, P=0): read, not present
  //     if (!(vma->vm_flags & (VM_READ | VM_EXEC))) {
  //         printf("do_pgfault failed: error code flag = read AND not present, but the addr's vma cannot read or exec\n");
  //         // goto failed;
  //         return ret;
  //     }
  // }

  /* IF (write an existed addr ) OR
   *    (write an non_existed addr && addr is writable) OR
   *    (read  an non_existed addr && addr is readable)
   * THEN
   *    continue process
   */
  perm = PTE_U;
  if (vma->vm_flags & VM_WRITE) {
    perm |= PTE_W;
  }
  addr = ROUNDDOWN(addr, PGSIZE);

  ret = -E_NO_MEM;

  ptep = NULL;

  /*LAB3 EXERCISE 1: YOUR CODE
   * Maybe you want help comment, BELOW comments can help you finish the code
   *
   * Some Useful MACROs and DEFINEs, you can use them in below implementation.
   * MACROs or Functions:
   *   get_pte : get an pte and return the kernel virtual address of this pte for la
   *             if the PT contians this pte didn't exist, alloc a page for PT (notice the 3th parameter '1')
   *   pgdir_alloc_page : call alloc_page & page_insert functions to allocate a page size memory & setup
   *             an addr map pa<--->la with linear address la and the PDT pgdir
   * DEFINES:
   *   VM_WRITE  : If vma->vm_flags & VM_WRITE == 1/0, then the vma is writable/non writable
   *   PTE_W           0x002                   // page table/directory entry flags bit : Writeable
   *   PTE_U           0x004                   // page table/directory entry flags bit : User can access
   * VARIABLES:
   *   mm->pgdir : the PDT of these vma
   *
   */
// #if 0
/*LAB3 EXERCISE 1: YOUR CODE*/
// ptep = ???              //(1) try to find a pte, if pte's PT(Page Table) isn't existed, then create a PT.
// if (*ptep == 0) {
//                         //(2) if the phy addr isn't exist, then alloc a page & map the phy addr with logical addr

  // }
  // else {
  /*LAB3 EXERCISE 2: YOUR CODE
   * Now we think this pte is a  swap entry, we should load data from disk to a page with phy addr,
   * and map the phy addr with logical addr, trigger swap manager to record the access situation of this page.
   *
   *  Some Useful MACROs and DEFINEs, you can use them in below implementation.
   *  MACROs or Functions:
   *    swap_in(mm, addr, &page) : alloc a memory page, then according to the swap entry in PTE for addr,
   *                               find the addr of disk page, read the content of disk page into this memroy page
   *    page_insert ： build the map of phy addr of an Page with the linear addr la
   *    swap_map_swappable ： set the page swappable
   */
  //      if(swap_init_ok) {
  //          struct Page *page=NULL;
  //                                  //(1）According to the mm AND addr, try to load the content of right disk page
  //                                  //    into the memory which page managed.
  //                                  //(2) According to the mm, addr AND page, setup the map of phy addr <---> logical addr
  //                                  //(3) make the page swappable.
  //                                  //(4) [NOTICE]: you myabe need to update your lab3's implementation for LAB5's normal execution.
  //      }
  //      else {
  //          cprintf("no swap_init_ok but ptep is %x, failed\n",*ptep);
  //          goto failed;
  //      }
  // }
  // #endif
  // try to find a pte, if pte's PT(Page Table) isn't existed, then create a PT.
  // (notice the 3th parameter '1')


  if ((ptep = get_pte(mm->pgdir, addr, 1)) == NULL) {
    printf("get_pte in do_pgfault failed\n");
    return ret;
  }

  if (*ptep == 0) {   // if the phy addr isn't exist, then alloc a page & map the phy addr with logical addr
    if (pgdir_alloc_page(mm->pgdir, addr, perm) == NULL) {
      printf("pgdir_alloc_page in do_pgfault failed\n");
      return ret;
    }
  }
  else {   // if this pte is a swap entry, then load data from disk to a page with phy addr
           // and call page_insert to map the phy addr with logical addr
    page = NULL;
    printf("do pgfault: ptep %x, pte %x\n",ptep, *ptep);
    if (*ptep & PTE_P) {
      //if process write to this existed readonly page (PTE_P means existed), then should be here now.
      //we can implement the delayed memory space copy for fork child process (AKA copy on write, COW).
      //we didn't implement now, we will do it in future.
      panic("error write a non-writable pte");
      //page = pte2page(*ptep);
    } else{
      // if this pte is a swap entry, then load data from disk to a page with phy addr
      // and call page_insert to map the phy addr with logical addr
      if(swap_init_ok) {
	if ((ret = swap_in(mm, addr, &page)) != 0) {
	  printf("swap_in in do_pgfault failed\n");
	  return ret;
	}
      }
      else {
	printf("no swap_init_ok but ptep is %x, failed\n",*ptep);
	return ret;
      }
    }
    page_insert(mm->pgdir, page, addr, perm);
    swap_map_swappable(mm, addr, page, 1);
    page->pra_vaddr = addr;
  }
  ret = 0;
  return ret;
}

#endif /* !__KERN_MM_VMM_H__ */
